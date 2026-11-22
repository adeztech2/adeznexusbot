// Pure helpers for group moderation — no external dependencies.

export function numOf(jid) {
  return (jid || '').split('@')[0].split(':')[0];
}

const INVITE_RE =
  /(?:chat\.whatsapp\.com\/[A-Za-z0-9]{8,}|whatsapp\.com\/(?:channel|invite)\/[A-Za-z0-9]+)/i;

const ANY_LINK_RE =
  /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|me|xyz|co|link|gg|ly|app|dev|info|site|online|biz|tk|ml|ru|tv)\b/i;

/**
 * @param {string} text
 * @param {'all'|'invites'} type  'invites' = WhatsApp group/channel invite links only
 */
export function containsLink(text, type = 'all') {
  if (!text) return false;
  return type === 'invites' ? INVITE_RE.test(text) : (INVITE_RE.test(text) || ANY_LINK_RE.test(text));
}

/**
 * Placeholders: @user  {group}  {count}  {desc}
 */
export function renderTemplate(tpl, { jid, group = '', count = '', desc = '' }) {
  return String(tpl)
    .split('@user').join(`@${numOf(jid)}`)
    .split('{group}').join(group)
    .split('{count}').join(String(count))
    .split('{desc}').join(desc);
}

export const DEFAULT_WELCOME = '👋 Welcome @user to *{group}*!\nYou are member #{count}.';
export const DEFAULT_GOODBYE = '👋 @user has left *{group}*. Goodbye!';
