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
    const prefix = getSetting('prefix') || '.';

    // Real latency: round trip to WhatsApp's servers (same ping Baileys uses
    // for its keep-alive). Falls back to the message's own age if that fails.
    let latency;
    try {
      const t0 = Date.now();
      await sock.query({
        tag: 'iq',
        attrs: { to: '@s.whatsapp.net', type: 'get', xmlns: 'w:p' },
        content: [{ tag: 'ping', attrs: {} }],
      });
      latency = Date.now() - t0;
    } catch {
      const sentAt = Number(m.raw?.messageTimestamp || 0) * 1000;
      latency = sentAt ? Math.max(0, Date.now() - sentAt) : 0;
    }

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
            url: getSetting('repoUrl') || 'https://github.com/adeztech2/baileys',
          }),
        },
      ],
    });
  },
};
