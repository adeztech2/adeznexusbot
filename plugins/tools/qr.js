import axios from 'axios';
import { textInput } from '../../lib/utils/cmdUtils.js';

export default {
  name:        'qr',
  aliases:     ['qrcode'],
  description: 'Turn text or a link into a QR code',
  usage:       'qr <text or link>  |  reply to a message',
  category:    'tools',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m) {
    const text = textInput(m).trim();
    if (!text) return m.reply('❌ Provide text or a link.\n\nExample: qr https://example.com');
    if (text.length > 1000) return m.reply('❌ Text is too long for a QR code (max 1000 characters).');

    let buffer;
    try {
      const res = await axios.get('https://api.qrserver.com/v1/create-qr-code/', {
        params: { size: '500x500', margin: 10, data: text },
        responseType: 'arraybuffer',
        timeout: 15_000,
      });
      buffer = Buffer.from(res.data);
    } catch {
      throw new Error('Could not generate the QR code.');
    }

    return sock.sendMessage(m.from, { image: buffer, caption: '✅ QR code ready' }, { quoted: m });
  },
};
