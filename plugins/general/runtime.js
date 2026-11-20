import { sendBtnOrText, getFooter } from '../../lib/buttonHandler.js';
import { getSetting } from '../../lib/database/settings.js';

export default {
  name: 'uptime',
  aliases: ['runtime', 'run', 'up'],
  description: 'Check how long the bot has been running',
  usage: 'uptime',
  category: 'general',
  owner: false,
  group: false,
  private: false,

  async execute(sock, m, args) {
    const prefix = getSetting('prefix') || '.';

    const uptimeMs = process.uptime() * 1000;
    const days    = Math.floor(uptimeMs / 86_400_000);
    const hours   = Math.floor((uptimeMs % 86_400_000) / 3_600_000);
    const minutes = Math.floor((uptimeMs % 3_600_000) / 60_000);
    const seconds = Math.floor((uptimeMs % 60_000) / 1_000);

    await sendBtnOrText(sock, m.from, {
      title: '',
      text: `⏱️ Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s`,
      footer: getFooter(),
      buttons: [
        { id: `${prefix}ping`, text: '⚡ Ping' },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🌐 GitHub',
            url: 'https://github.com/mauricegift/parapanda-md',
          }),
        },
      ],
    });
  },
};
