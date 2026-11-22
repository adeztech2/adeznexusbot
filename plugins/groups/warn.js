import { getMentionedJids } from '../../lib/connection/helper.js';
import { isAdmin } from '../../lib/connection/commandHandler.js';
import { isSuperUser } from '../../lib/database/sudo.js';
import { applyWarn } from '../../lib/groupGuard.js';
import { numOf } from '../../lib/utils/groupUtils.js';

export default {
  name:        'warn',
  aliases:     [],
  description: 'Warn a member — they are removed when they reach the warn limit',
  usage:       'warn @user [reason]  |  reply to a message with: warn [reason]',
  category:    'group',
  owner:       false,
  group:       true,
  private:     false,
  admin:       true,
  botAdmin:    true,

  async execute(sock, m, args) {
    const targets = await getMentionedJids(m, sock, args);
    if (!targets.length) {
      return m.reply('❌ @mention a user or reply to their message.\n\nExample: warn @user spamming');
    }

    const target = targets[0];

    if (numOf(target) === numOf(sock.user?.id)) return m.reply('❌ I cannot warn myself.');
    if (await isAdmin(sock, { key: { remoteJid: m.from }, sender: target })) {
      return m.reply('❌ You cannot warn a group admin.');
    }
    if (await isSuperUser(target, sock)) return m.reply('❌ You cannot warn the bot owner.');

    // Everything that isn't the @mention or a phone number is the reason.
    const reason = args
      .filter(a => !a.startsWith('@') && !/^\+?\d{7,}$/.test(a))
      .join(' ')
      .trim() || 'No reason given';

    await applyWarn(sock, m.from, target, reason, m);
  },
};
