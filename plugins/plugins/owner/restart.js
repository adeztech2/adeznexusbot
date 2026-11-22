export default {
  name:        'restart',
  aliases:     ['reboot', 'reload'],
  description: 'Restart the bot (owner only)',
  usage:       'restart',
  category:    'owner',
  owner:       true,
  group:       false,
  private:     false,

  async execute(sock, m) {
    await m.react('🔄');
    await m.reply('🔄 *Restarting...*\nI will be back online in a few seconds.');
    // Render / Heroku start the app again automatically after it exits.
    setTimeout(() => process.exit(0), 2000);
  },
};
