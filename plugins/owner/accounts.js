import { getMentionedJids } from '../../lib/connection/helper.js';
import { parseInviteCode } from '../../lib/utils/extra.js';

const numOf = (jid = '') => jid.split('@')[0].split(':')[0];

async function targets(m, sock, args) {
  const found = await getMentionedJids(m, sock, args);
  if (found.length) return found;
  return m.isGroup ? [] : [m.from];            // in a private chat: the person you are chatting with
}

const isSelf = (sock, jid) => numOf(jid) === numOf(sock.user?.id) || numOf(jid) === numOf(sock.user?.lid);

function blockCmd(name, aliases, action, doneText) {
  return {
    name,
    aliases,
    description: `${action === 'block' ? 'Block' : 'Unblock'} a number`,
    usage: `${name} @user | reply | 254711111111 | (in private chat: just ${name})`,
    category: 'owner',
    owner: true,
    group: false,
    private: false,

    async execute(sock, m, args) {
      const list = await targets(m, sock, args);
      if (!list.length) return m.reply(`❌ Mention someone, reply to them, or give a number.\n\nExample: .${name} 254711111111`);

      const done = [];
      let skippedSelf = false;
      for (const jid of list) {
        if (isSelf(sock, jid)) { skippedSelf = true; continue; }
        try {
          await sock.updateBlockStatus(jid, action);
          done.push(`@${numOf(jid)}`);
        } catch (e) {
          console.error(`${name} failed:`, e.message);
        }
      }
      if (!done.length) {
        if (skippedSelf) return m.reply('❌ I will not do that to my own number.');
        throw new Error(`Could not ${action} that number.`);
      }
      return sock.sendMessage(m.from, { text: `${doneText} ${done.join(', ')}`, mentions: list }, { quoted: m });
    },
  };
}

export default [
  blockCmd('block', ['blockuser'], 'block', '🚫 Blocked'),
  blockCmd('unblock', ['unblockuser'], 'unblock', '✅ Unblocked'),

  {
    name: 'blocklist',
    aliases: ['blocked'],
    description: 'Show blocked numbers',
    usage: 'blocklist',
    category: 'owner',
    owner: true,
    group: false,
    private: false,

    async execute(sock, m) {
      const list = (await sock.fetchBlocklist()) || [];
      if (!list.length) return m.reply('✅ No blocked numbers.');
      const shown = list.slice(0, 50).map((j, i) => `${i + 1}. +${numOf(j)}`);
      const more = list.length > 50 ? `\n…and ${list.length - 50} more` : '';
      return m.reply(`🚫 *Blocked numbers (${list.length})*\n\n${shown.join('\n')}${more}`);
    },
  },

  {
    name: 'setbio',
    aliases: ['setabout', 'setstatustext'],
    description: 'Change the bot\'s WhatsApp bio (About)',
    usage: 'setbio your new bio',
    category: 'owner',
    owner: true,
    group: false,
    private: false,

    async execute(sock, m, args) {
      const text = args.join(' ').trim() || m.quoted?.body || '';
      if (!text) return m.reply('❌ Give me the new bio.\n\nExample: .setbio ADEZ NEXUS is online');
      if (text.length > 139) return m.reply('❌ WhatsApp bios are limited to 139 characters.');
      await sock.updateProfileStatus(text);
      return m.reply('✅ Bio updated.');
    },
  },

  {
    name: 'join',
    aliases: ['joingroup'],
    description: 'Join a group from an invite link',
    usage: 'join https://chat.whatsapp.com/XXXX  (or reply to a link)',
    category: 'owner',
    owner: true,
    group: false,
    private: false,

    async execute(sock, m, args) {
      const code = parseInviteCode(args.join(' ')) || parseInviteCode(m.quoted?.body || '');
      if (!code) return m.reply('❌ Send a group invite link, or reply to one.\n\nExample: .join https://chat.whatsapp.com/XXXXXXXXXX');
      try {
        await sock.groupAcceptInvite(code);
        return m.reply('✅ Joined the group.');
      } catch (e) {
        const msg = String(e?.message || '');
        if (/already|409/i.test(msg)) return m.reply('ℹ️ I am already in that group.');
        if (/gone|expired|revoked|410|404|not-authorized|401/i.test(msg)) return m.reply('❌ That invite link is invalid or has been reset.');
        if (/approval|request|403/i.test(msg)) return m.reply('📨 That group needs admin approval. A join request was sent.');
        throw new Error('Could not join that group.');
      }
    },
  },

  {
    name: 'groups',
    aliases: ['mygroups', 'gclist'],
    description: 'List the groups the bot is in',
    usage: 'groups',
    category: 'owner',
    owner: true,
    group: false,
    private: false,

    async execute(sock, m) {
      const all = Object.values(await sock.groupFetchAllParticipating());
      if (!all.length) return m.reply('ℹ️ I am not in any groups.');
      all.sort((a, b) => (b.participants?.length || 0) - (a.participants?.length || 0));
      const lines = all.slice(0, 40).map((g, i) => `${i + 1}. ${g.subject || 'Unnamed'} (${g.participants?.length || 0})`);
      const more = all.length > 40 ? `\n…and ${all.length - 40} more` : '';
      return m.reply(`👥 *Groups (${all.length})*\n\n${lines.join('\n')}${more}`);
    },
  },
];
