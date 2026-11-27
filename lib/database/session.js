import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import axios from 'axios';
import * as Baileys from 'gifted-baileys';
import { safeStringify, safeParse, getPool } from './db.js';
import { getStoreDb } from './sqlite.js';
import { t } from './botId.js';

const { initAuthCreds, BufferJSON, proto } = Baileys;

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.join(__dirname, '..', 'session');
const CREDS_PATH  = path.join(SESSION_DIR, 'creds.json');

fs.mkdirSync(SESSION_DIR, { recursive: true });

// ── Does Postgres already hold creds? ─────────────────────────────────────────
async function hasStoredCreds() {
  const pool = getPool();
  if (!pool) return false;
  try {
    const r = await pool.query(`SELECT 1 FROM ${t('auth_state')} WHERE id = 'creds'`);
    return r.rowCount > 0;
  } catch (_) {
    return false;
  }
}

// ── loadSession ───────────────────────────────────────────────────────────────
// Call AFTER resolveBotId() and initDb().
// Only decodes SESSION_ID when Postgres has no creds yet (first run / after reset).
export async function loadSession(sessionId) {
  // Clear leftover non-db files (old creds.json etc.)
  for (const f of fs.readdirSync(SESSION_DIR)) {
    if (f.endsWith('.db') || f.endsWith('.db-wal') || f.endsWith('.db-shm')) continue;
    try { fs.unlinkSync(path.join(SESSION_DIR, f)); } catch (_) {}
  }

  if (await hasStoredCreds()) {
    console.log('✅ Using stored session from PostgreSQL');
    return;
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
  console.log('✅ Session File Loaded (first-time seed)');
}

// ── useAuthState — PostgreSQL ─────────────────────────────────────────────────
export async function useAuthState() {
  const pool = getPool();
  if (!pool) {
    throw new Error(
      'PostgreSQL is required for auth state. Check DATABASE_URL (use the Supabase Session pooler string).'
    );
  }

  const table = t('auth_state');

  const read = async (id) => {
    const r = await pool.query(`SELECT value FROM ${table} WHERE id = $1`, [id]);
    return r.rows[0] ? JSON.parse(r.rows[0].value, BufferJSON.reviver) : null;
  };

  const upsert = (id, value) =>
    pool.query(
      `INSERT INTO ${table} (id, value) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value`,
      [id, JSON.stringify(value, BufferJSON.replacer)]
    );

  // Seed from creds.json only if Postgres has nothing yet
  let creds = await read('creds');
  if (!creds) {
    if (fs.existsSync(CREDS_PATH)) {
      creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'), BufferJSON.reviver);
      console.log('[session] Seeding creds from SESSION_ID');
    } else {
      creds = initAuthCreds();
      console.log('[session] No creds found, created fresh ones');
    }
    await upsert('creds', creds);
  }
  try { fs.unlinkSync(CREDS_PATH); } catch (_) {}

  // Serialize creds saves so they never race each other
  let credsQueue = Promise.resolve();
  const saveCreds = () => {
    credsQueue = credsQueue
      .then(() => upsert('creds', creds))
      .catch((e) => console.error('[session] saveCreds failed:', e.message));
    return credsQueue;
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          if (!ids.length) return data;

          const wanted = ids.map((i) => `${type}-${i}`);
          const r = await pool.query(
            `SELECT id, value FROM ${table} WHERE id = ANY($1::text[])`,
            [wanted]
          );

          for (const row of r.rows) {
            const id = row.id.slice(type.length + 1);
            let value = JSON.parse(row.value, BufferJSON.reviver);
            if (type === 'app-state-sync-key' && value && proto?.Message?.AppStateSyncKeyData) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }
          return data;
        },

        set: async (data) => {
          const upIds = [];
          const upVals = [];
          const delIds = [];

          for (const cat in data) {
            for (const id in data[cat]) {
              const v = data[cat][id];
              const key = `${cat}-${id}`;
              if (v) {
                upIds.push(key);
                upVals.push(JSON.stringify(v, BufferJSON.replacer));
              } else {
                delIds.push(key);
              }
            }
          }

          if (!upIds.length && !delIds.length) return;

          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            if (upIds.length) {
              await client.query(
                `INSERT INTO ${table} (id, value)
                 SELECT * FROM unnest($1::text[], $2::text[])
                 ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value`,
                [upIds, upVals]
              );
            }
            if (delIds.length) {
              await client.query(
                `DELETE FROM ${table} WHERE id = ANY($1::text[])`,
                [delIds]
              );
            }
            await client.query('COMMIT');
          } catch (e) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            console.error('[session] keys.set failed:', e.message);
            throw e;
          } finally {
            client.release();
          }
        }
      }
    },
    saveCreds
  };
}

// ── MessageStore — store.db (local, short-lived, fine to lose) ────────────────
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
let _cleanupTimer = null;

export function startCleanup() {
  const cutoff = () => Math.floor(Date.now() / 1000) - 600; // 10 minutes
  const run = () => {
    try { getStoreDb().prepare('DELETE FROM msg_store WHERE ts < ?').run(cutoff()); }
    catch (_) {}
  };
  run();
  if (_cleanupTimer) return; // don't stack intervals on every reconnect
  _cleanupTimer = setInterval(run, 600_000);
}
