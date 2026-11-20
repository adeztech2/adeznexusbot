import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'createpdf',
  aliases:     ['topdf', 'makepdf', 'pdf', 'txtpdf'],
  description: 'Create a PDF from text (or quote a text message)',
  usage:       'createpdf <filename> <text>  OR  reply to a message with: createpdf <filename>',

  async execute(sock, m, args) {
    const pdfName = args[0] || 'document';
    const content = args.slice(1).join(' ').trim() || m.quoted?.text?.trim();
    if (!content) return m.reply(
      '❌ Provide content.\n`,createpdf myfile Some text`\nor reply to a text message with `,createpdf myfile`'
    );
    await m.react('⏳');
    try {
      const buf = await giftedGetBuffer('/api/tools/topdf', { query: content }, 60_000);
      const fileName = pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`;
      await sock.sendMessage(m.from, {
        document: buf,
        mimetype: 'application/pdf',
        fileName,
        caption:  `📄 *${fileName}*\n\n${getFooter()}`,
      }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ PDF creation failed: ${err.message}`);
    }
  },
}
