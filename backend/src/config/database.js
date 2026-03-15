const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'blizkie.db');
const LOCK_PATH = DB_PATH + '.lock';

// node-sqlite3-wasm uses a .lock directory — clean up stale lock from a previous crash
if (fs.existsSync(LOCK_PATH)) {
  fs.rmSync(LOCK_PATH, { recursive: true, force: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
  }
  return db;
}

module.exports = { getDb };
