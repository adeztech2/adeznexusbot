import { getOriginalMessage } from './antidelete.js';

function extractTextContent(msg) {
  if (!msg) return null;
  if (msg.conversation)                return msg.conversation;
  if (msg.extendedTextMessage?.text)   return msg.extendedTextMessage.text;
  return null;
}

function extractNewText(mek) {
  const proto = mek.message?.protocolMessage;
  if (proto?.type === 14) {
    const e = proto.editedMessage;
    return e?.conversation
      || e?.extendedTextMessage?.text
      || e?.message?.conversation
      || e?.message?.extendedTextMessage?.text
      || null;
  }
  const e = mek.message?.editedMessage;
  if (e) {
    return e.message?.conversation
      || e.message?.extendedTextMessage?.text
      || e.conversation
      || e.extendedTextMessage?.text
      || null;
  }
  return null;
}

export function isEditMessage(mek) {
  return mek.message?.protocolMessage?.type === 14
    || !!(mek.message?.editedMessage);
}

export async function antiEditHandler(sock, mek) {
  try {
    const newText = extractNewText(mek);
    if (!newText) return;

    const editedKey = mek.message?.protocolMessage?.key
      || mek.message?.editedMessage?.message?.protocolMessage?.key;
    if (!editedKey?.id) return;

    const original = await getOriginalMessage(editedKey);
    if (!original) return;

    const originalText = extractTextContent(original.message);
    if (!originalText) return;

    const botNumber = sock.user.id.replace(/:\d+(@s\.whatsapp\.net)$/, '$1');
    const mode      = original.key.addressingMode;
    const senderJid = mode === 'lid'
      ? (original.key.remoteJidAlt || original.key.participant || original.key.remoteJid)
      : (original.key.participant || original.participant || original.key.remoteJidAlt || original.key.remoteJid || '');
    const senderNum = senderJid.split('@')[0] || 'Unknown';

    await sock.sendMessage(botNumber, {
      text:
        `✏️ *EDITED MESSAGE DETECTED*\n\n` +
        `*👤 Sender:* @${senderNum}\n\n` +
        `*📝 Original:*\n${originalText}\n\n` +
        `*✏️ Edited to:*\n${newText}`,
      mentions: [`${senderNum}@s.whatsapp.net`]
    });
  } catch (_) {}
}
