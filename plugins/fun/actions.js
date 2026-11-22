import { getMentionedJids } from '../../lib/connection/helper.js';
import { pick, hashPercent } from '../../lib/utils/cmdUtils.js';
import { numOf } from '../../lib/utils/groupUtils.js';

const base = { category: 'fun', owner: false, group: false, private: false };

const ROASTS = [
  '{t} is the reason the "Are you sure?" button exists.',
  '{t} has the energy of a phone at 1% that still says "I\'m fine".',
  '{t} brings the same energy as a loading bar stuck at 99%.',
  '{t} treats "reply later" like a lifestyle.',
  '{t} is proof that autocorrect has limits.',
  '{t} would get lost in a straight line with GPS on. Respect the consistency.',
  '{t} says "5 minutes" and means "see you next week".',
  '{t} is the human version of a tab that\'s been open since 2019.',
];

const COMPLIMENTS = [
  '{t} makes every chat better just by being in it. 🌟',
  '{t} has great energy and an even better sense of humour. 😄',
  '{t} is the kind of person people are glad to know. 💛',
  '{t} is smarter than the average search result. 🧠',
  '{t} could make Monday feel like Friday. 🎉',
  '{t} is a legend and everyone knows it. 👑',
];

const AURAS = ['crimson', 'golden', 'violet', 'emerald', 'sky blue', 'silver', 'rose', 'amber', 'indigo', 'turquoise'];

async function targetOf(sock, m, args, fallbackToSelf = false) {
  const targets = await getMentionedJids(m, sock, args);
  return targets[0] || (fallbackToSelf ? m.sender : null);
}

function action(name, emoji, verb, aliases = []) {
  return {
    ...base,
    name,
    aliases,
    description: `${name[0].toUpperCase() + name.slice(1)} someone (just for fun)`,
    usage: `${name} @user  |  reply to a message`,
    async execute(sock, m, args) {
      const target = await targetOf(sock, m, args);
      if (!target) return m.reply(`❌ @mention someone or reply to their message.\n\nExample: ${name} @user`);
      return sock.sendMessage(m.from, {
        text: `${emoji} @${numOf(m.sender)} ${verb} @${numOf(target)}!`,
        mentions: [m.sender, target],
      }, { quoted: m });
    },
  };
}

export default [
  action('hug', '🤗', 'gives a big hug to', ['cuddle']),
  action('pat', '🥰', 'pats', ['headpat']),
  action('slap', '👋', 'playfully slaps', []),
  action('highfive', '🙌', 'high-fives', ['hi5']),
  {
    ...base,
    name: 'roast',
    aliases: [],
    description: 'A light-hearted roast (all in good fun)',
    usage: 'roast [@user]  |  reply to a message',
    async execute(sock, m, args) {
      const t = await targetOf(sock, m, args, true);
      return sock.sendMessage(m.from, {
        text: `🔥 ${pick(ROASTS).replace('{t}', `@${numOf(t)}`)}\n\n_(just kidding, you're great)_`,
        mentions: [t],
      }, { quoted: m });
    },
  },
  {
    ...base,
    name: 'compliment',
    aliases: ['praise'],
    description: 'Send someone a compliment',
    usage: 'compliment [@user]  |  reply to a message',
    async execute(sock, m, args) {
      const t = await targetOf(sock, m, args, true);
      return sock.sendMessage(m.from, {
        text: pick(COMPLIMENTS).replace('{t}', `@${numOf(t)}`),
        mentions: [t],
      }, { quoted: m });
    },
  },
  {
    ...base,
    name: 'aura',
    aliases: [],
    description: "Read someone's aura (same result every time)",
    usage: 'aura [@user]',
    async execute(sock, m, args) {
      const t = await targetOf(sock, m, args, true);
      const seed = numOf(t);
      const pct = hashPercent(seed + 'aura');
      const colour = AURAS[hashPercent(seed + 'colour') % AURAS.length];
      return sock.sendMessage(m.from, {
        text: `✨ *Aura of @${seed}*\n\nColour: ${colour}\nStrength: ${pct}%`,
        mentions: [t],
      }, { quoted: m });
    },
  },
];
