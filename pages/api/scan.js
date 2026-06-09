// pages/api/scan.js — RadarAZ v2
// EP Model كامل: float, rvol, news, short, breakout, gap, mcap
// 7000+ سهم · Concurrency Pool (8 parallel) · HOT Alerts · Supabase

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const BASE         = "https://api.polygon.io";

// ─── EP Model ────────────────────────────────────────────────────
const EP_W = { float:22, rvol:20, news:15, short:12, breakout:13, gap:8, mcap:10 };
const EP_MAX = Object.values(EP_W).reduce((a,b)=>a+b, 0);

function calcEP(s) {
  let t = 0;
  // Float
  const fl = s.float;
  if (fl) t += fl < 5e6  ? EP_W.float
             : fl < 10e6 ? EP_W.float * .90
             : fl < 25e6 ? EP_W.float * .75
             : fl < 50e6 ? EP_W.float * .40
             : 0;
  // RVOL
  const rv = s.rvol || 0;
  t += rv >= 15 ? EP_W.rvol * 1.1
     : rv >= 10 ? EP_W.rvol
     : rv >= 5  ? EP_W.rvol * .85
     : rv >= 3  ? EP_W.rvol * .65
     : rv >= 2  ? EP_W.rvol * .35
     : 0;
  // News freshness
  const nh = s.newsAgeHours;
  if (nh != null)
    t += nh <= 6  ? EP_W.news * 1.2
       : nh <= 24 ? EP_W.news
       : nh <= 48 ? EP_W.news * .55
       : 0;
  // Short interest
  const sp = s.shortPct || 0;
  t += sp >= 40 ? EP_W.short * 1.1
     : sp >= 30 ? EP_W.short
     : sp >= 20 ? EP_W.short * .70
     : 0;
  // Breakout
  let bk = 0;
  if (s.high52 && s.price) {
    const d = (s.price - s.high52) / s.high52 * 100;
    bk += d >= 0 ? 7 : d >= -2 ? 6 : d >= -5 ? 5 : d >= -15 ? 2 : 0;
  }
  if (s.weekHigh && s.price > s.weekHigh) bk += 6;
  t += Math.min(bk, EP_W.breakout);
  // Gap
  const g = s.gapPct || 0;
  t += g >= 30 ? EP_W.gap * 1.2
     : g >= 20 ? EP_W.gap
     : g >= 10 ? EP_W.gap * .75
     : g >= 5  ? EP_W.gap * .45
     : 0;
  // MCap
  const mc = s.mcap;
  if (mc)
    t += mc < 50e6  ? EP_W.mcap
       : mc < 150e6 ? EP_W.mcap * .85
       : mc < 300e6 ? EP_W.mcap * .60
       : mc < 500e6 ? EP_W.mcap * .30
       : 0;
  // Velocity bonus: gap + fresh news + high rvol together
  if ((s.gapPct || 0) >= 10 && (s.newsAgeHours || 999) <= 12 && (s.rvol || 0) >= 5) t += 8;

  return Math.min(Math.round((t / EP_MAX) * 100), 99);
}

const isHot = s =>
  s.ep >= 85 &&
  (s.rvol || 0) >= 5 &&
  s.newsAgeHours != null &&
  s.newsAgeHours <= 24;

// ─── Helpers ─────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function polyGet(path, params = {}) {
  const qs = new URLSearchParams({ ...params, apiKey: POLYGON_KEY }).toString();
  const r  = await fetch(`${BASE}${path}?${qs}`);
  if (!r.ok) throw new Error(`Polygon ${r.status} — ${path}`);
  return r.json();
}

// Concurrency pool: run tasks with max N in-flight
async function pool(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0, done = 0;
  await new Promise(resolve => {
    function launch() {
      while (next < tasks.length && (next - done) < limit) {
        const i = next++;
        tasks[i]()
          .then(v  => { results[i] = v; })
          .catch(() => { results[i] = null; })
          .finally(() => { done++; launch(); if (done === tasks.length) resolve(); });
      }
    }
    launch();
  });
  return results;
}

