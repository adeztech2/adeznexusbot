import { getSetting } from '../../lib/database/settings.js';
import { getFooter, sendBtnOrText } from '../../lib/buttonHandler.js';

// Small helper: a gifted-btns "open link" button
const urlBtn = (text, url) => ({
  name: 'cta_url',
  buttonParamsJson: JSON.stringify({ display_text: text, url }),
});

const DEF = { category: 'general', owner: false, group: false, private: false };

const botName = () => getSetting('botName') || 'ADEZ NEXUS';

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

// ── .owner : sends the owner's contact card ───────────────────────────────────
const owner = {
  ...DEF,
  name:        'owner',
  aliases:     ['creator', 'dev', 'developer'],
  description: 'Get the bot owner contact',
  usage:       'owner',

  async execute(sock, m) {
    const name = getSetting('ownerName') || 'Owner';
    const num  = String(getSetting('ownerNumber') || '').replace(/\D/g, '');
    if (!num) return m.reply('❌ Owner number is not set.');

    const vcard =
      'BEGIN:VCARD\n' +
      'VERSION:3.0\n' +
      `FN:${name}\n` +
      `ORG:${botName()};\n` +
      `TEL;type=CELL;type=VOICE;waid=${num}:+${num}\n` +
      'END:VCARD';

    await sock.sendMessage(m.from, {
      contacts: { displayName: name, contacts: [{ vcard }] },
    }, { quoted: m.raw });

    const prefix = getSetting('prefix') || '.';
    return sendBtnOrText(sock, m.from, {
      title: '👑 OWNER',
      text:
        `👤 *Name:* ${name}\n` +
        `📱 *Number:* +${num}\n` +
        `🔗 *Chat:* wa.me/${num}`,
      footer: getFooter(),
      buttons: [
        urlBtn('💬 Chat Owner', `https://wa.me/${num}`),
        { id: `${prefix}repo`, text: '📦 Repo' },
      ],
    });
  },
};

// ── .alive : quick "is the bot up" card ───────────────────────────────────────
const alive = {
  ...DEF,
  name:        'alive',
  aliases:     ['online', 'botstatus'],
  description: 'Check that the bot is online',
  usage:       'alive',

  async execute(sock, m) {
    const prefix = getSetting('prefix') || '.';
    const mode   = getSetting('mode') === 'public' ? 'Public' : 'Private';
    const buttons = [
      { id: `${prefix}menu`, text: '📜 Menu' },
      { id: `${prefix}ping`, text: '⚡ Ping' },
    ];
    const channel = getSetting('channelUrl');
    if (channel) buttons.push(urlBtn('📢 Channel', channel));
    return sendBtnOrText(sock, m.from, {
      title: `⚡ ${botName().toUpperCase()} ⚡`,
      text:
        `🟢 *Status:* Online\n` +
        `⏱️ *Uptime:* ${fmtUptime(process.uptime())}\n` +
        `🔑 *Prefix:* ${prefix}\n` +
        `🌐 *Mode:* ${mode}\n\n` +
        `💡 Tap *Menu* for commands`,
      footer: getFooter(),
      buttons,
    });
  },
};

// ── .repo : source code link ──────────────────────────────────────────────────
const repo = {
  ...DEF,
  name:        'repo',
  aliases:     ['script', 'sc', 'github', 'source'],
  description: 'Get the bot source code link',
  usage:       'repo',

  async execute(sock, m) {
    const url = getSetting('repoUrl') || 'https://github.com/adeztech2/baileys';
    const prefix = getSetting('prefix') || '.';
    return sendBtnOrText(sock, m.from, {
      title: `📦 ${botName().toUpperCase()} SOURCE`,
      text: `🔗 *Repo:* ${url}\n⭐ Star and fork the repo to support the project`,
      footer: getFooter(),
      buttons: [
        urlBtn('🌐 Open GitHub', url),
        { id: `${prefix}support`, text: '🆘 Support' },
      ],
    });
  },
};

// ── .support : channel and group links ────────────────────────────────────────
const support = {
  ...DEF,
  name:        'support',
  aliases:     ['channel', 'group', 'links', 'community'],
  description: 'Get the official channel and support group links',
  usage:       'support',

  async execute(sock, m) {
    const channel = getSetting('channelUrl');
    const group   = getSetting('groupUrl');
    const lines = [];
    if (channel) lines.push(`📢 *Channel:* ${channel}`);
    if (group)   lines.push(`👥 *Group:* ${group}`);
    if (!lines.length) return m.reply('❌ No support links are set yet.');
    const buttons = [];
    if (channel) buttons.push(urlBtn('📢 Channel', channel));
    if (group)   buttons.push(urlBtn('👥 Support Group', group));
    return sendBtnOrText(sock, m.from, {
      title: '🆘 SUPPORT',
      text: lines.join('\n'),
      footer: getFooter(),
      buttons,
    });
  },
};

// ── .time : current date and time in the bot's timezone ───────────────────────
const time = {
  ...DEF,
  name:        'clock',
  aliases:     ['date', 'now'],
  description: 'Show the bot\'s current date and time',
  usage:       'clock',

  async execute(sock, m) {
    const tz  = getSetting('timezone') || 'Africa/Nairobi';
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz });
    const hour = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: tz });
    return m.reply(
      `🕐 *TIME*\n\n` +
      `📅 *Date:* ${date}\n` +
      `🕐 *Time:* ${hour}\n` +
      `🌍 *Zone:* ${tz}\n\n${getFooter()}`
    );
  },
};

// ── .jid : show the chat / sender JID ─────────────────────────────────────────
const jid = {
  ...DEF,
  name:        'jid',
  aliases:     ['chatid', 'myjid'],
  description: 'Show the JID of this chat and of you (or the replied user)',
  usage:       'jid  (optionally reply to a user)',

  async execute(sock, m) {
    const target = m.quoted?.sender || m.sender || '';
    return m.reply(
      `🆔 *JID*\n\n` +
      `💬 *Chat:* ${m.from}\n` +
      `👤 *User:* ${target}`
    );
  },
};

export default [owner, alive, repo, support, time, jid];
