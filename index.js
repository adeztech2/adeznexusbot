import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import makeWASocket, {
  DisconnectReason,
  fetchLatestWaWebVersion,
  makeCacheableSignalKeyStore
} from 'gifted-baileys';
import express from 'express';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';

import { metadataCache } from './lib/connection/metadataCache.js';
import { loadCommands, handleCommand } from './lib/connection/commandHandler.js';
import { serialize } from './lib/connection/serialize.js';
import { handleAutoReactStatus } from './lib/autoReactStatus.js';
import { handleAutoNewsletterReact } from './lib/autoNewsletterReact.js';
import {
  autoFollowChannel,
  autoJoinConfiguredGroup,
  handleAutoJoinGroup
} from './lib/connection/autoJoinHandler.js';
import {
  handleListResponse,
  handleInteractiveResponse
} from './lib/connection/handleListResponse.js';
import { handleAutoViewStatus } from './lib/autoview.js';
import {
  saveMessage,
  handleDeletedMessage,
  startPeriodicCleanup
} from './lib/database/antidelete.js';
import { antiEditHandler } from './lib/database/antiedit.js';
import { handleAntiLink, handleParticipantsUpdate } from './lib/groupGuard.js';
import { sendPresence } from './lib/connection/presenceHandler.js';
import { handleChatbot } from './lib/chatbot.js';
import { sendButtons, getFooter } from './lib/buttonHandler.js';
import { initDb } from './lib/database/db.js';
import { resolveBotId } from './lib/database/botId.js';
import {
  loadSession,
  useAuthState,
  MessageStore,
  startCleanup
} from './lib/database/session.js';
import {
  initSettings,
  getSetting,
  isEnabled
} from './lib/database/settings.js';
import {
  cachedGroupMetadata,
  setCachedGroup,
  updateCachedGroup,
  clearGroupCache
} from './lib/connection/groupCache.js';
import config from './config.js';
import { startKeepAlive } from './lib/keepAlive.js';
import { enableVerifiedReplies } from './lib/verifiedQuote.js';
import {
  normalizeJid as _normalizeJid,
  getUptime,
  setBotStartTime,
  getBotStartTime
} from './lib/utils/botUtils.js';

// ── Suppress noisy logs ────────────────────────────────────────────────
const _noisy = /Closing session|Opening session|Closing open session|Removing old closed session|Migrating session|SessionEntry|Session already closed|Session already open|Session error|Failed to decrypt message|Bad MAC/;

for (const m of ['log', 'info', 'warn', 'error']) {
  const orig = console[m].bind(console);

  console[m] = (...a) => {
    const first = a[0];
    if (typeof first === 'string' && _noisy.test(first)) return;
    if (first instanceof Error && /Bad MAC/.test(first.message)) return;
    orig(...a);
  };
}

// ── Express ────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('trust proxy', 1);
app.use(express.json());

let sock = null;
let store = null;

let botStatus = 'offline';
let botPhoneNumber = null;
let lastSeenTime = null;

let _watchdogTimer = null;
let _lastMsgReceived = 0;
let _startupMsgSent = false;

let _starting = false;      // a startBot() is in progress
let _reconnecting = false;  // a reconnect is already scheduled

const BASE_RETRY_DELAY = 5_000;
const MAX_RETRY_DELAY = 300_000;
const WATCHDOG_IDLE_MS = 30 * 60_000;

let retryCount = 0;

function normalizeJid(jid) {
  return _normalizeJid(jid);
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'lib', 'status.html'));
});

app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

app.get('/status', (req, res) => {
  res.json({
    status: botStatus,
    phoneNumber: botPhoneNumber,
    uptime: getUptime(),
    lastSeen: lastSeenTime
  });
});

// ── Per-message handler ────────────────────────────────────────────────
async function handleOneMessage(s, m, type) {
  if (!m?.message) return;

  _lastMsgReceived = Date.now();
  lastSeenTime = new Date().toISOString();

  const msgTs = Number(m.messageTimestamp || 0) * 1000;

  const isFresh =
    !msgTs ||
    msgTs >= ((getBotStartTime() ?? 0) - 60_000);

  try {
    const protoType = m.message?.protocolMessage?.type;

    // Edited messages
    if (protoType === 14 || m.message?.editedMessage) {
      if (isFresh && isEnabled('antiEdit')) {
        antiEditHandler(s, m).catch(() => {});
      }
      return;
    }

    // Deleted messages
    if (protoType === 0) {
      if (isFresh && isEnabled('antiDelete')) {
        handleDeletedMessage(s, m).catch(() => {});
      }
      return;
    }

    // Save messages
    if (isFresh && (isEnabled('antiDelete') || isEnabled('antiEdit'))) {
      saveMessage(m).catch(err => {
        console.error('saveMessage failed:', err.message);
      });
    }

    if (!isFresh) return;

    const msg = await serialize(s, m);

    handleListResponse(s, msg).catch(() => {});
    handleInteractiveResponse(s, msg).catch(() => {});

    handleAutoViewStatus(s, m).catch(() => {});
    handleAutoReactStatus(s, m).catch(() => {});
    handleAutoNewsletterReact(s, m).catch(() => {});
    handleAutoJoinGroup(s, m).catch(() => {});

    handleAntiLink(s, msg).catch(err => {
      console.error('Antilink error:', err.message);
    });

    sendPresence(s, m).catch(() => {});

    handleCommand(s, msg).catch(err => {
      console.error('Command error:', err.message);
    });

    handleChatbot(s, msg).catch(err => {
      console.error('Chatbot error:', err.message);
    });
  } catch (err) {
    console.error('Message handler error:', err.message);
  }
}

