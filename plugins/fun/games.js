import { rawText, pick } from '../../lib/utils/cmdUtils.js';

const base = { category: 'fun', owner: false, group: false, private: false };

const BALL = [
  'It is certain.', 'Without a doubt.', 'Yes, definitely.', 'Most likely.', 'Signs point to yes.',
  'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.',
  "Don't count on it.", 'My reply is no.', 'Very doubtful.', 'Outlook not so good.',
];

const RPS = { rock: '🪨', paper: '📄', scissors: '✂️' };
const RPS_ALIAS = { r: 'rock', p: 'paper', s: 'scissors' };
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

const REELS = ['🍒', '🍋', '🍇', '🍉', '⭐', '💎'];

export default [
  {
    ...base,
    name: 'dice',
    aliases: ['roll'],
    description: 'Roll dice',
    usage: 'dice [NdM]  e.g. dice 2d6',
    async execute(sock, m, args) {
      const mt = (args[0] || '1d6').toLowerCase().match(/^(\d{1,2})d(\d{1,4})$/);
      if (!mt) return m.reply('❌ Use the format NdM, for example: dice 2d6');
      const n = Number(mt[1]);
      const sides = Number(mt[2]);
      if (n < 1 || n > 20 || sides < 2) return m.reply('❌ Roll 1–20 dice with at least 2 sides.');

      const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((a, b) => a + b, 0);
      return m.reply(`🎲 *${n}d${sides}*: ${rolls.join(' + ')}${n > 1 ? ` = *${total}*` : ''}`);
    },
  },
  {
    ...base,
    name: 'coin',
    aliases: ['coinflip', 'toss'],
    description: 'Flip a coin',
    usage: 'coin',
    async execute(sock, m) {
      return m.reply(Math.random() < 0.5 ? '🪙 *Heads*' : '🪙 *Tails*');
    },
  },
  {
    ...base,
    name: '8ball',
    aliases: ['eightball'],
    description: 'Ask the magic 8-ball a yes/no question',
    usage: '8ball <question>',
    async execute(sock, m) {
      const q = rawText(m);
      if (!q) return m.reply('❌ Ask a question.\n\nExample: 8ball will it rain today?');
      return m.reply(`🎱 *${q}*\n\n${pick(BALL)}`);
    },
  },
  {
    ...base,
    name: 'rps',
    aliases: [],
    description: 'Play rock, paper, scissors against the bot',
    usage: 'rps rock|paper|scissors',
    async execute(sock, m, args) {
      const raw = (args[0] || '').toLowerCase();
      const you = RPS_ALIAS[raw] || raw;
      if (!RPS[you]) return m.reply('❌ Choose rock, paper or scissors.\n\nExample: rps rock');

      const bot = pick(Object.keys(RPS));
      const result = you === bot ? "It's a draw 🤝" : BEATS[you] === bot ? 'You win! 🎉' : 'I win! 😎';
      return m.reply(`You: ${RPS[you]} ${you}\nMe: ${RPS[bot]} ${bot}\n\n${result}`);
    },
  },
  {
    ...base,
    name: 'slot',
    aliases: ['slots'],
    description: 'Spin the slot machine',
    usage: 'slot',
    async execute(sock, m) {
      const r = [pick(REELS), pick(REELS), pick(REELS)];
      const same = new Set(r).size;
      const verdict = same === 1 ? '💰 *JACKPOT!*' : same === 2 ? '✨ Two of a kind, nice!' : '❌ No luck, spin again.';
      return m.reply(`🎰 ${r.join(' | ')}\n\n${verdict}`);
    },
  },
  {
    ...base,
    name: 'choose',
    aliases: ['pickone', 'decide'],
    description: 'Let the bot pick between options',
    usage: 'choose pizza | burgers | tacos',
    async execute(sock, m) {
      const options = rawText(m).split(/\||,/).map(s => s.trim()).filter(Boolean);
      if (options.length < 2) return m.reply('❌ Give at least two options separated by | or ,\n\nExample: choose pizza | burgers');
      return m.reply(`🤔 I choose: *${pick(options)}*`);
    },
  },
];
