const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  getUserById,
  updateUser,
  searchUsers,
  sanitizeUser,
} = require('../services/chatService');

const router = express.Router();
router.use(authMiddleware);

// PUT /users/push-token
router.put('/push-token', (req, res) => {
  const { push_token } = req.body;
  if (!push_token || typeof push_token !== 'string') {
    return res.status(400).json({ error: 'push_token required' });
  }
  const { getDb } = require('../config/database');
  const db = getDb();
  // Remove this token from any other user first (device was used by different account)
  db.prepare('UPDATE users SET push_token = NULL WHERE push_token = ? AND id != ?')
    .run([push_token, req.userId]);
  db.prepare('UPDATE users SET push_token = ? WHERE id = ?')
    .run([push_token, req.userId]);
  res.json({ ok: true });
});

// DELETE /users/push-token
router.delete('/push-token', (req, res) => {
  const { getDb } = require('../config/database');
  getDb()
    .prepare('UPDATE users SET push_token = NULL WHERE id = ?')
    .run([req.userId]);
  res.json({ ok: true });
});

// GET /users/me
router.get('/me', (req, res) => {
  const user = getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(sanitizeUser(user));
});

// PATCH /users/me
router.patch('/me', (req, res, next) => {
  try {
    const { username, display_name, avatar_url } = req.body;
    const updated = updateUser(req.userId, { username, display_name, avatar_url });
    res.json(sanitizeUser(updated));
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    next(err);
  }
});

// GET /users/check-username?username=xxx  (auth required so bots can't enumerate)
router.get('/check-username', (req, res) => {
  const username = (req.query.username || '').toLowerCase().trim();
  if (!username || !/^[a-z0-9_]{3,32}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3–32 characters: letters, digits, _' });
  }
  const { getDb } = require('../config/database');
  const existing = getDb().prepare('SELECT id FROM users WHERE username = ?').get(username);
  res.json({ available: !existing });
});

// GET /users/search?q=...
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const results = searchUsers(q, req.userId);
  res.json(results);
});

// GET /users/:id
router.get('/:id', (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(sanitizeUser(user));
});

module.exports = router;
