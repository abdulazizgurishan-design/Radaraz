// lib/radar/services/MarketCapEngine.js
// ============================================================
// RadarAZ — Market Cap Engine
// يجلب القيمة السوقية لكل سهم من Polygon (تفاصيل التذكرة).
// القائمة الجماعية لا تعطي market_cap، فنجلبها للمرشّحين القلائل فقط.
// مع cache بسيط (نفس الجلسة) لتفادي تكرار النداء لنفس السهم.
// ============================================================

const POLYGON_KEY = process.env.POLYGON_API_KEY;
const BASE = 'https://api.polygon.io';

// cache للجلسة (يُصفّر مع كل بارد ستارت — كافٍ لتفادي التكرار داخل مسح واحد)
const _cache = new Map();

async function fetchMarketCap(symbol, price) {
  if (_cache.has(symbol)) return _cache.get(symbol);
  if (!POLYGON_KEY) return null;

  try {
    const url = `${BASE}/v3/reference/tickers/${encodeURIComponent(symbol)}?apiKey=${POLYGON_KEY}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) { _cache.set(symbol, null); return null; }
    const data = await r.json();
    const res = data?.results || {};

    // نفضّل market_cap الجاهز؛ وإن غاب، نحسبه من الأسهم القائمة × السعر
    let mc = res.market_cap ?? null;
    if (mc == null) {
      const shares = res.share_class_shares_outstanding ?? res.weighted_shares_outstanding ?? null;
      if (shares && price > 0) mc = shares * price;
    }
    _cache.set(symbol, mc);
    return mc;
  } catch {
    _cache.set(symbol, null);
    return null;
  }
}

// ─── فلترة قائمة أسهم حسب نطاق القيمة السوقية ───
// يرجّع فقط الأسهم التي قيمتها ضمن [minCap, maxCap].
// الأسهم التي تعذّر جلب قيمتها: تُستبعد (تحفّظاً — لا نعرض ما لا نعرف حجمه).
export async function filterByMarketCap(stocks, minCap, maxCap, concurrency = 5) {
  const kept = [];
  const withCap = [];

  for (let i = 0; i < stocks.length; i += concurrency) {
    const slice = stocks.slice(i, i + concurrency);
    const caps = await Promise.all(
      slice.map((s) => fetchMarketCap(s.symbol, Number(s.price)).then((mc) => ({ s, mc })))
    );
    for (const { s, mc } of caps) {
      if (mc != null) {
        withCap.push({ symbol: s.symbol, market_cap: mc });
        if (mc >= minCap && mc <= maxCap) {
          s.market_cap = mc; // نُرفقها للعرض لاحقاً
          kept.push(s);
        }
      }
    }
  }

  return { kept, checked: stocks.length, withCapCount: withCap.length };
}

export default { filterByMarketCap };
