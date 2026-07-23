// lib/radar/core/DataProvider.js
// ============================================================
// RadarAZ v20.2 - Data Provider (Polygon Only)
// ✅ STABILITY FIX: getUniverse no longer collapses to 0 pre-market.
//    Root cause: the mapping used `d.v ?? 0` for volume (no fallback) and
//    the filter required `volume > 0`. Before the US open, Polygon's `day`
//    object is zeroed (session hasn't started), so every stock had volume 0
//    and was dropped → "Loaded 0 stocks". Fix: fall back to prevDay volume
//    (and prevDay close for price/open/high/low), and filter on price only.
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

// ─── RateLimiter Adaptive ──────────────────────────────────
class RateLimiter {
  constructor(maxConcurrent = 5, rateLimitPerMinute = 300) {
    this.maxConcurrent = maxConcurrent;
    this.rateLimitPerMinute = rateLimitPerMinute;
    this.running = 0;
    this.queue = [];
    this.totalRequests = 0;
    this.lastReset = Date.now();
    this.lastDelay = 0;
  }

  async execute(fn) {
    if (Date.now() - this.lastReset > 60000) {
      this.totalRequests = 0;
      this.lastReset = Date.now();
      this.lastDelay = 0;
    }

    const usage = this.totalRequests / this.rateLimitPerMinute;
    let delay = 0;
    if (usage > 0.8) {
      delay = Math.min(300, 50 + (usage - 0.8) * 500);
      this.lastDelay = delay;
    }

    if (this.running >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.running++;
    this.totalRequests++;

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      return await fn();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  getStats() {
    return {
      running: this.running,
      queueLength: this.queue.length,
      totalRequestsLastMinute: this.totalRequests,
      lastDelay: this.lastDelay,
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────
let instance = null;

export class DataProvider {
  constructor() {
    if (instance) return instance;
    this.cache = new LRUCache(500);
    this.dailyCache = new LRUCache(200);
    // ✅ FIX: circuit breakers are now keyed per-symbol (or per-endpoint for
    // symbol-less calls like getUniverse), instead of one shared instance.
    this.circuitBreakers = new Map();
    this.rateLimiter = new RateLimiter(5, 300);
    instance = this;
  }

  _getBreaker(key) {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker({ failureThreshold: 3, timeout: 60000 }));
    }
    return this.circuitBreakers.get(key);
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
    if (type === 'daily') return isOpen ? 300 : 3600;
    if (type === 'market') return isOpen ? 20 : 3600;
    if (type === 'news') return 3600;
    return isOpen ? 60 : 3600;
  }

  // ─── getUniverse ──────────────────────────────────────────
  async getUniverse() {
    const cacheKey = 'universe';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (!POLYGON_KEY) throw new Error('POLYGON_API_KEY is missing.');

    try {
      const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`;
      const data = await this._getBreaker('universe').execute(() =>
        fetchWithRetry(url, 8000, 3)
      );
      const tickers = data?.tickers || [];
      if (tickers.length === 0) throw new Error('No tickers returned.');

      // 🔍 DEBUG: طباعة أول سهم من Polygon
      console.log('🔍 [DEBUG] First ticker from Polygon:', JSON.stringify(tickers[0], null, 2));
      console.log('🔍 [DEBUG] day:', JSON.stringify(tickers[0]?.day, null, 2));
      console.log('🔍 [DEBUG] prevDay:', JSON.stringify(tickers[0]?.prevDay, null, 2));
      console.log('🔍 [DEBUG] lastTrade:', JSON.stringify(tickers[0]?.lastTrade, null, 2));
      console.log('🔍 [DEBUG] min:', JSON.stringify(tickers[0]?.min, null, 2));

      const result = tickers.map(t => {
        const d = t.day || {};
        const pd = t.prevDay || {};
        const min = t.min || {};

        // ✅ STABILITY: multi-layer fallback so values are never 0 just because
        // the current session hasn't started yet (pre-market) or `day` is
        // sparse. Priority for price: today's close → last trade → last minute
        // close → prev-day close. For volume: today's volume → prev-day volume.
        const price =
          (d.c && d.c > 0 ? d.c : 0) ||
          (t.lastTrade?.p && t.lastTrade.p > 0 ? t.lastTrade.p : 0) ||
          (min.c && min.c > 0 ? min.c : 0) ||
          (pd.c && pd.c > 0 ? pd.c : 0) ||
          0;

        // Volume: prefer today's; before the open it's 0, so fall back to the
        // previous completed session's volume (a sensible liquidity proxy).
        const volume =
          (d.v && d.v > 0 ? d.v : 0) ||
          (pd.v && pd.v > 0 ? pd.v : 0) ||
          0;

        // Open/high/low/prevClose: fall back to prevDay when today is empty.
        const open = (d.o && d.o > 0 ? d.o : 0) || (pd.o && pd.o > 0 ? pd.o : 0) || price;
        const high = (d.h && d.h > 0 ? d.h : 0) || (pd.h && pd.h > 0 ? pd.h : 0) || price;
        const low  = (d.l && d.l > 0 ? d.l : 0) || (pd.l && pd.l > 0 ? pd.l : 0) || price;
        const prevClose = (d.pc && d.pc > 0 ? d.pc : 0) || (pd.c && pd.c > 0 ? pd.c : 0) || price;

        return {
          symbol: t.ticker,
          price,
          volume,
          change_pct: t.todaysChangePerc ?? 0,
          dollar_vol: price * volume,
          vwap: d.vw ?? min.vw ?? null,
          open,
          high,
          low,
          prevClose,
          lastTrade: t.lastTrade?.p ?? 0,
          lastTradeTime: t.lastTrade?.t ?? null,
          avgVolume: volume,
        };
      })
      // ✅ STABILITY: filter on price only. Requiring volume > 0 here was what
      // collapsed the whole universe to 0 before the open. Downstream filters
      // (FilterEngine minVolume/minDollarVol) still enforce liquidity during
      // market hours, so quality is unaffected when it matters.
      .filter(s => s.price > 0);

      // 🔍 DEBUG: طباعة أول عنصر بعد الـ mapping
      console.log('🔍 [DEBUG] First mapped:', JSON.stringify(result[0], null, 2));

      this.cache.set(cacheKey, result, this._getTTL('universe'));
      console.log(`✅ Loaded ${result.length} stocks.`);
      return result;
    } catch (error) {
      console.error('❌ Error fetching universe:', error.message);
      throw new Error(`Failed to fetch universe: ${error.message}`);
    }
  }

  // ─── getBars ──────────────────────────────────────────────
  async getBars(symbol, options = {}) {
    const { timeframe = '5', limit = 30, adjusted = true, minRequired = 10 } = options;

    const isDaily = timeframe === 'day';
    const cacheStore = isDaily ? this.dailyCache : this.cache;
    const cacheKey = `bars_${symbol}_${timeframe}_${limit}_${adjusted}`;
    const BARS_CACHE_DISABLED = false;
    if (!BARS_CACHE_DISABLED) {
      const cached = cacheStore.get(cacheKey);
      if (cached) return cached;
    }

    if (!POLYGON_KEY) throw new Error('POLYGON_API_KEY is missing.');

    return this.rateLimiter.execute(async () => {
      try {
        const now = new Date();
        const from = new Date(now);

        let daysBack;
        if (timeframe === 'day') {
          daysBack = Math.max(limit * 1.5, 90);
        } else {
          const barsPerDay = timeframe === '60' ? 7 : Math.floor(390 / parseInt(timeframe));
          const tradingDaysNeeded = Math.ceil(Math.min(limit, 120) / Math.max(barsPerDay, 1)) + 3;
          daysBack = Math.min(Math.ceil(tradingDaysNeeded * 1.5), 45);
          daysBack = Math.max(daysBack, 5);
        }
        from.setDate(from.getDate() - daysBack);

        const fromStr = from.toISOString().split('T')[0];
        const toStr = now.toISOString().split('T')[0];
        const multiplier = timeframe === 'day' ? 1 : parseInt(timeframe);
        const timespan = timeframe === 'day' ? 'day' : 'minute';

        const effectiveLimit = timeframe === 'day' ? limit : Math.min(limit, 120);
        const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromStr}/${toStr}?adjusted=${adjusted}&sort=desc&limit=${effectiveLimit}&apiKey=${POLYGON_KEY}`;

        const data = await this._getBreaker(symbol).execute(() =>
          fetchWithRetry(url, 5000, 2)
        );
        // Polygon returned newest-first; reverse to oldest-first (chronological).
        const results = (data?.results || []).slice().reverse();

        if (results.length < minRequired) {
          console.warn(`⚠️ ${symbol}: فقط ${results.length} شمعة (مطلوب ${minRequired})`);
          cacheStore.set(cacheKey, results, 300);
          return results;
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

        console.log(`📊 [getBars] ${symbol} (${timeframe}) limit=${limit}, results=${results.length}, daysBack=${daysBack}, from=${fromStr}, to=${toStr}`);

        const ttl = isDaily ? this._getTTL('daily') : this._getTTL('bars');
        cacheStore.set(cacheKey, bars, ttl);
        return bars;
      } catch (error) {
        console.warn(`⚠️ Failed bars for ${symbol}:`, error.message);
        return [];
      }
    });
  }

  // ─── getTicker ────────────────────────────────────────────
  async getTicker(symbol) {
    const cacheKey = `ticker_${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (!POLYGON_KEY) throw new Error('POLYGON_API_KEY is missing.');

    return this.rateLimiter.execute(async () => {
      try {
        const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/${symbol}?apiKey=${POLYGON_KEY}`;
        const data = await this._getBreaker(symbol).execute(() =>
          fetchWithRetry(url, 3000, 2)
        );
        if (!data) throw new Error(`No data for ${symbol}`);

        // Snapshot for a single ticker nests under data.ticker
        const tk = data.ticker || data;
        const d = tk.day || {};
        const pd = tk.prevDay || {};
        const last = tk.lastTrade || {};

        const price = (d.c && d.c > 0 ? d.c : 0) || (last.p && last.p > 0 ? last.p : 0) || (pd.c && pd.c > 0 ? pd.c : 0) || 0;
        const volume = (d.v && d.v > 0 ? d.v : 0) || (pd.v && pd.v > 0 ? pd.v : 0) || 0;

        const result = {
          symbol,
          price,
          volume,
          change_pct: tk.todaysChangePerc ?? 0,
          dollar_vol: price * volume,
          vwap: d.vw ?? null,
          open: (d.o && d.o > 0 ? d.o : 0) || (pd.o ?? 0) || price,
          high: (d.h && d.h > 0 ? d.h : 0) || (pd.h ?? 0) || price,
          low: (d.l && d.l > 0 ? d.l : 0) || (pd.l ?? 0) || price,
          prevClose: (d.pc && d.pc > 0 ? d.pc : 0) || (pd.c ?? 0) || price,
          lastTrade: last.p ?? 0,
          lastTradeTime: last.t ?? null,
          avgVolume: volume,
        };

        this.cache.set(cacheKey, result, this._getTTL('universe'));
        return result;
      } catch (error) {
        console.error(`❌ Error fetching ${symbol}:`, error.message);
        throw error;
      }
    });
  }

  // ─── getMarketData ────────────────────────────────────────
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
          const tk = data.ticker || data;
          const d = tk.day || {};
          const pd = tk.prevDay || {};
          const last = tk.lastTrade || {};
          const price = (d.c && d.c > 0 ? d.c : 0) || (last.p ?? 0) || (pd.c ?? 0) || 0;
          dataMap[symbol] = {
            price,
            vwap: d.vw ?? 0,
            change: tk.todaysChangePerc ?? 0,
            open: d.o ?? pd.o ?? 0,
            high: d.h ?? pd.h ?? 0,
            low: d.l ?? pd.l ?? 0,
            volume: d.v ?? pd.v ?? 0,
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

  // ─── getNews ──────────────────────────────────────────────
  async getNews(symbol, limit = 1) {
    const cacheKey = `news_${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (!POLYGON_KEY) return [];

    try {
      const url = `https://api.polygon.io/v2/reference/news?ticker=${symbol}&limit=${limit}&apiKey=${POLYGON_KEY}`;
      const data = await this._getBreaker(symbol).execute(() =>
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

  // ─── getSectorData ────────────────────────────────────────
  async getSectorData(symbol) {
    return null;
  }

  getRateLimiterStats() {
    return this.rateLimiter.getStats();
  }

  clearCache() {
    this.cache.clear();
    this.dailyCache.clear();
  }

  resetCircuitBreaker() {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
  }
}

export const dataProvider = new DataProvider();
