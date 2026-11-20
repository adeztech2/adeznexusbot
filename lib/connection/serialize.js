import { downloadMediaMessage } from 'gifted-baileys';
import { learnLid, resolveLid } from './groupCache.js';

function normalizeJid(jid) {
  if (!jid) return jid;
  const base = jid.split(':')[0];
  return base.endsWith('@s.whatsapp.net') ? base : `${base}@s.whatsapp.net`;
}

/**
 * Status/ephemeral/viewOnce messages wrap the real media inside a nested .message field.
 * e.g. { statusV3Message: { message: { videoMessage: {...} }, caption: '...' } }
 * This unwraps them so we can detect and download the actual media correctly.
 */
const QUOTED_WRAPPERS = [
  'statusV3Message',
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'documentWithCaptionMessage',
  'videoWithCaptionMessage',
];

function unwrapQuotedMsg(q) {
  if (!q) return { inner: q, isWrapped: false };
  const outerType = Object.keys(q)[0];
  if (QUOTED_WRAPPERS.includes(outerType)) {
    const inner = q[outerType]?.message;
    if (inner && Object.keys(inner).length) {
      return { inner, isWrapped: true, outerType, outerData: q[outerType] };
    }
  }
  return { inner: q, isWrapped: false, outerType };
}

export async function serialize(sock, m) {
  if (!m) return m;

  m.sock   = sock;
  m.fromMe = m.key.fromMe;
  m.id     = m.key.id;

  if (m.key.remoteJid?.endsWith('@lid')) {
    const alt = m.key.remoteJidAlt;
    if (alt && alt.endsWith('@s.whatsapp.net')) {
      learnLid(m.key.remoteJid, alt);
      m.from = alt;
    } else {
      const known = resolveLid(m.key.remoteJid);
      if (known) {
        m.from = known;
      } else if (m.fromMe) {
        m.from = normalizeJid(sock.user.id);
      } else {
        m.from = m.key.remoteJid;
      }
    }
  } else {
    m.from = m.key.remoteJid;
  }

  m.isGroup   = m.from.endsWith('@g.us');
  m.isStatus  = m.from === 'status@broadcast';
  m.isChannel = m.from.endsWith('@newsletter');

  if (m.fromMe) {
    m.sender = normalizeJid(sock.user.id);
  } else if (m.isGroup || m.isStatus) {
    const mode = m.key.addressingMode;
    if (mode === 'lid') {
      const rawSender = m.key.participantAlt || m.participant || m.key.participant || '';
      if (rawSender.endsWith('@lid')) {
        m.sender = resolveLid(rawSender) || rawSender;
      } else {
        m.sender = rawSender;
      }
    } else {
      m.sender = m.key.participant || m.participant || '';
    }
  } else {
    m.sender = m.key.participantAlt || m.key.remoteJidAlt || m.from;
  }

  m.mtype = Object.keys(m.message || {})[0];
  m.msg   = m.message[m.mtype];

  if (m.mtype === 'deviceSentMessage' && m.msg?.message) {
    m.message = m.msg.message;
    m.mtype   = Object.keys(m.message)[0];
    m.msg     = m.message[m.mtype];
  }

  m.body =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
    m.message?.documentMessage?.caption ||
    m.message?.buttonsResponseMessage?.selectedButtonId ||
    m.message?.templateButtonReplyMessage?.selectedId ||
    (() => {
      try {
        const pj = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
        if (pj) return JSON.parse(pj).id || '';
      } catch {}
      return '';
    })() ||
    '';

  // ── Current-message media flags ───────────────────────────────────────────
  m.isImage    = m.mtype === 'imageMessage';
  m.isVideo    = m.mtype === 'videoMessage';
  m.isAudio    = m.mtype === 'audioMessage';
  m.isDocument = m.mtype === 'documentMessage';
  m.isSticker  = m.mtype === 'stickerMessage';
  m.mimetype   = m.msg?.mimetype || null;

  m.download = async () => {
    try {
      return await downloadMediaMessage(m, 'buffer', {}, { logger: console });
    } catch (err) {
      console.error('[m.download] failed:', err);
      return null;
    }
  };

  // ── Quoted message ────────────────────────────────────────────────────────
  const quoted = m.msg?.contextInfo?.quotedMessage;

  m.quoted = quoted ? (() => {
    const q    = quoted;

    // Unwrap status/ephemeral/viewOnce wrappers so we see the real media type
    const { inner, isWrapped, outerData } = unwrapQuotedMsg(q);
    const type = Object.keys(inner)[0];

    // Caption falls back through wrapper's caption field for status messages
    const wrapperCaption = isWrapped ? (outerData?.caption || outerData?.text || '') : '';
    const content =
      inner.conversation ||
      inner.extendedTextMessage?.text ||
      inner.imageMessage?.caption ||
      inner.videoMessage?.caption ||
      inner.documentMessage?.caption ||
      inner.buttonsMessage?.contentText ||
      inner.listMessage?.description ||
      wrapperCaption ||
      '';

    const ctx = m.msg.contextInfo;

    // FIX: keep @lid JIDs as-is — lidToJid() will resolve them downstream.
    // Previous code dropped @lid and fell back to m.from (group JID), breaking
    // all commands that resolve the quoted user in LID-addressed groups.
    const quotedSender =
      ctx.participantAlt ||
      ctx.participant    ||
      m.from;

    return {
      ...ctx,
      message:     inner,
      id:          ctx.stanzaId,
      chat:        m.from,
      sender:      quotedSender,
      fromMe:      quotedSender === normalizeJid(sock.user.id),
      type,
      text:        content,
      mentionedJid: inner.extendedTextMessage?.contextInfo?.mentionedJid || [],
      isText:      type === 'conversation' || type === 'extendedTextMessage',
      isImage:     type === 'imageMessage',
      isVideo:     type === 'videoMessage',
      isAudio:     type === 'audioMessage',
      isSticker:   type === 'stickerMessage',
      isDocument:  type === 'documentMessage',
      mimetype:    inner[type]?.mimetype || null,
      fileLength:  inner[type]?.fileLength || null,
      seconds:     inner.audioMessage?.seconds || inner.videoMessage?.seconds || null,
      caption:     inner.imageMessage?.caption || inner.videoMessage?.caption || inner.documentMessage?.caption || wrapperCaption || null,
      contextInfo: inner.extendedTextMessage?.contextInfo || {},
      getQuotedObj() { return this; },
      async download() {
        try {
          const msg = {
            // Use inner (unwrapped) message for download so Baileys finds the right media keys
            message: inner,
            key: {
              remoteJid:   m.from,
              id:          this.id,
              fromMe:      false,
              participant: ctx.participantAlt || ctx.participant || m.from,
            }
          };
          return await downloadMediaMessage(msg, 'buffer', {}, { logger: console });
        } catch (err) {
          console.error('[quoted.download] failed:', err);
          return null;
        }
      }
    };
  })() : null;

  m.reply = async (text, chatId = m.from, options = {}) =>
    sock.sendMessage(chatId, { text }, { quoted: m, ...options });

  m.react = async (emoji) =>
    sock.sendMessage(m.from, { react: { text: emoji, key: m.key } });

  m.raw = m;

  return m;
}
