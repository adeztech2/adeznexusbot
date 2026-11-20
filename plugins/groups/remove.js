import { getMentionedJids } from '../../lib/connection/helper.js';

export default {
  name:        'remove',
  aliases:     ['kick', 'k'],
  description: 'Remove member from group',
  usage:       '!remove @user  |  reply to message  |  !remove 254711111111',
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
        return m.reply('❌ Please @mention a user, reply to their message, or provide their number!\n\nExample: !remove @user');
      }

      for (const jid of mentioned) {
        await sock.groupParticipantsUpdate(m.from, [jid], 'remove');
      }

      const mentionText = mentioned.map(jid => `@${jid.split('@')[0]}`).join(', ');

      await sock.sendMessage(m.from, {
        text:     `${mentionText} has been removed!`,
        mentions: mentioned,
      }, { quoted: m });

    } catch (err) {
      console.error('Error removing user:', err);
      throw new Error('Failed to remove user. Make sure they are in the group!');
    }
  },
};
