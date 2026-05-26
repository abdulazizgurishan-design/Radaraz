const POLYGON_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";
const BASE = "https://api.polygon.io";

async function fetchEMA(ticker, window) {
  try {
    const url = `${BASE}/v1/indicators/ema/${ticker}?timespan=day&adjusted=true&window=${window}&series_type=close&limit=1&apiKey=${POLYGON_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.results?.values?.[0]?.value ?? null;
  } catch { return null; }
}

async function fetchAvgVolume(ticker) {
  try {
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const url  = `${BASE}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=desc&limit=20&apiKey=${POLYGON_KEY}`;
    const r    = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    const bars = d?.results;
    if (!bars || bars.length < 5) return null;
    return bars.reduce((s, b) => s + b.v, 0) / bars.length;
  } catch { return null; }
}

export default async function handler(req, res) {
  try {
    // ── 1. جلب أكثر الأسهم تداولاً عبر gainers/losers ──────────────────
    const today = new Date().toISOString().slice(0, 10);

    // جلب Gainers و Losers و Most Active
    const [gainersRes, losersRes, activeRes] = await Promise.all([
      fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON_KEY}`),
      fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/losers?apiKey=${POLYGON_KEY}`),
      fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?include_otc=false&apiKey=${POLYGON_KEY}&sort=volume&order=desc&limit=100`),
    ]);

    const [gainersData, losersData, activeData] = await Promise.all([
      gainersRes.json().catch(() => ({})),
      losersRes.json().catch(() => ({})),
      activeRes.json().catch(() => ({})),
    ]);

    // دمج الكل في قائمة واحدة بدون تكرار
    const tickerMap = new Map();

    const addTickers = (data) => {
      const tickers = data?.tickers ?? [];
      for (const t of tickers) {
        if (t?.ticker && !tickerMap.has(t.ticker)) {
          tickerMap.set(t.ticker, t);
        }
      }
    };

    addTickers(gainersData);
    addTickers(losersData);
    addTickers(activeData);

    if (tickerMap.size === 0) {
      return res.status(200).json({ results: [], total: 0, debug: "no tickers from API" });
    }

    const MAX_MARKET_CAP = 500_000_000;
    const candidates = [];

    // ── 2. فلترة أولية ───────────────────────────────────────────────────
    for (const [ticker, stock] of tickerMap) {
      if (!ticker) continue;

      // استبعاد ETF و warrants
      if (ticker.includes(".") || ticker.includes("-")) continue;
      if (ticker.length > 5) continue;

      if (stock.marketCap && stock.marketCap > MAX_MARKET_CAP) continue;

      let price  = stock.min?.c ?? stock.lastTrade?.p ?? stock.day?.c ?? 0;
      let volume = stock.day?.v ?? 0;

      if (volume === 0 && stock.prevDay) {
        price  = stock.prevDay.c || price;
        volume = stock.prevDay.v || 0;
      }

      if (price < 0.5 || price > 20) continue;
      if (volume < 50_000) continue;

      // فلتر Spread
      if (stock.lastTrade?.p && stock.lastQuote) {
        const ask = stock.lastQuote?.P ?? price;
        const bid = stock.lastQuote?.p ?? price;
        if (price > 0) {
          const spreadPct = ((ask - bid) / price) * 100;
          if (spreadPct > 3) continue;
        }
      }

      const prevClose = stock.prevDay?.c || price;
      const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      const vwap      = stock.day?.vw || price;
      const aboveVWAP = price > vwap;
      const preGap    = stock.day?.o && stock.prevDay?.c
        ? ((stock.day.o - stock.prevDay.c) / stock.prevDay.c) * 100 : 0;

      candidates.push({ ticker, stock, price, volume, changePct, vwap, aboveVWAP, preGap });
    }

    if (candidates.length === 0) {
      return res.status(200).json({ results: [], total: tickerMap.size, debug: "all filtered out" });
    }

    // ── 3. أفضل 30 مرشح ──────────────────────────────────────────────────
    candidates.sort((a, b) => b.volume - a.volume);
    const top30 = candidates.slice(0, 30);

    // ── 4. جلب EMA + AvgVolume ────────────────────────────────────────────
    const enriched = await Promise.all(
      top30.map(async (c) => {
        const [ema9, ema20, avgVol] = await Promise.all([
          fetchEMA(c.ticker, 9),
          fetchEMA(c.ticker, 20),
          fetchAvgVolume(c.ticker),
        ]);

        const rvol = avgVol && avgVol > 0 ? c.volume / avgVol : 1;

        // ── Score ─────────────────────────────────────────────────────────
        let score = 30;
        if (rvol > 1.5)  score += 10;
        if (rvol > 3)    score += 10;
        if (rvol > 5)    score += 5;
        if (ema9 && ema20 && ema9 > ema20)  score += 10;
        if (ema9  && c.price > ema9)         score += 8;
        if (ema20 && c.price > ema20)        score += 7;
        if (c.aboveVWAP)                     score += 8;
        if (c.preGap > 3)                    score += 5;
        if (c.preGap > 8)                    score += 5;
        if (c.changePct > 5)                 score += 7;
        if (c.changePct > 15)                score += 5;
        if (c.volume > 200_000)              score += 3;
        if (c.volume > 1_000_000)            score += 4;
        if (c.price >= 1 && c.price <= 10)   score += 3;
        score = Math.min(score, 99);

        const confidence =
          score >= 80 ? "💥 انفجاري" :
          score >= 60 ? "🔥 عالي"    : "👀 مراقبة";

        const sl   = parseFloat((c.price * 0.97).toFixed(2));
        const t1   = parseFloat((c.price * 1.10).toFixed(2));
        const t2   = parseFloat((c.price * 1.20).toFixed(2));
        const t3   = parseFloat((c.price * 1.35).toFixed(2));
        const risk = parseFloat((c.price - sl).toFixed(2));

        return {
          symbol:     c.ticker,
          price:      parseFloat(c.price.toFixed(2)),
          change_pct: parseFloat(c.changePct.toFixed(2)),
          volume:     c.volume,
          rvol:       parseFloat(rvol.toFixed(2)),
          vwap:       parseFloat(c.vwap.toFixed(2)),
          aboveVWAP:  c.aboveVWAP,
          preGap:     parseFloat(c.preGap.toFixed(2)),
          marketCap:  c.stock.marketCap ? c.stock.marketCap / 1_000_000 : null,
          ema9:       ema9  ? parseFloat(ema9.toFixed(2))  : null,
          ema20:      ema20 ? parseFloat(ema20.toFixed(2)) : null,
          score,
          confidence,
          levels: { sl, t1, t2, t3, slPct: -3, risk },
        };
      })
    );

    enriched.sort((a, b) => b.score - a.score || b.rvol - a.rvol);

    return res.status(200).json({
      results: enriched.slice(0, 25),
      total:   tickerMap.size,
    });

  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Server error" });
  }
}
