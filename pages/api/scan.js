const POLYGON_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";
const BASE = "https://api.polygon.io";

const WATCHLIST = [
  "SOUN","BBAI","KULR","CRKN","NKLA","MULN","WISA","CBAT","BFRI","ATXS",
  "HOLO","BHAT","CLSK","MARA","RIOT","CIFR","BTBT","IREN","ARBK","MIGI",
  "ATER","CLOV","NAKD","IDEX","SENS","ZKIN","ENSC","BKKT","NRDY","SMFL",
  "ALLR","GFAI","TYGO","AGRI","NVFY","SIGA","GOVX","XELA","IMPP","AEYE",
  "PRPB","PBAX","SBET","INPX","CLRB","ATNF","AULT","TAOP","KPLT","SHOT"
];

export default async function handler(req, res) {
  try {
    // 1. تحديد وضع السوق الحالي بناءً على توقيت نيويورك
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
    
    const isWeekend = day === 0 || day === 6;
    const isPreMarket = !isWeekend && h >= 4 && (h < 9 || (h === 9 && m < 30));

    // تعديل الفلاتر ديناميكياً: إذا pre-market نكتفي بحجم 5,000 سهم وسبريد 6% لضمان ظهور الفرص
    const MIN_VOLUME = isPreMarket ? 5000 : 50000;
    const MAX_SPREAD = isPreMarket ? 6 : 3;

    // 2. جلب البيانات بالتوازي
    const snapshots = await Promise.all(
      WATCHLIST.map(async (ticker) => {
        try {
          const url = `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`;
          const r = await fetch(url);
          if (!r.ok) return null;
          const d = await r.json();
          return d?.ticker ? { ticker, data: d.ticker } : null;
        } catch { return null; }
      })
    );

    const finalResults = [];

    for (const snap of snapshots) {
      if (!snap) continue;
      const { ticker, data } = snap;

      let price  = data.min?.c ?? data.lastTrade?.p ?? data.day?.c ?? 0;
      let volume = data.day?.v ?? 0;

      if (volume === 0 && data.prevDay) {
        price  = data.prevDay.c || price;
        volume = data.prevDay.v || 0;
      }

      if (price < 0.3 || price > 20) continue;
      if (volume < MIN_VOLUME) continue; // الفلتر الديناميكي المرن

      // فلتر الـ Spread المرن
      if (data.lastTrade?.p && data.lastQuote) {
        const ask = data.lastQuote?.P ?? price;
        const bid = data.lastQuote?.p ?? price;
        if (price > 0) {
          const spreadPct = ((ask - bid) / price) * 100;
          if (spreadPct > MAX_SPREAD) continue; 
        }
      }

      const prevClose = data.prevDay?.c || price;
      const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      const vwap      = data.day?.vw || price;
      const aboveVWAP = price > vwap;
      const preGap    = data.day?.o && data.prevDay?.c ? ((data.day.o - data.prevDay.c) / data.prevDay.c) * 100 : 0;

      const high = data.day?.h || price;
      const low  = data.day?.l || price;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      const atr = Math.max(tr, price * 0.02);

      const rawTarget1  = price + atr * 1.5;
      const rawTarget2  = price + atr * 3.0;
      const rawTarget3  = price + atr * 4.5;
      const rawStopLoss = price - atr * 0.8;

      const stopLoss = parseFloat(Math.max(rawStopLoss, price * 0.90).toFixed(2));
      const target1  = parseFloat(rawTarget1.toFixed(2));
      const target2  = parseFloat(rawTarget2.toFixed(2));
      const target3  = parseFloat(rawTarget3.toFixed(2));

      const slPct = parseFloat((((stopLoss - price) / price) * 100).toFixed(2));
      const risk  = parseFloat((price - stopLoss).toFixed(2));

      const reward = target1 - price;
      const rr     = risk > 0 ? (reward / risk).toFixed(1) : "0";
      
      // في الـ Pre-market نتغاضى عن شرط الـ R:R الصارم لأن المدى السعري يكون ضيقاً ولم يتسع بعد
      if (!isPreMarket && parseFloat(rr) < 1.0) continue; 

      // احتساب السكور
      let score = 40;
      if (aboveVWAP)       score += 15;
      if (preGap > 2)      score += 10;
      if (changePct > 3)   score += 10;
      if (volume > 100000) score += 15;
      score = Math.min(score, 99);

      const confidence =
        score >= 80 ? "💥 قوة قصوى" :
        score >= 60 ? "🔥 إشارة ممتازة" : "👀 مراقبة";

      finalResults.push({
        symbol:     ticker,
        price:      parseFloat(price.toFixed(2)),
        change_pct: parseFloat(changePct.toFixed(2)),
        volume:     volume,
        rr:         rr,
        signal:     confidence,
        score:      score,
        marketCap:  data.marketCap ? data.marketCap / 1_000_000 : null,
        levels: {
          sl: stopLoss,
          t1: target1,
          t2: target2,
          t3: target3,
          slPct: slPct,
          risk: risk
        }
      });
    }

    finalResults.sort((a, b) => b.score - a.score || b.volume - a.volume);

    return res.status(200).json({
      success: true,
      results: finalResults.slice(0, 25),
      total: WATCHLIST.length
    });

  } catch (error) {
    return res.status(200).json({ success: true, results: [] });
  }
}
