import { getMentionedJids } from '../../lib/connection/helper.js';
import { rawText, hashPercent } from '../../lib/utils/cmdUtils.js';
import { numOf } from '../../lib/utils/groupUtils.js';

const base = { category: 'fun', owner: false, group: false, private: false };

const bar = (pct) => '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

function shipVerdict(p) {
  if (p >= 90) return 'Soulmates! 💞';
  if (p >= 70) return 'Great match 💖';
  if (p >= 50) return 'Could work 🙂';
  if (p >= 30) return 'Needs effort 😅';
  return 'Not a chance 💔';
}

export default [
  {
    ...base,
    name: 'ship',
    aliases: ['match'],
    description: 'Compatibility between two people (for fun)',
    usage: 'ship @user1 @user2  |  ship @user (pairs you with them)',
    async execute(sock, m, args) {
      const targets = await getMentionedJids(m, sock, args);
      if (!targets.length) return m.reply('❌ @mention one or two people.\n\nExample: ship @user1 @user2');

      const [a, b] = targets.length >= 2 ? targets : [m.sender, targets[0]];
      const pct = hashPercent([numOf(a), numOf(b)].sort().join('+'));

      return sock.sendMessage(m.from, {
        text: `💘 *SHIP*\n\n@${numOf(a)} ❤️ @${numOf(b)}\n\n${bar(pct)} *${pct}%*\n${shipVerdict(pct)}`,
        mentions: [a, b],
      }, { quoted: m });
    },
  },
  {
    ...base,
    name: 'rate',
    aliases: [],
    description: 'Rate anything out of 100 (always the same score for the same thing)',
    usage: 'rate <anything>',
    async execute(sock, m) {
      const thing = rawText(m);
      if (!thing) return m.reply('❌ Tell me what to rate.\n\nExample: rate my cooking');
      const pct = hashPercent(thing.toLowerCase());
      return m.reply(`⭐ *${thing}*\n\n${bar(pct)} *${pct}/100*`);
    },
  },
];
