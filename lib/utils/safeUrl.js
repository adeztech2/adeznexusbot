import dns from 'dns/promises';
import net from 'net';
import axios from 'axios';

// Blocks requests to localhost / private / cloud-metadata addresses (SSRF guard)
// for commands that fetch a URL typed by a user.

function isPrivateV4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) {
    const l = ip.toLowerCase();
    if (l === '::' || l === '::1') return true;
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateV4(mapped[1]);
    return /^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith('ff');
  }
  return true;
}

export async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('Invalid URL.'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http and https links are allowed.');

  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error('Blocked: internal address.');
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Blocked: internal address.');
    return u.href;
  }
  let addrs;
  try { addrs = await dns.lookup(host, { all: true }); }
  catch { throw new Error('Could not resolve that host.'); }
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) {
    throw new Error('Blocked: internal address.');
  }
  return u.href;
}

// axios.get that checks the URL (and every redirect) before connecting.
export async function safeGet(url, opts = {}, maxRedirects = 5) {
  const { validateStatus, ...rest } = opts;
  let cur = url;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(cur);
    const res = await axios.get(cur, { ...rest, maxRedirects: 0, validateStatus: () => true });
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      cur = new URL(res.headers.location, cur).href;
      continue;
    }
    const ok = validateStatus ? validateStatus(res.status) : res.status < 400;
    if (!ok) throw new Error(`HTTP ${res.status}`);
    return res;
  }
  throw new Error('Too many redirects.');
}
