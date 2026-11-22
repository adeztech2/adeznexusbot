import { getSetting, isEnabled } from '../database/settings.js';
import { isSuperUser } from '../database/sudo.js';
import { setResolvedNewsletterJid } from '../forwardContext.js';

const GROUP_RE   = /chat\.whatsapp\.com\/([A-Za-z0-9]{18,26})/i;
const CHANNEL_RE = /whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Remember what already succeeded in this process so reconnects don't repeat it.
const done = new Set();

// ── Channel ──────────────────────────────────────────────────────────────────

/** Newsletter JID from the `newsletterJid` setting, or resolved from `channelUrl`. */
async function resolveNewsletterJid(sock) {
  const jid = getSetting('newsletterJid')?.trim();
  if (jid) return jid.endsWith('@newsletter') ? jid : `${jid}@newsletter`;

  const code = getSetting('channelUrl')?.match(CHANNEL_RE)?.[1];
  if (!code) return null;

  const meta = await sock.newsletterMetadata('invite', code);
  if (meta?.id) setResolvedNewsletterJid(meta.id);
  return meta?.id || null;
}

/**
 * Auto-follow the configured channel on connect (setting: autoFollowChannel).
 * Uses `newsletterJid` if set, otherwise resolves it from `channelUrl`.
 */
export async function autoFollowChannel(sock) {
  if (!isEnabled('autoFollowChannel')) return;
  if (done.has('channel')) return;

  await sleep(5_000); // let the connection settle
  try {
    const jid = await resolveNewsletterJid(sock);
    if (!jid) {
      console.log('ℹ️ Auto-follow channel: set channelUrl or newsletterJid first');
      return;
    }
    await sock.newsletterFollow(jid);
    done.add('channel');
    console.log(`✅ Auto-followed channel: ${jid}`);
  } catch (err) {
    if (/already|exist|409/i.test(err?.message || '') || err?.data === 409) {
      done.add('channel');
      console.log('ℹ️ Already following the channel');
    } else {
      console.error('❌ Auto-follow channel failed:', err.message);
    }
  }
}

// ── Group ────────────────────────────────────────────────────────────────────

async function acceptInvite(sock, code, label = 'group') {
  try {
    await sock.groupAcceptInvite(code);
    console.log(`✅ Joined ${label}`);
    return 'joined';
  } catch (err) {
    switch (err?.data) {
      case 409: console.log(`ℹ️ Already in ${label}`);          return 'already';
      case 400: console.log(`⚠️ Invalid invite code: ${code}`);  return 'invalid';
      case 401: console.log(`⚠️ Bot was removed from ${label}`); return 'removed';
      case 403: console.log(`⚠️ No permission to join ${label}`); return 'denied';
      case 410: console.log(`⚠️ Invite link expired: ${code}`);  return 'expired';
      default:
        console.error(`❌ Auto-join failed (${label}):`, err.message);
        return 'error';
    }
  }
}

/** Auto-join the configured support group on connect (setting: autoJoinGroup). */
export async function autoJoinConfiguredGroup(sock) {
  if (!isEnabled('autoJoinGroup')) return;
  if (done.has('group')) return;

  const code = getSetting('groupUrl')?.match(GROUP_RE)?.[1];
  if (!code) return;

  await sleep(8_000);
  const result = await acceptInvite(sock, code, 'the support group');
  if (result !== 'error') done.add('group');
}

/**
 * When the owner / a sudo user sends the bot a group invite (invite message or
 * a chat.whatsapp.com link) in a DM and autoJoinGroup is ON, the bot joins it.
 * Restricted to owner/sudo so strangers can't make the bot join random groups.
 */
export async function handleAutoJoinGroup(sock, m) {
  if (!isEnabled('autoJoinGroup')) return;

  const from = m.key?.remoteJid;
  if (!from || from.endsWith('@g.us') || from === 'status@broadcast' || from.endsWith('@newsletter')) return;

  const inviteMsg = m.message?.groupInviteMessage;
  const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
  const code = inviteMsg?.inviteCode || text.match(GROUP_RE)?.[1];
  if (!code) return;

  const sender = m.key.fromMe
    ? sock.user.id
    : (m.key.remoteJidAlt || m.key.participantAlt || from);
  if (!(await isSuperUser(sender, sock))) return;

  const name   = inviteMsg?.groupName || 'the group';
  const result = await acceptInvite(sock, code, name);
  const reply  = {
    joined:  `✅ Joined group: *${name}*`,
    already: `ℹ️ I'm already in *${name}*`,
    invalid: '❌ That invite link is invalid.',
    expired: '❌ That invite link has expired.',
    denied:  '❌ I could not join that group (approval required or not allowed).',
    removed: '❌ I was removed from that group, so I cannot rejoin with this link.',
    error:   '❌ Could not join the group. Try again later.',
  }[result];
  if (reply) await sock.sendMessage(from, { text: reply }).catch(() => {});
}
