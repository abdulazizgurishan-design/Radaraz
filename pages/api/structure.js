// pages/api/structure.js
// 🆕 تحليل بنية سهم واحد عند الطلب (للضغط على أسهم "حركة السوق").
// يجلب شموع السهم ويحسب نفس بنية AI-Az (دعم/مقاومة/أهداف/وقف) — بلا إثقال المسح.

const POLYGON_KEY = process.env.POLYGON_API_KEY;

async function fetchAggs(symbol, multiplier, timespan, lookbackDays, limit) {
  const to   = new Date().toISOString().split("T")[0];
  const from  = new Date(Date.now() - lookbackDays * 86400000).toISOString().split("T")[0];
  const url  = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}&apiKey=${POLYGON_KEY}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.results && data.results.length) ? data.results : null;
  } catch { clearTimeout(id); return null; }
}

// نسخة مطابقة لـ computeStructureLevels في scan.js (دعم/مقاومة/أهداف/وقف من البنية)
function computeStructureLevels(price, bars) {
  if (!bars || bars.length < 15) return null;
  const highs = bars.map(b => b.h), lows = bars.map(b => b.l), closes = bars.map(b => b.c);
  const recentHigh = Math.max(...highs.slice(-30));
  const recentLow  = Math.min(...lows.slice(-30));
  // ATR تقريبي
  let trSum = 0, c = 0;
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i-1].c), Math.abs(bars[i].l - bars[i-1].c));
    trSum += tr; c++;
  }
  const atr = c ? trSum / c : price * 0.03;
  // الدعم: أقرب قاع حديث تحت السعر · المقاومة: أقرب قمة فوق
  const support = recentLow < price ? recentLow : +(price - atr * 1.5).toFixed(2);
  const resistance = recentHigh > price ? recentHigh : +(price + atr * 1.5).toFixed(2);
  const range = resistance - support || atr * 2;
  const f2 = v => +v.toFixed(price < 1 ? 4 : 2);
  const stop    = f2(support - atr * 0.5);
  const entry   = f2(price);
  const confirm = f2(price + atr * 0.3);
  const t1 = f2(price + range * 0.5);
  const t2 = f2(price + range * 0.85);
  const t3 = f2(resistance);
  const peak = f2(resistance + atr * 1.0);
  const liquidity = f2(resistance + atr * 0.4);
  const risk = +(entry - stop).toFixed(2);
  const reward = +(t1 - entry).toFixed(2);
  const rr = risk > 0 ? +(reward / risk).toFixed(2) : null;
  // حالة الاتجاه
  const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
  const trend = price > ma20 ? "صاعد مؤكد ✅" : "ينتظر تأكيد ⏳";
  const flag = (price > support && price <= confirm * 1.01 && rr >= 1.2) ? "دخول صحيح ✅" : "مقبول";
  return {
    support: f2(support), resistance: f2(resistance), stop, entry, confirm,
    t1, t2, t3, peak, liquidity, rr, trend, flag,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  const symbol = (req.query.symbol || "").toUpperCase().trim();
  if (!symbol || !/^[A-Z]{1,6}$/.test(symbol)) {
    return res.status(400).json({ error: "رمز غير صالح" });
  }
  if (!POLYGON_KEY) {
    return res.status(200).json({ symbol, structure: null, error: "no_key" });
  }
  try {
    // شموع يومية (~3 شهور) للبنية — نفس منطق الرادار
    const bars = await fetchAggs(symbol, 1, "day", 120, 120);
    if (!bars || bars.length < 15) {
      return res.status(200).json({ symbol, structure: null, error: "no_data" });
    }
    const price = bars[bars.length - 1].c;
    const structure = computeStructureLevels(price, bars);
    // عائد 3 شهور (للسياق)
    const idx = Math.max(0, bars.length - 63);
    const ret3m = bars[idx]?.c ? +(((price - bars[idx].c) / bars[idx].c) * 100).toFixed(1) : null;
    return res.status(200).json({ symbol, price, structure, ret3m });
  } catch (e) {
    return res.status(200).json({ symbol, structure: null, error: e.message });
  }
}
