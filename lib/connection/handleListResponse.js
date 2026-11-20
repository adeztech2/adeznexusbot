import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { sendInteractiveMessage } = require('gifted-btns');

import { getUserJid, normalizeJid } from './helper.js';
import { getSetting }               from '../database/settings.js';
import { isSuperUser }              from '../database/sudo.js';

// ── Bot Admin Check ───────────────────────────────────────────────────────────
async function isBotAdminInGroup(sock, groupJid) {
  const botJid = sock.user.id.replace(/:\d+(?=@)/, '');
  const meta   = await sock.groupMetadata(groupJid);
  return {
    isAdmin: meta.participants.some(
      p => (p.phoneNumber === botJid || p.id === botJid) &&
           (p.admin === 'admin' || p.admin === 'superadmin')
    ),
    meta
  };
}

// ── Owner Check ───────────────────────────────────────────────────────────────
async function isOwnerCheck(sock, m) {
  const senderJid = await getUserJid(sock, m);
  return isSuperUser(senderJid, sock);
}

// ── Namespace Registry ────────────────────────────────────────────────────────
const namespaces = new Map();

export function registerListNamespace(name, handler) {
  namespaces.set(name, handler);
}

// ── List Response Handler (legacy listResponseMessage) ────────────────────────
export async function handleListResponse(sock, m) {
  if (m.mtype !== 'listResponseMessage') return;
  if (!await isOwnerCheck(sock, m)) return;

  const selectedRowId = m.msg?.singleSelectReply?.selectedRowId;
  if (!selectedRowId) return;

  const parts     = selectedRowId.split(':');
  const namespace = parts[0];
  const handler   = namespaces.get(namespace);
  if (!handler) return;

  try {
    await handler(sock, m, parts, 'interactive');
  } catch (err) {
    console.error(`[handleListResponse:${namespace}] error:`, err.message);
    await m.reply(`❌ Something went wrong: ${err.message}`);
  }
}

// ── Interactive Response Handler ───────────────────────────────────────────────
export async function handleInteractiveResponse(sock, m) {
  if (m.mtype !== 'interactiveResponseMessage') return;

  const paramsJson = m.msg?.nativeFlowResponseMessage?.paramsJson;
  if (!paramsJson) return;

  let selectedRowId;
  try { selectedRowId = JSON.parse(paramsJson).id; } catch { return; }
  if (!selectedRowId) return;

  const parts     = selectedRowId.split(':');
  const namespace = parts[0];
  const handler   = namespaces.get(namespace);
  if (!handler) return;

  try {
    await handler(sock, m, parts, 'interactive');
  } catch (err) {
    console.error(`[handleInteractiveResponse:${namespace}] error:`, err.message);
    await m.reply(`❌ Something went wrong: ${err.message}`);
  }
}

// ── gsettings Actions ─────────────────────────────────────────────────────────
const FREE_ACTIONS = [
  { id: 'info',  title: 'ℹ️ Group Info',  description: 'Members, admins, description and more' },
  { id: 'leave', title: '🚪 Leave Group', description: 'Bot leaves this group' },
];

const ADMIN_ACTIONS = [
  { id: 'get_link',        title: '🔗 Get Invite Link',         description: 'Fetch the current group invite link' },
  { id: 'reset_link',      title: '🔄 Reset Invite Link',       description: 'Revoke and generate a new invite link' },
  { id: 'open',            title: '🔓 Open Group',              description: 'Allow anyone to send messages' },
  { id: 'close',           title: '🔒 Close Group',             description: 'Restrict to admins only' },
  { id: 'ephemeral_off',   title: '💨 Disappearing: Off',       description: 'Disable disappearing messages' },
  { id: 'ephemeral_24h',   title: '💨 Disappearing: 24 Hours',  description: 'Set disappearing messages to 24 hours' },
  { id: 'ephemeral_7d',    title: '💨 Disappearing: 7 Days',    description: 'Set disappearing messages to 7 days' },
  { id: 'ephemeral_90d',   title: '💨 Disappearing: 90 Days',   description: 'Set disappearing messages to 90 days' },
  { id: 'memberadd_all',   title: '👥 Member Add: All',         description: 'Allow all members to add others' },
  { id: 'memberadd_admin', title: '👥 Member Add: Admins Only', description: 'Only admins can add members' },
  { id: 'approval_on',     title: '✅ Join Approval: On',       description: 'Require approval to join' },
  { id: 'approval_off',    title: '✅ Join Approval: Off',      description: 'Anyone can join without approval' },
  { id: 'kill',            title: '💀 Kill Group',              description: 'Remove all non-admin participants' },
];

