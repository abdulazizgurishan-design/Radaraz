// lib/radar/services/NewsEngine.js
// ============================================================
// RadarAZ — News Engine (تحليل مشاعر الأخبار من Polygon)
// يجلب أحدث أخبار السهم + تحليل المشاعر الجاهز (positive/negative/neutral)
// ويحوّلها إلى: عامل درجة + شارة عرض + عمر الخبر.
//
// المصدر: Polygon /v2/reference/news (يشمل insights.sentiment لكل تذكرة).
// التصميم: مقتصد في النداءات — نجلب فقط للأسهم المرشّحة (لا كل الـuniverse).
// ============================================================

const POLYGON_KEY = process.env.POLYGON_API_KEY;
const BASE = 'https://api.polygon.io';

// نافذة اعتبار الخبر «مؤثّراً» (ساعات). أقدم من ذلك = تأثير ضعيف.
const FRESH_HOURS = 48;

// جلب أخبار سهم واحد مع المشاعر
async function fetchTickerNews(symbol, limit = 5) {
  if (!POLYGON_KEY) return null;
  try {
    const url = `${BASE}/v2/reference/news?ticker=${encodeURIComponent(symbol)}&limit=${limit}&order=desc&sort=published_utc&apiKey=${POLYGON_KEY}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data?.results) ? data.results : [];
  } catch {
    return null;
  }
}

// استخراج مشاعر سهم معيّن من مقال (من insights)
function sentimentForTicker(article, symbol) {
  if (!Array.isArray(article?.insights)) return null;
  const hit = article.insights.find((i) => i.ticker === symbol);
  return hit ? hit.sentiment : null; // 'positive' | 'negative' | 'neutral'
}

// عمر الخبر بالساعات
function ageHours(publishedUtc) {
  if (!publishedUtc) return null;
  const ms = Date.now() - new Date(publishedUtc).getTime();
  return ms / 3600000;
}

// ─── تحليل أخبار سهم → ملخّص قابل للاستخدام في الدرجة والعرض ───
// يرجّع: { sentiment, score_factor, fresh, age_h, headline, count, positive, negative }
export async function analyzeNews(symbol) {
  const articles = await fetchTickerNews(symbol, 5);
  if (!articles || articles.length === 0) {
    return { available: false, sentiment: 'none', score_factor: 1.0, fresh: false, age_h: null, headline: null, count: 0 };
  }

  let positive = 0, negative = 0, neutral = 0;
  let freshestAge = null;
  let freshestHeadline = null;

  for (const a of articles) {
    const s = sentimentForTicker(a, symbol);
    const age = ageHours(a.published_utc);
    if (age != null && (freshestAge == null || age < freshestAge)) {
      freshestAge = age;
      freshestHeadline = a.title || null;
    }
    // نَزِن فقط الأخبار الحديثة (ضمن FRESH_HOURS)
    if (age != null && age <= FRESH_HOURS && s) {
      if (s === 'positive') positive++;
      else if (s === 'negative') negative++;
      else neutral++;
    }
  }

  const fresh = freshestAge != null && freshestAge <= FRESH_HOURS;

  // المشاعر الغالبة (بين الأخبار الحديثة)
  let sentiment = 'neutral';
  if (positive > negative) sentiment = 'positive';
  else if (negative > positive) sentiment = 'negative';
  else if (positive === 0 && negative === 0) sentiment = 'neutral';

  // ── عامل الدرجة (score_factor) — يُضرب في الدرجة النهائية ──
  // إيجابي حديث = تعزيز. سلبي حديث = خفض حادّ (تجنّب الفخّ). محايد/قديم = بلا أثر.
  let score_factor = 1.0;
  if (fresh) {
    if (sentiment === 'positive') score_factor = 1.15;      // +15% تعزيز
    else if (sentiment === 'negative') score_factor = 0.70; // -30% خفض (حماية)
    // محايد = 1.0 (لا أثر)
  }

  return {
    available: true,
    sentiment,                 // positive | negative | neutral
    score_factor,              // مضاعف الدرجة
    fresh,                     // خبر حديث ضمن النافذة؟
    age_h: freshestAge != null ? Math.round(freshestAge * 10) / 10 : null,
    headline: freshestHeadline,
    count: articles.length,
    positive, negative, neutral,
  };
}

// ─── تحليل دفعة أسهم بالتوازي (مقتصد — للمرشّحين فقط) ───
export async function analyzeNewsBatch(symbols, concurrency = 5) {
  const out = {};
  for (let i = 0; i < symbols.length; i += concurrency) {
    const slice = symbols.slice(i, i + concurrency);
    const results = await Promise.all(slice.map((s) => analyzeNews(s).then((r) => [s, r])));
    for (const [sym, res] of results) out[sym] = res;
  }
  return out;
}

export default { analyzeNews, analyzeNewsBatch };
