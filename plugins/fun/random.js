import { pick } from '../../lib/utils/cmdUtils.js';

const base = { category: 'fun', owner: false, group: false, private: false, aliases: [] };

const JOKES = [
  "Why don't scientists trust atoms? Because they make up everything.",
  'Why did the developer go broke? Because he used up all his cache.',
  'What do you call a fake noodle? An impasta.',
  'Why did the scarecrow win an award? He was outstanding in his field.',
  "I only know 25 letters of the alphabet. I don't know y.",
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  "There are 10 types of people: those who understand binary and those who don't.",
  "I'd tell you a UDP joke, but you might not get it.",
  'How does a penguin build its house? Igloos it together.',
  'Why was the math book sad? It had too many problems.',
  'What did the ocean say to the beach? Nothing, it just waved.',
  'Why did the computer go to the doctor? It had a virus.',
];

const QUOTES = [
  'Small steps every day beat big plans someday.',
  "You don't have to be perfect to begin, but you have to begin to get better.",
  'Discipline is choosing what you want most over what you want now.',
  'A calm mind solves what a hurried one only makes worse.',
  'Progress is quiet. Keep showing up.',
  'Be the kind of person your future self will thank.',
  'Mistakes are proof that you are trying.',
  'The best time to start was yesterday. The next best time is now.',
  'Consistency turns ordinary effort into extraordinary results.',
  'Done is better than perfect, and better still when it is done well.',
];

const FACTS = [
  'Octopuses have three hearts.',
  'A day on Venus is longer than its year.',
  'Botanically, bananas are berries.',
  'Wombats produce cube-shaped droppings.',
  'Sharks are older than trees.',
  'Sound cannot travel through a vacuum.',
  'Lightning is hotter than the surface of the Sun.',
  'An adult human has 206 bones.',
  'The Eiffel Tower can grow by around 15 cm in summer because metal expands in heat.',
  'Russia spans 11 time zones.',
];

const TRUTHS = [
  "What's the most embarrassing thing you've done in public?",
  "What's a habit of yours that you'd never admit to a stranger?",
  "What's the last lie you told?",
  "What's your biggest fear?",
  'Who in this chat would you trust with your phone for a day?',
  "What's the worst gift you've ever received?",
  "What's something you pretend to like but actually don't?",
  "What's the silliest thing you've cried about?",
];

const DARES = [
  'Send a voice note singing the chorus of your favourite song.',
  'Change your WhatsApp status to "I love broccoli" for one hour.',
  'Type the next message using only emojis.',
  'Send the 5th photo in your gallery (if you are comfortable).',
  'Talk like a pirate for the next 10 minutes.',
  'Send a voice note saying the alphabet backwards.',
  'Write a two-line poem about the person above you in the chat.',
  'Do 10 push-ups and report back.',
];

export default [
  { ...base, name: 'joke',  description: 'Get a random joke',     usage: 'joke',  async execute(sock, m) { return m.reply(`😂 ${pick(JOKES)}`); } },
  { ...base, name: 'quote', aliases: ['motivate'], description: 'Get a motivational line', usage: 'quote', async execute(sock, m) { return m.reply(`💭 _${pick(QUOTES)}_`); } },
  { ...base, name: 'fact',  description: 'Get a random fun fact', usage: 'fact',  async execute(sock, m) { return m.reply(`🧠 *Did you know?*\n${pick(FACTS)}`); } },
  { ...base, name: 'truth', description: 'Get a truth question',  usage: 'truth', async execute(sock, m) { return m.reply(`🫢 *Truth*\n${pick(TRUTHS)}`); } },
  { ...base, name: 'dare',  description: 'Get a dare',            usage: 'dare',  async execute(sock, m) { return m.reply(`😈 *Dare*\n${pick(DARES)}`); } },
];
