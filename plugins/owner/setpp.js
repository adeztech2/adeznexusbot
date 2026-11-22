import fs from 'fs';
import path from 'path';
import os from 'os';

export default {
  name:        'setpp',
  aliases:     ['setbotpp', 'botpp', 'changepp'],
  description: 'Set bot profile picture',
  usage:       'setpp (reply to image, or send image with setpp as caption)',
  category:    'owner',
  owner:       true,
  group:       false,
  private:     false,

  async execute(sock, m) {
    const useQuoted  = m.quoted?.isImage;
    const useCurrent = !useQuoted && m.isImage;

    if (!useQuoted && !useCurrent) {
      return m.reply('❌ Reply to an image, or send an image with *.setpp* as caption!');
    }

    await m.react('⏳');

    const buffer = useQuoted ? await m.quoted.download() : await m.download();
    if (!buffer?.length) throw new Error('Failed to download image');

    const tmpPath = path.join(os.tmpdir(), `setpp_${Date.now()}.jpg`);
    try {
      fs.writeFileSync(tmpPath, buffer);
      try {
        await sock.updateProfilePicture(sock.user.id, { url: tmpPath });
      } catch {
        await sock.query({
          tag: 'iq',
          attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'w:profile:picture' },
          content: [{ tag: 'picture', attrs: { type: 'image' }, content: buffer }],
        });
      }
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }

    await m.reply('✅ *Bot profile picture updated!*');
    await m.react('✅');
  },
};
