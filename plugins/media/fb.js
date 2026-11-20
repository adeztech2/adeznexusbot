import { giftedGet } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';


function isUrl(s) { try { new URL(s); return true; } catch { return false; } }
export default {
  category: 'downloader', owner: false, group: false, private: false,
  name:        'fb',
  aliases:     ['fbdl', 'facebookdl', 'facebook', 'fbvideo'],
  description: 'Download Facebook videos (HD/SD)',
  usage:       'fb <facebook url>',

  async execute(sock, m, args) {
    const url = args[0] || m.quoted?.text?.trim();
    if (!url || !isUrl(url)) return m.reply('❌ Provide a valid Facebook video URL.');
    if (!url.includes('facebook.com') && !url.includes('fb.watch'))
      return m.reply('❌ That does not look like a Facebook URL.');
    await m.react('⬇️');
    try {
      const data = await giftedGet('/api/download/facebook', { url }, 60_000);
      if (!data?.success || !data?.result)
        throw new Error('Could not fetch video info. Check the URL.');

      const { title, duration, thumbnail, hd_video, sd_video } = data.result;
      const hdUrl = hd_video, sdUrl = sd_video;
      if (!hdUrl && !sdUrl) throw new Error('No video URLs found.');

      if (!isEnabled('useButtons')) {
        const videoUrl = hdUrl || sdUrl;
        await sock.sendMessage(m.from, {
          video:    { url: videoUrl },
          mimetype: 'video/mp4',
          caption:  `📘 *${title || 'Facebook Video'}*\n⏱️ ${duration || ''}\n\n${getFooter()}`,
        }, { quoted: m.raw });
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
          await sock.sendMessage(m.from, {
            video:    { url: videoUrl },
            mimetype: 'video/mp4',
            caption:  `📘 *${title || 'Facebook Video'}*\n\n${getFooter()}`,
          }, { quoted: md });
          await m.react('✅');
        } catch (err) {
          await sock.sendMessage(m.from, { text: `❌ ${err.message}` }, { quoted: md });
        }
      };
      sock.ev.on('messages.upsert', handle);
      setTimeout(() => sock.ev.off('messages.upsert', handle), 300_000);
    } catch (err) {
      await m.react('❌');
      return m.reply(`❌ Facebook download failed: ${err.message}`);
    }
  },
}
