// pages/api/scan.js — v12 (Final: Sector Rotation + Relative Strength + Quality)
// ═══════════════════════════════════════════════════════════════════

const POLYGON_KEY = process.env.POLYGON_API_KEY || process.env.POLYGON_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

// ── Config v12 ───────────────────────────────────────────────────
const CFG = {
  BUDGET:          9500,
  MIN_CHANGE:      1.5,
  MIN_PRICE:       0.50,
  MIN_VOLUME:      200000,
  MIN_DOLLARVOL:   1e6,
  HEAVY_LIMIT:     70,           // ← خفض من 80 للسرعة
  BATCH:           30,
  MAX_CONCURRENT:  12,
  AGGS_TIMEOUT:    2800,
  SAVE_MIN_EP:     55,
  MIN_RR:          1.0,
  CAPS: { t1: 8, t2: 20, t3: 35, sl: 8 },
  EARLY_FLOOR:     3,

  HOT:     { EP: 65, RVOL: 5, CHG: 6 },
  REBOUND: { RSI: 45, PRICE: 3, DVOL: 10e6, RET: 8 },
  MAX_CHANGE: 40,

  // Sector Rotation
  SECTOR_BOOST_MAX: 18,
  WEAK_SECTOR_PENALTY: -8,
};

// ── Caches ───────────────────────────────────────────────────────
const CACHE = { 
  aggs: new Map(), 
  sector: new Map() 
};
const CACHE_TTL = 5 * 60 * 1000;

function getCache(key, type = 'aggs') {
  const hit = CACHE[type].get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.data;
  return null;
}

function setCache(key, data, type = 'aggs') {
  if (CACHE[type].size > 400) CACHE[type].clear();
  CACHE[type].set(key, { data, time: Date.now() });
}

// ── Helpers ──────────────────────────────────────────────────────
const nyNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
const sigDate = () => nyNow().toISOString().split("T")[0];
const r2 = (n) => Math.round(n * 100) / 100;

// ── Fetch with timeout ───────────────────────────────────────────
async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(id);
    return null;
  }
}

// ── Concurrent limiter ───────────────────────────────────────────
async function concurrentMap(items, fn, limit = CFG.MAX_CONCURRENT) {
  const results = [];
  const executing = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item)).then(r => {
      executing.splice(executing.indexOf(p), 1);
      return r;
    });
    results.push(p);
    executing.push(p);
    if (executing.length >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}

// ── Market Snapshot ──────────────────────────────────────────────
async function fetchFullMarket(left) {
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.tickers || [];
    } catch (err) {
      if (attempt === 1 || left() < 4500) throw err;
      await new Promise(r => setTimeout(r, 300));
    }
  }
  throw new Error("Failed to fetch market");
}

// ── Daily Aggs ───────────────────────────────────────────────────
async function fetchAggs(symbol, days = 130) {
  const key = `${symbol}:${days}`;
  const cached = getCache(key);
  if (cached) return cached;

  const to = sigDate();
  const from = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=${days}&apiKey=${POLYGON_KEY}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const data = await fetchJson(url, CFG.AGGS_TIMEOUT);
    if (data?.results?.length >= 25) {
      setCache(key, data.results);
      return data.results;
    }
    await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
  }
  return null;
}

// ── Sector Details + Mapping ─────────────────────────────────────
async function getTickerSector(symbol) {
  const cached = getCache(symbol, 'sector');
  if (cached) return cached;

  const url = `https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${POLYGON_KEY}`;
  const data = await fetchJson(url, 1400);
  const sic = data?.results?.sic_code;
  const sector = mapSICToSector(sic);
  
  setCache(symbol, sector, 'sector');
  return sector;
}

function mapSICToSector(sic) {
  if (!sic) return "Other";
  const code = String(sic);

  if (["7370","7372","3674","3663","3571","3577"].includes(code)) return "Technology";
  if (["6020","6211","6311","6331"].includes(code)) return "Financial";
  if (["2834","3841","8062"].includes(code)) return "Healthcare";
  if (["1311","1389","2911"].includes(code)) return "Energy";
  if (["5311","5651","5812"].includes(code)) return "Consumer Cyclical";
  if (["5411","5141"].includes(code)) return "Consumer Defensive";
  if (["3531","3569"].includes(code)) return "Industrials";
  if (["3312","3334"].includes(code)) return "Materials";
  if (["4911","4931"].includes(code)) return "Utilities";
  if (["1520","1540"].includes(code)) return "Real Estate";

  return "Other";
}