// ── Connected notification ─────────────────────────────────────────────
async function sendConnectedNotice(s) {
  try {
    if (!s?.user) return;

    const selfJid = normalizeJid(s.user.id);

    const prefix    = getSetting('prefix') || '.';
    const botName   = getSetting('botName') || 'ADEZ NEXUS';
    const ownerName = getSetting('ownerName') || 'Owner';
    const mode      = getSetting('mode') === 'public' ? 'Public' : 'Private';
    const host      = process.env.HOST_PLATFORM || 'ADEZ HOST';

    let time = '';
    try {
      time = new Date().toLocaleString('en-GB', {
        timeZone: getSetting('timezone') || 'Africa/Nairobi'
      });
    } catch {
      time = new Date().toISOString();
    }

    const text =
      `✅ *Bot is connected and ready*\n\n` +
      `▸ *Bot:* ${botName}\n` +
      `▸ *Status:* 🟢 Online\n` +
      `▸ *Number:* ${botPhoneNumber}\n` +
      `▸ *Owner:* ${ownerName}\n` +
      `▸ *Prefix:* ${prefix}\n` +
      `▸ *Mode:* ${mode}\n` +
      `▸ *Host:* ${host}\n` +
      `▸ *Time:* ${time}`;

    const buttons = [
      { id: `${prefix}menu`, text: '📜 Menu' },
      { id: `${prefix}ping`, text: '⚡ Ping' }
    ];

    const channelUrl = getSetting('channelUrl');
    const groupUrl   = getSetting('groupUrl');

    if (channelUrl) {
      buttons.push({
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({ display_text: '📢 Channel', url: channelUrl })
      });
    }

    if (groupUrl) {
      buttons.push({
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({ display_text: '👥 Support Group', url: groupUrl })
      });
    }

    try {
      await sendButtons(s, selfJid, {
        title: `${botName} CONNECTED`,
        text,
        footer: getFooter(),
        buttons
      });
    } catch (btnErr) {
      console.error('Connected alert buttons failed, sending text:', btnErr.message);
      await s.sendMessage(selfJid, { text: `*${botName} CONNECTED*\n\n${text}` });
    }
  } catch (err) {
    console.error('Failed to send startup notification:', err.message);
  }
}

