import { textInput, rawText } from '../../lib/utils/cmdUtils.js';

const base = { category: 'tools', owner: false, group: false, private: false, aliases: [] };

const NEED = '❌ Send some text or reply to a message.';

function textCmd(name, aliases, description, fn) {
  return {
    ...base,
    name,
    aliases,
    description,
    usage: `${name} <text>  |  reply to a message`,
    async execute(sock, m) {
      const text = textInput(m);
      if (!text) return m.reply(NEED);
      const out = fn(text);
      if (!out) return m.reply('❌ Nothing to convert.');
      return m.reply(out);
    },
  };
}

// ── case helpers ────────────────────────────────────────────────
const words = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_\-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

// ── cipher helpers ──────────────────────────────────────────────
const rot = (s, n) => {
  n = ((n % 26) + 26) % 26;
  return [...s].map((ch) => {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90)  return String.fromCharCode(((c - 65 + n) % 26) + 65);
    if (c >= 97 && c <= 122) return String.fromCharCode(((c - 97 + n) % 26) + 97);
    return ch;
  }).join('');
};

const atbash = (s) => [...s].map((ch) => {
  const c = ch.charCodeAt(0);
  if (c >= 65 && c <= 90)  return String.fromCharCode(90 - (c - 65));
  if (c >= 97 && c <= 122) return String.fromCharCode(122 - (c - 97));
  return ch;
}).join('');

const MORSE = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
  k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
  u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '@': '.--.-.',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

function toMorse(s) {
  return s.toLowerCase().split(/\s+/).filter(Boolean)
    .map((w) => [...w].map((ch) => MORSE[ch]).filter(Boolean).join(' '))
    .join(' / ');
}
function fromMorse(s) {
  return s.trim().split(/\s*\/\s*/)
    .map((w) => w.trim().split(/\s+/).map((c) => MORSE_REV[c] || '?').join(''))
    .join(' ');
}

// ── fancy fonts (Unicode math alphabets) ────────────────────────
const DOUBLE_HOLES = { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' };
const ITALIC_HOLES = { h: 'ℎ' };

function alphabet(upper, lower, digit, holes = {}) {
  return (ch) => {
    if (holes[ch]) return holes[ch];
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90)  return String.fromCodePoint(upper + (c - 65));
    if (c >= 97 && c <= 122) return String.fromCodePoint(lower + (c - 97));
    if (digit && c >= 48 && c <= 57) return String.fromCodePoint(digit + (c - 48));
    return ch;
  };
}

const FONTS = {
  bold:       alphabet(0x1D400, 0x1D41A, 0x1D7CE),
  italic:     alphabet(0x1D434, 0x1D44E, 0,       ITALIC_HOLES),
  bolditalic: alphabet(0x1D468, 0x1D482, 0),
  script:     alphabet(0x1D4D0, 0x1D4EA, 0),
  double:     alphabet(0x1D538, 0x1D552, 0x1D7D8, DOUBLE_HOLES),
  mono:       alphabet(0x1D670, 0x1D68A, 0x1D7F6),
  sans:       alphabet(0x1D5D4, 0x1D5EE, 0x1D7EC),
  bubble:     alphabet(0x24B6,  0x24D0,  0),
};
const applyFont = (name, text) => [...text].map(FONTS[name]).join('');

