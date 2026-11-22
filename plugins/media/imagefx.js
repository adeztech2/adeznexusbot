import sharp from 'sharp';
import { getMedia } from '../../lib/utils/mediaInput.js';
import { clamp } from '../../lib/utils/cmdUtils.js';

// Each effect receives (buffer, args) and returns a sharp pipeline.
const EFFECTS = {
  blur: {
    aliases: ['blurry'],
    description: 'Blur an image',
    usage: 'blur [1-50]',
    fn: async (buf, args) => sharp(buf).blur(clamp(parseFloat(args[0]) || 8, 1, 50)),
  },
  grey: {
    aliases: ['greyscale', 'grayscale', 'bw'],
    description: 'Turn an image black and white',
    usage: 'grey',
    fn: async (buf) => sharp(buf).greyscale(),
  },
  invert: {
    aliases: ['negate', 'negative'],
    description: 'Invert the colours of an image',
    usage: 'invert',
    fn: async (buf) => sharp(buf).negate({ alpha: false }),
  },
  sepia: {
    aliases: [],
    description: 'Give an image a warm vintage look',
    usage: 'sepia',
    fn: async (buf) => sharp(buf).recomb([
      [0.393, 0.769, 0.189],
      [0.349, 0.686, 0.168],
      [0.272, 0.534, 0.131],
    ]),
  },
  flip: {
    aliases: ['upsidedown'],
    description: 'Flip an image upside down',
    usage: 'flip',
    fn: async (buf) => sharp(buf).flip(),
  },
  flop: {
    aliases: ['mirror'],
    description: 'Mirror an image left to right',
    usage: 'flop',
    fn: async (buf) => sharp(buf).flop(),
  },
  rotate: {
    aliases: ['spin'],
    description: 'Rotate an image (default 90°)',
    usage: 'rotate [degrees]',
    fn: async (buf, args) => {
      const deg = parseInt(args[0], 10);
      return sharp(buf).rotate(Number.isNaN(deg) ? 90 : deg, { background: '#ffffff' });
    },
  },
  pixelate: {
    aliases: ['pixel'],
    description: 'Pixelate an image',
    usage: 'pixelate [2-64]',
    fn: async (buf, args) => {
      const { width, height } = await sharp(buf).metadata();
      const factor = clamp(parseInt(args[0], 10) || 16, 2, 64);
      const small = await sharp(buf).resize(Math.max(1, Math.round(width / factor))).toBuffer();
      return sharp(small).resize(width, height, { kernel: 'nearest' });
    },
  },
  circle: {
    aliases: ['round'],
    description: 'Crop an image into a circle (transparent corners)',
    usage: 'circle',
    png: true,
    fn: async (buf) => {
      const { width, height } = await sharp(buf).metadata();
      const s = Math.min(width, height);
      const mask = Buffer.from(
        `<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="#fff"/></svg>`
      );
      return sharp(buf).resize(s, s, { fit: 'cover' }).composite([{ input: mask, blend: 'dest-in' }]);
    },
  },
};

export default Object.entries(EFFECTS).map(([name, fx]) => ({
  name,
  aliases:     fx.aliases,
  description: fx.description,
  usage:       `${fx.usage}  (reply to an image or send one with the command)`,
  category:    'media',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const media = await getMedia(m, ['image', 'sticker']);
    if (!media) return m.reply('❌ Reply to an image (or send one with the command as the caption).');

    let out;
    try {
      const pipeline = await fx.fn(media.buffer, args);
      out = await (fx.png ? pipeline.png() : pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 90 })).toBuffer();
    } catch (err) {
      console.error(`[${name}]`, err.message);
      throw new Error('Could not process that image.');
    }

    return sock.sendMessage(m.from, { image: out }, { quoted: m });
  },
}));
