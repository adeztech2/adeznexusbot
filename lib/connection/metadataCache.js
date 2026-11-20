import { getCachedGroup, setCachedGroup } from './groupCache.js';

/**
 * MetadataCache — uses the shared Baileys-populated groupCache as first
 * lookup layer; only calls sock.groupMetadata() on a true miss or when
 * the entry is older than the TTL.
 */
class MetadataCache {
  constructor() {
    this.ttl        = 5 * 60 * 1000; // 5-minute freshness window
    this.timestamps = new Map();
  }

  async get(sock, groupJid) {
    const now    = Date.now();
    const ts     = this.timestamps.get(groupJid) || 0;
    const cached = getCachedGroup(groupJid);

    if (cached && (now - ts) < this.ttl) return cached;

    // Cache miss or stale — fetch fresh from WhatsApp
    const metadata = await sock.groupMetadata(groupJid);
    setCachedGroup(groupJid, metadata);
    this.timestamps.set(groupJid, now);
    return metadata;
  }

  invalidate(groupJid) {
    this.timestamps.delete(groupJid);
  }

  clear() {
    this.timestamps.clear();
  }
}

export const metadataCache = new MetadataCache();