// ── Indicators ───────────────────────────────────────────────────
function sma(arr, p) {
  if (!arr || arr.length < p) return null;
  let sum = 0;
  for (let i = arr.length - p; i < arr.length; i++) sum += arr[i];
  return sum / p;
}

function rsi14(closes) {
  if (!closes || closes.length < 15) return null;
  let g = 0, l = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d; else l -= d;
  }
  return l === 0 ? 100 : Math.round(100 - 100 / (1 + (g / 14) / (l / 14)));
}

function atr14(bars) {
  if (!bars || bars.length < 15) return null;
  let sum = 0;
  for (let i = bars.length - 14; i < bars.length; i++) {
    const tr = Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c));
    sum += tr;
  }
  return sum / 14;
}

function ret3m(bars) {
  if (!bars || bars.length < 40) return null;
  const ret = ((bars[bars.length - 1].c - bars[0].c) / bars[0].c) * 100;
  return (ret > 300 || ret < -95) ? null : Math.round(ret);
}

function vcpCheck(bars) {
  if (!bars || bars.length < 30) return { vcp: false, contraction: null };
  const seg = (slice) => {
    let hi = -Infinity, lo = Infinity;
    for (const b of slice) { if (b.h > hi) hi = b.h; if (b.l < lo) lo = b.l; }
    return ((hi - lo) / lo) * 100;
  };
  const r1 = seg(bars.slice(-30, -20));
  const r2 = seg(bars.slice(-20, -10));
  const r3 = seg(bars.slice(-10));
  const ok = r3 < r2 && r2 < r1 && r3 < 12;
  return { vcp: ok, contraction: ok ? Math.round(r3) : null };
}

// ── Scoring Engine v12 ───────────────────────────────────────────
function calculateScore(a, ind, st, marketRegime, sectorBoost) {
  let ep = 32;

  ep += ind.rvol >= 4 ? 18 : ind.rvol >= 2.5 ? 13 : ind.rvol >= 1.5 ? 7 : 0;
  ep += (ind.rsi >= 45 && ind.rsi <= 72) ? 12 : 0;
  ep += (ind.ma21 && a.price > ind.ma21 && ind.ma21 > (ind.ma50 || 0)) ? 14 : 0;
  ep += ind.vcp.vcp ? 9 : 0;
  ep += st?.flag === "دخول صحيح ✅" ? 8 : (st ? 3 : 0);
  ep += marketRegime === "قوي" ? 3 : 0;
  ep += (a.change_pct >= 8 && ind.rvol >= 3) ? 7 : 0;

  // Sector Rotation Boost
  ep += sectorBoost || 0;

  return Math.min(99, Math.round(ep));
}

