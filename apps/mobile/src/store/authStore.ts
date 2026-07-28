import { create } from 'zustand';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { api, setAuthToken, setStaffAuthToken } from '../services/api/client';
import { staffAuthApi } from '../services/api/staffAuth';
import {
  isValidStoredStaffSession,
  StaffSession,
} from '../utils/staffSession';
import { useBusinessStore } from './businessStore';

const STAFF_SESSION_KEY = 'navira-staff-session';

export type UserRole = 'CLIENT' | 'ADMIN_SALON' | 'STAFF_MEMBER' | 'SUPER_ADMIN';

/**
 * Thrown when Supabase rejects an email+password sign-in. Supabase returns ONE
 * generic invalid-credentials error on purpose (it never discloses whether the
 * email or the password was wrong), so callers can only tell "credentials
 * rejected" apart from transient failures (network, backend profile fetch).
 */
export class InvalidCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  dateOfBirth?: string | null;
  gender?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;

  // Backend-issued staff session (username + password, no Supabase)
  staffSession: StaffSession | null;
  signInStaff: (username: string, password: string) => Promise<void>;

  // Real Supabase auth
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<{ isNewUser: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<{ isNewUser: boolean }>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  completeProfile: (dto: { firstName: string; lastName: string; phone?: string; avatarUrl?: string; role: 'CLIENT' | 'ADMIN_SALON' }) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;

  setOnboardingComplete: () => void;
  setUser: (user: AuthUser) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
}

/** After Supabase auth, call backend to upsert the DB user and get role/profile */
async function fetchNaviraProfile(): Promise<{ user: AuthUser; isNewUser: boolean; hasSalon: boolean }> {
  const { data } = await api.post('/auth/verify');
  return {
    user: {
      id: data.user.id,
      firstName: data.user.firstName,
      lastName: data.user.lastName,
      email: data.user.email,
      phone: data.user.phone,
      avatarUrl: data.user.avatarUrl,
      role: data.user.role as UserRole,
      dateOfBirth: data.user.dateOfBirth ?? null,
      gender: data.user.gender ?? null,
    },
    isNewUser: data.isNewUser ?? false,
    hasSalon: data.hasSalon ?? false,
  };
}