const EPHEMERAL_MAP = {
  ephemeral_off: 0,
  ephemeral_24h: 86400,
  ephemeral_7d:  604800,
  ephemeral_90d: 7776000,
};

const ADMIN_REQUIRED = new Set([
  'get_link', 'reset_link', 'open', 'close',
  'ephemeral_off', 'ephemeral_24h', 'ephemeral_7d', 'ephemeral_90d',
  'memberadd_all', 'memberadd_admin', 'approval_on', 'approval_off', 'kill'
]);

async function sendActionMenu(sock, m, meta, groupJid, isAdmin) {
  const jid = m.from;

  const freeSectionRows = FREE_ACTIONS.map(a => ({
    id:          `gsettings2:exec:${a.id}:${groupJid}`,
    title:       a.title,
    description: a.description
  }));

  const adminSectionRows = isAdmin
    ? ADMIN_ACTIONS.map(a => ({
        id:          `gsettings2:exec:${a.id}:${groupJid}`,
        title:       a.title,
        description: a.description
      }))
    : ADMIN_ACTIONS.map(a => ({
        id:          `gsettings2:noadmin:${groupJid}`,
        title:       a.title,
        description: '⚠️ Bot is not admin'
      }));

  await sendInteractiveMessage(sock, jid, {
    text:   `⚙️ *${meta.subject}*\n${isAdmin ? '✅ Bot is admin in this group.' : '⚠️ Bot is not admin — some actions unavailable.'}`,
    footer: 'gsettings | select action',
    interactiveButtons: [{
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
        title: 'Choose action',
        sections: [
          { title: '✅ Available',                                            rows: freeSectionRows },
          { title: isAdmin ? '🛡️ Admin Actions' : '🔒 Requires Bot Admin', rows: adminSectionRows }
        ]
      })
    }]
  }, { quoted: m });
}

