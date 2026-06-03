import { getMessaging } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const messaging = getMessaging();
  const authStatus = await messaging.requestPermission();
  const enabled =
    authStatus === 1 || // AUTHORIZED
    authStatus === 2;   // PROVISIONAL
  return enabled;
}

export async function getFCMToken(): Promise<string | null> {
  try {
    const messaging = getMessaging();
    const token = await messaging.getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data ?? {},
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: 'default',
    },
  });
}

export function setupNotificationListeners() {
  const messaging = getMessaging();

  const unsubscribeForeground = messaging.onMessage(async (remoteMessage) => {
    await sendLocalNotification(
      remoteMessage.notification?.title ?? 'Notifikasi',
      remoteMessage.notification?.body ?? '',
      remoteMessage.data as Record<string, string>
    );
  });

  messaging.onNotificationOpenedApp((remoteMessage) => {
    console.log('Notification opened from background:', remoteMessage);
  });

  messaging.getInitialNotification().then((remoteMessage) => {
    if (remoteMessage) {
      console.log('App opened from quit state via notification:', remoteMessage);
    }
  });

  return unsubscribeForeground;
}
