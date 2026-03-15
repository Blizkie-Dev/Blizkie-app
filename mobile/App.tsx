import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRef } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { setupNotifications } from './src/utils/notifications';
import { useAuthStore } from './src/store';
import { getChatById } from './src/api/chatsApi';

export default function App() {
  const token = useAuthStore((s) => s.token);
  const listenerRef = useRef<Notifications.Subscription | null>(null);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    if (!token) return;

    setupNotifications();

    listenerRef.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const chatId = response.notification.request.content.data?.chatId as string | undefined;
        if (!chatId || !navigationRef.current) return;

        try {
          const chat = await getChatById(chatId);
          navigationRef.current.navigate('Chats', {
            screen: 'Chat',
            params: { chat },
          });
        } catch (err) {
          console.warn('[Notifications] Failed to navigate to chat:', err);
        }
      }
    );

    return () => {
      listenerRef.current?.remove();
    };
  }, [token]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <RootNavigator navigationRef={navigationRef} />
    </GestureHandlerRootView>
  );
}
