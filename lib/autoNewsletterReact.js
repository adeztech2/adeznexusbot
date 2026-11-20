import { getSetting, isEnabled } from './database/settings.js';

/**
 * Auto-react to newsletter/channel messages.
 * Newsletter messages are identified by the presence of key.server_id.
 * Called from messages.upsert in index.js for every incoming message.
 */
export async function handleAutoNewsletterReact(sock, m) {
  // Newsletter messages have a server_id in the key
  if (!m?.key?.server_id) return;
  if (!isEnabled('newsletterReact')) return;

  const jid      = m.key.remoteJid;
  const serverId = m.key.server_id?.toString();
  if (!jid || !serverId) return;

  try {
    const raw    = getSetting('newsletterEmojis') || '❤️,💛,👍,💜,😮,🤍,💙';
    const emojis = raw.split(',').map(e => e.trim()).filter(Boolean);
    const emoji  = emojis[Math.floor(Math.random() * emojis.length)];

    setTimeout(async () => {
      try {
        await sock.newsletterReactMessage(jid, serverId, emoji);
      } catch (e) {
        // Silently ignore — server may reject reactions on some channel types
      }
    }, 1000);
  } catch (e) {
    console.error('[newsletterReact] Error:', e.message);
  }
}
