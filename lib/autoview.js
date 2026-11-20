import { isEnabled } from './database/settings.js';

function resolveStatusParticipant(key, msgParticipant) {
  const mode = key.addressingMode;
  if (mode === 'lid') {
    return key.remoteJidAlt || key.participantAlt || key.participant;
  }
  return key.participant || msgParticipant;
}

export async function handleAutoViewStatus(sock, m) {
  if (!isEnabled('autoViewStatus')) return;
  if (m.key.remoteJid !== 'status@broadcast') return;

  const resolvedParticipant = resolveStatusParticipant(m.key, m.participant);
  const resolvedKey = { ...m.key, participant: resolvedParticipant };

  try {
    await sock.readMessages([resolvedKey]);
  } catch (err) {
    console.error('[autoView] Error:', err.message);
  }
}
