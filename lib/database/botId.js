import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Every deployed bot gets its own tables in the database, named after the
// WhatsApp number it is linked to. That way one bot's settings (bot name,
// prefix, sudo list...) can never overwrite another bot's, even when many
// bots share the same DATABASE_URL.

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const CREDS_PATH = path.join(__dirname, '..', 'session', 'creds.json');

let _id = null;

// Call once at startup, AFTER the session has been loaded (creds.json exists).
export function resolveBotId(sessionId = '') {
  let id = '';
  try {
    const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
    id = String(creds?.me?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  } catch {}
  if (!id) {
    // No linked number yet — use a stable fingerprint of the session instead.
    id = 'h' + crypto.createHash('sha1').update(String(sessionId || 'local')).digest('hex').slice(0, 12);
  }
  _id = id;
  console.log(`🆔 Bot database scope: ${_id}`);
  return _id;
}

export function getBotId() {
  return _id || 'local';
}

// Table name for this bot. Only digits/letters, so it is safe inside SQL.
export function t(name) {
  return `${name}_${getBotId()}`;
}
