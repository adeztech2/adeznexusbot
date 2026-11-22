import axios from 'axios';
import { rawText } from '../../lib/utils/cmdUtils.js';

export default {
  name:        'tts',
  aliases:     ['say', 'speak'],
  description: 'Turn text into a voice message (max 200 characters)',
  usage:       'tts Hello there  |  tts sw: Habari yako',
  category:    'tools',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m) {
    let text = rawText(m) || m.quoted?.text || '';
    let lang = 'en';

    const mt = text.match(/^([a-z]{2}(?:-[A-Za-z]{2})?):\s*([\s\S]+)$/);
    if (mt) { lang = mt[1]; text = mt[2]; }

    text = text.trim();
    if (!text) return m.reply('❌ Provide text.\n\nExample: tts Hello there\nOther language: tts sw: Habari yako');
    if (text.length > 200) return m.reply('❌ Keep it under 200 characters.');

    let buffer;
    try {
      const res = await axios.get('https://translate.google.com/translate_tts', {
        params: { ie: 'UTF-8', client: 'tw-ob', tl: lang, q: text },
        headers: { 'User-Agent': 'Mozilla/5.0' },
        responseType: 'arraybuffer',
        timeout: 15_000,
      });
      buffer = Buffer.from(res.data);
    } catch {
      throw new Error('Could not generate speech. Check the language code and try again.');
    }

    return sock.sendMessage(m.from, { audio: buffer, mimetype: 'audio/mpeg' }, { quoted: m });
  },
};
