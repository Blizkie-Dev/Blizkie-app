import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { Colors } from '../../constants/colors';
import { verifyCode, sendCode } from '../../api/authApi';
import { saveToken, saveUser } from '../../utils/storage';
import { useAuthStore } from '../../store';

interface Props {
  navigation: any;
  route: { params: { target: string } };
}

export default function VerifyCodeScreen({ navigation, route }: Props) {
  const { target } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputRef = useRef<TextInput>(null);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const interval = setInterval(() => {
      setResendTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (code.length === 6) {
      handleVerify(code);
    }
  }, [code]);

  async function handleVerify(c?: string) {
    const finalCode = c || code;
    if (finalCode.length !== 6) return;

    setLoading(true);
    try {
      const { token, user } = await verifyCode(target, finalCode);
      await saveToken(token);
      await saveUser(user);
      setAuth(user, token);
      // Navigation is handled by RootNavigator watching isAuthenticated
    } catch (err: any) {
      setCode('');
      Alert.alert(
        'Неверный код',
        err?.response?.data?.error || 'Проверьте код и попробуйте снова'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendTimer > 0) return;
    try {
      await sendCode(target);
      setResendTimer(60);
      Alert.alert('Готово', 'Новый код отправлен');
    } catch (err: any) {
      Alert.alert('Ошибка', err?.response?.data?.error || 'Не удалось отправить код');
    }
  }

  const isEmail = target.includes('@');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>Введите код</Text>
          <Text style={styles.subtitle}>
            Мы отправили 6-значный код на{'\n'}
            <Text style={styles.target}>{target}</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={styles.inputContainer}
          onPress={() => inputRef.current?.focus()}
          activeOpacity={1}
        >
          <View style={styles.dotsRow}>
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    code.length > i && styles.dotFilled,
                    code.length === i && styles.dotActive,
                  ]}
                >
                  <Text style={styles.dotText}>{code[i] || ''}</Text>
                </View>
              ))}
          </View>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.hiddenInput}
            autoFocus
            editable={!loading}
          />
        </TouchableOpacity>

        {loading && (
          <ActivityIndicator
            color={Colors.primary}
            style={{ marginTop: 24 }}
          />
        )}

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resendTimer > 0}
        >
          <Text
            style={[
              styles.resendText,
              resendTimer > 0 && styles.resendDisabled,
            ]}
          >
            {resendTimer > 0
              ? `Отправить снова через ${resendTimer}с`
              : 'Отправить снова'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Изменить {isEmail ? 'email' : 'телефон'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  target: {
    color: Colors.primary,
    fontWeight: '600',
  },
  inputContainer: {
    alignItems: 'center',
    width: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  dotActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  dotText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.text,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  resendButton: {
    marginTop: 32,
  },
  resendText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500',
  },
  resendDisabled: {
    color: Colors.textSecondary,
  },
  backButton: {
    marginTop: 16,
  },
  backText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
