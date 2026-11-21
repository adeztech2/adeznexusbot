import sharp from 'sharp';

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

export default {
  name:        'toimage',
  aliases:     ['s2image', 's2img', '2img', 'stickertoimage'],
  description: 'Convert a sticker to a high-quality image (PNG)',
  usage:       '.toimage — reply to a sticker',
  category:    'utilities',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m) {
    const src =
      (m.quoted?.isSticker ? m.quoted : null) ||
      (m.isSticker          ? m          : null);

    if (!src) return m.reply('❌ Reply to a sticker with *.toimage*');

    await m.react('🔄');
    try {
      const buf  = await src.download();
      if (!buf?.length) throw new Error('Download failed');

      const type = getStickerType(buf);
      if (type === 'lottie') {
        await m.react('❌'); m._failed = true;
        return m.reply('❌ Lottie/vector stickers cannot be converted to images.');
      }

      // Decode the sticker (first frame only for animated)
      // Then upscale 2× (512→1024) with Lanczos for maximum sharpness
      const png = await sharp(buf, { animated: false })
        .resize(1024, 1024, {
          fit:       'inside',
          kernel:    sharp.kernel.lanczos3,
          withoutEnlargement: false,
        })
        .png({ compressionLevel: 0, effort: 10 })
        .toBuffer();

      await sock.sendMessage(m.from, { image: png, mimetype: 'image/png' }, { quoted: m.raw });
      await m.react('✅');
    } catch (err) {
      console.error('[toimage] error:', err.message);
      await m.react('❌'); m._failed = true;
      return m.reply('❌ Failed: ' + err.message);
    }
  },
};
