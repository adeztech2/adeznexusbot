import { downloadMediaMessage } from 'gifted-baileys';
import { safeStringify } from './db.js';
import { getStoreDb } from './sqlite.js';
import { getSetting } from './settings.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function isDeleteMessage(mek) {
  return !!(mek.message?.protocolMessage?.type === 0);
}

function getMessageCategory(mek) {
  const jid = mek.key.remoteJid;
  if (jid === 'status@broadcast') return 'status';
  if (jid.endsWith('@g.us'))      return 'group';
  return 'private';
}

// ── Cached prepared statements ────────────────────────────────────────────────
let _saveStmt = null;
let _getStmt  = null;
let _delStmt  = null;

function getSaveStmt() {
  if (!_saveStmt) _saveStmt = getStoreDb().prepare(
    `INSERT OR REPLACE INTO antidelete_store (id, jid, sender, push_name, data, ts)
     VALUES (?, ?, ?, ?, ?, unixepoch())`
  );
  return _saveStmt;
}

function getGetStmt() {
  if (!_getStmt) _getStmt = getStoreDb().prepare(
    'SELECT data FROM antidelete_store WHERE id = ?'
  );
  return _getStmt;
}

function getDelStmt() {
  if (!_delStmt) _delStmt = getStoreDb().prepare(
    'DELETE FROM antidelete_store WHERE ts < ?'
  );
  return _delStmt;
}

// ── Resolve real phone JID from a message key ─────────────────────────────────
function resolveSenderJid(key, msgParticipant) {
  const mode = key.addressingMode;
  if (mode === 'lid') return key.remoteJidAlt || key.participant || key.remoteJid;
  return key.participant || msgParticipant || key.remoteJidAlt || key.remoteJid;
}

// ── Save message ──────────────────────────────────────────────────────────────
async function saveMessage(mek) {
  try {
    getSaveStmt().run(
      mek.key.id,
      mek.key.remoteJid,
      resolveSenderJid(mek.key, mek.participant),
      mek.pushName || null,
      safeStringify(mek)
    );
  } catch (e) { console.error('[antidelete] save:', e.message); }
}

// ── Get original message ──────────────────────────────────────────────────────
async function getOriginalMessage(deletedKey) {
  try {
    const row = getGetStmt().get(deletedKey.id);
    return row ? JSON.parse(row.data) : null;
  } catch (_) { return null; }
}

// ── Formatting ────────────────────────────────────────────────────────────────
function formatKenyanTime(timestamp) {
  const tz = getSetting('timezone') || 'Africa/Nairobi';
  const d  = new Date(new Date(timestamp * 1000).toLocaleString('en-US', { timeZone: tz }));
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}:${ss}`;
}

function formatJid(jid) {
  return jid ? jid.split('@')[0] : 'Unknown';
}

async function formatDeleteNotification(sock, originalMsg, deleteMsg) {
  const type    = getMessageCategory(originalMsg);
  const senderName = originalMsg.pushName || 'Unknown';
  let senderJid = '';
  let locInfo   = '';
  let locEmoji  = '';

  if (type === 'status') {
    locEmoji  = '📢'; locInfo = 'Status';
    senderJid = resolveSenderJid(originalMsg.key, originalMsg.participant);
  } else if (type === 'group') {
    locEmoji = '👥';
    let groupName = 'Unknown Group';
    try { groupName = (await sock.groupMetadata(originalMsg.key.remoteJid)).subject; } catch (_) {}
    locInfo   = `Group: ${groupName}`;
    senderJid = resolveSenderJid(originalMsg.key, originalMsg.participant);
  } else {
    locEmoji  = '💬'; locInfo = 'Private Chat';
    senderJid = originalMsg.key.remoteJidAlt || originalMsg.key.remoteJid;
  }

  return {
    text: `🗑️ *DELETED MESSAGE DETECTED*\n\n` +
          `*📍 Location:* ${locEmoji} ${locInfo}\n` +
          `*👤 Sender Name:* ${senderName}\n` +
          `*📱 Sender ID:* @${formatJid(senderJid)}\n` +
          `*⏰ Sent At:* ${formatKenyanTime(originalMsg.messageTimestamp)}\n` +
          `*🕒 Deleted At:* ${formatKenyanTime(deleteMsg.messageTimestamp)}`,
    mentionJid: `${formatJid(senderJid)}@s.whatsapp.net`
  };
}

async function downloadMedia(mek) {
  return downloadMediaMessage(mek, 'buffer', {}, { logger: console });
}

async function sendDeletedMedia(sock, originalMsg, deleteMsg, botNumber) {
  try {
    const n = await formatDeleteNotification(sock, originalMsg, deleteMsg);
    const m = originalMsg.message;
    const mediaReply = (mediaMsg) => ({
      caption: mediaMsg.caption ? `${n.text}\n\n*📝 Caption:* ${mediaMsg.caption}` : n.text,
      mentions: [n.mentionJid]
    });

    if (m.imageMessage)    { await sock.sendMessage(botNumber, { image:    await downloadMedia(originalMsg), ...mediaReply(m.imageMessage) });    return true; }
    if (m.videoMessage)    { await sock.sendMessage(botNumber, { video:    await downloadMedia(originalMsg), ...mediaReply(m.videoMessage) });    return true; }
    if (m.stickerMessage)  { await sock.sendMessage(botNumber, { sticker:  await downloadMedia(originalMsg) });                                   return true; }
    if (m.documentMessage) { await sock.sendMessage(botNumber, { document: await downloadMedia(originalMsg), fileName: m.documentMessage.fileName, mimetype: m.documentMessage.mimetype, ...mediaReply(m.documentMessage) }); return true; }
    if (m.audioMessage)    { await sock.sendMessage(botNumber, { audio: await downloadMedia(originalMsg), mimetype: 'audio/mpeg', ptt: m.audioMessage.ptt === true, caption: n.text }); return true; }
    return false;
  } catch (_) { return false; }
}

function extractTextContent(message) {
  if (!message) return null;
  if (message.conversation)              return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  return null;
}

async function handleDeletedMessage(sock, deleteMsg) {
  try {
    const deletedKey  = deleteMsg.message.protocolMessage.key;
    const originalMsg = await getOriginalMessage(deletedKey);
    if (!originalMsg) return;

    const botNumber = sock.user.id.replace(/:\d+(@s\.whatsapp\.net)$/, '$1');
    if (await sendDeletedMedia(sock, originalMsg, deleteMsg, botNumber)) return;

    const n           = await formatDeleteNotification(sock, originalMsg, deleteMsg);
    const textContent = extractTextContent(originalMsg.message);

    await sock.sendMessage(botNumber, {
      text: textContent ? `${n.text}\n\n*📝 Message:*\n${textContent}` : n.text,
      mentions: [n.mentionJid]
    });
  } catch (_) {}
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
function cleanupOldMessages() {
  try {
    getDelStmt().run(Math.floor(Date.now() / 1000) - 6 * 60 * 60); // 6 hours
  } catch (_) {}
}

export function startPeriodicCleanup() {
  cleanupOldMessages();
  setInterval(cleanupOldMessages, 60 * 60 * 1000);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function antiDeleteHandler(sock, mek) {
  try {
    const jid = mek.key?.remoteJid;
    if (jid === 'status@broadcast') return;
    if (isDeleteMessage(mek)) {
      if (mek.key?.fromMe) return;
      await handleDeletedMessage(sock, mek);
      return;
    }
    await saveMessage(mek);
  } catch (_) {}
}

export { saveMessage, isDeleteMessage, handleDeletedMessage, getOriginalMessage };
