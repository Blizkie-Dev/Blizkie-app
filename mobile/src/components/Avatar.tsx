import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { API_BASE_URL } from '../constants/config';

function resolveUri(uri?: string | null): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith('http')) return uri;
  return `${API_BASE_URL}${uri}`;
}

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  online?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Deterministic color from name
const COLORS = [
  '#E17055', '#74B9FF', '#55EFC4', '#FDCB6E',
  '#A29BFE', '#FD79A8', '#00CEC9', '#6C5CE7',
];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ uri, name = '?', size = 46, online }: AvatarProps) {
  const resolvedUri = resolveUri(uri);
  return (
    <View style={{ width: size, height: size }}>
      {resolvedUri ? (
        <Image
          source={{ uri: resolvedUri }}
          style={[styles.img, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: getAvatarColor(name),
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
            {getInitials(name)}
          </Text>
        </View>
      )}
      {online && (
        <View
          style={[
            styles.onlineDot,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: (size * 0.28) / 2,
              right: 0,
              bottom: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  img: {
    resizeMode: 'cover',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '600',
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: Colors.online,
    borderWidth: 2,
    borderColor: Colors.white,
  },
});
