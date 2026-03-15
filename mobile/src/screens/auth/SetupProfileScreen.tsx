import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { checkUsername, updateMe } from '../../api/usersApi';
import { saveUser } from '../../utils/storage';
import { useAuthStore } from '../../store';
import { User } from '../../api/authApi';

interface Props {
  navigation: any;
  route: { params: { token: string; user: User } };
}

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export default function SetupProfileScreen({ navigation, route }: Props) {
  const { token, user } = route.params;
  const setAuth = useAuthStore((s) => s.setAuth);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [saving, setSaving] = useState(false);
  const checkTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUsernameChange = useCallback((text: string) => {
    const val = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(val);

    if (checkTimer.current) clearTimeout(checkTimer.current);

    if (!val) {
      setUsernameStatus('idle');
      return;
    }
    if (!USERNAME_RE.test(val)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    checkTimer.current = setTimeout(async () => {
      try {
        const { available } = await checkUsername(val);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
  }, []);

  const canSave =
    displayName.trim().length >= 1 &&
    (username === '' || usernameStatus === 'available') &&
    !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const fields: any = { display_name: displayName.trim() };
      if (username) fields.username = username;
      const updated = await updateMe(fields);
      await saveUser(updated);
      setAuth(updated, token);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Не удалось сохранить профиль';
      Alert.alert('Ошибка', msg);
    } finally {
      setSaving(false);
    }
  }

  function usernameHint() {
    if (usernameStatus === 'invalid') return { text: 'От 3 до 32 символов: буквы, цифры, _', color: Colors.textSecondary };
    if (usernameStatus === 'checking') return { text: 'Проверяем…', color: Colors.textSecondary };
    if (usernameStatus === 'available') return { text: 'Доступно ✓', color: '#34C759' };
    if (usernameStatus === 'taken') return { text: 'Занято', color: '#FF3B30' };
    return { text: 'Необязательно. Только буквы, цифры, _', color: Colors.textSecondary };
  }

  const hint = usernameHint();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Создайте профиль</Text>
        <Text style={styles.subtitle}>Как вас будут называть в Blizkie?</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Имя *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ваше имя"
            placeholderTextColor={Colors.textSecondary}
            value={displayName}
            onChangeText={setDisplayName}
            autoFocus
            maxLength={64}
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Имя пользователя</Text>
          <TextInput
            style={[
              styles.input,
              usernameStatus === 'taken' && styles.inputError,
              usernameStatus === 'available' && styles.inputOk,
            ]}
            placeholder="username"
            placeholderTextColor={Colors.textSecondary}
            value={username}
            onChangeText={handleUsernameChange}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={32}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <Text style={[styles.hint, { color: hint.color }]}>{hint.text}</Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, !canSave && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Продолжить</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 36,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  inputOk: {
    borderColor: '#34C759',
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  btn: {
    marginTop: 12,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
