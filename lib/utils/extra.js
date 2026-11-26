// Small helpers shared by the extra commands (no dependencies)

const UA = 'ADEZ-NEXUS-Bot/1.0 (+https://github.com/adeztech2/baileys)';

export async function getJson(url, ms = 15_000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// "90s" "10m" "2h" "1d" "1h30m"  ->  milliseconds (0 if invalid)
export function parseDuration(str = '') {
  const s = String(str).toLowerCase().trim();
  if (!s || !/^(\d+[smhd])+$/.test(s)) return 0;
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
  let total = 0;
  for (const [, n, u] of s.matchAll(/(\d+)([smhd])/g)) total += Number(n) * unit[u];
  return total;
}

export function formatDuration(ms) {
  const parts = [];
  let s = Math.round(ms / 1000);
  for (const [label, size] of [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]]) {
    const v = Math.floor(s / size);
    if (v) { parts.push(`${v}${label}`); s -= v * size; }
  }
  return parts.join(' ') || '0s';
}

// https://github.com/user/repo  |  github.com/user/repo.git  |  user/repo
export function parseGithubRepo(input = '') {
  const m = String(input).trim().match(/^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[\/#?].*)?$/i);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export function parseInviteCode(input = '') {
  const m = String(input).match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{10,32})/i);
  return m ? m[1] : null;
}

export const fmtNum = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : String(n ?? 'N/A'));

export const digits = (v = '') => String(v).replace(/\D/g, '');
