import { getPool } from './db.js';
import { getStoreDb } from './sqlite.js';
import { t } from './botId.js';

// Per-group moderation settings: antilink, warns, welcome and goodbye.
// Stored as one JSON document per group (PostgreSQL if DATABASE_URL is set,
// otherwise the local SQLite store.db), with an in-memory cache in front.

const _cache = new Map();
let _pgReady = null;
let _sqliteReady = false;

function defaults() {
  return {
    antilink:  { enabled: false, action: 'delete', type: 'all' }, // action: delete | warn | kick
    warnLimit: 3,
    warns:     {},                                                // { "<number>": count }
    welcome:   { enabled: false, text: '' },
    goodbye:   { enabled: false, text: '' },
  };
}

function merge(saved) {
  const d = defaults();
  const s = saved || {};
  return {
    ...d,
    ...s,
    antilink: { ...d.antilink, ...(s.antilink || {}) },
    welcome:  { ...d.welcome,  ...(s.welcome  || {}) },
    goodbye:  { ...d.goodbye,  ...(s.goodbye  || {}) },
    warns:    s.warns || {},
  };
}

function ensurePg(pool) {
  if (!_pgReady) {
    _pgReady = pool.query(`
      CREATE TABLE IF NOT EXISTS ${t('parapanda_group_settings')} (
        jid  TEXT PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '{}'
      )
    `).catch(err => { _pgReady = null; throw err; });
  }
  return _pgReady;
}

function ensureSqlite() {
  if (_sqliteReady) return getStoreDb();
  const db = getStoreDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_settings_store (
      jid  TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);
  _sqliteReady = true;
  return db;
}

export async function getGroupSettings(jid) {
  if (_cache.has(jid)) return _cache.get(jid);

  let saved = null;
  const pool = getPool();

  try {
    if (pool) {
      await ensurePg(pool);
      const res = await pool.query(`SELECT data FROM ${t('parapanda_group_settings')} WHERE jid = $1`, [jid]);
      saved = res.rows[0]?.data ?? null;
    } else {
      const row = ensureSqlite().prepare('SELECT data FROM group_settings_store WHERE jid = ?').get(jid);
      if (row) saved = JSON.parse(row.data);
    }
  } catch (e) {
    // Don't cache on a failed load — otherwise a later save would overwrite real data with defaults.
    console.error('[groupSettings] load error:', e.message);
    return merge(null);
  }

  const settings = merge(saved);
  _cache.set(jid, settings);
  return settings;
}

async function persist(jid, settings) {
  const pool = getPool();
  try {
    if (pool) {
      await ensurePg(pool);
      await pool.query(
        `INSERT INTO ${t('parapanda_group_settings')} (jid, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (jid) DO UPDATE SET data = $2::jsonb`,
        [jid, JSON.stringify(settings)]
      );
    } else {
      ensureSqlite()
        .prepare('INSERT OR REPLACE INTO group_settings_store (jid, data) VALUES (?, ?)')
        .run(jid, JSON.stringify(settings));
    }
  } catch (e) {
    console.error('[groupSettings] save error:', e.message);
  }
}

/** Load, mutate in place via fn(settings), save, and return the settings. */
export async function updateGroupSettings(jid, fn) {
  const settings = await getGroupSettings(jid);
  fn(settings);
  _cache.set(jid, settings);
  await persist(jid, settings);
  return settings;
}
