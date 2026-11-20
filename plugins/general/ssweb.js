import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'ssweb',
  aliases:     ['screenshot', 'ss', 'fullssweb', 'webss', 'sswebsite'],
  description: 'Take a screenshot of any website',
  usage:       'ssweb <url>',

  async execute(sock, m, args) {
    const url = args.join(' ').trim() || m.quoted?.text?.trim();
    if (!url) return m.reply('❌ Provide a URL.\nExample: `,ssweb https://google.com`');
    await m.react('⏳');
    try {
      const buf = await giftedGetBuffer('/api/tools/ssweb', { url }, 40_000);
      await sock.sendMessage(m.from, {
        image:   buf,
        caption: `📸 *Screenshot*\n🌐 ${url}\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Screenshot failed: ${err.message}`);
    }
  },
}
