import { downloadMediaMessage } from 'gifted-baileys';
import { lidToJid } from '../../lib/connection/helper.js';
import { getSetting } from '../../lib/database/settings.js';

export default {
  name: 'vv',
  aliases: ['viewonce', 'rvo'],
  description: 'Save view once or any media by replying to it',
  usage: '!vv (reply to image/video/viewonce)',
  category: 'owner',
  owner: true,
  group: false,
  private: false,

  async execute(sock, m, args) {
    const quoted = m.quoted;
    const botJid = sock.user.id.replace(/:\d+@/, '@');

    if (!quoted) {
      return m.reply('❌ Reply to an image, video, or view once message!\n\nExample: Reply to media with !vv');
    }

    try {
      let actualMessage = quoted.message;
      let isViewOnce    = false;

      const viewOnceMsg = quoted.message?.viewOnceMessageV2 || quoted.message?.viewOnceMessage;
      if (viewOnceMsg) {
        actualMessage = viewOnceMsg.message;
        isViewOnce    = true;
      }

      const messageType = Object.keys(actualMessage)[0];
      const mediaMessage = actualMessage[messageType];

      if (!['imageMessage', 'videoMessage', 'audioMessage'].includes(messageType)) {
        return m.reply('❌ Please reply to an image, video, or audio message!');
      }

      // Resolve LID → phone JID so the sender number is always a real phone number
      const rawSenderJid = quoted.participant || quoted.sender || m.sender || '';
      const resolvedJid  = await lidToJid(sock, m.from, rawSenderJid);
      const senderNum    = resolvedJid.endsWith('@lid')
        ? rawSenderJid.split('@')[0]   // fallback: show raw LID digits if unresolvable
        : resolvedJid.split('@')[0];

      const senderName = quoted.pushName || senderNum;

      let caption = `📸 *${isViewOnce ? 'View Once' : 'Media'} Saved*\n\n`;
      caption += `👤 From: ${senderName}\n`;
      caption += `📱 Number: +${senderNum}\n`;
      caption += `⏰ Time: ${new Date().toLocaleString('en-US', { timeZone: getSetting('timezone') || 'Africa/Nairobi' })}\n`;

      if (mediaMessage.caption) {
        caption += `\n📝 Caption: ${mediaMessage.caption}`;
      }

      const buffer = await downloadMediaMessage(
        { message: actualMessage },
        'buffer',
        {},
        { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
      );

      const sendOpts = { mentions: [resolvedJid] };

      if (messageType === 'imageMessage') {
        await sock.sendMessage(botJid, { image: buffer, caption, ...sendOpts }, { quoted: m });
      } else if (messageType === 'videoMessage') {
        await sock.sendMessage(botJid, { video: buffer, caption, ...sendOpts }, { quoted: m });
      } else if (messageType === 'audioMessage') {
        await sock.sendMessage(m.from, {
          audio: buffer, mimetype: 'audio/mp4', ptt: mediaMessage.ptt || false
        }, { quoted: m });
        await sock.sendMessage(botJid, { text: caption, ...sendOpts }, { quoted: m });
      }

    } catch (err) {
      console.error('Error saving media:', err);
      await m.react('❌');
      throw new Error('Failed to save media!');
    }
  }
};
