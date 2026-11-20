import { giftedGet } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';


function isUrl(s) { try { new URL(s); return true; } catch { return false; } }
export default {
  category: 'downloader', owner: false, group: false, private: false,
  name:        'ig',
  aliases:     ['insta', 'instadl', 'igdl', 'instagram', 'igreel'],
  description: 'Download Instagram reels / videos',
  usage:       'ig <instagram url>',

  async execute(sock, m, args) {
    const url = args[0] || m.quoted?.text?.trim();
    if (!url || !isUrl(url)) return m.reply('❌ Provide a valid Instagram URL.');
    if (!url.includes('instagram.com')) return m.reply('❌ That does not look like an Instagram URL.');
    await m.react('⬇️');
    try {
      const data = await giftedGet('/api/download/instadl', { url }, 60_000);
      if (!data?.success || !data?.result) throw new Error('Failed to fetch content.');

      const { thumbnail, download_url } = data.result;
      if (!download_url) throw new Error('No downloadable content found. Make sure the post is public.');

      const caption = `📸 *Instagram Video*\n\n${getFooter()}`;

      if (!isEnabled('useButtons')) {
        await sock.sendMessage(m.from, {
          video: { url: download_url }, mimetype: 'video/mp4', caption,
        }, { quoted: m.raw });
        return m.react('✅');
      }

      const ts = Date.now();
      await sendBtnOrText(sock, m.from, {
        title:   '📸 Instagram Downloader',
        text:    '*Select download type:*',
        footer:  getFooter(),
        image:   thumbnail ? { url: thumbnail } : undefined,
        buttons: [
          { id: `ig_video_${ts}`, text: '🎬 Video' },
          { id: `ig_doc_${ts}`,   text: '📄 Document' },
        ],
      });

      const handle = async (event) => {
        const md  = event.messages[0];
        if (!md?.message) return;
        const sid = extractButtonId(md.message);
        if (!sid || md.key?.remoteJid !== m.from || !sid.includes(`_${ts}`)) return;
        try {
          if (sid.startsWith('ig_doc_')) {
            await sock.sendMessage(m.from, {
              document: { url: download_url },
              mimetype: 'video/mp4',
              fileName: 'instagram_video.mp4',
              caption,
            }, { quoted: md });
          } else {
            await sock.sendMessage(m.from, {
              video: { url: download_url }, mimetype: 'video/mp4', caption,
            }, { quoted: md });
          }
          await m.react('✅');
        } catch (err) {
          await sock.sendMessage(m.from, { text: `❌ ${err.message}` }, { quoted: md });
        }
      };
      sock.ev.on('messages.upsert', handle);
      setTimeout(() => sock.ev.off('messages.upsert', handle), 300_000);
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Instagram download failed: ${err.message}`);
    }
  },
}
