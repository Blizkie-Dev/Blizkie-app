import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Pressable,
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
  const [fabOpen, setFabOpen] = useState(false);

  // Animation values
  const animation = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

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
        try {
          const chat = await getChatById(message.chat_id);
          upsertChat({ ...chat, last_message: message, unread_count: 1 });
          joinChat(message.chat_id);
        } catch {
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

  function toggleFab() {
    const toValue = fabOpen ? 0 : 1;
    Animated.parallel([
      Animated.spring(animation, {
        toValue,
        useNativeDriver: true,
        bounciness: 12,
        speed: 14,
      }),
      Animated.spring(rotateAnim, {
        toValue,
        useNativeDriver: true,
        bounciness: 8,
        speed: 14,
      }),
    ]).start();
    setFabOpen(!fabOpen);
  }

  function closeFab() {
    Animated.parallel([
      Animated.spring(animation, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 8,
        speed: 18,
      }),
      Animated.spring(rotateAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 8,
        speed: 18,
      }),
    ]).start();
    setFabOpen(false);
  }

  // Sub-button 1 (direct chat) — closer to main FAB
  const translateY1 = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -76],
  });
  // Sub-button 2 (group) — further
  const translateY2 = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -144],
  });

  const opacity = animation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

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
              Нажмите +, чтобы начать общение
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

      {/* Backdrop — closes FAB when tapping outside */}
      {fabOpen && (
        <Pressable style={styles.backdrop} onPress={closeFab} />
      )}

      {/* Sub-button: group chat */}
      <Animated.View
        style={[
          styles.subFabContainer,
          { transform: [{ translateY: translateY2 }], opacity },
        ]}
        pointerEvents={fabOpen ? 'auto' : 'none'}
      >
        <Text style={styles.subFabLabel}>Группа</Text>
        <TouchableOpacity
          style={[styles.fab, styles.subFab]}
          onPress={() => { closeFab(); navigation.navigate('CreateGroup'); }}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>👥</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Sub-button: direct chat */}
      <Animated.View
        style={[
          styles.subFabContainer,
          { transform: [{ translateY: translateY1 }], opacity },
        ]}
        pointerEvents={fabOpen ? 'auto' : 'none'}
      >
        <Text style={styles.subFabLabel}>Личный чат</Text>
        <TouchableOpacity
          style={[styles.fab, styles.subFab]}
          onPress={() => { closeFab(); navigation.navigate('SearchUsers'); }}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>✏️</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Main FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={toggleFab}
        activeOpacity={0.85}
      >
        <Animated.Text style={[styles.fabIcon, { transform: [{ rotate }] }]}>
          ＋
        </Animated.Text>
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
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  subFab: {
    position: 'relative',
    right: 0,
    bottom: 0,
  },
  subFabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subFabLabel: {
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  fabIcon: {
    fontSize: 22,
    color: '#fff',
  },
});
