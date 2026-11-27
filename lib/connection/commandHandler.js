import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getSetting, isEnabled } from '../database/settings.js';
import { metadataCache } from './metadataCache.js';
import { getUserJid } from './helper.js';
import { isSuperUser, DEV_NUMBERS } from '../database/sudo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commands  = new Map();
let uniqueCommandCount = 0;
const failedCommands   = [];

// Per-chat cooldown — prevents rapid-fire commands from exhausting the send quota.
// Maps chatJid → last-command timestamp. Min 1 s between commands per chat.
const lastCmdTime = new Map();
const CMD_COOLDOWN_MS = 1000;

async function loadCommandsRecursive(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat     = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      await loadCommandsRecursive(fullPath);
    } else if (item.endsWith('.js')) {
      try {
        const relativePath = path.relative(path.join(__dirname, '../..'), fullPath);
        const module   = await import(`../../${relativePath}`);
        const exported = module.default;

        const cmdList = Array.isArray(exported) ? exported : (exported?.name ? [exported] : []);

        for (const command of cmdList) {
          if (!command?.name) continue;
          command._filePath = fullPath;   // store source path for getcmd
          commands.set(command.name, command);
          uniqueCommandCount++;
          if (Array.isArray(command.aliases)) {
            command.aliases.forEach(alias => commands.set(alias, command));
          }
        }
        if (typeof module.registerCommands === 'function') {
          await module.registerCommands(commands);
        }
      } catch (err) {
        failedCommands.push({ file: item, path: fullPath, error: err.message });
        console.error(`❌ Failed to load command: ${item}`);
        console.error(`   ↳ Error: ${err.message}`);
      }
    }
  }
}

export async function loadCommands() {
  const pluginsDir = path.join(__dirname, '../../plugins');
  if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });
  commands.clear();
  uniqueCommandCount = 0;
  failedCommands.length = 0;
  console.log('🔄 Loading commands...\n');
  await loadCommandsRecursive(pluginsDir);
  console.log(`✅ Loaded ${uniqueCommandCount} commands\n`);
}

export function getCommands() { return commands; }

function extractNum(jid) {
  return (jid || '').split('@')[0].split(':')[0];
}

export async function isAdmin(sock, m) {
  const groupJid = m.key?.remoteJid;
  if (!groupJid?.endsWith('@g.us')) return false;

  const sender    = m.sender || m.key?.participant || '';
  const senderNum = extractNum(sender);
  if (!senderNum) return false;

  try {
    let meta;
    try { meta = await metadataCache.get(sock, groupJid); }
    catch { meta = await sock.groupMetadata(groupJid); }

    return meta.participants.some(p => {
      const isMatch =
        p.id === sender ||
        extractNum(p.id) === senderNum ||
        (p.phoneNumber && extractNum(p.phoneNumber) === senderNum) ||
        (p.lid && extractNum(p.lid) === senderNum);
      return isMatch && (p.admin === 'admin' || p.admin === 'superadmin');
    });
  } catch { return false; }
}

export async function isBotAdmin(sock, m) {
  const botJid = (sock.user?.id || '').replace(/:\d+(@s\.whatsapp\.net)$/, '$1');
  if (await isAdmin(sock, { key: { remoteJid: m.key.remoteJid }, sender: botJid })) return true;
  // LID-addressed groups may list the bot only by its LID
  const botLid = (sock.user?.lid || '').replace(/:\d+(@lid)$/, '$1');
  return botLid ? isAdmin(sock, { key: { remoteJid: m.key.remoteJid }, sender: botLid }) : false;
}

const COMMAND_TIMEOUT_MS = 60_000;
const RATE_LIMIT_RETRY_DELAY = 2500; // wait 2.5 s before retrying on rate-overlimit

