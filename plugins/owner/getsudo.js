import { getSudoNumbers } from '../../lib/database/sudo.js';

export default {
  name:        'getsudo',
  aliases:     ['getsudos', 'listsudo', 'listsudos'],
  description: 'List all sudo users',
  usage:       'getsudo',
  category:    'owner',
  owner:       true,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const list = await getSudoNumbers();

    if (!list.length) {
      return m.reply('⚠️ No sudo users added yet.\nUse .setsudo 254712345678 to add one.');
    }

    let msg = '*👑 SUDO USERS*\n\n';
    list.forEach((num, i) => {
      msg += `${i + 1}. wa.me/${num}\n`;
    });
    msg += `\n*Total: ${list.length}*`;

    return m.reply(msg);
  },
};
