import { getGroupSettings, updateGroupSettings } from '../../lib/database/groupSettings.js';

const ACTIONS = ['delete', 'warn', 'kick'];
const TYPES   = ['all', 'invites'];

export default {
  name:        'antilink',
  aliases:     ['al'],
  description: 'Block links in the group (admins are exempt)',
  usage:       'antilink on|off  |  antilink delete|warn|kick  |  antilink all|invites',
  category:    'group',
  owner:       false,
  group:       true,
  private:     false,
  admin:       true,
  botAdmin:    true,

  async execute(sock, m, args) {
    const opts = args.map(a => a.toLowerCase());
    const bad  = opts.filter(o => !['on', 'off', ...ACTIONS, ...TYPES].includes(o));

    if (bad.length) {
      return m.reply(`❌ Unknown option: ${bad.join(', ')}\n\nUsage: antilink on|off  |  delete|warn|kick  |  all|invites`);
    }

    if (opts.length) {
      await updateGroupSettings(m.from, s => {
        for (const o of opts) {
          if (o === 'on')  s.antilink.enabled = true;
          else if (o === 'off') s.antilink.enabled = false;
          else if (ACTIONS.includes(o)) s.antilink.action = o;
          else if (TYPES.includes(o))   s.antilink.type   = o;
        }
      });
    }

    const { antilink: a, warnLimit } = await getGroupSettings(m.from);

    return m.reply(
      `🔗 *ANTILINK*\n\n` +
      `Status: ${a.enabled ? 'ON ✅' : 'OFF ❌'}\n` +
      `Action: ${a.action}${a.action === 'warn' ? ` (kick at ${warnLimit} warns)` : ''}\n` +
      `Blocks: ${a.type === 'invites' ? 'WhatsApp invite links only' : 'all links'}\n\n` +
      `Options:\n` +
      `• antilink on | off\n` +
      `• antilink delete | warn | kick\n` +
      `• antilink all | invites\n\n` +
      `Admins and the bot owner are never affected.`
    );
  },
};
