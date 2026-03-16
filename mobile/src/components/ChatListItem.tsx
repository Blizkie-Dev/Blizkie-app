import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import { Chat } from '../api/chatsApi';
import { formatChatTime } from '../utils/formatTime';
import { useOnlineStore } from '../store';
import { useColors } from '../hooks/useColors';

interface ChatListItemProps {
  chat: Chat;
  currentUserId: string;
  onPress: () => void;
}

export default function ChatListItem({ chat, currentUserId, onPress }: ChatListItemProps) {
  const isGroup = chat.type === 'group';
  const otherMember = isGroup ? null : chat.members.find((m) => m.id !== currentUserId);
  const isOnline = useOnlineStore((s) => otherMember ? s.onlineUserIds.has(otherMember.id) : false);
  const C = useColors();
  const styles = useMemo(() => createStyles(C), [C]);

  const name = isGroup
    ? (chat.name || 'Группа')
    : (otherMember?.display_name || otherMember?.username || 'Пользователь');
  const lastMsg = chat.last_message;
  const lastText = lastMsg?.text?.trim() ||
    (lastMsg?.attachment_type === 'image' ? '📷 Фото' :
     lastMsg?.attachment_type === 'video' ? '🎥 Видео' :
     lastMsg?.attachment_type === 'file'  ? '📎 Файл' :
     lastMsg ? '' : 'Нет сообщений');
  const lastTime = chat.last_message ? formatChatTime(chat.last_message.created_at) : '';
  const isLastMine = chat.last_message?.sender_id === currentUserId;
  const unread = chat.unread_count || 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Avatar uri={isGroup ? null : otherMember?.avatar_url} name={isGroup ? '👥' : name} size={52} online={isGroup ? false : isOnline} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.metaRight}>
            <Text style={[styles.time, unread > 0 && styles.timeUnread]}>{lastTime}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text
            style={[styles.lastMessage, unread > 0 && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {isLastMine && <Text style={styles.youPrefix}>Вы: </Text>}
            {lastText}
          </Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (C: ReturnType<typeof import('../hooks/useColors').useColors>) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: C.background,
    },
    content: {
      flex: 1,
      marginLeft: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
      paddingBottom: 10,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: C.text,
      flex: 1,
      marginRight: 8,
    },
    metaRight: {
      alignItems: 'flex-end',
    },
    time: {
      fontSize: 13,
      color: C.textSecondary,
    },
    timeUnread: {
      color: C.primary,
      fontWeight: '600',
    },
    lastMessage: {
      fontSize: 14,
      color: C.textSecondary,
      marginTop: 2,
      flex: 1,
      marginRight: 8,
    },
    lastMessageUnread: {
      color: C.text,
      fontWeight: '500',
    },
    youPrefix: {
      color: C.primary,
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
      marginTop: 2,
    },
    badgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 14,
    },
  });
