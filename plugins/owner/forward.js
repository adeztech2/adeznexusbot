import { getSetting, setSetting, isEnabled } from '../../lib/database/settings.js';
import { getForwardChannel, getForwardName, getForwardContext } from '../../lib/forwardContext.js';

const CHANNEL_RE = /whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i;

export default {
  name:        'forward',
  aliases:     ['fwd', 'forwarding'],
  description: 'Change the "Forwarded from channel" label on bot messages',
  usage:       'forward on|off  |  forward name <text>  |  forward channel <link or jid>  |  forward test',
  category:    'owner',
  owner:       true,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const prefix = getSetting('prefix') || '.';
    const sub  = (args[0] || '').toLowerCase();
    const rest = args.slice(1).join(' ').trim();

    // ── turn on / off ─────────────────────────────────────────
    if (sub === 'on' || sub === 'off') {
      await setSetting('forwarding', sub === 'on' ? 'true' : 'false');
      return m.reply(`✅ Forwarded label is now *${sub.toUpperCase()}*.`);
    }

    // ── label name ────────────────────────────────────────────
    if (sub === 'name') {
      if (!rest) return m.reply(`❌ Give a name.\n\nExample: ${prefix}forward name ADEZ NEXUS\nReset: ${prefix}forward name reset`);
      if (rest.toLowerCase() === 'reset') {
        await setSetting('forwardName', '');
        return m.reply(`✅ Label name reset. It now shows: *${getForwardName()}*`);
      }
      if (rest.length > 60) return m.reply('❌ That name is too long (max 60 characters).');
      await setSetting('forwardName', rest);
      return m.reply(`✅ Label name changed to *${rest}*`);
    }

    // ── channel ───────────────────────────────────────────────
    if (sub === 'channel') {
      if (!rest) return m.reply(`❌ Give a channel link or JID.\n\nExample: ${prefix}forward channel https://whatsapp.com/channel/XXXX\nAuto (use channelUrl): ${prefix}forward channel auto`);

      if (/^(auto|reset)$/i.test(rest)) {
        await setSetting('newsletterJid', '');
        return m.reply('✅ Channel reset. I will use the channel from *channelUrl*.');
      }

      const link = rest.match(CHANNEL_RE);
      if (link) {
        try {
          const meta = await sock.newsletterMetadata('invite', link[1]);
          if (!meta?.id) throw new Error('channel not found');
          await setSetting('newsletterJid', meta.id);
          const nm = typeof meta.name === 'string' ? meta.name : meta?.thread_metadata?.name?.text;
          return m.reply(`✅ Label channel set${nm ? ` to *${nm}*` : ''}.\n🆔 ${meta.id}`);
        } catch (err) {
          return m.reply(`❌ Could not read that channel: ${err.message}`);
        }
      }

      const jid = rest.replace(/\s/g, '');
      if (/^\d{10,30}(@newsletter)?$/.test(jid)) {
        const full = jid.endsWith('@newsletter') ? jid : `${jid}@newsletter`;
        await setSetting('newsletterJid', full);
        return m.reply(`✅ Label channel set.\n🆔 ${full}`);
      }
      return m.reply('❌ That is not a channel link or JID.\n\nA link looks like https://whatsapp.com/channel/XXXX');
    }

    // ── preview ───────────────────────────────────────────────
    if (sub === 'test') {
      const ctx = getForwardContext();
      if (!ctx.isForwarded) {
        return m.reply(
          isEnabled('forwarding')
            ? `⚠️ No channel known yet, so no label is shown.\nSet one with ${prefix}forward channel <link>`
            : `⚠️ The label is OFF. Turn it on with ${prefix}forward on`
        );
      }
      return sock.sendMessage(m.from, { text: '👀 This is how the forwarded label looks.', contextInfo: ctx }, { quoted: m.raw });
    }

    // ── status ────────────────────────────────────────────────
    const channel = getForwardChannel();
    return m.reply(
      `📨 *FORWARD LABEL*\n\n` +
      `▸ Status: ${isEnabled('forwarding') ? 'ON ✅' : 'OFF ❌'}\n` +
      `▸ Name: ${getForwardName()}\n` +
      `▸ Channel: ${channel || 'not known yet'}\n\n` +
      `*Commands*\n` +
      `${prefix}forward on | off\n` +
      `${prefix}forward name <text>\n` +
      `${prefix}forward channel <link or jid>\n` +
      `${prefix}forward test`
    );
  },
};
