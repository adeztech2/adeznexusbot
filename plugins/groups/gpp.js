import fs from 'fs';
import path from 'path';
import os from 'os';

export default {
  name:        'gpp',
  aliases:     ['setgcpp', 'setgrouppp', 'grouppp', 'gcicon'],
  description: 'Set group profile picture / icon',
  usage:       '.gpp (reply to image, or send image with .gpp as caption)',
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
      return m.reply('❌ Reply to an image, or send an image with *.gpp* as caption!');
    }

    await m.react('⏳');

    const buffer = useQuoted ? await m.quoted.download() : await m.download();
    if (!buffer?.length) throw new Error('Failed to download image');

    const tmpPath = path.join(os.tmpdir(), `gpp_${Date.now()}.jpg`);
    try {
      fs.writeFileSync(tmpPath, buffer);
      try {
        await sock.updateProfilePicture(m.from, { url: tmpPath });
      } catch {
        await sock.query({
          tag: 'iq',
          attrs: { to: m.from, type: 'set', xmlns: 'w:profile:picture' },
          content: [{ tag: 'picture', attrs: { type: 'image' }, content: buffer }],
        });
      }
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }

    await m.reply('✅ *Group icon updated!*');
    await m.react('✅');
  },
};
