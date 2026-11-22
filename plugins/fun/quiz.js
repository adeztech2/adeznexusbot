import axios from 'axios';
import { pick } from '../../lib/utils/cmdUtils.js';
import { setGame, getGame, clearGame } from '../../lib/utils/gameState.js';

const base = { category: 'fun', owner: false, group: false, private: false };

const LETTERS = ['A', 'B', 'C', 'D'];
const dec = (s) => decodeURIComponent(s);
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const RIDDLES = [
  { q: "What has keys but can't open locks?", a: ['piano', 'keyboard'] },
  { q: 'What gets wetter the more it dries?', a: ['towel'] },
  { q: "What has hands but can't clap?", a: ['clock', 'watch'] },
  { q: 'What can you catch but not throw?', a: ['cold'] },
  { q: 'What has a head and a tail but no body?', a: ['coin'] },
  { q: 'The more you take, the more you leave behind. What am I?', a: ['footsteps', 'steps'] },
  { q: 'What goes up but never comes down?', a: ['age'] },
  { q: "What has many teeth but can't bite?", a: ['comb'] },
  { q: 'I speak without a mouth and hear without ears. What am I?', a: ['echo'] },
  { q: "What has one eye but can't see?", a: ['needle'] },
];

const WORDS = [
  'elephant', 'keyboard', 'javascript', 'giraffe', 'mountain', 'umbrella', 'telephone', 'chocolate', 'butterfly',
  'pyramid', 'satellite', 'volcano', 'notebook', 'rainbow', 'penguin', 'database', 'algorithm', 'kangaroo',
  'lighthouse', 'backpack', 'dolphin', 'universe', 'sandwich', 'hospital', 'football', 'calendar', 'bicycle', 'galaxy',
];

const hearts = (n) => '❤️'.repeat(n) + '🖤'.repeat(6 - n);
const board  = (g) => [...g.word].map(c => (g.guessed.includes(c) ? c.toUpperCase() : '_')).join(' ');

