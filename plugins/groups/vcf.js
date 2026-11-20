export default {
  name:        'vcf',
  aliases:     ['contacts', 'savecontact', 'savecontacts'],
  description: 'Export all group participants as a VCF contact file',
  usage:       'vcf',
  category:    'group',
  owner:       false,
  group:       true,
  private:     false,
  admin:       false,

  async execute(sock, m) {
    await m.react('⏳');

    const meta  = await sock.groupMetadata(m.from);
    const name  = meta.subject || 'Group';
    const parts = meta.participants || [];

    let vcf   = '';
    let count = 0;

    for (const p of parts) {
      // Prefer explicit phoneNumber, fall back to extracting from id
      const raw = (p.phoneNumber || p.id || '').split('@')[0].replace(/\D/g, '');
      if (!raw || raw.length < 7) continue;

      count++;
      vcf +=
        `BEGIN:VCARD\n` +
        `VERSION:3.0\n` +
        `FN:[${count}] +${raw}\n` +
        `TEL;type=CELL;type=VOICE;waid=${raw}:+${raw}\n` +
        `END:VCARD\n`;
    }

    if (!count) {
      await m.react('❌');
      return m.reply('❌ Could not extract any valid contacts from this group.');
    }

    await sock.sendMessage(m.from, {
      document: Buffer.from(vcf.trim(), 'utf-8'),
      mimetype: 'text/vcard',
      fileName: `${name}.vcf`,
      caption:  `✅ Contacts exported\n*Group:* ${name}\n*Total:* ${count}`,
    }, { quoted: m.raw });

    await m.react('✅');
  },
};
