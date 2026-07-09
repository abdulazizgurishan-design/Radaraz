// pages/api/scan.js — v17 (محدث كامل من v8 + Technical Indicators + Volume + Classification)
const technicalindicators = require('technicalindicators');

const POLYGON_KEY  = process.env.POLYGON_API_KEY || process.env.POLYGON_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

// ── Locked constants (محدثة) ─────────────────────────────────────
const CFG = {
  BUDGET:        9400,
  MIN_CHANGE:    1.5,
  MIN_PRICE:     0.50,
  MIN_VOLUME:    200000,
  MIN_DOLLARVOL: 1e6,
  HEAVY_LIMIT:   68,
  BATCH:         30,
  AGGS_TIMEOUT:  2800,
  SAVE_MIN_EP:   52,
  MIN_RR:        1.5,
  CAPS: { t1: 8, t2: 20, t3: 35, sl: 8 },
  EARLY_FLOOR:   3,
  HOT: { EP: 68, RVOL: 4.5, CHG: 7 },
  REBOUND: { RSI: 44, PRICE: 3, DVOL: 9e6, RET: 7 },
  MAX_CHANGE: 40,
  SECTOR_BOOST_MAX: 18,
  WEAK_SECTOR_PENALTY: -10,
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

// fetchFullMarket, fetchAggs, getTickerSector, mapSICToSector, buildStructure, buildLevels, saveSignals (ابقِها من v8)

async function calculateTechnicalIndicators(bars) {
  if (!bars || bars.length < 30) return {};
  const closes = bars.map(b => b.c);
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);
  const vols = bars.map(b => b.v);

  return {
    rsi: technicalindicators.RSI.calculate({ period: 14, values: closes }).slice(-1)[0],
    macd: technicalindicators.MACD.calculate({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, values: closes }).slice(-1)[0],
    bbands: technicalindicators.BollingerBands.calculate({ period: 20, stdDev: 2, values: closes }).slice(-1)[0],
    atr: technicalindicators.ATR.calculate({ high: highs, low: lows, close: closes, period: 14 }).slice(-1)[0],
    stoch: technicalindicators.Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 }).slice(-1)[0],
    ema21: technicalindicators.EMA.calculate({ period: 21, values: closes }).slice(-1)[0],
    obv: technicalindicators.OBV.calculate({ close: closes, volume: vols }).slice(-1)[0],
    volumeOsc: (() => {
      const short = technicalindicators.SMA.calculate({ period: 5, values: vols }).slice(-1)[0];
      const long = technicalindicators.SMA.calculate({ period: 20, values: vols }).slice(-1)[0];
      return short && long ? r2((short - long) / long * 100) : null;
    })(),
    vwap: (() => {
      let sumPV = 0, sumV = 0;
      for (let i = Math.max(0, bars.length - 20); i < bars.length; i++) {
        const typical = (bars[i].h + bars[i].l + bars[i].c) / 3;
        sumPV += typical * bars[i].v;
        sumV += bars[i].v;
      }
      return sumV ? r2(sumPV / sumV) : null;
    })(),
  };
}

function calculateScore(a, ind, st, marketRegime, sectorData) {
  let ep = 35;
  ep += ind.rvol >= 4.5 ? 18 : ind.rvol >= 2.8 ? 13 : ind.rvol >= 1.6 ? 7 : 0;
  ep += (ind.rsi >= 44 && ind.rsi <= 73) ? 13 : 0;
  ep += (ind.ema21 && a.price > ind.ema21 && ind.ema21 > (ind.ema50 || 0)) ? 15 : 0;
  ep += (ind.vcp?.vcp || false) ? 10 : 0;
  ep += st?.flag === "دخول صحيح ✅" ? 9 : (st ? 4 : 0);
  ep += marketRegime === "قوي" ? 4 : 0;
  ep += (a.change_pct >= 8 && ind.rvol >= 3) ? 8 : 0;
  ep += sectorData.boost || 0;
  ep += (ind.macd && ind.macd.MACD > ind.macd.signal) ? 9 : 0;
  ep += (ind.volumeOsc && ind.volumeOsc > 15) ? 8 : 0;
  ep += (ind.obv && ind.obv > 0) ? 6 : 0;

  const rs = Math.min(99, Math.max(1, 55 + Math.round((a.change_pct - (marketRegime === "قوي" ? 0 : -2)) * 2.2)));
  a.rs_rating = rs;
  ep += rs >= 85 ? 14 : rs >= 75 ? 8 : 0;

  return Math.min(99, Math.round(ep));
}

