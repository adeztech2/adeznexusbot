import { OWNER_NUMBER } from '../../config.js';
import { getPool } from './db.js';
import { getSessionDb, getStoreDb } from './sqlite.js';
import { getSetting } from './settings.js';

export const DEV_NUMBERS = [
  '254111783552',
];

let _cache = null;

export async function getSudoNumbers() {
  if (_cache) return _cache;
  const pool = getPool();

  if (pool) {
    try {
      const res = await pool.query('SELECT number FROM parapanda_sudo ORDER BY id');
      _cache = res.rows.map(r => r.number);
      return _cache;
    } catch (_) {}
  }

  try {
    _cache = getStoreDb().prepare('SELECT number FROM sudo_store').all().map(r => r.number);
    return _cache;
  } catch (_) { return []; }
}

export async function setSudo(number) {
  _cache = null;
  const pool = getPool();

  if (pool) {
    try {
      const res = await pool.query(
        'INSERT INTO parapanda_sudo (number) VALUES ($1) ON CONFLICT (number) DO NOTHING RETURNING id',
        [number]
      );
      return res.rowCount > 0;
    } catch (_) {}
  }

  try {
    return getStoreDb().prepare('INSERT OR IGNORE INTO sudo_store (number) VALUES (?)').run(number).changes > 0;
  } catch (_) { return false; }
}

export async function delSudo(number) {
  _cache = null;
  const pool = getPool();

  if (pool) {
    try {
      const res = await pool.query('DELETE FROM parapanda_sudo WHERE number = $1', [number]);
      return res.rowCount > 0;
    } catch (_) {}
  }

  try {
    return getStoreDb().prepare('DELETE FROM sudo_store WHERE number = ?').run(number).changes > 0;
  } catch (_) { return false; }
}

/**
 * Resolve a @lid JID to the corresponding phone number by looking up the
 * persisted lid-mapping-<lidNum>_reverse key in session.db.
 * Returns the phone number string (e.g. "254114018035") or null if unknown.
 */
function resolveLidToPhone(lidJid) {
  try {
    const lidNum = lidJid.split('@')[0].split(':')[0];
    const row = getSessionDb()
      .prepare("SELECT value FROM session_store WHERE id = ?")
      .get(`lid-mapping-${lidNum}_reverse`);
    if (row) return JSON.parse(row.value); // stored as JSON string e.g. "254114018035"
  } catch (_) {}
  return null;
}

export async function isSuperUser(jid, sock) {
  if (!jid) return false;

  // If this is a LID JID, resolve it to a phone number first using the
  // persisted session mappings (populated by the WhatsApp client library).
  let resolvedJid = jid;
  if (jid.endsWith('@lid')) {
    const phone = resolveLidToPhone(jid);
    if (phone) {
      resolvedJid = `${phone}@s.whatsapp.net`;
    } else {
      // Try sock's own user if the LID belongs to the bot itself
      const botLidNum = sock?.user?.lid?.split(':')[0]?.split('@')[0];
      const lidNum    = jid.split('@')[0].split(':')[0];
      if (botLidNum && lidNum === botLidNum) {
        resolvedJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      }
    }
  }

  const num = resolvedJid.split('@')[0].split(':')[0];

  const ownerEnv = (OWNER_NUMBER || '').replace(/\D/g, '');
  if (ownerEnv && num === ownerEnv) return true;

  try {
    const ownerNums = (getSetting('ownerNumber') || '').split(',').map(n => n.trim()).filter(Boolean);
    if (ownerNums.includes(num)) return true;
  } catch (_) {}

  const botNum = sock?.user?.id?.split(':')[0]?.split('@')[0];
  if (botNum && num === botNum) return true;

  if (DEV_NUMBERS.includes(num)) return true;

  const sudoList = await getSudoNumbers();
  return sudoList.includes(num);
}
