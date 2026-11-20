import { getSetting, isEnabled } from '../database/settings.js';

/**
 * Auto-follow a configured newsletter/channel JID on connection open.
 * Also follows any newsletter JID from which the bot receives a message
 * (i.e. when the bot has been invited/mentioned in a channel) if enabled.
 */
export async function autoFollowChannel(sock) {
  if (!isEnabled('autoFollowChannel')) return;

  const newsletterJid = getSetting('newsletterJid')?.trim();
  if (!newsletterJid) return;

  try {
    await sock.newsletterFollow(newsletterJid);
    console.log(`✅ Auto-followed channel: ${newsletterJid}`);
  } catch (err) {
    console.error(`❌ Auto-follow channel failed (${newsletterJid}):`, err.message);
  }
}

/**
 * Handle auto-joining groups from incoming groupInviteMessage in DMs.
 * When someone sends a group invite link to the bot and autoJoinGroup is ON,
 * the bot automatically accepts the invite.
 *
 * Also handles channel follow-back: if bot receives a message from a newsletter
 * JID it hasn't followed yet, and autoFollowChannel is enabled, it follows back.
 */
export async function handleAutoJoinGroup(sock, m) {
  // ── Group invite message auto-join ────────────────────────────────────────
  const inviteMsg = m.message?.groupInviteMessage;
  if (inviteMsg && isEnabled('autoJoinGroup')) {
    const from = m.key.remoteJid;
    // Only auto-join from DMs (not from groups to avoid abuse)
    if (!from?.endsWith('@g.us')) {
      const code = inviteMsg.inviteCode;
      if (code) {
        try {
          await sock.groupAcceptInvite(code);
          // Notify the sender that bot joined
          await sock.sendMessage(from, {
            text: `✅ Joined group: *${inviteMsg.groupName || 'the group'}*`
          });
        } catch (err) {
          switch (err?.data) {
            case 409:
              console.log(`ℹ️ Already in group: ${inviteMsg.groupName}`);
              break;
            case 400:
              console.log(`⚠️ Invalid invite code: ${code}`);
              break;
            case 403:
              console.log(`⚠️ No permission to join: ${inviteMsg.groupName}`);
              break;
            default:
              console.error(`❌ Auto-join group failed (${code}):`, err.message);
          }
        }
      }
    }
  }
}
