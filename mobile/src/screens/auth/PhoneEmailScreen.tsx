import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { sendCode } from '../../api/authApi';

interface Props {
  navigation: any;
}

export default function PhoneEmailScreen({ navigation }: Props) {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);

  const isEmail = target.includes('@');
  const isPhone = target.startsWith('+') && target.length >= 7;
  const isValid = isEmail || isPhone;

  async function handleSend() {
    if (!isValid) {
      Alert.alert('Ошибка', 'Введите корректный номер телефона (+79001234567) или email');
      return;
    }
    setLoading(true);
    try {
      await sendCode(target.trim());
      navigation.navigate('VerifyCode', { target: target.trim() });
    } catch (err: any) {
      Alert.alert(
        'Ошибка',
        err?.response?.data?.error || 'Не удалось отправить код'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.logo}>Blizkie</Text>
          <Text style={styles.subtitle}>
            Введите номер телефона или email для входа
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={target}
            onChangeText={setTarget}
            placeholder="Телефон (+79001234567) или Email"
            placeholderTextColor={Colors.textLight}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={handleSend}
          />

          <Text style={styles.hint}>
            {isEmail
              ? '✉️ Код придёт на почту'
              : isPhone
              ? '📱 Код придёт по SMS'
              : 'Начните с + для телефона или введите email'}
          </Text>

          <TouchableOpacity
            style={[styles.button, !isValid && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={loading || !isValid}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Продолжить</Text>
            )}
          </TouchableOpacity>
        </View>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.backgroundSecondary,
  },
  hint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
