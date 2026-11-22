import { getSetting } from '../../lib/database/settings.js';
import { getFooter } from '../../lib/buttonHandler.js';
import { getForwardFields } from '../../lib/forwardContext.js';

const PLACEHOLDER = 'https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg';

export default {
  name:        'getgcpp',
  aliases:     ['gcpp', 'grouppic', 'groupicon'],
  description: 'Get the current group profile picture',
  usage:       'getgcpp',
  category:    'group',
  owner:       false,
  group:       true,
  private:     false,

  async execute(sock, m) {
    await m.react('👀');

    let ppUrl = PLACEHOLDER;
    try {
      ppUrl = await sock.profilePictureUrl(m.from, 'image');
    } catch { /* use placeholder */ }

    const meta          = await sock.groupMetadata(m.from).catch(() => null);
    const groupName     = meta?.subject || 'Group';

    await sock.sendMessage(m.from, {
      image:   { url: ppUrl },
      caption: `*📸 Group Profile Picture*\n\n*• Group:* ${groupName}\n\n${getFooter()}`,
      contextInfo: {
        ...getForwardFields(5, 143),
      },
    }, { quoted: m.raw });

    await m.react('✅');
  },
};
