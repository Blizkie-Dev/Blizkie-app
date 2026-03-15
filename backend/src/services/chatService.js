const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { encrypt, decrypt } = require('../crypto/aes');

function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    last_seen_at: u.last_seen_at,
  };
}

function decryptMessage(msg) {
  let text = '';
  try {
    text = decrypt({
      ciphertext: msg.ciphertext,
      iv: msg.iv,
      authTag: msg.auth_tag,
    }).trim();
  } catch {
    text = '[encrypted]';
  }
  return {
    id: msg.id,
    chat_id: msg.chat_id,
    sender_id: msg.sender_id,
    text,
    created_at: msg.created_at,
    deleted_at: msg.deleted_at || null,
    attachment_url: msg.attachment_url || null,
    attachment_type: msg.attachment_type || null,
    attachment_name: msg.attachment_name || null,
    liked_by: JSON.parse(msg.liked_by || '[]'),
  };
}

// ─── Chats ─────────────────────────────────────────────────────────────────

/**
 * Returns all chats for a user with last message preview.
 */
function getUserChats(userId) {
  const db = getDb();

  const chats = db
    .prepare(
      `SELECT c.id, c.type, c.name, c.created_at
       FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id
       WHERE cm.user_id = ?
       ORDER BY c.created_at DESC`
    )
    .all(userId);

  return chats.map((chat) => {
    // Get other members
    const members = db
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, u.last_seen_at
         FROM chat_members cm JOIN users u ON u.id = cm.user_id
         WHERE cm.chat_id = ?`
      )
      .all(chat.id)
      .map(sanitizeUser);

    // Get last message
    const lastMsg = db
      .prepare(
        `SELECT * FROM messages WHERE chat_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(chat.id);

    // Unread count for current user
    const myMember = db
      .prepare('SELECT last_read_at FROM chat_members WHERE chat_id = ? AND user_id = ?')
      .get([chat.id, userId]);
    const myLastReadAt = myMember?.last_read_at || 0;

    const { count: unread_count } = db
      .prepare(
        `SELECT COUNT(*) as count FROM messages
         WHERE chat_id = ? AND sender_id != ? AND created_at > ? AND deleted_at IS NULL`
      )
      .get([chat.id, userId, myLastReadAt]);

    // Partner's last_read_at (for read receipts — when did they read our messages)
    const partnerMember = db
      .prepare('SELECT last_read_at FROM chat_members WHERE chat_id = ? AND user_id != ?')
      .get([chat.id, userId]);

    return {
      ...chat,
      members,
      last_message: lastMsg ? decryptMessage(lastMsg) : null,
      unread_count: unread_count || 0,
      partner_last_read_at: partnerMember?.last_read_at || 0,
    };
  });
}

/**
 * Finds or creates a direct chat between two users.
 * Returns the chat object.
 */
function getOrCreateDirectChat(userAId, userBId) {
  const db = getDb();

  // Check if a direct chat already exists between these two users
  const existing = db
    .prepare(
      `SELECT c.id FROM chats c
       JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = ?
       JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = ?
       WHERE c.type = 'direct'
       LIMIT 1`
    )
    .get([userAId, userBId]);

  if (existing) {
    return getChatById(existing.id, userAId);
  }

  // Create new chat
  const chatId = uuidv4();
  const now = Date.now();

  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO chats (id, type, created_at) VALUES (?, ?, ?)').run([chatId, 'direct', now]);
    db.prepare('INSERT INTO chat_members (chat_id, user_id, joined_at) VALUES (?, ?, ?)').run([chatId, userAId, now]);
    db.prepare('INSERT INTO chat_members (chat_id, user_id, joined_at) VALUES (?, ?, ?)').run([chatId, userBId, now]);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return getChatById(chatId, userAId);
}

