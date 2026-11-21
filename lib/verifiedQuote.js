import { getSetting, isEnabled } from './database/settings.js';
import { OWNER_NUMBER } from '../config.js';

// Builds a fake "verified business" status-style message that every bot reply quotes.
// Purely cosmetic: it shows the bot's reply under a branded, verified-looking contact card.
export function buildVerifiedQuote() {
  const name  = getSetting('verifiedName') || 'ADEZ TECH ✅';
  const owner = OWNER_NUMBER || '0';
  return {
    key: {
      fromMe: false,
      participant: '0@s.whatsapp.net',
      remoteJid: 'status@broadcast',
    },
    message: {
      contactMessage: {
        displayName: name,
        vcard:
          'BEGIN:VCARD\n' +
          'VERSION:3.0\n' +
          `N:;${name};;;\n` +
          `FN:${name}\n` +
          `ORG:${name};\n` +
          `item1.TEL;waid=${owner}:${owner}\n` +
          'item1.X-ABLabel:Verified\n' +
          `X-WA-BIZ-NAME:${name}\n` +
          'X-WA-BIZ-DESCRIPTION:Verified by ADEZ TECH\n' +
          'END:VCARD',
      },
    },
  };
}

// Wrap sock.sendMessage so any reply that quotes a user message quotes the verified card instead.
export function enableVerifiedReplies(sock) {
  if (sock._verifiedWrapped) return;
  const original = sock.sendMessage.bind(sock);
  sock.sendMessage = (jid, content, options = {}) => {
    try {
      if (isEnabled('verifiedReply') && options?.quoted && options.quoted.key?.remoteJid !== 'status@broadcast') {
        options = { ...options, quoted: buildVerifiedQuote() };
      }
    } catch {}
    return original(jid, content, options);
  };
  sock._verifiedWrapped = true;
}
