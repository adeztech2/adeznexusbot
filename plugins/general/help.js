import { getCommands } from '../../lib/connection/commandHandler.js';
import { getSetting }  from '../../lib/database/settings.js';

const CAT_ICONS = {
  general: '🎯',
  groups:  '👥',
  group:   '👥',
  tools:   '🛠️',
  fun:     '🎉',
  devtools:'💻',
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

    if (args[0]) {
      const cmd = commands.get(args[0].toLowerCase());
      if (!cmd) return m.reply(`❌ Command *${args[0]}* not found.\nType *${PREFIX}help* to see all commands.`);

      return m.reply(
        `📖 *COMMAND INFO*\n\n` +
        `▸ *Name:* ${cmd.name}\n` +
        `▸ *Description:* ${cmd.description || 'No description'}\n` +
        `▸ *Usage:* ${PREFIX}${String(cmd.usage || cmd.name).replace(/^[!.,]/, '')}\n` +
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

    const OWNER = getSetting('ownerName') || 'Owner';
    const W     = 29;   // inner width of the box

    // "╭───〔 TITLE 〕───╮" style rows, centred
    const row = (l, title, r) => {
      const label = `〔 ${title} 〕`;
      const fill  = Math.max(6, W - label.length);
      const left  = Math.floor(fill / 2);
      return `${l}${'─'.repeat(left)}${label}${'─'.repeat(fill - left)}${r}`;
    };

    let text =
      row('╭', BOT_NAME.toUpperCase(), '╮') + '\n' +
      `│\n` +
      `│ 〔 BOT INFORMATION 〕\n` +
      `│ . Bot Name: ${BOT_NAME.toUpperCase()}\n` +
      `│ . Owner: ${OWNER}\n` +
      `│ . Prefix: ${PREFIX}\n` +
      `│ . Mode: ${MODE === 'private' ? 'Private' : 'Public'}\n` +
      `│ . Plugins: ${totalCmds}\n` +
      `│\n` +
      readmore;

    for (const cat of Object.keys(categories).sort()) {
      const cmds = categories[cat].sort();
      text += row('├', cat.toUpperCase(), '') + '\n';
      text += cmds.map(c => `│ . ${c}`).join('\n') + '\n';
      text += `│\n`;
    }

    text += `╰${'─'.repeat(W)}╯\n\nᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴢ ᴛᴇᴄʜ`;

    m.reply(text.trimEnd());
  },
};
