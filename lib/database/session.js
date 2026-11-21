import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import axios from 'axios';
import { initAuthCreds, BufferJSON } from 'gifted-baileys';
import { safeStringify, safeParse } from './db.js';
import { getSessionDb, getStoreDb } from './sqlite.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.join(__dirname, '..', 'session');
const CREDS_PATH  = path.join(SESSION_DIR, 'creds.json');

fs.mkdirSync(SESSION_DIR, { recursive: true });

// ── loadSession ───────────────────────────────────────────────────────────────
export async function loadSession(sessionId) {
  try {
    // Clear only non-db files; preserve session.db, store.db and their WAL files
    for (const f of fs.readdirSync(SESSION_DIR)) {
      if (f.endsWith('.db') || f.endsWith('.db-wal') || f.endsWith('.db-shm')) continue;
      try { fs.unlinkSync(path.join(SESSION_DIR, f)); } catch (_) {}
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('SESSION_ID is missing or invalid');
    }

    const [headerCheck, b64Check] = sessionId.split('~');
    if (!['ADEZ', 'Gifted'].includes(headerCheck) || !b64Check) {
      throw new Error("Invalid session format. Expected 'ADEZ~.....'");
    }

    let fullSessionId = sessionId;
    if (!b64Check.startsWith('H4sI')) {
      const res = await axios.get(
        `https://session.gifted.co.ke/session/${b64Check}`,
        { timeout: 15000 }
      );
      const fetched = (res.data || '').toString().trim();
      if (!fetched.startsWith('Gifted~H4sI')) {
        throw new Error('Session server returned invalid data');
      }
      fullSessionId = fetched;
    }

    const [header, b64data] = fullSessionId.split('~');
    if (!['ADEZ', 'Gifted'].includes(header) || !b64data) {
      throw new Error("Invalid session format. Expected 'ADEZ~.....'");
    }

    const decompressed = zlib.gunzipSync(Buffer.from(b64data.replace('...', ''), 'base64'));
    fs.writeFileSync(CREDS_PATH, decompressed, 'utf8');
    console.log('✅ Session File Loaded');
  } catch (e) {
    console.error('Session Error:', e.message);
    try {
      const db = getSessionDb();
      const row = db.prepare('SELECT value FROM session_store WHERE id = ?').get('creds');
      if (row) {
        console.log('Using cached SQLite credentials - skipping remote session');
        return;
      }
    } catch (_) {}
    throw e;
  }
}

// ── SQLite auth helpers (session.db) ──────────────────────────────────────────
const _stmtCache = {};

function getStmt(sql) {
  if (!_stmtCache[sql]) _stmtCache[sql] = getSessionDb().prepare(sql);
  return _stmtCache[sql];
}

function authRead(id) {
  try {
    const row = getStmt('SELECT value FROM session_store WHERE id = ?').get(id);
    return row ? JSON.parse(row.value, BufferJSON.reviver) : null;
  } catch (_) { return null; }
}

function authWrite(id, value) {
  try {
    getStmt('INSERT OR REPLACE INTO session_store (id, value) VALUES (?, ?)')
      .run(id, JSON.stringify(value, BufferJSON.replacer));
  } catch (_) {}
}

function authRemove(id) {
  try {
    getStmt('DELETE FROM session_store WHERE id = ?').run(id);
  } catch (_) {}
}

// ── useAuthState — SQLite only ────────────────────────────────────────────────
export async function useAuthState() {
  // Migrate creds.json → session.db on each start
  if (fs.existsSync(CREDS_PATH)) {
    try {
      const initialCreds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'), BufferJSON.reviver);
      authWrite('creds', initialCreds);
      fs.unlinkSync(CREDS_PATH);
    } catch (e) {
      console.error('[session] Failed to migrate creds.json:', e.message);
    }
  }

  const creds = authRead('creds') || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            const v = authRead(`${type}-${id}`);
            if (v !== null) data[id] = v;
          }
          return data;
        },
        set: async (data) => {
          const db = getSessionDb();
          const ins = db.prepare('INSERT OR REPLACE INTO session_store (id, value) VALUES (?, ?)');
          const del = db.prepare('DELETE FROM session_store WHERE id = ?');
          const run = db.transaction((entries) => {
            for (const [key, v] of entries) {
              if (v) ins.run(key, JSON.stringify(v, BufferJSON.replacer));
              else   del.run(key);
            }
          });
          const entries = [];
          for (const cat in data) {
            for (const id in data[cat]) {
              entries.push([`${cat}-${id}`, data[cat][id]]);
            }
          }
          try { run(entries); } catch (_) {}
        }
      }
    },
    saveCreds: () => authWrite('creds', creds)
  };
}

// ── MessageStore — store.db ───────────────────────────────────────────────────
export class MessageStore {
  constructor() {
    const db = getStoreDb();
    this._save = db.prepare(
      'INSERT OR REPLACE INTO msg_store (id, jid, data, ts) VALUES (?, ?, ?, unixepoch())'
    );
    this._load = db.prepare('SELECT data FROM msg_store WHERE jid = ? AND id = ?');
  }

  async loadMessage(jid, id) {
    try {
      const row = this._load.get(jid, id);
      return row ? safeParse(row.data) : null;
    } catch (_) { return null; }
  }

  bind(ev) {
    ev.on('messages.upsert', ({ messages }) => {
      setImmediate(() => {
        for (const msg of messages) {
          if (msg.key?.remoteJid && msg.key?.id) {
            try { this._save.run(msg.key.id, msg.key.remoteJid, safeStringify(msg)); }
            catch (_) {}
          }
        }
      });
    });
  }

  destroy() {}
}

// ── Cleanup — purge old messages from store.db ────────────────────────────────
export function startCleanup() {
  const cutoff = () => Math.floor(Date.now() / 1000) - 600; // 10 minutes
  const run = () => {
    try { getStoreDb().prepare('DELETE FROM msg_store WHERE ts < ?').run(cutoff()); }
    catch (_) {}
  };
  run(); // immediate first pass on startup
  setInterval(run, 600_000); // then every 10 minutes
                                 }
