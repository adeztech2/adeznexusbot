import { getGroupSettings, updateGroupSettings } from './database/groupSettings.js';
import { isAdmin, isBotAdmin } from './connection/commandHandler.js';
import { isSuperUser } from './database/sudo.js';
import { metadataCache } from './connection/metadataCache.js';
import {
  containsLink, renderTemplate, numOf,
  DEFAULT_WELCOME, DEFAULT_GOODBYE,
} from './utils/groupUtils.js';

/**
 * Add a warning. Removes the user when they reach the group's warn limit.
 * Returns { count, limit, kicked }.
 */
export async function applyWarn(sock, groupJid, userJid, reason = 'No reason given', quoted) {
  const key = numOf(userJid);
  let count = 0;
  let limit = 3;

  await updateGroupSettings(groupJid, s => {
    limit = s.warnLimit;
    count = (s.warns[key] || 0) + 1;
    s.warns[key] = count;
  });

  const opts = quoted ? { quoted } : {};
  const tag  = `@${key}`;

  if (count >= limit) {
    try {
      await sock.groupParticipantsUpdate(groupJid, [userJid], 'remove');
      await updateGroupSettings(groupJid, s => { delete s.warns[key]; });
      await sock.sendMessage(groupJid, {
        text: `🚫 *Warn limit reached*\n\n${tag} got ${count}/${limit} warnings and was removed.\nReason: ${reason}`,
        mentions: [userJid],
      }, opts);
      return { count, limit, kicked: true };
    } catch {
      await sock.sendMessage(groupJid, {
        text: `⚠️ ${tag} reached ${count}/${limit} warnings but I couldn't remove them. Make sure I'm an admin.`,
        mentions: [userJid],
      }, opts);
      return { count, limit, kicked: false };
    }
  }

  await sock.sendMessage(groupJid, {
    text: `⚠️ *Warning ${count}/${limit}*\n\n${tag}\nReason: ${reason}`,
    mentions: [userJid],
  }, opts);
  return { count, limit, kicked: false };
}

/** Called for every fresh serialized message. Cheap no-op unless antilink is enabled for the group. */
export async function handleAntiLink(sock, m) {
  if (!m.isGroup || m.fromMe || !m.body) return;

  const s = await getGroupSettings(m.from);
  if (!s.antilink.enabled) return;
  if (!containsLink(m.body, s.antilink.type)) return;

  const sender = m.sender;
  if (!sender) return;

  if (!(await isBotAdmin(sock, m))) return;          // can't enforce without admin rights
  if (await isAdmin(sock, m)) return;                // admins may post links
  if (await isSuperUser(sender, sock)) return;       // owner / sudo too

  try { await sock.sendMessage(m.from, { delete: m.key }); } catch {}

  const { action } = s.antilink;
  const tag = `@${numOf(sender)}`;

  if (action === 'warn') {
    await applyWarn(sock, m.from, sender, 'Posting links');
  } else if (action === 'kick') {
    try {
      await sock.groupParticipantsUpdate(m.from, [sender], 'remove');
      await sock.sendMessage(m.from, {
        text: `🚫 ${tag} was removed for posting a link.`,
        mentions: [sender],
      });
    } catch {}
  } else {
    await sock.sendMessage(m.from, {
      text: `🚫 ${tag}, links are not allowed in this group.`,
      mentions: [sender],
    });
  }
}

/** Handles the 'group-participants.update' event for welcome / goodbye messages. */
export async function handleParticipantsUpdate(sock, { id, participants, action }) {
  if (action !== 'add' && action !== 'remove') return;

  const s   = await getGroupSettings(id);
  const cfg = action === 'add' ? s.welcome : s.goodbye;
  if (!cfg.enabled) return;

  let meta = null;
  try { meta = await metadataCache.get(sock, id); } catch {}

  const botNum = numOf(sock.user?.id);
  const tpl    = cfg.text || (action === 'add' ? DEFAULT_WELCOME : DEFAULT_GOODBYE);

  for (const p of participants || []) {
    // Newer Baileys gives objects ({ id, phoneNumber, ... }); older versions give plain strings.
    const jid = typeof p === 'string' ? p : (p.phoneNumber || p.id);
    if (!jid) continue;
    if (action === 'add' && numOf(jid) === botNum) continue;

    const text = renderTemplate(tpl, {
      jid,
      group: meta?.subject || '',
      count: meta?.participants?.length ?? '',
      desc:  meta?.desc || '',
    });

    try {
      let sent = false;
      if (action === 'add') {
        try {
          const url = await sock.profilePictureUrl(jid, 'image');
          await sock.sendMessage(id, { image: { url }, caption: text, mentions: [jid] });
          sent = true;
        } catch {}
      }
      if (!sent) await sock.sendMessage(id, { text, mentions: [jid] });
    } catch (err) {
      console.error(`[${action === 'add' ? 'welcome' : 'goodbye'}] send failed:`, err.message);
    }
  }
}
