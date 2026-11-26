import { getCommands } from '../../lib/connection/commandHandler.js';
import { getSetting }  from '../../lib/database/settings.js';
import { getUserJid } from '../../lib/connection/helper.js';
import { sendBtnOrText, getFooter } from '../../lib/buttonHandler.js';

// ── Menu layout ────────────────────────────────────────────────────────────
// Order and titles of the sections. Anything not listed is added at the end.
const SECTIONS = [
  ['general',  'GENERAL'],
  ['group',    'GROUP'],
  ['owner',    'OWNER'],
  ['tools',    'TOOLS'],
  ['media',    'MEDIA'],
  ['fun',      'FUN'],
  ['devtools', 'DEV TOOLS'],
  ['misc',     'MISC'],
];

const CAT_ICONS = {
  general: '🎯', group: '👥', tools: '🛠️', fun: '🎉',
  devtools: '💻', media: '🎵', owner: '🔐', misc: '📦',
};

const catKey = (c) => {
  const k = String(c || 'misc').toLowerCase();
  return k === 'groups' ? 'group' : k;
};

// A-Z -> mathematical bold (𝐀-𝐙), same look as "𝐓𝐎𝐓𝐀𝐋 𝐏𝐋𝐔𝐆𝐈𝐍𝐒" in the menu header
const boldCaps = (s) => String(s).replace(/[A-Z]/g, (ch) => String.fromCodePoint(0x1D400 + ch.charCodeAt(0) - 65));

// Website shown on the link card under the menu. Override with the MENU_LINK / MENU_LINK_TEXT env variables.
const MENU_LINK      = process.env.MENU_LINK      || 'https://nexushost.xyz';
const MENU_LINK_TEXT = process.env.MENU_LINK_TEXT || 'Click to open hosting site';

const line = (n) => '─'.repeat(Math.max(3, n));

function collect(commands) {
  const cats = {};
  let total = 0;
  commands.forEach((cmd, name) => {
    if (name !== cmd.name) return;                // skip aliases
    const k = catKey(cmd.category);
    (cats[k] ||= []).push(cmd.name);
    total++;
  });
  for (const k of Object.keys(cats)) cats[k].sort();
  return { cats, total };
}

function buildMenuText({ botName, mention, prefix, mode, time, cats, total }) {
  const known = SECTIONS.filter(([k]) => cats[k]);
  const extra = Object.keys(cats)
    .filter((k) => !SECTIONS.some(([s]) => s === k))
    .sort()
    .map((k) => [k, k.toUpperCase()]);

  let t = `└─► Hey, ${mention} 👋\n\n`;

  const title = botName.toUpperCase();
  t += `╭${line(2)}〔 ${title} 〕${line(22 - title.length)}···\n`;
  t += `│ ❇ │▸ ${boldCaps('TOTAL PLUGINS')}: ${total}\n`;
  t += `│ ❇ │▸ ${boldCaps('PREFIX')}: ${prefix}\n`;
  t += `│ ❇ │▸ ${boldCaps('MODE')}: ${mode === 'private' ? 'Private' : 'Public'}\n`;
  t += `│ ❇ │▸ ${boldCaps('TIME')}: ${time}\n`;
  t += `╰${line(30)}⊷\n`;

  for (const [key, label] of [...known, ...extra]) {
    const icon = CAT_ICONS[key] || '📦';
    t += `\n╭${line(8)}「 ${label} ${icon}」${line(14 - label.length)}···\n`;
    for (const c of cats[key]) t += `│ ◦ ${prefix}${c}\n`;
    t += `╰${line(30)}···\n`;
  }
  return t.trimEnd();
}

function commandInfo(cmd, prefix) {
  return (
    `📖 *COMMAND INFO*\n\n` +
    `▸ *Name:* ${cmd.name}\n` +
    `▸ *Description:* ${cmd.description || 'No description'}\n` +
    `▸ *Usage:* ${prefix}${String(cmd.usage || cmd.name).replace(/^[!.,]/, '')}\n` +
    `▸ *Category:* ${cmd.category}` +
    (cmd.aliases?.length ? `\n▸ *Aliases:* ${cmd.aliases.join(', ')}` : '')
  );
}

