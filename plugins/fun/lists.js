import { pick, clamp } from '../../lib/utils/cmdUtils.js';

const base = { category: 'fun', owner: false, group: false, private: false, aliases: [] };

const WYR = [
  'be able to fly, or be invisible?',
  'always be 10 minutes late, or always be 20 minutes early?',
  'have unlimited data, or unlimited free food?',
  'never use social media again, or never watch another video again?',
  'live without music, or live without movies?',
  'be able to speak every language, or talk to animals?',
  'have a rewind button for your life, or a pause button?',
  'always have to sing instead of speak, or dance everywhere you walk?',
  'live in a treehouse, or on a houseboat?',
  'know the date you will die, or the cause?',
];

const NHIE = [
  'Never have I ever fallen asleep in class or at work.',
  'Never have I ever sent a message to the wrong person.',
  'Never have I ever pretended to be on a call to avoid someone.',
  'Never have I ever laughed so hard I cried in public.',
  'Never have I ever forgotten someone\'s name right after they told me.',
  'Never have I ever gotten lost while using GPS.',
  'Never have I ever stayed up all night watching a series.',
  'Never have I ever replied "on my way" while still at home.',
];

const PICKUP = [
  'Are you Wi-Fi? Because I\'m feeling a connection.',
  'Are you a keyboard? Because you\'re just my type.',
  'Do you have a map? I keep getting lost in your eyes.',
  'Is your name Google? Because you have everything I\'ve been searching for.',
  'Are you a magician? Because whenever I look at you, everyone else disappears.',
  'Do you believe in love at first sight, or should I walk by again?',
  'Are you made of copper and tellurium? Because you\'re Cu-Te.',
  'If you were a vegetable, you\'d be a cute-cumber.',
];

const FORTUNES = [
  'A pleasant surprise is waiting for you.',
  'Your hard work will soon pay off.',
  'Someone is thinking of you right now.',
  'A small decision today will lead to a big opportunity.',
  'Good news will arrive by the end of the week.',
  'Patience will bring you what rushing cannot.',
  'You will meet someone who changes how you see things.',
  'Today is a good day to start what you have been postponing.',
];

export default [
  { ...base, name: 'wyr', aliases: ['wouldyourather'], description: 'Would you rather...?', usage: 'wyr',
    async execute(sock, m) { return m.reply(`🤷 *Would you rather*\n\n${pick(WYR)}`); } },
  { ...base, name: 'nhie', aliases: ['neverhaveiever'], description: 'Never have I ever...', usage: 'nhie',
    async execute(sock, m) { return m.reply(`🙈 ${pick(NHIE)}`); } },
  { ...base, name: 'pickup', aliases: ['pickupline'], description: 'A cheesy pickup line', usage: 'pickup',
    async execute(sock, m) { return m.reply(`😏 ${pick(PICKUP)}`); } },
  { ...base, name: 'fortune', aliases: ['cookie'], description: 'Open a fortune cookie', usage: 'fortune',
    async execute(sock, m) { return m.reply(`🥠 ${pick(FORTUNES)}`); } },
  {
    ...base,
    name: 'lucky',
    aliases: ['lotto'],
    description: 'Get lucky numbers for today',
    usage: 'lucky [how many 1-10]',
    async execute(sock, m, args) {
      const n = clamp(parseInt(args[0], 10) || 6, 1, 10);
      const nums = new Set();
      while (nums.size < n) nums.add(1 + Math.floor(Math.random() * 49));
      const color = pick(['red', 'blue', 'green', 'gold', 'purple', 'orange', 'white', 'teal']);
      return m.reply(`🍀 *Lucky numbers*\n\n${[...nums].sort((a, b) => a - b).join(' • ')}\n\nLucky colour: ${color}`);
    },
  },
];
