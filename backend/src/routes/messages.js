const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getChatMessages, saveMessage, toggleReaction } = require('../services/chatService');
const { getDb } = require('../config/database');
const { sendMessagePush } = require('../services/pushService');
const { userActiveChat } = require('../socket/socketServer');

const router = express.Router();
router.use(authMiddleware);

// GET /chats/:chatId/messages?before=<timestamp>&limit=50
router.get('/:chatId/messages', (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before ? parseInt(req.query.before) : null;
    const messages = getChatMessages(req.params.chatId, req.userId, {
      limit,
      before,
    });
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

// POST /chats/:chatId/messages
router.post('/:chatId/messages', (req, res, next) => {
  try {
    const { text, attachment_url, attachment_type, attachment_name } = req.body;
    const hasText = text && typeof text === 'string' && text.trim();
    const hasAttachment = attachment_url && attachment_type;
    if (!hasText && !hasAttachment) {
      return res.status(400).json({ error: 'text or attachment is required' });
    }
    const attachment = hasAttachment ? { attachment_url, attachment_type, attachment_name } : {};
    const msg = saveMessage(req.params.chatId, req.userId, hasText ? text.trim() : '', attachment);

    const db = getDb();
    const members = db
      .prepare(
        `SELECT u.id, u.push_token, u.display_name
         FROM chat_members cm JOIN users u ON u.id = cm.user_id
         WHERE cm.chat_id = ?`
      )
      .all(req.params.chatId);

    const sender = members.find((m) => m.id === req.userId);
    const senderName = sender?.display_name || 'Новое сообщение';

    // Broadcast via socket — emit to each member's personal room so new
    // chats (where the other user hasn't joined the chat room yet) also work
    const io = req.app.get('io');
    if (io) {
      for (const member of members) {
        io.to(`user:${member.id}`).emit('new-message', msg);
      }
    }

    // Push to everyone except sender and users who have this exact chat open
    for (const member of members) {
      if (member.id === req.userId) continue;
      if (userActiveChat.get(member.id) === req.params.chatId) continue;
      if (member.push_token) {
        const pushText = msg.text || (msg.attachment_type === 'image' ? '📷 Фото' : '📎 Файл');
        sendMessagePush(member.push_token, senderName, pushText, {
          chatId: req.params.chatId,
          senderId: req.userId,
        }).catch(() => {});
      }
    }

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
});

// POST /chats/:chatId/messages/:msgId/react
router.post('/:chatId/messages/:msgId/react', (req, res, next) => {
  try {
    const { chatId, msgId } = req.params;
    const db = getDb();

    const member = db
      .prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?')
      .get([chatId, req.userId]);
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    const likedBy = toggleReaction(msgId, req.userId);

    const io = req.app.get('io');
    if (io) {
      const members = db
        .prepare('SELECT user_id FROM chat_members WHERE chat_id = ?')
        .all(chatId);
      for (const m of members) {
        io.to(`user:${m.user_id}`).emit('message-reaction', {
          messageId: msgId,
          chatId,
          liked_by: likedBy,
        });
      }
    }

    res.json({ liked_by: likedBy });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
