import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);
const MAX_BYTES = 490 * 1024; // 490 KB – WhatsApp hard limit is 500 KB




// ── Time helpers ─────────────────────────────────────────────────────────────
function parseTimecode(tc) {
  const parts = String(tc).split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function parseTrimArg(args) {
  const re = /^(\d{1,2}(?::\d{2}){0,2})-(\d{1,2}(?::\d{2}){0,2})$/;
  for (const arg of args) {
    const m = arg.match(re);
    if (m) {
      const start = parseTimecode(m[1]);
      const end   = parseTimecode(m[2]);
      if (start !== null && end !== null && end > start) return { start, end };
    }
  }
  return null;
}

// ── Smart aspect-ratio crop ───────────────────────────────────────────────────
function autoCropDims(width, height) {
  const ratio = width / height;
  if (ratio < 3 / 4) {
    const newH = Math.round(width / (3 / 4));
    return { left: 0, top: Math.floor((height - newH) / 2), width, height: newH };
  }
  if (ratio > 16 / 9) {
    const newW = Math.round(height * (16 / 9));
    return { left: Math.floor((width - newW) / 2), top: 0, width: newW, height };
  }
  return null;
}

// ── Image → 512×512 WebP ─────────────────────────────────────────────────────
async function imageToStickerBuf(inputBuf, cropSquare = false, author = '') {
  const meta = await sharp(inputBuf).metadata();
  let pipeline = sharp(inputBuf);
  if (!cropSquare) {
    const ac = autoCropDims(meta.width, meta.height);
    if (ac) pipeline = pipeline.extract(ac);
  }
  pipeline = cropSquare
    ? pipeline.resize(512, 512, { fit: 'cover',   position: 'centre' })
    : pipeline.resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });

  return pipeline.webp({ quality: 90 }).toBuffer();
}

// ── Sticker re-pack ───────────────────────────────────────────────────────────
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

async function resizeSticker(inputBuf) {
  const type = getStickerType(inputBuf);
  if (type === 'lottie') {
    throw new Error('Lottie/vector stickers cannot be re-packed. Convert it to a video or image first.');
  }

  // Static sticker: sharp handles it fine
  if (type !== 'animated-webp') {
    return sharp(inputBuf)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toBuffer();
  }

  // Animated sticker: sharp animated WebP output breaks mobile WhatsApp.
  // Extract frames individually via sharp, re-encode as animated WebP via ffmpeg.
  const tmp       = os.tmpdir();
  const ts        = Date.now();
  const framesDir = path.join(tmp, `rsk_frames_${ts}`);
  const outF      = path.join(tmp, `rsk_out_${ts}.webp`);

  try {
    fs.mkdirSync(framesDir, { recursive: true });

    const meta   = await sharp(inputBuf, { animated: true }).metadata();
    const pages  = meta.pages || 1;
    const delays = Array.isArray(meta.delay) ? meta.delay : Array(pages).fill(100);
    const avgMs  = delays.reduce((a, b) => a + b, 0) / delays.length;
    const fps    = Math.max(1, Math.min(30, Math.round(1000 / avgMs)));

    for (let i = 0; i < pages; i++) {
      const frame = await sharp(inputBuf, { page: i })
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      fs.writeFileSync(path.join(framesDir, `f${String(i).padStart(5, '0')}.png`), frame);
    }

    await execAsync(
      `ffmpeg -y -framerate ${fps} -i "${framesDir}/f%05d.png" ` +
      `-vf "format=rgba" ` +
      `-vcodec libwebp -quality 80 -lossless 0 -compression_level 6 -method 4 -loop 0 "${outF}"`,
      { timeout: 90_000 }
    );

    return fs.readFileSync(outF);
  } finally {
    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(outF); } catch {}
  }
}

// ── Video → animated WebP (quality-adaptive) ──────────────────────────────────
async function encodePass(inF, outF, { start, dur, size, fps, quality }) {
  await execAsync(
    `ffmpeg -y -ss ${start} -t ${dur} -i "${inF}" ` +
    `-vf "fps=${fps},scale=${size}:${size}:force_original_aspect_ratio=decrease,` +
    `pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba" ` +
    `-an -vcodec libwebp -quality ${quality} -lossless 0 ` +
    `-compression_level 6 -method 4 -loop 0 "${outF}"`
  );
  return fs.statSync(outF).size;
}