// ─── Fetch all active tickers (paginated) ────────────────────────
async function fetchAllTickers() {
  let url = `${BASE}/v3/reference/tickers?market=stocks&active=true&type=CS&limit=1000&apiKey=${POLYGON_KEY}`;
  const tickers = [];
  while (url && tickers.length < 9000) {
    const d = await fetch(url).then(r => r.json());
    (d.results || []).forEach(t => tickers.push(t.ticker));
    url = d.next_url ? `${d.next_url}&apiKey=${POLYGON_KEY}` : null;
    await sleep(120);
  }
  return [...new Set(tickers)];
}

// ─── Bulk snapshots (50 per call) ───────────────────────────────
async function fetchSnapshots(tickers) {
  const out = {};
  for (let i = 0; i < tickers.length; i += 50) {
    const chunk = tickers.slice(i, i + 50).join(",");
    try {
      const d = await polyGet("/v2/snapshot/locale/us/markets/stocks/tickers", { tickers: chunk });
      (d.tickers || []).forEach(t => {
        const day = t.day || {}, prev = t.prevDay || {};
        out[t.ticker] = {
          ticker:    t.ticker,
          price:     day.c,
          open:      day.o,
          volume:    day.v,
          vwap:      day.vw,
          prevClose: prev.c,
          changePct: t.todaysChangePerc ?? 0,
        };
      });
    } catch (_) {}
    await sleep(80);
  }
  return out;
}

// ─── Reference data (float, mcap, short%) ────────────────────────
async function fetchRef(ticker) {
  try {
    const d = await polyGet(`/v3/reference/tickers/${ticker}`);
    const r = d.results || {};
    return {
      name:      r.name ?? null,
      float:     r.share_class_shares_outstanding ?? null,
      mcap:      r.market_cap ?? null,
      shortPct:  r.short_percent_of_float ? r.short_percent_of_float * 100 : null,
      sector:    r.sic_description ?? null,
    };
  } catch (_) { return {}; }
}

// ─── Agg history: ATR14, 52W high, week high, avg vol ────────────
async function fetchAggs(ticker) {
  const end   = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 285 * 86400000).toISOString().slice(0, 10);
  try {
    const d = await polyGet(
      `/v2/aggs/ticker/${ticker}/range/1/day/${start}/${end}`,
      { adjusted: "true", sort: "desc", limit: 262 }
    );
    return d.results || [];
  } catch (_) { return []; }
}

// ─── News age ────────────────────────────────────────────────────
async function fetchNews(ticker) {
  try {
    const d = await polyGet("/v2/reference/news", { ticker, limit: 1, order: "desc" });
    const item = (d.results || [])[0];
    if (!item) return null;
    return {
      ageHours: (Date.now() - new Date(item.published_utc).getTime()) / 3600000,
      headline: item.title,
    };
  } catch (_) { return null; }
}

