import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'photoeditor3',
  aliases:     ['photoedit3', 'editpic3', 'aiphoto3'],
  description: 'Edit a photo with AI v3 (advanced, reply to image + prompt)',
  usage:       'photoeditor3 <prompt>  (reply to image, or: photoeditor3 <url> <prompt>)',

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
      const data = await giftedGetRetry('/api/tools/photoeditorv3', { url: imageUrl, prompt }, 60_000);
      if (!data?.success) throw new Error(data?.message || 'Edit failed.');
      const out = data.result?.output || data.result?.all_outputs?.[0];
      if (!out) throw new Error('No output image in response.');
      await sock.sendMessage(m.from, {
        image:   { url: out },
        caption: `🎨 *Photo Edited v3*\n✏️ ${prompt}\n🤖 Model: ${data.result?.model || 'auto'}\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Photo edit v3 failed: ${err.message}`);
    }
  },
}
