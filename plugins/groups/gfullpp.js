import { padToSquare } from '../../lib/utils/imageUtils.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

export default {
  name:        'gfullpp',
  aliases:     ['gcfullpp', 'setgcfullpp', 'setfullicon', 'groupfullpp'],
  description: 'Set full group profile picture — entire image preserved (no cropping)',
  usage:       '.gfullpp (reply to image, or send image with .gfullpp as caption)',
  category:    'group',
  owner:       false,
  group:       true,
  private:     false,
  admin:       true,
  botAdmin:    true,

  async execute(sock, m) {
    const useQuoted  = m.quoted?.isImage;
    const useCurrent = !useQuoted && m.isImage;

    if (!useQuoted && !useCurrent) {
      return m.reply('❌ Reply to an image, or send an image with *.gfullpp* as caption!');
    }

    await m.react('⏳');

    const raw = useQuoted ? await m.quoted.download() : await m.download();
    if (!raw?.length) throw new Error('Failed to download image');

    const padded  = await padToSquare(raw);
    const tmpPath = path.join(os.tmpdir(), `gfullpp_${Date.now()}.jpg`);
    try {
      fs.writeFileSync(tmpPath, padded);
      try {
        await sock.updateProfilePicture(m.from, { url: tmpPath });
      } catch {
        await sock.query({
          tag: 'iq',
          attrs: { to: m.from, type: 'set', xmlns: 'w:profile:picture' },
          content: [{ tag: 'picture', attrs: { type: 'image' }, content: padded }],
        });
      }
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }

    await m.reply('✅ *Full group icon updated!*\n_Image padded to square — no content cropped._');
    await m.react('✅');
  },
};
