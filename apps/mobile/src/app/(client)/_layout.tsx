import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import FloatingTabBar from '../../components/client/FloatingTabBar';
import { bookingsApi } from '../../services/api/bookings';

// Notifications shown in foreground as banners
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const PROMPTED_KEY = 'navira-prompted-reviews';

async function setupPushNotifications() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    const { status } = existing === 'granted'
      ? { status: existing }
      : await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('navira-client', {
        name: 'NAVIRA',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C3AED',
      });
    }
  } catch {
    // Simulator or permissions denied — proceed silently
  }
}

export default function ClientLayout() {
  const router = useRouter();
  const checkedRef = useRef(false);
  const notifListenerRef = useRef<Notifications.EventSubscription | null>(null);
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);

  // Setup push notifications on mount
  useEffect(() => {
    setupPushNotifications();

    // Navigate to bookings when user taps a notification
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(() => {
      router.navigate('/(client)/bookings');
    });

    return () => {
      notifListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, []);

  // On app open: find the first COMPLETED appointment with no review not yet prompted,
  // and navigate to the review screen after a short settle delay.
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROMPTED_KEY);
        const prompted: string[] = raw ? JSON.parse(raw) : [];

        const appointments = await bookingsApi.getMyAppointments();
        const pending = appointments.find(
          (a) => a.status === 'COMPLETED' && !a.hasReview && !prompted.includes(a.id),
        );
        if (!pending) return;

        await AsyncStorage.setItem(PROMPTED_KEY, JSON.stringify([...prompted, pending.id]));

        setTimeout(() => {
          router.push({
            pathname: '/(client)/review',
            params: {
              appointmentId: pending.id,
              salonName: pending.salonName,
              serviceName: pending.serviceName,
              date: pending.date,
            },
          });
        }, 1200);
      } catch {
        // silently ignore — never block app launch
      }
    })();
  }, []);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* Visible tabs — Home / Search / Booking / Profile */}
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="bookings" />
      <Tabs.Screen name="profile" />

      {/* Hidden screens — navigated to programmatically.
          Favorites is reachable via the heart action on the home header. */}
      <Tabs.Screen name="favorites"           options={{ href: null }} />
      <Tabs.Screen name="notifications"       options={{ href: null }} />
      <Tabs.Screen name="review"              options={{ href: null }} />
      <Tabs.Screen name="salon/[id]"          options={{ href: null }} />
      <Tabs.Screen name="professional/[id]"   options={{ href: null }} />
      {/* Full-screen booking flow — the floating bar would cover the footer CTA */}
      <Tabs.Screen
        name="booking"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="booking-confirmed"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen name="settings"            options={{ href: null }} />
      <Tabs.Screen name="notification-settings" options={{ href: null }} />
      <Tabs.Screen name="change-password"     options={{ href: null }} />
    </Tabs>
  );
}
