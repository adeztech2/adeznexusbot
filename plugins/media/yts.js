import { meganRequest, meganDownload, pickResult } from '../../lib/api/megan.js';
import { extractButtonId, getFooter, sendButtons } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { sendAudioSmart, sendVideoSmart } from '../../lib/utils/mediaUtils.js';

function formatViews(views) {
  if (!views) return 'N/A';
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

export default {
  name:        'yts',
  aliases:     ['ytsearch', 'yt-search'],
  description: 'Search YouTube and pick a result to download',
  usage:       'yts <search query>',
  category:    'search',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const query = args.join(' ');
    if (!query) return m.reply('❌ Provide a search query!');

    try {
      const payload = await meganRequest('/api/search/youtube', { params: { q: query }, timeout: 60000 });
      const { data } = pickResult(payload);
      const results = (data.results || []).slice(0, 5).map(v => ({
        ...v,
        name: v.name || v.title,
      }));

      if (!results.length) return m.reply('❌ No results found for that query.');

      const ts = Date.now();
      const footer = getFooter();
      const useBtn = isEnabled('useButtons');
      const videoMap = new Map(results.map((v, i) => [`${ts}_${i}`, v]));

      if (!useBtn) {
        let text = `🔍 *YouTube Search: ${query}*\n\n`;
        results.forEach((v, i) => {
          text += `*${i + 1}. ${v.name}*\n`;
          text += `⏱️ ${v.duration || 'N/A'}  👁️ ${formatViews(v.views)}\n`;
          text += `🔗 ${v.url}\n\n`;
        });
        text += `_Reply with ,play <url> or ,dlmp4 <url> to download_\n${footer}`;
        return m.reply(text);
      }

      for (const [key, vid] of videoMap) {
        await sendButtons(sock, m.from, {
          title: vid.name,
          text: `⏱️ *Duration:* ${vid.duration || 'N/A'}\n👁️ *Views:* ${formatViews(vid.views)}`,
          footer,
          buttons: [
            { id: `yts_audio_${key}`, text: 'Audio 🎶' },
            { id: `yts_vid_${key}`, text: 'Video 🎥' },
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({ display_text: 'Watch on YouTube', url: vid.url }),
            },
          ],
        });
      }

      const handleYtsResponse = async (event) => {
        const md = event.messages[0];
        if (!md?.message) return;

        const selectedId = extractButtonId(md.message);
        if (!selectedId || !selectedId.startsWith('yts_') || !selectedId.includes(`_${ts}_`)) return;
        if (md.key?.remoteJid !== m.from) return;

        const parts = selectedId.split('_');
        const type = parts[1];
        const vid = videoMap.get(`${parts[2]}_${parts[3]}`);
        if (!vid) return;

        let dlMsg;
        try {
          dlMsg = await sock.sendMessage(
            m.from,
            { text: `⏳ Downloading ${type === 'audio' ? 'audio 🎶' : 'video 🎥'} for: *${vid.name}*` },
            { quoted: md },
          );

          const result = type === 'audio'
            ? await meganDownload('/download/mp3', { url: vid.url }, 120000)
            : await meganDownload('/download/mp4', { url: vid.url }, 120000);
          await sock.sendMessage(m.from, { delete: dlMsg.key });

          if (type === 'audio') {
            await sendAudioSmart(sock, m.from, result.download_url, {
              title: result.title || vid.name,
              quoted: md,
            });
          } else {
            await sendVideoSmart(sock, m.from, result.download_url, {
              caption: `🎬 *${result.title || vid.name}*\n\n${footer}`,
              title: result.title || vid.name,
              quoted: md,
            });
          }
        } catch (err) {
          console.error('[yts button]', err.message);
          const errText = { text: `❌ Failed: ${err.message}` };
          if (dlMsg) await sock.sendMessage(m.from, { ...errText, edit: dlMsg.key });
          else await sock.sendMessage(m.from, errText, { quoted: md });
        }
      };

      sock.ev.on('messages.upsert', handleYtsResponse);
      setTimeout(() => sock.ev.off('messages.upsert', handleYtsResponse), 300000);
    } catch (error) {
      console.error('YTS command error:', error);
      await m.react('❌'); m._failed = true;
      return m.reply('❌ Failed to search. Please try again later.');
    }
  },
};
