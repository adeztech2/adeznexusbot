// ── Bot-level helpers shared between index.js and other modules ───────────────

// ── JID helpers ────────────────────────────────────────────────────────────────

/** Strip device suffix from a WhatsApp JID. e.g. "123:5@s.whatsapp.net" → "123@s.whatsapp.net" */
export function normalizeJid(jid) {
  return jid?.replace(/:\d+(@s\.whatsapp\.net)$/, '$1') ?? jid;
}

// ── Uptime ─────────────────────────────────────────────────────────────────────

let _botStartTime = null;

export function setBotStartTime(t)  { _botStartTime = t; }
export function getBotStartTime()   { return _botStartTime; }

export function getUptime() {
  if (!_botStartTime) return 'N/A';
  const diff    = Date.now() - _botStartTime;
  const hours   = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}
