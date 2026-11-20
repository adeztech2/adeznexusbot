import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name: 'ebase', aliases: ['tobase64', 'base64encode', 'ebase64', 'b64encode'],
  description: 'Encode text to Base64', usage: 'ebase <text>',
  async execute(sock, m, args) {
    const text = args.join(' ') || m.quoted?.text;
    if (!text) return m.reply('❌ Provide text to encode.');
    return m.reply(`🔐 *Base64 Encoded*\n\n${Buffer.from(text).toString('base64')}\n\n${getFooter()}`);
  },
}
