import axios from 'axios';
import { rawText, textInput } from '../../lib/utils/cmdUtils.js';

const base = { category: 'tools', owner: false, group: false, private: false };
const http = (url, opts = {}) => axios.get(url, { timeout: 15_000, ...opts });

export default [
  {
    ...base,
    name: 'weather',
    aliases: ['wx', 'forecast'],
    description: 'Current weather and 3-day outlook for a city',
    usage: 'weather Nairobi',
    async execute(sock, m) {
      const city = rawText(m);
      if (!city) return m.reply('❌ Give a city.\n\nExample: weather Nairobi');

      let d;
      try {
        d = (await http(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)).data;
      } catch {
        throw new Error('Could not fetch the weather. Check the city name and try again.');
      }

      const cur  = d.current_condition?.[0];
      const area = d.nearest_area?.[0];
      if (!cur) throw new Error('No weather data found for that place.');

      const place = [area?.areaName?.[0]?.value, area?.country?.[0]?.value].filter(Boolean).join(', ') || city;
      const days = (d.weather || []).slice(0, 3)
        .map(w => `• ${w.date}: ${w.mintempC}°–${w.maxtempC}°C`).join('\n');

      return m.reply(
        `🌤️ *Weather — ${place}*\n\n` +
        `${cur.weatherDesc?.[0]?.value || ''}\n` +
        `🌡️ ${cur.temp_C}°C (feels like ${cur.FeelsLikeC}°C)\n` +
        `💧 Humidity: ${cur.humidity}%\n` +
        `💨 Wind: ${cur.windspeedKmph} km/h ${cur.winddir16Point}\n` +
        `🌧️ Rain: ${cur.precipMM} mm\n\n` +
        `*Next days*\n${days}`
      );
    },
  },
  {
    ...base,
    name: 'translate',
    aliases: ['tr', 'trt'],
    description: 'Translate text into another language',
    usage: 'translate <lang code> <text>  |  reply to a message with: translate fr',
    async execute(sock, m, args) {
      const lang = (args[0] || '').toLowerCase();
      if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(lang)) {
        return m.reply('❌ Start with a language code.\n\nExample: translate sw Good morning\nOr reply to a message: translate fr');
      }
      const text = rawText(m).replace(/^\S+\s*/, '') || m.quoted?.text || '';
      if (!text) return m.reply('❌ Provide text, or reply to a message.');

      let data;
      try {
        data = (await http('https://translate.googleapis.com/translate_a/single', {
          params: { client: 'gtx', sl: 'auto', tl: lang, dt: 't', q: text.slice(0, 2000) },
        })).data;
      } catch {
        throw new Error('Translation failed. Check the language code and try again.');
      }

      const out = (data?.[0] || []).map(p => p[0]).join('');
      if (!out) throw new Error('No translation returned.');
      return m.reply(`🌍 *${data?.[2] || 'auto'} → ${lang}*\n\n${out}`);
    },
  },
  {
    ...base,
    name: 'define',
    aliases: ['dictionary', 'dict'],
    description: 'Look up the definition of an English word',
    usage: 'define serendipity',
    async execute(sock, m, args) {
      const word = (args[0] || '').toLowerCase();
      if (!word) return m.reply('❌ Give a word.\n\nExample: define serendipity');

      let entry;
      try {
        entry = (await http(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)).data?.[0];
      } catch (err) {
        if (err.response?.status === 404) return m.reply(`❌ No definition found for "${word}".`);
        throw new Error('Dictionary lookup failed. Try again later.');
      }

      const lines = (entry?.meanings || []).slice(0, 3).map(mn => {
        const d = mn.definitions?.[0];
        return `*${mn.partOfSpeech}*\n${d?.definition || ''}${d?.example ? `\n_e.g. ${d.example}_` : ''}`;
      });

      return m.reply(`📖 *${entry?.word || word}* ${entry?.phonetic || ''}\n\n${lines.join('\n\n')}`.trim());
    },
  },
  {
    ...base,
    name: 'currency',
    aliases: ['cur', 'exchange'],
    description: 'Convert between currencies using live rates',
    usage: 'currency 100 usd kes',
    async execute(sock, m, args) {
      const amount = parseFloat(args[0]);
      const from = (args[1] || '').toUpperCase();
      const to   = (args[2] || '').toUpperCase();
      if (Number.isNaN(amount) || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
        return m.reply('❌ Usage: currency <amount> <from> <to>\n\nExample: currency 100 usd kes');
      }

      let data;
      try {
        data = (await http(`https://open.er-api.com/v6/latest/${from}`)).data;
      } catch {
        throw new Error('Could not fetch exchange rates.');
      }

      const rate = data?.rates?.[to];
      if (data?.result !== 'success' || !rate) return m.reply(`❌ Unknown currency code (${from} or ${to}).`);

      const out = (amount * rate).toLocaleString('en-US', { maximumFractionDigits: 2 });
      return m.reply(`💱 ${amount.toLocaleString('en-US')} ${from} = *${out} ${to}*\n_1 ${from} = ${rate} ${to}_`);
    },
  },
  {
    ...base,
    name: 'short',
    aliases: ['shorten', 'tinyurl'],
    description: 'Shorten a URL',
    usage: 'short https://example.com/very/long/link',
    async execute(sock, m) {
      const url = textInput(m).match(/https?:\/\/\S+/i)?.[0];
      if (!url) return m.reply('❌ Provide a link starting with http:// or https://');

      let out;
      try {
        out = (await http('https://tinyurl.com/api-create.php', { params: { url } })).data;
      } catch {
        throw new Error('Could not shorten that link.');
      }
      return m.reply(`🔗 ${String(out).trim()}`);
    },
  },
];
