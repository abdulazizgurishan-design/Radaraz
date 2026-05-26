const POLYGON_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";
const BASE = "https://api.polygon.io";

// ── جلب EMA حقيقي من Polygon ─────────────────────────────────────────────
async function fetchEMA(ticker, window) {
  try {
    const url = `${BASE}/v1/indicators/ema/${ticker}?timespan=day&adjusted=true&window=${window}&series_type=close&limit=1&apiKey=${POLYGON_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.results?.values?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

// ── جلب متوسط حجم 20 يوم حقيقي ──────────────────────────────────────────
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
    const avg = bars.reduce((s, b) => s + b.v, 0) / bars.length;
    return avg;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    // ── 1. Snapshot كامل للسوق ────────────────────────────────────────────
    const snapRes = await fetch(
      `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`
    );
    if (!snapRes.ok) return res.status(200).json({ results: [], total: 0 });

    const snapData = await snapRes.json();
    if (!snapData?.tickers) return res.status(200).json({ results: [], total: 0 });

    const MAX_MARKET_CAP = 500_000_000;
    const candidates = [];

    // ── 2. فلترة أولية سريعة ─────────────────────────────────────────────
    for (const stock of snapData.tickers) {
      if (!stock?.ticker) continue;
      if (stock.marketCap && stock.marketCap > MAX_MARKET_CAP) continue;

      let price  = stock.min?.c ?? stock.lastTrade?.p ?? stock.day?.c ?? 0;
      let volume = stock.day?.v ?? 0;

      if (volume === 0 && stock.prevDay) {
        price  = stock.prevDay.c || price;
        volume = stock.prevDay.v || 0;
      }

      if (price < 0.5 || price > 20) continue;
      if (volume < 50_000) continue;

      // فلتر الـ Spread
      if (stock.lastTrade?.p) {
        const ask = stock.lastQuote?.P ?? price;
        const bid = stock.lastQuote?.p ?? price;
        const spreadPct = ((ask - bid) / price) * 100;
        if (spreadPct > 3) continue;
      }

      const prevClose = stock.prevDay?.c || price;
      const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      const vwap      = stock.day?.vw || price;
      const aboveVWAP = price > vwap;
      const preGap    = stock.day?.o && stock.prevDay?.c
        ? ((stock.day.o - stock.prevDay.c) / stock.prevDay.c) * 100
        : 0;

      candidates.push({
        stock, price, volume, changePct, vwap, aboveVWAP, preGap, prevClose,
      });
    }

    // ── 3. أخذ أفضل 40 مرشح قبل جلب EMA (لتوفير API calls) ──────────────
    candidates.sort((a, b) => b.volume - a.volume);
    const top40 = candidates.slice(0, 40);

    // ── 4. جلب EMA + AvgVolume بشكل متوازٍ ──────────────────────────────
    const enriched = await Promise.all(
      top40.map(async (c) => {
        const [ema9, ema20, avgVol] = await Promise.all([
          fetchEMA(c.stock.ticker, 9),
          fetchEMA(c.stock.ticker, 20),
          fetchAvgVolume(c.stock.ticker),
        ]);

        // RVOL حقيقي
        const rvol = avgVol && avgVol > 0 ? c.volume / avgVol : 1;

        // ── Score محسوب بدقة ──────────────────────────────────────────────
        let score = 30;

        // RVOL
        if (rvol > 1.5) score += 10;
        if (rvol > 3)   score += 10;
        if (rvol > 5)   score += 5;

        // EMA trend
        if (ema9 && ema20 && ema9 > ema20)        score += 10; // اتجاه صاعد
        if (ema9 && c.price > ema9)               score += 8;  // فوق EMA9
        if (ema20 && c.price > ema20)             score += 7;  // فوق EMA20

        // VWAP
        if (c.aboveVWAP)                          score += 8;

        // Gap وتغيير السعر
        if (c.preGap > 3)                         score += 5;
        if (c.preGap > 8)                         score += 5;
        if (c.changePct > 5)                      score += 7;
        if (c.changePct > 15)                     score += 5;

        // حجم
        if (c.volume > 200_000)                   score += 3;
        if (c.volume > 1_000_000)                 score += 4;

        // نطاق سعر مثالي
        if (c.price >= 1 && c.price <= 10)        score += 3;

        score = Math.min(score, 99);

        const confidence =
          score >= 80 ? "💥 انفجاري" :
          score >= 60 ? "🔥 عالي"    : "👀 مراقبة";

        // ── مستويات الدخول والخروج ────────────────────────────────────────
        const sl    = parseFloat((c.price * 0.97).toFixed(2));
        const t1    = parseFloat((c.price * 1.10).toFixed(2));
        const t2    = parseFloat((c.price * 1.20).toFixed(2));
        const t3    = parseFloat((c.price * 1.35).toFixed(2));
        const risk  = parseFloat((c.price - sl).toFixed(2));

        return {
          symbol:     c.stock.ticker,
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

    // ── 5. ترتيب نهائي حسب Score ثم RVOL ────────────────────────────────
    enriched.sort((a, b) => b.score - a.score || b.rvol - a.rvol);

    return res.status(200).json({
      results: enriched.slice(0, 30),
      total:   snapData.tickers.length,
    });

  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Server error" });
  }
}
