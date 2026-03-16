import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '../api/authApi';
import { Chat, Message } from '../api/chatsApi';

// ─── Auth Slice ────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  updateUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
  updateUser: (user) => set({ user }),
  clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),
}));

// ─── Chats Slice ───────────────────────────────────────────────────────────

interface ChatsState {
  chats: Chat[];
  activeChatId: string | null;
  setChats: (chats: Chat[]) => void;
  upsertChat: (chat: Chat) => void;
  updateLastMessage: (chatId: string, message: Message) => void;
  markChatRead: (chatId: string) => void;
  incrementUnread: (chatId: string) => void;
  setActiveChatId: (chatId: string | null) => void;
  setPartnerReadAt: (chatId: string, readAt: number) => void;
  clearChats: () => void;
}

export const useChatsStore = create<ChatsState>((set) => ({
  chats: [],
  activeChatId: null,
  setChats: (chats) => set({ chats }),
  upsertChat: (chat) =>
    set((state) => {
      const existing = state.chats.findIndex((c) => c.id === chat.id);
      if (existing >= 0) {
        const updated = [...state.chats];
        updated[existing] = chat;
        return { chats: updated };
      }
      return { chats: [chat, ...state.chats] };
    }),
  updateLastMessage: (chatId, message) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, last_message: message } : c
      ),
    })),
  markChatRead: (chatId) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: 0 } : c
      ),
    })),
  incrementUnread: (chatId) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c
      ),
    })),
  setActiveChatId: (chatId) => set({ activeChatId: chatId }),
  setPartnerReadAt: (chatId, readAt) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, partner_last_read_at: readAt } : c
      ),
    })),
  clearChats: () => set({ chats: [], activeChatId: null }),
}));

// ─── Online Users Slice ────────────────────────────────────────────────────

interface OnlineState {
  onlineUserIds: Set<string>;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  clearOnline: () => void;
  isOnline: (userId: string) => boolean;
}

export const useOnlineStore = create<OnlineState>((set, get) => ({
  onlineUserIds: new Set(),
  setUserOnline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUserIds);
      next.add(userId);
      return { onlineUserIds: next };
    }),
  setUserOffline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUserIds);
      next.delete(userId);
      return { onlineUserIds: next };
    }),
  clearOnline: () => set({ onlineUserIds: new Set() }),
  isOnline: (userId) => get().onlineUserIds.has(userId),
}));

// ─── Messages Slice ────────────────────────────────────────────────────────

interface MessagesState {
  messagesByChatId: Record<string, Message[]>;
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  prependMessages: (chatId: string, messages: Message[]) => void;
  updateMessageReaction: (chatId: string, messageId: string, liked_by: string[]) => void;
  clearMessages: () => void;
}

// ─── Theme Slice ───────────────────────────────────────────────────────────

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  initTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: false,
  toggleTheme: () => {
    const next = !get().isDark;
    set({ isDark: next });
    SecureStore.setItemAsync('app_theme', next ? 'dark' : 'light').catch(() => {});
  },
  initTheme: async () => {
    try {
      const saved = await SecureStore.getItemAsync('app_theme');
      if (saved === 'dark') set({ isDark: true });
    } catch {}
  },
}));

// ─── Messages Slice ────────────────────────────────────────────────────────

export const useMessagesStore = create<MessagesState>((set) => ({
  messagesByChatId: {},
  setMessages: (chatId, messages) =>
    set((state) => ({
      messagesByChatId: { ...state.messagesByChatId, [chatId]: messages },
    })),
  addMessage: (chatId, message) =>
    set((state) => {
      const existing = state.messagesByChatId[chatId] || [];
      if (existing.some((m) => m.id === message.id)) return state;
      return {
        messagesByChatId: {
          ...state.messagesByChatId,
          [chatId]: [...existing, message],
        },
      };
    }),
  prependMessages: (chatId, messages) =>
    set((state) => {
      const existing = state.messagesByChatId[chatId] || [];
      const existingIds = new Set(existing.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));
      return {
        messagesByChatId: {
          ...state.messagesByChatId,
          [chatId]: [...newMessages, ...existing],
        },
      };
    }),
  updateMessageReaction: (chatId, messageId, liked_by) =>
    set((state) => {
      const msgs = state.messagesByChatId[chatId] || [];
      return {
        messagesByChatId: {
          ...state.messagesByChatId,
          [chatId]: msgs.map((m) => (m.id === messageId ? { ...m, liked_by } : m)),
        },
      };
    }),
  clearMessages: () => set({ messagesByChatId: {} }),
}));
