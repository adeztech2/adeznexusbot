import crypto from 'crypto';
import { rawText, textInput, clamp, pick } from '../../lib/utils/cmdUtils.js';

const base = { category: 'devtools', owner: false, group: false, private: false };

const ALGOS = ['md5', 'sha1', 'sha256', 'sha512'];

const LOREM = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in ' +
  'reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in ' +
  'culpa qui officia deserunt mollit anim id est laborum').split(' ');

export default [
  {
    ...base,
    name: 'urlenc',
    aliases: ['urlencode'],
    description: 'URL-encode text',
    usage: 'urlenc <text>  |  reply to a message',
    async execute(sock, m) {
      const text = textInput(m);
      if (!text) return m.reply('❌ Send some text or reply to a message.');
      return m.reply(encodeURIComponent(text));
    },
  },
  {
    ...base,
    name: 'urldec',
    aliases: ['urldecode'],
    description: 'Decode URL-encoded text',
    usage: 'urldec <text>  |  reply to a message',
    async execute(sock, m) {
      const text = textInput(m);
      if (!text) return m.reply('❌ Send some text or reply to a message.');
      try {
        return m.reply(decodeURIComponent(text.trim()));
      } catch {
        return m.reply('❌ That is not valid URL-encoded text.');
      }
    },
  },
  {
    ...base,
    name: 'hash',
    aliases: ['checksum'],
    description: 'Hash text with md5, sha1, sha256 (default) or sha512',
    usage: 'hash [md5|sha1|sha256|sha512] <text>',
    async execute(sock, m, args) {
      let algo = 'sha256';
      let text = rawText(m);

      if (args[0] && ALGOS.includes(args[0].toLowerCase()) && args.length > 1) {
        algo = args[0].toLowerCase();
        text = text.replace(/^\S+\s*/, '');
      }
      text = text || m.quoted?.text || '';
      if (!text) return m.reply('❌ Provide text to hash.\n\nExample: hash sha256 hello');

      return m.reply(`#️⃣ *${algo.toUpperCase()}*\n\n\`\`\`${crypto.createHash(algo).update(text).digest('hex')}\`\`\``);
    },
  },
  {
    ...base,
    name: 'uuid',
    aliases: ['guid'],
    description: 'Generate random UUIDs (v4)',
    usage: 'uuid [count 1-10]',
    async execute(sock, m, args) {
      const n = clamp(parseInt(args[0], 10) || 1, 1, 10);
      return m.reply('```' + Array.from({ length: n }, () => crypto.randomUUID()).join('\n') + '```');
    },
  },
  {
    ...base,
    name: 'lorem',
    aliases: ['ipsum'],
    description: 'Generate placeholder text',
    usage: 'lorem [words 5-200]',
    async execute(sock, m, args) {
      const n = clamp(parseInt(args[0], 10) || 30, 5, 200);
      const words = Array.from({ length: n }, () => pick(LOREM));
      words[0] = words[0][0].toUpperCase() + words[0].slice(1);
      return m.reply(words.join(' ') + '.');
    },
  },
];
