import { meganCatalog, meganEndpoint, pickResult, serializeResult, hasMeganKey } from '../lib/api/megan.js';
import { getFooter } from '../lib/buttonHandler.js';

const RESERVED = new Set(['help', 'menu', 'megan', 'mhelp', 'mcat', 'fetch']);
const safeName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 28);

function parseArgs(endpoint, args) {
  const params = {};
  const positional = [];
  for (const token of args) {
    const i = token.indexOf('=');
    if (i > 0) params[token.slice(0, i)] = token.slice(i + 1);
    else positional.push(token);
  }
  const definitions = endpoint.params || endpoint.parameters || [];
  const missing = definitions.filter(p => p.required && params[p.name] == null);
  for (const param of missing) {
    if (!positional.length) break;
    params[param.name] = positional.shift();
  }
  if (positional.length) {
    const first = definitions.find(p => !params[p.name]);
    if (first) params[first.name] = positional.join(' ');
    else params.query = positional.join(' ');
  }
  return params;
}

function prettyCategory(name) {
  return String(name || 'misc').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
}

async function runEndpoint(sock, m, endpoint, args, label = endpoint.path) {
  const params = parseArgs(endpoint, args);
  const definitions = endpoint.params || endpoint.parameters || [];
  const missing = definitions.filter(p => p.required && !params[p.name]).map(p => p.name);
  if (missing.length) {
    return m.reply(`❌ Missing: ${missing.join(', ')}\nUsage: .${label} ${definitions.map(p => `${p.name}${p.required ? '' : '?'}`).join(' ')}`);
  }
  await m.react('⏳');
  try {
    const payload = await meganEndpoint(endpoint.path, params, { method: endpoint.method, timeout: endpoint.timeout || 120_000 });
    const { data, mediaUrls, title } = pickResult(payload);
    const preferred = mediaUrls.find(u => /\.(?:jpg|jpeg|png|gif|webp)(?:[?#]|$)/i.test(u));
    if (preferred && /image|photo|avatar|sticker/i.test(`${endpoint.category} ${endpoint.description} ${endpoint.path}`)) {
      await sock.sendMessage(m.from, { image: { url: preferred }, caption: title || endpoint.description || label }, { quoted: m.raw });
    } else {
      const output = serializeResult(data);
      await m.reply(`*${endpoint.description || endpoint.path}*\n\n${output}\n\n${getFooter()}`);
    }
    await m.react('✅');
  } catch (err) {
    await m.react('❌');
    m._failed = true;
    return m.reply(`❌ Megan error: ${err.message}`);
  }
}

const generic = {
  name: 'megan',
  aliases: ['mapi', 'meganapi'],
  description: 'Call any Megan API endpoint: megan <path> key=value',
  usage: 'megan <endpoint path> [value or key=value]',
  category: 'megan',
  owner: true,
  group: false,
  private: false,
  timeout: 120_000,
  async execute(sock, m, args) {
    if (!hasMeganKey()) return m.reply('❌ Configure MEGAN_API_KEY first.');
    const rawPath = args.shift();
    if (!rawPath) return m.reply('Usage: .megan /api/ai/gpt q=hello\nUse .mcat to browse categories.');
    const catalog = await meganCatalog();
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const endpoint = catalog.find(e => e.path === path);
    if (!endpoint) return m.reply(`❌ Endpoint not found: ${path}\nUse .mcat or .mhelp <search>.`);
    return runEndpoint(sock, m, endpoint, args, rawPath.replace(/^\//, ''));
  },
};

const categories = {
  name: 'mcat', aliases: ['megancategories', 'meganmenu'],
  description: 'List Megan API categories and endpoint counts', usage: 'mcat [category]', category: 'megan',
  owner: false, group: false, private: false,
  async execute(sock, m, args) {
    const catalog = await meganCatalog();
    const grouped = new Map();
    for (const e of catalog) {
      const key = e.category || 'Other';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(e);
    }
    const filter = args.join(' ').toLowerCase();
    const rows = [...grouped.entries()]
      .filter(([key]) => !filter || key.toLowerCase().includes(filter))
      .sort(([a], [b]) => a.localeCompare(b));
    if (!rows.length) return m.reply('❌ Category not found. Try .mcat');
    const text = rows.map(([key, list]) => `• ${key}: ${list.length} endpoints`).join('\n');
    return m.reply(`*Megan API catalog: ${catalog.length} endpoints*\n\n${text}\n\nUse .mhelp <word> to search endpoints.`);
  },
};

const search = {
  name: 'mhelp', aliases: ['meganhelp', 'msearch'],
  description: 'Search Megan endpoints and show usage', usage: 'mhelp <search term>', category: 'megan',
  owner: false, group: false, private: false,
  async execute(sock, m, args) {
    const query = args.join(' ').toLowerCase().trim();
    const catalog = await meganCatalog();
    if (!query) return m.reply(`Megan exposes ${catalog.length} endpoints.\nUse .mhelp <word> or .mcat.`);
    const matches = catalog.filter(e => `${e.path} ${e.description} ${e.category} ${e.subcategory}`.toLowerCase().includes(query)).slice(0, 30);
    if (!matches.length) return m.reply('❌ No Megan endpoints matched that search.');
    return m.reply(matches.map(e => {
      const params = (e.params || e.parameters || []).map(p => `${p.name}${p.required ? '*' : ''}`).join(', ');
      return `• .${safeName(`m${e.path}`)} → ${e.path} [${e.method || 'GET'}]${params ? ` (${params})` : ''}`;
    }).join('\n'));
  },
};

export default [generic, categories, search];

export async function registerCommands(commands) {
  if (!hasMeganKey()) {
    console.warn('[megan] MEGAN_API_KEY is not configured; dynamic commands disabled');
    return;
  }
  try {
    const catalog = await meganCatalog();
    let registered = 0;
    for (const endpoint of catalog) {
      const base = safeName(`m${endpoint.path}`);
      if (!base || RESERVED.has(base) || commands.has(base)) continue;
      const command = {
        name: base,
        aliases: [],
        description: endpoint.description || `Megan ${endpoint.path}`,
        usage: `${base} ${(endpoint.params || endpoint.parameters || []).map(p => p.required ? p.name : `[${p.name}]`).join(' ')}`.trim(),
        category: `megan_${prettyCategory(endpoint.category)}`,
        owner: true,
        group: false,
        private: false,
        timeout: 120_000,
        async execute(sock, m, args) { return runEndpoint(sock, m, endpoint, args, base); },
      };
      commands.set(base, command);
      const short = safeName(endpoint.path.split('/').filter(Boolean).pop());
      if (short && !RESERVED.has(short) && !commands.has(short)) {
        command.aliases.push(short);
        commands.set(short, command);
      }
      registered++;
    }
    console.log(`[megan] registered ${registered} catalog commands from ${catalog.length} endpoints`);
  } catch (err) {
    console.warn(`[megan] dynamic catalog unavailable: ${err.message}`);
  }
}