export default [
  {
    ...base,
    name: 'trivia',
    aliases: ['quiz'],
    description: 'Get a multiple-choice trivia question (reply with: answer a/b/c/d)',
    usage: 'trivia',
    async execute(sock, m) {
      const existing = getGame(m.from, 'quiz');
      if (existing && !existing.expired) {
        return m.reply('⏳ There is already an open question in this chat. Use *answer* to respond.');
      }

      let q;
      try {
        const res = await axios.get('https://opentdb.com/api.php', {
          params: { amount: 1, type: 'multiple', encode: 'url3986' },
          timeout: 15_000,
        });
        q = res.data?.results?.[0];
      } catch {
        throw new Error('Could not fetch a question. Try again in a few seconds.');
      }
      if (!q) throw new Error('No question available right now. Try again in a few seconds.');

      const correct = dec(q.correct_answer);
      const options = [correct, ...q.incorrect_answers.map(dec)].sort(() => Math.random() - 0.5);
      const letter  = LETTERS[options.indexOf(correct)];

      setGame(m.from, 'quiz', { type: 'mc', letter, correct });

      return m.reply(
        `🧠 *Trivia* — ${dec(q.category)} (${q.difficulty})\n\n${dec(q.question)}\n\n` +
        options.map((o, i) => `${LETTERS[i]}) ${o}`).join('\n') +
        `\n\nReply with: *answer a* (2 minutes)`
      );
    },
  },
  {
    ...base,
    name: 'riddle',
    aliases: [],
    description: 'Get a riddle (reply with: answer <your guess>)',
    usage: 'riddle',
    async execute(sock, m) {
      const existing = getGame(m.from, 'quiz');
      if (existing && !existing.expired) {
        return m.reply('⏳ There is already an open question in this chat. Use *answer* to respond.');
      }
      const r = pick(RIDDLES);
      setGame(m.from, 'quiz', { type: 'text', answers: r.a, correct: r.a[0] });
      return m.reply(`🧩 *Riddle*\n\n${r.q}\n\nReply with: *answer <your guess>* (2 minutes)`);
    },
  },
  {
    ...base,
    name: 'answer',
    aliases: ['ans'],
    description: 'Answer the current trivia question or riddle',
    usage: 'answer <a/b/c/d or your guess>',
    async execute(sock, m, args) {
      const g = getGame(m.from, 'quiz');
      if (!g) return m.reply('❌ No open question. Start one with *trivia* or *riddle*.');
      if (g.expired) return m.reply(`⌛ Time's up! The answer was *${g.correct}*.`);

      const guess = args.join(' ').trim();
      if (!guess) return m.reply('❌ Provide your answer.\n\nExample: answer b');

      const ok = g.type === 'mc'
        ? guess.toLowerCase() === g.letter.toLowerCase() || norm(guess) === norm(g.correct)
        : g.answers.some(a => norm(guess) === norm(a) || (norm(guess).length > 3 && norm(guess).includes(norm(a))));

      if (ok) {
        clearGame(m.from, 'quiz');
        return m.reply(`✅ Correct! The answer was *${g.correct}* 🎉`);
      }
      if (g.type === 'mc') {
        clearGame(m.from, 'quiz');
        return m.reply(`❌ Wrong! The answer was *${g.letter}) ${g.correct}*.`);
      }
      return m.reply('❌ Not quite — try again!');
    },
  },
  {
    ...base,
    name: 'hangman',
    aliases: ['hm'],
    description: 'Play hangman (guess with: guess <letter or word>)',
    usage: 'hangman',
    async execute(sock, m) {
      const g = getGame(m.from, 'hangman');
      if (g && !g.expired) {
        return m.reply(`🔤 *Hangman* (in progress)\n\n${board(g)}\n\n${hearts(g.lives)}\nWrong: ${g.wrong.join(' ') || '-'}\n\nGuess with: *guess <letter>*`);
      }
      const word = pick(WORDS);
      setGame(m.from, 'hangman', { word, guessed: [], wrong: [], lives: 6 }, 900_000);
      const fresh = getGame(m.from, 'hangman');
      return m.reply(`🔤 *Hangman* — ${word.length} letters\n\n${board(fresh)}\n\n${hearts(6)}\n\nGuess with: *guess <letter>* (or the whole word)`);
    },
  },
  {
    ...base,
    name: 'guess',
    aliases: ['g'],
    description: 'Guess a letter or the whole word in hangman',
    usage: 'guess <letter or word>',
    async execute(sock, m, args) {
      const g = getGame(m.from, 'hangman');
      if (!g) return m.reply('❌ No game running. Start one with *hangman*.');
      if (g.expired) return m.reply(`⌛ That game expired. The word was *${g.word}*.`);

      const input = (args[0] || '').toLowerCase();
      if (!/^[a-z]+$/.test(input)) return m.reply('❌ Guess a letter (a–z) or a whole word.');

      const lose = () => {
        clearGame(m.from, 'hangman');
        return m.reply(`💀 *Game over!* The word was *${g.word}*.`);
      };
      const win = () => {
        clearGame(m.from, 'hangman');
        return m.reply(`🎉 *You got it!* The word was *${g.word}*.`);
      };

      if (input.length > 1) {
        if (input === g.word) return win();
        g.lives--;
        return g.lives <= 0 ? lose() : m.reply(`❌ Not "${input}".\n\n${board(g)}\n${hearts(g.lives)}`);
      }

      if (g.guessed.includes(input) || g.wrong.includes(input)) return m.reply(`⚠️ You already tried *${input}*.`);

      if (g.word.includes(input)) {
        g.guessed.push(input);
        if ([...g.word].every(c => g.guessed.includes(c))) return win();
        return m.reply(`✅ Yes!\n\n${board(g)}\n\n${hearts(g.lives)}\nWrong: ${g.wrong.join(' ') || '-'}`);
      }

      g.wrong.push(input);
      g.lives--;
      if (g.lives <= 0) return lose();
      return m.reply(`❌ No *${input}*.\n\n${board(g)}\n\n${hearts(g.lives)}\nWrong: ${g.wrong.join(' ')}`);
    },
  },
];