// ── Bot startup ────────────────────────────────────────────────────────
async function startBot() {
  if (sock || _starting) {
    console.log('Bot already running or starting');
    return;
  }

  _starting = true;

  try {
    botStatus = 'connecting';
    console.log('Starting ADEZ NEXUS...');

    // ORDER MATTERS: table names depend on resolveBotId, and loadSession
    // checks PostgreSQL for existing creds.
    resolveBotId(config.sessionId);
    await initDb();
    await loadSession(config.sessionId);
    await initSettings();

    const { state, saveCreds } = await useAuthState();
    const { version } = await fetchLatestWaWebVersion();

    if (store) store.destroy();
    store = new MessageStore();

    // `s` is this socket's own reference. Events from an old socket are
    // ignored once `sock` no longer points at it.
    const s = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          pino({ level: 'silent' })
        )
      },

      version,
      printQRInTerminal: false,
      syncFullHistory: false,
      logger: pino({ level: 'silent' }),
      browser: ['Mac OS', 'Safari', '17.5.1'],

      connectTimeoutMs: 30_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
      retryRequestDelayMs: 250,

      cachedGroupMetadata,

      getMessage: async (key) => {
        if (store) {
          const msg = await store.loadMessage(key.remoteJid, key.id);
          return msg?.message || undefined;
        }
        return undefined;
      }
    });

    sock = s;
    s._manualClose = false;

    enableVerifiedReplies(s);
    store.bind(s.ev);

    s.ev.on('creds.update', saveCreds);

    // ── Connection events ─────────────────────────────────────────────
    s.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (s !== sock) return; // stale socket, ignore

      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (connection === 'open') {
        metadataCache.clear();
        clearGroupCache();

        startPeriodicCleanup();
        startCleanup();

        botPhoneNumber = normalizeJid(s.user?.id)?.split('@')[0];

        botStatus = 'online';
        setBotStartTime(Date.now());

        lastSeenTime = new Date().toISOString();
        retryCount = 0;

        // Watchdog
        if (_watchdogTimer) clearInterval(_watchdogTimer);
        _lastMsgReceived = Date.now();

        _watchdogTimer = setInterval(() => {
          if (botStatus !== 'online' || s !== sock) return;

          const idle = Date.now() - _lastMsgReceived;

          if (idle > WATCHDOG_IDLE_MS) {
            console.log(`No messages in ${Math.round(idle / 1000)}s — reconnecting`);
            s.end(new Error('watchdog'));
          }
        }, 60_000);

        console.log(`ADEZ NEXUS CONNECTED as ${botPhoneNumber}`);

        autoFollowChannel(s).catch(() => {});
        autoJoinConfiguredGroup(s).catch(() => {});

        await loadCommands();
        console.log('Commands loaded');

        if (!_startupMsgSent) {
          _startupMsgSent = true;
          setTimeout(() => sendConnectedNotice(s), 5000);
        }
      }

      if (connection === 'connecting') {
        botStatus = 'connecting';
        lastSeenTime = new Date().toISOString();
        console.log('Connecting...');
      }

      if (connection === 'close') {
        if (_watchdogTimer) {
          clearInterval(_watchdogTimer);
          _watchdogTimer = null;
        }

        if (s._manualClose) {
          botStatus = 'offline';
          lastSeenTime = new Date().toISOString();
          sock = null;
          console.log('Bot closed manually');
          return;
        }

        console.log('Disconnected:', {
          statusCode,
          error: lastDisconnect?.error?.message
        });

        botStatus = 'offline';
        lastSeenTime = new Date().toISOString();
        sock = null;

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('Logged out — session ended. Clear auth_state, re-pair with a fresh SESSION_ID.');
          return;
        }

        // Another instance connected with the same session. Do NOT fight it.
        if (statusCode === DisconnectReason.connectionReplaced) {
          console.log('Connection replaced by another instance — not reconnecting. Stop duplicate deployments.');
          return;
        }

        console.log(`Disconnect code ${statusCode} — scheduling reconnect`);
        reconnectBot();
      }
    });

    // ── Group metadata cache ──────────────────────────────────────────
    s.ev.on('groups.upsert', (groups) => {
      try {
        groups.forEach(g => { if (g.id) setCachedGroup(g.id, g); });
      } catch (_) {}
    });

    s.ev.on('groups.update', (updates) => {
      try {
        updates.forEach(u => {
          if (!u.id) return;
          updateCachedGroup(u.id, u);
          metadataCache.invalidate(u.id);
        });
      } catch (_) {}
    });

    s.ev.on('group-participants.update', async (update) => {
      if (s !== sock) return;

      try {
        metadataCache.invalidate(update.id);
        const meta = await s.groupMetadata(update.id);
        setCachedGroup(update.id, meta);
      } catch (_) {}

      handleParticipantsUpdate(s, update).catch(err => {
        console.error('Participants handler error:', err.message);
      });
    });

    // ── Messages ──────────────────────────────────────────────────────
    s.ev.on('messages.upsert', async ({ messages, type }) => {
      if (s !== sock) return;
      if (type !== 'notify' && type !== 'append') return;

      for (const m of messages) {
        await handleOneMessage(s, m, type);
      }
    });

  } catch (err) {
    console.error('startBot error:', err.message);

    botStatus = 'offline';
    lastSeenTime = new Date().toISOString();
    sock = null;

    _starting = false;
    reconnectBot();
    return;
  }

  _starting = false;
}

// ── Automatic reconnection (only one at a time) ────────────────────────
async function reconnectBot() {
  if (_reconnecting) return;
  _reconnecting = true;

  try {
    retryCount++;

    const delay = Math.min(
      BASE_RETRY_DELAY * 2 ** (retryCount - 1),
      MAX_RETRY_DELAY
    );

    console.log(`Reconnecting in ${delay / 1000}s... (attempt ${retryCount})`);

    await new Promise(resolve => setTimeout(resolve, delay));
  } finally {
    _reconnecting = false;
  }

  await startBot();
}

// ── Process handlers ──────────────────────────────────────────────────
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\nADEZ NEXUS stopped');
    try {
      if (sock) {
        sock._manualClose = true;
        sock.end(new Error('shutdown'));
      }
    } catch (_) {}
    // small grace period so in-flight DB writes can finish
    setTimeout(() => process.exit(0), 1500);
  });
}

process.on('uncaughtException', (e) => console.error('uncaughtException:', e?.message || e));
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e?.message || e));

// ── Start server ──────────────────────────────────────────────────────
app.listen(config.port, '0.0.0.0', () => {
  console.log(`ADEZ NEXUS server running on port ${config.port}`);

  startKeepAlive();
  startBot();
});
