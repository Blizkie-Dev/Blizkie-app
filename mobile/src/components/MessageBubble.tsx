import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
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
  isGroup?: boolean;
  partnerLastReadAt?: number;
  currentUserId?: string;
  chatMembers?: User[];
  onReact?: (messageId: string) => void;
  onLongPress?: (message: Message) => void;
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
  isGroup = false,
  partnerLastReadAt = 0,
  currentUserId,
  chatMembers,
  onReact,
  onLongPress,
}: MessageBubbleProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationMillis, setDurationMillis] = useState(0);
  const [positionMillis, setPositionMillis] = useState(0);
  const lastTapRef = useRef(0);
  const C = useColors();
  const styles = useMemo(() => createStyles(C), [C]);

  const isRead = isMine && partnerLastReadAt >= message.created_at;
  const likedBy = message.liked_by || [];
  const hasReaction = likedBy.length > 0;

  const sender = chatMembers?.find((m) => m.id === message.sender_id);
  const showAvatar = isGroup && !isMine && !!sender;

  function handleTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onReact?.(message.id);
    }
    lastTapRef.current = now;
  }

  const hasImage = message.attachment_type === 'image' && message.attachment_url;
  const hasVideo = message.attachment_type === 'video' && message.attachment_url;
  const audioByName = /\.(m4a|aac|mp3|wav|ogg|webm)$/i.test(
    `${message.attachment_name || ''} ${message.attachment_url || ''}`
  );
  const hasAudio =
    (message.attachment_type === 'audio' ||
      (message.attachment_type === 'file' && audioByName)) &&
    message.attachment_url;
  const hasFile = message.attachment_type === 'file' && message.attachment_url;
  const rawUrl = message.attachment_url || '';
  const mediaUri = (hasImage || hasVideo) && rawUrl
    ? (rawUrl.startsWith('http') ? rawUrl : `${API_BASE_URL}${rawUrl}`)
    : null;
  const audioUri = hasAudio && rawUrl
    ? (rawUrl.startsWith('http') ? rawUrl : `${API_BASE_URL}${rawUrl}`)
    : null;
  const playbackProgress = durationMillis > 0 ? positionMillis / durationMillis : 0;

  const waveBars = useMemo(
    () =>
      Array.from({ length: 22 }, (_, idx) => {
        const seed = message.id.charCodeAt(idx % message.id.length) || 50;
        return 0.2 + ((seed % 10) / 10) * 0.8;
      }),
    [message.id]
  );

  function formatDuration(ms: number) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  async function onPlaybackStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    setDurationMillis(status.durationMillis || 0);
    setPositionMillis(status.positionMillis || 0);
    if (status.didJustFinish) {
      setPositionMillis(0);
      setIsPlaying(false);
    }
  }

  async function handleToggleAudio() {
    if (!audioUri) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
      });

      if (!sound) {
        const { sound: created } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          onPlaybackStatus
        );
        setSound(created);
        return;
      }
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;
      if (status.isPlaying) {
        await sound.pauseAsync();
      } else {
        if (status.durationMillis && status.positionMillis >= status.durationMillis - 200) {
          await sound.setPositionAsync(0);
        }
        await sound.playAsync();
      }
    } catch (err) {
      console.warn('[Audio] Playback error', err);
    }
  }

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  return (
    <>
      <View style={[styles.wrapper, isMine ? styles.wrapperRight : styles.wrapperLeft]}>
        {showAvatar && (
          <View style={styles.avatarWrapper}>
            <Avatar uri={sender?.avatar_url} name={sender?.display_name || sender?.username || '?'} size={28} />
          </View>
        )}
        <View style={hasReaction ? styles.bubbleWithReaction : undefined}>
          <TouchableOpacity activeOpacity={1} onPress={handleTap} onLongPress={() => onLongPress?.(message)}>
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

              {hasAudio && audioUri && (
                <View style={[styles.audioRow, isMine ? styles.audioRowSent : styles.audioRowReceived]}>
                  <TouchableOpacity style={styles.audioPlayBtn} onPress={handleToggleAudio} activeOpacity={0.8}>
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={15}
                      color={isMine ? '#fff' : C.primary}
                    />
                  </TouchableOpacity>
                  <View style={styles.audioWave}>
                    {waveBars.map((h, idx) => (
                      <View
                        key={`${message.id}-${idx}`}
                        style={[
                          styles.audioWaveBar,
                          {
                            height: 6 + Math.round(h * 12),
                            backgroundColor:
                              idx / waveBars.length <= playbackProgress
                                ? isMine
                                  ? '#fff'
                                  : C.primary
                                : isMine
                                  ? 'rgba(255,255,255,0.35)'
                                  : C.border,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.audioDuration, isMine ? styles.timeSent : styles.timeReceived]}>
                    {formatDuration(durationMillis || 0)}
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
      alignItems: 'flex-end',
    },
    wrapperRight: { justifyContent: 'flex-end' },
    wrapperLeft: { justifyContent: 'flex-start' },
    avatarWrapper: {
      marginRight: 8,
      justifyContent: 'flex-end',
    },
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
    audioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      minWidth: 220,
    },
    audioRowSent: {
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    audioRowReceived: {
      backgroundColor: 'transparent',
    },
    audioPlayBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    audioWave: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      height: 24,
    },
    audioWaveBar: {
      width: 3,
      borderRadius: 2,
    },
    audioDuration: {
      fontSize: 11,
      minWidth: 36,
      textAlign: 'right',
    },
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
