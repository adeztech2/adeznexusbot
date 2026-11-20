import { padToSquare } from '../../lib/utils/imageUtils.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

export default {
  name:        'setfullpp',
  aliases:     ['setbotfullpp', 'botfullpp'],
  description: 'Set bot full profile picture — entire image preserved (no cropping)',
  usage:       '.setfullpp (reply to image, or send image with .setfullpp as caption)',
  category:    'owner',
  owner:       true,
  group:       false,
  private:     false,

  async execute(sock, m) {
    const useQuoted  = m.quoted?.isImage;
    const useCurrent = !useQuoted && m.isImage;

    if (!useQuoted && !useCurrent) {
      return m.reply('❌ Reply to an image, or send an image with *.setfullpp* as caption!');
    }

    await m.react('⏳');

    const raw = useQuoted ? await m.quoted.download() : await m.download();
    if (!raw?.length) throw new Error('Failed to download image');

    const padded  = await padToSquare(raw);
    const tmpPath = path.join(os.tmpdir(), `setfullpp_${Date.now()}.jpg`);
    try {
      fs.writeFileSync(tmpPath, padded);
      try {
        await sock.updateProfilePicture(sock.user.id, { url: tmpPath });
      } catch {
        await sock.query({
          tag: 'iq',
          attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'w:profile:picture' },
          content: [{ tag: 'picture', attrs: { type: 'image' }, content: padded }],
        });
      }
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }

    await m.reply('✅ *Bot full profile picture updated!*\n_Image padded to square — no content cropped._');
    await m.react('✅');
  },
};
