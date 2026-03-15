const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  getUserChats,
  getOrCreateDirectChat,
  getChatById,
  markChatAsRead,
} = require('../services/chatService');

const router = express.Router();
router.use(authMiddleware);

// GET /chats — list all chats for current user
router.get('/', (req, res) => {
  const chats = getUserChats(req.userId);
  res.json(chats);
});

// POST /chats — create or get a direct chat with another user
router.post('/', (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot chat with yourself' });
    }
    const chat = getOrCreateDirectChat(req.userId, userId);
    res.json(chat);
  } catch (err) {
    next(err);
  }
});

// GET /chats/:id
router.get('/:id', (req, res) => {
  const chat = getChatById(req.params.id, req.userId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  res.json(chat);
});

// POST /chats/:id/read — mark all messages in chat as read
router.post('/:id/read', (req, res, next) => {
  try {
    const readAt = markChatAsRead(req.params.id, req.userId);
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${req.params.id}`).emit('chat-read', {
        chatId: req.params.id,
        userId: req.userId,
        readAt,
      });
    }
    res.json({ ok: true, readAt });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
