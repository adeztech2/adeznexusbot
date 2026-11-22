import { isEnabled, getSetting } from './database/settings.js';
import { loadHistory, saveHistory } from './utils/geminiMemory.js';
import { geminiChat } from './utils/gemini.js';
import { giftedGet } from './api/gifted.js';
import { PUTER_AI_URL } from '../config.js';

const busy = new Set();

// Gifted API fallback: no native history, so fold recent turns into the prompt.
async function giftedReply(text, history) {
  const recent = history.slice(-10).map(h => `${h.role === 'user' ? 'User' : 'You'}: ${h.parts?.[0]?.text || ''}`).join('\n');
  const q = recent ? `Conversation so far:\n${recent}\n\nUser: ${text}\nReply briefly and naturally.` : text;
  const data = await giftedGet('/api/ai/gpt4o', { q }, 60_000);
  if (!data?.success || !data?.result) throw new Error('empty AI response');
  return String(data.result).trim();
}

export async function handleChatbot(sock, m) {
  if (!isEnabled('chatbot')) return;
  if (m.fromMe || m.isGroup || m.isStatus || m.isChannel) return;
  const text = (m.body || '').trim();
  if (!text) return;
  const prefix = getSetting('prefix') || '.';
  if (text.startsWith(prefix)) return;                      // commands are handled elsewhere
  if (!['conversation', 'extendedTextMessage'].includes(m.mtype)) return;

  const key = m.sender || m.from;
  if (busy.has(key)) return;
  busy.add(key);
  try {
    await sock.sendPresenceUpdate('composing', m.from).catch(() => {});
    const history = await loadHistory(key);
    let reply, updated;
    if (PUTER_AI_URL) {
      try {
        const r = await geminiChat(text, null, '', history);
        reply = r.text; updated = r.updatedHistory;
      } catch (e) {
        console.error('[chatbot] puter failed, using gifted:', e.message);
      }
    }
    if (!reply) {
      reply = await giftedReply(text, history);
      updated = [...history, { role: 'user', parts: [{ text }] }, { role: 'model', parts: [{ text: reply }] }];
    }
    await m.reply(reply);
    saveHistory(key, updated).catch(() => {});
  } catch (e) {
    console.error('[chatbot] error:', e.message);
  } finally {
    busy.delete(key);
    sock.sendPresenceUpdate('paused', m.from).catch(() => {});
  }
                                                                   }