async function gsettingsHandler(sock, m, parts) {
  const stage = parts[1];

  if (stage === 'actions') {
    const groupJid = parts[2];
    if (!groupJid) return m.reply('❌ Invalid group reference.');
    let meta, isAdmin;
    try { ({ isAdmin, meta } = await isBotAdminInGroup(sock, groupJid)); }
    catch { return m.reply('❌ Could not fetch group info.'); }
    await sendActionMenu(sock, m, meta, groupJid, isAdmin);
  }

  else if (stage === 'noadmin') {
    await m.reply('⚠️ Bot is not admin in this group. This action is unavailable.');
  }

  else if (stage === 'exec') {
    const action   = parts[2];
    const groupJid = parts[3];
    if (!action || !groupJid) return m.reply('❌ Malformed action payload.');

    let meta, isAdmin;
    try { ({ isAdmin, meta } = await isBotAdminInGroup(sock, groupJid)); }
    catch { return m.reply('❌ Could not fetch group metadata.'); }

    if (ADMIN_REQUIRED.has(action) && !isAdmin) {
      return m.reply(`❌ Bot is not admin in *${meta.subject}*. Cannot execute this action.`);
    }

    switch (action) {
      case 'get_link': {
        const code = await sock.groupInviteCode(groupJid);
        await m.reply(`🔗 *Invite Link for ${meta.subject}*\nhttps://chat.whatsapp.com/${code}`);
        break;
      }
      case 'reset_link': {
        await sock.groupRevokeInvite(groupJid);
        const newCode = await sock.groupInviteCode(groupJid);
        await m.reply(`🔄 *New Invite Link for ${meta.subject}*\nhttps://chat.whatsapp.com/${newCode}`);
        break;
      }
      case 'open': {
        if (!meta.announce) return m.reply(`ℹ️ *${meta.subject}* is already open.`);
        await sock.groupSettingUpdate(groupJid, 'not_announcement');
        await m.reply(`🔓 *${meta.subject}* is now open.`);
        break;
      }
      case 'close': {
        if (meta.announce) return m.reply(`ℹ️ *${meta.subject}* is already closed.`);
        await sock.groupSettingUpdate(groupJid, 'announcement');
        await m.reply(`🔒 *${meta.subject}* is now closed (admins only).`);
        break;
      }
      case 'ephemeral_off':
      case 'ephemeral_24h':
      case 'ephemeral_7d':
      case 'ephemeral_90d': {
        const duration = EPHEMERAL_MAP[action];
        if (meta.ephemeralDuration === duration) {
          const label = duration === 0 ? 'off' : action.replace('ephemeral_', '');
          return m.reply(`ℹ️ Disappearing messages is already set to *${label}* in *${meta.subject}*.`);
        }
        await sock.groupToggleEphemeral(groupJid, duration);
        const label = duration === 0 ? 'off' : action.replace('ephemeral_', '');
        await m.reply(`💨 Disappearing messages set to *${label}* in *${meta.subject}*.`);
        break;
      }
      case 'memberadd_all': {
        if (meta.memberAddMode === true) return m.reply(`ℹ️ Member add mode is already *all members* in *${meta.subject}*.`);
        await sock.groupMemberAddMode(groupJid, 'all_member_add');
        await m.reply(`👥 *${meta.subject}*: All members can now add others.`);
        break;
      }
      case 'memberadd_admin': {
        if (meta.memberAddMode === false) return m.reply(`ℹ️ Member add mode is already *admins only* in *${meta.subject}*.`);
        await sock.groupMemberAddMode(groupJid, 'admin_add');
        await m.reply(`👥 *${meta.subject}*: Only admins can now add members.`);
        break;
      }
      case 'approval_on': {
        if (meta.joinApprovalMode === true) return m.reply(`ℹ️ Join approval is already *ON* in *${meta.subject}*.`);
        await sock.groupJoinApprovalMode(groupJid, 'on');
        await m.reply(`✅ Join approval is now *ON* in *${meta.subject}*.`);
        break;
      }
      case 'approval_off': {
        if (meta.joinApprovalMode === false) return m.reply(`ℹ️ Join approval is already *OFF* in *${meta.subject}*.`);
        await sock.groupJoinApprovalMode(groupJid, 'off');
        await m.reply(`✅ Join approval is now *OFF* in *${meta.subject}*.`);
        break;
      }
      case 'info': {
        const admins  = meta.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').length;
        const members = meta.size || meta.participants.length;
        const desc    = meta.desc || 'No description set.';
        const ephem   = meta.ephemeralDuration
          ? meta.ephemeralDuration === 86400   ? '24 hours'
          : meta.ephemeralDuration === 604800  ? '7 days'
          : meta.ephemeralDuration === 7776000 ? '90 days'
          : `${meta.ephemeralDuration}s`
          : 'Off';
        await m.reply(
          `ℹ️ *${meta.subject}*\n\n` +
          `👥 Members: ${members}\n` +
          `🛡️ Admins: ${admins}\n` +
          `🤖 Bot is admin: ${isAdmin ? 'Yes ✅' : 'No ❌'}\n` +
          `🔒 Closed: ${meta.announce ? 'Yes' : 'No'}\n` +
          `✅ Join approval: ${meta.joinApprovalMode ? 'On' : 'Off'}\n` +
          `👥 Member add mode: ${meta.memberAddMode ? 'All members' : 'Admins only'}\n` +
          `💨 Disappearing: ${ephem}\n` +
          `📝 Description:\n${desc}`
        );
        break;
      }
      case 'leave': {
        await m.reply(`🚪 Leaving *${meta.subject}*...`);
        await sock.groupLeave(groupJid);
        break;
      }
      case 'kill': {
        const botJidClean = normalizeJid(sock.user.id);
        const toRemove    = meta.participants
          .filter(p => (p.phoneNumber || p.id) !== botJidClean)
          .map(p => p.phoneNumber || p.id);
        if (toRemove.length === 0) return m.reply(`ℹ️ No members to remove in *${meta.subject}*.`);
        await sock.groupParticipantsUpdate(groupJid, toRemove, 'remove');
        await m.reply(`💀 Removed ${toRemove.length} member(s) from *${meta.subject}*.`);
        break;
      }
      default:
        await m.reply(`❓ Unknown action: *${action}*`);
    }
  }

  else {
    await m.reply('❓ Unknown gsettings stage.');
  }
}

registerListNamespace('gsettings',  gsettingsHandler);
registerListNamespace('gsettings2', gsettingsHandler);
