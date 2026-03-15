import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { useAuthStore } from '../store';
import { getToken, getSavedUser } from '../utils/storage';
import { connectSocket } from '../socket/socketClient';
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
  useEffect(() => {
    if (isAuthenticated && token) {
      connectSocket(token);
    }
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
