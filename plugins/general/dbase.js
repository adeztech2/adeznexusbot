import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name: 'dbase', aliases: ['debase', 'debase64', 'base64decode', 'frombase64', 'b64decode'],
  description: 'Decode Base64 to text', usage: 'dbase <base64>',
  async execute(sock, m, args) {
    const b64 = args.join(' ') || m.quoted?.text;
    if (!b64) return m.reply('❌ Provide Base64 to decode.');
    try {
      return m.reply(`🔓 *Base64 Decoded*\n\n${Buffer.from(b64.trim(), 'base64').toString('utf-8')}\n\n${getFooter()}`);
    } catch { return m.reply('❌ Invalid Base64 input.'); }
  },
}
