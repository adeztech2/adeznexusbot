import { safeGet } from '../../lib/utils/safeUrl.js';
import { extractTextFromImage } from '../../lib/utils/ocr.js';
import { sendBtnOrText, getFooter } from '../../lib/buttonHandler.js';

function findImageUrl(text) {
  if (!text) return null;
  const m = text.match(/https?:\/\/\S+\.(jpe?g|png|gif|webp|bmp|svg|ico|avif|tiff?)(\?[^\s]*)?/i);
  return m ? m[0] : null;
}

export default {
  name:        'ocr',
  aliases:     ['extract', 'readtext', 'imgtext', 'textfromimage', 'scantext'],
  description: 'Extract all text from an image using Gemini Vision AI',
  usage:       'ocr  (reply to image / send image with ocr caption / message with image link, or: ocr <image url>)',
  category:    'ai',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    await m.react('🔍');
    try {
      let imageBuffer = null;
      let mimeHint    = '';

      // 1. Current message IS an image (sent with "ocr" as caption)
      if (m.isImage || m.isSticker) {
        imageBuffer = await m.download();
        mimeHint    = m.mimetype || 'image/jpeg';

      // 2. Quoted image / sticker
      } else if (m.quoted?.isImage || m.quoted?.isSticker) {
        imageBuffer = await m.quoted.download();
        mimeHint    = m.quoted.mimetype || 'image/jpeg';

      // 3. Quoted text containing an image URL
      } else if (m.quoted?.text) {
        const url = findImageUrl(m.quoted.text);
        if (url) {
          const res = await safeGet(url, { responseType: 'arraybuffer', timeout: 30_000, maxContentLength: 15 * 1024 * 1024 });
          imageBuffer = Buffer.from(res.data);
          mimeHint    = url;
        }

      // 4. Image URL in args
      } else {
        const url = args.find(a => /^https?:\/\//i.test(a));
        if (url) {
          const res = await safeGet(url, { responseType: 'arraybuffer', timeout: 30_000, maxContentLength: 15 * 1024 * 1024 });
          imageBuffer = Buffer.from(res.data);
          mimeHint    = url;
        }
      }

      if (!imageBuffer) {
        await m.react('❌'); m._failed = true;
        return m.reply(
          `❌ *No image found.*\n\n` +
          `*How to use:*\n` +
          `• Reply to an image → \`ocr\`\n` +
          `• Send an image with \`ocr\` as caption\n` +
          `• Reply to a message with an image link → \`ocr\`\n` +
          `• \`ocr <image url>\`\n\n` +
          `_Aliases: extract, readtext, imgtext, scantext_`
        );
      }

      const result = await extractTextFromImage(imageBuffer, mimeHint);

      if (!result?.trim()) {
        await m.react('❌'); m._failed = true;
        return m.reply('❌ No text found in the image.');
      }

      await m.react('✅');

      await sendBtnOrText(sock, m.from, {
        title:   '🔍 *OCR Result*',
        text:    result,
        footer:  getFooter(),
        buttons: [{
          name:             'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: '📋 Copy Text',
            copy_code:    result,
          }),
        }],
        quoted: m.raw,
      });

    } catch (err) {
      await m.react('❌'); m._failed = true;
      console.error('[OCR] error:', err.message);
      return m.reply('❌ OCR failed: ' + err.message);
    }
  },
};
