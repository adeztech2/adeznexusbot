import { meganRequest, pickResult } from '../../lib/api/megan.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';


function isUrl(s) { try { new URL(s); return true; } catch { return false; } }

const FB_RE = /https?:\/\/(?:[\w-]+\.)?(?:facebook\.com|fb\.watch|fb\.com|fb\.me)\/\S+/i;

// Find a Facebook link anywhere in the command text or the replied-to message.
function findFbUrl(args, m) {
  const text = `${args.join(' ')} ${m.quoted?.text || ''}`;
  return text.match(FB_RE)?.[0]?.replace(/[)\]>.,]+$/, '') || null;
}

// The API's field names vary a little between responses.
function pickVideos(r = {}) {
  const hd = r.hd_video || r.hd || r.HD || r.video_hd || null;
  const sd = r.sd_video || r.sd || r.SD || r.video_sd || r.download_url || r.url || r.video || null;
  return { hd, sd };
}

async function sendVideo(sock, m, videoUrl, caption, quoted) {
  try {
    await sock.sendMessage(m.from, { video: { url: videoUrl }, mimetype: 'video/mp4', caption }, { quoted });
  } catch (err) {
    // Too big or rejected as a video — send as a file instead of failing
    console.error('[fb] video send failed, sending as document:', err.message);
    await sock.sendMessage(m.from, { document: { url: videoUrl }, mimetype: 'video/mp4', fileName: 'facebook-video.mp4', caption }, { quoted });
  }
}

export default {
  category: 'downloader', owner: false, group: false, private: false,
  name:        'fb',
  aliases:     ['fbdl', 'facebookdl', 'facebook', 'fbvideo'],
  description: 'Download Facebook videos (HD/SD)',
  usage:       'fb <facebook url>',

  async execute(sock, m, args) {
    const url = findFbUrl(args, m);
    if (!url || !isUrl(url))
      return m.reply('❌ Send a Facebook video link.\n\nExample: `.fb https://www.facebook.com/watch?v=...`\nYou can also reply to a message that has the link.');
    await m.react('⬇️');
    try {
      const payload = await meganRequest('/api/download/facebook', { params: { url }, timeout: 120_000 });
      const { data } = pickResult(payload);
      if (!data || typeof data !== 'object') throw new Error('Could not fetch the video.');

      const { title, duration, thumbnail } = data;
      const { hd: hdUrl, sd: sdUrl } = pickVideos({
        ...data,
        hd_video: data.hdVideo || data.hd_url || data.hd,
        sd_video: data.sdVideo || data.sd_url || data.sd,
        download_url: data.downloadUrl || data.download_url,
      });
      if (!hdUrl && !sdUrl) throw new Error('No video URLs found. The video may be private.');

      if (!isEnabled('useButtons')) {
        const videoUrl = hdUrl || sdUrl;
        await sendVideo(sock, m, videoUrl,
          `📘 *${title || 'Facebook Video'}*\n⏱️ ${duration || ''}\n\n${getFooter()}`, m.raw);
        return m.react('✅');
      }

      const ts      = Date.now();
      const buttons = [];
      if (hdUrl) buttons.push({ id: `fb_hd_${ts}`, text: '🎬 HD Quality' });
      if (sdUrl) buttons.push({ id: `fb_sd_${ts}`, text: '📹 SD Quality' });

      await sendBtnOrText(sock, m.from, {
        title:   '📘 Facebook Downloader',
        text:    `*Title:* ${title || 'Facebook Video'}\n*Duration:* ${duration || 'Unknown'}\n\n*Select quality:*`,
        footer:  getFooter(),
        image:   thumbnail ? { url: thumbnail } : undefined,
        buttons,
      });

      const handle = async (event) => {
        const md  = event.messages[0];
        if (!md?.message) return;
        const sid = extractButtonId(md.message);
        if (!sid || md.key?.remoteJid !== m.from || !sid.includes(ts.toString())) return;
        const videoUrl = sid.includes('_hd_') ? hdUrl : sdUrl;
        try {
          await sendVideo(sock, m, videoUrl, `📘 *${title || 'Facebook Video'}*\n\n${getFooter()}`, md);
          await m.react('✅');
        } catch (err) {
          await sock.sendMessage(m.from, { text: `❌ ${err.message}` }, { quoted: md });
        }
      };
      sock.ev.on('messages.upsert', handle);
      setTimeout(() => sock.ev.off('messages.upsert', handle), 300_000);
    } catch (err) {
      await m.react('❌'); m._failed = true;
      return m.reply(`❌ Facebook download failed: ${err.message}`);
    }
  },
}
