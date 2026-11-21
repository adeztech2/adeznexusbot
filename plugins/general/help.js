import { getCommands } from '../../lib/connection/commandHandler.js';
import { getSetting }  from '../../lib/database/settings.js';

const CAT_ICONS = {
  general: '🎯',
  groups:  '👥',
  media:   '🎵',
  owner:   '🔐',
  misc:    '📦',
};

const more     = String.fromCharCode(8206);
const readmore = more.repeat(4001);

export default {
  name:        'help',
  aliases:     ['menu', 'commands'],
  description: 'Show all available commands',
  usage:       'help [command]',
  category:    'general',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const PREFIX   = getSetting('prefix') || '.';
    const BOT_NAME = getSetting('botName') || 'ADEZ NEXUS';
    const TZ       = getSetting('timezone') || 'Africa/Nairobi';
    const MODE     = getSetting('mode') || 'private';
    const commands = getCommands();
    const userName = m.pushName || 'User';

    if (args[0]) {
      const cmd = commands.get(args[0].toLowerCase());
      if (!cmd) return m.reply(`❌ Command *${args[0]}* not found.\nType *${PREFIX}help* to see all commands.`);

      return m.reply(
        `📖 *COMMAND INFO*\n\n` +
        `▸ *Name:* ${cmd.name}\n` +
        `▸ *Description:* ${cmd.description}\n` +
        `▸ *Usage:* ${PREFIX}${cmd.usage}\n` +
        `▸ *Category:* ${cmd.category}` +
        (cmd.aliases?.length ? `\n▸ *Aliases:* ${cmd.aliases.join(', ')}` : '')
      );
    }

    const categories = {};
    let totalCmds = 0;

    commands.forEach((cmd, name) => {
      if (name !== cmd.name) return;
      const cat = cmd.category || 'misc';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd.name);
      totalCmds++;
    });

    const now  = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ });

    let text =
      `🐼 *${BOT_NAME.toUpperCase()} v1.0.0*\n` +
      `─────────────────\n` +
      `👤 *User:* ${userName}\n` +
      `🔑 *Prefix:* \`${PREFIX}\`\n` +
      `🌐 *Mode:* ${MODE === 'private' ? 'Private' : 'Public'}\n` +
      `🕐 *Time:* ${time}\n` +
      `📦 *Commands:* ${totalCmds}\n` +
      readmore + '\n';

    for (const cat of Object.keys(categories).sort()) {
      const icon  = CAT_ICONS[cat] || '📦';
      const cmds  = categories[cat].sort();
      const count = cmds.length;

      text += `${icon} *${cat.toUpperCase()}* [${count}]\n`;
      text += cmds.map(c => `  ╺ ${PREFIX}${c}`).join('\n');
      text += '\n\n';
    }

    m.reply(text.trimEnd());
  },
};
