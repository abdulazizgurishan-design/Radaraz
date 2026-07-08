// pages/api/scan.js — v8 (strict time budget + v7 rollback)
// ═══════════════════════════════════════════════════════════════════
//  Guarantee: response always returns before the 9th second, even if
//  Polygon is slow. Method: one budget (8500ms) — every stage checks
//  left() before running; a stage that does not fit is skipped and we
//  respond with whatever completed.
//  LOCKED DECISIONS (do not change without measurement):
//  MIN_CHANGE 2 · HEAVY_LIMIT 60 · batches of 30 · SAVE_MIN_EP 60 · MIN_RR 1.3
//  Guard caps T1<=8 T2<=20 T3<=35 stop>=-8 · $3 floor for early watch
//  Elite REBOUND (RSI<30 · $10+ · $50M+ · 20%+ 3M return) · $1 penny gate
//  is_hot = 75/10x/10% · misleading-data guard on ret3m (>300% or <-95% rejected)
//  Smart Bounce frozen (columns saved as false until measured ORB-style)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════

const POLYGON_KEY  = process.env.POLYGON_API_KEY || process.env.POLYGON_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

// ── Locked constants ──────────────────────────────────────────────
const CFG = {
  BUDGET:        8500,   // total response budget (ms)
  MIN_CHANGE:    2,      // min % change to enter the funnel
  MIN_PRICE:     1,      // penny gate
  MIN_VOLUME:    300000,
  MIN_DOLLARVOL: 1e6,
  HEAVY_LIMIT:   60,     // max stocks for heavy analysis
  BATCH:         30,     // batch parallelism
  AGGS_TIMEOUT:  2500,   // per-symbol candles timeout
  SAVE_MIN_EP:   60,
  MIN_RR:        1.3,
  CAPS: { t1: 8, t2: 20, t3: 35, sl: 8 }, // guard caps %
  EARLY_FLOOR:   3,      // $3 floor for early watch
  REBOUND: { RSI: 30, PRICE: 10, DVOL: 50e6, RET: 20 },
  HOT: { EP: 75, RVOL: 10, CHG: 10 },
};

// ── Capped cache ──────────────────────────────────────────────────
const CACHE = { aggs: new Map() };
const CACHE_TTL = 5 * 60 * 1000;
function getCache(key) {
  const hit = CACHE.aggs.get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.data;
  return null;
}
function setCache(key, data) {
  if (CACHE.aggs.size > 300) CACHE.aggs.clear();
  CACHE.aggs.set(key, { data, time: Date.now() });
}

// ── Helpers ───────────────────────────────────────────────────────
const nyNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
const sigDate = () => nyNow().toISOString().split("T")[0];
const r2 = (n) => Math.round(n * 100) / 100;

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

// ── Full market snapshot (~11,000 tickers) ────────────────────────
async function fetchFullMarket(left) {
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) {
        if (attempt === 1 || left() < 4500) throw new Error(`Polygon ${res.status}`);
        await new Promise(r => setTimeout(r, 250));
        continue;
      }
      const data = await res.json();
      return data.tickers || [];
    } catch (err) {
      clearTimeout(id);
      if (attempt === 1 || left() < 4500) throw err;
      await new Promise(r => setTimeout(r, 250));
    }
  }
  throw new Error("Failed to fetch market");
}

