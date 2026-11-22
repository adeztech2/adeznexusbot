import { getSetting, setSetting, getAllSettings, isEnabled, DEFAULTS } from '../../lib/database/settings.js';

const BOOL_KEYS     = new Set(['autoViewStatus', 'autoLikeStatus', 'antiDelete', 'antiEdit', 'chatbot', 'useButtons', 'autoJoinGroup', 'autoFollowChannel', 'newsletterReact', 'verifiedReply']);
const PRESENCE_KEYS = new Set(['dmPresence', 'gcPresence']);
const VALID_KEYS = Object.keys(DEFAULTS);

const KEY_MAP = {
  botname:            'botName',
  botfooter:          'botFooter',
  ownername:          'ownerName',
  ownernumber:        'ownerNumber',
  timezone:           'timezone',
  prefix:             'prefix',
  mode:               'mode',
  autoviewstatus:     'autoViewStatus',
  autolikestatus:     'autoLikeStatus',
  likeemojis:         'likeEmojis',
  dmpresence:         'dmPresence',
  gcpresence:         'gcPresence',
  antidelete:         'antiDelete',
  antiedit:           'antiEdit',
  chatbot:            'chatbot',
  usebuttons:         'useButtons',
  footer:             'botFooter',   // was 'footer', which nothing reads
  verifiedreply:      'verifiedReply',
  verifiedname:       'verifiedName',
  autojoingroup:      'autoJoinGroup',
  autofollowchannel:  'autoFollowChannel',
  newsletterjid:      'newsletterJid',
  channelurl:         'channelUrl',
  groupurl:           'groupUrl',
  newsletterreact:    'newsletterReact',
  newsletteremojis:   'newsletterEmojis',
};

function displayBool(key) {
  return isEnabled(key) ? '✅ ON' : '❌ OFF';
}

function displayPresence(val) {
  if (!val || val === 'off' || val === 'false') return '❌ OFF';
  return `✅ ${val}`;
}

function displayValue(key, val) {
  if (BOOL_KEYS.has(key))     return isEnabled(key) ? '✅ ON' : '❌ OFF';
  if (PRESENCE_KEYS.has(key)) return displayPresence(val);
  if (key === 'likeEmojis')   return val || '—';
  return val || '—';
}

function formatSettings() {
  const s = getAllSettings();
  return (
    `╭━━━━━━━━━━━━━━━━━━╮\n` +
    `│   ⚙️  *BOT SETTINGS*\n` +
    `╰━━━━━━━━━━━━━━━━━━╯\n\n` +

    `*🤖 Bot*\n` +
    `▸ botName: ${s.botName}\n` +
    `▸ botFooter: ${s.botFooter || '—'}\n\n` +

    `*👤 Owner*\n` +
    `▸ ownerName: ${s.ownerName}\n` +
    `▸ ownerNumber: ${s.ownerNumber}\n` +
    `▸ prefix: \`${s.prefix}\`\n` +
    `▸ mode: ${s.mode === 'private' ? 'Private' : 'Public'}\n` +
    `▸ timezone: ${s.timezone}\n\n` +

    `*🔔 Status*\n` +
    `▸ autoViewStatus: ${displayBool('autoViewStatus')}\n` +
    `▸ autoLikeStatus: ${displayBool('autoLikeStatus')}\n` +
    `▸ likeEmojis: ${s.likeEmojis}\n\n` +

    `*💬 Presence*\n` +
    `▸ dmPresence: ${displayPresence(s.dmPresence)} _(off/online/offline/typing/recording)_\n` +
    `▸ gcPresence: ${displayPresence(s.gcPresence)} _(off/online/offline/typing/recording)_\n\n` +

    `*🛡️ Protection*\n` +
    `▸ antiDelete: ${displayBool('antiDelete')}\n` +
    `▸ antiEdit: ${displayBool('antiEdit')}\n\n` +

    `*📢 Auto-Join / Channel*\n` +
    `▸ autoJoinGroup: ${displayBool('autoJoinGroup')}\n` +
    `▸ autoFollowChannel: ${displayBool('autoFollowChannel')}\n` +
    `▸ newsletterJid: ${s.newsletterJid || '—'}\n` +
    `▸ channelUrl: ${s.channelUrl || '—'}\n` +
    `▸ groupUrl: ${s.groupUrl || '—'}\n` +
    `▸ newsletterReact: ${displayBool('newsletterReact')}\n` +
    `▸ newsletterEmojis: ${s.newsletterEmojis || '—'}\n\n` +

    `*🔧 Misc*\n` +
    `▸ chatbot: ${displayBool('chatbot')} _(DMs only)_\n` +
    `▸ verifiedReply: ${displayBool('verifiedReply')}\n` +
    `▸ verifiedName: ${s.verifiedName || '—'}\n` +
    `▸ useButtons: ${displayBool('useButtons')}\n\n` +

    `_Change any setting by typing its name and value, e.g._\n` +
    `\`mode public\`  \`chatbot on\`  \`antidelete on\`  \`prefix !\`\n` +
    `_Send just the name (e.g._ \`mode\`_) to see its current value._\n` +
    `_Antilink is per group: send_ \`antilink on\` _inside the group._`
  );
}

