import { metadataCache } from './metadataCache.js';
import { resolveLid } from './groupCache.js';

export function normalizeJid(jid) {
  if (!jid) return jid;
  // Never modify @lid JIDs — they are not phone JIDs and appending @s.whatsapp.net
  // corrupts them. lidToJid() is responsible for resolving them later.
  if (jid.endsWith('@lid')) return jid;
  const base = jid.split(':')[0];
  return base.endsWith('@s.whatsapp.net') ? base : `${base}@s.whatsapp.net`;
}

export async function lidToJid(sock, chatJid, userIdentifier) {
  try {
    if (userIdentifier.endsWith('@s.whatsapp.net')) return userIdentifier;

    if (userIdentifier.endsWith('@lid')) {
      const botJid = normalizeJid(sock.user.id);
      const botLid = sock.user.lid;
      if (botLid && userIdentifier === botLid) return botJid;

      if (chatJid?.endsWith('@g.us')) {
        try {
          const groupMetadata = await sock.groupMetadata(chatJid);
          const participant   = groupMetadata.participants.find(
            p => p.id === userIdentifier || p.lid === userIdentifier
          );
          if (participant) {
            const resolved = participant.phoneNumber || participant.id;
            if (resolved?.endsWith('@s.whatsapp.net')) return resolved;
          }
        } catch {}
      }

      const cached = resolveLid(userIdentifier);
      if (cached) return cached;

      return userIdentifier;
    }

    if (!userIdentifier.includes('@')) return `${userIdentifier}@s.whatsapp.net`;

    return userIdentifier;
  } catch (err) {
    return userIdentifier;
  }
}

export async function getUserJid(sock, m) {
  if (m.sender) return m.sender;

  const isGroup  = m.key?.remoteJid?.endsWith('@g.us');
  const isStatus = m.key?.remoteJid === 'status@broadcast';

  let userJid;

  if (m.key?.fromMe) {
    userJid = normalizeJid(sock.user.id);
  } else if (isGroup || isStatus) {
    const mode = m.key?.addressingMode;
    if (mode === 'lid') {
      userJid = m.key?.participantAlt || m.participant || m.key?.participant;
    } else {
      userJid = m.key?.participant || m.participant;
    }
  } else {
    userJid = m.key?.remoteJidAlt || m.key?.remoteJid;
  }

  if (!userJid) userJid = normalizeJid(sock.user.id);

  if (userJid.endsWith('@lid')) return userJid;
  return normalizeJid(userJid);
}

/**
 * Resolve the target user JID from a command invocation.
 * Priority: @mention → quoted reply → raw number in args
 *
 * Works in LID-addressed groups — @lid JIDs are passed through lidToJid()
 * for resolution, and group JIDs are always filtered out.
 *
 * @param {object} m        - serialized message
 * @param {object} sock     - Baileys socket
 * @param {string[]} [args] - command arguments (used for raw-number fallback)
 */
export async function getMentionedJids(m, sock, args = []) {
  const chatJid  = m.key?.remoteJid || m.from;
  const mentioned = [];

  // 1. Explicitly @mentioned JIDs (highest priority)
  const msgMentioned = m.msg?.contextInfo?.mentionedJid || [];
  for (const jid of msgMentioned) {
    const resolved = await lidToJid(sock, chatJid, jid);
    mentioned.push(resolved);
  }

  // 2. Quoted / replied-to message sender
  if (!mentioned.length && m.quoted) {
    // Try participant first (raw ctx.participant — most reliable in LID mode),
    // then fall back to computed sender.
    const rawParticipant = m.quoted.participant || m.quoted.sender;
    if (rawParticipant && !rawParticipant.endsWith('@g.us')) {
      const resolved = await lidToJid(sock, chatJid, rawParticipant);
      mentioned.push(resolved);
    }
  }

  // 3. Raw phone number from args  e.g.  "254711111111"  or  "+254 711 111 111"
  if (!mentioned.length && args.length) {
    const num = args[0]?.replace(/\D/g, '');
    if (num && num.length >= 7) {
      mentioned.push(`${num}@s.whatsapp.net`);
    }
  }

  // Deduplicate, remove group JIDs, normalise
  return [...new Set(
    mentioned
      .filter(jid => jid && !jid.endsWith('@g.us'))
      .map(jid => jid.endsWith('@lid') ? jid : normalizeJid(jid))
  )];
}
