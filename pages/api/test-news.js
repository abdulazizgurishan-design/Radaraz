// pages/api/test-news.js — اختبار مؤقّت: هل اشتراك Polygon يشمل الأخبار؟
// افتح: https://radaraz.com/api/test-news
// بعد التأكّد، احذف هذا الملف (لا تتركه منشوراً).
export default async function handler(req, res) {
  const KEY = process.env.POLYGON_API_KEY;
  if (!KEY) {
    return res.status(500).json({ ok: false, reason: 'POLYGON_API_KEY غير موجود في متغيّرات البيئة' });
  }

  try {
    const url = `https://api.polygon.io/v2/reference/news?limit=3&apiKey=${KEY}`;
    const r = await fetch(url);
    const status = r.status;
    const data = await r.json();

    // هل رجعت أخبار فعلاً؟
    const hasNews = Array.isArray(data?.results) && data.results.length > 0;

    if (hasNews) {
      // نعرض عيّنة (بلا كشف المفتاح) — العنوان + المصدر + هل فيه تحليل مشاعر
      const sample = data.results.slice(0, 3).map((n) => ({
        title: n.title,
        publisher: n.publisher?.name || null,
        published: n.published_utc || null,
        tickers: n.tickers || [],
        // بعض خطط Polygon ترجع insights فيها sentiment لكل تذكرة
        has_sentiment: Array.isArray(n.insights) && n.insights.length > 0,
        sentiment_sample: Array.isArray(n.insights)
          ? n.insights.slice(0, 2).map((i) => ({ ticker: i.ticker, sentiment: i.sentiment }))
          : null,
      }));

      return res.status(200).json({
        ok: true,
        news_included: true,
        message: '✅ اشتراكك يشمل الأخبار',
        has_sentiment_field: sample.some((s) => s.has_sentiment),
        count_returned: data.results.length,
        sample,
      });
    }

    // لم ترجع أخبار — غالباً غير مصرّح
    return res.status(200).json({
      ok: true,
      news_included: false,
      message: '❌ الأخبار غير مشمولة (أو لا نتائج)',
      http_status: status,
      polygon_status: data?.status || null,
      polygon_error: data?.error || data?.message || null,
      raw: data,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
