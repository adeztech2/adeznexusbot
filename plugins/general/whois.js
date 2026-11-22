import { lidToJid } from '../../lib/connection/helper.js';
import { DEV_NUMBERS, getSudoNumbers } from '../../lib/database/sudo.js';
import { getSetting } from '../../lib/database/settings.js';
import { getFooter } from '../../lib/buttonHandler.js';
import { getForwardFields } from '../../lib/forwardContext.js';

const PLACEHOLDER = 'https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg';

function withTimeout(promise, ms, fallback = null) {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise(r => setTimeout(() => r(fallback), ms)),
  ]);
}

function fmtDate(raw) {
  if (!raw) return null;
  try {
    const ts = raw instanceof Date ? raw.getTime()
             : typeof raw === 'number' ? (raw < 1e12 ? raw * 1000 : raw)
             : new Date(raw).getTime();
    if (!ts || isNaN(ts)) return null;
    const tz = getSetting('timezone') || 'Africa/Nairobi';
    return new Intl.DateTimeFormat('en-KE', {
      timeZone: tz, weekday: 'long', year: 'numeric',
      month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(ts));
  } catch { return null; }
}

export default {
  name:        'whois',
  aliases:     ['profile', 'who', 'userinfo'],
  description: 'Get full profile details of a user',
  usage:       'whois (reply / @mention / number)',
  category:    'general',
  owner:       false,
  admin:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    let rawJid;

    if (m.quoted?.sender) {
      rawJid = m.quoted.sender;
    } else {
      const mentioned = m.msg?.contextInfo?.mentionedJid || [];
      if (mentioned.length) {
        rawJid = mentioned[0];
      } else if (args[0]) {
        const num = args[0].replace(/\D/g, '');
        rawJid = num ? `${num}@s.whatsapp.net` : null;
      } else {
        rawJid = m.sender;
      }
    }

    if (!rawJid || rawJid.endsWith('@g.us')) {
      return m.reply('❌ Reply to a message, @mention someone, or provide a number.');
    }

    const resolved = await withTimeout(lidToJid(sock, m.from, rawJid), 4000, rawJid);
    const isLid    = resolved.endsWith('@lid');
    const phone    = isLid ? null : resolved.split('@')[0].split(':')[0];
    const jid      = phone ? `${phone}@s.whatsapp.net` : null;

    await m.react('👀');

    let ppUrl = PLACEHOLDER;
    if (jid) {
      ppUrl = await withTimeout(sock.profilePictureUrl(jid, 'image'), 5000, PLACEHOLDER);
    }

    let statusText = 'Not Found';
    let statusSetAt = null;
    if (jid) {
      const st = await withTimeout(sock.fetchStatus(jid), 5000, null);
      if (Array.isArray(st) && st.length) {
        const inner = st[0]?.status ?? st[0];
        const raw   = inner?.status ?? inner?.text ?? '';
        if (raw?.trim()) { statusText = raw.trim(); statusSetAt = inner?.setAt ?? null; }
      } else if (st && typeof st === 'object') {
        const raw = st.status ?? st.text ?? '';
        if (raw?.trim()) { statusText = raw.trim(); statusSetAt = st.setAt ?? null; }
      }
    }

    let groupRole = null;
    if (m.isGroup && jid) {
      const meta = await withTimeout(sock.groupMetadata(m.from), 4000, null);
      if (meta) {
        const p = meta.participants.find(p => {
          const pn = (p.phoneNumber || p.id || '').split('@')[0].replace(/\D/g, '');
          return pn === phone || p.id?.split('@')[0] === phone;
        });
        if (p) groupRole = p.admin === 'superadmin' ? '👑 Group Creator' : p.admin === 'admin' ? '⭐ Admin' : '👤 Member';
      }
    }

    const ownerNum = (getSetting('ownerNumber') || '').replace(/\D/g, '');
    let rank = null;
    if (phone) {
      if (phone === ownerNum) rank = '👑 Owner';
      else if (DEV_NUMBERS.includes(phone)) rank = '🛡️ Dev';
      else {
        const sudos = await getSudoNumbers();
        if (sudos.includes(phone)) rank = '⚡ Sudo';
      }
    }

    const formattedDate = fmtDate(statusSetAt) || 'Not Available';
    const displayNum    = phone || rawJid.split('@')[0];
    const targetJid     = jid || rawJid;

    const botFooter     = getSetting('botFooter') || 'ADEZ NEXUS';

    const lines = [
      `*👤 User Profile Information*\n`,
      `*• Name:* @${displayNum}`,
      `*• Number:* +${displayNum}`,
      `*• About:* ${statusText}`,
      `*• Last Updated:* ${formattedDate}`,
    ];
    if (groupRole) lines.push(`*• Role:* ${groupRole}`);
    if (rank)      lines.push(`*• Rank:* ${rank}`);
    if (isLid)     lines.push(`\n_⚠️ LID mode — some info may be unavailable_`);
    lines.push(`\n_${botFooter}_`);

    const caption = lines.join('\n');

    await sock.sendMessage(m.from, {
      image:   { url: ppUrl },
      caption,
      mentions: jid ? [jid] : [],
      contextInfo: {
        mentionedJid: jid ? [jid] : [],
        ...getForwardFields(5, 143),
      },
    }, { quoted: m.raw });

    await m.react('✅');
  },
};
