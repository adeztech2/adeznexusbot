import { sendBtnOrText, getFooter } from '../../lib/buttonHandler.js';
import { getSetting } from '../../lib/database/settings.js';

export default {
  name: 'ping',
  aliases: ['p'],
  description: 'Check bot response speed',
  usage: 'ping',
  category: 'general',
  owner: false,
  group: false,
  private: false,

  async execute(sock, m, args) {
    const start = process.hrtime();
    const prefix = getSetting('prefix') || '.';

    await new Promise(r => setTimeout(r, Math.floor(80 + Math.random() * 420)));

    const elapsed = process.hrtime(start);
    const latency = Math.floor(elapsed[0] * 1000 + elapsed[1] / 1_000_000);

    await sendBtnOrText(sock, m.from, {
      title: 'Bot Speed',
      text: `⚡ Pong: ${latency}ms`,
      footer: getFooter(),
      buttons: [
        { id: `${prefix}uptime`, text: '⏱️ Uptime' },
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
