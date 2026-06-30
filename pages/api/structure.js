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
  // 🆕 سقوف واقعية (مطابقة لـ scan.js) — تمنع الأهداف/الوقف الخيالية من البيانات المشوّهة
  const STOP_CAP = price * 0.92;   // أقصى خسارة -8%
  const T1_CAP = price * 1.08;     // هدف أول أقصى +8%
  const T2_CAP = price * 1.20;     // +20%
  const T3_CAP = price * 1.35;     // +35% (حد الطموح الواقعي)
  let stop    = support - atr * 0.5;
  if (stop < STOP_CAP) stop = STOP_CAP;   // البنية أولاً، السقف يحرس لو الدعم بعيد
  stop = f2(stop);
  const entry   = f2(price);
  const confirm = f2(price + atr * 0.3);
  let t1 = Math.min(price + range * 0.5, T1_CAP);
  let t2 = Math.min(Math.max(price + range * 0.85, t1 * 1.01), T2_CAP);
  let t3 = Math.min(Math.max(resistance, t2 * 1.01), T3_CAP);
  t1 = f2(t1); t2 = f2(t2); t3 = f2(t3);
  const peak = f2(Math.min(resistance + atr * 1.0, price * 1.55));
  const liquidity = f2(Math.min(resistance + atr * 0.4, price * 1.45));
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
    // عائد 3 شهور (للسياق) — 🆕 محمي من الشذوذ (تجزئة الأسهم/بيانات خاطئة) التي تُنتج نسباً خيالية (651%)
    const closes = bars.map(b => b.c);
    const idx = Math.max(0, closes.length - 63);
    let ret3m = null;
    if (closes[idx] && closes[idx] > 0) {
      // كشف القفزات الشاذة (>40% بين يومين = تجزئة/خطأ بيانات)
      let splitAnomaly = false;
      for (let i = idx + 1; i < closes.length; i++) {
        const p = closes[i - 1], c = closes[i];
        if (p > 0 && c > 0 && Math.abs(c - p) / p > 0.40) { splitAnomaly = true; break; }
      }
      let base = closes[idx];
      if (splitAnomaly) {
        const shortIdx = Math.max(0, closes.length - 20);   // نافذة قصيرة موثوقة
        base = closes[shortIdx] > 0 ? closes[shortIdx] : base;
      }
      const r = ((price - base) / base) * 100;
      ret3m = (r > 300 || r < -95) ? null : +r.toFixed(1);   // سقف منطقي: نتجاهل الشاذ
    }
    return res.status(200).json({ symbol, price, structure, ret3m });
  } catch (e) {
    return res.status(200).json({ symbol, structure: null, error: e.message });
  }
}
