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
    const clean = bin.replace(/[^01]/g, '');
    if (!clean.length || clean.length % 8 !== 0) {
      return m.reply('❌ Invalid binary input. Use groups of 8 bits, e.g. `01001000 01101001`');
    }
    const bytes = clean.match(/.{8}/g).map(b => parseInt(b, 2));
    const text  = Buffer.from(bytes).toString('utf-8');
    return m.reply(`📝 *Binary Decoded*\n\n${text}\n\n${getFooter()}`);
  },
}
