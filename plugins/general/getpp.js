import { getSetting } from '../../lib/database/settings.js';
import { lidToJid } from '../../lib/connection/helper.js';
import { getFooter } from '../../lib/buttonHandler.js';

const PLACEHOLDER = 'https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg';

export default {
  name:        'getpp',
  aliases:     ['stealpp', 'snatchpp', 'profilepic'],
  description: 'Get profile picture of a user',
  usage:       'getpp @user / reply to message / getpp 254712345678',
  category:    'general',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    let targetJid;

    if (m.quoted?.sender) {
      targetJid = await lidToJid(sock, m.from, m.quoted.sender);
    } else {
      const mentioned = m.msg?.contextInfo?.mentionedJid || [];
      if (mentioned.length) {
        targetJid = await lidToJid(sock, m.from, mentioned[0]);
      } else if (args[0]) {
        const num = args[0].replace(/\D/g, '');
        if (num) targetJid = `${num}@s.whatsapp.net`;
      } else {
        targetJid = m.sender;
      }
    }

    if (!targetJid || targetJid.endsWith('@g.us')) {
      return m.reply(
        '❌ Reply to a message, @mention a user, or provide a number.\n\n' +
        `Examples:\n• ${getSetting('prefix') || '.'}getpp @user\n• ${getSetting('prefix') || '.'}getpp 254712345678\n• Reply to a message + ${getSetting('prefix') || '.'}getpp`
      );
    }

    if (targetJid.endsWith('@lid')) {
      const resolved = await lidToJid(sock, m.from, targetJid);
      if (!resolved.endsWith('@lid')) targetJid = resolved;
    }

    await m.react('👀');

    let ppUrl = PLACEHOLDER;
    try {
      ppUrl = await sock.profilePictureUrl(targetJid, 'image');
    } catch { /* use placeholder */ }

    const number      = targetJid.replace(/@s\.whatsapp\.net$/, '').split(':')[0];
    const newsletterJid = getSetting('newsletterJid') || '';
    const botName       = getSetting('botName') || 'ADEZ NEXUS';

    await sock.sendMessage(m.from, {
      image:   { url: ppUrl },
      caption: `*👤 Profile Picture*\n\n*• Number:* +${number}\n\n${getFooter()}`,
      mentions: [targetJid],
      contextInfo: {
        mentionedJid: [targetJid],
        forwardingScore: 5,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid,
          newsletterName: botName,
          serverMessageId: 143,
        },
      },
    }, { quoted: m.raw });

    await m.react('✅');
  },
};
