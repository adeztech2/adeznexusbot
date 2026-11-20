import { giftedGet } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';


function isUrl(s) { try { new URL(s); return true; } catch { return false; } }
export default {
  category: 'downloader', owner: false, group: false, private: false,
  name:        'tiktok',
  aliases:     ['tiktokdl', 'ttdl', 'tt', 'tiktokvideo'],
  description: 'Download TikTok videos (no watermark)',
  usage:       'tiktok <tiktok url>',

  async execute(sock, m, args) {
    const url = args[0] || m.quoted?.text?.trim();
    if (!url || !isUrl(url)) return m.reply('❌ Provide a valid TikTok URL.');
    if (!url.includes('tiktok.com')) return m.reply('❌ That does not look like a TikTok URL.');
    await m.react('⬇️');
    try {
      const endpoints = ['tiktok', 'tiktokdlv2', 'tiktokdlv3', 'tiktokdlv4'];
      let result = null;
      for (const ep of endpoints) {
        try {
          const data = await giftedGet(`/api/download/${ep}`, { url }, 25_000);
          if (data?.success && data?.result?.video) { result = data.result; break; }
        } catch {}
      }
      if (!result) throw new Error('All endpoints failed or returned no video.');

      const { title, video, music, cover, author } = result;
      const caption = `🎵 *${title || 'TikTok Video'}*\n👤 ${author?.name || ''}\n\n${getFooter()}`;

      if (!isEnabled('useButtons')) {
        await sock.sendMessage(m.from, {
          video: { url: video }, mimetype: 'video/mp4', caption,
        }, { quoted: m.raw });
        if (music) {
          await sock.sendMessage(m.from, {
            audio: { url: music }, mimetype: 'audio/mpeg',
          }, { quoted: m.raw });
        }
        return m.react('✅');
      }

      const ts      = Date.now();
      const buttons = [{ id: `tt_video_${ts}`, text: '🎬 Video' }];
      if (music) buttons.push({ id: `tt_audio_${ts}`, text: '🎵 Audio Only' });

      await sendBtnOrText(sock, m.from, {
        title:   '🎵 TikTok Downloader',
        text:    `*Title:* ${title || 'TikTok Video'}\n*Author:* ${author?.name || 'Unknown'}\n\n*Select type:*`,
        footer:  getFooter(),
        image:   cover ? { url: cover } : undefined,
        buttons,
      });

      const handle = async (event) => {
        const md  = event.messages[0];
        if (!md?.message) return;
        const sid = extractButtonId(md.message);
        if (!sid || md.key?.remoteJid !== m.from || !sid.includes(ts.toString())) return;
        try {
          if (sid.startsWith('tt_audio_')) {
            await sock.sendMessage(m.from, {
              audio: { url: music }, mimetype: 'audio/mpeg',
            }, { quoted: md });
          } else {
            await sock.sendMessage(m.from, {
              video: { url: video }, mimetype: 'video/mp4', caption,
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
      return m.reply(`❌ TikTok download failed: ${err.message}`);
    }
  },
}
