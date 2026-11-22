import { safeGet } from '../../lib/utils/safeUrl.js';

function getExtensionFromMime(mime) {
  const m = mime.split(';')[0].trim().toLowerCase();
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/bmp': '.bmp',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv',
    'video/quicktime': '.mov', 'video/x-msvideo': '.avi',
    'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
    'audio/webm': '.weba', 'audio/mp4': '.m4a', 'audio/aac': '.aac',
    'audio/flac': '.flac',
    'application/pdf': '.pdf', 'application/zip': '.zip',
    'application/json': '.json', 'application/xml': '.xml',
    'text/plain': '.txt', 'text/html': '.html', 'text/css': '.css',
    'text/javascript': '.js', 'text/csv': '.csv', 'text/xml': '.xml',
    'application/javascript': '.js',
  };
  return map[m] || '';
}

function isTextContent(mime) {
  const m = mime.split(';')[0].trim().toLowerCase();
  return (
    m.startsWith('text/') ||
    m.includes('json') ||
    m.includes('xml') ||
    m.includes('javascript') ||
    m.includes('yaml') ||
    m.includes('sql') ||
    m.includes('csv')
  );
}

function extractUrl(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

export default {
  name: 'fetch',
  aliases: ['get', 'testapi', 'curl'],
  description: 'Fetch and display content from a URL',
  usage: 'fetch <url>',
  category: 'general',
  owner: false,
  group: false,
  private: false,

  async execute(sock, m, args) {
    const q = args.join(' ').trim();

    const quotedText =
      m.quoted?.text ||
      m.quoted?.message?.conversation ||
      m.quoted?.message?.extendedTextMessage?.text ||
      m.quoted?.message?.imageMessage?.caption ||
      m.quoted?.message?.videoMessage?.caption ||
      '';

    let url = q || extractUrl(quotedText);

    if (!url) {
      return m.reply('❌ Provide a URL or quote a message containing a link.');
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    await m.react('🌐');

    try {
      const response = await safeGet(url, {
        responseType: 'arraybuffer',
        validateStatus: () => true,
        timeout: 60000,
        maxContentLength: 20 * 1024 * 1024,
        maxBodyLength: 20 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const buffer = Buffer.from(response.data);

      const urlParts = url.split('?')[0].split('/');
      let filename = urlParts.pop() || 'file';
      if (filename.length > 100) filename = filename.substring(0, 100);
      if (!filename.includes('.') || filename.startsWith('.')) {
        const ext = getExtensionFromMime(contentType);
        filename = filename.replace(/^\.+/, '') || 'file';
        filename += ext;
      }

      if (contentType.includes('image/')) {
        await m.react('✅');
        return sock.sendMessage(m.from, { image: buffer, caption: url }, { quoted: m });
      }

      if (contentType.includes('video/')) {
        await m.react('✅');
        return sock.sendMessage(m.from, { video: buffer, caption: url }, { quoted: m });
      }

      if (contentType.includes('audio/')) {
        await m.react('✅');
        return sock.sendMessage(
          m.from,
          { audio: buffer, mimetype: contentType.split(';')[0], fileName: filename },
          { quoted: m }
        );
      }

      if (isTextContent(contentType)) {
        const text = buffer.toString('utf-8');

        if (contentType.includes('json')) {
          try {
            const json = JSON.parse(text);
            const formatted = JSON.stringify(json, null, 2);
            await m.react('✅');
            return m.reply('```json\n' + formatted + '\n```');
          } catch {
            await m.react('✅');
            return m.reply(text);
          }
        }

        const lang = contentType.includes('javascript') ? 'javascript'
          : contentType.includes('css') ? 'css'
          : contentType.includes('xml') ? 'xml'
          : contentType.includes('sql') ? 'sql'
          : contentType.includes('yaml') ? 'yaml'
          : '';

        await m.react('✅');
        return m.reply(lang ? '```' + lang + '\n' + text + '\n```' : text);
      }

      await m.react('✅');
      return sock.sendMessage(
        m.from,
        { document: buffer, mimetype: contentType.split(';')[0] || 'application/octet-stream', fileName: filename },
        { quoted: m }
      );

    } catch (err) {
      console.error('[fetch] error:', err.message);
      await m.react('❌'); m._failed = true;
      return m.reply('❌ Failed to fetch: ' + (err.message || 'Unknown error'));
    }
  },
};
