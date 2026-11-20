export default {
  name:        'tagadmins',
  aliases:     ['admins', 'mentionadmins', 'calladmins'],
  description: 'Tag all group admins',
  usage:       '.tagadmins <message>',
  category:    'group',
  owner:       false,
  group:       true,
  private:     false,

  async execute(sock, m, args) {
    const meta = await sock.groupMetadata(m.from);

    const admins = meta.participants
      .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
      .map(p => {
        const jid = p.id || p.jid || '';
        if (jid.endsWith('@s.whatsapp.net')) return jid;
        if (p.phoneNumber) return `${p.phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
        return null;
      })
      .filter(Boolean);

    if (!admins.length) return m.reply('❌ No admins found in this group.');

    const message = args.join(' ') || 'Admins needed!';

    let text = `🛡️ *Group Admins*\n\n${message}\n\n`;
    admins.forEach((jid, i) => {
      text += `${i + 1}. @${jid.split('@')[0]}\n`;
    });

    await sock.sendMessage(
      m.from,
      { text, mentions: admins },
      { quoted: m.raw }
    );
    await m.react('✅');
  },
};
