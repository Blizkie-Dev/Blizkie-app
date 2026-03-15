import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';

const { width: W, height: H } = Dimensions.get('window');

interface MediaViewerProps {
  visible: boolean;
  uri: string;
  type: 'image' | 'video';
  onClose: () => void;
}

function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.play(); });
  return <VideoView player={player} style={styles.media} contentFit="contain" allowsFullscreen />;
}

export default function MediaViewer({ visible, uri, type, onClose }: MediaViewerProps) {
  const [imageLoading, setImageLoading] = useState(true);

  // Use plain React Native Animated — no Reanimated/worklets needed
  const offsetY = useRef(new Animated.Value(0)).current;
  const alpha = useRef(new Animated.Value(1)).current;

  const pan = useRef(
    PanResponder.create({
      // Claim every touch that starts in this view.
      // The close button is a sibling rendered AFTER this view in JSX,
      // so React Native's hit-testing gives the close button priority
      // when the touch point falls inside it.
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        offsetY.setValue(g.dy);
        alpha.setValue(Math.max(0.15, 1 - Math.abs(g.dy) / (H * 0.45)));
      },
      onPanResponderRelease: (_, g) => {
        const dismiss = Math.abs(g.dy) > 80 || Math.abs(g.vy) > 0.8;
        if (dismiss) {
          const toY = g.dy >= 0 ? H : -H;
          Animated.parallel([
            Animated.timing(offsetY, { toValue: toY, duration: 220, useNativeDriver: true }),
            Animated.timing(alpha, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]).start(() => {
            offsetY.setValue(0);
            alpha.setValue(1);
            onClose();
          });
        } else {
          Animated.parallel([
            Animated.spring(offsetY, { toValue: 0, useNativeDriver: true }),
            Animated.timing(alpha, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  // Only mount when needed — prevents invisible Modal overlays
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <Animated.View style={[styles.backdrop, { opacity: alpha }]}>

        {/* Media area with pan gesture */}
        <Animated.View
          style={[styles.content, { transform: [{ translateY: offsetY }] }]}
          {...pan.panHandlers}
        >
          {type === 'image' ? (
            <View style={styles.mediaContainer}>
              {imageLoading && (
                <ActivityIndicator size="large" color="#fff" style={StyleSheet.absoluteFill} />
              )}
              <Image
                source={{ uri }}
                style={styles.media}
                resizeMode="contain"
                onLoadEnd={() => setImageLoading(false)}
              />
            </View>
          ) : (
            <View style={styles.mediaContainer}>
              <VideoPlayer uri={uri} />
            </View>
          )}
        </Animated.View>

        {/*
          Close button — rendered AFTER the pan view in JSX.
          In React Native, later siblings are hit-tested first when they overlap,
          so tapping the X always works even though the pan view covers the full screen.
        */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
  },
  mediaContainer: {
    width: W,
    height: H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    width: W,
    height: H,
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
