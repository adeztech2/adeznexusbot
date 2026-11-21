import { downloadMediaMessage } from 'gifted-baileys';
import { sendBtnOrText, extractButtonId, getFooter } from '../../lib/buttonHandler.js';
import { isEnabled } from '../../lib/database/settings.js';
import { registerListNamespace } from '../../lib/connection/handleListResponse.js';
import {
  uploadToCatbox,
  uploadToFileIO,
  uploadToTmpFiles,
  uploadToGoFile,
} from '../../lib/utils/uploadUtils.js';

const SERVICES = {
  catbox:   { label: '📦 Catbox',   note: 'Permanent link, max 200 MB' },
  gofile:   { label: '🗂️ GoFile',   note: 'Permanent link, all file types' },
  fileio:   { label: '🔗 File.io',  note: 'Expires after 1 download' },
  tmpfiles: { label: '⏱ TmpFiles', note: 'Expires after 1 hour' },
};

function getMime(messageType, msg) {
  if (messageType === 'imageMessage')   return { ext: 'jpg',  mime: 'image/jpeg' };
  if (messageType === 'videoMessage')   return { ext: 'mp4',  mime: 'video/mp4'  };
  if (messageType === 'audioMessage')   return { ext: msg?.ptt ? 'ogg' : 'mp3',
                                                  mime: msg?.ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg' };
  if (messageType === 'stickerMessage') return { ext: 'webp', mime: 'image/webp' };
  if (messageType === 'documentMessage') {
    const name = msg?.fileName || 'file';
    const ext  = name.includes('.') ? name.split('.').pop() : 'bin';
    return { ext, mime: msg?.mimetype || 'application/octet-stream' };
  }
  return { ext: 'bin', mime: 'application/octet-stream' };
}

async function doUpload(service, buffer, filename, mime) {
  switch (service) {
    case 'catbox':   return { url: await uploadToCatbox(buffer, filename, mime),   note: SERVICES.catbox.note };
    case 'gofile':   return { url: await uploadToGoFile(buffer, filename, mime),   note: SERVICES.gofile.note };
    case 'fileio':   return { url: await uploadToFileIO(buffer, filename.split('.').pop()), note: SERVICES.fileio.note };
    case 'tmpfiles': return { url: await uploadToTmpFiles(buffer, filename, mime), note: SERVICES.tmpfiles.note };
    default: throw new Error('Unknown service');
  }
}

async function sendResult(sock, m, url, filename, sizeMB, note) {
  await m.react('✅');
  return sendBtnOrText(sock, m.from, {
    title:   '✅ Upload Successful',
    text:    `*File:* ${filename}\n*Size:* ${sizeMB} MB\n*URL:* ${url}\n\n_${note}_`,
    footer:  getFooter(),
    buttons: [
      { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: '📋 Copy URL', copy_code: url }) },
      { name: 'cta_url',  buttonParamsJson: JSON.stringify({ display_text: '🔗 Open Link', url }) },
    ],
  });
}

// ── Pending uploads state (keyed by ts) ───────────────────────────────────────
const pending = new Map();

// ── Namespace handler — fires when a service button is tapped ─────────────────
registerListNamespace('upload', async (sock, m, parts) => {
  // parts = ['upload', 'catbox', ts] or ['upload', 'gofile', ts] etc.
  const svc = parts[1];
  const ts  = parts[2];
  if (!svc || !SERVICES[svc]) return;

  const state = pending.get(ts);
  if (!state) return m.reply('⚠️ Session expired. Run .upload again.');
  pending.delete(ts);

  const { buffer, filename, sizeMB, mime, m: origM } = state;

  try {
    await m.reply(`☁️ Uploading to ${SERVICES[svc].label}…`);
    const { url, note } = await doUpload(svc, buffer, filename, mime);
    await sendResult(sock, origM, url, filename, sizeMB, note);
  } catch (err) {
    await m.reply(`❌ Upload failed: ${err.message}`);
    await origM.react('❌');
  }
});

