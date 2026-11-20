import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'photoeditor2',
  aliases:     ['photoedit2', 'editpic2', 'aiphoto2'],
  description: 'Edit a photo with AI v2 (reply to image + prompt)',
  usage:       'photoeditor2 <prompt>  (reply to image, or: photoeditor2 <url> <prompt>)',

  async execute(sock, m, args) {
    let imageUrl, prompt;
    if (args[0]?.startsWith('http')) {
      imageUrl = args[0]; prompt = args.slice(1).join(' ');
    } else {
      imageUrl = await quotedImageUrl(m); prompt = args.join(' ');
    }
    if (!imageUrl) return m.reply('❌ Reply to an image or provide an image URL.');
    if (!prompt)   return m.reply('❌ Provide a prompt describing the edit.');
    await m.react('🎨');
    try {
      const buf = await giftedGetBufferRetry('/api/tools/photoeditorv2', { url: imageUrl, prompt }, 60_000);
      await sock.sendMessage(m.from, {
        image:   buf,
        caption: `🎨 *Photo Edited v2*\n✏️ ${prompt}\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Photo edit v2 failed: ${err.message}`);
    }
  },
}