// ── upside-down text ────────────────────────────────────────────
const FLIP = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ',
  n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  '.': '˙', ',': "'", "'": ',', '?': '¿', '!': '¡', '(': ')', ')': '(', '[': ']', ']': '[', '_': '‾',
  1: 'Ɩ', 2: 'ᄅ', 3: 'Ɛ', 4: 'ㄣ', 5: 'ϛ', 6: '9', 7: 'ㄥ', 8: '8', 9: '6', 0: '0',
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default [
  textCmd('upper', ['uppercase'], 'Convert text to UPPERCASE', (t) => t.toUpperCase()),
  textCmd('lower', ['lowercase'], 'Convert text to lowercase', (t) => t.toLowerCase()),
  textCmd('title', ['titlecase'], 'Convert Text To Title Case', (t) => t.toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase())),
  textCmd('snake', ['snakecase'], 'Convert text to snake_case', (t) => words(t).map((w) => w.toLowerCase()).join('_')),
  textCmd('camel', ['camelcase'], 'Convert text to camelCase', (t) => words(t).map((w, i) => (i ? cap(w) : w.toLowerCase())).join('')),
  textCmd('kebab', ['kebabcase'], 'Convert text to kebab-case', (t) => words(t).map((w) => w.toLowerCase()).join('-')),
  textCmd('slug', ['slugify'], 'Make a URL-friendly slug from text', (t) =>
    t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')),
  textCmd('rot13', [], 'Encode or decode text with ROT13', (t) => rot(t, 13)),
  textCmd('atbash', [], 'Encode or decode text with the Atbash cipher', atbash),
  textCmd('fliptext', ['upsidetext', 'fliptxt'], 'Write text upside down', (t) =>
    [...t.toLowerCase()].reverse().map((ch) => FLIP[ch] || ch).join('')),
  textCmd('emojify', ['bigtext'], 'Turn letters and numbers into emoji letters', (t) =>
    [...t.toLowerCase()].map((ch) => {
      if (ch >= 'a' && ch <= 'z') return String.fromCodePoint(0x1F1E6 + ch.charCodeAt(0) - 97);
      if (ch >= '0' && ch <= '9') return `${ch}\uFE0F\u20E3`;
      return ch === ' ' ? '   ' : ch;
    }).join(' ')),
  textCmd('palindrome', ['ispalindrome'], 'Check if text reads the same backwards', (t) => {
    const clean = t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (!clean) return '';
    const yes = clean === [...clean].reverse().join('');
    return yes ? '✅ Yes, that is a palindrome.' : '❌ No, that is not a palindrome.';
  }),
  textCmd('shuffle', ['scramble'], 'Shuffle the words (or letters) of some text', (t) => {
    const w = t.trim().split(/\s+/);
    return w.length > 1 ? shuffle(w).join(' ') : shuffle([...t.trim()]).join('');
  }),

  {
    ...base,
    name: 'morse',
    aliases: ['morsecode'],
    description: 'Convert text to Morse code and back',
    usage: 'morse <text or .- -.. morse>  |  reply to a message',
    async execute(sock, m) {
      const text = textInput(m);
      if (!text) return m.reply(NEED);
      const isMorse = /^[.\-\/\s]+$/.test(text);
      const out = isMorse ? fromMorse(text) : toMorse(text);
      if (!out) return m.reply('❌ Nothing to convert.');
      return m.reply(isMorse ? `🔤 ${out}` : `📡 ${out}`);
    },
  },

  {
    ...base,
    name: 'caesar',
    aliases: ['shiftcipher'],
    description: 'Caesar cipher (use a negative shift to decode)',
    usage: 'caesar <shift> <text>   e.g. caesar 3 hello  |  caesar -3 khoor',
    async execute(sock, m, args) {
      const shift = parseInt(args[0], 10);
      if (Number.isNaN(shift)) return m.reply('❌ Give a shift number first.\n\nExample: caesar 3 hello\nDecode: caesar -3 khoor');
      const text = rawText(m).replace(/^\S+\s*/, '') || m.quoted?.text || '';
      if (!text) return m.reply(NEED);
      return m.reply(rot(text, shift));
    },
  },

  {
    ...base,
    name: 'repeat',
    aliases: ['rpt'],
    description: 'Repeat some text a number of times (max 20)',
    usage: 'repeat <times> <text>   e.g. repeat 3 hello',
    async execute(sock, m, args) {
      const n = parseInt(args[0], 10);
      if (Number.isNaN(n) || n < 1) return m.reply('❌ Give how many times first.\n\nExample: repeat 3 hello');
      const text = rawText(m).replace(/^\S+\s*/, '') || m.quoted?.text || '';
      if (!text) return m.reply(NEED);
      const out = Array(Math.min(n, 20)).fill(text).join(' ');
      return m.reply(out.length > 3000 ? out.slice(0, 3000) : out);
    },
  },

  {
    ...base,
    name: 'fancy',
    aliases: ['font', 'fonts'],
    description: 'Write text in fancy fonts',
    usage: 'fancy <text>  |  fancy <style> <text>  (styles: ' + Object.keys(FONTS).join(', ') + ')',
    async execute(sock, m, args) {
      const style = (args[0] || '').toLowerCase();
      if (FONTS[style]) {
        const text = rawText(m).replace(/^\S+\s*/, '') || m.quoted?.text || '';
        if (!text) return m.reply(NEED);
        return m.reply(applyFont(style, text));
      }
      const text = textInput(m);
      if (!text) {
        return m.reply(`❌ Send some text.\n\nExample: fancy Hello\nOne style: fancy bold Hello\n\nStyles: ${Object.keys(FONTS).join(', ')}`);
      }
      const out = Object.keys(FONTS).map((s) => `*${s}*\n${applyFont(s, text)}`).join('\n\n');
      return m.reply(out);
    },
  },
];
