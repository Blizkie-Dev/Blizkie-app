const { getDb } = require('../config/database');

function runMigrations() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      phone       TEXT UNIQUE,
      email       TEXT UNIQUE,
      username    TEXT UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      avatar_url  TEXT,
      created_at  INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otps (
      id          TEXT PRIMARY KEY,
      target      TEXT NOT NULL,
      code_hash   TEXT NOT NULL,
      expires_at  INTEGER NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_otps_target ON otps(target);

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      revoked    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS chats (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL DEFAULT 'direct',
      name       TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id    TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at  INTEGER NOT NULL,
      PRIMARY KEY (chat_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);

    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      chat_id     TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      sender_id   TEXT NOT NULL REFERENCES users(id),
      ciphertext  TEXT NOT NULL,
      iv          TEXT NOT NULL,
      auth_tag    TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      deleted_at  INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
  `);

  // Add push_token column if it doesn't exist yet
  try {
    db.exec('ALTER TABLE users ADD COLUMN push_token TEXT');
  } catch {
    // column already exists — ignore
  }

  // Add last_read_at to chat_members for unread tracking
  try {
    db.exec('ALTER TABLE chat_members ADD COLUMN last_read_at INTEGER NOT NULL DEFAULT 0');
  } catch {
    // column already exists — ignore
  }

  // Add attachment columns to messages
  for (const col of [
    'ALTER TABLE messages ADD COLUMN attachment_url TEXT',
    'ALTER TABLE messages ADD COLUMN attachment_type TEXT',
    'ALTER TABLE messages ADD COLUMN attachment_name TEXT',
  ]) {
    try { db.exec(col); } catch { /* already exists */ }
  }

  console.log('[DB] Migrations complete');
}

module.exports = { runMigrations };
