import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useAuthStore, type UserRole } from '../store/authStore';
import { Colors } from '../theme';

/** Roles that belong to the business (salon-side) app. */
const BUSINESS_ROLES: readonly UserRole[] = ['ADMIN_SALON', 'STAFF_MEMBER', 'SUPER_ADMIN'];

/** Root providers: gesture handling + host for BottomSheetModal-based sheets (DraggableSheet). */
function Providers({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const { isAuthenticated, user, hasCompletedOnboarding, restoreSession } = useAuthStore();

  // Cold-start gate: true only while the initial session restore runs.
  // Deliberately NOT the store's live `isLoading` — gating on that unmounted
  // the (auth) <Stack> whenever a login attempt flipped isLoading, so a FAILED
  // login remounted the stack at its initial route ((auth)/index → splash →
  // auto-redirect to /welcome), bouncing the user off the login screen.
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Restore Supabase session on every cold start
  useEffect(() => {
    restoreSession()
      .catch((err) => console.warn('[root] session restore failed:', err))
      .finally(() => setIsRestoringSession(false));
  }, []);

  // While restoring the initial session, show a neutral loading screen to avoid flashing
  if (isRestoringSession) {
    return (
      <Providers>
        <View style={{ flex: 1, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </Providers>
    );
  }

  if (!isAuthenticated) {
    return (
      <Providers>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
        </Stack>
      </Providers>
    );
  }

  const role = user?.role;
  const isBusinessRole = role != null && (BUSINESS_ROLES as string[]).includes(role);

  // ADMIN_SALON who hasn't completed salon setup → onboarding wizard
  if (role === 'ADMIN_SALON' && !hasCompletedOnboarding) {
    return (
      <Providers>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
        </Stack>
      </Providers>
    );
  }

  // All business roles (ADMIN_SALON, STAFF_MEMBER, SUPER_ADMIN) → business app
  if (isBusinessRole) {
    return (
      <Providers>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(business)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="salon-identity" />
          <Stack.Screen name="salon-location" />
          <Stack.Screen name="salon-media" />
          <Stack.Screen name="salon-staff" />
          <Stack.Screen name="notifications" />
        </Stack>
      </Providers>
    );
  }

  // CLIENT (and any unknown future role) → client app
  return (
    <Providers>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(client)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="appointment-detail" />
      </Stack>
    </Providers>
  );
}
