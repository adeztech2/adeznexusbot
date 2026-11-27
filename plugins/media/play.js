import { meganDownload } from '../../lib/api/megan.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { sendAudioSmart } from '../../lib/utils/mediaUtils.js';


function formatViews(views) {
  if (!views) return '?';
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

export default {
  name:        'play',
  aliases:     ['song', 'yt', 'ytmp3', 'yta', 'dlmp3'],
  description: 'Search and download a song from YouTube',
  usage:       'play <song name>',
  category:    'downloader',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const query = args.join(' ');
    if (!query) return m.reply('❌ Provide a song name!');

    await m.react('🔍');

    try {
      await m.react('⬇️');
      const result = await meganDownload('/download/mp3', { q: query }, 120_000);
      const song = {
        title: result.title || 'YouTube audio',
        url: result.youtubeUrl || result.url,
        duration: result.searchResult?.duration || result.duration || '?',
        views: result.views,
        thumbnail: result.thumbnail,
        author: result.searchResult?.channelTitle || result.author,
      };

      if (!isEnabled('useButtons')) {
        await sendAudioSmart(sock, m.from, result.download_url, {
          title: song.title,
          quoted: m.raw,
        });
        return m.react('✅');
      }

      const ts = Date.now();
      const btnId = `play_${ts}`;

      await sendBtnOrText(sock, m.from, {
        title: '🎵 Song Downloader',
        text: `⿻ *Title:* ${song.title}\n⿻ *Duration:* ${song.duration}\n⿻ *Views:* ${formatViews(song.views)}\n\n*Select format:*`,
        footer: getFooter(),
        image: { url: song.thumbnail || 'https://i.imgur.com/ZjKpFcX.png' },
        buttons: [
          { id: `audio_${btnId}`, text: '🎶 Audio' },
          { id: `doc_${btnId}`, text: '📄 Audio Doc' },
          { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Watch on YouTube', url: song.url }) },
        ],
      });

      const handle = async (event) => {
        const md = event.messages[0];
        if (!md?.message) return;
        const sid = extractButtonId(md.message);
        if (!sid || md.key?.remoteJid !== m.from || !sid.includes(ts.toString())) return;

        try {
          if (sid.startsWith('audio_')) {
            await sendAudioSmart(sock, m.from, result.download_url, {
              title: song.title,
              quoted: md,
            });
          } else if (sid.startsWith('doc_')) {
            await sock.sendMessage(m.from, {
              document: { url: result.download_url },
              mimetype: 'audio/mpeg',
              fileName: `${song.title}.mp3`.replace(/[^\w\s.-]/g, ''),
              caption: song.title,
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
      console.error('Play command error:', error);
      await m.react('❌'); m._failed = true;
      return m.reply('❌ Failed to search. Please try again later.');
    }
  },
};
