import { downloadMediaMessage } from 'gifted-baileys';
import { lidToJid } from '../../lib/connection/helper.js';
import { getSetting } from '../../lib/database/settings.js';
import { MessageStore } from '../../lib/database/session.js';

const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage'];

// Strip view-once / ephemeral wrappers; report whether it was view-once
function unwrap(message) {
  let cur = message;
  let viewOnce = false;
  for (let i = 0; i < 4 && cur; i++) {
    const vo = cur.viewOnceMessageV2 || cur.viewOnceMessageV2Extension || cur.viewOnceMessage;
    if (vo) { viewOnce = true; cur = vo.message; continue; }
    if (cur.ephemeralMessage) { cur = cur.ephemeralMessage.message; continue; }
    break;
  }
  return { msg: cur, viewOnce };
}

function findMedia(msg) {
  const type = MEDIA_TYPES.find(k => msg?.[k]);
  return type ? { type, media: msg[type] } : null;
}

// WhatsApp strips url/directPath from the quoted copy of view-once media
const hasSource = (media) => !!(media?.url || media?.directPath);

// Messages come back from the store with Buffers flattened to {type:'Buffer',data:[...]}
const revive = (o) => JSON.parse(JSON.stringify(o), (_, v) =>
  (v && v.type === 'Buffer' && Array.isArray(v.data)) ? Buffer.from(v.data) : v);

let _store = null;
const getStore = () => (_store ||= new MessageStore());

export default {
  name: 'vv',
  aliases: ['viewonce', 'rvo'],
  description: 'Save view once or any media by replying to it',
  usage: 'vv (reply to image/video/viewonce)',
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
      let { msg: actualMessage, viewOnce: isViewOnce } = unwrap(quoted.message);
      let found = findMedia(actualMessage);
      let source = { message: actualMessage };

      // The quoted copy has no download info → use the original message saved when it arrived
      if (!found || !hasSource(found.media)) {
        try {
          const orig = await getStore().loadMessage(m.from, quoted.id);
          if (orig?.message) {
            const u = unwrap(revive(orig.message));
            const f = findMedia(u.msg);
            if (f && hasSource(f.media)) {
              actualMessage = u.msg;
              found = f;
              isViewOnce = isViewOnce || u.viewOnce;
              source = { key: orig.key, message: u.msg };
            }
          }
        } catch (_) {}
      }

      if (!found) {
        return m.reply('❌ Please reply to an image, video, or audio message!');
      }
      if (!hasSource(found.media)) {
        return m.reply('❌ I can\'t download that one. WhatsApp removes view-once media from replies, and I only keep received messages for 10 minutes. Reply with !vv soon after it arrives.');
      }

      const messageType  = found.type;
      const mediaMessage = found.media;

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
        source,
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
      console.error('Error saving media:', err.message);
      await m.react('❌'); m._failed = true;
      throw new Error('Failed to save media!');
    }
  }
};
        
