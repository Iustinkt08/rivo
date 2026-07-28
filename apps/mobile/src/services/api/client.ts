import axios from 'axios';
import { NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../supabase';

// In dev, follow the Metro bundler host so the backend stays reachable from
// simulators AND real devices even when the Mac's LAN IP changes (DHCP).
// EXPO_PUBLIC_API_URL is used for production / deployed backends.
function resolveBaseUrl(): string {
  if (__DEV__) {
    // Expo Go exposes the host via the manifest; dev-client / `expo run:ios`
    // exposes it via the Metro bundle scriptURL. Use whichever resolves so the
    // backend stays reachable from simulator AND device without a hardcoded IP.
    const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
    const scriptURL: string | undefined = (NativeModules as any)?.SourceCode?.scriptURL;
    const scriptHost = scriptURL?.match(/^https?:\/\/([^:/]+)/)?.[1];
    const host = expoHost ?? scriptHost ?? 'localhost';
    return `http://${host}:3000/api/v1`;
  }
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
}

const BASE_URL = resolveBaseUrl();

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

/** Attach or remove the Supabase access token from all outgoing requests */
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Staff sessions use a backend-issued JWT instead of Supabase. While one is
// active it owns the Authorization header — Supabase auth events (e.g. a
// stray SIGNED_OUT) must not clear or overwrite it.
let staffTokenActive = false;

export const setStaffAuthToken = (token: string | null) => {
  staffTokenActive = token != null;
  setAuthToken(token);
};

// Auto-refresh: whenever Supabase refreshes the session, update the axios header
supabase.auth.onAuthStateChange((event, session) => {
  if (staffTokenActive) return;
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    setAuthToken(session?.access_token ?? null);
  } else if (event === 'SIGNED_OUT') {
    setAuthToken(null);
  }
});
