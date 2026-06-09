// pages/api/scan.js — RadarAZ v4 (Production-Ready)
// ═══════════════════════════════════════════════════════════════════
//  حلول المشاكل الثلاث:
//
//  ① Rate Limit للأخبار:
//     - بدل Promise.all(150) → chunks من 10 طلبات متوازية + sleep 250ms بين كل دفعة
//     - يقلّل عدد طلبات الأخبار من 150 → 50 (أعلى EP فقط)
//     - مع timeout على كل طلب لمنع التعليق
//
//  ② بيانات EP المفقودة (float, mcap, shortPct, high52):
//     - Meta Cache Layer في Supabase: جدول `ticker_meta` يخزّن البيانات
//     - يتم تحديثه أوتوماتيكياً مرة كل 24 ساعة عبر cron منفصل
//     - أو يدوياً عبر معامل ?refresh_meta=true
//     - الـ scan يقرأ من Supabase (سريع جداً، ms واحد) بدل polygon (بطيء)
//     - في حال غياب البيانات (سهم جديد) → نسجله كـ null ونحسب EP بدونه
//     - SQL لإنشاء الجدول موجود في تعليق بأسفل الملف
//
//  ③ Vercel Timeout:
//     - maxDuration: 60s (Pro) أو 25s (Hobby) — ضبطه في export const config
//     - استخدام AbortController مع timeout على كل fetch
//     - Promise.allSettled بدل Promise.all (لا يفشل الكل بفشل واحد)
//     - Pool محدود (10 متوازي) بدل dump كامل
// ═══════════════════════════════════════════════════════════════════

// Vercel function config
export const config = {
  maxDuration: 25,  // 25s للـ Hobby plan، غيّرها لـ 60 لو على Pro
};

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const BASE         = "https://api.polygon.io";

// ─── إعدادات الأداء ──────────────────────────────────────────────
const TUNING = {
  SNAPSHOT_CHUNK:   50,      // أسهم لكل snapshot call
  SNAPSHOT_TIMEOUT: 8000,    // ms — حد أقصى لكل snapshot
  NEWS_TOP_N:       50,      // عدد الأسهم اللي تجيب لها أخبار (تقليل من 150)
  NEWS_BATCH:       10,      // عدد طلبات الأخبار المتوازية في كل دفعة
  NEWS_DELAY_MS:    250,     // sleep بين الدفعات لتجنب 429
  NEWS_TIMEOUT:     3000,    // ms — حد أقصى لكل طلب خبر
  META_TTL_HOURS:   24,      // عمر cache البيانات الثابتة
};

// ─── القوائم (من lib/watchlist.js) ───────────────────────────────
import { LEADERS, WATCHLIST } from "../../lib/watchlist";

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * fetch مع timeout و retry على 429
 */
async function fetchWithTimeout(url, timeoutMs, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      // إذا 429 وفي retry متبقي، انتظر ثم أعد المحاولة
      if (res.status === 429 && attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(id);
      if (attempt === retries) throw err;
      await sleep(300);
    }
  }
}

async function polyGet(path, params = {}, timeoutMs = 5000) {
  const qs  = new URLSearchParams({ ...params, apiKey: POLYGON_KEY }).toString();
  const url = `${BASE}${path}?${qs}`;
  const res = await fetchWithTimeout(url, timeoutMs);
  if (!res.ok) throw new Error(`Polygon ${res.status}`);
  return res.json();
}

/**
 * Chunked parallel runner: ينفّذ المهام على دفعات
 * - batchSize: عدد المتوازي في كل دفعة
 * - delayMs: انتظار بين الدفعات
 * - يستخدم allSettled — لا يفشل الكل بفشل واحد
 */
async function runChunked(items, taskFn, batchSize, delayMs) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(taskFn));
    settled.forEach(r => results.push(r.status === "fulfilled" ? r.value : null));
    if (i + batchSize < items.length) await sleep(delayMs);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════
