import { delSudo, DEV_NUMBERS } from '../../lib/database/sudo.js';
import { lidToJid } from '../../lib/connection/helper.js';

async function resolveTargetNum(sock, m, args) {
  // 1. Bare number passed as argument
  if (args.length && /^\d{6,}$/.test(args[0])) return args[0].replace(/\D/g, '');

  const chatJid = m.key?.remoteJid || m.from;

  // 2. @Mentioned user — mentionedJid can be a @lid in LID mode
  const mentionedJids = m.msg?.contextInfo?.mentionedJid || [];
  if (mentionedJids.length) {
    const resolved = await lidToJid(sock, chatJid, mentionedJids[0]);
    if (resolved.endsWith('@lid')) return null; // LID could not be resolved to phone
    const num = resolved.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (num.length >= 6) return num;
  }

  // 3. Quoted message sender — contextInfo.participant can be a @lid in LID mode
  const quotedRaw = m.msg?.contextInfo?.participant;
  if (quotedRaw && !quotedRaw.endsWith('@g.us')) {
    const resolved = await lidToJid(sock, chatJid, quotedRaw);
    if (resolved.endsWith('@lid')) return null; // LID could not be resolved to phone
    const num = resolved.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (num.length >= 6) return num;
  }

  return null;
}

export default {
  name:        'delsudo',
  aliases:     ['removesudo'],
  description: 'Remove a user from the sudo list',
  usage:       'delsudo <number | @mention | reply>',
  category:    'owner',
  owner:       true,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const target = await resolveTargetNum(sock, m, args);
    if (!target || target.length < 6) {
      return m.reply('❌ Can\'t identify user. Use their phone number directly.\nExample: ,delsudo 254712345678');
    }

    if (DEV_NUMBERS.includes(target)) {
      return sock.sendMessage(m.from, {
        text: `⚠️ @${target} is a dev — their access cannot be removed.`,
        mentions: [`${target}@s.whatsapp.net`],
      }, { quoted: m.raw });
    }

    const removed = await delSudo(target);
    const msg     = removed
      ? `✅ @${target} removed from sudo list.`
      : `⚠️ @${target} is not in the sudo list.`;

    return sock.sendMessage(m.from, {
      text: msg,
      mentions: [`${target}@s.whatsapp.net`],
    }, { quoted: m.raw });
  },
};