// ── Structure Builder ────────────────────────────────────────────
function buildStructure(price, bars, ind) {
  if (!bars || bars.length < 30 || !price) return null;

  const cap = (v, maxPct) => Math.min(v, price * (1 + maxPct / 100));
  const capDn = (v, maxPct) => Math.max(v, price * (1 - maxPct / 100));

  let hi20 = -Infinity, lo20 = Infinity;
  for (const b of bars.slice(-20)) { if (b.h > hi20) hi20 = b.h; if (b.l < lo20) lo20 = b.l; }

  const atr = ind.atr || (price * 0.03);
  const atrPct = r2((atr / price) * 100);

  const support = capDn(lo20, 12);
  const stop = capDn(Math.min(support * 0.995, price * (1 - CFG.CAPS.sl / 100)), CFG.CAPS.sl);
  const entry = r2(Math.min(price, (support + price) / 2));
  const confirm = r2(Math.min(price * 1.01, hi20 * 1.001));
  const resistance = r2(Math.max(hi20, price * 1.02));

  const t1 = r2(cap(price * (1 + Math.min(CFG.CAPS.t1, Math.max(3, atrPct * 1.2)) / 100), CFG.CAPS.t1));
  const t2 = r2(cap(price * (1 + Math.min(CFG.CAPS.t2, Math.max(8, atrPct * 2.5)) / 100), CFG.CAPS.t2));
  const t3 = r2(cap(price * (1 + Math.min(CFG.CAPS.t3, Math.max(14, atrPct * 4)) / 100), CFG.CAPS.t3));

  const risk = price - stop;
  const reward = t2 - price;
  const rr = risk > 0 ? r2(reward / risk) : null;
  if (rr == null || rr < CFG.MIN_RR) return null;

  const aboveMA = ind.ma21 != null && price > ind.ma21;
  const trend = aboveMA && ind.ma21 > (ind.ma50 || 0) ? "صاعد مؤكد ✅"
              : aboveMA ? "ينتظر تأكيد ⏳" : "هابط بلا تأكيد ⛔";

  let flag = "ملاحقة/غير مؤكد ⚠️";
  if (price > support && price <= confirm * 1.01 && rr >= CFG.MIN_RR) flag = "دخول صحيح ✅";
  else if (aboveMA && rr >= CFG.MIN_RR) flag = "مقبول";

  const pctOf = (v) => r2(((v - price) / price) * 100);

  return {
    rr, t1, t2, t3, flag, trend, atrPct,
    peak: r2(cap(resistance * 1.12, CFG.CAPS.t3 + 15)),
    stop: r2(stop), entry, confirm, support: r2(support), resistance,
    liquidity: r2(cap(resistance * 1.06, CFG.CAPS.t3 + 10)),
    t1Pct: pctOf(t1), t2Pct: pctOf(t2), t3Pct: pctOf(t3),
    stopPct: pctOf(stop), entryPct: pctOf(entry), confirmPct: pctOf(confirm),
    supportPct: pctOf(support), resistancePct: pctOf(resistance),
    posInBand: r2((price - support) / Math.max(0.01, resistance - support)),
  };
}

