import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { useAuthStore, useOnlineStore } from '../store';
import { getToken, getSavedUser } from '../utils/storage';
import { connectSocket, getSocket } from '../socket/socketClient';
import { Colors } from '../constants/colors';

interface Props {
  navigationRef?: React.RefObject<NavigationContainerRef<any>>;
}

export default function RootNavigator({ navigationRef }: Props) {
  const { isAuthenticated, setAuth } = useAuthStore();
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      try {
        const token = await getToken();
        const user = await getSavedUser();
        if (token && user) {
          setAuth(user as any, token);
          connectSocket(token);
        }
      } catch (err) {
        console.error('Bootstrap error', err);
      } finally {
        setBootstrapping(false);
      }
    }
    bootstrap();
  }, []);

  // Connect socket when auth state changes to authenticated
  const token = useAuthStore((s) => s.token);
  const { setUserOnline, setUserOffline } = useOnlineStore();

  useEffect(() => {
    if (isAuthenticated && token) {
      connectSocket(token);
    }
  }, [isAuthenticated, token]);

  // Global online/offline listeners — registered right after socket is created
  // so we catch the initial user-online events the server emits on connect
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = getSocket();
    if (!socket) return;

    const onOnline = ({ userId }: { userId: string }) => setUserOnline(userId);
    const onOffline = ({ userId }: { userId: string }) => setUserOffline(userId);

    socket.on('user-online', onOnline);
    socket.on('user-offline', onOffline);

    return () => {
      socket.off('user-online', onOnline);
      socket.off('user-offline', onOffline);
    };
  }, [isAuthenticated, token]);

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
