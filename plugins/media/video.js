import { meganDownload } from '../../lib/api/megan.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { sendVideoSmart } from '../../lib/utils/mediaUtils.js';


export default {
  name:        'video',
  aliases:     ['ytv', 'mp4', 'ytmp4', 'dlmp4'],
  description: 'Search and download a YouTube video',
  usage:       'video <video name>',
  category:    'downloader',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const query = args.join(' ');
    if (!query) return m.reply('❌ Provide a video name!');

    await m.react('🔍');

    try {
      await m.react('⬇️');
      const result = await meganDownload('/download/mp4', { q: query }, 120_000);
      const video = {
        name: result.title || 'YouTube video',
        url: result.youtubeUrl || result.url,
        duration: result.searchResult?.duration || result.duration || '?',
        thumbnail: result.thumbnail,
      };

      const caption = `🎬 *${video.name}*\n⏱️ ${video.duration}\n\n${getFooter()}`;

      if (!isEnabled('useButtons')) {
        await sendVideoSmart(sock, m.from, result.download_url, {
          caption,
          title: video.name,
          quoted: m.raw,
        });
        return m.react('✅');
      }

      const ts = Date.now();
      const btnId = `video_${ts}`;

      await sendBtnOrText(sock, m.from, {
        title: '🎥 Video Downloader',
        text: `⿻ *Title:* ${video.name}\n⿻ *Duration:* ${video.duration}\n\n*Select format:*`,
        footer: getFooter(),
        image: { url: video.thumbnail || 'https://i.imgur.com/ZjKpFcX.png' },
        buttons: [
          { id: `vid_${btnId}`, text: '🎥 Video' },
          { id: `doc_${btnId}`, text: '📄 Video Doc' },
          { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Watch on YouTube', url: video.url }) },
        ],
      });

      const handle = async (event) => {
        const md = event.messages[0];
        if (!md?.message) return;
        const sid = extractButtonId(md.message);
        if (!sid || md.key?.remoteJid !== m.from || !sid.includes(ts.toString())) return;

        try {
          if (sid.startsWith('vid_')) {
            await sendVideoSmart(sock, m.from, result.download_url, {
              caption,
              title: video.name,
              quoted: md,
            });
          } else if (sid.startsWith('doc_')) {
            await sock.sendMessage(m.from, {
              document: { url: result.download_url },
              mimetype: 'video/mp4',
              fileName: `${video.name}.mp4`.replace(/[^\w\s.-]/g, ''),
              caption: video.name,
            }, { quoted: md });
          }
          await m.react('✅');
        } catch (err) {
          await sock.sendMessage(m.from, { text: `❌ ${err.message}` }, { quoted: md });
        }
      };

      sock.ev.on('messages.upsert', handle);
      setTimeout(() => sock.ev.off('messages.upsert', handle), 300000);
      await m.react('✅');

    } catch (error) {
      console.error('Video command error:', error);
      await m.react('❌'); m._failed = true;
      return m.reply('❌ Failed to search. Please try again later.');
    }
  },
};
