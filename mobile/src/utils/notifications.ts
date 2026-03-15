import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import client from '../api/client';

// Show alert + sound when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function setupNotifications(): Promise<void> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;

  if (existing !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    status = requested;
  }

  if (status !== 'granted') {
    console.log('[Notifications] Permission denied');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Сообщения',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2AABEE',
      sound: 'default',
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.log('[Notifications] Push token skipped: run "npx eas init" to configure projectId');
    return;
  }

  try {
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await client.put('/users/push-token', { push_token: pushToken });
    console.log('[Notifications] Push token registered:', pushToken);
  } catch (err: any) {
    console.log('[Notifications] Push token error:', err?.message ?? err);
  }
}
