import { getSetting, setSetting, getAllSettings, isEnabled, DEFAULTS } from '../../lib/database/settings.js';

const BOOL_KEYS     = new Set(['autoViewStatus', 'autoLikeStatus', 'antiDelete', 'antiEdit', 'chatbot', 'useButtons', 'autoJoinGroup', 'autoFollowChannel', 'newsletterReact']);
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
  footer:             'footer',
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
    `▸ chatbot: ${displayBool('chatbot')}\n` +
    `▸ useButtons: ${displayBool('useButtons')}\n\n` +

    `_Use_ \`set <key> <value>\` _to change_\n` +
    `_Keys: ${Object.keys(KEY_MAP).join(', ')}_`
  );
}

export default {
  name:        'settings',
  aliases:     ['setting', 'botsettings', 'set'],
  description: 'View or change bot settings',
  usage:       'settings [key] [value]',
  category:    'owner',
  owner:       true,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    if (!args.length) {
      return m.reply(formatSettings());
    }

    const rawKey = args[0].toLowerCase();
    const dbKey  = KEY_MAP[rawKey];

    if (!dbKey) {
      return m.reply(
        `❌ Unknown setting: *${args[0]}*\n\n` +
        `Valid keys:\n${Object.keys(KEY_MAP).map(k => `  • \`${k}\``).join('\n')}`
      );
    }

    if (args.length === 1) {
      const curr = getSetting(dbKey);
      return m.reply(`*${dbKey}* is currently set to: *${displayValue(dbKey, curr)}*`);
    }

    const rawVal = args.slice(1).join(' ').trim();
    let newVal   = rawVal;

    if (BOOL_KEYS.has(dbKey)) {
      const lower = rawVal.toLowerCase();
      if (['on', 'true', '1', 'yes'].includes(lower))  newVal = 'true';
      else if (['off', 'false', '0', 'no'].includes(lower)) newVal = 'false';
      else return m.reply(`❌ Invalid value for *${dbKey}*. Use \`on\` or \`off\`.`);
    }

    if (PRESENCE_KEYS.has(dbKey)) {
      const lower = rawVal.toLowerCase();
      const valid = ['off', 'online', 'offline', 'composing', 'typing', 'recording'];
      if (!valid.includes(lower)) {
        return m.reply(`❌ Invalid value for *${dbKey}*.\nUse: \`off\`, \`online\`, \`offline\`, \`typing\`, or \`recording\`.`);
      }
      newVal = lower;
    }

    if (dbKey === 'mode') {
      if (!['private', 'public'].includes(rawVal.toLowerCase())) {
        return m.reply(`❌ Mode must be \`private\` or \`public\`.`);
      }
      newVal = rawVal.toLowerCase();
    }

    if (dbKey === 'timezone') {
      try { Intl.DateTimeFormat(undefined, { timeZone: rawVal }); }
      catch {
        return m.reply(
          `❌ Invalid timezone: *${rawVal}*\n\nUse a valid IANA timezone, e.g.\n` +
          `• \`Africa/Nairobi\`\n• \`America/New_York\`\n• \`Europe/London\`\n• \`Asia/Kolkata\``
        );
      }
    }

    const curr = getSetting(dbKey);
    if (String(curr) === String(newVal)) {
      return m.reply(`ℹ️ *${dbKey}* is already set to *${displayValue(dbKey, curr)}*`);
    }

    await setSetting(dbKey, newVal);

    const display = BOOL_KEYS.has(dbKey)
      ? (newVal === 'true' ? '✅ ON' : '❌ OFF')
      : PRESENCE_KEYS.has(dbKey)
        ? displayPresence(newVal)
        : `*${newVal}*`;

    return m.reply(`✅ *${dbKey}* updated to ${display}`);
  },
};
