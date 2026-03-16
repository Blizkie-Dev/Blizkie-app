import React, { useState, useMemo } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { searchUsers } from '../../api/usersApi';
import { createOrGetChat } from '../../api/chatsApi';
import { User } from '../../api/authApi';
import { useChatsStore } from '../../store';
import Avatar from '../../components/Avatar';
import { joinChat } from '../../socket/socketClient';
import { useColors } from '../../hooks/useColors';

interface Props {
  navigation: any;
}

export default function SearchUsersScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const { upsertChat } = useChatsStore();
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const C = useColors();
  const styles = useMemo(() => createStyles(C), [C]);

  function handleSearch(text: string) {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchUsers(text.trim());
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  async function handleOpenChat(user: User) {
    setOpening(user.id);
    try {
      const chat = await createOrGetChat(user.id);
      upsertChat(chat);
      joinChat(chat.id);
      navigation.replace('Chat', { chat });
    } catch (err: any) {
      Alert.alert('Ошибка', err?.response?.data?.error || 'Не удалось открыть чат');
    } finally {
      setOpening(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleSearch}
          placeholder="Поиск по имени или username"
          placeholderTextColor={C.textLight}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {loading && (
        <ActivityIndicator color={C.primary} style={{ marginTop: 24 }} />
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const name = item.display_name || item.username || 'Пользователь';
          return (
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => handleOpenChat(item)}
              activeOpacity={0.7}
              disabled={opening === item.id}
            >
              <Avatar uri={item.avatar_url} name={name} size={46} />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{name}</Text>
                {item.username && (
                  <Text style={styles.userHandle}>@{item.username}</Text>
                )}
              </View>
              {opening === item.id && (
                <ActivityIndicator color={C.primary} size="small" />
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          query.length >= 2 && !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Никого не найдено</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const createStyles = (C: ReturnType<typeof import('../../hooks/useColors').useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 12,
      paddingHorizontal: 14,
      backgroundColor: C.backgroundSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      height: 44,
    },
    searchIcon: {
      fontSize: 16,
      marginRight: 8,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: C.text,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
      gap: 12,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: '500',
      color: C.text,
    },
    userHandle: {
      fontSize: 13,
      color: C.textSecondary,
      marginTop: 2,
    },
    empty: {
      alignItems: 'center',
      paddingTop: 60,
    },
    emptyText: {
      color: C.textSecondary,
      fontSize: 15,
    },
  });
