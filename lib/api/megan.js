import axios from 'axios';
import { MEGAN_API_KEY, MEGAN_API_URL } from '../../config.js';

const UA = 'ADEZ-NEXUS/1.0 (+https://github.com/adeztech2/adeznexusbot)';
const CATALOG_TTL = 15 * 60_000;
let catalogCache = null;
let catalogAt = 0;

function unwrap(body) {
  return body?.data?.result ?? body?.data ?? body?.result ?? body;
}

function errorFrom(body, status) {
  const statusError = body?.status?.error;
  return body?.error || statusError || body?.message || `Megan API request failed (${status})`;
}

export function hasMeganKey() {
  return Boolean(MEGAN_API_KEY);
}

export async function meganRequest(path, { method = 'GET', params = {}, body, timeout = 90_000 } = {}) {
  if (!MEGAN_API_KEY) throw new Error('MEGAN_API_KEY is not configured');
  const url = `${MEGAN_API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const config = {
    method,
    url,
    timeout,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    params: { ...params, api_key: MEGAN_API_KEY },
    validateStatus: () => true,
  };
  if (body !== undefined) {
    config.data = body;
    config.headers['Content-Type'] = 'application/json';
  }
  const res = await axios(config);
  const payload = res.data;
  if (res.status < 200 || res.status >= 300 || payload?.success === false || payload?.status?.success === false) {
    throw new Error(errorFrom(payload, res.status));
  }
  return payload;
}

export async function meganCatalog({ force = false } = {}) {
  if (!force && catalogCache && Date.now() - catalogAt < CATALOG_TTL) return catalogCache;
  const payload = await meganRequest('/api/endpoints', { timeout: 30_000 });
  const result = unwrap(payload);
  const endpoints = Array.isArray(result?.endpoints) ? result.endpoints : [];
  catalogCache = endpoints.filter(e => e?.path && ['GET', 'POST', 'PUT', 'PATCH'].includes(String(e.method || 'GET').toUpperCase()));
  catalogAt = Date.now();
  return catalogCache;
}

export async function meganEndpoint(path, args = {}, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  return meganRequest(path, method === 'GET' ? { method, params: args, timeout: options.timeout } : { method, body: args, timeout: options.timeout });
}

export function unwrapMegan(payload) {
  return unwrap(payload);
}

export function findMediaUrls(value, out = [], seen = new Set()) {
  if (!value || out.length >= 20) return out;
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) && /\.(?:mp3|mp4|m4a|ogg|wav|webm|mov|jpg|jpeg|png|gif|webp)(?:[?#]|$)/i.test(value)) out.push(value);
    return out;
  }
  if (typeof value !== 'object' || seen.has(value)) return out;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (/^(downloadurl|download_url|proxyurl|proxy_url|video|audio|image|media_url|stream_url|file_url|url)$/i.test(key)) {
      if (typeof child === 'string' && /^https?:\/\//i.test(child)) out.push(child);
      else if (Array.isArray(child)) child.forEach(x => findMediaUrls(x, out, seen));
      else findMediaUrls(child, out, seen);
    } else if (key === 'media' && Array.isArray(child)) {
      child.forEach(x => findMediaUrls(x, out, seen));
    }
  }
  return [...new Set(out)].slice(0, 20);
}

export function pickResult(payload) {
  const data = unwrap(payload) || {};
  const mediaUrls = findMediaUrls(data);
  const title = data.title || data.name || data.searchResult?.title || '';
  return { data, mediaUrls, title };
}

export async function meganDownload(path, params = {}, timeout = 120_000) {
  const payload = await meganRequest(path, { params, timeout });
  const { data, mediaUrls, title } = pickResult(payload);
  const first = mediaUrls[0] || data.downloadUrl || data.download_url || data.url || data.video || data.audio;
  if (!first) throw new Error('Megan returned no downloadable URL');
  return { ...data, title, download_url: first, mediaUrls, raw: payload };
}

export function serializeResult(value, max = 12_000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n…(truncated)` : text;
}
