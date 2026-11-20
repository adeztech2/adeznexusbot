import { getMentionedJids } from '../../lib/connection/helper.js';

export default {
  name:        'demote',
  aliases:     [],
  description: 'Demote admin to member',
  usage:       '!demote @user  |  reply to message  |  !demote 254711111111',
  category:    'group',
  owner:       false,
  group:       true,
  private:     false,
  admin:       true,
  botAdmin:    true,

  async execute(sock, m, args) {
    try {
      const mentioned = await getMentionedJids(m, sock, args);

      if (!mentioned.length) {
        return m.reply('❌ Please @mention a user, reply to their message, or provide their number!\n\nExample: !demote @user');
      }

      for (const jid of mentioned) {
        await sock.groupParticipantsUpdate(m.from, [jid], 'demote');
      }

      const mentionText = mentioned.map(jid => `@${jid.split('@')[0]}`).join(', ');

      await sock.sendMessage(m.from, {
        text:     `✅ *Demoted from Admin*\n\n${mentionText} has been demoted from group admin!`,
        mentions: mentioned,
      }, { quoted: m });

    } catch (err) {
      console.error('Error demoting user:', err);
      throw new Error('Failed to demote user. Make sure they are in the group!');
    }
  },
};