/** Validate + save one setting. Returns the reply text. */
async function applySetting(dbKey, rawVal) {
  let newVal = rawVal;

  if (BOOL_KEYS.has(dbKey)) {
    const lower = rawVal.toLowerCase();
    if (['on', 'true', '1', 'yes'].includes(lower))       newVal = 'true';
    else if (['off', 'false', '0', 'no'].includes(lower)) newVal = 'false';
    else return `❌ Invalid value for *${dbKey}*. Use \`on\` or \`off\`.`;
  }

  if (PRESENCE_KEYS.has(dbKey)) {
    const lower = rawVal.toLowerCase();
    const valid = ['off', 'online', 'offline', 'composing', 'typing', 'recording'];
    if (!valid.includes(lower)) {
      return `❌ Invalid value for *${dbKey}*.\nUse: \`off\`, \`online\`, \`offline\`, \`typing\`, or \`recording\`.`;
    }
    newVal = lower;
  }

  if (dbKey === 'mode') {
    if (!['private', 'public'].includes(rawVal.toLowerCase())) {
      return `❌ Mode must be \`private\` or \`public\`.`;
    }
    newVal = rawVal.toLowerCase();
  }

  if (dbKey === 'prefix' && (!rawVal || /\s/.test(rawVal) || rawVal.length > 3)) {
    return '❌ Prefix must be 1–3 characters with no spaces.';
  }

  if (dbKey === 'timezone') {
    try { Intl.DateTimeFormat(undefined, { timeZone: rawVal }); }
    catch {
      return (
        `❌ Invalid timezone: *${rawVal}*\n\nUse a valid IANA timezone, e.g.\n` +
        `• \`Africa/Nairobi\`\n• \`America/New_York\`\n• \`Europe/London\`\n• \`Asia/Kolkata\``
      );
    }
  }

  const curr = getSetting(dbKey);
  if (String(curr) === String(newVal)) {
    return `ℹ️ *${dbKey}* is already set to *${displayValue(dbKey, curr)}*`;
  }

  await setSetting(dbKey, newVal);

  const display = BOOL_KEYS.has(dbKey)
    ? (newVal === 'true' ? '✅ ON' : '❌ OFF')
    : PRESENCE_KEYS.has(dbKey)
      ? displayPresence(newVal)
      : `*${newVal}*`;

  return `✅ *${dbKey}* updated to ${display}`;
}

const base = { category: 'owner', owner: true, group: false, private: false };

// Extra short names
const EXTRA_ALIASES = {
  autoViewStatus: ['autoview'],
  autoLikeStatus: ['autolike'],
  antiDelete:     ['antidel'],
};

// `settings` — show everything (also: settings <key> [value] still works)
const settingsCmd = {
  ...base,
  name:        'settings',
  aliases:     ['setting', 'botsettings'],
  description: 'Show all bot settings',
  usage:       'settings',
  async execute(sock, m, args) {
    if (!args.length) return m.reply(formatSettings());
    const dbKey = KEY_MAP[args[0].toLowerCase()];
    if (!dbKey) return m.reply(`❌ Unknown setting: *${args[0]}*\n\nSend \`settings\` to see all of them.`);
    if (args.length === 1) return m.reply(`*${dbKey}* is currently set to: *${displayValue(dbKey, getSetting(dbKey))}*`);
    return m.reply(await applySetting(dbKey, args.slice(1).join(' ').trim()));
  },
};

// One command per setting: `mode public`, `chatbot on`, `prefix !` ...
// 'antilink' is not here — it is a per-group command in plugins/groups/antilink.js.
const keyCommands = Object.entries(KEY_MAP).map(([cmdName, dbKey]) => ({
  ...base,
  name:        cmdName,
  aliases:     EXTRA_ALIASES[dbKey] || [],
  description: `View or change ${dbKey}`,
  usage:       BOOL_KEYS.has(dbKey) ? `${cmdName} on|off` : `${cmdName} <value>`,
  async execute(sock, m, args) {
    if (!args.length) {
      return m.reply(`*${dbKey}* is currently set to: *${displayValue(dbKey, getSetting(dbKey))}*`);
    }
    return m.reply(await applySetting(dbKey, args.join(' ').trim()));
  },
}));

export default [settingsCmd, ...keyCommands];
      
