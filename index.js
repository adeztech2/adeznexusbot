import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import makeWASocket, {
  DisconnectReason,
  fetchLatestWaWebVersion,
  makeCacheableSignalKeyStore
} from 'gifted-baileys';
import express from 'express';
import pino   from 'pino';
import path   from 'path';
import { fileURLToPath } from 'url';

import { metadataCache }                          from './lib/connection/metadataCache.js';
import { loadCommands, handleCommand }            from './lib/connection/commandHandler.js';
import { serialize }                              from './lib/connection/serialize.js';
import { handleAutoReactStatus }                  from './lib/autoReactStatus.js';
import { handleAutoNewsletterReact }              from './lib/autoNewsletterReact.js';
import { autoFollowChannel, autoJoinConfiguredGroup, handleAutoJoinGroup } from './lib/connection/autoJoinHandler.js';
import { handleListResponse, handleInteractiveResponse } from './lib/connection/handleListResponse.js';
import { handleAutoViewStatus }                   from './lib/autoview.js';
import { saveMessage, handleDeletedMessage, startPeriodicCleanup } from './lib/database/antidelete.js';
import { antiEditHandler }                        from './lib/database/antiedit.js';
import { sendPresence }                           from './lib/connection/presenceHandler.js';
import { initDb }                                 from './lib/database/db.js';
import { loadSession, useAuthState, MessageStore, startCleanup } from './lib/database/session.js';
import { initSettings, getSetting, isEnabled }    from './lib/database/settings.js';
import {
  cachedGroupMetadata,
  setCachedGroup,
  updateCachedGroup,
  clearGroupCache
} from './lib/connection/groupCache.js';
import config from './config.js';
import { startKeepAlive } from './lib/keepAlive.js';
import { enableVerifiedReplies } from './lib/verifiedQuote.js';
import { normalizeJid as _normalizeJid, getUptime, setBotStartTime, getBotStartTime } from './lib/utils/botUtils.js';

// ── Suppress noisy logs ────────────────────────────────────────────────────
const _noisy = /Closing session|Opening session|Closing open session|Removing old closed session|Migrating session|SessionEntry|Session already closed|Session already open/;
for (const m of ['log', 'info', 'warn']) {
  const orig = console[m].bind(console);
  console[m] = (...a) => { if (typeof a[0] === 'string' && _noisy.test(a[0])) return; orig(...a); };
}

// ── Express ────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

let sock  = null;
let store = null;
let botStatus      = 'offline';
let botPhoneNumber = null;
let lastSeenTime   = null;
let _heartbeatTimer  = null;
let _watchdogTimer   = null;
let _lastMsgReceived = 0;    // epoch ms of last messages.upsert event
let _startupMsgSent  = false; // send connected msg only once per process

const BASE_RETRY_DELAY = 5_000;   // 5 s initial backoff
const MAX_RETRY_DELAY  = 300_000; // 5 min cap
let   retryCount       = 0;

function normalizeJid(jid) { return _normalizeJid(jid); }

app.get('/',       (req, res) => res.sendFile(path.join(__dirname, 'lib', 'status.html')));
app.get('/health', (req, res) => res.status(200).send('ok'));
app.get('/status', (req, res) => res.json({ status: botStatus, phoneNumber: botPhoneNumber, uptime: getUptime(), lastSeen: lastSeenTime }));

