import { meganRequest, pickResult } from '../../lib/api/megan.js';
import { getFooter } from '../../lib/buttonHandler.js';

async function queryAI(endpoint, query, m) {
  if (!query) return m.reply('❌ Provide a question or prompt.');
  await m.react('🤔');
  try {
    const payload = await meganRequest(`/api/ai/${endpoint}`, { params: { q: query }, timeout: 120_000 });
    const { data } = pickResult(payload);
    const result = data.result || data.reply || data.response || data.answer || data.text || data;
    if (!result)
      return m.reply('❌ No response from AI. Try again.');
    await m.react('✅');
    return m.reply(`${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}\n\n${getFooter()}`);
  } catch (err) {
    await m.react('❌'); m._failed = true;
    return m.reply(`❌ AI error: ${err.message}`);
  }
}

const plugins = [
  {
    name: 'ai', aliases: ['giftedai', 'chat', 'chatai'],
    description: 'Chat with Megan AI assistant',
    ep: 'gpt',
  },
  {
    name: 'gpt', aliases: ['chatgpt', 'gpt4', 'chatgpt4', 'gpt4o', 'chatgpt4o'],
    description: 'Chat with GPT (GPT-4o)',
    ep: 'gpt',
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
