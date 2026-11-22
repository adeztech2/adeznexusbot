import axios from 'axios';

const base = { category: 'devtools', owner: false, group: false, private: false };
const http = (url, opts = {}) => axios.get(url, { timeout: 15_000, ...opts });

const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');
const fmtDate = (s) => (s ? new Date(s).toISOString().slice(0, 10) : 'n/a');

export default [
  {
    ...base,
    name: 'npm',
    aliases: ['npmpkg'],
    description: 'Look up an npm package',
    usage: 'npm express',
    async execute(sock, m, args) {
      const pkg = (args[0] || '').trim();
      if (!/^(@[\w.-]+\/)?[\w.-]+$/.test(pkg)) return m.reply('❌ Give a package name.\n\nExample: npm express');

      let p;
      try {
        p = (await http(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`)).data;
      } catch (err) {
        if (err.response?.status === 404) return m.reply(`❌ Package "${pkg}" not found.`);
        throw new Error('Could not reach the npm registry.');
      }

      let weekly = null;
      try { weekly = (await http(`https://api.npmjs.org/downloads/point/last-week/${pkg}`)).data?.downloads; } catch {}

      return m.reply(
        `📦 *${p.name}* v${p.version}\n\n` +
        `${p.description || 'No description'}\n\n` +
        `License: ${typeof p.license === 'string' ? p.license : 'n/a'}\n` +
        `Dependencies: ${Object.keys(p.dependencies || {}).length}\n` +
        (weekly != null ? `Weekly downloads: ${fmtNum(weekly)}\n` : '') +
        `https://www.npmjs.com/package/${p.name}\n\n` +
        `Install: npm i ${p.name}`
      );
    },
  },
  {
    ...base,
    name: 'gh',
    aliases: ['ghlookup'],
    description: 'Look up a GitHub user or repository',
    usage: 'gh torvalds  |  gh expressjs/express',
    async execute(sock, m, args) {
      const target = (args[0] || '').replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
      if (!/^[\w.-]+(\/[\w.-]+)?$/.test(target)) {
        return m.reply('❌ Give a user or user/repo.\n\nExample: gh expressjs/express');
      }

      const isRepo = target.includes('/');
      let d;
      try {
        d = (await http(`https://api.github.com/${isRepo ? 'repos' : 'users'}/${target}`, {
          headers: { 'User-Agent': 'adez-nexus-bot', Accept: 'application/vnd.github+json' },
        })).data;
      } catch (err) {
        if (err.response?.status === 404) return m.reply(`❌ "${target}" not found on GitHub.`);
        if (err.response?.status === 403) return m.reply('⚠️ GitHub rate limit reached. Try again later.');
        throw new Error('Could not reach GitHub.');
      }

      if (isRepo) {
        return m.reply(
          `🐙 *${d.full_name}*\n\n${d.description || 'No description'}\n\n` +
          `⭐ ${fmtNum(d.stargazers_count)}   🍴 ${fmtNum(d.forks_count)}   🐞 ${fmtNum(d.open_issues_count)} open issues\n` +
          `Language: ${d.language || 'n/a'}\nLicense: ${d.license?.spdx_id || 'n/a'}\n` +
          `Last push: ${fmtDate(d.pushed_at)}\n${d.html_url}`
        );
      }
      return m.reply(
        `🐙 *${d.login}*${d.name ? ` (${d.name})` : ''}\n\n${d.bio || 'No bio'}\n\n` +
        `Repos: ${fmtNum(d.public_repos)}   Followers: ${fmtNum(d.followers)}   Following: ${fmtNum(d.following)}\n` +
        `Joined: ${fmtDate(d.created_at)}\n${d.html_url}`
      );
    },
  },
  {
    ...base,
    name: 'ip',
    aliases: ['iplookup', 'geoip'],
    description: 'Look up an IP address or domain',
    usage: 'ip 8.8.8.8  |  ip example.com',
    async execute(sock, m, args) {
      const q = (args[0] || '').trim();
      if (!/^[\w.:-]+$/.test(q)) return m.reply('❌ Give an IP address or domain.\n\nExample: ip 8.8.8.8');

      let d;
      try {
        d = (await http(`https://ipwho.is/${encodeURIComponent(q)}`)).data;
      } catch {
        throw new Error('IP lookup service is unavailable.');
      }
      if (!d?.success) return m.reply(`❌ ${d?.message || 'Lookup failed.'}`);

      return m.reply(
        `🌐 *${d.ip}* (${d.type})\n\n` +
        `Location: ${[d.city, d.region, d.country].filter(Boolean).join(', ')}\n` +
        `ISP: ${d.connection?.isp || 'n/a'}\nOrg: ${d.connection?.org || 'n/a'}\n` +
        `ASN: ${d.connection?.asn ? 'AS' + d.connection.asn : 'n/a'}\nTime zone: ${d.timezone?.id || 'n/a'}`
      );
    },
  },
];
