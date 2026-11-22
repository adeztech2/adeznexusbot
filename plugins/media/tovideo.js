import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

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

// ffmpeg cannot decode animated WebP directly — extract frames via sharp first
async function animatedWebpToMp4(webpBuf) {
  const tmp       = os.tmpdir();
  const ts        = Date.now();
  const framesDir = path.join(tmp, `s2v_frames_${ts}`);
  const outF      = path.join(tmp, `s2v_out_${ts}.mp4`);

  try {
    fs.mkdirSync(framesDir, { recursive: true });

    const meta   = await sharp(webpBuf, { animated: true }).metadata();
    const pages  = meta.pages || 1;
    const delays = Array.isArray(meta.delay) ? meta.delay : Array(pages).fill(100);
    const avgMs  = delays.reduce((a, b) => a + b, 0) / delays.length;
    const fps    = Math.max(1, Math.min(30, Math.round(1000 / avgMs)));

    // Extract every frame as PNG
    for (let i = 0; i < pages; i++) {
      const frame = await sharp(webpBuf, { page: i })
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      fs.writeFileSync(path.join(framesDir, `f${String(i).padStart(5, '0')}.png`), frame);
    }

    await execAsync(
      `ffmpeg -y -framerate ${fps} -i "${framesDir}/f%05d.png" ` +
      `-c:v libx264 -pix_fmt yuv420p -movflags +faststart -preset fast "${outF}"`,
      { timeout: 90_000 }
    );

    return fs.readFileSync(outF);
  } finally {
    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(outF); } catch {}
  }
}

export default {
  name:        'tovideo',
  aliases:     ['s2video', 's2vid', 'stickertovideo'],
  description: 'Convert an animated sticker back to a video (muted MP4)',
  usage:       'tovideo — reply to an animated sticker',
  category:    'utilities',
  timeout:     120_000,
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m) {
    const src =
      (m.quoted?.isSticker ? m.quoted : null) ||
      (m.isSticker          ? m          : null);

    if (!src) return m.reply('❌ Reply to a sticker with *.tovideo*');

    await m.react('🔄');
    try {
      const buf  = await src.download();
      if (!buf?.length) throw new Error('Download failed');

      const type = getStickerType(buf);

      if (type === 'lottie') {
        await m.react('❌'); m._failed = true;
        return m.reply('❌ Lottie/vector stickers cannot be converted to video.');
      }
      if (type === 'static-webp') {
        await m.react('❌'); m._failed = true;
        return m.reply('❌ This is a static sticker. Use *.toimage* to get a picture instead.');
      }

      const mp4 = await animatedWebpToMp4(buf);
      await sock.sendMessage(
        m.from,
        { video: mp4, mimetype: 'video/mp4', caption: '' },
        { quoted: m.raw }
      );
      await m.react('✅');
    } catch (err) {
      console.error('[tovideo] error:', err.message);
      await m.react('❌'); m._failed = true;
      return m.reply('❌ Failed: ' + err.message);
    }
  },
};
