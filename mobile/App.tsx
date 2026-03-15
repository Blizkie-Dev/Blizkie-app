import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import RootNavigator from './src/navigation/RootNavigator';
import { setupNotifications } from './src/utils/notifications';
import { useAuthStore } from './src/store';

export default function App() {
  const token = useAuthStore((s) => s.token);
  const listenerRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!token) return;

    setupNotifications();

    // Handle notification taps
    listenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('[Notifications] Tapped:', response.notification.request.content);
        // TODO: navigate to specific chat using response.notification.request.content.data.chatId
      }
    );

    return () => {
      listenerRef.current?.remove();
    };
  }, [token]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <RootNavigator />
    </GestureHandlerRootView>
  );
}
