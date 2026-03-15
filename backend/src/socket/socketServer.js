const { Server } = require('socket.io');
const { verify } = require('../utils/jwt');
const { getDb } = require('../config/database');
const { saveMessage, getUserChats } = require('../services/chatService');

// Track which userIds are currently connected
const onlineUsers = new Set();

// Track which chat each user currently has open (userId → chatId | null)
const userActiveChat = new Map();

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

    // Load user's chats once — reused in connect and disconnect handlers
    const userChats = getUserChats(userId);

    // Update last seen
    getDb()
      .prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
      .run([Date.now(), userId]);

    // Join personal room for direct delivery (new chats, etc.)
    socket.join(`user:${userId}`);

    // Join all user's chat rooms and notify others this user is online
    userChats.forEach((chat) => {
      socket.join(`chat:${chat.id}`);
      socket.to(`chat:${chat.id}`).emit('user-online', { userId });
    });

    // Inform the connecting user about which of their contacts are already online
    const seenMembers = new Set();
    userChats.forEach((chat) => {
      chat.members.forEach((m) => {
        if (m.id !== userId && !seenMembers.has(m.id) && onlineUsers.has(m.id)) {
          socket.emit('user-online', { userId: m.id });
          seenMembers.add(m.id);
        }
      });
    });

    // Join a specific chat room (after creating a new chat)
    socket.on('join-chat', (chatId) => {
      socket.join(`chat:${chatId}`);
    });

    // Track which chat the user currently has open (for push suppression)
    socket.on('set-active-chat', (chatId) => {
      userActiveChat.set(userId, chatId || null);
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
      userActiveChat.delete(userId);
      const lastSeenAt = Date.now();
      getDb()
        .prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
        .run([lastSeenAt, userId]);
      // Notify chats that this user went offline
      userChats.forEach((chat) => {
        io.to(`chat:${chat.id}`).emit('user-offline', { userId, last_seen_at: lastSeenAt });
      });
      console.log(`[Socket] Disconnected: ${userId}`);
    });
  });

  return io;
}

module.exports = { initSocket, onlineUsers, userActiveChat };
