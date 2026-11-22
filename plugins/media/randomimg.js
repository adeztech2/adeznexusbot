import axios from 'axios';

const base = { category: 'media', owner: false, group: false, private: false };
const get = (url) => axios.get(url, { timeout: 15_000 }).then(r => r.data);

async function sendImage(sock, m, url, caption = '') {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20_000 });
  return sock.sendMessage(m.from, { image: Buffer.from(res.data), caption }, { quoted: m });
}

export default [
  {
    ...base,
    name: 'cat',
    aliases: ['kitty'],
    description: 'Random cat picture',
    usage: 'cat',
    async execute(sock, m) {
      const url = (await get('https://api.thecatapi.com/v1/images/search'))?.[0]?.url;
      if (!url) throw new Error('No cat found right now.');
      return sendImage(sock, m, url, '🐱');
    },
  },
  {
    ...base,
    name: 'dog',
    aliases: ['doggo', 'puppy'],
    description: 'Random dog picture',
    usage: 'dog',
    async execute(sock, m) {
      const url = (await get('https://dog.ceo/api/breeds/image/random'))?.message;
      if (!url) throw new Error('No dog found right now.');
      return sendImage(sock, m, url, '🐶');
    },
  },
  {
    ...base,
    name: 'fox',
    aliases: [],
    description: 'Random fox picture',
    usage: 'fox',
    async execute(sock, m) {
      const url = (await get('https://randomfox.ca/floof/'))?.image;
      if (!url) throw new Error('No fox found right now.');
      return sendImage(sock, m, url, '🦊');
    },
  },
  {
    ...base,
    name: 'meme',
    aliases: ['randommeme'],
    description: 'Random meme',
    usage: 'meme',
    async execute(sock, m) {
      // Retry a few times so NSFW-flagged posts are skipped.
      for (let i = 0; i < 4; i++) {
        const d = await get('https://meme-api.com/gimme');
        if (d?.url && !d.nsfw) return sendImage(sock, m, d.url, d.title || '');
      }
      throw new Error('Could not find a meme right now. Try again.');
    },
  },
];
