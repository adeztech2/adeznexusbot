import { getGroupSettings, updateGroupSettings } from '../../lib/database/groupSettings.js';

export default {
  name:        'warnlimit',
  aliases:     ['setwarn'],
  description: 'Set how many warnings get a member removed (1–20)',
  usage:       'warnlimit <number>',
  category:    'group',
  owner:       false,
  group:       true,
  private:     false,
  admin:       true,
  botAdmin:    false,

  async execute(sock, m, args) {
    if (!args[0]) {
      const { warnLimit } = await getGroupSettings(m.from);
      return m.reply(`⚠️ Current warn limit: *${warnLimit}*\n\nChange it with: warnlimit <1-20>`);
    }

    const n = parseInt(args[0], 10);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      return m.reply('❌ Enter a number between 1 and 20.');
    }

    await updateGroupSettings(m.from, s => { s.warnLimit = n; });
    return m.reply(`✅ Warn limit set to *${n}*.`);
  },
};
