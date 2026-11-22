import { getMedia } from '../../lib/utils/mediaInput.js';

export default {
  name:        'togif',
  aliases:     ['gif'],
  description: 'Send a video as an auto-playing GIF',
  usage:       'togif  (reply to a short video)',
  category:    'media',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m) {
    const media = await getMedia(m, ['video']);
    if (!media) return m.reply('❌ Reply to a video.');
    return sock.sendMessage(m.from, { video: media.buffer, gifPlayback: true, caption: '' }, { quoted: m });
  },
};
