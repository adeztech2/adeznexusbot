import axios from 'axios';
import { toPublicUrl } from './uploadUtils.js';

const AUDIO_DOC_MB  = 50;
const VIDEO_DOC_MB  = 130;

export async function getFileSizeMB(url) {
  try {
    const res = await axios.head(url, { timeout: 6_000 });
    const bytes = parseInt(res.headers['content-length'] || '0', 10);
    return bytes > 0 ? bytes / (1024 * 1024) : 0;
  } catch {
    return 0;
  }
}

export async function sendAudioSmart(sock, to, url, opts = {}) {
  const { caption, fileName, title, quoted } = opts;
  const sizeMB = await getFileSizeMB(url);
  const asDoc  = sizeMB > 0 && sizeMB > AUDIO_DOC_MB;

  if (asDoc) {
    const name = fileName || `${(title || 'audio').replace(/[^\w\s.-]/g, '')}.mp3`;
    return sock.sendMessage(to, {
      document: { url },
      mimetype: 'audio/mpeg',
      fileName: name,
      caption:  caption || title || `📄 ${name} (${sizeMB.toFixed(1)} MB)`,
    }, { quoted });
  }

  return sock.sendMessage(to, {
    audio:    { url },
    mimetype: 'audio/mpeg',
  }, { quoted });
}

export async function sendVideoSmart(sock, to, url, opts = {}) {
  const { caption, fileName, title, quoted } = opts;
  const sizeMB = await getFileSizeMB(url);
  const asDoc  = sizeMB > 0 && sizeMB > VIDEO_DOC_MB;

  if (asDoc) {
    const name = fileName || `${(title || 'video').replace(/[^\w\s.-]/g, '')}.mp4`;
    return sock.sendMessage(to, {
      document: { url },
      mimetype: 'video/mp4',
      fileName: name,
      caption:  caption || title || `📄 ${name} (${sizeMB.toFixed(1)} MB)`,
    }, { quoted });
  }

  return sock.sendMessage(to, {
    video:    { url },
    mimetype: 'video/mp4',
    caption:  caption || '',
  }, { quoted });
}

// ── Media helpers — check current message THEN quoted ────────────────────────

/**
 * Get a public image URL from the current message or a quoted image.
 * Checks current message first (user sent image with command as caption),
 * then falls back to the quoted message.
 */
export async function quotedImageUrl(m) {
  // 1. Current message IS an image (sent with command as caption)
  if (m.isImage) {
    try {
      const buf = await m.download();
      if (buf) return toPublicUrl(buf, 'image.jpg', 'image/jpeg');
    } catch {}
  }
  // 2. Quoted image
  if (!m.quoted?.isImage) return null;
  try {
    const buf = await m.quoted.download();
    if (!buf) return null;
    return toPublicUrl(buf, 'image.jpg', 'image/jpeg');
  } catch { return null; }
}

/**
 * Get a public audio URL from the current message or a quoted audio/document.
 */
export async function quotedAudioUrl(m) {
  // 1. Current message IS audio or a document
  if (m.isAudio || m.isDocument) {
    try {
      const buf = await m.download();
      if (buf) {
        const ptt = m.msg?.ptt;
        const ext = ptt ? 'ogg' : 'mp3';
        return toPublicUrl(buf, `audio.${ext}`, `audio/${ext}`);
      }
    } catch {}
  }
  // 2. Quoted audio/document
  if (!m.quoted?.isAudio && !m.quoted?.isDocument) return null;
  try {
    const buf = await m.quoted.download();
    if (!buf) return null;
    const ptt = m.quoted.message?.audioMessage?.ptt;
    const ext = ptt ? 'ogg' : 'mp3';
    return toPublicUrl(buf, `audio.${ext}`, `audio/${ext}`);
  } catch { return null; }
}

/** Extract raw text from a quoted message — reads text, caption, or document file content. */
export async function quotedDocText(m) {
  const inner = m.quoted?.message;
  if (!inner) return null;
  if (inner.conversation)              return inner.conversation;
  if (inner.extendedTextMessage?.text) return inner.extendedTextMessage.text;
  if (m.quoted?.isDocument) {
    try {
      const buf = await m.quoted.download();
      if (buf) return buf.toString('utf-8');
    } catch {}
    if (inner.documentMessage?.caption) return inner.documentMessage.caption;
  }
  return null;
}
