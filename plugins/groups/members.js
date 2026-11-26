import { digits } from '../../lib/utils/extra.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const numOf = (jid = '') => jid.split('@')[0].split(':')[0];

const ADD_STATUS = {
  200: '✅ added',
  403: '🔒 their privacy settings block adds (ask them to join with the group link)',
  408: '⏳ they left recently, try again later',
  409: 'ℹ️ already in the group',
  401: '🚫 they blocked the bot',
  500: '❌ failed',
};

export default [
  {
    name: 'add',
    aliases: ['addmember', 'invitenumber'],
    description: 'Add numbers to the group',
    usage: 'add 254711111111 254722222222',
    category: 'group',
    owner: false,
    group: true,
    private: false,
    admin: true,
    botAdmin: true,

    async execute(sock, m, args) {
      const numbers = [...new Set(args.map(digits).filter(n => n.length >= 7 && n.length <= 15))];
      if (!numbers.length) return m.reply('❌ Give me one or more numbers with country code.\n\nExample: .add 254711111111');
      if (numbers.length > 5) return m.reply('❌ Add at most 5 numbers at a time (adding many people fast can get the bot banned).');

      const out = [];
      for (const num of numbers) {
        try {
          const [info] = (await sock.onWhatsApp(num)) || [];
          if (!info?.exists) { out.push(`+${num}: ❌ not on WhatsApp`); continue; }
          const [res] = await sock.groupParticipantsUpdate(m.from, [info.jid], 'add');
          out.push(`+${num}: ${ADD_STATUS[Number(res?.status)] || `status ${res?.status}`}`);
        } catch (e) {
          console.error('add failed:', e.message);
          out.push(`+${num}: ❌ failed`);
        }
        await sleep(1500);
      }
      return m.reply(`➕ *Add members*\n\n${out.join('\n')}`);
    },
  },

  {
    name: 'requests',
    aliases: ['joinrequests', 'pending'],
    description: 'Show pending join requests',
    usage: 'requests',
    category: 'group',
    owner: false,
    group: true,
    private: false,
    admin: true,
    botAdmin: true,

    async execute(sock, m) {
      const list = (await sock.groupRequestParticipantsList(m.from)) || [];
      if (!list.length) return m.reply('✅ No pending join requests.');
      const lines = list.slice(0, 40).map((p, i) => `${i + 1}. +${numOf(p.phone_number || p.jid)}`);
      const more = list.length > 40 ? `\n…and ${list.length - 40} more` : '';
      return m.reply(`📨 *Pending requests (${list.length})*\n\n${lines.join('\n')}${more}\n\nUse *.approve all* or *.reject all*`);
    },
  },

  ...['approve', 'reject'].map(action => ({
    name: action,
    aliases: [],
    description: `${action === 'approve' ? 'Approve' : 'Reject'} join requests (all, or one number)`,
    usage: `${action} all  |  ${action} 254711111111`,
    category: 'group',
    owner: false,
    group: true,
    private: false,
    admin: true,
    botAdmin: true,

    async execute(sock, m, args) {
      const list = (await sock.groupRequestParticipantsList(m.from)) || [];
      if (!list.length) return m.reply('✅ No pending join requests.');
      if (!args[0]) return m.reply(`❌ Say who.\n\n.${action} all\n.${action} 254711111111`);

      const wanted = args[0].toLowerCase() === 'all'
        ? list
        : list.filter(p => numOf(p.phone_number || p.jid) === digits(args[0]));
      if (!wanted.length) return m.reply('❌ That number has no pending request. Use *.requests* to see the list.');

      const jids = wanted.map(p => p.jid);
      await sock.groupRequestParticipantsUpdate(m.from, jids, action);
      return m.reply(`${action === 'approve' ? '✅ Approved' : '🚫 Rejected'} ${jids.length} request${jids.length > 1 ? 's' : ''}.`);
    },
  })),
];
