import { getSetting } from '../../lib/database/settings.js';

export default {
  name:        'mention',
  aliases:     ['everyone', 'allmembers'],
  description: 'Mention all group members — they get notified, message stays clean',
  usage:       '.mention <message>',
  category:    'group',
  owner:       false,
  group:       true,
  private:     false,
  admin:       true,

  async execute(sock, m, args) {
    const meta = await sock.groupMetadata(m.from);

    const mentions = meta.participants
      .map(p => {
        const jid = p.id || p.jid || '';
        if (jid.endsWith('@s.whatsapp.net')) return jid;
        if (p.phoneNumber) return `${p.phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
        return null;
      })
      .filter(Boolean);

    const subject       = args.join(' ') || meta.subject || 'everyone';
    const newsletterJid = getSetting('newsletterJid') || '';
    const botName       = getSetting('botName') || 'ADEZ NEXUS';

    await sock.sendMessage(m.from, {
      text: `@${m.from}`,
      contextInfo: {
        mentionedJid: mentions,
        groupMentions: [{
          groupJid:     m.from,
          groupSubject: subject,
        }],
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid,
          newsletterName: botName,
          serverMessageId: 0,
        },
      },
    }, { quoted: m.raw });

    await m.react('✅');
  },
};
