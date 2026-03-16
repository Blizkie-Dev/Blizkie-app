import React, { useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { getChats, getChatById } from '../../api/chatsApi';
import { useChatsStore, useAuthStore } from '../../store';
import ChatListItem from '../../components/ChatListItem';
import { getSocket, joinChat } from '../../socket/socketClient';
import { Message } from '../../api/chatsApi';

interface Props {
  navigation: any;
}

export default function ChatsListScreen({ navigation }: Props) {
  const { chats, setChats, updateLastMessage, incrementUnread, upsertChat, activeChatId } = useChatsStore();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadChats = useCallback(async () => {
    try {
      const data = await getChats();
      setChats(data);
    } catch (err) {
      console.error('Failed to load chats', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, []);

  // Listen for new messages to update last_message in chat list
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = async (message: Message) => {
      const chatKnown = useChatsStore.getState().chats.some((c) => c.id === message.chat_id);
      if (!chatKnown) {
        // New chat from another user — fetch full chat and add to list
        try {
          const chat = await getChatById(message.chat_id);
          upsertChat({ ...chat, last_message: message, unread_count: 1 });
          joinChat(message.chat_id);
        } catch {
          // If fetch fails just reload all chats
          loadChats();
        }
        return;
      }
      if (message.chat_id !== activeChatId) {
        incrementUnread(message.chat_id);
      }
      updateLastMessage(message.chat_id, message);
    };

    const onChatCreated = (chat: any) => {
      upsertChat(chat);
      joinChat(chat.id);
    };

    socket.on('new-message', handler);
    socket.on('chat-created', onChatCreated);
    return () => {
      socket.off('new-message', handler);
      socket.off('chat-created', onChatCreated);
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const sortedChats = [...chats].sort((a, b) => {
    const aTime = a.last_message?.created_at || a.created_at;
    const bTime = b.last_message?.created_at || b.created_at;
    return bTime - aTime;
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedChats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatListItem
            chat={item}
            currentUserId={user!.id}
            onPress={() => navigation.navigate('Chat', { chat: item })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Нет чатов</Text>
            <Text style={styles.emptySubtitle}>
              Нажмите на карандаш, чтобы начать общение
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadChats();
            }}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={sortedChats.length === 0 ? styles.emptyList : undefined}
      />

      <TouchableOpacity
        style={[styles.fab, styles.fabGroup]}
        onPress={() => navigation.navigate('CreateGroup')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>👥</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('SearchUsers')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>✏️</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGroup: {
    bottom: 92,
  },
  fabIcon: {
    fontSize: 22,
  },
});
