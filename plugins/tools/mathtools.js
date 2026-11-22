const base = { category: 'tools', owner: false, group: false, private: false, aliases: [] };

const num = (s) => {
  const n = Number(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && String(s ?? '').trim() !== '' ? n : NaN;
};
const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const nums = (args) => args.join(' ').split(/[\s,;]+/).filter(Boolean).map(num);

// ── Roman numerals ──────────────────────────────────────────────
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const toRoman = (n) => { let out = ''; for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; } return out; };
const fromRoman = (s) => {
  const vals = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = vals[s[i]], next = vals[s[i + 1]] || 0;
    total += v < next ? -v : v;
  }
  return total;
};

// ── number → words ──────────────────────────────────────────────
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function below1000(n) {
  const parts = [];
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} hundred`); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')); }
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(' ');
}
function toWords(n) {
  if (n === 0) return 'zero';
  const neg = n < 0; n = Math.abs(n);
  const groups = [];
  let i = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) groups.unshift(`${below1000(chunk)}${SCALES[i] ? ' ' + SCALES[i] : ''}`);
    n = Math.floor(n / 1000); i++;
  }
  return (neg ? 'minus ' : '') + groups.join(' ');
}

// ── primes / factors ────────────────────────────────────────────
function factorize(n) {
  const f = [];
  for (let p = 2; p * p <= n; p += p === 2 ? 1 : 2) {
    while (n % p === 0) { f.push(p); n /= p; }
  }
  if (n > 1) f.push(n);
  return f;
}

const gcd2 = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

export default [
  {
    ...base,
    name: 'percent',
    aliases: ['pct', 'percentage'],
    description: 'Percentage calculator',
    usage: 'percent 20 of 150  |  percent 30 / 150  |  percent 80 to 100',
    async execute(sock, m, args) {
      const t = args.join(' ').toLowerCase().replace(/,/g, '');
      let r;
      if ((r = t.match(/^(-?[\d.]+)\s*%?\s*of\s*(-?[\d.]+)$/))) {
        const v = (Number(r[1]) / 100) * Number(r[2]);
        return m.reply(`📊 ${fmt(Number(r[1]))}% of ${fmt(Number(r[2]))} = *${fmt(v, 4)}*`);
      }
      if ((r = t.match(/^(-?[\d.]+)\s*(?:\/|is|out of)\s*(-?[\d.]+)$/))) {
        if (Number(r[2]) === 0) return m.reply('❌ Cannot divide by zero.');
        return m.reply(`📊 ${fmt(Number(r[1]))} is *${fmt((Number(r[1]) / Number(r[2])) * 100, 4)}%* of ${fmt(Number(r[2]))}`);
      }
      if ((r = t.match(/^(-?[\d.]+)\s*(?:to|->|→)\s*(-?[\d.]+)$/))) {
        const a = Number(r[1]), b = Number(r[2]);
        if (a === 0) return m.reply('❌ The starting number cannot be zero.');
        const ch = ((b - a) / Math.abs(a)) * 100;
        return m.reply(`📊 ${fmt(a)} → ${fmt(b)} is a *${ch >= 0 ? '+' : ''}${fmt(ch, 4)}%* ${ch >= 0 ? 'increase' : 'decrease'}`);
      }
      return m.reply('❌ Try one of these:\n\n• percent 20 of 150\n• percent 30 / 150\n• percent 80 to 100');
    },
  },
  {
    ...base,
    name: 'discount',
    aliases: ['sale', 'offprice'],
    description: 'Work out a price after a discount',
    usage: 'discount <price> <percent>   e.g. discount 2500 20',
    async execute(sock, m, args) {
      const price = num(args[0]), pct = num((args[1] || '').replace('%', ''));
      if (Number.isNaN(price) || Number.isNaN(pct)) return m.reply('❌ Example: discount 2500 20');
      const saved = price * pct / 100;
      return m.reply(`🏷️ *Discount*\n\nPrice: ${fmt(price)}\nDiscount: ${fmt(pct)}%\nYou save: ${fmt(saved)}\n*You pay: ${fmt(price - saved)}*`);
    },
  },
  {
    ...base,
    name: 'tip',
    aliases: ['splitbill', 'bill'],
    description: 'Tip and bill splitter',
    usage: 'tip <bill> [tip %] [people]   e.g. tip 4500 10 3',
    async execute(sock, m, args) {
      const bill = num(args[0]);
      const pct = args[1] !== undefined ? num((args[1] || '').replace('%', '')) : 10;
      const people = args[2] !== undefined ? Math.floor(num(args[2])) : 1;
      if (Number.isNaN(bill) || Number.isNaN(pct) || Number.isNaN(people) || people < 1) {
        return m.reply('❌ Example: tip 4500 10 3\n(bill, tip %, number of people)');
      }
      const tipAmt = bill * pct / 100, total = bill + tipAmt;
      let text = `🧾 *Bill*\n\nBill: ${fmt(bill)}\nTip (${fmt(pct)}%): ${fmt(tipAmt)}\n*Total: ${fmt(total)}*`;
      if (people > 1) text += `\n\n👥 Each of ${people} pays: *${fmt(total / people)}*`;
      return m.reply(text);
    },
  },
  {
    ...base,
    name: 'bmi',
    aliases: ['bodymass'],
    description: 'Body mass index calculator (kg and cm)',
    usage: 'bmi <weight kg> <height cm>   e.g. bmi 70 175',
    async execute(sock, m, args) {
      const kg = num(args[0]), cm = num(args[1]);
      if (Number.isNaN(kg) || Number.isNaN(cm) || kg <= 0 || cm <= 0) return m.reply('❌ Example: bmi 70 175\n(weight in kg, height in cm)');
      if (kg > 500 || cm < 50 || cm > 272) return m.reply('❌ Those numbers do not look right. Use kg and cm.');
      const bmi = kg / ((cm / 100) ** 2);
      const cat = bmi < 18.5 ? 'Underweight range' : bmi < 25 ? 'Healthy range' : bmi < 30 ? 'Overweight range' : 'Obesity range';
      return m.reply(`⚖️ *BMI:* ${bmi.toFixed(1)}\n📋 ${cat}\n\n_BMI is only a rough guide. A doctor can tell you what is right for you._`);
    },
  },
  {
    ...base,
    name: 'roman',
    aliases: ['romannumeral'],
    description: 'Convert between numbers and Roman numerals (1-3999)',
    usage: 'roman 2026  |  roman MMXXVI',
    async execute(sock, m, args) {
      const a = (args[0] || '').trim();
      if (!a) return m.reply('❌ Example: roman 2026  or  roman MMXXVI');
      if (/^\d+$/.test(a)) {
        const n = Number(a);
        if (n < 1 || n > 3999) return m.reply('❌ Use a number from 1 to 3999.');
        return m.reply(`🏛️ ${n} = *${toRoman(n)}*`);
      }
      const up = a.toUpperCase();
      if (!/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(up) || !up) return m.reply('❌ That is not a valid Roman numeral.');
      return m.reply(`🏛️ ${up} = *${fromRoman(up)}*`);
    },
  },
  {
    ...base,
    name: 'numwords',
    aliases: ['spell', 'numtoword'],
    description: 'Write a number in words',
    usage: 'numwords 1250',
    async execute(sock, m, args) {
      const n = num(args[0]);
      if (Number.isNaN(n) || !Number.isInteger(n)) return m.reply('❌ Give a whole number.\n\nExample: numwords 1250');
      if (Math.abs(n) > 999999999999999) return m.reply('❌ That number is too big.');
      return m.reply(`🔢 ${fmt(n, 0)}\n*${toWords(n)}*`);
    },
  },
  {
    ...base,
    name: 'prime',
    aliases: ['isprime', 'factors', 'factor'],
    description: 'Check if a number is prime and show its prime factors',
    usage: 'prime 91',
    async execute(sock, m, args) {
      const n = num(args[0]);
      if (Number.isNaN(n) || !Number.isInteger(n) || n < 2) return m.reply('❌ Give a whole number of 2 or more.\n\nExample: prime 91');
      if (n > 1e12) return m.reply('❌ Use a number up to 1,000,000,000,000.');
      const f = factorize(n);
      if (f.length === 1) return m.reply(`✅ *${fmt(n, 0)}* is a prime number.`);
      const counts = {};
      f.forEach((p) => { counts[p] = (counts[p] || 0) + 1; });
      const pretty = Object.entries(counts).map(([p, c]) => (c > 1 ? `${p}^${c}` : p)).join(' × ');
      return m.reply(`❌ *${fmt(n, 0)}* is not prime.\n\nPrime factors: ${pretty}`);
    },
  },
  {
    ...base,
    name: 'factorial',
    aliases: ['fac'],
    description: 'Factorial of a number (up to 500)',
    usage: 'factorial 10',
    async execute(sock, m, args) {
      const n = num(args[0]);
      if (Number.isNaN(n) || !Number.isInteger(n) || n < 0 || n > 500) return m.reply('❌ Give a whole number from 0 to 500.\n\nExample: factorial 10');
      let r = 1n;
      for (let i = 2n; i <= BigInt(n); i++) r *= i;
      const s = r.toString();
      return m.reply(`❗ *${n}!* = ${s}${s.length > 30 ? `\n\n(${s.length} digits)` : ''}`);
    },
  },
  {
    ...base,
    name: 'fib',
    aliases: ['fibonacci'],
    description: 'The nth Fibonacci number (up to 1000)',
    usage: 'fib 20',
    async execute(sock, m, args) {
      const n = num(args[0]);
      if (Number.isNaN(n) || !Number.isInteger(n) || n < 0 || n > 1000) return m.reply('❌ Give a whole number from 0 to 1000.\n\nExample: fib 20');
      let a = 0n, b = 1n;
      const seq = [];
      for (let i = 0; i <= n; i++) { if (i <= 12) seq.push(a); [a, b] = [b, a + b]; }
      let text = `🌀 *F(${n})* = ${a}`;
      if (n >= 12) text += `\n\nStarts: ${seq.join(', ')}…`;
      return m.reply(text);
    },
  },
  {
    ...base,
    name: 'gcd',
    aliases: ['hcf'],
    description: 'Greatest common divisor of two or more numbers',
    usage: 'gcd 12 18 24',
    async execute(sock, m, args) {
      const v = nums(args);
      if (v.length < 2 || v.some((x) => !Number.isSafeInteger(x))) return m.reply('❌ Give two or more whole numbers.\n\nExample: gcd 12 18');
      return m.reply(`➗ GCD of ${v.join(', ')} = *${v.reduce(gcd2)}*`);
    },
  },
  {
    ...base,
    name: 'lcm',
    aliases: [],
    description: 'Least common multiple of two or more numbers',
    usage: 'lcm 4 6 10',
    async execute(sock, m, args) {
      const v = nums(args);
      if (v.length < 2 || v.some((x) => !Number.isSafeInteger(x) || x === 0)) return m.reply('❌ Give two or more whole numbers (not zero).\n\nExample: lcm 4 6');
      const l = v.reduce((a, b) => Math.abs(a * b) / gcd2(a, b));
      if (!Number.isSafeInteger(l)) return m.reply('❌ That result is too large.');
      return m.reply(`✖️ LCM of ${v.join(', ')} = *${l}*`);
    },
  },
  {
    ...base,
    name: 'average',
    aliases: ['avg', 'mean', 'mathstats'],
    description: 'Average, median, mode and more for a list of numbers',
    usage: 'average 4 8 15 16 23 42',
    async execute(sock, m, args) {
      const v = nums(args);
      if (v.length < 2 || v.some(Number.isNaN)) return m.reply('❌ Give two or more numbers.\n\nExample: average 4 8 15 16 23 42');
      const sorted = [...v].sort((a, b) => a - b);
      const sum = v.reduce((a, b) => a + b, 0);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      const freq = {};
      v.forEach((x) => { freq[x] = (freq[x] || 0) + 1; });
      const top = Math.max(...Object.values(freq));
      const mode = top === 1 ? 'none' : Object.keys(freq).filter((k) => freq[k] === top).join(', ');
      return m.reply(
        `📈 *Stats* (${v.length} numbers)\n\n` +
        `Sum: ${fmt(sum, 4)}\nMean: ${fmt(sum / v.length, 4)}\nMedian: ${fmt(median, 4)}\nMode: ${mode}\n` +
        `Min: ${fmt(sorted[0], 4)}\nMax: ${fmt(sorted[sorted.length - 1], 4)}\nRange: ${fmt(sorted[sorted.length - 1] - sorted[0], 4)}`
      );
    },
  },
  {
    ...base,
    name: 'rand',
    aliases: ['rnd', 'randomnumber'],
    description: 'Random whole number between two values (default 1-100)',
    usage: 'rand [min] [max]   e.g. rand 1 10',
    async execute(sock, m, args) {
      let lo = args[0] !== undefined ? Math.floor(num(args[0])) : 1;
      let hi = args[1] !== undefined ? Math.floor(num(args[1])) : (args[0] !== undefined ? lo : 100);
      if (args[0] !== undefined && args[1] === undefined) { hi = lo; lo = 1; }
      if (Number.isNaN(lo) || Number.isNaN(hi)) return m.reply('❌ Example: rand 1 10');
      if (lo > hi) [lo, hi] = [hi, lo];
      return m.reply(`🎲 *${lo + Math.floor(Math.random() * (hi - lo + 1))}*  _(between ${lo} and ${hi})_`);
    },
  },
];
