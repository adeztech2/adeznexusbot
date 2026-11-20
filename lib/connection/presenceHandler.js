import { getSetting } from '../database/settings.js';

const PRESENCE_MAP = {
  online:    'available',
  offline:   'unavailable',
  composing: 'composing',
  typing:    'composing',
  recording: 'recording',
};

export async function sendPresence(sock, m) {
  try {
    const jid = m.key.remoteJid;
    if (!jid || jid === 'status@broadcast' || m.key.fromMe) return;

    const isGroup = jid.endsWith('@g.us');
    const setting = (getSetting(isGroup ? 'gcPresence' : 'dmPresence') || 'off').toLowerCase();

    if (!setting || setting === 'off' || setting === 'false' || setting === '0') return;

    const presenceType = PRESENCE_MAP[setting];
    if (!presenceType) return;

    const target = m.key.remoteJidAlt || jid;
    if (!target) return;

    await sock.sendPresenceUpdate(presenceType, target);
  } catch (_) {}
}
