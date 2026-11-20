import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'remini',
  aliases:     ['enhance', 'restorephoto', 'photoenhance', 'enhancephoto', 'hd'],
  description: 'Enhance and restore photos with AI (Remini)',
  usage:       'remini  (reply to an image, or pass an image URL)',

  async execute(sock, m, args) {
    const imageUrl = await quotedImageUrl(m) || args.find(a => a.startsWith('http'));
    if (!imageUrl) return m.reply('❌ Reply to an image, or provide an image URL.');
    await m.react('✨');
    try {
      const data = await giftedGetRetry('/api/tools/remini', { url: imageUrl }, 60_000);
      if (!data?.success) throw new Error('Enhancement failed.');
      const out = typeof data.result === 'string' ? data.result : data.result?.url;
      if (!out) throw new Error('No output URL in response.');
      await sock.sendMessage(m.from, {
        image:   { url: out },
        caption: `✨ *Photo Enhanced (Remini)*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Enhance failed: ${err.message}`);
    }
  },
}
