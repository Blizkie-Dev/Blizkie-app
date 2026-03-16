const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  getUserChats,
  getOrCreateDirectChat,
  createGroupChat,
  getChatById,
  markChatAsRead,
  addChatMember,
  removeChatMember,
  updateChatMetadata,
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

// POST /chats/group — create a group chat
router.post('/group', (req, res, next) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!Array.isArray(memberIds) || memberIds.length < 2) {
      return res.status(400).json({ error: 'at least 2 memberIds required' });
    }
    const chat = createGroupChat(name, req.userId, memberIds);

    // Notify all members via socket so the chat appears in their list
    const io = req.app.get('io');
    if (io) {
      for (const member of chat.members) {
        io.to(`user:${member.id}`).emit('chat-created', chat);
      }
    }

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

// POST /chats/:id/members — add a member (creator only)
router.post('/:id/members', (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const updatedChat = addChatMember(req.params.id, req.userId, userId);
    const io = req.app.get('io');
    if (io) {
      // Notify existing members that the chat was updated
      for (const member of updatedChat.members) {
        io.to(`user:${member.id}`).emit('chat-updated', updatedChat);
      }
      // Also notify the newly added user so chat appears in their list
      io.to(`user:${userId}`).emit('chat-created', updatedChat);
    }
    res.json(updatedChat);
  } catch (err) {
    next(err);
  }
});

// DELETE /chats/:id/members/:userId — remove a member (creator only)
router.delete('/:id/members/:userId', (req, res, next) => {
  try {
    const updatedChat = removeChatMember(req.params.id, req.userId, req.params.userId);
    const io = req.app.get('io');
    if (io) {
      // Notify remaining members of updated member list
      for (const member of updatedChat.members) {
        io.to(`user:${member.id}`).emit('chat-updated', updatedChat);
      }
      // Notify the removed user so they can remove the chat from their list
      io.to(`user:${req.params.userId}`).emit('chat-removed', { chatId: req.params.id });
    }
    res.json(updatedChat);
  } catch (err) {
    next(err);
  }
});

// PATCH /chats/:id — update chat metadata (name, avatar)
router.patch('/:id', (req, res, next) => {
  try {
    const { name, avatar_url } = req.body;
    const updatedChat = updateChatMetadata(req.params.id, req.userId, { name, avatar_url });

    // Notify all members that the chat was updated
    const io = req.app.get('io');
    if (io) {
      for (const member of updatedChat.members) {
        io.to(`user:${member.id}`).emit('chat-updated', updatedChat);
      }
    }

    res.json(updatedChat);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
