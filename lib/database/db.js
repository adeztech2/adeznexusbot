import pkg from 'pg';
import { DATABASE_URL } from '../../config.js';
import { t } from './botId.js';

const { Pool } = pkg;
let _pool = null;
let _disabled = false;   // set when the first connection test fails

// Accepts a URL whose password has raw special characters (spaces, @, commas,
// emoji...) or is already percent-encoded, and returns a safe connection string.
export function normalizeDbUrl(raw) {
  const url = String(raw || '').trim();
  const m = url.match(/^(postgres(?:ql)?):\/\/([^:@/]+):(.*)@([^@/]+)\/(.+)$/s);
  if (!m) return url;
  const [, proto, user, pass, host, db] = m;
  let plain = pass;
  try { plain = decodeURIComponent(pass); } catch {}
  return `${proto}://${user}:${encodeURIComponent(plain)}@${host}/${db}`;
}

function describe(url) {
  try { const u = new URL(url); return `${u.hostname}:${u.port || 5432}`; } catch { return 'database'; }
}

export function getPool() {
  if (!DATABASE_URL || _disabled) return null;
  if (!_pool) {
    const conn = normalizeDbUrl(DATABASE_URL);
    _pool = new Pool({
      connectionString: conn,
      ssl: /localhost|127\.0\.0\.1/.test(conn) ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    _pool.on('error', (err) => {
      console.error('[pg] Pool error:', err.message);
    });
  }
  return _pool;
}

export function isDbReady() {
  return !!_pool && !_disabled;
}

export async function initDb() {
  const pool = getPool();
  if (!pool) {
    console.log('ℹ️  No DATABASE_URL — settings and sudo use SQLite fallback');
    return false;
  }

  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error(`❌ Cannot connect to ${describe(DATABASE_URL)}: ${e.message}`);
    if (/ENETUNREACH|EHOSTUNREACH|ENOTFOUND|EAI_AGAIN/.test(e.message + (e.code || ''))) {
      console.error('💡 Supabase direct hosts (db.<ref>.supabase.co) are IPv6-only. On Render/Heroku use the Session pooler string (aws-0-<region>.pooler.supabase.com).');
    } else if (/password authentication|SASL|SCRAM/i.test(e.message)) {
      console.error('💡 Wrong database password. Reset it in Supabase > Project Settings > Database.');
    }
    console.error('⚠️  Falling back to SQLite for settings. Auth state REQUIRES PostgreSQL and will refuse to start.');
    try { await pool.end(); } catch {}
    _pool = null; _disabled = true;
    return false;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${t('parapanda_settings')} (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ${t('parapanda_sudo')} (
        id     SERIAL PRIMARY KEY,
        number TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS ${t('gemini_memory')} (
        sender     TEXT        PRIMARY KEY,
        history    JSONB       NOT NULL DEFAULT '[]',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ${t('auth_state')} (
        id    TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    console.log(`✅ PostgreSQL connected (${describe(DATABASE_URL)}) — settings, sudo, AI memory, auth state`);
    return true;
  } catch (e) {
    console.error('❌ PostgreSQL init error:', e.message);
    return false;
  }
}

// Handles Buffers/Uint8Arrays and drops only TRUE circular references
// (the same object appearing twice in different branches is kept).
export function safeStringify(obj) {
  const stack = [];
  return JSON.stringify(obj, function (key, value) {
    const raw = this[key]; // original value, before Buffer.toJSON runs
    if (raw instanceof Uint8Array || Buffer.isBuffer(raw)) {
      return { __type: 'Buffer', data: Buffer.from(raw).toString('base64') };
    }
    if (typeof value === 'object' && value !== null) {
      while (stack.length && stack[stack.length - 1] !== this) stack.pop();
      if (stack.includes(value)) return undefined;
      stack.push(value);
    }
    return value;
  });
}

export function safeParse(str) {
  return JSON.parse(str, (_, v) => {
    if (v && typeof v === 'object' && v.__type === 'Buffer' && v.data) {
      return Buffer.from(v.data, 'base64');
    }
    return v;
  });
}
