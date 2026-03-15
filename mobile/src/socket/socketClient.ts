import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../constants/config';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function joinChat(chatId: string): void {
  socket?.emit('join-chat', chatId);
}

export function emitTypingStart(chatId: string): void {
  socket?.emit('typing-start', { chatId });
}

export function emitTypingStop(chatId: string): void {
  socket?.emit('typing-stop', { chatId });
}