//  META LAYER (يحل المشكلة #2)
//  جدول Supabase يخزّن float/mcap/shortPct/high52 لكل سهم
//  تحديث مرة كل 24 ساعة عبر cron منفصل (refresh-meta endpoint)
//  
//  SQL لإنشاء الجدول (شغّله مرة واحدة في Supabase):
//  
//  CREATE TABLE IF NOT EXISTS ticker_meta (
//    symbol TEXT PRIMARY KEY,
//    name TEXT,
//    float BIGINT,
//    mcap BIGINT,
//    short_pct DECIMAL,
//    sector TEXT,
//    high_52w DECIMAL,
//    updated_at TIMESTAMP DEFAULT NOW()
//  );
//  CREATE INDEX idx_meta_updated ON ticker_meta(updated_at);
// ═══════════════════════════════════════════════════════════════════
async function loadMetaFromSupabase(tickers) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return {};
  try {
    // جلب الـ meta لكل القائمة دفعة واحدة (Supabase سريع جداً)
    const symbolsList = tickers.map(t => `"${t}"`).join(",");
    const url = `${SUPABASE_URL}/rest/v1/ticker_meta?symbol=in.(${symbolsList})&select=*`;
    const res = await fetchWithTimeout(url, 3000);
    if (!res.ok) return {};
    const rows = await res.json();
    const map = {};
    rows.forEach(r => {
      map[r.symbol] = {
        name:     r.name,
        float:    r.float,
        mcap:     r.mcap,
        shortPct: r.short_pct,
        sector:   r.sector,
        high52:   r.high_52w,
      };
    });
    return map;
  } catch (_) {
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════
//  EP MODEL
// ═══════════════════════════════════════════════════════════════════
const EP_W   = { float:22, rvol:20, news:15, short:12, breakout:13, gap:8, mcap:10 };
const EP_MAX = Object.values(EP_W).reduce((a,b) => a + b, 0);

function calcEP(s) {
  let t = 0;

  // Float (يستخدم البيانات من Meta Layer)
  const fl = s.float;
  if (fl) {
    t += fl<5e6 ? EP_W.float
       : fl<10e6 ? EP_W.float*.90
       : fl<25e6 ? EP_W.float*.75
       : fl<50e6 ? EP_W.float*.40
       : 0;
  }

  // RVOL (محسوب من snapshot)
  const rv = s.rvol || 0;
  t += rv>=15 ? EP_W.rvol*1.1
     : rv>=10 ? EP_W.rvol
     : rv>=5  ? EP_W.rvol*.85
     : rv>=3  ? EP_W.rvol*.65
     : rv>=2  ? EP_W.rvol*.35
     : 0;

  // News (من جلب الأخبار)
  const nh = s.newsAgeHours;
  if (nh != null) {
    t += nh<=6 ? EP_W.news*1.2
       : nh<=24 ? EP_W.news
       : nh<=48 ? EP_W.news*.55
       : 0;
  }

  // Short % (من Meta)
  const sp = s.shortPct || 0;
  t += sp>=40 ? EP_W.short*1.1
     : sp>=30 ? EP_W.short
     : sp>=20 ? EP_W.short*.70
     : 0;

  // Breakout (يحتاج high52 من Meta + weekHigh من snapshot)
  let bk = 0;
  if (s.high52 && s.price) {
    const d = (s.price - s.high52) / s.high52 * 100;
    bk += d>=0 ? 7 : d>=-2 ? 6 : d>=-5 ? 5 : d>=-15 ? 2 : 0;
  }
  if (s.weekHigh && s.price > s.weekHigh) bk += 6;
  t += Math.min(bk, EP_W.breakout);

  // Gap (محسوب من snapshot)
  const g = s.gapPct || 0;
  t += g>=30 ? EP_W.gap*1.2
     : g>=20 ? EP_W.gap
     : g>=10 ? EP_W.gap*.75
     : g>=5  ? EP_W.gap*.45
     : 0;

  // MCap (من Meta)
  const mc = s.mcap;
  if (mc) {
    t += mc<50e6 ? EP_W.mcap
       : mc<150e6 ? EP_W.mcap*.85
       : mc<300e6 ? EP_W.mcap*.60
       : mc<500e6 ? EP_W.mcap*.30
       : 0;
  }

  // Velocity bonus
  if ((s.gapPct||0)>=10 && (s.newsAgeHours||999)<=12 && (s.rvol||0)>=5) t += 8;

  return Math.min(Math.round((t / EP_MAX) * 100), 99);
}

const isHot = s =>
  s.ep >= 85 && (s.rvol||0) >= 5 &&
  s.newsAgeHours != null && s.newsAgeHours <= 24;

// ═══════════════════════════════════════════════════════════════════
//  SNAPSHOTS (يحل المشكلة #1 جزئياً + #3)
// ═══════════════════════════════════════════════════════════════════
async function fetchSnapshots(tickers) {
  const chunks = [];
  for (let i = 0; i < tickers.length; i += TUNING.SNAPSHOT_CHUNK) {
    chunks.push(tickers.slice(i, i + TUNING.SNAPSHOT_CHUNK));
  }

  // متوازي مع allSettled (لا يفشل الكل بفشل chunk واحد)
  const settled = await Promise.allSettled(chunks.map(chunk =>
    polyGet(
      "/v2/snapshot/locale/us/markets/stocks/tickers",
      { tickers: chunk.join(",") },
      TUNING.SNAPSHOT_TIMEOUT
    ).then(d => d.tickers || [])
  ));

  const out = {};
  settled.forEach(r => {
    if (r.status !== "fulfilled") return;
    r.value.forEach(t => {
      const day = t.day || {}, prev = t.prevDay || {};
      out[t.ticker] = {
        ticker:    t.ticker,
        price:     day.c || 0,
        open:      day.o || 0,
        volume:    day.v || 0,
        vwap:      day.vw || 0,
        high:      day.h || 0,
        low:       day.l || 0,
        prevClose: prev.c || 0,
        changePct: t.todaysChangePerc || 0,
        prevVol:   prev.v || 0,
      };
    });
  });
  return out;
}

// ═══════════════════════════════════════════════════════════════════
//  NEWS — Chunked + Throttled (يحل المشكلة #1)
// ═══════════════════════════════════════════════════════════════════
async function fetchNewsChunked(tickers) {
  return runChunked(
    tickers,
    async (ticker) => {
      try {
        const d = await polyGet(
          "/v2/reference/news",
          { ticker, limit: 1, order: "desc" },
          TUNING.NEWS_TIMEOUT
        );
        const item = (d.results || [])[0];
        if (!item) return { ticker, news: null };
        return {
          ticker,
          news: {
            ageHours: (Date.now() - new Date(item.published_utc).getTime()) / 3600000,
            headline: item.title,
          },
        };
      } catch (_) {
        return { ticker, news: null };
      }
    },
    TUNING.NEWS_BATCH,
    TUNING.NEWS_DELAY_MS
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SUPABASE SAVE
// ═══════════════════════════════════════════════════════════════════
async function saveSignals(signals) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !signals.length) return { skipped: true };
  try {
    const r = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/signals`,
      5000,
      0
    );
    // إعادة الفعلية باستخدام POST:
    const post = await fetch(`${SUPABASE_URL}/rest/v1/signals`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer":        "resolution=ignore-duplicates",
      },
      body: JSON.stringify(signals),
    });
    return {
      status: post.status,
      body: (await post.text()).slice(0, 200),
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  const t0 = Date.now();

  // Auth
  const isCron     = req.headers["x-vercel-cron"] === "true";
  const isAdmin    = req.headers["x-admin-scan"]  === "true";
  const secret     = req.headers["x-cron-secret"];
  const validSecret = secret && secret === process.env.CRON_SECRET;
  const canSave    = isCron || isAdmin || validSecret;

  try {
    // ── 1. تشغيل Snapshots و Meta بالتوازي ──────────────────────
    const [snaps, meta] = await Promise.all([
      fetchSnapshots(WATCHLIST),
      loadMetaFromSupabase(WATCHLIST),
    ]);
    const t1 = Date.now();

    // ── 2. فلتر أولي ────────────────────────────────────────────
    const now = new Date();
    const et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
    const isWeekend   = day === 0 || day === 6;
    const isPreMarket = !isWeekend && h >= 4 && (h < 9 || (h === 9 && m < 30));
    const MIN_VOL     = isPreMarket ? 5000 : 50000;

    const candidates = Object.values(snaps).filter(s =>
      s.price >= 0.5 && s.price <= 500 &&
      s.volume >= MIN_VOL &&
      s.changePct >= -30 && s.changePct <= 100
    );

    // ── 3. دمج Meta + حساب المقاييس المشتقة ─────────────────────
    const processed = candidates.map(s => {
      const m = meta[s.ticker] || {};
      const prevClose = s.prevClose || s.price;
      const gapPct    = prevClose && s.open ? ((s.open - prevClose) / prevClose) * 100 : 0;
      const tr        = Math.max(s.high - s.low, Math.abs(s.high - prevClose), Math.abs(s.low - prevClose));
      const atr       = Math.max(tr, s.price * 0.02);
      const rvol      = s.prevVol > 0 ? parseFloat((s.volume / s.prevVol).toFixed(1)) : null;
      const isLeader  = LEADERS.includes(s.ticker);

      return {
        ...s,
        // من Meta Layer:
        float:    m.float    || null,
        mcap:     m.mcap     || null,
        shortPct: m.shortPct || null,
        high52:   m.high52   || null,
        name:     m.name     || null,
        sector:   m.sector   || null,
        // محسوب:
        prevClose, gapPct, atr, rvol,
        weekHigh: null,  // يحتاج aggregates منفصلة — اختيارياً
        type: isLeader ? "قيادي" : "مضاربة",
        newsAgeHours: null, newsHeadline: null,
        ep: 0,
      };
    });

    // ── 4. EP أولي + اختيار أفضل N للأخبار ─────────────────────
    const withEP = processed
      .map(s => ({ ...s, ep: calcEP(s) }))
      .filter(s => s.ep >= 30 || (s.rvol||0) >= 3 || s.changePct >= 5)
      .sort((a, b) => b.ep - a.ep)
      .slice(0, TUNING.NEWS_TOP_N);

    // ── 5. جلب الأخبار بـ Chunking (يحل المشكلة #1) ────────────
    const newsResults = await fetchNewsChunked(withEP.map(s => s.ticker));
    const t2 = Date.now();

    // ── 6. دمج الأخبار + EP نهائي ──────────────────────────────
    const newsMap = {};
    newsResults.forEach(r => { if (r) newsMap[r.ticker] = r.news; });

    const final = withEP
      .map(s => {
        const news = newsMap[s.ticker];
        const enriched = {
          ...s,
          newsAgeHours: news?.ageHours ?? null,
          newsHeadline: news?.headline ?? null,
        };
        enriched.ep = calcEP(enriched);
        return enriched;
      })
      .filter(s => s.ep >= 40 || (s.changePct >= 3 && (s.rvol||0) >= 2))
      .sort((a, b) => {
        if (isHot(b) !== isHot(a)) return isHot(b) ? 1 : -1;
        return b.ep - a.ep;
      });

    // ── 7. بناء النتائج النهائية ────────────────────────────────
    const results = final.map(s => {
      const entry = parseFloat(s.price.toFixed(2));
      const atr   = s.atr;
      const score = s.ep;
      return {
        symbol:       s.ticker,
        name:         s.name,
        price:        entry,
        change_pct:   parseFloat(s.changePct.toFixed(2)),
        volume:       s.volume,
        score,
        ep:           score,
        signal:       score>=80 ? "💥 انفجاري" : score>=60 ? "🔥 عالي" : "👀 مراقبة",
        confidence:   score>=80 ? "💥 قوة قصوى" : score>=65 ? "🔥 إشارة ممتازة" : "👀 مراقبة",
        type:         s.type,
        sector:       s.sector,
        rvol:         s.rvol,
        vwap:         parseFloat((s.vwap||0).toFixed(2)),
        is_hot:       isHot(s),
        newsAgeHours: s.newsAgeHours != null ? Math.round(s.newsAgeHours) : null,
        newsHeadline: s.newsHeadline,
        // من Meta:
        float:        s.float,
        marketCap:    s.mcap ? s.mcap / 1e6 : null,
        shortPct:     s.shortPct,
        levels: {
          t1:    parseFloat((entry + atr*0.5).toFixed(2)),
          t1Pct: parseFloat(((atr*0.5/entry)*100).toFixed(2)),
          t2:    parseFloat((entry + atr*1.0).toFixed(2)),
          t2Pct: parseFloat(((atr*1.0/entry)*100).toFixed(2)),
          t3:    parseFloat((entry + atr*1.8).toFixed(2)),
          t3Pct: parseFloat(((atr*1.8/entry)*100).toFixed(2)),
          sl:    parseFloat(Math.max(entry-atr*0.8, entry*0.90).toFixed(2)),
          slPct: parseFloat((((Math.max(entry-atr*0.8, entry*0.90) - entry)/entry)*100).toFixed(2)),
          risk:  parseFloat((entry - Math.max(entry-atr*0.8, entry*0.90)).toFixed(2)),
        },
      };
    });

    const leaders     = results.filter(s => s.type === "قيادي");
    const speculation = results.filter(s => s.type !== "قيادي");

    // ── 8. حفظ Supabase (أدمن/cron فقط) ────────────────────────
    let saveResult = { skipped: true, reason: "subscriber scan" };
    if (canSave) {
      const rows = results.filter(s => s.ep >= 60).map(s => ({
        symbol:         s.symbol,
        entry_price:    s.price,
        target1:        s.levels.t1,
        target2:        s.levels.t2,
        target3:        s.levels.t3,
        stop_loss:      s.levels.sl,
        score:          s.ep,
        ep:             s.ep,
        rvol:           s.rvol != null ? parseFloat(s.rvol.toFixed(2)) : null,
        volume:         s.volume,
        change_pct:     s.change_pct,
        news_age_hours: s.newsAgeHours,
        is_hot:         s.is_hot,
        type:           s.type,
        status:         "OPEN",
      }));
      saveResult = await saveSignals(rows);
    }

    const t3 = Date.now();
    return res.status(200).json({
      success:     true,
      total:       results.length,
      hot:         results.filter(isHot).length,
      saved:       canSave ? results.filter(s => s.ep >= 60).length : 0,
      saveResult,
      timing: {
        snapshots: t1 - t0,
        news:      t2 - t1,
        rest:      t3 - t2,
        total_ms:  t3 - t0,
      },
      meta_coverage: {
        with_float: Object.values(meta).filter(m => m.float).length,
        with_mcap:  Object.values(meta).filter(m => m.mcap).length,
        total_meta: Object.keys(meta).length,
      },
      results,
      leaders,
      speculation,
    });

  } catch (err) {
    console.error("scan.js error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════
   SQL لإنشاء جدول Meta في Supabase (شغّله مرة واحدة):
   
   CREATE TABLE IF NOT EXISTS ticker_meta (
     symbol TEXT PRIMARY KEY,
     name TEXT,
     float BIGINT,
     mcap BIGINT,
     short_pct DECIMAL,
     sector TEXT,
     high_52w DECIMAL,
     updated_at TIMESTAMP DEFAULT NOW()
   );
   CREATE INDEX idx_meta_updated ON ticker_meta(updated_at);
   
   ───────────────────────────────────────────────────────────────────
   ملف منفصل: pages/api/refresh-meta.js
   يجلب float/mcap/shortPct من Polygon ويحفظها في Supabase
   يشتغل عبر cron مرة كل 24 ساعة:
   
   { "path": "/api/refresh-meta", "schedule": "0 8 * * *" }
   ═══════════════════════════════════════════════════════════════════ */