function getChatById(chatId, userId) {
  const db = getDb();

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
  if (!chat) return null;

  // Verify membership
  const member = db
    .prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?')
    .get([chatId, userId]);
  if (!member) return null;

  const members = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.last_seen_at
       FROM chat_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.chat_id = ?`
    )
    .all(chatId)
    .map(sanitizeUser);

  return { ...chat, members };
}

// ─── Messages ──────────────────────────────────────────────────────────────

/**
 * Returns paginated messages for a chat (newest last).
 */
function getChatMessages(chatId, userId, { limit = 50, before = null } = {}) {
  const db = getDb();

  // Verify membership
  const member = db
    .prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?')
    .get([chatId, userId]);
  if (!member) throw Object.assign(new Error('Forbidden'), { status: 403 });

  let rows;
  if (before) {
    rows = db
      .prepare(
        `SELECT * FROM messages
         WHERE chat_id = ? AND deleted_at IS NULL AND created_at < ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all([chatId, before, limit]);
  } else {
    rows = db
      .prepare(
        `SELECT * FROM messages
         WHERE chat_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT ?`
      )
      .all([chatId, limit]);
  }

  return rows.reverse().map(decryptMessage);
}

/**
 * Saves an encrypted message and returns the decrypted view.
 */
function saveMessage(chatId, senderId, text, attachment = {}) {
  const db = getDb();

  // Verify sender is a member
  const member = db
    .prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?')
    .get([chatId, senderId]);
  if (!member) throw Object.assign(new Error('Forbidden'), { status: 403 });

  const plaintext = text || '';
  const { ciphertext, iv, authTag } = encrypt(plaintext || ' ');
  const msgId = uuidv4();
  const now = Date.now();
  const { attachment_url = null, attachment_type = null, attachment_name = null } = attachment;

  db.prepare(
    `INSERT INTO messages (id, chat_id, sender_id, ciphertext, iv, auth_tag, created_at, attachment_url, attachment_type, attachment_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run([msgId, chatId, senderId, ciphertext, iv, authTag, now, attachment_url, attachment_type, attachment_name]);

  return {
    id: msgId,
    chat_id: chatId,
    sender_id: senderId,
    text: plaintext,
    created_at: now,
    attachment_url,
    attachment_type,
    attachment_name,
  };
}

// ─── Users ─────────────────────────────────────────────────────────────────

function searchUsers(query, requesterId) {
  const db = getDb();
  const q = `%${query}%`;
  return db
    .prepare(
      `SELECT id, username, display_name, avatar_url, last_seen_at
       FROM users
       WHERE id != ? AND (username LIKE ? OR display_name LIKE ?)
       LIMIT 20`
    )
    .all([requesterId, q, q])
    .map(sanitizeUser);
}

function getUserById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function updateUser(id, fields) {
  const db = getDb();
  const allowed = ['username', 'display_name', 'avatar_url'];
  const updates = Object.entries(fields).filter(([k, v]) => allowed.includes(k) && v !== undefined);
  if (!updates.length) return getUserById(id);

  const set = updates.map(([k]) => `${k} = ?`).join(', ');
  const values = updates.map(([, v]) => v);
  db.prepare(`UPDATE users SET ${set} WHERE id = ?`).run([...values, id]);
  return getUserById(id);
}

function markChatAsRead(chatId, userId) {
  const now = Date.now();
  getDb()
    .prepare('UPDATE chat_members SET last_read_at = ? WHERE chat_id = ? AND user_id = ?')
    .run([now, chatId, userId]);
  return now;
}

function toggleReaction(messageId, userId) {
  const db = getDb();
  const msg = db.prepare('SELECT liked_by FROM messages WHERE id = ?').get(messageId);
  if (!msg) throw Object.assign(new Error('Not found'), { status: 404 });

  const likedBy = JSON.parse(msg.liked_by || '[]');
  const idx = likedBy.indexOf(userId);
  if (idx >= 0) likedBy.splice(idx, 1);
  else likedBy.push(userId);

  db.prepare('UPDATE messages SET liked_by = ? WHERE id = ?').run([JSON.stringify(likedBy), messageId]);
  return likedBy;
}

module.exports = {
  getUserChats,
  markChatAsRead,
  getOrCreateDirectChat,
  getChatById,
  getChatMessages,
  saveMessage,
  searchUsers,
  getUserById,
  updateUser,
  sanitizeUser,
  toggleReaction,
};
