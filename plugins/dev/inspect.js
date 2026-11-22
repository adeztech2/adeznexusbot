import vm from 'vm';
import sharp from 'sharp';
import { rawText, textInput } from '../../lib/utils/cmdUtils.js';

const base = { category: 'devtools', owner: false, group: false, private: false };

const HTTP = {
  100: 'Continue', 101: 'Switching Protocols',
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 206: 'Partial Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  408: 'Request Timeout', 409: 'Conflict', 410: 'Gone', 413: 'Payload Too Large', 415: 'Unsupported Media Type',
  418: "I'm a teapot", 422: 'Unprocessable Content', 429: 'Too Many Requests',
  500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
};

const b64urlDecode = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

// Runs the user's regex in a sandbox with a time limit so a catastrophic pattern can't freeze the bot.
function runRegex(pattern, flags, text) {
  const ctx = vm.createContext({ pattern, flags, text, out: null });
  vm.runInContext(`
    const re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
    const res = [];
    let mt;
    while ((mt = re.exec(text)) !== null && res.length < 15) {
      res.push(mt.index + ': ' + JSON.stringify(mt[0]) + (mt.length > 1 ? '  groups: ' + JSON.stringify(mt.slice(1)) : ''));
      if (mt[0] === '') re.lastIndex++;
    }
    out = res.join('\\n');
  `, ctx, { timeout: 500 });
  return ctx.out;
}

