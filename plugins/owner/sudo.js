import { setSudo, DEV_NUMBERS } from '../../lib/database/sudo.js';
import { lidToJid } from '../../lib/connection/helper.js';

async function resolveTargetNum(sock, m, args) {
  if (args.length && /^\d{6,}$/.test(args[0])) return args[0].replace(/\D/g, '');

  const chatJid = m.key?.remoteJid || m.from;

  const mentionedJids = m.msg?.contextInfo?.mentionedJid || [];
  if (mentionedJids.length) {
    const resolved = await lidToJid(sock, chatJid, mentionedJids[0]);
    if (resolved.endsWith('@lid')) return null;
    const num = resolved.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (num.length >= 6) return num;
  }

  const quotedRaw = m.msg?.contextInfo?.participant;
  if (quotedRaw && !quotedRaw.endsWith('@g.us')) {
    const resolved = await lidToJid(sock, chatJid, quotedRaw);
    if (resolved.endsWith('@lid')) return null;
    const num = resolved.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (num.length >= 6) return num;
  }

  return null;
}

export default {
  name:        'setsudo',
  aliases:     ['addsudo'],
  description: 'Add a user to the sudo list',
  usage:       '.setsudo <number | @mention | reply>',
  category:    'owner',
  owner:       true,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const target = await resolveTargetNum(sock, m, args);
    if (!target || target.length < 6) {
      return m.reply('❌ Can\'t identify user. Use their phone number directly.\nExample: .setsudo 254712345678');
    }

    if (DEV_NUMBERS.includes(target)) {
      return sock.sendMessage(m.from, {
        text: `⚠️ @${target} is a dev — cannot be added as sudo.`,
        mentions: [`${target}@s.whatsapp.net`],
      }, { quoted: m.raw });
    }

    await m.react('⏳');

    try {
      const [result] = await sock.onWhatsApp(target);
      if (!result?.exists) {
        await m.react('❌');
        return m.reply(`❌ +${target} is not registered on WhatsApp.`);
      }
    } catch (err) {
      await m.react('⚠️');
      return m.reply(`⚠️ Could not verify +${target} on WhatsApp: ${err.message}`);
    }

    const added = await setSudo(target);
    const msg   = added
      ? `✅ @${target} added to sudo list.`
      : `⚠️ @${target} is already in the sudo list.`;

    await m.react('✅');
    return sock.sendMessage(m.from, {
      text: msg,
      mentions: [`${target}@s.whatsapp.net`],
    }, { quoted: m.raw });
  },
};
