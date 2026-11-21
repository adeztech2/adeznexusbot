import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'removebg',
  aliases:     ['erasebg', 'bgremove', 'nobg', 'rmbg'],
  description: 'Remove background from an image',
  usage:       'removebg  (reply to an image, or provide URL)',

  async execute(sock, m, args) {
    const imageUrl = await quotedImageUrl(m) || args.find(a => a.startsWith('http'));
    if (!imageUrl) return m.reply('❌ Reply to an image or provide an image URL.');
    await m.react('✂️');
    try {
      const data = await giftedGetRetry('/api/tools/removebg', { url: imageUrl }, 60_000);
      if (!data?.success || !data?.result) throw new Error('Background removal failed.');
      const out = data.result.image_url || data.result.preview;
      if (!out) throw new Error('No output image URL.');
      await sock.sendMessage(m.from, {
        image:   { url: out },
        caption: `✂️ *Background Removed*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌'); m._failed = true;
      return m.reply(`❌ Background removal failed: ${err.message}`);
    }
  },
}
