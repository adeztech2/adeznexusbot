import { getSetting, isEnabled } from './database/settings.js';

// The "Forwarded from <channel>" label shown on some bot messages.
// Owner controls it with the .forward command:
//   forwarding   on/off
//   newsletterJid  channel to show (empty = use the channel from channelUrl)
//   forwardName  name shown on the label (empty = bot name)

let resolvedJid = '';

/** Remembered when the channel JID is worked out from channelUrl at startup. */
export function setResolvedNewsletterJid(jid) {
  resolvedJid = jid || '';
}

/** The channel JID currently used for the label ('' if none is known yet). */
export function getForwardChannel() {
  const raw = (getSetting('newsletterJid') || '').trim() || resolvedJid;
  if (!raw) return '';
  return raw.endsWith('@newsletter') ? raw : `${raw}@newsletter`;
}

/** The name currently shown on the label. */
export function getForwardName() {
  return (getSetting('forwardName') || '').trim() || getSetting('botName') || 'ADEZ NEXUS';
}

/** Fields to spread into a contextInfo object. Empty when forwarding is off. */
export function getForwardFields(score = 5, serverMessageId = 143) {
  if (!isEnabled('forwarding')) return {};
  const newsletterJid = getForwardChannel();
  if (!newsletterJid) return {};
  return {
    forwardingScore: score,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid,
      newsletterName: getForwardName(),
      serverMessageId,
    },
  };
}

/** A complete contextInfo: your own fields plus the forwarding label. */
export function getForwardContext(extra = {}, score = 5, serverMessageId = 143) {
  return { ...extra, ...getForwardFields(score, serverMessageId) };
}
