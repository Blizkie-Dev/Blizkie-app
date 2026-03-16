import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import { Colors } from '../constants/colors';
import ChatsListScreen from '../screens/main/ChatsListScreen';
import ChatScreen from '../screens/main/ChatScreen';
import SearchUsersScreen from '../screens/main/SearchUsersScreen';
import CreateGroupScreen from '../screens/main/CreateGroupScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator();
const ChatsStack = createStackNavigator();

function ChatsStackNavigator() {
  return (
    <ChatsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.background,
          shadowColor: '#00000015',
        },
        headerTintColor: Colors.primary,
        headerBackTitleVisible: false,
        cardStyle: { backgroundColor: Colors.backgroundSecondary },
      }}
    >
      <ChatsStack.Screen
        name="ChatsList"
        component={ChatsListScreen}
        options={{ title: 'Blizkie' }}
      />
      <ChatsStack.Screen
        name="Chat"
        component={ChatScreen as any}
        options={{ title: '' }}
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
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
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 2, color }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
