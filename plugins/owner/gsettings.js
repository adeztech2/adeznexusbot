import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { sendInteractiveMessage } = require('gifted-btns');

export default {
  name: 'gsettings',
  aliases: ['gs'],
  description: 'Manage groups the bot is in',
  usage: ',gsettings',
  category: 'owner',
  owner: true,
  group: false,
  private: false,

  async execute(sock, m, args) {
    const jid = m.from;

    let allGroups = [];
    try {
      const chats = await sock.groupFetchAllParticipating();
      allGroups = Object.values(chats).filter(
        g => !g.isCommunity && !g.isCommunityAnnounce
      );
    } catch (err) {
      console.error('[gsettings] failed to fetch groups:', err.message);
      return m.reply('❌ Could not fetch groups.');
    }

    if (allGroups.length === 0) return m.reply('❌ Bot is not in any regular groups.');

    await sendInteractiveMessage(sock, jid, {
      text:   `🤖 *Group Manager*\nBot is in *${allGroups.length}* group(s). Select one to manage.`,
      footer: ',gsettings | select a group',
      interactiveButtons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: 'Select group',
          sections: [{
            title: 'Available Groups',
            rows: allGroups.map((g, i) => ({
              id:          `gsettings:actions:${g.id}`,
              title:       `${i + 1}. ${g.subject}`,
              description: `👥 ${g.size || g.participants?.length || '?'} members`
            }))
          }]
        })
      }]
    }, { quoted: m });
  }
};
