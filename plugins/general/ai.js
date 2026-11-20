import axios from 'axios';
import { GIFTED_API, GIFTED_KEY } from '../../lib/api/gifted.js';
import { getFooter } from '../../lib/buttonHandler.js';

async function queryAI(endpoint, query, m) {
  if (!query) return m.reply('❌ Provide a question or prompt.');
  await m.react('🤔');
  try {
    const url = `${GIFTED_API}/api/ai/${endpoint}?apikey=${encodeURIComponent(GIFTED_KEY)}&q=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { timeout: 120_000 });
    if (!res.data?.success || !res.data?.result)
      return m.reply('❌ No response from AI. Try again.');
    await m.react('✅');
    return m.reply(`${res.data.result}\n\n${getFooter()}`);
  } catch (err) {
    await m.react('❌');
    return m.reply(`❌ AI error: ${err.message}`);
  }
}

const plugins = [
  {
    name: 'ai', aliases: ['giftedai', 'chat', 'chatai'],
    description: 'Chat with Gifted AI assistant',
    ep: 'ai',
  },
  {
    name: 'gpt', aliases: ['chatgpt', 'gpt4', 'chatgpt4', 'gpt4o', 'chatgpt4o'],
    description: 'Chat with GPT (GPT-4o)',
    ep: 'gpt4o',
  },
].map(m => ({
  name:        m.name,
  aliases:     m.aliases,
  description: m.description,
  usage:       `${m.name} <question>`,
  category:    'ai',
  owner:       false,
  group:       false,
  private:     false,
  async execute(sock, msg, args) {
    await queryAI(m.ep, args.join(' '), msg);
  },
}));

export default plugins;
