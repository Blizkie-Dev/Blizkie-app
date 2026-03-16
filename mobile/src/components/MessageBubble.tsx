import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatMessageTime } from '../utils/formatTime';
import { Message } from '../api/chatsApi';
import { User } from '../api/authApi';
import { API_BASE_URL } from '../constants/config';
import MediaViewer from './MediaViewer';
import Avatar from './Avatar';
import { useColors } from '../hooks/useColors';

const SCREEN_W = Dimensions.get('window').width;

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  isGroup?: boolean;
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
      style={{ marginLeft: 3 }}
    />
  );
}

export default function MessageBubble({
  message,
  isMine,
  isGroup = false,
  partnerLastReadAt = 0,
  currentUserId,
  chatMembers,
  onReact,
}: MessageBubbleProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const lastTapRef = useRef(0);
  const C = useColors();
  const styles = useMemo(() => createStyles(C), [C]);

  // Entry animation
  const animScale = useRef(new Animated.Value(0.95)).current;
  const animOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(animOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const isRead = isMine && partnerLastReadAt >= message.created_at;
  const likedBy = message.liked_by || [];
  const hasReaction = likedBy.length > 0;

  const sender = chatMembers?.find((m) => m.id === message.sender_id);
  const showSenderName = isGroup && !isMine && !!sender;

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
      <Animated.View 
        style={[
          styles.wrapper, 
          isMine ? styles.wrapperRight : styles.wrapperLeft,
          { opacity: animOpacity, transform: [{ scale: animScale }] }
        ]}
      >
        {!isMine && isGroup && (
          <View style={styles.avatarWrapper}>
            <Avatar uri={sender?.avatar_url} name={sender?.display_name || sender?.username || '?'} size={32} />
          </View>
        )}

        <TouchableOpacity activeOpacity={1} onPress={handleTap} style={styles.bubbleContainer}>
          <View style={[styles.bubble, isMine ? styles.bubbleSent : styles.bubbleReceived]}>
            
            {showSenderName && (
              <Text style={styles.senderName}>{sender?.display_name || sender?.username}</Text>
            )}

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

            <View style={styles.bottomRow}>
              {/* Reactions Pill (matching screenshot) */}
              {hasReaction ? (
                <View style={[styles.reactionPill, !isMine && styles.reactionPillReceived]}>
                  <Ionicons name="heart" size={14} color="#FF3B30" />
                  <View style={styles.reactionAvatars}>
                    {likedBy.slice(0, 4).map((uid, idx) => {
                      const member = chatMembers?.find((m) => m.id === uid);
                      return (
                        <View key={uid} style={[styles.avatarOverlap, { zIndex: 10 - idx, marginLeft: idx === 0 ? 0 : -8 }]}>
                          <Avatar
                            uri={member?.avatar_url}
                            name={member?.display_name || member?.username || '?'}
                            size={18}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : <View />}

              {/* Time & Read indicator in the corner */}
              <View style={styles.footer}>
                <Text style={[styles.time, isMine ? styles.timeSent : styles.timeReceived]}>
                  {formatMessageTime(message.created_at)}
                </Text>
                {isMine && <ReadTick isRead={isRead} />}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

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
      paddingVertical: 3,
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    wrapperRight: { justifyContent: 'flex-end' },
    wrapperLeft: { justifyContent: 'flex-start' },
    avatarWrapper: {
      marginRight: 6,
      marginBottom: 2,
    },
    bubbleContainer: {
      maxWidth: SCREEN_W * 0.78,
      // Adding shadow for better depth and separation
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 2,
    },
    bubble: {
      borderRadius: 18,
      paddingHorizontal: 4,
      paddingVertical: 4,
      // overflow: 'hidden' can sometimes clip shadows in RN, removing to be safe
    },
    bubbleSent: {
      backgroundColor: C.bubbleSent,
      borderBottomRightRadius: 4,
    },
    bubbleReceived: {
      backgroundColor: C.bubbleReceived,
      borderBottomLeftRadius: 4,
    },
    senderName: {
      fontSize: 12,
      fontWeight: '600',
      color: C.primary,
      marginHorizontal: 10,
      marginTop: 4,
      marginBottom: 2,
    },
    attachedImage: {
      width: SCREEN_W * 0.65,
      height: SCREEN_W * 0.55,
      borderRadius: 14,
      margin: 4,
    },
    videoThumb: {
      width: SCREEN_W * 0.65,
      height: SCREEN_W * 0.45,
      backgroundColor: '#111',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      margin: 4,
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
      margin: 4,
      borderRadius: 10,
    },
    fileRowSent: { backgroundColor: 'rgba(255,255,255,0.1)' },
    fileRowReceived: { backgroundColor: C.background },
    fileName: { fontSize: 14, flex: 1 },
    fileNameSent: { color: '#fff' },
    fileNameReceived: { color: C.text },
    text: {
      fontSize: 16,
      lineHeight: 22,
      paddingHorizontal: 10,
      paddingTop: 4,
      paddingBottom: 2,
    },
    textSent: { color: '#fff' },
    textReceived: { color: C.bubbleReceivedText },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingBottom: 2,
      minHeight: 24,
    },
    reactionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.1)', // Subtle dark overlay for both
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 20,
      gap: 4,
      marginBottom: 2,
    },
    reactionPillReceived: {
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    reactionAvatars: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 2,
    },
    avatarOverlap: {
      borderWidth: 1.5,
      borderColor: 'transparent', // We'll use the bubble color or keeps it semi-transparent
      borderRadius: 10,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginLeft: 10,
    },
    time: { fontSize: 11 },
    timeSent: { color: 'rgba(255,255,255,0.6)' },
    timeReceived: { color: 'rgba(255,255,255,0.5)' }, // Light grey on dark bubble
  });
