import { getPool } from '../database/db.js';
import { t } from '../database/botId.js';

const MAX_TURNS = 20; // store last 20 message pairs (40 turns total)

/**
 * Load a user's Gemini conversation history from PostgreSQL.
 * Returns a Gemini-compatible `contents` array (role/parts format).
 * Falls back to [] if DB is unavailable.
 *
 * @param {string} senderJid  - e.g. "254712345678@s.whatsapp.net"
 * @returns {Promise<object[]>}
 */
export async function loadHistory(senderJid) {
  const pool = getPool();
  if (!pool) return [];
  try {
    const res = await pool.query(
      `SELECT history FROM ${t('gemini_memory')} WHERE sender = $1`,
      [senderJid]
    );
    return res.rows[0]?.history || [];
  } catch { return []; }
}

/**
 * Persist updated conversation history for a user.
 * Keeps only the last MAX_TURNS turns (oldest pruned first).
 *
 * @param {string}   senderJid
 * @param {object[]} history    - full updated contents array
 */
export async function saveHistory(senderJid, history) {
  const pool = getPool();
  if (!pool) return;
  // Trim to MAX_TURNS turns
  const trimmed = history.slice(-MAX_TURNS * 2);
  try {
    await pool.query(
      `INSERT INTO ${t('gemini_memory')} (sender, history, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (sender) DO UPDATE
         SET history = $2::jsonb, updated_at = NOW()`,
      [senderJid, JSON.stringify(trimmed)]
    );
  } catch (err) {
    console.error('[geminiMemory] save failed:', err.message);
  }
}

/**
 * Delete all stored history for a user (clear memory command).
 *
 * @param {string} senderJid
 */
export async function clearHistory(senderJid) {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(`DELETE FROM ${t('gemini_memory')} WHERE sender = $1`, [senderJid]);
  } catch {}
}
