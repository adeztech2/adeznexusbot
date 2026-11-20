import { giftedGet } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';


function isUrl(s) { try { new URL(s); return true; } catch { return false; } }
export default {
  category: 'downloader', owner: false, group: false, private: false,
  name:        'twitter',
  aliases:     ['twitterdl', 'xdl', 'x', 'xdownloader', 'twitterdownloader', 'twdl'],
  description: 'Download Twitter/X videos',
  usage:       'twitter <twitter/x url>',

  async execute(sock, m, args) {
    const url = args[0] || m.quoted?.text?.trim();
    if (!url || !isUrl(url)) return m.reply('❌ Provide a valid Twitter/X URL.');
    if (!url.includes('twitter.com') && !url.includes('x.com'))
      return m.reply('❌ That does not look like a Twitter/X URL.');
    await m.react('⬇️');
    try {
      const data = await giftedGet('/api/download/twitter', { url }, 60_000);
      if (!data?.success || !data?.result) throw new Error('Failed to fetch video info.');

      const { thumbnail, videoUrls } = data.result;
      if (!videoUrls?.length) throw new Error('No video found in this tweet.');

      if (!isEnabled('useButtons')) {
        const best = videoUrls[0].url;
        await sock.sendMessage(m.from, {
          video:    { url: best },
          mimetype: 'video/mp4',
          caption:  `🐦 *Twitter/X Video*\n\n${getFooter()}`,
        }, { quoted: m.raw });
        return m.react('✅');
      }

      const ts      = Date.now();
      const buttons = videoUrls.map((v, i) => ({ id: `tw_${i}_${ts}`, text: `${v.quality} Quality` }));

      await sendBtnOrText(sock, m.from, {
        title:   '🐦 Twitter/X Downloader',
        text:    `*Available qualities:* ${videoUrls.map(v => v.quality).join(', ')}\n\n*Select quality:*`,
        footer:  getFooter(),
        image:   thumbnail ? { url: thumbnail } : undefined,
        buttons,
      });

      const handle = async (event) => {
        const md  = event.messages[0];
        if (!md?.message) return;
        const sid = extractButtonId(md.message);
        if (!sid || md.key?.remoteJid !== m.from || !sid.includes(`_${ts}`)) return;
        const idx      = parseInt(sid.split('_')[1]);
        const videoUrl = videoUrls[idx]?.url;
        if (!videoUrl) return;
        try {
          await sock.sendMessage(m.from, {
            video:    { url: videoUrl },
            mimetype: 'video/mp4',
            caption:  `🐦 *Twitter/X Video* (${videoUrls[idx].quality})\n\n${getFooter()}`,
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
      return m.reply(`❌ Twitter download failed: ${err.message}`);
    }
  },
}
