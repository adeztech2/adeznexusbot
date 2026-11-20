import axios from 'axios';
import { GEMINI_KEYS } from '../../config.js';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const OCR_PROMPT =
  'Extract ALL text from this image exactly as it appears. ' +
  'Preserve formatting, line breaks, and punctuation. ' +
  'Do not summarize or interpret — only transcribe the visible text. ' +
  'If there is no text, reply with: "No text found."';

function isQuotaError(err) {
  const status = err?.response?.status;
  const msg    = (err?.response?.data?.error?.message || err.message || '').toLowerCase();
  return status === 429 ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('resource exhausted');
}

function guessMime(buffer, hint = '') {
  if (buffer[0] === 0xFF && buffer[1] === 0xD8)               return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50)               return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49)               return 'image/gif';
  if (buffer.slice(0,4).toString() === 'RIFF' &&
      buffer.slice(8,12).toString() === 'WEBP')               return 'image/webp';
  if (/\.png(\?|$)/i.test(hint))  return 'image/png';
  if (/\.gif(\?|$)/i.test(hint))  return 'image/gif';
  if (/\.webp(\?|$)/i.test(hint)) return 'image/webp';
  return 'image/jpeg';
}

export async function extractTextFromImage(imageBuffer, mimeHint = '') {
  const keys = GEMINI_KEYS;
  if (!keys.length)
    throw new Error('No Gemini API keys configured — add API_KEYS to .env');

  const mimeType = /^image\//.test(mimeHint) ? mimeHint : guessMime(imageBuffer, mimeHint);
  const base64   = imageBuffer.toString('base64');

  let lastErr;
  for (let i = 0; i < keys.length; i++) {
    try {
      const res = await axios.post(`${GEMINI_URL}?key=${keys[i]}`, {
        contents: [{
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: OCR_PROMPT },
          ],
        }],
      }, { timeout: 60_000 });

      return res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (err) {
      lastErr = err;
      if (isQuotaError(err) && i < keys.length - 1) {
        console.warn(`[OCR] Key slot #${i + 1} hit quota — trying next key...`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function extractTextFromUrl(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30_000 });
  return extractTextFromImage(Buffer.from(res.data), url);
}
