import { create } from 'zustand';
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
}));

// ─── Messages Slice ────────────────────────────────────────────────────────

interface MessagesState {
  messagesByChatId: Record<string, Message[]>;
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  prependMessages: (chatId: string, messages: Message[]) => void;
}

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
}));