export default {
  name:        'upload',
  aliases:     ['tourl', 'url', 'catbox', 'gofile', 'fileio', 'tmpfiles'],
  description: 'Upload replied media to a public URL',
  usage:       'upload  (reply to image/video/audio/sticker/document)',
  category:    'uploader',
  owner:       false,
  group:       false,
  private:     false,

  async execute(sock, m, args) {
    const quoted = m.quoted;
    if (!quoted) {
      return m.reply(
        '❌ *Reply to a media message first!*\n\n' +
        '_Supports: image, video, audio, sticker, document_\n\n' +
        '*Services:*\n' +
        '📦 catbox — Permanent, max 200 MB\n' +
        '🗂️ gofile — Permanent, all types\n' +
        '🔗 fileio — Expires after 1 download\n' +
        '⏱ tmpfiles — Expires after 1 hour'
      );
    }

    // Detect direct service alias (.catbox / .gofile / .fileio / .tmpfiles)
    const cmdUsed = m.body?.split(' ')[0]?.replace(/^[.!#/]/, '').toLowerCase();
    const directService = Object.keys(SERVICES).includes(cmdUsed) ? cmdUsed : null;

    try {
      await m.react('⏳');

      let actualMessage = quoted.message;
      const viewOnceMsg = quoted.message?.viewOnceMessageV2 || quoted.message?.viewOnceMessage;
      if (viewOnceMsg) actualMessage = viewOnceMsg.message;

      const messageType = Object.keys(actualMessage)[0];
      const SUPPORTED   = ['imageMessage','videoMessage','audioMessage','stickerMessage','documentMessage'];
      if (!SUPPORTED.includes(messageType)) {
        return m.reply('❌ Please reply to an image, video, audio, sticker, or document!');
      }

      await m.reply('📥 Downloading media…');

      const buffer = await downloadMediaMessage(
        { message: actualMessage },
        'buffer',
        {},
        { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
      );

      const { ext, mime } = getMime(messageType, actualMessage[messageType]);
      const filename = `upload.${ext}`;
      const sizeMB   = (buffer.length / (1024 * 1024)).toFixed(2);

      // ── Direct service alias ──────────────────────────────────────────────────
      if (directService) {
        await m.reply(`☁️ Uploading to ${SERVICES[directService].label}…`);
        try {
          const { url, note } = await doUpload(directService, buffer, filename, mime);
          return sendResult(sock, m, url, filename, sizeMB, note);
        } catch (err) {
          console.warn(`[upload] ${directService} failed: ${err.message}`);
          if (directService === 'catbox' && /412|413|reject/i.test(err.message)) {
            await m.reply('⚠️ Catbox rejected — trying GoFile…');
            try {
              const { url, note } = await doUpload('gofile', buffer, filename, mime);
              return sendResult(sock, m, url, filename, sizeMB, note + ' (fallback from Catbox)');
            } catch (e2) {
              await m.reply('⚠️ GoFile failed — trying TmpFiles…');
              try {
                const { url, note } = await doUpload('tmpfiles', buffer, filename, mime);
                return sendResult(sock, m, url, filename, sizeMB, note + ' (fallback from Catbox)');
              } catch {}
            }
          }
          await m.react('❌'); m._failed = true;
          return m.reply(`❌ Upload to ${SERVICES[directService].label} failed: ${err.message}`);
        }
      }

      // ── No specific service: branch on buttons mode ───────────────────────────
      if (isEnabled('useButtons')) {
        // BUTTONS MODE — store state, show service picker
        const ts = String(Date.now());
        pending.set(ts, { buffer, filename, sizeMB, mime, m });
        setTimeout(() => pending.delete(ts), 300_000);

        await sendBtnOrText(sock, m.from, {
          title:   '☁️ Upload — Pick a Service',
          text:    `📁 *File:* \`${filename}\`\n📊 *Size:* ${sizeMB} MB\n\n*Select upload destination:*`,
          footer:  getFooter(),
          buttons: [
            { id: `upload:catbox:${ts}`,   text: '📦 Catbox (permanent)' },
            { id: `upload:gofile:${ts}`,   text: '🗂️ GoFile (permanent)' },
            { id: `upload:fileio:${ts}`,   text: '🔗 File.io (1 download)' },
            { id: `upload:tmpfiles:${ts}`, text: '⏱ TmpFiles (1 hour)' },
          ],
        });
        await m.react('✅');

      } else {
        // NON-BUTTONS MODE — auto-fallback catbox → gofile → tmpfiles
        const chain = [
          { svc: 'catbox',   label: 'Catbox'   },
          { svc: 'gofile',   label: 'GoFile'   },
          { svc: 'tmpfiles', label: 'TmpFiles' },
        ];
        const errors = [];
        let uploaded = false;
        for (const { svc, label } of chain) {
          await m.reply(`☁️ Uploading to ${label}…`);
          try {
            const { url, note } = await doUpload(svc, buffer, filename, mime);
            uploaded = true;
            return sendResult(sock, m, url, filename, sizeMB, note);
          } catch (err) {
            errors.push(`${label}: ${err.message}`);
            console.warn(`[upload] ${label} failed, trying next — ${err.message}`);
          }
        }
        if (!uploaded) {
          await m.react('❌'); m._failed = true;
          return m.reply(`❌ All upload services failed:\n${errors.join('\n')}`);
        }
      }

    } catch (err) {
      console.error('[upload] error:', err.message);
      await m.react('❌'); m._failed = true;
      return m.reply(`❌ Upload failed: ${err.message}`);
    }
  },
};
