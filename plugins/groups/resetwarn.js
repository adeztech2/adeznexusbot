import { getMentionedJids } from '../../lib/connection/helper.js';
import { updateGroupSettings } from '../../lib/database/groupSettings.js';
import { numOf } from '../../lib/utils/groupUtils.js';

export default {
  name:        'resetwarn',
  aliases:     ['unwarn', 'clearwarn'],
  description: "Clear a member's warnings, or everyone's with 'all'",
  usage:       'resetwarn @user  |  resetwarn all',
  category:    'group',
  owner:       false,
  group:       true,
  private:     false,
  admin:       true,
  botAdmin:    false,

  async execute(sock, m, args) {
    if ((args[0] || '').toLowerCase() === 'all') {
      await updateGroupSettings(m.from, s => { s.warns = {}; });
      return m.reply('✅ All warnings in this group have been cleared.');
    }

    const targets = await getMentionedJids(m, sock, args);
    if (!targets.length) {
      return m.reply('❌ @mention a user, reply to their message, or use: resetwarn all');
    }

    const jid = targets[0];
    await updateGroupSettings(m.from, s => { delete s.warns[numOf(jid)]; });

    return sock.sendMessage(m.from, {
      text: `✅ Warnings cleared for @${numOf(jid)}.`,
      mentions: [jid],
    }, { quoted: m });
  },
};
