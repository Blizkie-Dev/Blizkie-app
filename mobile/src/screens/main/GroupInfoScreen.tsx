import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User } from '../../api/authApi';
import { Chat, addChatMember, removeChatMember } from '../../api/chatsApi';
import { searchUsers } from '../../api/usersApi';
import { useAuthStore, useChatsStore } from '../../store';
import Avatar from '../../components/Avatar';
import { useColors } from '../../hooks/useColors';

interface Props {
  navigation: any;
  route: { params: { chat: Chat } };
}

export default function GroupInfoScreen({ navigation, route }: Props) {
  const { chat } = route.params;
  const currentUser = useAuthStore((s) => s.user)!;
  const { upsertChat } = useChatsStore();
  const C = useColors();
  const styles = useMemo(() => createStyles(C), [C]);

  const isCreator = chat.creator_id === currentUser.id;

  // Members from the live store so it updates after add/remove
  const { chats } = useChatsStore();
  const liveChat = chats.find((c) => c.id === chat.id) || chat;
  const members = liveChat.members;

  // Add member UI state
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(text: string) {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchUsers(text.trim());
        // Filter out people already in the chat
        setResults(data.filter((u) => !members.some((m) => m.id === u.id)));
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
  }

  async function handleAdd(user: User) {
    setAdding(user.id);
    try {
      const updated = await addChatMember(liveChat.id, user.id);
      upsertChat(updated);
      setResults((prev) => prev.filter((u) => u.id !== user.id));
      setQuery('');
      setShowSearch(false);
    } catch (err: any) {
      Alert.alert('Ошибка', err?.response?.data?.error || 'Не удалось добавить');
    } finally {
      setAdding(null);
    }
  }

  function confirmRemove(user: User) {
    Alert.alert(
      'Удалить участника?',
      `${user.display_name || user.username} будет удалён из группы`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => handleRemove(user),
        },
      ]
    );
  }

  async function handleRemove(user: User) {
    setRemoving(user.id);
    try {
      const updated = await removeChatMember(liveChat.id, user.id);
      upsertChat(updated);
    } catch (err: any) {
      Alert.alert('Ошибка', err?.response?.data?.error || 'Не удалось удалить');
    } finally {
      setRemoving(null);
    }
  }

  const memberName = (u: User) => u.display_name || u.username || 'Пользователь';

  return (
    <View style={styles.container}>
      {/* Group header */}
      <View style={styles.header}>
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarEmoji}>👥</Text>
        </View>
        <Text style={styles.groupName}>{liveChat.name || 'Группа'}</Text>
        <Text style={styles.memberCount}>{members.length} участников</Text>
      </View>

      {/* Add member button (creator only) */}
      {isCreator && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowSearch((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name={showSearch ? 'close' : 'person-add'} size={18} color={C.primary} />
          <Text style={styles.addButtonText}>
            {showSearch ? 'Закрыть' : 'Добавить участника'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Search panel */}
      {showSearch && (
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={C.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={handleSearch}
              placeholder="Поиск пользователей..."
              placeholderTextColor={C.textLight}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {searching && <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />}
          {results.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={styles.searchResult}
              onPress={() => handleAdd(u)}
              disabled={adding === u.id}
              activeOpacity={0.7}
            >
              <Avatar uri={u.avatar_url} name={memberName(u)} size={40} />
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{memberName(u)}</Text>
                {u.username && <Text style={styles.resultHandle}>@{u.username}</Text>}
              </View>
              {adding === u.id
                ? <ActivityIndicator size="small" color={C.primary} />
                : <Ionicons name="add-circle-outline" size={24} color={C.primary} />
              }
            </TouchableOpacity>
          ))}
          {query.length >= 2 && !searching && results.length === 0 && (
            <Text style={styles.noResults}>Никого не найдено</Text>
          )}
        </View>
      )}

      {/* Section header */}
      <Text style={styles.sectionTitle}>УЧАСТНИКИ</Text>

      {/* Members list */}
      <FlatList
        data={members}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => {
          const name = memberName(item);
          const isMe = item.id === currentUser.id;
          const isOwner = item.id === liveChat.creator_id;
          return (
            <View style={styles.memberRow}>
              <Avatar uri={item.avatar_url} name={name} size={46} />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {name}{isMe ? ' (я)' : ''}
                </Text>
                {item.username && <Text style={styles.memberHandle}>@{item.username}</Text>}
              </View>
              {isOwner && (
                <View style={styles.ownerBadge}>
                  <Text style={styles.ownerText}>создатель</Text>
                </View>
              )}
              {isCreator && !isMe && !isOwner && (
                removing === item.id
                  ? <ActivityIndicator size="small" color={C.danger} />
                  : (
                    <TouchableOpacity onPress={() => confirmRemove(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="remove-circle-outline" size={24} color={C.danger} />
                    </TouchableOpacity>
                  )
              )}
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}

const createStyles = (C: ReturnType<typeof import('../../hooks/useColors').useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.backgroundSecondary,
    },
    header: {
      alignItems: 'center',
      paddingVertical: 24,
      backgroundColor: C.background,
    },
    groupAvatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: C.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    groupAvatarEmoji: {
      fontSize: 36,
    },
    groupName: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
    },
    memberCount: {
      fontSize: 13,
      color: C.textSecondary,
      marginTop: 4,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.background,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginTop: 12,
      borderRadius: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    addButtonText: {
      fontSize: 15,
      color: C.primary,
      fontWeight: '500',
    },
    searchSection: {
      backgroundColor: C.background,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.backgroundSecondary,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: C.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: C.text,
    },
    searchResult: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    resultInfo: { flex: 1 },
    resultName: { fontSize: 15, fontWeight: '500', color: C.text },
    resultHandle: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
    noResults: {
      textAlign: 'center',
      color: C.textSecondary,
      paddingVertical: 12,
      fontSize: 14,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: C.primary,
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 8,
      textTransform: 'uppercase',
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: C.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 15, fontWeight: '500', color: C.text },
    memberHandle: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
    ownerBadge: {
      backgroundColor: C.primary + '20',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    ownerText: {
      fontSize: 11,
      color: C.primary,
      fontWeight: '600',
    },
  });
