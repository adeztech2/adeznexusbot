import axios from 'axios';
import { PUTER_AI_URL } from '../../config.js';

const SUPPORTED_MIME = new Set([
  'image/jpeg','image/jpg','image/png','image/gif','image/webp','image/bmp','image/heic','image/heif',
  'video/mp4','video/mpeg','video/mov','video/avi','video/webm','video/3gpp','video/quicktime','video/x-flv','video/mpg',
  'audio/mp3','audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/flac','audio/opus','audio/webm','audio/x-wav','audio/m4a',
  'application/pdf',
]);

function guessMime(buffer) {
  if (!buffer || buffer.length < 4) return 'application/octet-stream';
  const h = buffer.slice(0, 12);
  if (h[0] === 0xFF && h[1] === 0xD8)                                        return 'image/jpeg';
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47)     return 'image/png';
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46)                      return 'image/gif';
  if (h.slice(0, 4).toString('ascii') === 'RIFF' && h.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46)     return 'application/pdf';
  if (h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33)                      return 'audio/mpeg';
  if (h[0] === 0xFF && (h[1] & 0xE0) === 0xE0)                               return 'audio/mpeg';
  if (h.slice(4, 8).toString('ascii') === 'ftyp')                            return 'video/mp4';
  return 'application/octet-stream';
}

/**
 * Route ALL messages (text + media) through Puter AI — free, unlimited.
 * Media is sent as base64 via the puter-ai microservice on VPS (port 5849).
 * No Gemini API keys needed.
 */
export async function geminiChat(prompt, mediaBuffer = null, mimeHint = '', history = [], rawPrompt = null) {
  let mime = (mimeHint || '').split(';')[0].trim();
  if (mediaBuffer && (!mime || mime === 'application/octet-stream' || !SUPPORTED_MIME.has(mime)))
    mime = guessMime(mediaBuffer);

  const hasMedia = !!(mediaBuffer && SUPPORTED_MIME.has(mime));

  const body = {
    prompt: prompt || rawPrompt || '',
    history: history.slice(-10),
    model: 'gpt-4o-mini',
  };

  if (hasMedia) {
    body.mediaBase64 = mediaBuffer.toString('base64');
    body.mimeType    = mime;
  }

  const res = await axios.post(`${PUTER_AI_URL}/ai`, body, {
    timeout: 90_000,
    headers: { 'Content-Type': 'application/json' },
  });

  const text = res.data?.text;
  if (!text && text !== '') throw new Error('[Puter] Empty response: ' + JSON.stringify(res.data).slice(0, 200));

  const savedText = rawPrompt !== null ? rawPrompt : prompt;
  const histLabel = hasMedia ? `[Media: ${mime}] ${savedText}` : savedText;

  console.log(`[Puter AI] OK model=gemini-2.0-flash${hasMedia ? ' [' + mime + ']' : ''} chars=${String(text).length}`);
  return {
    text: String(text).trim(),
    updatedHistory: [
      ...history,
      { role: 'user',  parts: [{ text: histLabel }] },
      { role: 'model', parts: [{ text: String(text).trim() }] },
    ],
  };
}

export async function fetchMediaBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30_000 });
  return { buffer: Buffer.from(res.data), hint: url };
}

export const fetchImageBuffer = fetchMediaBuffer;