// ── Save ─────────────────────────────────────────────────────────
async function saveSignals(rows, left, debug) {
  if (!rows.length) return { saved: 0, status: 0 };
  const timeout = Math.max(700, Math.min(1600, left() - 500));
  if (timeout < 700) return { saved: 0, status: 0 };

  const payload = rows.map(s => ({
    symbol: s.symbol,
    signal_date: sigDate(),
    entry_price: s.price,
    target1: s.levels.t1, target2: s.levels.t2, target3: s.levels.t3,
    stop_loss: s.levels.sl,
    score: s.score,
    volume: s.volume,
    change_pct: s.change_pct,
    type: s.type,
    status: "OPEN",
    rvol: s.rvol, rsi: s.rsi, atr14: s.atr14,
    ma_signal: s.ma_signal,
    news_age_h: s.news_age_h,
    is_hot: s.is_hot,
    early_watch: s.early_watch,
    is_target: s.is_target,
    vcp: s.vcp, vcp_contraction: s.vcp_contraction,
    fresh_zone: s.fresh_zone || false,
    premarket_watch: s.premarket_watch || false,
    structure: s.structure,
    is_smart_bounce: false,
    smart_bounce_confidence: 0,
    sector: s.sector || null,
  }));

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?on_conflict=symbol,signal_date`,
      {
        method: "POST",
        signal: AbortSignal.timeout(timeout),
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(payload),
      }
    );
    return { saved: res.ok ? payload.length : 0, status: res.status };
  } catch {
    debug.save_timeout = true;
    return { saved: 0, status: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  const T0 = Date.now();
  const left = () => CFG.BUDGET - (Date.now() - T0);
  const light = req.query.light === "1";

  const debug = {
    market_scanned: 0, market_regime: null, after_filter: 0, top_selected: 0,
    tech_analyzed: 0, news_fetched: 0, saved: 0,
    dropped_penny_gate: 0, dropped_trend_gate: 0, dropped_no_tech: 0,
    dropped_timeout: 0, dropped_extreme_gain: 0, dropped_strict_gems: 0,
    dropped_stretch: 0, sector_fetched: 0,
  };

  try {
    // Stage 1: Market
    const tickers = await fetchFullMarket(left);
    debug.market_scanned = tickers.length;

    const spy = tickers.find(t => t.ticker === "SPY");
    const marketChange = spy?.todaysChangePerc ?? 0;
    debug.market_regime = marketChange >= 0 ? "قوي" : "ضعيف";

    // Stage 2: Primary Filter
    const cand = [];
    for (const t of tickers) {
      const d = t.day || {};
      const price = d.c || t.lastTrade?.p || 0;
      const vol = d.v || 0;
      const chg = t.todaysChangePerc ?? 0;

      if (!price || !vol) continue;
      if (price < CFG.MIN_PRICE) { debug.dropped_penny_gate++; continue; }
      if (Math.abs(chg) < CFG.MIN_CHANGE) continue;
      if (vol < CFG.MIN_VOLUME || price * vol < CFG.MIN_DOLLARVOL) continue;
      if (chg > CFG.MAX_CHANGE) { debug.dropped_extreme_gain++; continue; }
      if (/[.\-]|W$/.test(t.ticker) || t.ticker.length > 5) continue;

      cand.push({ symbol: t.ticker, price: r2(price), change_pct: r2(chg), volume: vol, dollar_vol: r2(price * vol) });
    }
    debug.after_filter = cand.length;

    const heavy = cand
      .sort((a, b) => (b.change_pct * Math.log10(b.dollar_vol)) - (a.change_pct * Math.log10(a.dollar_vol)))
      .slice(0, CFG.HEAVY_LIMIT);
    debug.top_selected = heavy.length;

    // Stage 3: Sector + Technical (Concurrent)
    const analyzed = [];
    if (heavy.length > 0 && left() > 2800) {
      const results = await concurrentMap(heavy, async (c) => {
        const [bars, sector] = await Promise.all([
          fetchAggs(c.symbol),
          getTickerSector(c.symbol)
        ]);
        debug.sector_fetched++;

        if (!bars || bars.length < 30) {
          debug.dropped_no_tech++;
          return null;
        }

        const closes = bars.map(b => b.c);
        const vols = bars.map(b => b.v);

        const ind = {
          ma21: sma(closes, 21),
          ma50: sma(closes, 50),
          rsi: rsi14(closes),
          atr: atr14(bars),
          rvol: (() => { const avg = sma(vols.slice(0, -1), 20); return avg ? r2(c.volume / avg) : null; })(),
          ret3m: ret3m(bars),
          vcp: vcpCheck(bars),
        };

        return { ...c, bars, ind, sector };
      }, CFG.MAX_CONCURRENT);

      for (const r of results) if (r) analyzed.push(r);
    }
    debug.tech_analyzed = analyzed.length;

    // Stage 4: Sector Strength Calculation
    const sectorStats = new Map();
    for (const a of analyzed) {
      if (!a.sector) continue;
      if (!sectorStats.has(a.sector)) sectorStats.set(a.sector, { totalChange: 0, count: 0 });
      const s = sectorStats.get(a.sector);
      s.totalChange += a.change_pct;
      s.count++;
    }
    sectorStats.forEach(s => {
      s.avgChange = s.totalChange / s.count;
      s.relativeStrength = s.avgChange - marketChange;
      s.boost = Math.max(0, Math.min(CFG.SECTOR_BOOST_MAX, Math.round(s.relativeStrength * 1.8)));
    });

    // Stage 5: Scoring + Structure
    const signals = [];
    for (const a of analyzed) {
      const { ind } = a;

      if (ind.ma21 == null || a.price < ind.ma21 * 0.95) { debug.dropped_trend_gate++; continue; }
      if ((ind.rsi ?? 50) > 85 || (ind.rvol ?? 1) < 0.6) { debug.dropped_strict_gems++; continue; }
      if (a.change_pct > 30 && (ind.rvol ?? 0) < 2) { debug.dropped_stretch++; continue; }

      const st = buildStructure(a.price, a.bars, ind);
      const sectorData = sectorStats.get(a.sector) || { boost: 0, relativeStrength: 0 };

      // Penalty for very weak sectors
      let sectorBoost = sectorData.boost;
      if (sectorData.relativeStrength < -2.5) sectorBoost = CFG.WEAK_SECTOR_PENALTY;

      const score = calculateScore(a, ind, st, debug.market_regime, sectorBoost);

      const isHot = score >= CFG.HOT.EP && (ind.rvol ?? 0) >= CFG.HOT.RVOL && a.change_pct >= CFG.HOT.CHG;
      const isRebound = (ind.rsi ?? 99) < CFG.REBOUND.RSI && a.price >= CFG.REBOUND.PRICE && a.dollar_vol >= CFG.REBOUND.DVOL && (ind.ret3m ?? 0) >= CFG.REBOUND.RET;
      const isTarget = st != null && st.flag === "دخول صحيح ✅" && score >= 65;
      const early = a.price >= CFG.EARLY_FLOOR && a.change_pct >= 2 && a.change_pct <= 15 && ind.vcp.vcp && st != null;

      const signalLabel = a.change_pct > 25 
        ? (score >= 80 ? "💥 انفجاري" : "🔥 عالي جداً ⚠️")
        : (score >= 80 ? "💥 انفجاري" : score >= 65 ? "🔥 عالي" : "📊 متوسط");

      signals.push({
        symbol: a.symbol,
        price: a.price,
        change_pct: a.change_pct,
        volume: a.volume,
        dollar_vol: a.dollar_vol,
        score,
        rvol: ind.rvol,
        rsi: ind.rsi,
        atr14: ind.atr ? r2(ind.atr) : null,
        ret3m: ind.ret3m,
        ma_signal: ind.ma21 && ind.ma50 ? (ind.ma21 > ind.ma50 ? "فوق MA21/50" : "بين المتوسطات") : null,
        vcp: ind.vcp.vcp,
        vcp_contraction: ind.vcp.contraction,
        is_hot: isHot,
        early_watch: early,
        is_target: isTarget,
        is_rebound: isRebound,
        type: isRebound ? "ارتداد" : (a.dollar_vol >= 50e6 && score >= 60 ? "استثمار" : "مضاربة"),
        signal: signalLabel,
        news_age_h: null,
        sector: a.sector,
        sector_boost: sectorBoost,
        sector_relative_strength: sectorData.relativeStrength,
        levels: st ? { t1: st.t1, t1Pct: st.t1Pct, t2: st.t2, t2Pct: st.t2Pct, t3: st.t3, t3Pct: st.t3Pct, sl: st.stop, slPct: st.stopPct, risk: Math.abs(st.stopPct) } : null,
        structure: st,
        is_extreme_gain: a.change_pct > 25,
      });
    }

    // Stage 6: News
    if (left() >= 1300 && signals.length) {
      const newsTargets = signals.filter(s => s.is_hot || s.is_target).slice(0, 5);
      await Promise.all(newsTargets.map(async (s) => {
        const data = await fetchJson(`https://api.polygon.io/v2/reference/news?ticker=${s.symbol}&limit=1&apiKey=${POLYGON_KEY}`, 1000);
        const art = data?.results?.[0];
        if (art?.published_utc) {
          s.news_age_h = Math.round((Date.now() - new Date(art.published_utc)) / 3600000);
          debug.news_fetched++;
        }
      }));
    }

    // Stage 7: Save
    const toSave = signals.filter(s => s.score >= CFG.SAVE_MIN_EP && s.structure);
    const saveResult = await saveSignals(toSave, left, debug);
    debug.saved = saveResult.saved;

    // Response
    const response = {
      success: true,
      total: signals.length,
      market_regime: debug.market_regime,
      hot: signals.filter(s => s.is_hot).length,
      target: signals.filter(s => s.is_target).length,
      early: signals.filter(s => s.early_watch).length,
      rebound: signals.filter(s => s.is_rebound).length,
      saved: saveResult.saved,
      elapsed_ms: Date.now() - T0,
      debug,
    };

    return res.status(200).json(light ? { ...response, light: true } : { ...response, results: signals });

  } catch (err) {
    return res.status(200).json({
      success: false,
      error: err.message,
      elapsed_ms: Date.now() - T0,
      debug,
    });
  }
}