async function tryExecute(command, sock, m, args) {
  const cmdTimeout = command.timeout || COMMAND_TIMEOUT_MS;
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Command timed out')), cmdTimeout);
  });
  try {
    const result = await Promise.race([command.execute(sock, m, args), timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export async function handleCommand(sock, m) {
  const prefix = getSetting('prefix') || '.';

  if (!m.body?.startsWith(prefix)) return;

  const parsed = m.body.slice(prefix.length).trim().match(/^(\S+)([\s\S]*)$/);
  if (!parsed) return;
  const cmdName = parsed[1].toLowerCase();
  const rest    = parsed[2].trim();
  const args    = rest ? rest.split(/ +/) : [];

  const command = commands.get(cmdName);
  if (!command) return;

  // Per-chat cooldown — skip duplicate/rapid commands
  const chatKey = m.from || m.key?.remoteJid;
  const now = Date.now();
  const last = lastCmdTime.get(chatKey) || 0;
  if (now - last < CMD_COOLDOWN_MS) return;
  lastCmdTime.set(chatKey, now);

  const senderJid = await getUserJid(sock, m);
  const isOwner   = await isSuperUser(senderJid, sock);
  const mode      = getSetting('mode') || 'private';

  if (mode === 'private' && !isOwner) {
    console.log(`[cmd] ignored "${cmdName}" from ${senderJid} — mode is private and sender is not owner/sudo`);
    return;
  }

  if (command.owner && !isOwner) {
    console.log(`[cmd] "${cmdName}" denied for ${senderJid} — not owner/sudo`);
    return m.reply('Command meant for owners only.');
  }

  if (command.group && !m.isGroup) return m.reply('❌ Group only command.');
  if (command.private && m.isGroup) return m.reply('❌ Private only command.');

  if (command.admin && m.isGroup) {
    const ok = await isAdmin(sock, m);
    if (!ok) return m.reply('Command meant for admins only.');
  }

  if (command.botAdmin && m.isGroup) {
    const ok = await isBotAdmin(sock, m);
    if (!ok) return m.reply('I must be admin.');
  }

  // Block .env / secrets + reverse-shell / RCE for non-dev users
  const _senderNum = senderJid.split('@')[0];
  if (!DEV_NUMBERS.includes(_senderNum)) {
    const _blocked =
      // .env file & env var access
      /\.env(\b|$)/i.test(m.body) ||
      /process\.env/i.test(m.body) ||
      /\$\{?(SESSION_ID|DATABASE_URL|API_KEYS|GIFTED_API_KEY|GIFTED_TECH_API|MEGAN_API_KEY|MEGAN_API_URL|GITHUB_TOKEN|GITHUB_USER|OWNER_NUMBER)\}?/i.test(m.body) ||
      /(cat|head|tail|less|more|strings|base64|xxd|od)\s+[^\s]*\.env/i.test(m.body) ||
      /\.env\s*(>>|>|\||;)/i.test(m.body) ||
      // Remote code execution — fetch & pipe to interpreter
      /\b(curl|wget)\b[^|\n]*\|[^|\n]*\b(node|python3?|bash|sh|perl|ruby|php)\b/i.test(m.body) ||
      /\|\s*(node|python3?|bash|sh|perl|ruby|php)\s*-/i.test(m.body) ||
      // Reverse shell patterns
      /\/dev\/tcp\//i.test(m.body) ||
      /\b(nc|ncat|netcat)\b[^\n]*-(e|c)\b/i.test(m.body) ||
      /bash\s+-i\s*>&/i.test(m.body) ||
      // Base64-encoded payload execution
      /base64\s*(-d|--decode)[^\n]*(\|\s*bash|\|\s*sh|\|\s*node)/i.test(m.body) ||
      // eval / exec of dynamic code
      /\beval\s*[\(\$`]/i.test(m.body) ||
      /require\s*\(\s*['"]child_process/i.test(m.body);
    if (_blocked) return m.reply('\u26d4 Access denied.');
  }

  try {
    await tryExecute(command, sock, m, args);
    if (!m._failed) m.react('✅').catch(() => {});
  } catch (err) {
    const isRateLimit = err.message?.includes('rate-overlimit');
    console.error(`🔥 CMD error [${cmdName}]:`, err.message);

    if (isRateLimit) {
      // Wait and retry once — don't send any messages during the wait
      console.log(`⏳ Rate-limited [${cmdName}] — retrying in ${RATE_LIMIT_RETRY_DELAY}ms`);
      await new Promise(r => setTimeout(r, RATE_LIMIT_RETRY_DELAY));
      try {
        await tryExecute(command, sock, m, args);
        if (!m._failed) m.react('✅').catch(() => {});
      } catch (retryErr) {
        console.error(`🔥 CMD retry failed [${cmdName}]:`, retryErr.message);
        // Silently give up — sending an error reply would likely also hit rate-limit
      }
    } else if (err.message === 'Command timed out') {
      // execute() is still running in the background and will send its own reply.
      // Sending a timeout error here causes a confusing double-message to the user.
      console.warn(`⏱ CMD timeout [${cmdName}] — running in background`);
    } else {
      m.react('❌').catch(() => {});
      m.reply(`❌ Error: ${err.message}`).catch(() => {});
    }
  }
      }
