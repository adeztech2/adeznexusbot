import sharp from 'sharp';

/**
 * Pad an image into a square canvas (letterbox/pillarbox) so that
 * the full image is visible even after WhatsApp's circular crop.
 * Portrait → adds left/right bars; Landscape → adds top/bottom bars.
 *
 * @param {Buffer} inputBuffer - Raw image buffer (any format)
 * @param {object} [opts]
 * @param {number} [opts.size=640]     - Output canvas size (square)
 * @param {object} [opts.background]   - Sharp background colour
 * @returns {Promise<Buffer>} JPEG buffer ready for updateProfilePicture
 */
export async function padToSquare(inputBuffer, opts = {}) {
  const size       = opts.size       ?? 640;
  const background = opts.background ?? { r: 0, g: 0, b: 0, alpha: 255 };

  return sharp(inputBuffer)
    .resize(size, size, {
      fit: 'contain',      // letterbox/pillarbox — keeps ALL content
      background,
      withoutEnlargement: false,
    })
    .jpeg({ quality: 95 })
    .toBuffer();
}
