import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { Colors } from '../../constants/colors';
import { getMessages, sendMessage, markChatAsRead, uploadFile } from '../../api/chatsApi';
import { Message, Chat } from '../../api/chatsApi';
import { useMessagesStore, useChatsStore, useAuthStore } from '../../store';
import MessageBubble from '../../components/MessageBubble';
import TypingIndicator from '../../components/TypingIndicator';
import Avatar from '../../components/Avatar';
import { formatLastSeen } from '../../utils/formatTime';
import { compressImage } from '../../utils/imageUtils';
import {
  getSocket,
  joinChat,
  setActiveChat,
  emitTypingStart,
  emitTypingStop,
} from '../../socket/socketClient';

interface PendingMedia {
  uri: string;
  mimeType: string;
  filename: string;
  isVideo: boolean;
}

interface Props {
  navigation: any;
  route: { params: { chat: Chat } };
}

export default function ChatScreen({ navigation, route }: Props) {
  const { chat } = route.params;
  const headerHeight = useHeaderHeight();
  const user = useAuthStore((s) => s.user)!;
  const { messagesByChatId, setMessages, addMessage } = useMessagesStore();
  const { updateLastMessage, markChatRead, setActiveChatId, setPartnerReadAt, chats } = useChatsStore();
  const currentChat = chats.find((c) => c.id === chat.id);
  const partnerLastReadAt = currentChat?.partner_last_read_at || 0;

  const messages = messagesByChatId[chat.id] || [];
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  const otherMember = chat.members.find((m) => m.id !== user.id);
  const chatName = otherMember?.display_name || otherMember?.username || 'Чат';

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity style={styles.headerTitle}>
          <Avatar uri={otherMember?.avatar_url} name={chatName} size={36} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{chatName}</Text>
            <Text style={styles.headerStatus}>
              {otherMember
                ? formatLastSeen(otherMember.last_seen_at || 0)
                : ''}
            </Text>
          </View>
        </TouchableOpacity>
      ),
    });
  }, [chatName, otherMember]);

  // Track this as the active chat (for unread logic + push suppression)
  useEffect(() => {
    setActiveChatId(chat.id);
    setActiveChat(chat.id);
    return () => {
      setActiveChatId(null);
      setActiveChat(null);
    };
  }, [chat.id]);

  // Load initial messages and mark as read
  useEffect(() => {
    (async () => {
      try {
        const data = await getMessages(chat.id);
        setMessages(chat.id, data);
        markChatAsRead(chat.id).catch(() => {});
        markChatRead(chat.id);
      } catch (err) {
        console.error('Failed to load messages', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [chat.id]);

  // Socket listeners
  useEffect(() => {
    joinChat(chat.id);
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (msg: Message) => {
      if (msg.chat_id === chat.id) {
        addMessage(chat.id, msg);
        updateLastMessage(chat.id, msg);
        scrollToEnd();
        // Auto-mark as read since chat is open
        markChatAsRead(chat.id).catch(() => {});
        markChatRead(chat.id);
      }
    };

    const onChatRead = ({ chatId, userId: readerId, readAt }: { chatId: string; userId: string; readAt: number }) => {
      if (chatId === chat.id && readerId !== user.id) {
        setPartnerReadAt(chat.id, readAt);
      }
    };

    const onTyping = ({ userId, chatId }: { userId: string; chatId: string }) => {
      if (chatId === chat.id && userId !== user.id) {
        setTypingUsers((prev) => [...new Set([...prev, userId])]);
      }
    };

    const onStopTyping = ({ userId, chatId }: { userId: string; chatId: string }) => {
      if (chatId === chat.id) {
        setTypingUsers((prev) => prev.filter((id) => id !== userId));
      }
    };

    socket.on('new-message', onNewMessage);
    socket.on('user-typing', onTyping);
    socket.on('user-stopped-typing', onStopTyping);
    socket.on('chat-read', onChatRead);

    return () => {
      socket.off('new-message', onNewMessage);
      socket.off('user-typing', onTyping);
      socket.off('user-stopped-typing', onStopTyping);
      socket.off('chat-read', onChatRead);
    };
  }, [chat.id]);

  function scrollToEnd() {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }

  useEffect(() => {
    if (messages.length > 0) scrollToEnd();
  }, [messages.length]);

  function handleTextChange(text: string) {
    setInputText(text);

    if (!isTyping.current && text.length > 0) {
      isTyping.current = true;
      emitTypingStart(chat.id);
    }

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      emitTypingStop(chat.id);
    }, 1500);
  }

  async function handleSend() {
    if (sending) return;

    // If there's pending media, send that
    if (pendingMedia) {
      setSending(true);
      try {
        const uploadUri = pendingMedia.isVideo
          ? pendingMedia.uri
          : await compressImage(pendingMedia.uri);
        const uploaded = await uploadFile(uploadUri, pendingMedia.filename, pendingMedia.mimeType);
        if (pendingMedia.isVideo) uploaded.type = 'video';
        const msg = await sendMessage(chat.id, inputText.trim(), uploaded);
        addMessage(chat.id, msg);
        updateLastMessage(chat.id, msg);
        setPendingMedia(null);
        setInputText('');
        scrollToEnd();
      } catch (err) {
        console.error('Failed to send attachment', err);
        Alert.alert('Ошибка', 'Не удалось отправить файл');
      } finally {
        setSending(false);
      }
      return;
    }

    // Otherwise send text
    const text = inputText.trim();
    if (!text) return;

    setInputText('');
    isTyping.current = false;
    emitTypingStop(chat.id);

    setSending(true);
    try {
      const msg = await sendMessage(chat.id, text);
      addMessage(chat.id, msg);
      updateLastMessage(chat.id, msg);
      scrollToEnd();
    } catch (err) {
      console.error('Failed to send message', err);
      setInputText(text);
    } finally {
      setSending(false);
    }
  }

  async function handleAttach() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
      allowsEditing: false,
      videoMaxDuration: 120,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    const filename = asset.fileName || (isVideo ? 'video.mp4' : 'photo.jpg');
    const mimeType = asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');

    setPendingMedia({ uri: asset.uri, mimeType, filename, isVideo });
  }

  const canSend = !sending && (!!inputText.trim() || !!pendingMedia);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isMine={item.sender_id === user.id}
            partnerLastReadAt={partnerLastReadAt}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyText}>
              Начните общение с {chatName}
            </Text>
          </View>
        }
        ListFooterComponent={
          typingUsers.length > 0 ? <TypingIndicator /> : null
        }
        contentContainerStyle={styles.messagesList}
        onLayout={scrollToEnd}
      />

      {/* Media preview strip */}
      {pendingMedia && (
        <View style={styles.mediaPreview}>
          <View style={styles.mediaPreviewThumb}>
            {pendingMedia.isVideo ? (
              <View style={styles.videoThumb}>
                <Ionicons name="videocam" size={28} color="#fff" />
              </View>
            ) : (
              <Image source={{ uri: pendingMedia.uri }} style={styles.imageThumb} />
            )}
          </View>
          <Text style={styles.mediaPreviewName} numberOfLines={1}>
            {pendingMedia.isVideo ? 'Видео' : 'Фото'}
          </Text>
          <TouchableOpacity
            style={styles.mediaCancelBtn}
            onPress={() => setPendingMedia(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputBar}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handleAttach}
          disabled={sending}
          activeOpacity={0.7}
        >
          <Ionicons name="attach" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={handleTextChange}
          placeholder={pendingMedia ? 'Подпись...' : 'Сообщение...'}
          placeholderTextColor={Colors.textLight}
          multiline
          maxLength={4000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendIcon}>▶</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerInfo: {},
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  headerStatus: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  messagesList: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  mediaPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  mediaPreviewThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  videoThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPreviewName: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  mediaCancelBtn: {
    padding: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: 6,
  },
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 2,
  },
});
