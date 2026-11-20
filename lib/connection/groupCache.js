/**
 * Shared in-memory caches:
 *
 * 1. Group metadata cache — passed to makeWASocket as `cachedGroupMetadata`
 *    so Baileys avoids redundant API calls when building group messages.
 *    Also used by metadataCache.js for admin-check lookups.
 *
 * 2. LID→JID mapping — WhatsApp LID-mode sometimes omits `remoteJidAlt` from
 *    incoming message keys. We record every LID→phoneJID pair we observe and
 *    use it in serialize() as a fallback so replies always target a real JID.
 *    The map is seeded from session.db on first use so restarts don't lose mappings.
 */

import { getSessionDb } from '../database/sqlite.js';

// ── Group metadata ───────────────────────────────────────────────────────────
const groupStore = new Map(); // groupJid → GroupMetadata

export function getCachedGroup(jid)            { return groupStore.get(jid); }
export function setCachedGroup(jid, metadata)  { groupStore.set(jid, metadata); }
export function updateCachedGroup(jid, partial) {
  const existing = groupStore.get(jid);
  if (existing) groupStore.set(jid, { ...existing, ...partial });
}
export function invalidateCachedGroup(jid) { groupStore.delete(jid); }
export function clearGroupCache()          { groupStore.clear(); }

/** For makeWASocket({ cachedGroupMetadata }) */
export async function cachedGroupMetadata(jid) { return groupStore.get(jid); }

// ── LID → phone JID mapping ──────────────────────────────────────────────────
const lidMap = new Map(); // lid (@lid JID) → phone JID (@s.whatsapp.net)
let _seeded  = false;

/**
 * Seed the in-memory LID map from persisted session.db lid-mapping rows.
 * Called once on the first learnLid/resolveLid invocation so that mappings
 * accumulated in previous sessions survive bot restarts.
 */
function seedFromDb() {
  if (_seeded) return;
  _seeded = true;
  try {
    const rows = getSessionDb()
      .prepare("SELECT id, value FROM session_store WHERE id LIKE 'lid-mapping-%' AND id NOT LIKE '%-_reverse'")
      .all();
    for (const row of rows) {
      // id = "lid-mapping-<phone>", value = JSON "<lidNumber>"
      const phone  = row.id.replace('lid-mapping-', '');
      const lidNum = JSON.parse(row.value);
      if (phone && lidNum) {
        lidMap.set(`${lidNum}@lid`,  `${phone}@s.whatsapp.net`);
      }
    }
  } catch (_) {}
}

/**
 * Record a LID→JID pair whenever we observe it in a message key.
 * lid      — e.g. "228664713199782@lid"
 * phoneJid — e.g. "254747746851@s.whatsapp.net"
 */
export function learnLid(lid, phoneJid) {
  if (lid && phoneJid && lid.endsWith('@lid') && phoneJid.endsWith('@s.whatsapp.net')) {
    seedFromDb();
    lidMap.set(lid, phoneJid);
  }
}

/**
 * Resolve a LID JID to the corresponding phone JID.
 * Returns undefined if unknown.
 */
export function resolveLid(lid) {
  seedFromDb();
  return lidMap.get(lid);
}
