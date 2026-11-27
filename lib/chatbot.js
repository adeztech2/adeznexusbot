import { isEnabled, getSetting } from './database/settings.js';
import { loadHistory, saveHistory } from './utils/geminiMemory.js';
import { geminiChat } from './utils/gemini.js';
import { meganRequest, pickResult } from './api/megan.js';
import { PUTER_AI_URL } from '../config.js';

const busy = new Set();

// Megan fallback: no native history in this endpoint, so fold recent turns into the prompt.
async function meganReply(text, history) {
  const recent = history.slice(-10).map(h => `${h.role === 'user' ? 'User' : 'You'}: ${h.parts?.[0]?.text || ''}`).join('\n');
  const q = recent ? `Conversation so far:\n${recent}\n\nUser: ${text}\nReply briefly and naturally.` : text;
  const payload = await meganRequest('/api/ai/gpt', { params: { q }, timeout: 60_000 });
  const { data } = pickResult(payload);
  const result = data.result || data.reply || data.response || data.answer || data.text;
  if (!result) throw new Error('empty AI response');
  return String(result).trim();
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
        console.error('[chatbot] puter failed, using Megan:', e.message);
      }
    }
    if (!reply) {
      reply = await meganReply(text, history);
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
