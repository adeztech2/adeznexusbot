import { textInput } from '../../lib/utils/cmdUtils.js';

const base = { category: 'fun', owner: false, group: false, private: false };

function need(m, text) {
  if (!text) { m.reply('❌ Send some text or reply to a message.'); return false; }
  return true;
}

export default [
  {
    ...base,
    name: 'mock',
    aliases: ['spongebob'],
    description: 'sPoNgE-cAsE some text',
    usage: 'mock <text>  |  reply to a message',
    async execute(sock, m) {
      const text = textInput(m);
      if (!need(m, text)) return;
      let i = 0;
      const out = [...text.toLowerCase()].map(ch => (/[a-z]/.test(ch) ? (i++ % 2 ? ch : ch.toUpperCase()) : ch)).join('');
      return m.reply(out);
    },
  },
  {
    ...base,
    name: 'reverse',
    aliases: ['rev'],
    description: 'Reverse some text',
    usage: 'reverse <text>  |  reply to a message',
    async execute(sock, m) {
      const text = textInput(m);
      if (!need(m, text)) return;
      return m.reply([...text].reverse().join(''));
    },
  },
  {
    ...base,
    name: 'clap',
    aliases: [],
    description: 'Put 👏 between 👏 words',
    usage: 'clap <text>  |  reply to a message',
    async execute(sock, m) {
      const text = textInput(m);
      if (!need(m, text)) return;
      return m.reply(text.trim().split(/\s+/).join(' 👏 '));
    },
  },
];
