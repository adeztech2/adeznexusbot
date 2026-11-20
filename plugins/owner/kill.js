import { normalizeJid } from '../../lib/connection/helper.js';

export default {
  name:        'kill',
  aliases:     ['removeall', 'kickall'],
  description: 'Remove all members from current group at once',
  usage:       'kill',
  category:    'owner',
  owner:       true,
  group:       true,
  private:     false,
  admin:       false,
  botAdmin:    true,

  async execute(sock, m) {
    await m.react('⚠️');

    const groupMetadata = await sock.groupMetadata(m.from);
    const botJid        = normalizeJid(sock.user.id);

    const membersToRemove = groupMetadata.participants
      .map(p => normalizeJid(p.phoneNumber))
      .filter(jid => jid && jid !== botJid);

    if (!membersToRemove.length) return m.reply('❌ No members to remove!');

    await m.reply(`⚠️ Terminating group — removing ${membersToRemove.length} members now!`);
    await new Promise(r => setTimeout(r, 2000));

    try { await sock.removeProfilePicture(m.from); }      catch {}
    try { await sock.groupSettingUpdate(m.from, 'announcement'); } catch {}
    try { await sock.groupUpdateDescription(m.from, 'TERMINATED [ 💀 ]'); } catch {}
    try { await sock.groupUpdateSubject(m.from, 'TERMINATED [ GIFTED ]'); } catch {}

    await new Promise(r => setTimeout(r, 1000));

    try {
      await sock.sendMessage(m.from, {
        text: '💀 Group marked for deletion — all members will be purged NOW!',
        mentions: membersToRemove,
      });
    } catch {}

    await new Promise(r => setTimeout(r, 2000));

    const result = await sock.groupParticipantsUpdate(m.from, membersToRemove, 'remove');
    const ok     = result.filter(r => r.status === '200' || r.status === 200).length;

    await m.reply(`✅ *GROUP TERMINATED*\n${ok}/${membersToRemove.length} members removed.`);
    await m.react('💀');
  },
};
