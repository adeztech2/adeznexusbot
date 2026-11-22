// Tiny in-memory store for games that span several messages (trivia, hangman...).
// State is per chat and expires on its own; it is lost on restart, which is fine for casual games.
const games = new Map();

const key = (chat, kind) => `${chat}:${kind}`;

export function setGame(chat, kind, data, ttlMs = 120_000) {
  const now = Date.now();
  for (const [k, g] of games) if (g.expires + 600_000 < now) games.delete(k); // drop long-dead games
  games.set(key(chat, kind), { ...data, expires: now + ttlMs });
}

/** Returns the game (with `expired: true` if its time ran out; it is then removed) or null. */
export function getGame(chat, kind) {
  const g = games.get(key(chat, kind));
  if (!g) return null;
  if (g.expires < Date.now()) {
    games.delete(key(chat, kind));
    return { ...g, expired: true };
  }
  return g;
}

export function clearGame(chat, kind) {
  games.delete(key(chat, kind));
}
