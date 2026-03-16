import React, { useState, useRef, useMemo } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatMessageTime } from '../utils/formatTime';
import { Message } from '../api/chatsApi';
import { User } from '../api/authApi';
import { API_BASE_URL } from '../constants/config';
import MediaViewer from './MediaViewer';
import Avatar from './Avatar';
import { useColors } from '../hooks/useColors';

const SCREEN_W = Dimensions.get('window').width;
const REACTION_H = 20;

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  partnerLastReadAt?: number;
  currentUserId?: string;
  chatMembers?: User[];
  onReact?: (messageId: string) => void;
}

function ReadTick({ isRead }: { isRead: boolean }) {
  return (
    <Ionicons
      name={isRead ? 'checkmark-done' : 'checkmark'}
      size={14}
      color={isRead ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)'}
      style={{ marginLeft: 2 }}
    />
  );
}

export default function MessageBubble({
  message,
  isMine,
  partnerLastReadAt = 0,
  currentUserId,
  chatMembers,
  onReact,
}: MessageBubbleProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const lastTapRef = useRef(0);
  const C = useColors();
  const styles = useMemo(() => createStyles(C), [C]);

  const isRead = isMine && partnerLastReadAt >= message.created_at;
  const likedBy = message.liked_by || [];
  const hasReaction = likedBy.length > 0;

  function handleTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onReact?.(message.id);
    }
    lastTapRef.current = now;
  }

  const hasImage = message.attachment_type === 'image' && message.attachment_url;
  const hasVideo = message.attachment_type === 'video' && message.attachment_url;
  const hasFile = message.attachment_type === 'file' && message.attachment_url;
  const rawUrl = message.attachment_url || '';
  const mediaUri = (hasImage || hasVideo) && rawUrl
    ? (rawUrl.startsWith('http') ? rawUrl : `${API_BASE_URL}${rawUrl}`)
    : null;

  return (
    <>
      <View style={[styles.wrapper, isMine ? styles.wrapperRight : styles.wrapperLeft]}>
        <View style={hasReaction ? styles.bubbleWithReaction : undefined}>
          <TouchableOpacity activeOpacity={1} onPress={handleTap}>
            <View style={[styles.bubble, isMine ? styles.bubbleSent : styles.bubbleReceived]}>

              {hasImage && mediaUri && (
                <TouchableOpacity activeOpacity={0.95} onPress={() => setViewerOpen(true)}>
                  <Image
                    source={{ uri: mediaUri }}
                    style={styles.attachedImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}

              {hasVideo && mediaUri && (
                <TouchableOpacity
                  style={styles.videoThumb}
                  activeOpacity={0.85}
                  onPress={() => setViewerOpen(true)}
                >
                  <View style={styles.videoPlayBtn}>
                    <Ionicons name="play-circle" size={52} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={styles.videoLabel}>Видео</Text>
                </TouchableOpacity>
              )}

              {hasFile && (
                <View style={[styles.fileRow, isMine ? styles.fileRowSent : styles.fileRowReceived]}>
                  <Ionicons name="document-outline" size={22} color={isMine ? '#fff' : C.primary} />
                  <Text
                    style={[styles.fileName, isMine ? styles.fileNameSent : styles.fileNameReceived]}
                    numberOfLines={1}
                  >
                    {message.attachment_name || 'Файл'}
                  </Text>
                </View>
              )}

              {!!message.text && (
                <Text style={[styles.text, isMine ? styles.textSent : styles.textReceived]}>
                  {message.text}
                </Text>
              )}

              <View style={[styles.footer, (hasImage || hasVideo) && !message.text && styles.footerOverMedia]}>
                <Text style={[styles.time, isMine ? styles.timeSent : styles.timeReceived]}>
                  {formatMessageTime(message.created_at)}
                </Text>
                {isMine && <ReadTick isRead={isRead} />}
              </View>
            </View>
          </TouchableOpacity>

          {hasReaction && (
            <View style={[styles.reactionBadge, isMine ? styles.reactionBadgeRight : styles.reactionBadgeLeft]}>
              <Ionicons name="heart" size={13} color="#E8344E" />
              {likedBy.map((uid) => {
                const member = chatMembers?.find((m) => m.id === uid);
                return (
                  <Avatar
                    key={uid}
                    uri={member?.avatar_url}
                    name={member?.display_name || member?.username || '?'}
                    size={16}
                  />
                );
              })}
            </View>
          )}
        </View>
      </View>

      {mediaUri && (hasImage || hasVideo) && (
        <MediaViewer
          visible={viewerOpen}
          uri={mediaUri}
          type={hasVideo ? 'video' : 'image'}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

const createStyles = (C: ReturnType<typeof import('../hooks/useColors').useColors>) =>
  StyleSheet.create({
    wrapper: {
      paddingHorizontal: 12,
      paddingVertical: 2,
      flexDirection: 'row',
    },
    wrapperRight: { justifyContent: 'flex-end' },
    wrapperLeft: { justifyContent: 'flex-start' },
    bubbleWithReaction: {
      marginBottom: REACTION_H / 2 + 2,
    },
    bubble: {
      maxWidth: SCREEN_W * 0.75,
      borderRadius: 16,
      overflow: 'hidden',
    },
    bubbleSent: {
      backgroundColor: C.bubbleSent,
      borderBottomRightRadius: 4,
    },
    bubbleReceived: {
      backgroundColor: C.bubbleReceived,
      borderBottomLeftRadius: 4,
    },
    attachedImage: {
      width: SCREEN_W * 0.65,
      height: SCREEN_W * 0.55,
    },
    videoThumb: {
      width: SCREEN_W * 0.65,
      height: SCREEN_W * 0.45,
      backgroundColor: '#111',
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoPlayBtn: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoLabel: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 12,
      marginTop: 4,
    },
    fileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    fileRowSent: { backgroundColor: 'rgba(255,255,255,0.12)' },
    fileRowReceived: { backgroundColor: C.backgroundSecondary },
    fileName: { fontSize: 14, flex: 1 },
    fileNameSent: { color: '#fff' },
    fileNameReceived: { color: C.text },
    text: {
      fontSize: 15,
      lineHeight: 20,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    textSent: { color: C.bubbleSentText },
    textReceived: { color: C.bubbleReceivedText },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: 10,
      paddingBottom: 5,
      paddingTop: 2,
      gap: 1,
    },
    footerOverMedia: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.38)',
      borderRadius: 10,
      margin: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    time: { fontSize: 11 },
    timeSent: { color: 'rgba(255,255,255,0.75)' },
    timeReceived: { color: C.textSecondary },
    reactionBadge: {
      position: 'absolute',
      bottom: -(REACTION_H / 2),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    reactionBadgeRight: { right: 8 },
    reactionBadgeLeft: { left: 8 },
  });
