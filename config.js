import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(function parseEnv(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {}
})(path.join(__dirname, '.env'));

export const PORT = parseInt(process.env.PORT || '3237');
export const SESSION_ID = process.env.SESSION_ID || '';
export const DATABASE_URL = process.env.DATABASE_URL || '';
export const GEMINI_KEYS = (process.env.API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
export const GIFTED_API = process.env.GIFTED_TECH_API || 'https://api.gifted.co.ke';
export const MP3_API_URL = process.env.MP3_API_URL || 'https://mcow.gifted.co.ke';
export const GIFTED_KEY = process.env.GIFTED_API_KEY || '';
export const OWNER_NUMBER = (process.env.OWNER_NUMBER || '254111783552').replace(/\D/g, '');
export const PUTER_AI_URL = process.env.PUTER_AI_URL || '';
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
export const GITHUB_USER = process.env.GITHUB_USER || '';
export const GITHUB_EMAIL = process.env.GITHUB_EMAIL || '';

export default {
  port: PORT,
  sessionId: SESSION_ID,
  databaseUrl: DATABASE_URL,
  geminiKeys: GEMINI_KEYS,
  giftedApi: GIFTED_API,
  mp3ApiUrl: MP3_API_URL,
  giftedKey: GIFTED_KEY,
  ownerNumber: OWNER_NUMBER,
  puterAiUrl: PUTER_AI_URL,
  githubToken: GITHUB_TOKEN,
  githubUser: GITHUB_USER,
  githubEmail: GITHUB_EMAIL,
};
