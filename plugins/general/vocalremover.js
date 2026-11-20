import { giftedGet, giftedGetRetry, giftedGetBuffer, giftedGetBufferRetry } from '../../lib/api/gifted.js';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { quotedImageUrl, quotedAudioUrl, quotedDocText } from '../../lib/utils/mediaUtils.js';

export default {
  category: 'tools', owner: false, group: false, private: false,
  name:        'vocalremover',
  aliases:     ['removevocal', 'splitaudio', 'instrumentalonly', 'vocal', 'karaoke'],
  description: 'Split audio into vocals and instrumental tracks',
  usage:       'vocalremover  (reply to an audio, or provide audio URL)',

  async execute(sock, m, args) {
    const audioUrl = await quotedAudioUrl(m) || args.find(a => a.startsWith('http'));
    if (!audioUrl) return m.reply('❌ Reply to an audio message or provide an audio URL.');
    await m.react('🎶');
    try {
      const data = await giftedGetRetry('/api/tools/vocalremover', { url: audioUrl }, 60_000);
      if (!data?.success || !data?.result) throw new Error('Vocal removal failed.');
      const { title, vocals, instrumental } = data.result;

      if (!isEnabled('useButtons')) {
        if (vocals) {
          await sock.sendMessage(m.from, {
            audio: { url: vocals }, mimetype: 'audio/mpeg',
          }, { quoted: m.raw });
        }
        if (instrumental) {
          await sock.sendMessage(m.from, {
            audio: { url: instrumental }, mimetype: 'audio/mpeg',
          }, { quoted: m.raw });
        }
        return m.react('✅');
      }

      const ts      = Date.now();
      const buttons = [];
      if (vocals)       buttons.push({ id: `vr_vocal_${ts}`,  text: '🎤 Vocals' });
      if (instrumental) buttons.push({ id: `vr_instr_${ts}`,  text: '🎸 Instrumental' });
      if (!buttons.length) throw new Error('No audio tracks returned.');

      await sendBtnOrText(sock, m.from, {
        title:   '🎶 Vocal Remover',
        text:    `*Track:* ${title || 'Audio'}\n\n*Select a track to download:*`,
        footer:  getFooter(),
        buttons,
      });

      const handle = async (event) => {
        const md  = event.messages[0];
        if (!md?.message) return;
        const sid = extractButtonId(md.message);
        if (!sid || md.key?.remoteJid !== m.from || !sid.includes(ts.toString())) return;
        try {
          const audioSend = sid.startsWith('vr_vocal_') ? vocals : instrumental;
          await sock.sendMessage(m.from, {
            audio:    { url: audioSend },
            mimetype: 'audio/mpeg',
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
      return m.reply(`❌ Vocal removal failed: ${err.message}`);
    }
  },
}