// ─── Supabase upsert ─────────────────────────────────────────────
async function saveSignals(signals) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !signals.length)
    return { skipped: true };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/signals`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer":        "resolution=ignore-duplicates",
    },
    body: JSON.stringify(signals),
  });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
}

// ═══════════════════════════════════════════════════════════════════
//  HANDLER
// ═══════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  // Auth: cron or admin panel only
  const isCron  = req.headers["x-vercel-cron"]  === "true";
  const isAdmin = req.headers["x-admin-scan"]   === "true";
  const secret  = req.headers["x-cron-secret"];
  const validSecret = secret && secret === process.env.CRON_SECRET;

  if (!isCron && !isAdmin && !validSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // ── 1. Full ticker list ──────────────────────────────────────
    const allTickers = await fetchAllTickers();

    // ── 2. Bulk snapshots ────────────────────────────────────────
    const snaps = await fetchSnapshots(allTickers);

    // ── 3. Pre-filter: price $1–$50, change +5–100%, vol >300K ──
    const candidates = Object.values(snaps)
      .filter(s =>
        s.price  && s.price  >= 1  && s.price  <= 50 &&
        s.changePct >= 5 && s.changePct <= 100 &&
        s.volume > 300_000
      )
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 300);

    // ── 4. Enrich via concurrency pool (8 parallel) ──────────────
    const enrichTasks = candidates.map(s => async () => {
      const [ref, aggs, news] = await Promise.all([
        fetchRef(s.ticker),
        fetchAggs(s.ticker),
        fetchNews(s.ticker),
      ]);

      // Derived metrics from aggs
      const recent   = aggs.slice(0, 20);
      const avgVol20 = recent.length ? recent.reduce((a, b) => a + b.v, 0) / recent.length : null;
      const high52   = aggs.length   ? Math.max(...aggs.map(r => r.h)) : null;
      const weekHigh = aggs.slice(0, 5).length ? Math.max(...aggs.slice(0, 5).map(r => r.h)) : null;

      let atr14 = null;
      if (aggs.length >= 15) {
        const trs = aggs.slice(0, 14).map((r, i) => {
          const pc = aggs[i + 1]?.c ?? r.c;
          return Math.max(r.h - r.l, Math.abs(r.h - pc), Math.abs(r.l - pc));
        });
        atr14 = trs.reduce((a, b) => a + b, 0) / trs.length;
      }

      const rvol    = avgVol20 && s.volume ? s.volume / avgVol20 : null;
      const gapPct  = s.prevClose && s.open ? ((s.open - s.prevClose) / s.prevClose) * 100 : null;

      const enriched = {
        ...s, ...ref,
        rvol, gapPct, atr14, avgVol20, high52, weekHigh,
        newsAgeHours: news?.ageHours  ?? null,
        newsHeadline: news?.headline  ?? null,
      };

      enriched.ep = calcEP(enriched);
      return enriched;
    });

    const enriched = (await pool(enrichTasks, 8)).filter(Boolean);

    // ── 5. Filter EP ≥ 45 and sort (HOT first, then EP desc) ────
    const final = enriched
      .filter(s => s.ep >= 45)
      .sort((a, b) => {
        if (isHot(b) !== isHot(a)) return isHot(b) ? 1 : -1;
        return b.ep - a.ep;
      });

    // ── 6. Build Supabase rows ────────────────────────────────────
    const rows = final.filter(s => s.ep >= 60).map(s => {
      const entry = parseFloat((s.price || 0).toFixed(2));
      const atr   = s.atr14 || s.price * 0.02;
      return {
        symbol:          s.ticker,
        entry_price:     entry,
        target1:         parseFloat((entry + atr * 0.5).toFixed(2)),
        target2:         parseFloat((entry + atr * 1.0).toFixed(2)),
        target3:         parseFloat((entry + atr * 1.8).toFixed(2)),
        stop_loss:       parseFloat((entry - atr * 0.8).toFixed(2)),
        score:           s.ep,
        ep:              s.ep,
        rvol:            s.rvol   != null ? parseFloat(s.rvol.toFixed(2))            : null,
        volume:          s.volume || 0,
        change_pct:      parseFloat((s.changePct || 0).toFixed(2)),
        news_age_hours:  s.newsAgeHours != null ? Math.round(s.newsAgeHours)         : null,
        is_hot:          isHot(s),
        type:            s.mcap
                           ? (s.mcap >= 500e6 ? "قيادي" : "مضاربة")
                           : (s.price >= 10   ? "قيادي" : "مضاربة"),
        status:          "OPEN",
      };
    });

    const saveResult = await saveSignals(rows);

    return res.status(200).json({
      success:   true,
      total:     final.length,
      hot:       final.filter(isHot).length,
      saved:     rows.length,
      saveResult,
      results:   final,
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