async function videoToStickerBuf(inputBuf, trimStart = 0, trimEnd = null) {
  const tmp  = os.tmpdir();
  const ts   = Date.now();
  const inF  = path.join(tmp, `stk_in_${ts}.mp4`);
  const outF = path.join(tmp, `stk_out_${ts}.webp`);

  try {
    fs.writeFileSync(inF, inputBuf);

    let start = trimStart;
    let dur;

    if (trimEnd !== null) {
      dur = Math.min(trimEnd - trimStart, 10);
    } else {
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration ` +
          `-of default=noprint_wrappers=1:nokey=1 "${inF}"`
        );
        const total = parseFloat(stdout.trim());
        dur = (!isNaN(total) && total > 0) ? Math.min(total - start, 10) : 10;
      } catch { dur = 10; }
    }

    if (dur <= 0) throw new Error('Trim range results in zero-length clip');

    // Pass 1 – best quality
    let sz = await encodePass(inF, outF, { start, dur, size: 512, fps: 10, quality: 60 });

    // Pass 2 – reduce resolution
    if (sz > MAX_BYTES) {
      console.warn(`[sticker] ${sz}B > limit – pass 2`);
      sz = await encodePass(inF, outF, { start, dur, size: 384, fps: 10, quality: 50 });
    }

    // Pass 3 – reduce more
    if (sz > MAX_BYTES) {
      console.warn(`[sticker] ${sz}B > limit – pass 3`);
      sz = await encodePass(inF, outF, { start, dur, size: 256, fps: 8, quality: 40 });
    }

    // Pass 4 – last resort: cap duration too
    if (sz > MAX_BYTES) {
      console.warn(`[sticker] ${sz}B > limit – pass 4 (cap dur)`);
      await encodePass(inF, outF, { start, dur: Math.min(dur, 3), size: 256, fps: 8, quality: 30 });
    }

    return fs.readFileSync(outF);
  } finally {
    try { fs.unlinkSync(inF);  } catch { /* ignore */ }
    try { fs.unlinkSync(outF); } catch { /* ignore */ }
  }
}

// ── Command ───────────────────────────────────────────────────────────────────
export default {
  name:        'sticker',
  aliases:     ['s', 'stiker', 'take', 'st'],
  description: 'Convert image/video/sticker to a WhatsApp sticker',
  usage:       [
    '.sticker             – reply to or send media',
    '.sticker --crop / -c – force square crop',
    '.sticker 0:30-0:40   – video: use seconds 30–40 (MM:SS-MM:SS)',
  ].join('\n'),
  category: 'utilities',
  timeout:  120_000,
  owner:    false,
  group:    false,
  private:  false,

  async execute(sock, m, args) {
    const useQuoted  = m.quoted && (m.quoted.isImage || m.quoted.isVideo || m.quoted.isSticker);
    const useCurrent = !useQuoted && (m.isImage || m.isVideo || m.isSticker);

    if (!useQuoted && !useCurrent) {
      return m.reply(
        '❌ Reply to an image, video, or sticker — or send media with *.sticker* as caption!\n\n' +
        '*Options:*\n' +
        '`--crop` / `-c` → square crop\n' +
        '`1:30-2:00` → trim video (MM:SS-MM:SS)'
      );
    }

    const src      = useQuoted ? m.quoted : m;
    const isVideo  = src.isVideo;
    const isStkr   = src.isSticker;
    const cropFlag = args.includes('--crop') || args.includes('-c');
    const trim     = parseTrimArg(args);

    await m.react('🔄');

    try {
      const buffer = await src.download();
      if (!buffer?.length) throw new Error('Failed to download media');

      const author = m.pushName || 'User';
      let webpBuf;
      if (isVideo) {
        // Video: no EXIF modification — raw animated WebP works correctly on mobile
        webpBuf = await videoToStickerBuf(buffer, trim?.start ?? 0, trim?.end ?? null);
      } else if (isStkr) {
        webpBuf = await resizeSticker(buffer);
      } else {
        // Image: sharp embeds metadata natively (safe VP8X format)
        webpBuf = await imageToStickerBuf(buffer, cropFlag, author);
      }

      await sock.sendMessage(m.from, { sticker: webpBuf }, { quoted: m.raw });
      await m.react('✅');

    } catch (err) {
      console.error('[sticker] error:', err.message);
      await m.react('❌');
      return m.reply('❌ Failed to create sticker: ' + err.message);
    }
  },
};
