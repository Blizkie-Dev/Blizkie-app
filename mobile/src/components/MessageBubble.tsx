import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { formatMessageTime } from '../utils/formatTime';
import { Message } from '../api/chatsApi';
import { API_BASE_URL } from '../constants/config';
import MediaViewer from './MediaViewer';

const SCREEN_W = Dimensions.get('window').width;

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  partnerLastReadAt?: number;
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

export default function MessageBubble({ message, isMine, partnerLastReadAt = 0 }: MessageBubbleProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const isRead = isMine && partnerLastReadAt >= message.created_at;

  const hasImage = message.attachment_type === 'image' && message.attachment_url;
  const hasVideo = message.attachment_type === 'video' && message.attachment_url;
  const hasFile = message.attachment_type === 'file' && message.attachment_url;
  const mediaUri = (hasImage || hasVideo) && message.attachment_url
    ? `${API_BASE_URL}${message.attachment_url}`
    : null;

  return (
    <>
      <View style={[styles.wrapper, isMine ? styles.wrapperRight : styles.wrapperLeft]}>
        <View style={[styles.bubble, isMine ? styles.bubbleSent : styles.bubbleReceived]}>

          {/* Image attachment */}
          {hasImage && mediaUri && (
            <TouchableOpacity activeOpacity={0.95} onPress={() => setViewerOpen(true)}>
              <Image
                source={{ uri: mediaUri }}
                style={styles.attachedImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {/* Video attachment */}
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

          {/* File attachment */}
          {hasFile && (
            <View style={[styles.fileRow, isMine ? styles.fileRowSent : styles.fileRowReceived]}>
              <Ionicons name="document-outline" size={22} color={isMine ? '#fff' : Colors.primary} />
              <Text
                style={[styles.fileName, isMine ? styles.fileNameSent : styles.fileNameReceived]}
                numberOfLines={1}
              >
                {message.attachment_name || 'Файл'}
              </Text>
            </View>
          )}

          {/* Text */}
          {!!message.text && (
            <Text style={[styles.text, isMine ? styles.textSent : styles.textReceived]}>
              {message.text}
            </Text>
          )}

          {/* Footer */}
          <View style={[styles.footer, (hasImage || hasVideo) && !message.text && styles.footerOverMedia]}>
            <Text style={[styles.time, isMine ? styles.timeSent : styles.timeReceived]}>
              {formatMessageTime(message.created_at)}
            </Text>
            {isMine && <ReadTick isRead={isRead} />}
          </View>
        </View>
      </View>

      {/* Media viewer */}
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

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    flexDirection: 'row',
  },
  wrapperRight: { justifyContent: 'flex-end' },
  wrapperLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: SCREEN_W * 0.75,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bubbleSent: {
    backgroundColor: Colors.bubbleSent,
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: Colors.bubbleReceived,
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
  fileRowReceived: { backgroundColor: Colors.backgroundSecondary },
  fileName: { fontSize: 14, flex: 1 },
  fileNameSent: { color: '#fff' },
  fileNameReceived: { color: Colors.text },
  text: {
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  textSent: { color: Colors.bubbleSentText },
  textReceived: { color: Colors.bubbleReceivedText },
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
  timeReceived: { color: Colors.textSecondary },
});
