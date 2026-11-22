const base = { category: 'tools', owner: false, group: false, private: false, aliases: [] };

const DAY_MS = 86400000;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const fmtDate = (d) =>
  `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()][0].toUpperCase()}${MONTHS[d.getUTCMonth()].slice(1)} ${d.getUTCFullYear()}`;

const today = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); };

// Accepts YYYY-MM-DD, YYYY/MM/DD and day-first DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
function parseDate(str) {
  const s = String(str || '').trim();
  let y, mo, d, r;
  if ((r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) { y = +r[1]; mo = +r[2]; d = +r[3]; }
  else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) { d = +r[1]; mo = +r[2]; y = +r[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

// years / months / days between two dates (from <= to)
function ymd(from, to) {
  let y = to.getUTCFullYear() - from.getUTCFullYear();
  let mo = to.getUTCMonth() - from.getUTCMonth();
  let d = to.getUTCDate() - from.getUTCDate();
  if (d < 0) { mo--; d += new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0)).getUTCDate(); }
  if (mo < 0) { y--; mo += 12; }
  return { y, mo, d };
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const DATE_HELP = 'Use YYYY-MM-DD (2000-05-17) or day first DD/MM/YYYY (17/05/2000).';

const SIGNS = [
  [[3, 21], [4, 19], '♈ Aries'], [[4, 20], [5, 20], '♉ Taurus'], [[5, 21], [6, 20], '♊ Gemini'],
  [[6, 21], [7, 22], '♋ Cancer'], [[7, 23], [8, 22], '♌ Leo'], [[8, 23], [9, 22], '♍ Virgo'],
  [[9, 23], [10, 22], '♎ Libra'], [[10, 23], [11, 21], '♏ Scorpio'], [[11, 22], [12, 21], '♐ Sagittarius'],
  [[12, 22], [1, 19], '♑ Capricorn'], [[1, 20], [2, 18], '♒ Aquarius'], [[2, 19], [3, 20], '♓ Pisces'],
];
function signOf(month, day) {
  const v = month * 100 + day;
  for (const [[sm, sd], [em, ed], name] of SIGNS) {
    const a = sm * 100 + sd, b = em * 100 + ed;
    if (a <= b ? (v >= a && v <= b) : (v >= a || v <= b)) return name;
  }
  return null;
}

export default [
  {
    ...base,
    name: 'age',
    aliases: ['birthday', 'bday'],
    description: 'Work out an age from a date of birth',
    usage: 'age 2000-05-17  |  age 17/05/2000',
    async execute(sock, m, args) {
      const dob = parseDate(args[0]);
      if (!dob) return m.reply(`❌ Give a valid date of birth.\n\n${DATE_HELP}`);
      const now = today();
      if (dob > now) return m.reply('❌ That date is in the future.');
      const { y, mo, d } = ymd(dob, now);
      const totalDays = Math.round((now - dob) / DAY_MS);

      let next = new Date(Date.UTC(now.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate()));
      if (next < now) next = new Date(Date.UTC(now.getUTCFullYear() + 1, dob.getUTCMonth(), dob.getUTCDate()));
      const toNext = Math.round((next - now) / DAY_MS);

      return m.reply(
        `🎂 *Age*\n\n` +
        `Born: ${fmtDate(dob)}\n` +
        `Age: *${plural(y, 'year')}, ${plural(mo, 'month')}, ${plural(d, 'day')}*\n` +
        `Days lived: ${totalDays.toLocaleString('en-US')}\n` +
        (toNext === 0 ? `\n🎉 Happy birthday!` : `\nNext birthday in *${plural(toNext, 'day')}*`)
      );
    },
  },
  {
    ...base,
    name: 'daysuntil',
    aliases: ['countdown', 'until'],
    description: 'Count the days until (or since) a date',
    usage: 'daysuntil 2026-12-25',
    async execute(sock, m, args) {
      const target = parseDate(args[0]);
      if (!target) return m.reply(`❌ Give a valid date.\n\n${DATE_HELP}`);
      const diff = Math.round((target - today()) / DAY_MS);
      const label = fmtDate(target);
      if (diff === 0) return m.reply(`📅 ${label} is *today*!`);
      return m.reply(diff > 0
        ? `⏳ *${plural(diff, 'day')}* until ${label}\n(about ${(diff / 7).toFixed(1)} weeks)`
        : `⌛ ${label} was *${plural(-diff, 'day')}* ago`);
    },
  },
  {
    ...base,
    name: 'datediff',
    aliases: ['diffdate', 'daysbetween'],
    description: 'Time between two dates',
    usage: 'datediff 2024-01-01 2026-12-25',
    async execute(sock, m, args) {
      let a = parseDate(args[0]), b = parseDate(args[1]);
      if (!a || !b) return m.reply(`❌ Give two valid dates.\n\n${DATE_HELP}\nExample: datediff 2024-01-01 2026-12-25`);
      if (a > b) [a, b] = [b, a];
      const { y, mo, d } = ymd(a, b);
      const days = Math.round((b - a) / DAY_MS);
      return m.reply(
        `📆 *Date difference*\n\n${fmtDate(a)}\n${fmtDate(b)}\n\n` +
        `*${plural(y, 'year')}, ${plural(mo, 'month')}, ${plural(d, 'day')}*\n` +
        `Total: ${days.toLocaleString('en-US')} days (${(days / 7).toFixed(1)} weeks)`
      );
    },
  },
  {
    ...base,
    name: 'weekday',
    aliases: ['dayof', 'whatday'],
    description: 'Find out which day of the week a date falls on',
    usage: 'weekday 2026-12-25',
    async execute(sock, m, args) {
      const dt = parseDate(args[0]);
      if (!dt) return m.reply(`❌ Give a valid date.\n\n${DATE_HELP}`);
      return m.reply(`📅 ${fmtDate(dt)}`);
    },
  },
  {
    ...base,
    name: 'zodiac',
    aliases: ['starsign', 'sign'],
    description: 'Find a zodiac sign from a birth date',
    usage: 'zodiac 2000-05-17  |  zodiac 17 may',
    async execute(sock, m, args) {
      let month, day;
      const full = parseDate(args[0]);
      if (full) { month = full.getUTCMonth() + 1; day = full.getUTCDate(); }
      else if (args.length >= 2) {
        day = parseInt(args[0], 10);
        const mArg = args[1].toLowerCase();
        month = /^\d+$/.test(mArg) ? parseInt(mArg, 10) : MONTHS.findIndex((x) => x.startsWith(mArg.slice(0, 3))) + 1;
      }
      const ok = month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(2024, month, 0)).getUTCDate();
      if (!ok) return m.reply(`❌ Give a birth date.\n\nExamples:\n• zodiac 2000-05-17\n• zodiac 17 may`);
      return m.reply(`🔮 ${day} ${MONTHS[month - 1][0].toUpperCase()}${MONTHS[month - 1].slice(1)} is *${signOf(month, day)}*`);
    },
  },
  {
    ...base,
    name: 'moon',
    aliases: ['moonphase'],
    description: 'Moon phase for today or a date (approximate)',
    usage: 'moon  |  moon 2026-12-25',
    async execute(sock, m, args) {
      let dt = today();
      if (args[0]) { dt = parseDate(args[0]); if (!dt) return m.reply(`❌ Give a valid date.\n\n${DATE_HELP}`); }
      const SYN = 29.530588853;
      const REF = Date.UTC(2000, 0, 6, 18, 14);            // a known new moon
      const noon = dt.getTime() + 12 * 3600000;
      const age = (((noon - REF) / DAY_MS) % SYN + SYN) % SYN;
      const light = Math.round(((1 - Math.cos((2 * Math.PI * age) / SYN)) / 2) * 100);
      const phases = [
        [1.85, '🌑 New Moon'], [5.54, '🌒 Waxing Crescent'], [9.22, '🌓 First Quarter'], [12.91, '🌔 Waxing Gibbous'],
        [16.61, '🌕 Full Moon'], [20.3, '🌖 Waning Gibbous'], [23.99, '🌗 Last Quarter'], [27.68, '🌘 Waning Crescent'],
      ];
      const phase = (phases.find(([lim]) => age < lim) || [0, '🌑 New Moon'])[1];
      return m.reply(`🌙 *Moon on ${fmtDate(dt)}*\n\n${phase}\nIlluminated: ~${light}%\nMoon age: ${age.toFixed(1)} days\n\n_Approximate._`);
    },
  },
];
