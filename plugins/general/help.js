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

// ── .menu  (text menu + link card + verified-contact header) ───────────────
const menu = {
  name:        'help',
  aliases:     ['menu', 'commands'],
  description: 'Show all available commands',
  usage:       'help [command]',
  category:    'general',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const { prefix, botName, mode, time } = context();
    const commands = getCommands();

    if (args[0]) {
      const cmd = commands.get(args[0].toLowerCase());
      if (!cmd) return m.reply(`❌ Command *${args[0]}* not found.\nType *${prefix}help* to see all commands.`);
      return m.reply(commandInfo(cmd, prefix));
    }

    const { cats, total } = collect(commands);

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
  },
};

// ── .menu2  (button menu with the commands laid out in tables) ─────────────
const readmore  = String.fromCharCode(8206).repeat(4001);
const MAX_WIDTH = 34; // characters that fit on one line of a phone screen in monospace

// Box-table helpers. Only plain characters go inside the tables (emoji are double-width
// in monospace and would break the alignment), so emoji stay in the titles outside them.
function infoTable(rows) {
  const kw = Math.max(...rows.map(([k]) => k.length));
  const vw = Math.max(...rows.map(([, v]) => v.length));
  const out = [`┌${'─'.repeat(kw + 2)}┬${'─'.repeat(vw + 2)}┐`];
  for (const [k, v] of rows) out.push(`│ ${k.padEnd(kw)} │ ${v.padEnd(vw)} │`);
  out.push(`└${'─'.repeat(kw + 2)}┴${'─'.repeat(vw + 2)}┘`);
  return out.join('\n');
}

function categoryTable(title, items) {
  let w = Math.max(...items.map((i) => i.length));
  let cols = Math.min(3, items.length);
  while (cols > 1 && cols * (w + 2) + (cols - 1) + 2 > MAX_WIDTH) cols--;
  while (cols * (w + 2) + (cols - 1) < title.length + 2) w++; // keep the title row from being cut off

  const inner = cols * (w + 2) + (cols - 1);
  const seg   = '─'.repeat(w + 2);
  const out   = [
    `┌${'─'.repeat(inner)}┐`,
    `│ ${title.padEnd(inner - 2)} │`,
    `├${Array(cols).fill(seg).join('┬')}┤`,
  ];

  for (let i = 0; i < items.length; i += cols) {
    const cells = Array.from({ length: cols }, (_, c) => ` ${(items[i + c] || '').padEnd(w)} `);
    out.push(`│${cells.join('│')}│`);
  }
  out.push(`└${Array(cols).fill(seg).join('┴')}┘`);
  return out.join('\n');
}

function buildTableMenu({ botName, userName, prefix, mode, time, cats, total }) {
  const known = SECTIONS.filter(([k]) => cats[k]);
  const extra = Object.keys(cats)
    .filter((k) => !SECTIONS.some(([s]) => s === k))
    .sort()
    .map((k) => [k, k.toUpperCase()]);

  let t =
    `🐼 *${botName.toUpperCase()} v1.0.0*\n` +
    `👤 Hello, *${userName}*\n\n` +
    '```' + infoTable([
      ['Prefix',   prefix],
      ['Mode',     mode === 'private' ? 'Private' : 'Public'],
      ['Time',     time],
      ['Commands', String(total)],
    ]) + '```\n' +
    `_Use ${prefix}help <command> for details_\n` +
    readmore + '\n';

  for (const [key, label] of [...known, ...extra]) {
    const icon = CAT_ICONS[key] || '📦';
    const cmds = cats[key];
    t += `${icon} *${label}*\n`;
    t += '```' + categoryTable(`${label} [${cmds.length}]`, cmds.map((c) => `${prefix}${c}`)) + '```\n\n';
  }
  return t.trimEnd();
}

const menu2 = {
  name:        'menu2',
  aliases:     ['buttonmenu', 'tablemenu'],
  description: 'Menu with commands in tables and quick buttons',
  usage:       'menu2',
  category:    'general',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m) {
    const { prefix, botName, mode, time } = context();
    const { cats, total } = collect(getCommands());

    const text = buildTableMenu({
      botName, prefix, mode, time, cats, total,
      userName: m.pushName || 'User',
    });

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

    return sendBtnOrText(sock, m.from, { title: '', text, footer: getFooter(), buttons });
  },
};

export default [menu, menu2];
    
