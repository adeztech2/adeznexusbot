/** Text after the command word, with spaces and line breaks preserved. */
export function rawText(m) {
  return (m.body || '').trim().replace(/^\S+\s*/, '');
}

/** Text from the command arguments, falling back to the replied-to message. */
export function textInput(m) {
  return rawText(m) || m.quoted?.text || '';
}

export const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Stable 0–100 number for a string (same input → same result). */
export function hashPercent(str) {
  let h = 0;
  for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 101;
}
