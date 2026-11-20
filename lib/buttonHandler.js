import { createRequire } from 'module';
import { getSetting, isEnabled } from './database/settings.js';

const require = createRequire(import.meta.url);
const { sendButtons } = require('gifted-btns');

export { sendButtons };

export function getFooter() {
  const raw = (getSetting('botFooter') || getSetting('footer') || 'ADEZ NEXUS').trim();
  if (/^> \*.+\*$/.test(raw)) return raw;
  return `> *${raw}*`;
}

export function getBotName() {
  return getSetting('botName') || 'ADEZ NEXUS';
}

export function extractButtonId(message) {
  if (!message) return null;
  if (message.templateButtonReplyMessage?.selectedId)
    return message.templateButtonReplyMessage.selectedId;
  if (message.buttonsResponseMessage?.selectedButtonId)
    return message.buttonsResponseMessage.selectedButtonId;
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId)
    return message.listResponseMessage.singleSelectReply.selectedRowId;
  if (message.interactiveResponseMessage) {
    const nf = message.interactiveResponseMessage.nativeFlowResponseMessage;
    if (nf?.paramsJson) {
      try {
        const p = JSON.parse(nf.paramsJson);
        if (p.id) return p.id;
      } catch {}
    }
    return message.interactiveResponseMessage.buttonId || null;
  }
  return null;
}

export async function sendBtnOrText(sock, jid, opts) {
  if (isEnabled('useButtons')) {
    try {
      return await sendButtons(sock, jid, { ...opts, footer: opts.footer ?? getFooter() });
    } catch (_) {
      // Button messages are heavily rate-limited by WhatsApp — fall through to plain text
    }
  }
  const parts = [opts.title && `*${opts.title}*`, opts.text, opts.footer ?? getFooter()].filter(Boolean);
  return sock.sendMessage(jid, { text: parts.join('\n\n') });
}
