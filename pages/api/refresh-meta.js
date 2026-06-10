// pages/api/refresh-meta.js
// ═══════════════════════════════════════════════════════════════════
//  يجلب float/mcap/shortPct/52W high لكل سهم ويحفظها في Supabase
//  يشتغل عبر cron مرة كل 24 ساعة (في vercel.json):
//
//  { "path": "/api/refresh-meta", "schedule": "0 8 * * *" }
//
//  يمكن تشغيله يدوياً: curl https://radaraz.com/api/refresh-meta
//  مع header: x-cron-secret: <CRON_SECRET>
// ═══════════════════════════════════════════════════════════════════

export const config = {
  maxDuration: 60,  // يحتاج وقت أطول لأنه يجلب 1200 سهم
};

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const BASE         = "https://api.polygon.io";

// نفس قائمة WATCHLIST من scan.js
// ملاحظة: في الإنتاج، استورد القائمة من ملف مشترك (lib/watchlist.js)
// هنا أضع نسخة مختصرة للوضوح
import { loadWatchlist } from "../../lib/watchlist";

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchTickerDetails(ticker) {
  try {
    const url = `${BASE}/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.results || {};
    return {
      symbol:    ticker,
      name:      r.name || null,
      float:     r.share_class_shares_outstanding || null,
      mcap:      r.market_cap || null,
      short_pct: r.short_percent_of_float ? r.short_percent_of_float * 100 : null,
      sector:    r.sic_description || null,
    };
  } catch (_) {
    return null;
  }
}

async function fetch52WHigh(ticker) {
  try {
    const end   = new Date().toISOString().slice(0,10);
    const start = new Date(Date.now() - 380 * 86400000).toISOString().slice(0,10);
    const url = `${BASE}/v2/aggs/ticker/${ticker}/range/1/day/${start}/${end}?adjusted=true&sort=desc&limit=300&apiKey=${POLYGON_KEY}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    const data = await res.json();
    const aggs = data.results || [];
    if (!aggs.length) return null;
    return Math.max(...aggs.map(r => r.h));
  } catch (_) {
    return null;
  }
}

async function upsertMeta(rows) {
  if (!rows.length) return { count: 0 };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ticker_meta`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer":        "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  return { status: res.status, count: rows.length };
}

async function processBatch(tickers) {
  // كل سهم: details + 52W بالتوازي
  const results = await Promise.allSettled(
    tickers.map(async ticker => {
      const [details, high52] = await Promise.all([
        fetchTickerDetails(ticker),
        fetch52WHigh(ticker),
      ]);
      if (!details) return null;
      return {
        ...details,
        high_52w: high52,
        updated_at: new Date().toISOString(),
      };
    })
  );
  return results
    .filter(r => r.status === "fulfilled" && r.value)
    .map(r => r.value);
}

export default async function handler(req, res) {
  const t0 = Date.now();

  // Auth (يقبل header أو query parameter)
  const isCron     = req.headers["x-vercel-cron"] === "true";
  const secret     = req.headers["x-cron-secret"] || req.query.secret;
  const validSecret = secret && secret === process.env.CRON_SECRET;
  if (!isCron && !validSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // تحميل القائمة الديناميكية
    const { WATCHLIST, source: listSource } = await loadWatchlist();

    const BATCH_SIZE  = 10;
    const BATCH_DELAY = 400;
    const allMeta = [];

    for (let i = 0; i < WATCHLIST.length; i += BATCH_SIZE) {
      const batch = WATCHLIST.slice(i, i + BATCH_SIZE);
      const batchResults = await processBatch(batch);
      allMeta.push(...batchResults);
      if (i + BATCH_SIZE < WATCHLIST.length) await sleep(BATCH_DELAY);
    }

    // حفظ Supabase دفعات (200 سهم لكل upsert)
    const SAVE_CHUNK = 200;
    let savedTotal = 0;
    for (let i = 0; i < allMeta.length; i += SAVE_CHUNK) {
      const chunk = allMeta.slice(i, i + SAVE_CHUNK);
      const r = await upsertMeta(chunk);
      savedTotal += r.count;
    }

    return res.status(200).json({
      success: true,
      duration_ms: Date.now() - t0,
      watchlist_source: listSource,
      watchlist_size: WATCHLIST.length,
      fetched: allMeta.length,
      saved: savedTotal,
      missing: WATCHLIST.length - allMeta.length,
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
