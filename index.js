
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
const _noisy = /Closing session|Opening session|Closing open session|Removing old closed session|Migrating session|SessionEntry|Session already closed|Session already open/;

for (const m of ['log', 'info', 'warn']) {
  const orig = console[m].bind(console);

  console[m] = (...a) => {
    if (typeof a[0] === 'string' && _noisy.test(a[0])) return;
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

let _heartbeatTimer = null;
let _watchdogTimer = null;
let _lastMsgReceived = 0;
let _startupMsgSent = false;

const BASE_RETRY_DELAY = 5_000;
const MAX_RETRY_DELAY = 300_000;

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

// ── Bot startup ────────────────────────────────────────────────────────
async function startBot() {
  if (sock) {
    console.log('Bot already running');
    return;
  }

  try {
    botStatus = 'connecting';
    console.log('Starting ADEZ NEXUS...');

    await loadSession(config.sessionId);
    resolveBotId(config.sessionId);   // each bot gets its own database tables
    await initDb();
    await initSettings();

    const { state, saveCreds } = await useAuthState();
    const { version } = await fetchLatestWaWebVersion();

    if (store) store.destroy();

    store = new MessageStore();

    sock = makeWASocket({
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
          const msg = await store.loadMessage(
            key.remoteJid,
            key.id
          );

          return msg?.message || undefined;
        }

        return { conversation: 'Error occurred' };
      }
    });

    sock._manualClose = false;

    enableVerifiedReplies(sock);
    store.bind(sock.ev);

    sock.ev.on('creds.update', saveCreds);

    // ── Connection events ─────────────────────────────────────────────
    sock.ev.on('connection.update', async ({
      connection,
      lastDisconnect
    }) => {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (connection === 'open') {
        metadataCache.clear();
        clearGroupCache();

        startPeriodicCleanup();
        startCleanup();

        botPhoneNumber = normalizeJid(sock.user?.id)?.split('@')[0];

        botStatus = 'online';
        setBotStartTime(Date.now());

        lastSeenTime = new Date().toISOString();
        retryCount = 0;

        // ── Connection watchdog ────────────────────────────────────────
        if (_heartbeatTimer) {
          clearInterval(_heartbeatTimer);
        }

        if (_watchdogTimer) {
          clearInterval(_watchdogTimer);
        }

        _lastMsgReceived = Date.now();

        _watchdogTimer = setInterval(() => {
          if (botStatus !== 'online' || !sock) return;

          const idle = Date.now() - _lastMsgReceived;

          if (idle > 5 * 60_000) {
            console.log(
              `No messages in ${Math.round(idle / 1000)}s — reconnecting`
            );

            sock.end(new Error('watchdog'));
          }
        }, 60_000);

        console.log(`ADEZ NEXUS CONNECTED as ${botPhoneNumber}`);

        autoFollowChannel(sock).catch(() => {});
        autoJoinConfiguredGroup(sock).catch(() => {});

        await loadCommands();

        console.log('Commands loaded');

        // ── Connected notification ─────────────────────────────────────
        if (!_startupMsgSent) {
          _startupMsgSent = true;

          setTimeout(async () => {
            try {
              if (!sock?.user) return;

              const selfJid = normalizeJid(sock.user.id);

              // ── Connected alert design — edit this block to restyle it ──
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
                  buttonParamsJson: JSON.stringify({
                    display_text: '📢 Channel',
                    url: channelUrl
                  })
                });
              }

              if (groupUrl) {
                buttons.push({
                  name: 'cta_url',
                  buttonParamsJson: JSON.stringify({
                    display_text: '👥 Support Group',
                    url: groupUrl
                  })
                });
              }

              try {
                await sendButtons(sock, selfJid, {
                  title: `${botName} CONNECTED`,
                  text,
                  footer: getFooter(),
                  buttons
                });
              } catch (btnErr) {
                // Buttons can fail (rate limits / unsupported client) — fall back to plain text
                console.error('Connected alert buttons failed, sending text:', btnErr.message);
                await sock.sendMessage(selfJid, { text: `*${botName} CONNECTED*\n\n${text}` });
              }

            } catch (err) {
              console.error(
                'Failed to send startup notification:',
                err.message
              );
            }
          }, 5000);
        }
      }

      if (connection === 'connecting') {
        botStatus = 'connecting';
        lastSeenTime = new Date().toISOString();

        console.log('Connecting...');
      }

      if (connection === 'close') {
        if (_heartbeatTimer) {
          clearInterval(_heartbeatTimer);
          _heartbeatTimer = null;
        }

        if (_watchdogTimer) {
          clearInterval(_watchdogTimer);
          _watchdogTimer = null;
        }

        if (sock?._manualClose) {
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
          console.log(
            'Logged out — session ended. Re-scan QR to reconnect.'
          );

          return;
        }

        console.log(
          `Disconnect code ${statusCode} — scheduling reconnect`
        );

        await reconnectBot();
      }
    });

    // ── Group metadata cache ──────────────────────────────────────────
    sock.ev.on('groups.upsert', (groups) => {
      try {
        groups.forEach(g => {
          if (g.id) setCachedGroup(g.id, g);
        });
      } catch (_) {}
    });

    sock.ev.on('groups.update', (updates) => {
      try {
        updates.forEach(u => {
          if (!u.id) return;

          updateCachedGroup(u.id, u);
          metadataCache.invalidate(u.id);
        });
      } catch (_) {}
    });

    sock.ev.on('group-participants.update', async (update) => {
      try {
        metadataCache.invalidate(update.id);

        const meta = await sock.groupMetadata(update.id);

        setCachedGroup(update.id, meta);
      } catch (_) {}

      // Welcome / goodbye messages
      handleParticipantsUpdate(sock, update).catch(err => {
        console.error('Participants handler error:', err.message);
      });
    });

    // ── Messages ──────────────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;

      const m = messages[0];

      if (!m?.message) return;

      _lastMsgReceived = Date.now();
      lastSeenTime = new Date().toISOString();

      const msgTs = Number(m.messageTimestamp || 0) * 1000;

      const isFresh =
        !msgTs ||
        msgTs >= ((getBotStartTime() ?? 0) - 60_000);

      try {
        const protoType = m.message?.protocolMessage?.type;

        // ── Edited messages ───────────────────────────────────────────
        if (protoType === 14 || m.message?.editedMessage) {
          if (isFresh && isEnabled('antiEdit')) {
            antiEditHandler(sock, m).catch(() => {});
          }

          return;
        }

        // ── Deleted messages ──────────────────────────────────────────
        if (protoType === 0) {
          if (isFresh && isEnabled('antiDelete')) {
            handleDeletedMessage(sock, m).catch(() => {});
          }

          return;
        }

        // ── Save messages ─────────────────────────────────────────────
        if (
          isFresh &&
          (isEnabled('antiDelete') || isEnabled('antiEdit'))
        ) {
          saveMessage(m).catch(err => {
            console.error('saveMessage failed:', err.message);
          });
        }

        if (!isFresh) return;

        const msg = await serialize(sock, m);

        handleListResponse(sock, msg).catch(() => {});
        handleInteractiveResponse(sock, msg).catch(() => {});

        handleAutoViewStatus(sock, m).catch(() => {});
        handleAutoReactStatus(sock, m).catch(() => {});
        handleAutoNewsletterReact(sock, m).catch(() => {});
        handleAutoJoinGroup(sock, m).catch(() => {});

        handleAntiLink(sock, msg).catch(err => {
          console.error('Antilink error:', err.message);
        });

        sendPresence(sock, m).catch(() => {});

        handleCommand(sock, msg).catch(err => {
          console.error('Command error:', err.message);
        });

        handleChatbot(sock, msg).catch(err => {
          console.error('Chatbot error:', err.message);
        });

      } catch (err) {
        console.error('Message handler error:', err.message);
      }
    });

  } catch (err) {
    console.error('startBot error:', err.message);

    botStatus = 'offline';
    lastSeenTime = new Date().toISOString();

    sock = null;

    await reconnectBot();
  }
}

// ── Automatic reconnection ─────────────────────────────────────────────
async function reconnectBot() {
  retryCount++;

  const delay = Math.min(
    BASE_RETRY_DELAY * 2 ** (retryCount - 1),
    MAX_RETRY_DELAY
  );

  console.log(
    `Reconnecting in ${delay / 1000}s... (attempt ${retryCount})`
  );

  await new Promise(resolve => setTimeout(resolve, delay));

  await startBot();
}

// ── Process handlers ──────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\nADEZ NEXUS stopped');
  process.exit(0);
});

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

// ── Start server ──────────────────────────────────────────────────────
app.listen(config.port, '0.0.0.0', () => {
  console.log(
    `ADEZ NEXUS server running on port ${config.port}`
  );

  startKeepAlive();
  startBot();
});

      
