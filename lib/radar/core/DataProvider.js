// lib/radar/core/DataProvider.js
// ============================================================
// RadarAZ v20.1 - Data Provider (Polygon Only)
// ✅ Singleton Pattern
// ✅ LRU Cache
// ✅ Retry + Backoff
// ✅ Circuit Breaker
// ✅ Adaptive TTL
// ============================================================

const POLYGON_KEY = process.env.POLYGON_API_KEY || process.env.POLYGON_KEY;

if (!POLYGON_KEY) {
  console.warn('⚠️ POLYGON_API_KEY is not set.');
}

// ─── LRU Cache ──────────────────────────────────────────────
class LRUCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.data;
  }

  set(key, data, ttl) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, expiry: Date.now() + ttl * 1000 });
  }

  clear() {
    this.cache.clear();
  }
}

// ─── Circuit Breaker ────────────────────────────────────────
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.timeout = options.timeout || 30000;
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.failures = 0;
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      throw error;
    }
  }

  reset() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}

// ─── Retry + Backoff ────────────────────────────────────────
const fetchWithRetry = async (url, timeoutMs = 5000, maxRetries = 3) => {
  let lastError;
  let delay = 500;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);

      if (res.status === 429) {
        await new Promise(r => setTimeout(r, delay * 2));
        delay *= 2;
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delay));
        delay *= 1.5;
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
};

// ─── Singleton ──────────────────────────────────────────────
let instance = null;

export class DataProvider {
  constructor() {
    if (instance) return instance;
    this.cache = new LRUCache(500);
    this.circuitBreaker = new CircuitBreaker({ failureThreshold: 3, timeout: 60000 });
    instance = this;
  }

  _isMarketOpen() {
    const now = new Date();
    const day = now.getUTCDay();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    if (day === 0 || day === 6) return false;
    const totalMinutes = hours * 60 + minutes;
    return totalMinutes >= 570 && totalMinutes < 960;
  }

  _getTTL(type) {
    const isOpen = this._isMarketOpen();
    if (type === 'universe') return isOpen ? 30 : 3600;
    if (type === 'bars') return isOpen ? 60 : 3600;
    if (type === 'market') return isOpen ? 20 : 3600;
    if (type === 'news') return 3600;
    return isOpen ? 60 : 3600;
  }

