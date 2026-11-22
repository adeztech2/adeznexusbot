import { numOf } from '../../lib/utils/groupUtils.js';

const base = { category: 'group', owner: false, group: true, private: false, aliases: [] };

const isAdmin = (p) => p.admin === 'admin' || p.admin === 'superadmin';

const realJid = (p) => {
  const jid = p.id || p.jid || '';
  if (jid.endsWith('@s.whatsapp.net')) return jid;
  if (p.phoneNumber) return `${String(p.phoneNumber).replace(/\D/g, '')}@s.whatsapp.net`;
  return null;
};

export default [
  {
    ...base,
    name: 'groupinfo',
    aliases: ['ginfo', 'gcinfo'],
    description: 'Show details about this group',
    usage: 'groupinfo',
    async execute(sock, m) {
      const meta = await sock.groupMetadata(m.from);
      const admins = meta.participants.filter(isAdmin);
      const created = meta.creation ? new Date(meta.creation * 1000).toISOString().slice(0, 10) : 'unknown';
      const owner = meta.owner || meta.subjectOwner || '';
      const desc = (meta.desc || '').trim();

      let text =
        `👥 *${meta.subject}*\n\n` +
        `🆔 ${meta.id}\n` +
        `📅 Created: ${created}\n` +
        `👤 Members: ${meta.participants.length}\n` +
        `🛡️ Admins: ${admins.length}\n` +
        `💬 Who can send: ${meta.announce ? 'admins only' : 'everyone'}\n` +
        `✏️ Who can edit info: ${meta.restrict ? 'admins only' : 'everyone'}`;
      if (owner && owner.endsWith('@s.whatsapp.net')) text += `\n👑 Creator: +${numOf(owner)}`;
      if (desc) text += `\n\n📝 *Description*\n${desc.length > 700 ? desc.slice(0, 700) + '…' : desc}`;
      return m.reply(text);
    },
  },
  {
    ...base,
    name: 'adminlist',
    aliases: ['listadmins', 'whoadmin'],
    description: 'List the admins of this group (without tagging them)',
    usage: 'adminlist',
    async execute(sock, m) {
      const meta = await sock.groupMetadata(m.from);
      const admins = meta.participants.filter(isAdmin);
      if (!admins.length) return m.reply('❌ No admins found in this group.');
      const lines = admins.map((p, i) => {
        const jid = realJid(p);
        const label = jid ? `+${numOf(jid)}` : 'hidden number';
        return `${i + 1}. ${label}${p.admin === 'superadmin' ? ' 👑' : ''}`;
      });
      return m.reply(`🛡️ *Admins of ${meta.subject}* (${admins.length})\n\n${lines.join('\n')}`);
    },
  },
  {
    ...base,
    name: 'setdesc',
    aliases: ['gdesc', 'setdescription'],
    description: 'Change the group description',
    usage: 'setdesc <new description>',
    admin: true,
    botAdmin: true,
    async execute(sock, m, args) {
      const text = (m.body || '').trim().replace(/^\S+\s*/, '') || m.quoted?.text || '';
      if (!text) return m.reply('❌ Send the new description.\n\nExample: setdesc Welcome to our group!');
      if (text.length > 2048) return m.reply('❌ The description is too long (max 2048 characters).');
      try {
        await sock.groupUpdateDescription(m.from, text);
        return m.reply('✅ Group description updated.');
      } catch (err) {
        console.error('setdesc failed:', err);
        return m.reply('❌ Could not update the description.');
      }
    },
  },
];
