import { getMentionedJids } from '../../lib/connection/helper.js';
import { getGroupSettings } from '../../lib/database/groupSettings.js';
import { numOf } from '../../lib/utils/groupUtils.js';

export default {
  name:        'warns',
  aliases:     ['warnlist', 'checkwarn'],
  description: "Show a member's warnings, or everyone's if no user is given",
  usage:       'warns [@user]',
  category:    'group',
  owner:       false,
  group:       true,
  private:     false,
  admin:       true,
  botAdmin:    false,

  async execute(sock, m, args) {
    const s = await getGroupSettings(m.from);
    const targets = await getMentionedJids(m, sock, args);

    if (targets.length) {
      const jid   = targets[0];
      const count = s.warns[numOf(jid)] || 0;
      return sock.sendMessage(m.from, {
        text: `⚠️ @${numOf(jid)} has *${count}/${s.warnLimit}* warnings.`,
        mentions: [jid],
      }, { quoted: m });
    }

    const entries = Object.entries(s.warns).filter(([, c]) => c > 0);
    if (!entries.length) return m.reply('✅ Nobody has any warnings in this group.');

    const mentions = entries.map(([num]) => `${num}@s.whatsapp.net`);
    const lines    = entries.map(([num, c]) => `• @${num} — ${c}/${s.warnLimit}`);

    return sock.sendMessage(m.from, {
      text: `⚠️ *Warnings*\n\n${lines.join('\n')}`,
      mentions,
    }, { quoted: m });
  },
};
