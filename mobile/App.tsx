import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRef } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { setupNotifications } from './src/utils/notifications';
import { useAuthStore, useThemeStore } from './src/store';
import { getChatById } from './src/api/chatsApi';

async function navigateToChat(
  navigationRef: React.RefObject<NavigationContainerRef<any>>,
  chatId: string
) {
  if (!navigationRef.current) return;
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

export default function App() {
  const token = useAuthStore((s) => s.token);
  const listenerRef = useRef<Notifications.Subscription | null>(null);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const isDark = useThemeStore((s) => s.isDark);
  const initTheme = useThemeStore((s) => s.initTheme);

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    if (!token) return;

    setupNotifications();

    // Case 1: app was killed and launched by tapping a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const chatId = response?.notification.request.content.data?.chatId as string | undefined;
      if (chatId) navigateToChat(navigationRef, chatId);
    });

    // Case 2: app is in foreground/background and user taps notification
    listenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const chatId = response.notification.request.content.data?.chatId as string | undefined;
        if (chatId) navigateToChat(navigationRef, chatId);
      }
    );

    return () => {
      listenerRef.current?.remove();
    };
  }, [token]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator navigationRef={navigationRef} />
    </GestureHandlerRootView>
  );
}