function context() {
  const prefix  = getSetting('prefix') || '.';
  const botName = getSetting('botName') || 'ADEZ NEXUS';
  const tz      = getSetting('timezone') || 'Africa/Nairobi';
  const mode    = getSetting('mode') || 'private';
  const time    = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz });
  return { prefix, botName, mode, time };
}

const readmore = String.fromCharCode(8206).repeat(4001);

// ── Senders ────────────────────────────────────────────────────────────────

// Button menu with a plain list of commands per category  (.menu)
async function sendListMenu(sock, m) {
  const { prefix, botName, mode, time } = context();
  const { cats, total } = collect(getCommands());

  let text =
    `🐼 *${botName.toUpperCase()} v1.0.0*\n` +
    `─────────────────\n` +
    `👤 *User:* ${m.pushName || 'User'}\n` +
    `🔑 *Prefix:* \`${prefix}\`\n` +
    `🌐 *Mode:* ${mode === 'private' ? 'Private' : 'Public'}\n` +
    `🕐 *Time:* ${time}\n` +
    `📦 *Commands:* ${total}\n` +
    readmore + '\n';

  for (const cat of Object.keys(cats).sort()) {
    text += `${CAT_ICONS[cat] || '📦'} *${cat.toUpperCase()}* [${cats[cat].length}]\n`;
    text += cats[cat].map((c) => `  ╺ ${prefix}${c}`).join('\n');
    text += '\n\n';
  }

  const buttons = [
    { id: `${prefix}ping`,  text: '⚡ Ping' },
    { id: `${prefix}alive`, text: '🟢 Alive' },
    { id: `${prefix}owner`, text: '👑 Owner' },
  ];
  const channel = getSetting('channelUrl');
  if (channel) {
    buttons.push({
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({ display_text: '📢 Channel', url: channel }),
    });
  }

  return sendBtnOrText(sock, m.from, { title: '', text: text.trimEnd(), footer: getFooter(), buttons });
}

// Styled text menu + link card + verified-contact header  (.menu2)
async function sendClassicMenu(sock, m) {
  const { prefix, botName, mode, time } = context();
  const { cats, total } = collect(getCommands());

  // "Hey, @user": a real tag, WhatsApp shows the person's name
  const userJid = await getUserJid(sock, m);
  const mention = `@${userJid.split('@')[0].split(':')[0]}`;
  const text = buildMenuText({ botName, mention, prefix, mode, time, cats, total });

  // Link card under the header (website)
  const externalAdReply = {
    title: botName.toUpperCase(),
    body: MENU_LINK_TEXT,
    mediaType: 1,
    renderLargerThumbnail: false,
    showAdAttribution: false,
    sourceUrl: MENU_LINK,
  };

  // Quoting the user's message turns into the verified-contact header (see lib/verifiedQuote.js)
  return sock.sendMessage(
    m.from,
    { text: `${text}\n\n${getFooter()}`, contextInfo: { mentionedJid: [userJid], externalAdReply } },
    { quoted: m }
  );
}

// ── .menu  (button menu with the command list; also handles ".help <command>") ─
const menu = {
  name:        'help',
  aliases:     ['menu', 'commands', 'buttonmenu'],
  description: 'Show all available commands',
  usage:       'help [command]',
  category:    'general',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    if (args[0]) {
      const { prefix } = context();
      const cmd = getCommands().get(args[0].toLowerCase());
      if (!cmd) return m.reply(`❌ Command *${args[0]}* not found.\nType *${prefix}help* to see all commands.`);
      return m.reply(commandInfo(cmd, prefix));
    }
    return sendListMenu(sock, m);
  },
};

// ── .menu2  (the styled text menu with the website link card) ──────────────
const menu2 = {
  name:        'menu2',
  aliases:     ['classicmenu', 'stylemenu'],
  description: 'Styled text menu with link card',
  usage:       'menu2',
  category:    'general',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m) {
    return sendClassicMenu(sock, m);
  },
};

export default [menu, menu2];
