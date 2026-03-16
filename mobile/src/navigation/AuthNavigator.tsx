import React, { useMemo } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PhoneEmailScreen from '../screens/auth/PhoneEmailScreen';
import VerifyCodeScreen from '../screens/auth/VerifyCodeScreen';
import SetupProfileScreen from '../screens/auth/SetupProfileScreen';
import { useColors } from '../hooks/useColors';

const Stack = createStackNavigator();

export default function AuthNavigator() {
  const C = useColors();
  const screenOptions = useMemo(() => ({
    headerStyle: { backgroundColor: C.background, shadowColor: 'transparent' },
    headerTintColor: C.primary,
    headerBackTitleVisible: false,
    cardStyle: { backgroundColor: C.background },
  }), [C]);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="PhoneEmail"
        component={PhoneEmailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VerifyCode"
        component={VerifyCodeScreen as any}
        options={{ title: 'Подтверждение' }}
      />
      <Stack.Screen
        name="SetupProfile"
        component={SetupProfileScreen as any}
        options={{ title: 'Профиль' }}
      />
    </Stack.Navigator>
  );
}
