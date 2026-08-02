// pages/api/test-marketcap.js — اختبار مؤقّت: هل Polygon يعطي القيمة السوقية؟
// افتح: https://radaraz.com/api/test-marketcap
// بعد التأكّد، احذف هذا الملف.
//
// يختبر مصدرين:
//  1) /v3/reference/tickers?market=stocks  → قائمة فيها market_cap لكل سهم (الأفضل للفلترة الجماعية)
//  2) /v3/reference/tickers/{ticker}       → تفاصيل سهم واحد (فيه market_cap)
export default async function handler(req, res) {
  const KEY = process.env.POLYGON_API_KEY;
  if (!KEY) return res.status(500).json({ ok: false, reason: 'POLYGON_API_KEY غير موجود' });

  const out = { ok: true };

  // ── اختبار 1: قائمة الأسهم مع القيمة السوقية (للفلترة الجماعية) ──
  try {
    // نطلب صفحة صغيرة من الأسهم النشطة، ونرى هل market_cap موجود
    const url1 = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=10&apiKey=${KEY}`;
    const r1 = await fetch(url1);
    const d1 = await r1.json();
    const sample = Array.isArray(d1?.results) ? d1.results.slice(0, 10) : [];
    // هل الحقل market_cap موجود في هذه القائمة؟
    const hasMarketCapInList = sample.some((t) => t.market_cap != null);
    out.list_endpoint = {
      http_status: r1.status,
      polygon_status: d1?.status || null,
      results_count: sample.length,
      has_market_cap_in_list: hasMarketCapInList,
      // عيّنة: الرمز + هل فيه قيمة سوقية
      sample: sample.map((t) => ({
        ticker: t.ticker,
        name: t.name,
        market_cap: t.market_cap ?? null,
        has_it: t.market_cap != null,
      })),
      note: hasMarketCapInList
        ? '✅ القيمة السوقية متاحة في قائمة الأسهم (نقدر نفلتر جماعياً)'
        : '⚠️ القيمة السوقية غير موجودة في القائمة — نحتاج طلب تفاصيل لكل سهم (اختبار 2)',
    };
  } catch (e) {
    out.list_endpoint = { error: e.message };
  }

  // ── اختبار 2: تفاصيل سهم واحد (AAPL) — هل فيه market_cap؟ ──
  try {
    const url2 = `https://api.polygon.io/v3/reference/tickers/AAPL?apiKey=${KEY}`;
    const r2 = await fetch(url2);
    const d2 = await r2.json();
    const mc = d2?.results?.market_cap ?? null;
    out.detail_endpoint = {
      http_status: r2.status,
      polygon_status: d2?.status || null,
      ticker: 'AAPL',
      market_cap: mc,
      shares_outstanding: d2?.results?.share_class_shares_outstanding ?? d2?.results?.weighted_shares_outstanding ?? null,
      has_market_cap: mc != null,
      note: mc != null
        ? '✅ تفاصيل السهم تعطي market_cap (نقدر نجلبه لكل مرشّح)'
        : '❌ لا توجد market_cap حتى في التفاصيل',
    };
  } catch (e) {
    out.detail_endpoint = { error: e.message };
  }

  // ── الخلاصة ──
  const listOk = out.list_endpoint?.has_market_cap_in_list;
  const detailOk = out.detail_endpoint?.has_market_cap;
  out.conclusion = listOk
    ? '🟢 الأفضل: نفلتر جماعياً من القائمة (سريع، نداء واحد)'
    : detailOk
      ? '🟡 متاح لكن بطلب تفاصيل لكل مرشّح (أبطأ، لكن للمرشّحين القلائل مقبول)'
      : '🔴 القيمة السوقية غير متاحة في اشتراكك — نحتاج بديلاً';

  return res.status(200).json(out);
}
