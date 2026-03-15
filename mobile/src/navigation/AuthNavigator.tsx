import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PhoneEmailScreen from '../screens/auth/PhoneEmailScreen';
import VerifyCodeScreen from '../screens/auth/VerifyCodeScreen';
import { Colors } from '../constants/colors';

const Stack = createStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background, shadowColor: 'transparent' },
        headerTintColor: Colors.primary,
        headerBackTitleVisible: false,
        cardStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen
        name="PhoneEmail"
        component={PhoneEmailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VerifyCode"
        component={VerifyCodeScreen}
        options={{ title: 'Подтверждение' }}
      />
    </Stack.Navigator>
  );
}
