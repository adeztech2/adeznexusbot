import sharp from 'sharp';
import { downloadContentFromMessage } from 'gifted-baileys';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';

const execAsync = promisify(exec);
const URL_REGEX = /https?:\/\/[^\s]+/i;

// ── Sticker type detection ────────────────────────────────────────────────────
function getStickerType(buf) {
  if (!buf || buf.length < 12) return 'unknown';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') {
    if (buf.includes(Buffer.from('ANIM'))) return 'animated-webp';
    if (buf.slice(12, 16).toString() === 'VP8X' && (buf[20] & 0x02)) return 'animated-webp';
    return 'static-webp';
  }
  if (buf[0] === 0x1f && buf[1] === 0x8b) return 'lottie';
  return 'unknown';
}

// ── Animated WebP → MP4 via per-frame extraction (ffmpeg cannot decode animated WebP) ──
async function animatedWebpToMp4(webpBuf) {
  const tmp       = os.tmpdir();
  const ts        = Date.now();
  const framesDir = path.join(tmp, `gs_frames_${ts}`);
  const outF      = path.join(tmp, `gs_out_${ts}.mp4`);
  try {
    fs.mkdirSync(framesDir, { recursive: true });

    const meta   = await sharp(webpBuf, { animated: true }).metadata();
    const pages  = meta.pages || 1;
    const delays = Array.isArray(meta.delay) ? meta.delay : Array(pages).fill(100);
    const avgMs  = delays.reduce((a, b) => a + b, 0) / delays.length;
    const fps    = Math.max(1, Math.min(30, Math.round(1000 / avgMs)));

    for (let i = 0; i < pages; i++) {
      const frame = await sharp(webpBuf, { page: i })
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      fs.writeFileSync(path.join(framesDir, `f${String(i).padStart(5, '0')}.png`), frame);
    }

    await execAsync(
      `ffmpeg -y -framerate ${fps} -i "${framesDir}/f%05d.png" ` +
      `-f lavfi -i anullsrc=r=44100:cl=stereo ` +
      `-c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 64k ` +
      `-movflags +faststart -preset fast -shortest "${outF}"`,
      { timeout: 90_000 }
    );
    return fs.readFileSync(outF);
  } finally {
    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(outF); } catch {}
  }
}

// ── Media helpers ─────────────────────────────────────────────────────────────
async function downloadMedia(msgObj, type) {
  const stream = await downloadContentFromMessage(msgObj, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function fetchUrl(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return { buffer: Buffer.from(res.data), contentType: res.headers['content-type'] || '' };
}

// ── Payload builder ───────────────────────────────────────────────────────────
async function buildPayload(quoted, captionOverride) {
  const msg = quoted.message;

  if (msg.imageMessage) {
    const buffer = await downloadMedia(msg.imageMessage, 'image');
    return {
      image:    buffer,
      caption:  captionOverride ?? (msg.imageMessage.caption || ''),
      mimetype: msg.imageMessage.mimetype || 'image/jpeg',
    };
  }

  if (msg.videoMessage) {
    const buffer = await downloadMedia(msg.videoMessage, 'video');
    return {
      video:       buffer,
      caption:     captionOverride ?? (msg.videoMessage.caption || ''),
      gifPlayback: msg.videoMessage.gifPlayback || false,
      mimetype:    msg.videoMessage.mimetype || 'video/mp4',
    };
  }

  if (msg.stickerMessage) {
    const buffer      = await downloadMedia(msg.stickerMessage, 'sticker');
    const stickerType = getStickerType(buffer);

    if (stickerType === 'lottie') {
      throw new Error(
        'Lottie/vector stickers cannot be sent as group status. Convert it first.'
      );
    }

    if (stickerType === 'animated-webp') {
      const mp4 = await animatedWebpToMp4(buffer);
      return { video: mp4, caption: captionOverride ?? '', mimetype: 'video/mp4' };
    }

    return { image: buffer, caption: captionOverride ?? '', mimetype: 'image/webp' };
  }

  if (msg.audioMessage) {
    const buffer = await downloadMedia(msg.audioMessage, 'audio');
    return {
      audio:    buffer,
      mimetype: msg.audioMessage.mimetype || 'audio/mpeg',
      ptt:      msg.audioMessage.ptt || false,
    };
  }

  if (msg.conversation || msg.extendedTextMessage?.text) {
    return { text: captionOverride ?? (msg.conversation || msg.extendedTextMessage.text) };
  }

  return null;
}

async function buildUrlPayload(url, caption) {
  const { buffer, contentType } = await fetchUrl(url);
  if (contentType.startsWith('image/'))
    return { image: buffer, caption: caption || '', mimetype: contentType };
  if (contentType.startsWith('video/'))
    return { video: buffer, caption: caption || '', mimetype: contentType };
  if (contentType.startsWith('audio/'))
    return { audio: buffer, mimetype: contentType, ptt: false };
  throw new Error(`Unsupported media type from URL: ${contentType}`);
}

// ── Media type label ──────────────────────────────────────────────────────────
function mediaTypeName(payload) {
  if (payload.image) return 'Image';
  if (payload.video) return 'Video';
  if (payload.audio) return 'Audio';
  if (payload.text)  return 'Text';
  return 'Media';
}

// ── Command ───────────────────────────────────────────────────────────────────
export default {
  name:        'groupstatus',
  aliases:     ['togroupstatus', 'gcstatus', 'togcstatus', 'gstatus', 'sendgcstatus'],
  description: 'Send text/media/sticker to group status',
  usage: [
    '!groupstatus <text>',
    '!groupstatus (reply to image/video/audio/sticker)',
    '!groupstatus <caption> (reply to image/video to override caption)',
    '!groupstatus <media URL> [caption]',
  ].join('\n'),
  category: 'owner',
  timeout:  120_000,
  owner:    true,
  group:    true,
  private:  false,

  async execute(sock, m, args) {
    try {
      const argsText    = args.join(' ').trim();
      const urlMatch    = argsText.match(URL_REGEX);
      const captionText = urlMatch
        ? argsText.replace(urlMatch[0], '').trim() || null
        : argsText || null;

      let payload = null;

      if (m.quoted) {
        payload = await buildPayload(m.quoted, captionText || undefined);
        if (!payload) throw new Error('Could not process that message type.');
      } else if (urlMatch) {
        payload = await buildUrlPayload(urlMatch[0], captionText);
      } else if (captionText) {
        payload = { text: captionText };
      } else {
        return m.reply(
          '❌ Provide something to send:\n\n' +
          '• Reply to image/video/audio/sticker + !gcstatus\n' +
          '• Text: !gcstatus Hello everyone!\n' +
          '• Media URL: !gcstatus https://example.com/audio.mp3\n' +
          '• Override caption: !gcstatus New caption (reply to video)'
        );
      }

      await sock.sendMessage(m.from, { groupStatusMessage: payload });
      const typeName = mediaTypeName(payload);
     // await m.reply(`✅ *${typeName}* sent to group status!${payload.caption ? `\n📝 "${payload.caption}"` : ''}`);

    } catch (error) {
      console.error('Group status error:', error);
      throw new Error(error.message || 'Failed to send to group status!');
    }
  },
};
