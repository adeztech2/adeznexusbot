import { OWNER_NUMBER } from '../../config.js';
import { getPool } from './db.js';
import { getStoreDb } from './sqlite.js';

export const DEFAULTS = {
  botName:          'ADEZ NEXUS',
  botFooter:        'ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴢ ᴛᴇᴄʜ',
  ownerName:        'Arnold Adez',
  ownerNumber:      OWNER_NUMBER,
  timezone:         'Africa/Nairobi',
  prefix:           '.',
  mode:             'private',
  autoViewStatus:   'true',
  autoLikeStatus:   'true',
  likeEmojis:       '💛,❤️,💜,🤍,💙',
  dmPresence:       'off',
  gcPresence:       'off',
  antiDelete:       'false',
  antiEdit:         'false',
  chatbot:          'false',
  useButtons:       'false',
  footer:           'ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴢ ᴛᴇᴄʜ',
  // Auto-join / auto-follow
  autoJoinGroup:    'false',
  autoFollowChannel:'false',
  newsletterJid:    '',
  // Newsletter react
  newsletterReact:  'false',
  newsletterEmojis: '❤️,💛,👍,💜,😮,🤍,💙',
};

const _cache = { ...DEFAULTS };

export async function initSettings() {
  const pool = getPool();

  if (pool) {
    try {
      const res = await pool.query('SELECT key, value FROM parapanda_settings');
      for (const { key, value } of res.rows) {
        if (key in DEFAULTS) _cache[key] = value;
      }
      for (const [key, def] of Object.entries(DEFAULTS)) {
        if (!res.rows.find(r => r.key === key)) {
          await pool.query(
            `INSERT INTO parapanda_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
            [key, def]
          );
        }
      }
    } catch (e) { console.error('[settings] pg init error:', e.message); }
    return;
  }

  // SQLite fallback (store.db)
  try {
    const db   = getStoreDb();
    const rows = db.prepare('SELECT key, value FROM settings_store').all();
    for (const { key, value } of rows) {
      if (key in DEFAULTS) _cache[key] = value;
    }
    const ins = db.prepare('INSERT OR IGNORE INTO settings_store (key, value) VALUES (?, ?)');
    for (const [key, def] of Object.entries(DEFAULTS)) ins.run(key, def);
  } catch (e) { console.error('[settings] sqlite init error:', e.message); }
}

export function getSetting(key) {
  return _cache[key] ?? DEFAULTS[key] ?? null;
}

export function isEnabled(key) {
  const v = getSetting(key);
  if (v === null) return false;
  const s = String(v).toLowerCase().trim();
  return s === 'true' || s === 'on' || s === '1' || s === 'yes';
}

export async function setSetting(key, value) {
  _cache[key] = String(value);
  const pool  = getPool();

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO parapanda_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [key, String(value)]
      );
    } catch (e) { console.error('[settings] pg set error:', e.message); }
    return;
  }

  try {
    getStoreDb().prepare('INSERT OR REPLACE INTO settings_store (key, value) VALUES (?, ?)').run(key, String(value));
  } catch (e) { console.error('[settings] sqlite set error:', e.message); }
}

export function getAllSettings() {
  return { ...DEFAULTS, ..._cache };
}
