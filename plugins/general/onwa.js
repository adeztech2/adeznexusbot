export default {
  name:        'onwa',
  aliases:     ['onwhatsapp', 'checkwa', 'checknumber'],
  description: 'Check if a phone number is registered on WhatsApp',
  usage:       'onwa <number>',
  category:    'general',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const raw = args.join('').replace(/\D/g, '');

    if (!raw || raw.length < 7 || raw.length > 15) {
      return m.reply(
        `❌ Please provide a valid phone number with country code.\n\nExample: ,onwa 254712345678`
      );
    }

    await m.react('⏳');

    try {
      const [result] = await sock.onWhatsApp(raw);

      if (result?.exists) {
        await m.react('✅');
        return m.reply(
          `✅ *Number Found on WhatsApp*\n\n` +
          `📞 *Number:* +${raw}\n` +
          `🆔 *JID:* ${result.jid}\n\n` +
          `_This number is registered on WhatsApp._`
        );
      } else {
        await m.react('❌');
        return m.reply(
          `❌ *Not on WhatsApp*\n\n` +
          `📞 *Number:* +${raw}\n\n` +
          `_This number is not registered on WhatsApp._`
        );
      }
    } catch (err) {
      await m.react('⚠️');
      return m.reply(`⚠️ Could not verify +${raw}.\n\n_Please try again later._`);
    }
  },
};
