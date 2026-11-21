import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'jsenc',
  aliases:     ['jsobfuscate', 'jsencrypt', 'jsobf'],
  description: 'Obfuscate / encrypt JavaScript code',
  usage:       'jsenc <code>  OR  reply to a .js file / code message',

  async execute(sock, m, args) {
    const code = args.join(' ').trim() || await quotedDocText(m);
    if (!code) return m.reply('❌ Provide JS code or reply to a JS file.\nExample: `.jsenc console.log("hi")`');
    await m.react('🔐');
    try {
      const data = await giftedGet('/api/tools/encryptv2', { code }, 30_000);
      if (!data?.success || !data?.result) throw new Error('Obfuscation failed.');
      const encrypted = data.result.encrypted_code || String(data.result);
      const buf = Buffer.from(encrypted, 'utf-8');
      await sock.sendMessage(m.from, {
        document: buf,
        mimetype: 'application/javascript',
        fileName: 'obfuscated.js',
        caption:  `🔐 *JS Obfuscated (v1)*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌'); m._failed = true;
      return m.reply(`❌ JS obfuscation failed: ${err.message}`);
    }
  },
}