function parseColor(input) {
  const s = input.trim().toLowerCase();
  let mt = s.match(/^#?([0-9a-f]{6})$/);
  if (mt) return [0, 2, 4].map(i => parseInt(mt[1].slice(i, i + 2), 16));
  mt = s.match(/^#?([0-9a-f]{3})$/);
  if (mt) return [...mt[1]].map(c => parseInt(c + c, 16));
  mt = s.match(/^(?:rgb\()?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/);
  if (mt && [mt[1], mt[2], mt[3]].every(n => Number(n) <= 255)) return [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  return null;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

export default [
  {
    ...base,
    name: 'json',
    aliases: ['jsonfmt', 'prettyjson'],
    description: 'Validate and pretty-print JSON (or minify with "min")',
    usage: 'json <json>  |  json min <json>  |  reply to a message',
    async execute(sock, m, args) {
      let text = textInput(m).trim();
      let minify = false;
      if (/^min\b/i.test(text) && rawText(m)) { minify = true; text = text.replace(/^min\s*/i, ''); }
      if (!text) return m.reply('❌ Send JSON or reply to a message containing it.');

      try {
        const parsed = JSON.parse(text);
        return m.reply('```' + JSON.stringify(parsed, null, minify ? 0 : 2) + '```');
      } catch (err) {
        return m.reply(`❌ Invalid JSON\n\n${err.message}`);
      }
    },
  },
  {
    ...base,
    name: 'jwt',
    aliases: ['jwtdecode'],
    description: 'Decode a JWT (header and payload — the signature is NOT verified)',
    usage: 'jwt <token>',
    async execute(sock, m) {
      const token = textInput(m).trim();
      const parts = token.split('.');
      if (parts.length !== 3) return m.reply('❌ That does not look like a JWT (expected 3 parts separated by dots).');

      try {
        const header  = JSON.parse(b64urlDecode(parts[0]));
        const payload = JSON.parse(b64urlDecode(parts[1]));
        const when = (n) => (typeof n === 'number' ? new Date(n * 1000).toISOString() : null);

        let times = '';
        if (payload.iat) times += `\nIssued: ${when(payload.iat)}`;
        if (payload.exp) times += `\nExpires: ${when(payload.exp)} ${payload.exp * 1000 < Date.now() ? '(expired)' : '(valid)'}`;

        return m.reply(
          `🔓 *JWT*\n\n*Header*\n\`\`\`${JSON.stringify(header, null, 2)}\`\`\`\n*Payload*\n\`\`\`${JSON.stringify(payload, null, 2)}\`\`\`${times}\n\n_Decoded only — the signature is not verified._`
        );
      } catch {
        return m.reply('❌ Could not decode that token.');
      }
    },
  },
  {
    ...base,
    name: 'regex',
    aliases: ['regextest', 're'],
    description: 'Test a regular expression against some text',
    usage: 'regex /\\d+/g abc 123 def 45  |  regex \\d+ | abc 123',
    async execute(sock, m) {
      const input = rawText(m);
      let pattern, flags = '', text;

      let mt = input.match(/^\/((?:\\.|[^/\\])+)\/([a-z]*)\s+([\s\S]+)$/);
      if (mt) {
        [, pattern, flags, text] = mt;
      } else if (input.includes('|')) {
        const i = input.indexOf('|');
        pattern = input.slice(0, i).trim();
        text = input.slice(i + 1).trim();
      }

      if (!pattern || !text) {
        return m.reply('❌ Usage:\nregex /pattern/flags text\nregex pattern | text');
      }
      if (text.length > 3000) return m.reply('❌ Text too long (max 3000 characters).');

      try {
        const out = runRegex(pattern, flags, text);
        return m.reply(out ? `✅ *Matches*\n\`\`\`${out}\`\`\`` : '❌ No matches.');
      } catch (err) {
        const msg = /timed out/i.test(err.message) ? 'The pattern took too long to run (possible catastrophic backtracking).' : err.message;
        return m.reply(`❌ ${msg}`);
      }
    },
  },
  {
    ...base,
    name: 'timestamp',
    aliases: ['ts', 'epoch'],
    description: 'Convert between Unix timestamps and dates',
    usage: 'timestamp  |  timestamp 1700000000  |  timestamp 2026-01-31 12:00',
    async execute(sock, m) {
      const input = rawText(m).trim();
      const show = (d) =>
        `🕒 *${d.toISOString()}*\nUnix (s): ${Math.floor(d.getTime() / 1000)}\nUnix (ms): ${d.getTime()}`;

      if (!input) return m.reply(show(new Date()));

      if (/^-?\d+$/.test(input)) {
        const n = Number(input);
        const d = new Date(input.length >= 13 ? n : n * 1000);
        if (Number.isNaN(d.getTime())) return m.reply('❌ That timestamp is out of range.');
        return m.reply(show(d));
      }

      const d = new Date(input);
      if (Number.isNaN(d.getTime())) return m.reply('❌ Could not understand that date. Try: 2026-01-31 12:00');
      return m.reply(show(d) + '\n\n_Dates without a time zone are read in the bot server\'s time zone._');
    },
  },
  {
    ...base,
    name: 'color',
    aliases: ['colour', 'hex'],
    description: 'Convert a colour between HEX, RGB and HSL and preview it',
    usage: 'color #ff8800  |  color 255 136 0',
    async execute(sock, m) {
      const rgb = parseColor(rawText(m));
      if (!rgb) return m.reply('❌ Give a colour like #ff8800, #f80, or 255 136 0');

      const hex = '#' + rgb.map(n => n.toString(16).padStart(2, '0')).join('');
      const [h, s, l] = rgbToHsl(...rgb);
      const caption = `🎨 *${hex.toUpperCase()}*\nRGB: rgb(${rgb.join(', ')})\nHSL: hsl(${h}, ${s}%, ${l}%)`;

      try {
        const img = await sharp({
          create: { width: 300, height: 300, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } },
        }).png().toBuffer();
        return sock.sendMessage(m.from, { image: img, caption }, { quoted: m });
      } catch {
        return m.reply(caption);
      }
    },
  },
  {
    ...base,
    name: 'httpcode',
    aliases: ['httpstatus'],
    description: 'Explain an HTTP status code',
    usage: 'httpcode 404',
    async execute(sock, m, args) {
      const code = parseInt(args[0], 10);
      if (!code) return m.reply('❌ Give a status code.\n\nExample: httpcode 404');
      const name = HTTP[code];
      if (!name) {
        const klass = { 1: 'Informational', 2: 'Success', 3: 'Redirection', 4: 'Client error', 5: 'Server error' }[Math.floor(code / 100)];
        return m.reply(klass ? `ℹ️ ${code} is not in my list, but ${Math.floor(code / 100)}xx codes are: ${klass}.` : '❌ Not a valid HTTP status code.');
      }
      return m.reply(`🌐 *${code} ${name}*`);
    },
  },
  {
    ...base,
    name: 'numbase',
    aliases: ['baseconv'],
    description: 'Convert a number between bases (2–36)',
    usage: 'numbase 255 10 16',
    async execute(sock, m, args) {
      const [value, fromRaw, toRaw] = args;
      const from = parseInt(fromRaw, 10);
      const to   = parseInt(toRaw, 10);
      if (!value || ![from, to].every(b => b >= 2 && b <= 36)) {
        return m.reply('❌ Usage: numbase <number> <from base> <to base>\n\nExample: numbase 255 10 16');
      }
      const n = parseInt(value, from);
      if (Number.isNaN(n) || n.toString(from).toLowerCase() !== value.toLowerCase().replace(/^0+(?=.)/, '')) {
        return m.reply(`❌ "${value}" is not a valid base-${from} number (or is too large).`);
      }
      return m.reply(`🔢 ${value} (base ${from}) = *${n.toString(to).toUpperCase()}* (base ${to})`);
    },
  },
];
