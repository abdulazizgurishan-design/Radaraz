// lib/radar/core/DataProvider.js
const ALPACA_DATA = "https://data.alpaca.markets";
const POLYGON_KEY = process.env.POLYGON_API_KEY || process.env.POLYGON_KEY;

const H = {
  "APCA-API-KEY-ID": process.env.ALPACA_KEY,
  "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET,
};

// Cache مؤقت بسيط
const cache = new Map();
const CACHE_TTL = 300; // 5 دقائق

const getCache = (key) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL * 1000) {
    return hit.data;
  }
  return null;
};

const setCache = (key, data) => {
  if (cache.size > 300) cache.clear();
  cache.set(key, { data, time: Date.now() });
};

const fetchJson = async (url, timeoutMs, headers) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(id);
    return null;
  }
};

export class DataProvider {
  constructor() {
    this.cache = cache;
  }

  // ─── Market Data ──────────────────────────────────────
  async getMarketData() {
    const cacheKey = 'market_data';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      const [spy, qqq, iwm, vix] = await Promise.all([
        fetchJson(`${ALPACA_DATA}/v2/stocks/SPY/snapshot`, 2000, { headers: H }),
        fetchJson(`${ALPACA_DATA}/v2/stocks/QQQ/snapshot`, 2000, { headers: H }),
        fetchJson(`${ALPACA_DATA}/v2/stocks/IWM/snapshot`, 2000, { headers: H }),
        fetchJson(`${ALPACA_DATA}/v2/stocks/VIX/snapshot`, 2000, { headers: H }),
      ]);

      const result = {
        spy: {
          price: spy?.latestTrade?.p || spy?.minuteBar?.c || 0,
          vwap: spy?.dailyBar?.vw || 0,
          change: spy?.todaysChangePerc || 0,
        },
        qqq: {
          price: qqq?.latestTrade?.p || qqq?.minuteBar?.c || 0,
          vwap: qqq?.dailyBar?.vw || 0,
          change: qqq?.todaysChangePerc || 0,
        },
        iwm: {
          price: iwm?.latestTrade?.p || iwm?.minuteBar?.c || 0,
          vwap: iwm?.dailyBar?.vw || 0,
          change: iwm?.todaysChangePerc || 0,
        },
        vix: {
          price: vix?.latestTrade?.p || vix?.minuteBar?.c || 0,
        },
        regime: this._determineRegime(spy),
        timestamp: new Date().toISOString(),
      };

      setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Market Data Provider Error:', error.message);
      return null;
    }
  }

  _determineRegime(spy) {
    const price = spy?.latestTrade?.p || spy?.minuteBar?.c || 0;
    const vwap = spy?.dailyBar?.vw || 0;
    if (price > vwap * 1.01) return 'strong';
    if (price > vwap * 0.99) return 'neutral';
    return 'weak';
  }

  // ─── Bars Data ─
