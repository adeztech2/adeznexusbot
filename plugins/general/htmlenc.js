import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'htmlenc',
  aliases:     ['htmlobfuscate', 'htmlobf', 'htmlencrypt'],
  description: 'Obfuscate / protect HTML code',
  usage:       'htmlenc <html>  OR  reply to an .html file / html text',

  async execute(sock, m, args) {
    const html = args.join(' ').trim() || await quotedDocText(m);
    if (!html) return m.reply('❌ Provide HTML code or reply to an HTML file.\nExample: `,htmlenc <h1>Hello</h1>`');
    await m.react('🔐');
    try {
      const data = await giftedGet('/api/tools/htmlobfuscate', { html }, 30_000);
      if (!data?.success || !data?.result) throw new Error('Obfuscation failed.');
      const obfuscated = data.result.obfuscated || String(data.result);
      const buf = Buffer.from(obfuscated, 'utf-8');
      await sock.sendMessage(m.from, {
        document: buf,
        mimetype: 'text/html',
        fileName: 'obfuscated.html',
        caption:  `🔐 *HTML Obfuscated*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ HTML obfuscation failed: ${err.message}`);
    }
  },
}
