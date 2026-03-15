const { Server } = require('socket.io');
const { verify } = require('../utils/jwt');
const { getDb } = require('../config/database');
const { saveMessage, getUserChats } = require('../services/chatService');

// Track which userIds are currently connected
const onlineUsers = new Set();

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));

    let payload;
    try {
      payload = verify(token);
    } catch {
      return next(new Error('Invalid token'));
    }

    const db = getDb();
    const session = db
      .prepare('SELECT id, revoked FROM sessions WHERE id = ?')
      .get(payload.jti);

    if (!session || session.revoked) {
      return next(new Error('Session revoked'));
    }

    socket.data.userId = payload.sub;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    onlineUsers.add(userId);
    console.log(`[Socket] Connected: ${userId}`);

    // Update last seen
    getDb()
      .prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
      .run([Date.now(), userId]);

    // Join all user's chat rooms
    const chats = getUserChats(userId);
    chats.forEach((chat) => {
      socket.join(`chat:${chat.id}`);
    });

    // Join a specific chat room (after creating a new chat)
    socket.on('join-chat', (chatId) => {
      socket.join(`chat:${chatId}`);
    });

    // Typing indicators
    socket.on('typing-start', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('user-typing', { userId, chatId });
    });

    socket.on('typing-stop', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('user-stopped-typing', {
        userId,
        chatId,
      });
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      getDb()
        .prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
        .run([Date.now(), userId]);
      console.log(`[Socket] Disconnected: ${userId}`);
    });
  });

  return io;
}

module.exports = { initSocket, onlineUsers };