async function startBot() {
  if (sock) { console.log('⚠️  Bot already running'); return; }

  try {
    botStatus = 'connecting';
    console.log('🔄 Starting ADEZ NEXUS...');

    await initDb();
    await initSettings();
    await loadSession(config.sessionId);
    const { state, saveCreds } = await useAuthState();
    const { version }          = await fetchLatestWaWebVersion();

    if (store) store.destroy();
    store = new MessageStore();

    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys:  makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      version,
      printQRInTerminal:     false,
      syncFullHistory:       false,
      logger:                pino({ level: 'silent' }),
      browser:               ['Mac OS', 'Safari', '17.5.1'],
      connectTimeoutMs:      30_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs:   25_000,
      retryRequestDelayMs:   250,
      cachedGroupMetadata,
      getMessage: async (key) => {
        if (store) {
          const msg = await store.loadMessage(key.remoteJid, key.id);
          return msg?.message || undefined;
        }
        return { conversation: 'Error occurred' };
      }
    });

    sock._manualClose = false;
    enableVerifiedReplies(sock);
    store.bind(sock.ev);
    sock.ev.on('creds.update', saveCreds);

    // ── Connection events ────────────────────────────────────────────────────
    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (connection === 'open') {
        metadataCache.clear();
        clearGroupCache();
        startPeriodicCleanup();
        startCleanup();

        botPhoneNumber = normalizeJid(sock.user?.id)?.split('@')[0];
        botStatus      = 'online';
        setBotStartTime(Date.now());
        lastSeenTime   = new Date().toISOString();
        retryCount     = 0; // reset backoff on successful connect

        // ── Watchdog ──────────────────────────────────────────────────────────
        // If no messages.upsert event fires for 5 minutes, force a reconnect.
        if (_heartbeatTimer) clearInterval(_heartbeatTimer);
        if (_watchdogTimer)  clearInterval(_watchdogTimer);
        _lastMsgReceived = Date.now();
        _watchdogTimer = setInterval(() => {
          if (botStatus !== 'online' || !sock) return;
          const idle = Date.now() - _lastMsgReceived;
          if (idle > 5000 * 60_000) {
            console.log(`⚠️ No messages in ${Math.round(idle/1000)}s — forcing reconnect`);
            sock.end(new Error('watchdog'));
          }
        }, 60_000);

        console.log(`✅ ADEZ NEXUS CONNECTED as ${botPhoneNumber}`);

        // Auto-follow configured newsletter/channel on startup
        autoFollowChannel(sock).catch(() => {});
        autoJoinConfiguredGroup(sock).catch(() => {});

        await loadCommands();
        console.log('📦 Commands loaded');

        if (!_startupMsgSent) {
          _startupMsgSent = true;
          setTimeout(async () => {
          try {
            const selfJid    = normalizeJid(sock.user.id);
            const prefix     = getSetting('prefix')     || '.';
            const ownerName  = getSetting('ownerName')  || 'Owner';
            const ownerNum   = getSetting('ownerNumber')|| '';
            const mode       = getSetting('mode')       || 'private';
            const dmP        = getSetting('dmPresence') || 'off';
            const gcP        = getSetting('gcPresence') || 'off';

            await sock.sendMessage(selfJid, {
              text:
                `👋 *ADEZ NEXUS Connected!*\n\n` +
                `✅ *Status:* Online\n` +
                `📱 *Number:* ${botPhoneNumber}\n` +
                `⚙️  *Prefix:* \`${prefix}\`\n` +
                `👤 *Owner:* ${ownerName} (${ownerNum})\n\n` +
                `📝 *Features*\n` +
                `• Mode: \`${mode === 'private' ? 'Private' : 'Public'}\`\n` +
                `• Auto-view status: \`${isEnabled('autoViewStatus') ? 'ON' : 'OFF'}\`\n` +
                `• Auto-like status: \`${isEnabled('autoLikeStatus') ? 'ON' : 'OFF'}\`\n` +
                `• DM presence: \`${dmP}\`\n` +
                `• GC presence: \`${gcP}\`\n` +
                `• Anti-delete: \`${isEnabled('antiDelete') ? 'ON' : 'OFF'}\`\n` +
                `• Anti-edit: \`${isEnabled('antiEdit') ? 'ON' : 'OFF'}\`\n` +
                `• Chatbot: \`${isEnabled('chatbot') ? 'ON' : 'OFF'}\`\n\n` +
                `💡 Type \`${prefix}help\` for commands.`
            });
          } catch (err) {
            console.error('❌ Failed to send startup message:', err.message);
          }
        }, 5000);
        } // end _startupMsgSent guard
      }

      if (connection === 'connecting') {
        botStatus    = 'connecting';
        lastSeenTime = new Date().toISOString();
        console.log('🔄 Connecting...');
      }

      if (connection === 'close') {
        if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
        if (_watchdogTimer)  { clearInterval(_watchdogTimer);  _watchdogTimer  = null; }

        if (sock?._manualClose) {
          botStatus = 'offline'; lastSeenTime = new Date().toISOString(); sock = null;
          console.log('✅ Bot closed manually'); return;
        }
        console.log('🔌 Disconnected:', { statusCode, error: lastDisconnect?.error?.message });
        botStatus    = 'offline';
        lastSeenTime = new Date().toISOString();
        sock         = null;

        // Permanent logout — don't reconnect, session is gone
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('🚪 Logged out — session ended. Re-scan QR to reconnect.');
          return;
        }

        // All other codes (including connectionReplaced/440, connectionClosed, timedOut,
        // restartRequired, multideviceMismatch…) — always attempt reconnect with backoff
        console.log(`⚠️ Disconnect code ${statusCode} — scheduling reconnect…`);
        await reconnectBot();
      }
    });

    // ── Group metadata cache (Baileys-recommended approach) ──────────────────
    // groups.upsert fires when the bot first joins or fetches group info
    sock.ev.on('groups.upsert', (groups) => {
      try { groups.forEach(g => { if (g.id) setCachedGroup(g.id, g); }); } catch (_) {}
    });
    // groups.update fires on subject/desc/settings changes — merge partial update
    sock.ev.on('groups.update', (updates) => {
      try {
        updates.forEach(u => {
          if (!u.id) return;
          updateCachedGroup(u.id, u);   // merge into existing cache entry
          metadataCache.invalidate(u.id); // invalidate TTL so next get() refreshes
        });
      } catch (_) {}
    });
    // group-participants.update fires on join/leave/promote — invalidate so fresh data is fetched
    sock.ev.on('group-participants.update', async ({ id }) => {
      try {
        metadataCache.invalidate(id);
        const meta = await sock.groupMetadata(id);
        setCachedGroup(id, meta);
      } catch (_) {}
    });

    // ── Messages ─────────────────────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Accept both 'notify' (messages from others) and 'append' (messages from
      // your own linked devices / Saved Messages). Drop only protocol syncs.
      if (type !== 'notify' && type !== 'append') return;

      const m = messages[0];
      if (!m.message) return;

      _lastMsgReceived = Date.now();   // reset watchdog
      lastSeenTime = new Date().toISOString();

      // ── Stale-message guard ────────────────────────────────────────────────
      // WhatsApp delivers a history-sync flood (old reactions, receipts, etc.)
      // right after connect. Only process messages sent AFTER the bot started
      // (with a 60-second grace window to handle messages sent just before
      // connect that are queued server-side).
      const msgTs   = Number(m.messageTimestamp || 0) * 1000;
      const isFresh = !msgTs || msgTs >= ((getBotStartTime() ?? 0) - 60_000);

      try {
        const protoType = m.message?.protocolMessage?.type;

        // ── Edited message ─────────────────────────────────────────────────────
        if (protoType === 14 || m.message?.editedMessage) {
          if (isFresh && isEnabled('antiEdit')) antiEditHandler(sock, m).catch(() => {});
          return;
        }

        // ── Deleted message ────────────────────────────────────────────────────
        if (protoType === 0) {
          if (isFresh && isEnabled('antiDelete')) handleDeletedMessage(sock, m).catch(() => {});
          return;
        }

        // ── Regular message — save for store lookups ───────────────────────────
        if (isFresh && (isEnabled('antiDelete') || isEnabled('antiEdit'))) {
          saveMessage(m).catch(err => console.error('⚠️ saveMessage failed:', err.message));
        }

        if (!isFresh) return;   // drop stale history-sync noise before any heavy work

        const msg = await serialize(sock, m);

        handleListResponse(sock, msg).catch(() => {});
        handleInteractiveResponse(sock, msg).catch(() => {});
        handleAutoViewStatus(sock, m).catch(() => {});
        handleAutoReactStatus(sock, m).catch(() => {});
        handleAutoNewsletterReact(sock, m).catch(() => {});
        handleAutoJoinGroup(sock, m).catch(() => {});
        sendPresence(sock, m).catch(() => {});

        handleCommand(sock, msg).catch(err => {
          console.error('❌ Command error:', err.message);
        });
      } catch (err) {
        console.error('❌ Message handler error:', err.message);
      }
    });

  } catch (err) {
    console.error('❌ startBot error:', err.message);
    botStatus    = 'offline';
    lastSeenTime = new Date().toISOString();
    await reconnectBot();
  }
}

async function reconnectBot() {
  retryCount++;
  // Exponential backoff: 5s, 10s, 20s, 40s … capped at 5 min
  const delay = Math.min(BASE_RETRY_DELAY * 2 ** (retryCount - 1), MAX_RETRY_DELAY);
  console.log(`🔄 Reconnecting in ${delay / 1000}s… (attempt ${retryCount})`);
  await new Promise(r => setTimeout(r, delay));
  await startBot();
}

process.on('SIGINT',              () => { console.log('\n👋 Bot stopped'); process.exit(0); });
process.on('uncaughtException',   console.error);
process.on('unhandledRejection',  console.error);

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(config.port, '0.0.0.0', () => {
  console.log(`🌐 ADEZ NEXUS server running on port ${config.port}`);
  startKeepAlive();
  startBot();
});

      
