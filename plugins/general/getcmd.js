import fs from 'fs';
import { getFooter } from '../../lib/buttonHandler.js';

// Dynamic import used inside execute() to avoid circular dependency
// (commandHandler loads this file, so we can't statically import it back)
async function getCommandsMap() {
  const { getCommands } = await import('../../lib/connection/commandHandler.js');
  return getCommands();
}

// Characters at which we switch from inline text to a document
const TEXT_LIMIT = 4000;

export default {
  name:        'getcmd',
  aliases:     ['getcommand', 'cmdfile', 'commandfile', 'sourcecmd'],
  description: 'Fetch the source file for any command',
  usage:       'getcmd <command name or alias>',
  category:    'general',
  owner:       true,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const input = (args[0] || '').toLowerCase().trim();
    if (!input) return m.reply(`❌ Provide a command name.\nExample: \`,getcmd tiktok\``);

    const commands = await getCommandsMap();
    const command  = commands.get(input);

    if (!command) return m.reply(`❌ No command found for *${input}*.\nUse \`,help\` to see all commands.`);

    // Always use the canonical name (not the alias the user typed)
    const canonicalName = command.name;
    const filePath      = command._filePath;

    if (!filePath || !fs.existsSync(filePath)) {
      return m.reply(`❌ Could not locate the source file for *${canonicalName}*.`);
    }

    let source;
    try {
      source = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      return m.reply(`❌ Failed to read source file: ${err.message}`);
    }

    const fileName = `${canonicalName}.js`;
    await m.react('📄');

    if (source.length <= TEXT_LIMIT) {
      // ── Short file: send inline as a code block ──────────────────────────
      await m.reply(
        `📄 *${fileName}*\n` +
        `📁 \`${filePath.replace(process.cwd(), '.')}\`\n\n` +
        `\`\`\`\n${source}\n\`\`\`\n\n${getFooter()}`
      );
    } else {
      // ── Long file: send as a downloadable document ────────────────────────
      const buf = Buffer.from(source, 'utf-8');
      await sock.sendMessage(m.from, {
        document: buf,
        mimetype: 'application/javascript',
        fileName,
        caption:
          `📄 *${fileName}*\n` +
          `📁 \`${filePath.replace(process.cwd(), '.')}\`\n` +
          `📏 ${(source.length / 1024).toFixed(1)} KB  •  ${source.split('\n').length} lines\n\n` +
          getFooter(),
      }, { quoted: m.raw });
    }

    await m.react('✅');
  },
};