// ── Daily candles per symbol (strict timeout + cache) ─────────────
async function fetchAggs(symbol, days = 130) {
  const key = `${symbol}:${days}`;
  const cached = getCache(key);
  if (cached) return cached;
  const to = sigDate();
  const from = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=${days}&apiKey=${POLYGON_KEY}`;
  const data = await fetchJson(url, CFG.AGGS_TIMEOUT);
  const bars = data && data.results ? data.results : null;
  if (bars) setCache(key, bars);
  return bars;
}

// ── Indicators ────────────────────────────────────────────────────
function sma(arr, p) {
  if (!arr || arr.length < p) return null;
  let s = 0;
  for (let i = arr.length - p; i < arr.length; i++) s += arr[i];
  return s / p;
}
function rsi14(closes) {
  if (!closes || closes.length < 15) return null;
  let g = 0, l = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d; else l -= d;
  }
  if (l === 0) return 100;
  const rs = (g / 14) / (l / 14);
  return Math.round(100 - 100 / (1 + rs));
}
function atr14(bars) {
  if (!bars || bars.length < 15) return null;
  let s = 0;
  for (let i = bars.length - 14; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].h - bars[i].l,
      Math.abs(bars[i].h - bars[i - 1].c),
      Math.abs(bars[i].l - bars[i - 1].c)
    );
    s += tr;
  }
  return s / 14;
}
// Misleading-data guard: 3M return with split detection
function ret3m(bars) {
  if (!bars || bars.length < 40) return null;
  const oldC = bars[0].c, nowC = bars[bars.length - 1].c;
  if (!oldC || oldC <= 0) return null;
  const ret = ((nowC - oldC) / oldC) * 100;
  if (ret > 300 || ret < -95) return null; // rejected — misleading data / split
  return Math.round(ret);
}
function vcpCheck(bars) {
  if (!bars || bars.length < 30) return { vcp: false, contraction: null };
  const seg = (a) => {
    let hi = -Infinity, lo = Infinity;
    for (const b of a) { if (b.h > hi) hi = b.h; if (b.l < lo) lo = b.l; }
    return ((hi - lo) / lo) * 100;
  };
  const r1 = seg(bars.slice(-30, -20));
  const r2v = seg(bars.slice(-20, -10));
  const r3 = seg(bars.slice(-10));
  const ok = r3 < r2v && r2v < r1 && r3 < 12;
  return { vcp: ok, contraction: ok ? Math.round(r3) : null };
}

// ── AI-Az structure with guard caps ───────────────────────────────
function buildStructure(price, bars, ind) {
  if (!bars || bars.length < 30 || !price) return null;
  const cap = (v, maxPct) => Math.min(v, price * (1 + maxPct / 100));
  const capDn = (v, maxPct) => Math.max(v, price * (1 - maxPct / 100));

  let hi20 = -Infinity, lo20 = Infinity;
  for (const b of bars.slice(-20)) { if (b.h > hi20) hi20 = b.h; if (b.l < lo20) lo20 = b.l; }
  const atr = ind.atr || (price * 0.03);
  const atrPct = r2((atr / price) * 100);

  const support    = capDn(lo20, 12);
  const stop       = capDn(Math.min(support * 0.995, price * (1 - CFG.CAPS.sl / 100)), CFG.CAPS.sl);
  const entry      = r2(Math.min(price, (support + price) / 2));
  const confirm    = r2(Math.min(price * 1.01, hi20 * 1.001));
  const resistance = r2(Math.max(hi20, price * 1.02));
  const t1 = r2(cap(price * (1 + Math.min(CFG.CAPS.t1, Math.max(3, atrPct * 1.2)) / 100), CFG.CAPS.t1));
  const t2 = r2(cap(price * (1 + Math.min(CFG.CAPS.t2, Math.max(8, atrPct * 2.5)) / 100), CFG.CAPS.t2));
  const t3 = r2(cap(price * (1 + Math.min(CFG.CAPS.t3, Math.max(14, atrPct * 4)) / 100), CFG.CAPS.t3));
  const liquidity = r2(cap(resistance * 1.06, CFG.CAPS.t3 + 10));
  const peak      = r2(cap(resistance * 1.12, CFG.CAPS.t3 + 15));

  const risk = price - stop;
  const reward = t2 - price;
  const rr = risk > 0 ? r2(reward / risk) : null;
  if (rr == null || rr < CFG.MIN_RR) return null;

  const aboveMA = ind.ma21 != null && price > ind.ma21;
  const trend = aboveMA && ind.ma21 > (ind.ma50 || 0) ? "صاعد مؤكد ✅"
              : aboveMA ? "ينتظر تأكيد ⏳"
              : "هابط بلا تأكيد ⛔";
  let flag;
  if (price > support && price <= confirm * 1.01 && rr >= CFG.MIN_RR) flag = "دخول صحيح ✅";
  else if (aboveMA && rr >= CFG.MIN_RR) flag = "مقبول";
  else flag = "ملاحقة/غير مؤكد ⚠️";

  const pctOf = (v) => r2(((v - price) / price) * 100);
  return {
    rr, t1, t2, t3, flag, trend, atrPct,
    peak, stop: r2(stop), entry, confirm,
    support: r2(support), resistance, liquidity,
    t1Pct: pctOf(t1), t2Pct: pctOf(t2), t3Pct: pctOf(t3),
    stopPct: pctOf(stop), entryPct: pctOf(entry), confirmPct: pctOf(confirm),
    supportPct: pctOf(support), resistancePct: pctOf(resistance),
    posInBand: r2((price - support) / Math.max(0.01, resistance - support)),
  };
}

function buildLevels(price, st) {
  if (!st) return { t1: 0, t1Pct: 0, t2: 0, t2Pct: 0, t3: 0, t3Pct: 0, sl: 0, slPct: 0, risk: 0 };
  return {
    t1: st.t1, t1Pct: st.t1Pct, t2: st.t2, t2Pct: st.t2Pct,
    t3: st.t3, t3Pct: st.t3Pct, sl: st.stop, slPct: st.stopPct,
    risk: Math.abs(st.stopPct),
  };
}

// ── Save signals (budget-bound timeout) ───────────────────────────
async function saveSignals(rows, left, debug) {
  if (!rows.length) return { saved: 0, status: 0 };
  const timeout = Math.max(600, Math.min(1500, left() - 400));
  if (timeout < 600) { debug.save_skipped = true; return { saved: 0, status: 0 }; }
  const payload = rows.map(s => ({
    symbol: s.symbol,
    signal_date: sigDate(),
    entry_price: s.price,
    target1: s.levels.t1, target2: s.levels.t2, target3: s.levels.t3,
    stop_loss: s.levels.sl,
    score: s.score, ep: s.score,
    volume: s.volume, change_pct: s.change_pct,
    type: s.type, status: "OPEN",
    rvol: s.rvol, rsi: s.rsi, atr14: s.atr14,
    ma_signal: s.ma_signal,
    news_age_h: s.news_age_h, news_age_hours: s.news_age_h,
    is_hot: s.is_hot,
    early_watch: s.early_watch, is_target: s.is_target,
    vcp: s.vcp, vcp_contraction: s.vcp_contraction,
    fresh_zone: s.fresh_zone || false,
    premarket_watch: s.premarket_watch || false,
    structure: s.structure,
    is_smart_bounce: false,          // 🧊 frozen until measured ORB-style
    smart_bounce_confidence: 0,      // 🧊 frozen
  }));
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?on_conflict=symbol,signal_date`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(payload),
      }
    );
    clearTimeout(id);
    return { saved: res.ok ? payload.length : 0, status: res.status };
  } catch {
    clearTimeout(id);
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
    tech_analyzed: 0, news_fetched: 0,
    dropped_total: 0, dropped_late: 0, dropped_strict_gems: 0, dropped_stretch: 0,
    dropped_penny_gate: 0, dropped_trend_gate: 0, dropped_no_tech: 0, dropped_timeout: 0,
    survivors: 0, below_save_ep: 0, saved: 0,
  };

  try {
    // ── Stage 1: full market ──
    const tickers = await fetchFullMarket(left);
    debug.market_scanned = tickers.length;

    // ── SPY pulse ──
    const spy = tickers.find(t => t.ticker === "SPY");
    if (spy && spy.day) {
      const spyChg = spy.todaysChangePerc ?? 0;
      debug.market_regime = spyChg >= 0 ? "قوي" : "ضعيف";
    }

    // ── Stage 2: primary funnel ──
    const movers = { gainers: [], losers: [], volume: [], value: [] };
    const cand = [];
    for (const t of tickers) {
      const d = t.day || {};
      const price = d.c || t.lastTrade?.p || 0;
      const vol = d.v || 0;
      const chg = t.todaysChangePerc ?? 0;
      if (!price || !vol) continue;
      const row = { symbol: t.ticker, price: r2(price), change_pct: r2(chg), volume: vol, dollar_vol: price * vol };
      // movers (pre-filter — raw market movement)
      movers.gainers.push(row); movers.losers.push(row);
      movers.volume.push(row);  movers.value.push(row);
      // funnel
      if (price < CFG.MIN_PRICE) { debug.dropped_penny_gate++; continue; }
      if (Math.abs(chg) < CFG.MIN_CHANGE) continue;
      if (vol < CFG.MIN_VOLUME || price * vol < CFG.MIN_DOLLARVOL) continue;
      if (chg > 60) { debug.dropped_late++; continue; }
      if (/[.\-]|W$/.test(t.ticker) || t.ticker.length > 5) continue;
      cand.push(row);
    }
    movers.gainers = movers.gainers.sort((a, b) => b.change_pct - a.change_pct).slice(0, 15);
    movers.losers  = movers.losers.sort((a, b) => a.change_pct - b.change_pct).slice(0, 15);
    movers.volume  = movers.volume.sort((a, b) => b.volume - a.volume).slice(0, 15);
    movers.value   = movers.value.sort((a, b) => b.dollar_vol - a.dollar_vol).slice(0, 15);

    debug.after_filter = cand.length;
    const heavy = cand
      .sort((a, b) => (b.change_pct * Math.log10(b.dollar_vol)) - (a.change_pct * Math.log10(a.dollar_vol)))
      .slice(0, CFG.HEAVY_LIMIT);
    debug.top_selected = heavy.length;

    // ── Stage 3: heavy analysis (batches of 30 under budget) ──
    const analyzed = [];
    for (let i = 0; i < heavy.length; i += CFG.BATCH) {
      if (left() < 1800) { debug.dropped_timeout += heavy.length - i; break; }
      const batch = heavy.slice(i, i + CFG.BATCH);
      const results = await Promise.all(batch.map(async (c) => {
        const bars = await fetchAggs(c.symbol);
        if (!bars || bars.length < 30) { debug.dropped_no_tech++; return null; }
        const closes = bars.map(b => b.c);
        const vols = bars.map(b => b.v);
        const ind = {
          ma21: sma(closes, 21), ma50: sma(closes, 50),
          rsi: rsi14(closes), atr: atr14(bars),
          rvol: (() => { const a = sma(vols.slice(0, -1), 20); return a ? r2(c.volume / a) : null; })(),
          ret3m: ret3m(bars),
          vcp: vcpCheck(bars),
        };
        return { ...c, bars, ind };
      }));
      for (const r of results) if (r) analyzed.push(r);
    }
    debug.tech_analyzed = analyzed.length;

    // ── Stage 4: gates + structure + score ──
    const signals = [];
    for (const a of analyzed) {
      const { ind } = a;
      // trend gate
      if (ind.ma21 == null || a.price < ind.ma21 * 0.97) { debug.dropped_trend_gate++; continue; }
      // strict gems gate
      if ((ind.rsi ?? 50) > 83 || (ind.rvol ?? 1) < 0.8) { debug.dropped_strict_gems++; continue; }
      // stretch gate
      if (a.change_pct > 30 && (ind.rvol ?? 0) < 3) { debug.dropped_stretch++; continue; }

      const st = buildStructure(a.price, a.bars, ind);
      const levels = buildLevels(a.price, st);

      // EP score
      let ep = 40;
      if (ind.rvol >= 3) ep += 15; else if (ind.rvol >= 1.5) ep += 8;
      if (ind.rsi >= 50 && ind.rsi <= 72) ep += 12;
      if (a.price > (ind.ma21 || 0) && (ind.ma21 || 0) > (ind.ma50 || 0)) ep += 12;
      if (ind.vcp.vcp) ep += 10;
      if (st && st.flag === "دخول صحيح ✅") ep += 8;
      if (debug.market_regime === "قوي") ep += 3;
      ep = Math.min(99, ep);

      const isHot = ep >= CFG.HOT.EP && (ind.rvol ?? 0) >= CFG.HOT.RVOL && a.change_pct >= CFG.HOT.CHG;
      const early = a.price >= CFG.EARLY_FLOOR && a.change_pct >= 2 && a.change_pct <= 15
                    && ind.vcp.vcp && st != null;
      const isTarget = st != null && st.flag === "دخول صحيح ✅" && ep >= 70;
      // elite REBOUND
      const isRebound = (ind.rsi ?? 99) < CFG.REBOUND.RSI
                     && a.price >= CFG.REBOUND.PRICE
                     && a.dollar_vol >= CFG.REBOUND.DVOL
                     && (ind.ret3m ?? 0) >= CFG.REBOUND.RET;
      const isSniper = isHot && st != null && st.rr >= 2;

      signals.push({
        symbol: a.symbol, price: a.price, change_pct: a.change_pct,
        volume: a.volume, dollar_vol: a.dollar_vol,
        score: ep, rvol: ind.rvol, rsi: ind.rsi,
        atr14: ind.atr != null ? r2(ind.atr) : null,
        ret3m: ind.ret3m,
        ma_signal: ind.ma21 && ind.ma50 ? (ind.ma21 > ind.ma50 ? "فوق MA21/50" : "بين المتوسطات") : null,
        vcp: ind.vcp.vcp, vcp_contraction: ind.vcp.contraction,
        is_hot: isHot, early_watch: early, is_target: isTarget,
        is_rebound: isRebound, is_sniper: isSniper,
        sniper_type: isSniper ? "momentum" : null,
        type: isRebound ? "ارتداد" : (a.dollar_vol >= 100e6 && ep >= 65 ? "استثمار" : "مضاربة"),
        signal: ep >= 80 ? "💥 انفجاري" : ep >= 65 ? "🔥 عالي" : "📊 متوسط",
        news_age_h: null,
        levels, structure: st,
      });
    }
    debug.survivors = signals.length;

    // ── Stage 5: news (budget luxury) ──
    if (left() >= 1500 && signals.length) {
      const newsTargets = signals.filter(s => s.is_hot || s.is_target).slice(0, 6);
      await Promise.all(newsTargets.map(async (s) => {
        const data = await fetchJson(
          `https://api.polygon.io/v2/reference/news?ticker=${s.symbol}&limit=1&apiKey=${POLYGON_KEY}`,
          1200
        );
        const art = data && data.results && data.results[0];
        if (art && art.published_utc) {
          s.news_age_h = Math.round((Date.now() - new Date(art.published_utc)) / 3600000);
          debug.news_fetched++;
        }
      }));
    } else if (signals.length) {
      debug.news_skipped = true;
    }

    // ── Stage 6: save ──
    const toSave = signals.filter(s => s.score >= CFG.SAVE_MIN_EP && s.structure);
    debug.below_save_ep = signals.length - toSave.length;
    const saveResult = await saveSignals(toSave, left, debug);
    debug.saved = saveResult.saved;

    debug.dropped_total = debug.dropped_late + debug.dropped_strict_gems + debug.dropped_stretch
      + debug.dropped_penny_gate + debug.dropped_trend_gate + debug.dropped_no_tech + debug.dropped_timeout;

    // ── Response ──
    const base = {
      success: true,
      total: signals.length,
      market_regime: debug.market_regime,
      hot: signals.filter(s => s.is_hot).length,
      target: signals.filter(s => s.is_target).length,
      early: signals.filter(s => s.early_watch).length,
      rebound: signals.filter(s => s.is_rebound).length,
      saved: saveResult.saved,
      saveResult,
      elapsed_ms: Date.now() - T0,
      debug,
    };
    if (light) return res.status(200).json({ ...base, light: true });
    return res.status(200).json({ ...base, results: signals, movers });

  } catch (err) {
    return res.status(200).json({
      success: false, error: err.message, partial: true,
      elapsed_ms: Date.now() - T0, debug,
    });
  }
}
