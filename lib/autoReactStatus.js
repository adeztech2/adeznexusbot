import { getSetting, isEnabled } from './database/settings.js';
import { resolveLid } from './connection/groupCache.js';

function normalizeJid(jid) {
  if (!jid) return jid;
  return jid.replace(/:\d+(@s\.whatsapp\.net)$/, '$1');
}

/**
 * Resolve the real phone JID of a status poster from a raw Baileys message.
 * Handles both normal and LID addressing modes.
 */
function resolveStatusSenderJid(m) {
  const key  = m.key;
  const mode = key.addressingMode;

  let senderJid;

  if (mode === 'lid') {
    // participantAlt is the phone JID when LID addressing is used
    senderJid =
      key.participantAlt  ||
      key.remoteJidAlt    ||
      m.participant       ||
      key.participant     ||
      null;
  } else {
    senderJid =
      key.participant     ||
      m.participant       ||
      null;
  }

  if (!senderJid) return null;

  // If we ended up with a LID JID, try to resolve it to a phone JID
  if (senderJid.endsWith('@lid')) {
    const resolved = resolveLid(senderJid);
    if (resolved) return normalizeJid(resolved);
    // Keep the LID as-is — WhatsApp may handle it internally
    return senderJid;
  }

  return normalizeJid(senderJid);
}

export async function handleAutoReactStatus(sock, m) {
  if (m.key.remoteJid !== 'status@broadcast') return;
  if (!isEnabled('autoLikeStatus')) return;

  try {
    const nickk = sock.user?.id ? normalizeJid(sock.user.id) : null;
    if (!nickk) return;

    const senderJid = resolveStatusSenderJid(m);
    if (!senderJid) return;

    // Skip reacting to own statuses
    if (senderJid === nickk) return;

    const emojisRaw = getSetting('likeEmojis') || '💛,❤️,💜,🤍,💙';
    const emojis    = emojisRaw.split(',').map(e => e.trim()).filter(Boolean);
    const emoji     = emojis[Math.floor(Math.random() * emojis.length)];

    setTimeout(async () => {
      try {
        await sock.sendMessage(
          'status@broadcast',
          { react: { text: emoji, key: m.key } },
          { statusJidList: [senderJid, nickk] }
        );
      } catch (e) {
        console.error('[autoReact] Failed:', e.message);
      }
    }, 1000);
  } catch (e) {
    console.error('[autoReact] Error:', e.message);
  }
}
