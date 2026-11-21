import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name: 'ebinary', aliases: ['tobinary', 'textbinary', 'binaryencode'],
  description: 'Encode text to binary', usage: 'ebinary <text>',
  async execute(sock, m, args) {
    const text = args.join(' ') || m.quoted?.text;
    if (!text) return m.reply('❌ Provide text to encode.');
    const bin = [...Buffer.from(text, 'utf-8')].map(b => b.toString(2).padStart(8, '0')).join(' ');
    return m.reply(`📟 *Binary Encoded*\n\n${bin}\n\n${getFooter()}`);
  },
}
