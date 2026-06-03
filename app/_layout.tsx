import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  requestNotificationPermission,
  setupNotificationListeners,
  getFCMToken,
} from '@/lib/notifications';

export const unstable_settings = {
  anchor: '(tabs)',
};

async function setupNotifications() {
  // Minta izin notifikasi dari expo-notifications (untuk local notification)
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  // Buat notification channel (wajib di Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Setup Firebase FCM
  await requestNotificationPermission();
  await getFCMToken();
  setupNotificationListeners();
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    setupNotifications();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
