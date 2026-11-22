import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Run ffmpeg on a buffer and return the output buffer.
 * Uses execFile with an argument array (no shell), so user text can never be injected.
 *
 * @param {Buffer}   input
 * @param {string[]} args     output options, e.g. ['-vn', '-acodec', 'libmp3lame']
 * @param {string}   outExt   e.g. 'mp3'
 */
export function runFfmpeg(input, args, outExt, timeoutMs = 100_000) {
  const id   = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const inF  = path.join(os.tmpdir(), `ff_${id}.bin`);
  const outF = path.join(os.tmpdir(), `ff_${id}_out.${outExt}`);

  const cleanup = () => {
    for (const f of [inF, outF]) { try { fs.unlinkSync(f); } catch {} }
  };

  fs.writeFileSync(inF, input);

  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-y', '-i', inF, ...args, outF], { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err) => {
      try {
        if (err) return reject(new Error('Could not process that file (ffmpeg failed).'));
        resolve(fs.readFileSync(outF));
      } catch (e) {
        reject(e);
      } finally {
        cleanup();
      }
    });
  });
}
