import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name: 'debinary', aliases: ['dbinary', 'binarytext', 'frombinary', 'binarydecode'],
  description: 'Decode binary to text', usage: 'debinary <binary>',
  async execute(sock, m, args) {
    const bin = args.join(' ') || m.quoted?.text;
    if (!bin) return m.reply('❌ Provide binary to decode.');
    try {
      const text = bin.trim().split(' ').map(b => String.fromCharCode(parseInt(b, 2))).join('');
      return m.reply(`📝 *Binary Decoded*\n\n${text}\n\n${getFooter()}`);
    } catch { return m.reply('❌ Invalid binary input.'); }
  },
}
