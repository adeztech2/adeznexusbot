import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'photoeditor',
  aliases:     ['photoedit', 'editpic', 'editphoto', 'phototedit', 'aiphoto'],
  description: 'Edit a photo with AI using a text prompt',
  usage:       'photoeditor <prompt>  (reply to image, or: photoeditor <url> <prompt>)',

  async execute(sock, m, args) {
    let imageUrl, prompt;
    if (args[0]?.startsWith('http')) {
      imageUrl = args[0];
      prompt   = args.slice(1).join(' ');
    } else {
      imageUrl = await quotedImageUrl(m);
      prompt   = args.join(' ');
    }
    if (!imageUrl) return m.reply('❌ Reply to an image or provide an image URL.\nExample: `.photoeditor make it a painting`');
    if (!prompt)   return m.reply('❌ Provide a prompt describing the edit.\nExample: `.photoeditor make it a cartoon`');
    await m.react('🎨');
    try {
      const data = await giftedGetRetry('/api/tools/photoeditor', { url: imageUrl, prompt }, 60_000);
      if (!data?.success) throw new Error(data?.message || 'Edit failed.');
      const out = typeof data.result === 'string' ? data.result : data.result?.url;
      if (!out) throw new Error('No output image in response.');
      await sock.sendMessage(m.from, {
        image:   { url: out },
        caption: `🎨 *Photo Edited*\n✏️ ${prompt}\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌'); m._failed = true;
      return m.reply(`❌ Photo edit failed: ${err.message}`);
    }
  },
}
