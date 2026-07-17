// lib/radar/core/CacheManager.js
class CacheManager {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlSeconds = 60) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  clear(key) {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }
}

export const cache = new CacheManager();
