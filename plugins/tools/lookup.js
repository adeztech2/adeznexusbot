import { getJson, parseDuration, formatDuration, parseGithubRepo, fmtNum, digits } from '../../lib/utils/extra.js';
import { getMentionedJids } from '../../lib/connection/helper.js';

const COINS = {
  btc: 'bitcoin', eth: 'ethereum', usdt: 'tether', bnb: 'binancecoin', sol: 'solana', xrp: 'ripple',
  doge: 'dogecoin', ada: 'cardano', trx: 'tron', ton: 'the-open-network', ltc: 'litecoin',
  matic: 'matic-network', dot: 'polkadot', shib: 'shiba-inu', usdc: 'usd-coin', link: 'chainlink',
};

const reminders = new Map();                 // senderJid -> count of active reminders (in memory only)
const MAX_REMINDERS = 5;
const MAX_REMIND_MS = 24 * 60 * 60 * 1000;

export default [
  {
    name: 'country',
    aliases: ['countryinfo', 'nation'],
    description: 'Facts about a country',
    usage: 'country Kenya',
    category: 'tools',
    owner: false,
    group: false,
    private: false,

    async execute(sock, m, args) {
      const q = args.join(' ').trim();
      if (!q) return m.reply('❌ Give a country name.\n\nExample: .country Kenya');
      let list;
      try {
        list = await getJson(`https://restcountries.com/v3.1/name/${encodeURIComponent(q)}?fields=name,capital,population,region,subregion,languages,currencies,flag,area,timezones`);
      } catch (e) {
        if (e.status === 404) return m.reply(`❌ No country found for *${q}*.`);
        throw new Error('Country service is not responding. Try again later.');
      }
      const c = list.find(x => x.name?.common?.toLowerCase() === q.toLowerCase()) || list[0];
      const currencies = Object.values(c.currencies || {}).map(x => `${x.name} (${x.symbol || ''})`.replace(' ()', '')).join(', ');
      const languages = Object.values(c.languages || {}).join(', ');
      return m.reply(
        `${c.flag || '🌍'} *${c.name.common}*\n` +
        `_${c.name.official}_\n\n` +
        `🏛️ *Capital:* ${(c.capital || ['N/A']).join(', ')}\n` +
        `🌐 *Region:* ${c.region}${c.subregion ? ` / ${c.subregion}` : ''}\n` +
        `👥 *Population:* ${fmtNum(c.population)}\n` +
        `📐 *Area:* ${fmtNum(c.area)} km²\n` +
        `🗣️ *Languages:* ${languages || 'N/A'}\n` +
        `💰 *Currency:* ${currencies || 'N/A'}\n` +
        `🕐 *Timezones:* ${(c.timezones || []).slice(0, 3).join(', ')}`
      );
    },
  },

  {
    name: 'crypto',
    aliases: ['cryptoprice', 'coinprice'],
    description: 'Live crypto price in USD',
    usage: 'crypto btc  |  crypto ethereum',
    category: 'tools',
    owner: false,
    group: false,
    private: false,

    async execute(sock, m, args) {
      const raw = (args[0] || '').toLowerCase();
      if (!raw) return m.reply(`❌ Give a coin.\n\nExample: .crypto btc\nShortcuts: ${Object.keys(COINS).join(', ')}\nOr a CoinGecko id like *bitcoin*.`);
      const id = COINS[raw] || raw;
      let data;
      try {
        data = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`);
      } catch (e) {
        if (e.status === 429) return m.reply('⏳ Price service is busy. Try again in a minute.');
        throw new Error('Price service is not responding. Try again later.');
      }
      const d = data[id];
      if (!d) return m.reply(`❌ Unknown coin *${raw}*. Try a symbol like btc or a CoinGecko id.`);
      const ch = d.usd_24h_change;
      const arrow = ch >= 0 ? '📈' : '📉';
      return m.reply(
        `🪙 *${id}*\n\n` +
        `💵 *Price:* $${d.usd.toLocaleString('en-US', { maximumFractionDigits: 6 })}\n` +
        `${arrow} *24h:* ${ch >= 0 ? '+' : ''}${ch?.toFixed(2)}%\n` +
        `🏦 *Market cap:* $${fmtNum(Math.round(d.usd_market_cap))}`
      );
    },
  },

  {
    name: 'wiki',
    aliases: ['wikipedia', 'whatis'],
    description: 'Short Wikipedia summary',
    usage: 'wiki Nairobi',
    category: 'tools',
    owner: false,
    group: false,
    private: false,

    async execute(sock, m, args) {
      const q = args.join(' ').trim();
      if (!q) return m.reply('❌ What should I look up?\n\nExample: .wiki Nairobi');
      let title;
      try {
        const found = await getJson(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=1&namespace=0&format=json`);
        title = found?.[1]?.[0];
      } catch { throw new Error('Wikipedia is not responding. Try again later.'); }
      if (!title) return m.reply(`❌ Nothing found for *${q}*.`);

      const s = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      const extract = (s.extract || 'No summary available.').slice(0, 900);
      return m.reply(
        `📚 *${s.title}*\n` +
        (s.description ? `_${s.description}_\n` : '') +
        `\n${extract}${(s.extract || '').length > 900 ? '…' : ''}\n\n` +
        `🔗 ${s.content_urls?.desktop?.page || ''}`
      );
    },
  },

  {
    name: 'bio',
    aliases: ['about', 'getbio'],
    description: 'See someone\'s WhatsApp bio',
    usage: 'bio @user | reply | 254711111111',
    category: 'tools',
    owner: false,
    group: false,
    private: false,

    async execute(sock, m, args) {
      const found = await getMentionedJids(m, sock, args);
      const jid = found[0] || (m.isGroup ? m.sender : m.from);
      if (!jid) return m.reply('❌ Mention someone, reply to them, or give a number.');
      let res;
      try { res = await sock.fetchStatus(jid); }
      catch { return m.reply('❌ I could not read that bio (hidden by privacy settings, or no such account).'); }
      const item = Array.isArray(res) ? res[0] : res;
      const text = item?.status?.status ?? (typeof item?.status === 'string' ? item.status : '');
      if (!text) return m.reply('ℹ️ No bio visible for that account.');
      const when = item?.status?.setAt ? `\n🕐 Set: ${new Date(item.status.setAt).toDateString()}` : '';
      return sock.sendMessage(m.from, { text: `📝 *Bio of @${jid.split('@')[0]}*\n\n${text}${when}`, mentions: [jid] }, { quoted: m });
    },
  },

  {
    name: 'gitclone',
    aliases: ['repozip', 'downloadrepo'],
    description: 'Download a public GitHub repo as a zip',
    usage: 'gitclone https://github.com/user/repo',
    category: 'devtools',
    owner: false,
    group: false,
    private: false,
    timeout: 120_000,

    async execute(sock, m, args) {
      const repo = parseGithubRepo(args[0]);
      if (!repo) return m.reply('❌ Send a GitHub repo link.\n\nExample: .gitclone https://github.com/adeztech2/baileys');
      // Deliberately unauthenticated: the bot's own GITHUB_TOKEN must never be able to fetch private repos for chat users
      const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/zipball`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(90_000),
        headers: { 'User-Agent': 'ADEZ-NEXUS-Bot/1.0', Accept: 'application/vnd.github+json' },
      });
      if (res.status === 404) return m.reply('❌ Repo not found (or it is private).');
      if (res.status === 403 || res.status === 429) return m.reply('⏳ GitHub is rate-limiting me. Try again in a few minutes.');
      if (!res.ok) throw new Error(`GitHub error ${res.status}`);

      const size = Number(res.headers.get('content-length') || 0);
      if (size > 30 * 1024 * 1024) return m.reply('❌ That repo is bigger than 30 MB, too large to send here.');
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 30 * 1024 * 1024) return m.reply('❌ That repo is bigger than 30 MB, too large to send here.');

      return sock.sendMessage(m.from, {
        document: buf,
        mimetype: 'application/zip',
        fileName: `${repo.repo}.zip`,
        caption: `📦 *${repo.owner}/${repo.repo}*\n${(buf.length / 1048576).toFixed(1)} MB`,
      }, { quoted: m });
    },
  },

  {
    name: 'remind',
    aliases: ['reminder', 'remindme'],
    description: 'Remind you later (max 24h, lost if the bot restarts)',
    usage: 'remind 10m take the food out',
    category: 'tools',
    owner: false,
    group: false,
    private: false,

    async execute(sock, m, args) {
      const ms = parseDuration(args[0]);
      const note = args.slice(1).join(' ').trim() || 'Time is up!';
      if (!ms) return m.reply('❌ Use a time like 30s, 10m, 2h or 1h30m.\n\nExample: .remind 10m take the food out');
      if (ms < 5_000) return m.reply('❌ Minimum is 5 seconds.');
      if (ms > MAX_REMIND_MS) return m.reply('❌ Maximum is 24 hours.');

      const who = m.sender || m.from;
      const active = reminders.get(who) || 0;
      if (active >= MAX_REMINDERS) return m.reply(`❌ You already have ${MAX_REMINDERS} active reminders.`);
      reminders.set(who, active + 1);

      setTimeout(async () => {
        reminders.set(who, Math.max(0, (reminders.get(who) || 1) - 1));
        try {
          await sock.sendMessage(m.from, { text: `⏰ *Reminder* @${who.split('@')[0]}\n\n${note}`, mentions: [who] });
        } catch (e) { console.error('reminder send failed:', e.message); }
      }, ms).unref?.();

      return m.reply(`✅ I will remind you in *${formatDuration(ms)}*.\n_(reminders are lost if the bot restarts)_`);
    },
  },
];
