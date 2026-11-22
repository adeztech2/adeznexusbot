import axios from 'axios';
import { getFooter } from '../../lib/buttonHandler.js';

const API = 'https://api-v2.hearthis.at';
const UA  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TRACK_URL_RE = /hearthis\.at\/([^/\s?#]+)\/([^/\s?#]+)\/?/i;

const http = (url, params) => axios.get(url, { params, timeout: 30_000, headers: { 'User-Agent': UA, Accept: 'application/json' } });

function fmtDuration(sec) {
  const s = Number(sec);
  if (!s) return '?';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(r).padStart(2, '0')}s`;
}

const playable = (t) => t && (t.download_url || t.stream_url);

async function fromUrl(user, slug) {
  const res = await http(`${API}/${user}/${slug}/`);
  const t = res.data;
  return playable(t) ? t : null;
}

async function fromSearch(query) {
  const res = await http(`${API}/search`, { t: query, type: 'track', page: 1, count: 10 });
  const list = Array.isArray(res.data) ? res.data : (res.data?.tracks || res.data?.results || []);
  return list.find(playable) || null;
}

export default {
  name:        'mix',
  aliases:     ['hearthis', 'dj', 'djmix'],
  description: 'Download a mix from hearthis.at (search or link)',
  usage:       'mix <name | hearthis.at link>',
  category:    'downloader',
  owner:       false,
  group:       false,
  private:     false,
  timeout:     180_000,

  async execute(sock, m, args) {
    const query = args.join(' ').trim() || m.quoted?.text?.trim();
    if (!query) return m.reply('❌ Give a mix name or a hearthis.at link.\n\nExample: `.mix deep house mix`');

    await m.react('🔍');

    let track = null;
    try {
      const link = query.match(TRACK_URL_RE);
      track = link ? await fromUrl(link[1], link[2]) : await fromSearch(query);
    } catch (err) {
      await m.react('❌'); m._failed = true;
      return m.reply(`❌ hearthis.at error: ${err.response?.status ? 'HTTP ' + err.response.status : err.message}`);
    }

    if (!track) {
      await m.react('❌'); m._failed = true;
      return m.reply('❌ No downloadable mix found. Try different words or paste the track link.');
    }

    const url    = track.download_url || track.stream_url;
    const title  = track.title || 'Mix';
    const artist = track.user?.username || track.user?.name || 'Unknown';

    await m.react('⬇️');
    await m.reply(
      `🎧 *${title}*\n👤 ${artist}\n⏱️ ${fmtDuration(track.duration)}\n\n_Sending — long mixes can take a few minutes…_`
    );

    const fileName = `${title.replace(/[^\w\s.-]/g, '').trim() || 'mix'}.mp3`;
    try {
      // Always send as a playable audio message
      await sock.sendMessage(m.from, { audio: { url }, mimetype: 'audio/mpeg', fileName }, { quoted: m.raw });
    } catch (err) {
      // WhatsApp can reject very large audio — fall back to an MP3 file so the mix isn't lost
      console.error('[mix] audio send failed, sending as document:', err.message);
      try {
        await sock.sendMessage(m.from, {
          document: { url }, mimetype: 'audio/mpeg', fileName,
          caption: `🎧 *${title}*\n👤 ${artist}\n\n${getFooter()}`,
        }, { quoted: m.raw });
      } catch (err2) {
        await m.react('❌'); m._failed = true;
        return m.reply(`❌ Could not send the mix: ${err2.message}`);
      }
    }
  },
};
