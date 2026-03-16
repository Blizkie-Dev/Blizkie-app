import React, { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import ChatsListScreen from '../screens/main/ChatsListScreen';
import ChatScreen from '../screens/main/ChatScreen';
import SearchUsersScreen from '../screens/main/SearchUsersScreen';
import CreateGroupScreen from '../screens/main/CreateGroupScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import { useColors } from '../hooks/useColors';

const Tab = createBottomTabNavigator();
const ChatsStack = createStackNavigator();

function ChatsStackNavigator() {
  const C = useColors();
  const screenOptions = useMemo(() => ({
    headerStyle: {
      backgroundColor: C.background,
      shadowColor: '#00000015',
    },
    headerTintColor: C.primary,
    headerBackTitleVisible: false,
    cardStyle: { backgroundColor: C.backgroundSecondary },
  }), [C]);

  return (
    <ChatsStack.Navigator screenOptions={screenOptions}>
      <ChatsStack.Screen
        name="ChatsList"
        component={ChatsListScreen}
        options={{ title: 'Blizkie' }}
      />
      <ChatsStack.Screen
        name="Chat"
        component={ChatScreen as any}
        options={{ title: '', gestureEnabled: true }}
      />
      <ChatsStack.Screen
        name="SearchUsers"
        component={SearchUsersScreen}
        options={{ title: 'Новый чат' }}
      />
      <ChatsStack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: 'Новая группа' }}
      />
    </ChatsStack.Navigator>
  );
}

export default function MainNavigator() {
  const C = useColors();
  const tabBarStyle = useMemo(() => ({
    backgroundColor: C.background,
    borderTopColor: C.border,
  }), [C]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textSecondary,
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatsStackNavigator}
        options={{
          tabBarLabel: 'Чаты',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 2, color }}>💬</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Профиль',
          headerShown: true,
          title: 'Мой профиль',
          headerStyle: { backgroundColor: C.background },
          headerTintColor: C.text,
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 2, color }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
