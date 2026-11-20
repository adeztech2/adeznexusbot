import { isSuperUser } from "../../lib/database/sudo.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function dig(obj, ...keys) {
  for (const k of keys) if (obj?.[k] !== undefined) return obj[k];
  return undefined;
}

/**
 * Reconstruct a minimal WAMessage from m.quoted so sock.sendMessage can
 * forward it.  Works for every type because it carries the original payload.
 */
function buildForwardable(m) {
  return {
    key: {
      remoteJid: m.from,
      id: m.quoted.id || m.quoted.stanzaId,
      fromMe: m.quoted.fromMe || false,
      participant: m.quoted.sender || undefined,
    },
    message: m.quoted.message,
  };
}

// ── command ───────────────────────────────────────────────────────────────────

export default {
  name: "save",
  aliases: ["sv", "sav", "."],
  description: "Save any quoted message to your DM",
  usage: "save  (reply to any message)",
  category: "owner",
  owner: false,
  group: false,
  private: false,

  async execute(sock, m) {
    if (!(await isSuperUser(m.sender, sock)))
      return m.reply("❌ Owner / sudo only.");
    if (!m.quoted) return m.reply("⚠️ Reply to a message first.");

    const q = m.quoted.message || {};
    const keys = Object.keys(q);

    // unwrap wrapper layers
    const inner =
      q.ephemeralMessage?.message ||
      q.viewOnceMessage?.message ||
      q.viewOnceMessageV2?.message ||
      q.viewOnceMessageV2Extension?.message ||
      q.documentWithCaptionMessage?.message ||
      q.editedMessage?.message?.protocolMessage?.editedMessage?.message ||
      null;

    const active = inner || q;
    const aKeys = Object.keys(active);

    await m.react("⚡");

    try {
      // ── TEXT ─────────────────────────────────────────────────────────────────
      const textBody =
        active.conversation ||
        active.extendedTextMessage?.text ||
        active.buttonsResponseMessage?.selectedDisplayText ||
        active.templateButtonReplyMessage?.selectedDisplayText ||
        active.listResponseMessage?.singleSelectReply?.selectedRowId;

      if (
        !aKeys.some((k) =>
          [
            "imageMessage",
            "videoMessage",
            "audioMessage",
            "stickerMessage",
            "documentMessage",
          ].includes(k),
        ) &&
        textBody
      ) {
        await sock.sendMessage(m.sender, { text: textBody });
        return m.react("✅");
      }

      // ── IMAGE ────────────────────────────────────────────────────────────────
      if (active.imageMessage) {
        const buf = await m.quoted.download();
        await sock.sendMessage(m.sender, {
          image: buf,
          caption: active.imageMessage.caption || "",
        });
        return m.react("✅");
      }

      // ── VIDEO / GIF ───────────────────────────────────────────────────────────
      if (active.videoMessage) {
        const buf = await m.quoted.download();
        await sock.sendMessage(m.sender, {
          video: buf,
          caption: active.videoMessage.caption || "",
          gifPlayback: active.videoMessage.gifPlayback || false,
        });
        return m.react("✅");
      }

      // ── AUDIO / VOICE NOTE ────────────────────────────────────────────────────
      if (active.audioMessage) {
        const buf = await m.quoted.download();
        await sock.sendMessage(m.sender, {
          audio: buf,
          mimetype: active.audioMessage.mimetype || "audio/ogg; codecs=opus",
          ptt: active.audioMessage.ptt || false,
        });
        return m.react("✅");
      }

      // ── STICKER ───────────────────────────────────────────────────────────────
      if (active.stickerMessage) {
        const buf = await m.quoted.download();
        await sock.sendMessage(m.sender, { sticker: buf });
        return m.react("✅");
      }

      // ── DOCUMENT ─────────────────────────────────────────────────────────────
      if (active.documentMessage) {
        const buf = await m.quoted.download();
        await sock.sendMessage(m.sender, {
          document: buf,
          fileName: active.documentMessage.fileName || "document",
          mimetype:
            active.documentMessage.mimetype || "application/octet-stream",
          caption: active.documentMessage.caption || "",
        });
        return m.react("✅");
      }

      // ── CONTACT CARD ─────────────────────────────────────────────────────────
      if (active.contactMessage) {
        await sock.sendMessage(m.sender, {
          contacts: { contacts: [{ vcard: active.contactMessage.vcard }] },
        });
        return m.react("✅");
      }

      // ── CONTACT ARRAY ─────────────────────────────────────────────────────────
      if (active.contactsArrayMessage) {
        await sock.sendMessage(m.sender, {
          contacts: { contacts: active.contactsArrayMessage.contacts },
        });
        return m.react("✅");
      }

      // ── LOCATION ─────────────────────────────────────────────────────────────
      if (active.locationMessage) {
        const loc = active.locationMessage;
        await sock.sendMessage(m.sender, {
          location: {
            degreesLatitude: loc.degreesLatitude,
            degreesLongitude: loc.degreesLongitude,
          },
        });
        return m.react("✅");
      }

      // ── LIVE LOCATION ─────────────────────────────────────────────────────────
      if (active.liveLocationMessage) {
        const loc = active.liveLocationMessage;
        await sock.sendMessage(m.sender, {
          location: {
            degreesLatitude: loc.degreesLatitude,
            degreesLongitude: loc.degreesLongitude,
          },
        });
        return m.react("✅");
      }

      // ── BUTTONS / INTERACTIVE (extract display text) ──────────────────────────
      const btnText =
        active.buttonsMessage?.contentText ||
        active.templateMessage?.hydratedTemplate?.hydratedContentText ||
        active.listMessage?.description ||
        active.interactiveMessage?.body?.text;

      if (btnText) {
        await sock.sendMessage(m.sender, { text: btnText });
        return m.react("✅");
      }

      // ── FALLBACK: forward the whole message as-is ──────────────────────────────
      await sock.sendMessage(m.sender, { forward: buildForwardable(m) });
      return m.react("✅");
    } catch (err) {
      console.error("[save] error:", err.message);
      await m.react("❌");
      return m.reply(`❌ Save failed: ${err.message}`);
    }
  },
};