  async getUniverse() {
    const cacheKey = 'universe';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (!POLYGON_KEY) throw new Error('POLYGON_API_KEY is missing.');

    try {
      const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`;
      const data = await this.circuitBreaker.execute(() =>
        fetchWithRetry(url, 8000, 3)
      );
      const tickers = data?.tickers || [];
      if (tickers.length === 0) throw new Error('No tickers returned.');

      const result = tickers.map(t => {
        const d = t.day || {};
        return {
          symbol: t.ticker,
          price: d.c ?? t.lastTrade?.p ?? 0,
          volume: d.v ?? 0,
          change_pct: t.todaysChangePerc ?? 0,
          dollar_vol: (d.c ?? 0) * (d.v ?? 0),
          vwap: d.vw ?? null,
          open: d.o ?? 0,
          high: d.h ?? 0,
          low: d.l ?? 0,
          prevClose: d.pc ?? 0,
          lastTrade: t.lastTrade?.p ?? 0,
          lastTradeTime: t.lastTrade?.t ?? null,
        };
      }).filter(s => s.price > 0 && s.volume > 0);

      this.cache.set(cacheKey, result, this._getTTL('universe'));
      console.log(`✅ Loaded ${result.length} stocks.`);
      return result;
    } catch (error) {
      console.error('❌ Error fetching universe:', error.message);
      throw new Error(`Failed to fetch universe: ${error.message}`);
    }
  }

  async getBars(symbol, options = {}) {
    const { timeframe = '5', limit = 30, adjusted = true } = options;
    const cacheKey = `bars_${symbol}_${timeframe}_${limit}_${adjusted}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (!POLYGON_KEY) throw new Error('POLYGON_API_KEY is missing.');

    try {
      const now = new Date();
      const from = new Date(now);
      if (timeframe === 'day') {
        from.setDate(from.getDate() - 90);
      } else {
        from.setDate(from.getDate() - 5);
      }

      const fromStr = from.toISOString().split('T')[0];
      const toStr = now.toISOString().split('T')[0];
      const multiplier = parseInt(timeframe);
      const timespan = timeframe === 'day' ? 'day' : 'minute';

      const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromStr}/${toStr}?adjusted=${adjusted}&sort=asc&limit=${limit}&apiKey=${POLYGON_KEY}`;

      const data = await this.circuitBreaker.execute(() =>
        fetchWithRetry(url, 5000, 2)
      );
      const results = data?.results || [];
      if (results.length === 0) {
        this.cache.set(cacheKey, [], 300);
        return [];
      }

      const bars = results.map(r => ({
        open: r.o ?? 0,
        high: r.h ?? 0,
        low: r.l ?? 0,
        close: r.c ?? 0,
        volume: r.v ?? 0,
        timestamp: new Date(r.t).toISOString(),
        vwap: r.vw ?? 0,
      }));

      this.cache.set(cacheKey, bars, this._getTTL('bars'));
      return bars;
    } catch (error) {
      console.warn(`⚠️ Failed bars for ${symbol}:`, error.message);
      return [];
    }
  }

  async getTicker(symbol) {
    const cacheKey = `ticker_${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (!POLYGON_KEY) throw new Error('POLYGON_API_KEY is missing.');

    try {
      const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/${symbol}?apiKey=${POLYGON_KEY}`;
      const data = await this.circuitBreaker.execute(() =>
        fetchWithRetry(url, 3000, 2)
      );
      if (!data) throw new Error(`No data for ${symbol}`);

      const d = data.day || {};
      const last = data.lastTrade || {};
      const result = {
        symbol,
        price: d.c ?? last.p ?? 0,
        volume: d.v ?? 0,
        change_pct: data.todaysChangePerc ?? 0,
        dollar_vol: (d.c ?? 0) * (d.v ?? 0),
        vwap: d.vw ?? null,
        open: d.o ?? 0,
        high: d.h ?? 0,
        low: d.l ?? 0,
        prevClose: d.pc ?? 0,
        lastTrade: last.p ?? 0,
        lastTradeTime: last.t ?? null,
      };

      this.cache.set(cacheKey, result, this._getTTL('universe'));
      return result;
    } catch (error) {
      console.error(`❌ Error fetching ${symbol}:`, error.message);
      throw error;
    }
  }

  async getMarketData() {
    const cacheKey = 'market_data';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (!POLYGON_KEY) throw new Error('POLYGON_API_KEY is missing.');

    const indices = ['SPY', 'QQQ', 'IWM', 'VIX'];

    try {
      const jobs = indices.map(symbol =>
        fetchWithRetry(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/${symbol}?apiKey=${POLYGON_KEY}`, 3000, 2)
          .then(data => ({ symbol, data }))
          .catch(() => ({ symbol, data: null }))
      );

      const results = await Promise.allSettled(jobs);
      const dataMap = {};

      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.data) {
          const { symbol, data } = r.value;
          const d = data.day || {};
          const last = data.lastTrade || {};
          dataMap[symbol] = {
            price: d.c ?? last.p ?? 0,
            vwap: d.vw ?? 0,
            change: data.todaysChangePerc ?? 0,
            open: d.o ?? 0,
            high: d.h ?? 0,
            low: d.l ?? 0,
            volume: d.v ?? 0,
          };
        }
      });

      const result = {
        spy: dataMap.SPY || { price: 0, vwap: 0, change: 0 },
        qqq: dataMap.QQQ || { price: 0, vwap: 0, change: 0 },
        iwm: dataMap.IWM || { price: 0, vwap: 0, change: 0 },
        vix: dataMap.VIX || { price: 0 },
        regime: this._determineRegime(dataMap.SPY),
        timestamp: new Date().toISOString(),
      };

      this.cache.set(cacheKey, result, this._getTTL('market'));
      return result;
    } catch (error) {
      console.error('❌ Market data error:', error.message);
      return {
        spy: { price: 0, vwap: 0, change: 0 },
        qqq: { price: 0, vwap: 0, change: 0 },
        iwm: { price: 0, vwap: 0, change: 0 },
        vix: { price: 0 },
        regime: 'neutral',
        timestamp: new Date().toISOString(),
      };
    }
  }

  _determineRegime(spy) {
    if (!spy) return 'neutral';
    const price = spy.price || 0;
    const vwap = spy.vwap || 0;
    if (price > vwap * 1.01) return 'strong';
    if (price > vwap * 0.99) return 'neutral';
    return 'weak';
  }

  async getNews(symbol, limit = 1) {
    const cacheKey = `news_${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (!POLYGON_KEY) return [];

    try {
      const url = `https://api.polygon.io/v2/reference/news?ticker=${symbol}&limit=${limit}&apiKey=${POLYGON_KEY}`;
      const data = await this.circuitBreaker.execute(() =>
        fetchWithRetry(url, 3000, 2)
      );
      const articles = data?.results || [];
      const result = articles.map(a => ({
        title: a.title || '',
        source: a.publisher?.name || '',
        published: a.published_utc || '',
        url: a.article_url || '',
        ageHours: a.published_utc ? Math.round((Date.now() - new Date(a.published_utc)) / 3600000) : null,
      }));

      this.cache.set(cacheKey, result, this._getTTL('news'));
      return result;
    } catch (error) {
      console.warn(`⚠️ News failed for ${symbol}:`, error.message);
      return [];
    }
  }

  async getSectorData(symbol) {
    return null;
  }

  clearCache() {
    this.cache.clear();
  }

  resetCircuitBreaker() {
    this.circuitBreaker.reset();
  }
}

export const dataProvider = new DataProvider();
