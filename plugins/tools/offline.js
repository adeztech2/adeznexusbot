import crypto from 'crypto';
import { convertUnit, SUPPORTED_UNITS } from '../../lib/utils/unitConvert.js';
import { rawText, textInput, clamp } from '../../lib/utils/cmdUtils.js';

const base = { category: 'tools', owner: false, group: false, private: false };

function findZone(query) {
  const q = query.trim().toLowerCase().replace(/\s+/g, '_');
  const zones = Intl.supportedValuesOf('timeZone');
  return (
    zones.find(z => z.toLowerCase() === q) ||
    zones.find(z => z.toLowerCase().split('/').pop() === q) ||
    zones.find(z => z.toLowerCase().includes(q)) ||
    null
  );
}

export default [
  {
    ...base,
    name: 'unit',
    aliases: ['units', 'uconvert'],
    description: 'Convert between units (length, mass, volume, data, time, speed, temperature)',
    usage: 'unit 10 km mi  |  unit 100 c f',
    async execute(sock, m, args) {
      const value = parseFloat(args[0]);
      if (args.length < 3 || Number.isNaN(value)) {
        return m.reply(`📏 *Unit converter*\n\nUsage: unit <number> <from> <to>\nExample: unit 10 km mi\n\n${SUPPORTED_UNITS.join('\n')}`);
      }
      try {
        const { result, from, to } = convertUnit(value, args[1], args[2]);
        return m.reply(`📏 ${value} ${from} = *${Number(result.toPrecision(10))} ${to}*`);
      } catch (err) {
        return m.reply(`❌ ${err.message}`);
      }
    },
  },
  {
    ...base,
    name: 'time',
    aliases: ['worldtime', 'tz'],
    description: 'Show the current time in any city or time zone',
    usage: 'time Tokyo  |  time America/New_York',
    async execute(sock, m) {
      const query = rawText(m);
      if (!query) return m.reply('❌ Give a city or time zone.\n\nExample: time Nairobi');

      const zone = findZone(query);
      if (!zone) return m.reply(`❌ No time zone found for "${query}". Try a format like Africa/Nairobi or a city name such as Tokyo.`);

      const now = new Date();
      const text = new Intl.DateTimeFormat('en-GB', {
        timeZone: zone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(now);

      return m.reply(`🕐 *${zone}*\n${text}`);
    },
  },
  {
    ...base,
    name: 'password',
    aliases: ['pass', 'genpass'],
    description: 'Generate a strong random password',
    usage: 'password [length 8-64]',
    async execute(sock, m, args) {
      const len = clamp(parseInt(args[0], 10) || 16, 8, 64);
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?';
      let out = '';
      for (let i = 0; i < len; i++) out += chars[crypto.randomInt(chars.length)];
      return m.reply(`🔐 *Password (${len})*\n\n\`\`\`${out}\`\`\`\n\n_Generated on the bot's server. Don't reuse it elsewhere if you shared this chat._`);
    },
  },
  {
    ...base,
    name: 'wc',
    aliases: ['wordcount', 'count'],
    description: 'Count words, characters and lines in some text',
    usage: 'wc <text>  |  reply to a message',
    async execute(sock, m) {
      const text = textInput(m);
      if (!text) return m.reply('❌ Send some text or reply to a message.');
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const lines = text.split(/\r?\n/).length;
      return m.reply(`🔢 *Text stats*\n\nWords: ${words}\nCharacters: ${text.length}\nWithout spaces: ${text.replace(/\s/g, '').length}\nLines: ${lines}`);
    },
  },
  {
    ...base,
    name: 'poll',
    aliases: [],
    description: 'Create a WhatsApp poll',
    usage: 'poll Question | Option 1 | Option 2 | Option 3',
    async execute(sock, m) {
      const parts = rawText(m).split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length < 3) return m.reply('❌ Provide a question and at least two options.\n\nExample: poll Lunch? | Pizza | Burgers | Salad');
      const [name, ...values] = parts;
      if (values.length > 12) return m.reply('❌ A poll can have at most 12 options.');
      return sock.sendMessage(m.from, { poll: { name, values, selectableCount: 1 } });
    },
  },
];
