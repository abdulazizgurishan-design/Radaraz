const POLYGON_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";

export default async function handler(req, res) {
  try {
    const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`;
    const response = await fetch(snapshotUrl);

    if (!response.ok) return res.status(200).json({ results: [], total: 0 });

    const snapshotData = await response.json();
    if (!snapshotData?.tickers) return res.status(200).json({ results: [], total: 0 });

    const MAX_MARKET_CAP = 500_000_000;
    const rawResults = [];

    for (const stock of snapshotData.tickers) {
      if (!stock?.ticker) continue;
      if (stock.marketCap && stock.marketCap > MAX_MARKET_CAP) continue;

      // ── السعر والحجم ──────────────────────────────────────────
      let price  = stock.min?.c ?? stock.lastTrade?.p ?? stock.day?.c ?? 0;
      let volume = stock.day?.v ?? 0;

      if (volume === 0 && stock.prevDay) {
        price  = stock.prevDay.c || price;
        volume = stock.prevDay.v || 0;
      }

      if (price < 0.1 || price > 20) continue;
      if (volume < 10_000) continue;

      // ── فلتر الـ Spread (حماية من السيولة الوهمية) ────────────
      if (stock.lastTrade?.p) {
        const ask = stock.lastQuote?.P ?? price;
        const bid = stock.lastQuote?.p ?? price;
        const spreadPercent = ((ask - bid) / price) * 100;
        if (spreadPercent > 3) continue;
      }

      // ── المؤشرات الفنية ───────────────────────────────────────
      const prevClose = stock.prevDay?.c || price;
      const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      const vwap      = stock.day?.vw || price;
      const aboveVWAP = price > vwap;
      const preGap    = stock.day?.o && stock.prevDay?.c
        ? ((stock.day.o - stock.prevDay.c) / stock.prevDay.c) * 100
        : 0;

      // حساب RVOL تقريبي (حجم اليوم ÷ متوسط وهمي)
      const avgVolEst = stock.prevDay?.v || volume;
      const rvol      = avgVolEst > 0 ? volume / avgVolEst : 1;

      // ── درجة الفرصة (Score) ───────────────────────────────────
      let score = 40;
      if (rvol > 2)        score += 15;
      if (rvol > 5)        score += 10;
      if (aboveVWAP)       score += 10;
      if (preGap > 5)      score += 10;
      if (changePct > 5)   score += 10;
      if (changePct > 10)  score += 5;
      if (volume > 500_000) score += 5;
      if (price >= 1 && price <= 10) score += 5; // نطاق مثالي
      score = Math.min(score, 99);

      const confidence =
        score >= 80 ? "💥 انفجاري" :
        score >= 60 ? "🔥 عالي"    : "👀 مراقبة";

      // ── مستويات الدخول والخروج ────────────────────────────────
      const sl     = parseFloat((price * 0.97).toFixed(2));
      const t1     = parseFloat((price * 1.10).toFixed(2));
      const t2     = parseFloat((price * 1.20).toFixed(2));
      const t3     = parseFloat((price * 1.35).toFixed(2));
      const slPct  = -3;
      const risk   = parseFloat((price - sl).toFixed(2));

      rawResults.push({
        symbol:     stock.ticker,
        price:      parseFloat(price.toFixed(2)),
        change_pct: parseFloat(changePct.toFixed(2)),
        volume,
        rvol:       parseFloat(rvol.toFixed(2)),
        vwap:       parseFloat(vwap.toFixed(2)),
        aboveVWAP,
        preGap:     parseFloat(preGap.toFixed(2)),
        marketCap:  stock.marketCap ? stock.marketCap / 1_000_000 : null,
        score,
        confidence,
        ema9:  null, // يحتاج endpoint منفصل
        ema20: null,
        levels: { sl, t1, t2, t3, slPct, risk },
      });
    }

    // ترتيب حسب الـ Score ثم الـ RVOL
    rawResults.sort((a, b) => b.score - a.score || b.rvol - a.rvol);

    return res.status(200).json({
      results: rawResults.slice(0, 100),
      total:   snapshotData.tickers.length,
    });

  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Server error" });
  }
}
