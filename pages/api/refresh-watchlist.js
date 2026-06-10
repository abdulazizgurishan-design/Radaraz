// pages/api/refresh-watchlist.js
// ═══════════════════════════════════════════════════════════════════
//  يجلب أنشط 1200 سهم تلقائياً من Polygon كل يوم
//  ─────────────────────────────────────────────────────────────────
//  المنطق:
//  1. snapshot لكل الأسهم في السوق الأمريكي (~10000 سهم)
//  2. فلتر: سعر $0.5-$500, حجم ≥100K, نشاط حقيقي
//  3. ترتيب حسب dollar volume (سيولة فعلية)
//  4. حفظ 100 قيادي (mcap > 500M) + 1100 مضاربة في Supabase
//
//  SQL لإنشاء الجدول (شغّله مرة واحدة):
//
//  CREATE TABLE IF NOT EXISTS watchlist_active (
//    symbol TEXT PRIMARY KEY,
//    type TEXT,                -- 'leader' أو 'speculation'
//    price DECIMAL,
//    volume BIGINT,
//    dollar_volume BIGINT,
//    change_pct DECIMAL,
//    mcap BIGINT,
//    updated_at TIMESTAMP DEFAULT NOW()
//  );
//  CREATE INDEX idx_watchlist_type ON watchlist_active(type);
// ═══════════════════════════════════════════════════════════════════

export const config = { maxDuration: 60 };

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const TARGET_LEADERS  = 100;
const TARGET_SPEC     = 1100;
const MIN_PRICE       = 0.5;
const MAX_PRICE       = 500;
const MIN_VOLUME      = 100_000;
const MIN_DOLLAR_VOL  = 500_000;        // سيولة دولارية يومية
const LEADER_MCAP     = 500_000_000;    // 500M

async function fetchAllSnapshots() {
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`Polygon ${res.status}`);
    const data = await res.json();
    return data.tickers || [];
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// جلب market cap من جدول ticker_meta (إن وُجد) لتصنيف القيادي/المضاربة
async function loadKnownMcaps() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return {};
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ticker_meta?select=symbol,mcap`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return {};
    const rows = await res.json();
    const map = {};
    rows.forEach(r => { if (r.mcap) map[r.symbol] = r.mcap; });
    return map;
  } catch (_) {
    return {};
  }
}

async function clearWatchlist() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/watchlist_active?symbol=neq.__none__`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
  });
  return r.status;
}

async function countWatchlist() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/watchlist_active?select=symbol`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: "count=exact" },
  });
  return parseInt(r.headers.get("content-range")?.split("/")[1] || "0", 10);
}

async function insertWatchlist(rows) {
  const CHUNK = 150;
  let inserted = 0;
  const chunks = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    chunks.push(rows.slice(i, i + CHUNK));
  }
  const results = await Promise.allSettled(chunks.map(async (chunk, idx) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/watchlist_active?on_conflict=symbol`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
    const ok = r.ok || r.status === 201;
    let errorBody = null;
    if (!ok) {
      errorBody = (await r.text()).slice(0, 300);
    }
    return { ok, count: chunk.length, status: r.status, errorBody, firstSymbol: chunk[0]?.symbol };
  }));
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.ok) {
      inserted += r.value.count;
    } else if (r.status === "fulfilled") {
      failed.push({ chunk: i, status: r.value.status, error: r.value.errorBody, firstSymbol: r.value.firstSymbol });
    } else {
      failed.push({ chunk: i, status: "rejected" });
    }
  });
  return { inserted, failed };
}

export default async function handler(req, res) {
  const t0 = Date.now();

  // Auth
  const isCron = req.headers["x-vercel-cron"] === "true";
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  const validSecret = secret && secret === process.env.CRON_SECRET;
  if (!isCron && !validSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // 1. snapshot لكل السوق
    const all = await fetchAllSnapshots();
    const t1 = Date.now();

    // 2. mcap data من Supabase (لو موجود)
    const knownMcaps = await loadKnownMcaps();

    // 3. فلتر أولي
    const filtered = all
      .map(t => {
        const day  = t.day || {};
        const prev = t.prevDay || {};
        const price  = day.c || prev.c || 0;
        const volume = day.v || prev.v || 0;
        return {
          symbol:        t.ticker,
          price,
          volume,
          dollar_volume: Math.round(price * volume),
          change_pct:    parseFloat((t.todaysChangePerc || 0).toFixed(2)),
          mcap:          knownMcaps[t.ticker] || null,
        };
      })
      .filter(s =>
        s.symbol &&
        !s.symbol.includes(".") &&     // استبعد رموز ADR وأشياء غريبة
        s.price >= MIN_PRICE &&
        s.price <= MAX_PRICE &&
        s.volume >= MIN_VOLUME &&
        s.dollar_volume >= MIN_DOLLAR_VOL
      );

    // 4. ترتيب حسب السيولة (dollar volume) — مؤشر النشاط الحقيقي
    filtered.sort((a, b) => b.dollar_volume - a.dollar_volume);

    // 5. تقسيم: قيادي vs مضاربة
    const leaders     = [];
    const speculation = [];
    const unknown     = [];  // ما عندنا mcap → نضعها في pool ثاني

    for (const s of filtered) {
      if (s.mcap === null) {
        unknown.push(s);
      } else if (s.mcap >= LEADER_MCAP) {
        if (leaders.length < TARGET_LEADERS) leaders.push({ ...s, type: "leader" });
      } else {
        if (speculation.length < TARGET_SPEC) speculation.push({ ...s, type: "speculation" });
      }
    }

    // 6. إكمال المضاربة من unknown (الأسهم اللي ما عندنا meta لها بعد)
    for (const s of unknown) {
      if (speculation.length >= TARGET_SPEC) break;
      speculation.push({ ...s, type: "speculation" });
    }

    // إكمال القيادي من unknown إذا نقصوا (نأخذ أعلى dollar_volume)
    for (const s of unknown) {
      if (leaders.length >= TARGET_LEADERS) break;
      // ما نضيفها لو هي أصلاً في speculation
      if (!speculation.find(x => x.symbol === s.symbol)) {
        leaders.push({ ...s, type: "leader" });
      }
    }

    const finalList = [...leaders, ...speculation]
      .filter(s => s.symbol && typeof s.symbol === "string" && /^[A-Z]{1,6}$/.test(s.symbol))
      .map(s => ({
        symbol:        s.symbol,
        type:          s.type,
        price:         s.price || 0,
        volume:        s.volume || 0,
        dollar_volume: s.dollar_volume || 0,
        change_pct:    s.change_pct || 0,
        mcap:          s.mcap || null,
        updated_at:    new Date().toISOString(),
      }));

    // 7. حفظ في Supabase
    const deleteStatus = await clearWatchlist();
    const insertResult = await insertWatchlist(finalList);
    const finalCount = await countWatchlist();

    const t2 = Date.now();

    return res.status(200).json({
      success: true,
      duration_ms: t2 - t0,
      timing: { snapshot: t1 - t0, filter_and_save: t2 - t1 },
      total_market: all.length,
      after_filter: filtered.length,
      leaders: leaders.length,
      speculation: speculation.length,
      final_to_insert: finalList.length,
      delete_status: deleteStatus,
      inserted: insertResult.inserted,
      failed_chunks: insertResult.failed,
      actual_in_supabase: finalCount,
      sample_top: finalList.slice(0, 5).map(s => s.symbol),
    });

  } catch (err) {
    console.error("refresh-watchlist error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
