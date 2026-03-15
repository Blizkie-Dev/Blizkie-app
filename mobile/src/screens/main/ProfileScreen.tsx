import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { updateMe, clearPushToken } from '../../api/usersApi';
import { uploadFile } from '../../api/chatsApi';
import { useAuthStore } from '../../store';
import { clearStorage } from '../../utils/storage';
import { compressImage } from '../../utils/imageUtils';
import { disconnectSocket } from '../../socket/socketClient';
import Avatar from '../../components/Avatar';

export default function ProfileScreen() {
  const { user, updateUser, clearAuth } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handleChangeAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const compressedUri = await compressImage(asset.uri);
      const filename = 'avatar.jpg';
      const mimeType = 'image/jpeg';
      const uploaded = await uploadFile(compressedUri, filename, mimeType);
      const updated = await updateMe({ avatar_url: uploaded.url });
      updateUser(updated);
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      Alert.alert('Ошибка загрузки', err?.message || String(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    if (!displayName.trim()) {
      Alert.alert('Ошибка', 'Имя не может быть пустым');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMe({
        display_name: displayName.trim(),
        username: username.trim() || null,
      });
      updateUser(updated);
      Alert.alert('Готово', 'Профиль сохранён');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Не удалось сохранить';
      Alert.alert('Ошибка', msg);
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert(
      'Выйти из аккаунта?',
      'Вы будете отключены от всех чатов',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: async () => {
            try { await clearPushToken(); } catch {}
            disconnectSocket();
            await clearStorage();
            clearAuth();
          },
        },
      ]
    );
  }

  const name = user?.display_name || user?.username || '?';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handleChangeAvatar} activeOpacity={0.8} disabled={uploadingAvatar}>
          <View>
            <Avatar uri={user?.avatar_url} name={name} size={90} />
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={16} color="#fff" />
              }
            </View>
          </View>
        </TouchableOpacity>
        <Text style={styles.nameText}>{name}</Text>
        <Text style={styles.accountText}>
          {user?.phone || user?.email}
        </Text>
      </View>

      {/* Edit fields */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Настройки профиля</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Имя</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ваше имя"
            placeholderTextColor={Colors.textLight}
            maxLength={64}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(t) =>
              setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())
            }
            placeholder="username (опционально)"
            placeholderTextColor={Colors.textLight}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={32}
          />
          <Text style={styles.inputHint}>Только латинские буквы, цифры и _</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Сохранить</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Account info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Аккаунт</Text>
        {user?.phone && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Телефон</Text>
            <Text style={styles.infoValue}>{user.phone}</Text>
          </View>
        )}
        {user?.email && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  content: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.background,
  },
  nameText: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  accountText: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  section: {
    marginTop: 16,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.backgroundSecondary,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 24,
    marginHorizontal: 20,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  logoutText: {
    fontSize: 16,
    color: Colors.danger,
    fontWeight: '500',
  },
});
