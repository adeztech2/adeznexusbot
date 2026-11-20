import { getSetting, setSetting, isEnabled } from '../../lib/database/settings.js';

export default {
  name: 'buttons',
  aliases: ['btn', 'togglebuttons'],
  description: 'Toggle interactive buttons on or off (use off for iOS)',
  usage: 'buttons <on|off>',
  category: 'owner',
  owner: true,
  group: false,
  private: false,

  async execute(sock, m, args) {
    const val = args[0]?.toLowerCase();

    if (!val) {
      const current = isEnabled('useButtons') ? '✅ ON' : '❌ OFF';
      return m.reply(`🔘 Buttons are currently: *${current}*\n\nUse \`buttons on\` or \`buttons off\` to toggle.`);
    }

    const isOn = ['on', 'true', '1', 'yes'].includes(val);
    const isOff = ['off', 'false', '0', 'no'].includes(val);

    if (!isOn && !isOff) {
      return m.reply('❌ Invalid value. Use `on` or `off`.');
    }

    const newVal = isOn ? 'true' : 'false';
    const current = getSetting('useButtons');

    if (current === newVal) {
      return m.reply(`ℹ️ Buttons are already *${isOn ? 'ON' : 'OFF'}*.`);
    }

    await setSetting('useButtons', newVal);

    if (isOn) {
      return m.reply('✅ Interactive buttons *enabled*.\nAll commands will now show buttons.');
    } else {
      return m.reply('❌ Interactive buttons *disabled*.\nCommands will send plain text/media directly.\n\n_Useful for iOS users who cannot see buttons._');
    }
  },
};