function classifySignal(a, score, st, sectorData) {
  const isSniper = score >= 78 && (st?.rr || 0) >= 2.0 && (a.vcp?.vcp || false) && a.rs_rating >= 80 && a.change_pct <= 22;
  const isRebound = a.is_rebound || (a.rsi < 48 && a.change_pct < 15 && a.dollar_vol > 8e6);
  const isEarly = a.early_watch || (a.change_pct < 12 && (a.vcp?.vcp || false));
  const isInvestment = score >= 65 && a.rs_rating >= 75 && sectorData.relativeStrength > 1;
  const isSpec = score >= 70 && (a.rvol || 0) >= 4;

  if (isSniper) return { type: "قناص", badge: "🎯" };
  if (isRebound) return { type: "ارتداد", badge: "🔄" };
  if (isEarly) return { type: "اكتشاف مبكر", badge: "🔍" };
  if (isInvestment) return { type: "استثمار", badge: "📈" };
  return { type: "مضاربية", badge: "⚡" };
}

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
    const tickers = await fetchFullMarket(left());
    debug.market_scanned = tickers.length;

    const spy = tickers.find(t => t.ticker === "SPY");
    const marketChange = spy?.todaysChangePerc ?? 0;
    debug.market_regime = marketChange >= 0 ? "قوي" : "ضعيف";

    // Stage 2: funnel
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

    // Stage 3: Technical Analysis
    const analyzed = [];
    if (heavy.length > 0 && left() > 2800) {
      const results = await concurrentMap(heavy, async (c) => {
        const bars = await fetchAggs(c.symbol);
        if (!bars || bars.length < 30) { debug.dropped_no_tech++; return null; }
        const ind = await calculateTechnicalIndicators(bars);
        return { ...c, bars, ind };
      }, CFG.MAX_CONCURRENT);

      for (const r of results) if (r) analyzed.push(r);
    }
    debug.tech_analyzed = analyzed.length;

    // Sector Stats
    const sectorStats = new Map();
    for (const a of analyzed) {
      // ... (نفس v16)
    }

    const signals = [];
    for (const a of analyzed) {
      const { ind } = a;
      if (ind.ema21 == null || a.price < ind.ema21 * 0.95) { debug.dropped_trend_gate++; continue; }
      if ((ind.rsi ?? 50) > 85 || (ind.rvol ?? 1) < 0.6) { debug.dropped_strict_gems++; continue; }
      if (a.change_pct > 30 && (ind.rvol ?? 0) < 2) { debug.dropped_stretch++; continue; }

      const st = buildStructure(a.price, a.bars, ind);
      const sectorData = sectorStats.get(a.sector) || { boost: 0, relativeStrength: 0 };
      const score = calculateScore(a, ind, st, debug.market_regime, sectorData);

      const classification = classifySignal(a, score, st, sectorData);

      signals.push({
        symbol: a.symbol,
        price: a.price,
        change_pct: a.change_pct,
        volume: a.volume,
        dollar_vol: a.dollar_vol,
        score,
        rs_rating: a.rs_rating,
        rvol: ind.rvol,
        rsi: ind.rsi,
        atr14: ind.atr,
        technical: ind,
        type: classification.type,
        badge: classification.badge,
        is_hot: score >= CFG.HOT.EP && (ind.rvol ?? 0) >= CFG.HOT.RVOL && a.change_pct >= CFG.HOT.CHG,
        early_watch: classification.type === "اكتشاف مبكر",
        is_target: score >= 75 && st?.flag === "دخول صحيح ✅",
        is_rebound: classification.type === "ارتداد",
        is_sniper: classification.type === "قناص",
        signal: a.change_pct > 25 ? "💥 انفجاري" : score >= 80 ? "🔥 عالي" : "📊 متوسط",
        news_age_h: null,
        sector: a.sector,
        sector_strength: sectorData.relativeStrength,
        riskScore: Math.round(Math.max(1, 10 - (st?.rr || 1) * 2)),
        levels: st ? buildLevels(a.price, st) : null,
        structure: st,
      });
    }

    // Stage News + Save (ابقِها من v8)

    const response = {
      success: true,
      total: signals.length,
      market_regime: debug.market_regime,
      hot: signals.filter(s => s.is_hot).length,
      target: signals.filter(s => s.is_target).length,
      early: signals.filter(s => s.early_watch).length,
      rebound: signals.filter(s => s.is_rebound).length,
      sniper: signals.filter(s => s.is_sniper).length,
      saved: saveResult.saved,
      elapsed_ms: Date.now() - T0,
      results: signals,
      movers,
      debug,
    };

    return res.status(200).json(light ? { ...response, light: true } : response);

  } catch (err) {
    return res.status(200).json({ success: false, error: err.message, elapsed_ms: Date.now() - T0, debug });
  }
}
