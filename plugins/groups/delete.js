import { lidToJid } from '../../lib/connection/helper.js';

export default {
  name:        'delete',
  aliases:     ['del'],
  description: 'Delete a replied-to message (works in groups and private chats)',
  usage:       'delete  (reply to the message you want deleted)',
  category:    'group',
  owner:       false,
  group:       false,   // works in both groups and DMs
  private:     false,
  admin:       true,    // commandHandler only enforces this in groups

  async execute(sock, m, args) {
    if (!m.quoted) return m.reply('❌ Reply to a message to delete it.');

    const isGroup = m.isGroup;

    try {
      if (isGroup) {
        // ── Group: resolve LID → phone JID for participant field ──────────────
        const rawParticipant = m.quoted.participant || m.quoted.sender || '';
        const participant    = rawParticipant
          ? await lidToJid(sock, m.from, rawParticipant)
          : '';

        await sock.sendMessage(m.from, {
          delete: {
            remoteJid:   m.from,
            fromMe:      false,
            id:          m.quoted.stanzaId || m.quoted.id,
            participant,
          },
        });
      } else {
        // ── Private chat: no participant field ────────────────────────────────
        // fromMe=true  → bot's own message, delete for everyone
        // fromMe=false → other person's message, delete for everyone (DM revoke)
        const fromMe = m.quoted.fromMe ?? false;
        await sock.sendMessage(m.from, {
          delete: {
            remoteJid: m.from,
            fromMe,
            id:        m.quoted.stanzaId || m.quoted.id,
          },
        });
      }

      // Also delete the command message itself
      await sock.sendMessage(m.from, { delete: m.key });

    } catch (err) {
      console.error('[delete]', err.message);
      if (isGroup) {
        return m.reply('❌ Failed to delete. Make sure I am an admin with delete permission.');
      }
      return m.reply('❌ Failed to delete the message.');
    }
  },
};
