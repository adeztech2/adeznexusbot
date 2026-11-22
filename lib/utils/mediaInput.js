const FLAGS = { image: 'isImage', video: 'isVideo', audio: 'isAudio', sticker: 'isSticker' };

/**
 * Download media from the current message, or else from the replied-to message.
 * @param {string[]} kinds  any of 'image' | 'video' | 'audio' | 'sticker'
 * @returns {Promise<{buffer: Buffer, kind: string} | null>}
 */
export async function getMedia(m, kinds) {
  for (const k of kinds) {
    if (m[FLAGS[k]]) {
      const buffer = await m.download();
      if (buffer) return { buffer, kind: k };
    }
  }
  for (const k of kinds) {
    if (m.quoted?.[FLAGS[k]]) {
      const buffer = await m.quoted.download();
      if (buffer) return { buffer, kind: k };
    }
  }
  return null;
}
