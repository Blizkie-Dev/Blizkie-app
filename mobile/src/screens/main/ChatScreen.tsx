import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { getMessages, sendMessage, markChatAsRead, uploadFile, reactToMessage } from '../../api/chatsApi';
import { Message, Chat } from '../../api/chatsApi';
import { useMessagesStore, useChatsStore, useAuthStore, useOnlineStore } from '../../store';
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
import { useColors } from '../../hooks/useColors';

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
  const { messagesByChatId, setMessages, addMessage, prependMessages, updateMessageReaction } = useMessagesStore();
  const { updateLastMessage, markChatRead, setActiveChatId, setPartnerReadAt, chats } = useChatsStore();
  const currentChat = chats.find((c) => c.id === chat.id);
  const partnerLastReadAt = currentChat?.partner_last_read_at || 0;
  const C = useColors();
  const styles = useMemo(() => createStyles(C), [C]);

  const messages = messagesByChatId[chat.id] || [];
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);
  const isAtBottom = useRef(true);
  const shouldScrollToEnd = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);

  const isGroup = chat.type === 'group';
  const otherMember = isGroup ? null : chat.members.find((m) => m.id !== user.id);
  const chatName = isGroup
    ? (chat.name || 'Группа')
    : (otherMember?.display_name || otherMember?.username || 'Чат');
  const onlineUserIds = useOnlineStore((s) => s.onlineUserIds);
  const partnerIsOnline = otherMember ? onlineUserIds.has(otherMember.id) : false;

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity style={styles.headerTitle}>
          <Avatar uri={isGroup ? null : otherMember?.avatar_url} name={isGroup ? '👥' : chatName} size={36} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{chatName}</Text>
            {isGroup ? (
              <Text style={styles.headerStatus}>
                {chat.members.length} участника
              </Text>
            ) : (
              <Text style={[styles.headerStatus, partnerIsOnline && styles.headerStatusOnline]}>
                {otherMember
                  ? partnerIsOnline
                    ? 'онлайн'
                    : formatLastSeen(otherMember.last_seen_at || 0)
                  : ''}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ),
    });
  }, [chatName, otherMember, partnerIsOnline, isGroup, styles]);

  useEffect(() => {
    setActiveChatId(chat.id);
    setActiveChat(chat.id);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setActiveChat(chat.id);
      } else {
        setActiveChat(null);
      }
    });

    return () => {
      setActiveChatId(null);
      setActiveChat(null);
      sub.remove();
    };
  }, [chat.id]);

  useEffect(() => {
    // Reset scroll state when switching chats
    isAtBottom.current = true;
    shouldScrollToEnd.current = true;
    lastMessageIdRef.current = null;

    (async () => {
      try {
        const limit = 50;
        const data = await getMessages(chat.id, { limit });
        setMessages(chat.id, data);
        setHasMore(data.length === limit);
        markChatAsRead(chat.id).catch(() => {});
        markChatRead(chat.id);
      } catch (err) {
        console.error('Failed to load messages', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [chat.id]);

  useFocusEffect(
    useCallback(() => {
      // Ensure we start at the bottom when returning to this screen.
      shouldScrollToEnd.current = true;
      const timer = setTimeout(() => {
        scrollToEnd();
      }, 100);
      return () => clearTimeout(timer);
    }, [chat.id])
  );

  useEffect(() => {
    joinChat(chat.id);
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (msg: Message) => {
      if (msg.chat_id === chat.id) {
        addMessage(chat.id, msg);
        updateLastMessage(chat.id, msg);
        scrollToEnd();
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

    const onReaction = ({ messageId, chatId: cId, liked_by }: { messageId: string; chatId: string; liked_by: string[] }) => {
      if (cId === chat.id) {
        updateMessageReaction(chat.id, messageId, liked_by);
      }
    };

    socket.on('new-message', onNewMessage);
    socket.on('user-typing', onTyping);
    socket.on('user-stopped-typing', onStopTyping);
    socket.on('chat-read', onChatRead);
    socket.on('message-reaction', onReaction);

    return () => {
      socket.off('new-message', onNewMessage);
      socket.off('user-typing', onTyping);
      socket.off('user-stopped-typing', onStopTyping);
      socket.off('chat-read', onChatRead);
      socket.off('message-reaction', onReaction);
    };
  }, [chat.id]);

  function scrollToEnd() {
    flatListRef.current?.scrollToEnd({ animated: true });
  }

  async function loadMoreMessages() {
    if (!hasMore || loadingMore || loading) return;
    const msgs = messages;
    const oldest = msgs[0];
    if (!oldest) return;

    setLoadingMore(true);
    try {
      const limit = 50;
      const data = await getMessages(chat.id, { before: oldest.created_at, limit });
      if (data.length < limit) {
        setHasMore(false);
      }
      if (data.length > 0) {
        prependMessages(chat.id, data);
      }
    } catch (err) {
      console.warn('Failed to load more messages', err);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessageId = messages[messages.length - 1]?.id;
    const prevLast = lastMessageIdRef.current;
    lastMessageIdRef.current = lastMessageId || null;

    // New message appended: scroll only if we were already at bottom
    if (lastMessageId && lastMessageId !== prevLast && isAtBottom.current) {
      shouldScrollToEnd.current = true;
    }

    if (shouldScrollToEnd.current) {
      scrollToEnd();
      shouldScrollToEnd.current = false;
    }
  }, [messages]);

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

  async function handleReact(messageId: string) {
    try {
      const { liked_by } = await reactToMessage(chat.id, messageId);
      updateMessageReaction(chat.id, messageId, liked_by);
    } catch (err) {
      console.warn('[Reaction] Failed:', err);
    }
  }

  const canSend = !sending && (!!inputText.trim() || !!pendingMedia);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.primary} size="large" />
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
            isGroup={isGroup}
            partnerLastReadAt={isGroup ? 0 : partnerLastReadAt}
            currentUserId={user.id}
            chatMembers={chat.members}
            onReact={handleReact}
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
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const distanceFromBottom =
            contentSize.height - (contentOffset.y + layoutMeasurement.height);
          isAtBottom.current = distanceFromBottom < 120;

          if (contentOffset.y < 80) {
            loadMoreMessages();
          }
        }}
        scrollEventThrottle={100}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />

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
            <Ionicons name="close-circle" size={22} color={C.textSecondary} />
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
          <Ionicons name="attach" size={24} color={C.textSecondary} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={handleTextChange}
          placeholder={pendingMedia ? 'Подпись...' : 'Сообщение...'}
          placeholderTextColor={C.textLight}
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

const createStyles = (C: ReturnType<typeof import('../../hooks/useColors').useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.backgroundSecondary,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.backgroundSecondary,
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
      color: C.text,
    },
    headerStatus: {
      fontSize: 12,
      color: C.textSecondary,
    },
    headerStatusOnline: {
      color: C.primary,
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
      color: C.textSecondary,
    },
    mediaPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
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
      color: C.text,
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
      backgroundColor: C.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
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
      backgroundColor: C.backgroundSecondary,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      color: C.text,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.primary,
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
