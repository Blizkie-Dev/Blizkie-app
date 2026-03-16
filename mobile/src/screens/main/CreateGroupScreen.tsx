import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { searchUsers } from '../../api/usersApi';
import { createGroupChat } from '../../api/chatsApi';
import { User } from '../../api/authApi';
import { useChatsStore } from '../../store';
import Avatar from '../../components/Avatar';
import { joinChat } from '../../socket/socketClient';
import { useColors } from '../../hooks/useColors';

interface Props {
  navigation: any;
}

export default function CreateGroupScreen({ navigation }: Props) {
  const [groupName, setGroupName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
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
      setSearching(true);
      try {
        const data = await searchUsers(text.trim());
        setResults(data.filter((u) => !selected.some((s) => s.id === u.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  function toggleUser(user: User) {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  }

  const canCreate = groupName.trim().length > 0 && selected.length >= 2;

  async function handleCreate() {
    if (!canCreate) return;
    setCreating(true);
    try {
      const chat = await createGroupChat(
        groupName.trim(),
        selected.map((u) => u.id)
      );
      upsertChat(chat);
      joinChat(chat.id);
      navigation.replace('Chat', { chat });
    } catch (err: any) {
      Alert.alert('Ошибка', err?.response?.data?.error || 'Не удалось создать группу');
    } finally {
      setCreating(false);
    }
  }

  const selectedName = (u: User) => u.display_name || u.username || 'Пользователь';

  return (
    <View style={styles.container}>
      <View style={styles.nameSection}>
        <TextInput
          style={styles.nameInput}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Название группы"
          placeholderTextColor={C.textLight}
          maxLength={64}
          returnKeyType="next"
        />
      </View>

      {selected.length > 0 && (
        <View style={styles.chipsSection}>
          <FlatList
            data={selected}
            horizontal
            keyExtractor={(u) => u.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.chip} onPress={() => toggleUser(item)}>
                <Text style={styles.chipText} numberOfLines={1}>{selectedName(item)}</Text>
                <Text style={styles.chipRemove}>✕</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <Text style={styles.hint}>
        {selected.length < 2
          ? `Выберите минимум 2 участника (выбрано: ${selected.length})`
          : `Участников: ${selected.length}`}
      </Text>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleSearch}
          placeholder="Добавить участника..."
          placeholderTextColor={C.textLight}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {searching && <ActivityIndicator color={C.primary} style={{ marginTop: 12 }} />}

      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => {
          const name = selectedName(item);
          const isSelected = selected.some((s) => s.id === item.id);
          return (
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => toggleUser(item)}
              activeOpacity={0.7}
            >
              <Avatar uri={item.avatar_url} name={name} size={44} />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{name}</Text>
                {item.username && <Text style={styles.userHandle}>@{item.username}</Text>}
              </View>
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          query.length >= 2 && !searching ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Никого не найдено</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={!canCreate || creating}
        activeOpacity={0.85}
      >
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>Создать группу</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (C: ReturnType<typeof import('../../hooks/useColors').useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    nameSection: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    nameInput: {
      borderWidth: 1.5,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: C.text,
      backgroundColor: C.backgroundSecondary,
    },
    chipsSection: {
      paddingVertical: 8,
    },
    chips: {
      paddingHorizontal: 16,
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.primary + '20',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 6,
    },
    chipText: {
      fontSize: 13,
      color: C.primary,
      fontWeight: '500',
      maxWidth: 100,
    },
    chipRemove: {
      fontSize: 11,
      color: C.primary,
    },
    hint: {
      fontSize: 13,
      color: C.textSecondary,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 4,
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
    searchInput: {
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
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
    checkmark: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    empty: {
      alignItems: 'center',
      paddingTop: 40,
    },
    emptyText: {
      color: C.textSecondary,
      fontSize: 15,
    },
    createButton: {
      margin: 16,
      backgroundColor: C.primary,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: 'center',
    },
    createButtonDisabled: {
      opacity: 0.4,
    },
    createButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
