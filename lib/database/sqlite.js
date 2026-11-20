import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR  = path.join(__dirname, '..', 'session');

fs.mkdirSync(SESSION_DIR, { recursive: true });

// ── session.db — Baileys auth state only ──────────────────────────────────────
let _sessionDb = null;
export function getSessionDb() {
  if (_sessionDb) return _sessionDb;
  _sessionDb = new Database(path.join(SESSION_DIR, 'session.db'));
  _sessionDb.pragma('journal_mode = WAL');
  _sessionDb.pragma('synchronous = NORMAL');
  _sessionDb.pragma('cache_size = -8000');
  _sessionDb.pragma('temp_store = memory');
  _sessionDb.exec(`
    CREATE TABLE IF NOT EXISTS session_store (
      id    TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return _sessionDb;
}

// ── store.db — message store, antidelete, and config fallbacks ────────────────
let _storeDb = null;
export function getStoreDb() {
  if (_storeDb) return _storeDb;
  _storeDb = new Database(path.join(SESSION_DIR, 'store.db'));
  _storeDb.pragma('journal_mode = WAL');
  _storeDb.pragma('synchronous = NORMAL');
  _storeDb.pragma('cache_size = -10000');
  _storeDb.pragma('temp_store = memory');
  _storeDb.exec(`
    CREATE TABLE IF NOT EXISTS msg_store (
      id   TEXT NOT NULL,
      jid  TEXT NOT NULL,
      data TEXT NOT NULL,
      ts   INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (jid, id)
    );
    CREATE INDEX IF NOT EXISTS idx_msg_ts ON msg_store(ts);

    CREATE TABLE IF NOT EXISTS antidelete_store (
      id        TEXT NOT NULL,
      jid       TEXT NOT NULL,
      sender    TEXT,
      push_name TEXT,
      data      TEXT NOT NULL,
      ts        INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (jid, id)
    );
    CREATE INDEX IF NOT EXISTS idx_ad_jid_ts ON antidelete_store(jid, ts);

    CREATE TABLE IF NOT EXISTS settings_store (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sudo_store (
      number TEXT PRIMARY KEY
    );
  `);
  return _storeDb;
}