// Staff mode: business screens resolve the salon id from the store profile —
// seed a minimal one so staff never hits the admin-only /salons/my/salon.
function activateStaffSession(
  session: StaffSession,
  set: (partial: Partial<AuthState>) => void,
) {
  setStaffAuthToken(session.token);
  useBusinessStore.getState().setSalonProfile({
    id: session.salon.id,
    name: session.salon.name,
    addressLine1: '',
    city: '',
    requiresDeposit: false,
    cancellationHours: 24,
    openingHours: [],
  });
  set({
    staffSession: session,
    user: {
      id: session.staff.id,
      firstName: session.staff.firstName,
      lastName: session.staff.lastName,
      avatarUrl: session.staff.avatarUrl,
      role: 'STAFF_MEMBER',
    },
    isAuthenticated: true,
    hasCompletedOnboarding: true,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  staffSession: null,

  // ── Staff login (backend-issued JWT, no Supabase) ─────────────────────────
  signInStaff: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const session = await staffAuthApi.login(username, password);
      // Shared-tablet safety: kill any lingering Supabase session (e.g. the
      // owner's) so its background TOKEN_REFRESHED events can never repopulate
      // the Authorization header after the staff member logs out.
      await supabase.auth.signOut().catch((err) => {
        console.warn('[auth] Supabase sign-out before staff login failed:', err);
      });
      setAuthToken(null);
      await AsyncStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
      activateStaffSession(session, set);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Send OTP ──────────────────────────────────────────────────────────────
  sendOtp: async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new Error(error.message);
  },

  // ── Verify OTP ────────────────────────────────────────────────────────────
  verifyOtp: async (phone: string, otp: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });
      if (error || !data.session) throw new Error(error?.message ?? 'OTP verification failed');

      setAuthToken(data.session.access_token);

      const { user, isNewUser, hasSalon } = await fetchNaviraProfile();
      set({
        user,
        isAuthenticated: true,
        hasCompletedOnboarding: user.role !== 'ADMIN_SALON' || hasSalon,
      });
      return { isNewUser };
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Email + Password ──────────────────────────────────────────────────────
  signInWithEmail: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      // Typed error → LoginScreen shows the credentials-specific message instead
      // of treating this like a transient network/backend failure.
      if (error || !data.session) {
        throw new InvalidCredentialsError(error?.message ?? 'Sign in failed');
      }

      setAuthToken(data.session.access_token);

      const { user, isNewUser, hasSalon } = await fetchNaviraProfile();
      set({
        user,
        isAuthenticated: true,
        hasCompletedOnboarding: user.role !== 'ADMIN_SALON' || hasSalon,
      });
      return { isNewUser };
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Sign up with email ────────────────────────────────────────────────────
  signUpWithEmail: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });

    // Account already exists (e.g. a previous signup attempt that failed
    // mid-onboarding) — recover by signing in with the same credentials.
    if (error) {
      if (/already registered/i.test(error.message)) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError || !signInData.session) throw new Error(error.message);
        setAuthToken(signInData.session.access_token);
        return;
      }
      throw new Error(error.message);
    }

    // If Supabase "Confirm email" is ON, session is null after signUp.
    // Try signing in immediately — works if confirmation is disabled.
    let session = data.session;
    if (!session) {
      const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInData.session) {
        throw new Error(
          'Confirmarea emailului este activată în Supabase.\n' +
          'Dezactivează "Confirm email" din Dashboard → Authentication → Providers → Email.',
        );
      }
      session = signInData.session;
    }

    // Just store the token — completeProfile will be the first backend call,
    // so the guard creates the DB stub and completeProfile overwrites it atomically.
    setAuthToken(session.access_token);
  },

  // ── Complete profile (after role selection / client onboarding) ───────────
  completeProfile: async (dto) => {
    const { data } = await api.post('/auth/complete-profile', dto);
    set({
      user: {
        id: data.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
        role: data.role as UserRole,
      },
      isAuthenticated: true,
      hasCompletedOnboarding: dto.role !== 'ADMIN_SALON',
    });
  },

  // ── Restore session on app start ──────────────────────────────────────────
  restoreSession: async () => {
    set({ isLoading: true });
    try {
      // Staff sessions take precedence — they never exist in Supabase.
      const rawStaff = await AsyncStorage.getItem(STAFF_SESSION_KEY);
      if (rawStaff) {
        let stored: unknown = null;
        try {
          stored = JSON.parse(rawStaff);
        } catch {
          await AsyncStorage.removeItem(STAFF_SESSION_KEY);
        }
        if (isValidStoredStaffSession(stored)) {
          try {
            setStaffAuthToken(stored.token);
            // Cheap authed ping — proves the token is still accepted.
            await api.get('/notifications/me');
            activateStaffSession(stored, set);
            return;
          } catch (err) {
            const isDefinitiveAuthFailure =
              axios.isAxiosError(err) &&
              err.response != null &&
              (err.response.status === 401 || err.response.status === 403);
            setStaffAuthToken(null);
            if (isDefinitiveAuthFailure) {
              await AsyncStorage.removeItem(STAFF_SESSION_KEY);
            }
            // Transient (network/5xx): keep the stored session for the next
            // launch, but land on login for now rather than a broken app.
            return;
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setAuthToken(session.access_token);
      const { user, hasSalon, isNewUser } = await fetchNaviraProfile();

      // isNewUser=true during a restore means the backend just created a fresh
      // stub — the original DB row no longer exists (e.g. database was wiped).
      // Sign out cleanly so the user lands on the login screen instead of
      // entering the app as an incomplete stub account.
      if (isNewUser) {
        await supabase.auth.signOut();
        setAuthToken(null);
        // Store already defaults to unauthenticated; finally block clears isLoading.
        return;
      }

      set({
        user,
        isAuthenticated: true,
        hasCompletedOnboarding: user.role !== 'ADMIN_SALON' || hasSalon,
      });
    } catch (err) {
      // Definitive auth failure (HTTP 401 / 403): the Supabase token is
      // categorically rejected by the backend (invalid, expired key, wrong project).
      // Purge the stale session from AsyncStorage so the next launch goes to login.
      const isDefinitiveAuthFailure =
        axios.isAxiosError(err) &&
        err.response != null &&
        (err.response.status === 401 || err.response.status === 403);

      if (isDefinitiveAuthFailure) {
        await supabase.auth.signOut();
        setAuthToken(null);
      }
      // Network / timeout / 5xx (transient): do NOT purge the Supabase session.
      // A momentary backend outage must not log users out. The store stays at
      // unauthenticated defaults; the session is preserved for the next launch.
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Sign out ──────────────────────────────────────────────────────────────
  signOut: async () => {
    if (get().staffSession) {
      await AsyncStorage.removeItem(STAFF_SESSION_KEY);
      setStaffAuthToken(null);
      // Also drop any Supabase session that predates the staff login — once
      // staffTokenActive is off, its refresh events would silently reattach
      // the previous owner's token to the shared API client.
      await supabase.auth.signOut().catch((err) => {
        console.warn('[auth] Supabase sign-out after staff logout failed:', err);
      });
      setAuthToken(null);
    } else {
      await supabase.auth.signOut();
      setAuthToken(null);
    }
    // Salon data belongs to the signed-in account — never leak across sessions.
    useBusinessStore.getState().setSalonProfile(null);
    set({
      user: null,
      staffSession: null,
      isAuthenticated: false,
      hasCompletedOnboarding: false,
    });
  },

  setOnboardingComplete: () => set({ hasCompletedOnboarding: true }),
  setUser: (user) => set({ user, isAuthenticated: true }),
  updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
}));

/** Single derived flag for "logged in as a salon staff account". */
export const useIsStaffSession = () =>
  useAuthStore((s) => s.staffSession != null);
