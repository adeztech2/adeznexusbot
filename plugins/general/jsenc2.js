import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'jsenc2',
  aliases:     ['jsobfuscate2', 'jsencrypt2', 'jsobf2'],
  description: 'Obfuscate / encrypt JavaScript code (advanced v2)',
  usage:       'jsenc2 <code>  OR  reply to a .js file / code message',

  async execute(sock, m, args) {
    const code = args.join(' ').trim() || await quotedDocText(m);
    if (!code) return m.reply('❌ Provide JS code or reply to a JS file.');
    await m.react('🔐');
    try {
      const data = await giftedGet('/api/tools/encryptv3', { code }, 30_000);
      if (!data?.success || !data?.result) throw new Error('Obfuscation failed.');
      const encrypted = data.result.encrypted_code || String(data.result);
      const buf = Buffer.from(encrypted, 'utf-8');
      await sock.sendMessage(m.from, {
        document: buf,
        mimetype: 'application/javascript',
        fileName: 'obfuscated_v2.js',
        caption:  `🔐 *JS Obfuscated (v2)*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ JS obfuscation v2 failed: ${err.message}`);
    }
  },
}
