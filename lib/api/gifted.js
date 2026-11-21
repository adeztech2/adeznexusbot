import axios from 'axios';
import { GIFTED_API, GIFTED_KEY } from '../../config.js';

export { GIFTED_API, GIFTED_KEY };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function giftedGet(path, params = {}, timeout = 30_000) {
  const res = await axios.get(`${GIFTED_API}${path}`, {
    params:  { apikey: GIFTED_KEY, ...params },
    timeout,
    headers: { 'User-Agent': UA },
  });
  if (typeof res.data === 'string' && /^\s*</.test(res.data)) {
    throw new Error('API returned an error page (service may be down). Try again later.');
  }
  return res.data;
}

export async function giftedGetBuffer(path, params = {}, timeout = 30_000) {
  const res = await axios.get(`${GIFTED_API}${path}`, {
    params:       { apikey: GIFTED_KEY, ...params },
    timeout,
    headers:      { 'User-Agent': UA },
    responseType: 'arraybuffer',
  });
  const buf  = Buffer.from(res.data);
  const type = String(res.headers?.['content-type'] || '');
  if (/json|text\/|html/i.test(type) || buf.length < 100) {
    let msg = 'API did not return a file.';
    try { msg = JSON.parse(buf.toString('utf-8'))?.message || msg; } catch {}
    throw new Error(msg);
  }
  return buf;
}

export async function giftedGetRetry(path, params = {}, timeout = 30_000, retries = 3, delay = 3_000) {
  let last;
  for (let i = 0; i < retries; i++) {
    try { return await giftedGet(path, params, timeout); }
    catch (err) { last = err; if (i < retries - 1) await sleep(delay); }
  }
  throw last;
}

export async function giftedGetBufferRetry(path, params = {}, timeout = 30_000, retries = 3, delay = 3_000) {
  let last;
  for (let i = 0; i < retries; i++) {
    try { return await giftedGetBuffer(path, params, timeout); }
    catch (err) { last = err; if (i < retries - 1) await sleep(delay); }
  }
  throw last;
}

export async function giftedPost(path, body = {}, timeout = 30_000) {
  const res = await axios.post(`${GIFTED_API}${path}`, { apikey: GIFTED_KEY, ...body }, {
    timeout,
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
  });
  return res.data;
}

export async function waterfallDownload(url, endpoints, opts = {}) {
  const { timeout = 35_000, retries = 1, delay = 1_500 } = opts;

  for (const ep of endpoints) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const data = await giftedGet(`/api/download/${ep}`, { url }, timeout);
        if (!data?.success) throw new Error(`${ep}: API returned failure`);
        const r = data.result;
        if (!r) throw new Error(`${ep}: no result object`);
        const dlUrl = r.download_url || r.link || r.url || r.audio || r.video;
        if (!dlUrl) throw new Error(`${ep}: no download URL in result`);
        return { ...r, endpoint: ep, download_url: dlUrl };
      } catch {
        if (attempt < retries) { await sleep(delay); continue; }
      }
    }
  }
  throw new Error('All download endpoints failed');
}

export { waterfallDownload as raceDownload };
