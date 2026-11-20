import pkg from 'pg';
import { DATABASE_URL } from '../../config.js';

const { Pool } = pkg;
let _pool = null;

export function getPool() {
  if (!DATABASE_URL) return null;
  if (!_pool) {
    _pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });
    _pool.on('error', (err) => {
      console.error('[pg] Pool error:', err.message);
    });
  }
  return _pool;
}

export async function initDb() {
  const pool = getPool();
  if (!pool) {
    console.log('ℹ️  No DATABASE_URL — settings and sudo use SQLite fallback');
    return false;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parapanda_settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS parapanda_sudo (
        id     SERIAL PRIMARY KEY,
        number TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS gemini_memory (
        sender     TEXT        PRIMARY KEY,
        history    JSONB       NOT NULL DEFAULT '[]',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ PostgreSQL ready (settings + sudo + gemini memory)');
    return true;
  } catch (e) {
    console.error('❌ PostgreSQL init error:', e.message);
    return false;
  }
}

export function safeStringify(obj) {
  const seen = new Set();
  return JSON.stringify(obj, (_, v) => {
    if (v instanceof Uint8Array || Buffer.isBuffer(v)) {
      return { __type: 'Buffer', data: Buffer.from(v).toString('base64') };
    }
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v)) return undefined;
      seen.add(v);
    }
    return v;
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
