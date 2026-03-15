import client from './client';
import { User } from './authApi';
import { API_BASE_URL } from '../constants/config';
import { getToken } from '../utils/storage';

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string;
  created_at: number;
  deleted_at?: number | null;
  attachment_url?: string | null;
  attachment_type?: 'image' | 'video' | 'file' | null;
  attachment_name?: string | null;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  created_at: number;
  members: User[];
  last_message: Message | null;
  unread_count: number;
  partner_last_read_at: number;
}

export async function getChats(): Promise<Chat[]> {
  const res = await client.get('/chats');
  return res.data;
}

export async function createOrGetChat(userId: string): Promise<Chat> {
  const res = await client.post('/chats', { userId });
  return res.data;
}

export async function getChatById(chatId: string): Promise<Chat> {
  const res = await client.get(`/chats/${chatId}`);
  return res.data;
}

export async function getMessages(
  chatId: string,
  options?: { before?: number; limit?: number }
): Promise<Message[]> {
  const res = await client.get(`/chats/${chatId}/messages`, {
    params: options,
  });
  return res.data;
}

export async function sendMessage(
  chatId: string,
  text: string,
  attachment?: { url: string; type: 'image' | 'video' | 'file'; name?: string }
): Promise<Message> {
  const res = await client.post(`/chats/${chatId}/messages`, {
    text,
    attachment_url: attachment?.url,
    attachment_type: attachment?.type,
    attachment_name: attachment?.name,
  });
  return res.data;
}

export async function uploadFile(
  uri: string,
  name: string,
  mimeType: string
): Promise<{ url: string; type: 'image' | 'video' | 'file'; name: string }> {
  const token = await getToken();
  const form = new FormData();
  form.append('file', { uri, name, type: mimeType } as any);
  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export async function markChatAsRead(chatId: string): Promise<void> {
  await client.post(`/chats/${chatId}/read`);
}
