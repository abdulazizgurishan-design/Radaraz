// pages/api/scan.js — PROFESSIONAL EDITION v7 (نسب ديناميكية حسب التقلب)
// ═══════════════════════════════════════════════════════════════════
//  🎯 الإصدار الاحترافي:
//   ✅ نسب متغيرة حسب ATR (التقلب الحقيقي)
//   ✅ دعم ومقاومة ديناميكية
//   ✅ مناطق دخول ووقف خسارة ذكية
//   ✅ أهداف متعددة حسب طبيعة السهم
//   ✅ محسّن للسرعة (يشتغل خلال 9.5 ثوانٍ)
// ═══════════════════════════════════════════════════════════════════

export const config = { maxDuration: 10 };

// ✅ مهلة عامة 9.5 ثوانٍ (آمن)
const HARD_DEADLINE_MS = 9500;

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

// ─── 🗄️ نظام التخزين المؤقت (Cache) ──────────────────────────────
const CACHE = {
  aggs: new Map(),
  news: new Map(),
};

function getCacheKey(symbol, mult, span, days, limit) {
  return `${symbol}-${mult}-${span}-${days}-${limit}`;
}

function getCached(key, maxAge = 300000) {
  const entry = CACHE.aggs.get(key);
  if (entry && Date.now() - entry.time < maxAge) {
    return entry.data;
  }
  return null;
}

function setCache(key, data) {
  if (CACHE.aggs.size > 300) CACHE.aggs.clear();
  CACHE.aggs.set(key, { data, time: Date.now() });
}

// ─── تنفيذ على دفعات ──────────────────────────────────────────────
async function inBatches(items, size, fn) {
  const batchSize = Math.min(size, 6);
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
  }
}

// ─── إعدادات الفلترة ───────────────────────────────────────────────
const FILTER = {
  MIN_PRICE:      0.30,
  MAX_PRICE:      500,
  MIN_VOLUME:     300_000,
  MIN_CHANGE:     2,
  MAX_CHANGE:     40,
  MAX_RVOL:       100,
  MAX_RESULTS:    60,
  HEAVY_LIMIT:    40,
  PREMARKET_LIMIT: 20,
  SAVE_MIN_EP:    55,
  STRICT_PRICE:   0.50,
};

// ─── إعدادات الارتداد ──────────────────────────────────────────────
const REBOUND = {
  ENABLED: true,
  RSI_MAX: 45,
  MIN_PRICE: 3,
  MIN_DOLLAR_VOL: 10_000_000,
  MIN_RET_3M: 5,
  STRONG_JUMP: 8,
  TARGET_PCT: 3.0,
  MAX_HOLD_DAYS: 10,
  STOP_PCT: 7,
  MAX_VIX_RANK: 75,
};

// ════════════════ أدوات المؤشرات ════════════════

// ─── ✅ دالة return3M (حساب العائد في 3 أشهر) ────────────────────────
function return3M(dailyCloses) {
  if (!dailyCloses || dailyCloses.length < 30) return null;
  
  const now = dailyCloses[dailyCloses.length - 1];
  const idx = Math.max(0, dailyCloses.length - 63);
  const then = dailyCloses[idx];
  
  if (!then || then <= 0) return null;
  
  let hasSplitAnomaly = false;
  for (let i = idx + 1; i < dailyCloses.length; i++) {
    const prev = dailyCloses[i - 1];
    const cur = dailyCloses[i];
    if (prev > 0 && cur > 0) {
      const jump = Math.abs(cur - prev) / prev;
      if (jump > 0.40) {
        hasSplitAnomaly = true;
        break;
      }
    }
  }
  
  let base = then;
  if (hasSplitAnomaly) {
    const shortIdx = Math.max(0, dailyCloses.length - 20);
    base = dailyCloses[shortIdx];
    if (!base || base <= 0) return null;
  }
  
  const ret = ((now - base) / base) * 100;
  if (ret > 300 || ret < -95) return null;
  return ret;
}

// ─── ✅ دالة calcReboundLevels ──────────────────────────────────────
function calcReboundLevels(price) {
  const f = v => +v.toFixed(price < 1 ? 4 : 2);
  const t1 = f(price * (1 + REBOUND.TARGET_PCT / 100));
  const sl = f(price * (1 - REBOUND.STOP_PCT / 100));
  return {
    entry: price,
    t1: t1,
    t2: t1,
    t3: t1,
    sl: sl,
    t1Pct: REBOUND.TARGET_PCT,
    t2Pct: REBOUND.TARGET_PCT,
    t3Pct: REBOUND.TARGET_PCT,
    rr: (REBOUND.TARGET_PCT / REBOUND.STOP_PCT).toFixed(2),
    atr14: price * 0.03,
    source: "rebound_3pct",
    hold_days: REBOUND.MAX_HOLD_DAYS,
  };
}

// ─── ✅ دالة isReboundCandidate ─────────────────────────────────────
function isReboundCandidate(s, vixRank, hourlyCloses, dailyCloses) {
  if (!REBOUND.ENABLED) return false;
  if (s.rsi == null || s.rsi > REBOUND.RSI_MAX) return false;
  if (s.price < REBOUND.MIN_PRICE) return false;
  
  const dvol = s.price * (s.volume || 0);
  if (dvol < REBOUND.MIN_DOLLAR_VOL) return false;
  if (vixRank != null && vixRank >= REBOUND.MAX_VIX_RANK) return false;
  
  const ret3 = return3M(dailyCloses);
  if (ret3 == null) return false;
  if (ret3 < REBOUND.MIN_RET_3M) return false;
  
  s._ret3m = +ret3.toFixed(1);
  if (!emaCrossedUp(hourlyCloses, 9, 21, 1)) return false;
  return true;
}

function calcEMA(prices, period) {
  if (!prices || prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

function emaSeries(values, period) {
  if (!values || values.length < period) return [];
  const k = 2 / (period + 1);
  const out = new Array(period - 1).fill(null);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(ema);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

function calcSMA(prices, period) {
  if (!prices || prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcMA(prices, period) {
  if (!prices || prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function emaCrossedUp(closes, fast = 9, slow = 21, lookback = 1) {
  if (!closes || closes.length < slow + lookback + 1) return false;
  const fastSeries = emaSeries(closes, fast);
  const slowSeries = emaSeries(closes, slow);
  if (!fastSeries.length || !slowSeries.length) return false;
  const n = Math.min(fastSeries.length, slowSeries.length);
  const f = fastSeries.slice(-n);
  const s = slowSeries.slice(-n);
  if (n < lookback + 1) return false;
  const nowAbove = f[n - 1] > s[n - 1];
  let wasBelow = false;
  for (let i = 2; i <= lookback + 1 && n - i >= 0; i++) {
    if (f[n - i] <= s[n - i]) { wasBelow = true; break; }
  }
  return nowAbove && wasBelow;
}

function detectCross(closes) {
  if (!closes || closes.length < 12) return false;
  const ma5 = calcMA(closes, 5);
  const ma10 = calcMA(closes, 10);
  const ma5_prev = calcMA(closes.slice(0, -2), 5);
  const ma10_prev = calcMA(closes.slice(0, -2), 10);
  if (!ma5 || !ma10 || !ma5_prev || !ma10_prev) return false;
  return ma5_prev <= ma10_prev && ma5 > ma10;
}

function calcATR14(bars) {
  if (!bars || bars.length < 15) return null;
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].h, l = bars[i].l, pc = bars[i - 1].c;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length < 14) return null;
  let atr = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
  for (let i = 14; i < trs.length; i++) atr = (atr * 13 + trs[i]) / 14;
  return atr;
}

function detectVCP(bars) {
  if (!bars || bars.length < 30) return { vcp: false, score: 0, contraction: 0 };
  const recent = bars.slice(-30);
  const windows = [recent.slice(0, 10), recent.slice(10, 20), recent.slice(20, 30)];
  const ranges = windows.map(w => {
    const hi = Math.max(...w.map(b => b.h));
    const lo = Math.min(...w.map(b => b.l));
    const mid = (hi + lo) / 2 || 1;
    return (hi - lo) / mid;
  });
  const r0 = ranges[0], r1 = ranges[1], r2 = ranges[2];
  const contracting = r2 < r1 && r1 < r0;
  const tightening = r0 > 0 ? (r0 - r2) / r0 : 0;
  const vcp = contracting && tightening >= 0.30;
  const score = vcp ? Math.min(Math.round(tightening * 12), 8) : 0;
  return { vcp, score, contraction: +(tightening * 100).toFixed(0) };
}

function freshZoneBonus(bars, support) {
  if (!bars || bars.length < 10 || !support) return { fresh: false, touches: 0, bonus: 0 };
  const tol = support * 0.015;
  let touches = 0;
  for (const b of bars.slice(-40)) {
    if (b.l <= support + tol && b.l >= support - tol) touches++;
  }
  const fresh = touches <= 2;
  const bonus = fresh ? 4 : (touches >= 5 ? -3 : 0);
  return { fresh, touches, bonus };
}

function calcRSI14(bars) {
  if (!bars || bars.length < 15) return null;
  const closes = bars.map(b => b.c);
  let gains = 0, losses = 0;
  for (let i = 1; i <= 14; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / 14, avgLoss = losses / 14;
  for (let i = 15; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * 13 + (diff >= 0 ? diff : 0)) / 14;
    avgLoss = (avgLoss * 13 + (diff < 0 ? -diff : 0)) / 14;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcMACD(closes) {
  if (!closes || closes.length < 35) return null;
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] == null || ema26[i] == null) continue;
    macdLine.push(ema12[i] - ema26[i]);
  }
  if (macdLine.length < 10) return null;
  const sig = emaSeries(macdLine, 9);
  const macdLast = macdLine[macdLine.length - 1];
  const sigLast = sig[sig.length - 1];
  if (macdLast == null || sigLast == null) return null;
  const hist = macdLast - sigLast;
  const macdPrev = macdLine[macdLine.length - 2];
  const sigPrev = sig[sig.length - 2];
  const histPrev = (macdPrev != null && sigPrev != null) ? macdPrev - sigPrev : null;
  return {
    bullish: macdLast > sigLast && hist > 0,
    rising: histPrev != null ? hist > histPrev : false,
  };
}

function calcSupportResistance(bars, price) {
  if (!bars || bars.length < 10) return { resistances: [], supports: [] };
  const recent = bars.slice(-20);
  const resistances = [...new Set(recent.map(b => b.h))].filter(h => h > price).sort((a, b) => a - b);
  const supports = [...new Set(recent.map(b => b.l))].filter(l => l < price).sort((a, b) => b - a);
  return { resistances, supports };
}

function calcFibTargets(bars, price) {
  if (!bars || bars.length < 10) return [];
  const recent = bars.slice(-20);
  const swingLow = Math.min(...recent.map(b => b.l));
  const swingHigh = Math.max(...recent.map(b => b.h));
  const range = swingHigh - swingLow;
  if (range <= 0) return [];
  return [swingHigh + range * 0.272, swingHigh + range * 0.618, swingHigh + range * 1.0].filter(f => f > price);
}

// ─── ✅ المستويات الاحترافية ──────────────────────────────────────
function calcProfessionalLevels(price, bars, tradeStyle = "مضاربة") {
  const atr = calcATR14(bars) || price * 0.03;
  const atrPct = atr / price;
  
  const recent = bars.slice(-20);
  const support = Math.min(...recent.map(b => b.l));
  const resistance = Math.max(...recent.map(b => b.h));
  const range = Math.max(resistance - support, price * 0.01);
  
  let stopPct, entryPct, target1Pct, target2Pct, target3Pct;
  
  if (atrPct > 0.12) {
    stopPct = Math.min(atrPct * 1.8, 0.25);
    entryPct = Math.min(atrPct * 0.8, 0.10);
    target1Pct = Math.min(atrPct * 2.2, 0.35);
    target2Pct = Math.min(atrPct * 3.5, 0.60);
    target3Pct = Math.min(atrPct * 5.0, 0.90);
  } else if (atrPct > 0.06) {
    stopPct = Math.min(atrPct * 1.5, 0.12);
    entryPct = Math.min(atrPct * 0.5, 0.05);
    target1Pct = Math.min(atrPct * 2.0, 0.18);
    target2Pct = Math.min(atrPct * 3.0, 0.35);
    target3Pct = Math.min(atrPct * 4.5, 0.55);
  } else {
    stopPct = Math.min(atrPct * 1.2, 0.04);
    entryPct = Math.min(atrPct * 0.3, 0.015);
    target1Pct = Math.min(atrPct * 1.8, 0.06);
    target2Pct = Math.min(atrPct * 2.8, 0.12);
    target3Pct = Math.min(atrPct * 4.0, 0.20);
  }
  
  if (tradeStyle === "مضاربة") {
    stopPct = Math.min(stopPct * 0.7, 0.07);
    target1Pct = Math.min(target1Pct * 0.7, 0.10);
    target2Pct = Math.min(target2Pct * 0.7, 0.20);
    target3Pct = Math.min(target3Pct * 0.7, 0.35);
  }
  
  const stop = Math.max(support * 0.98, price * (1 - stopPct));
  const entry = Math.max(support + range * 0.382, price * (1 - entryPct));
  const t1 = Math.max(price * (1 + target1Pct), resistance * 0.98);
  const t2 = Math.max(price * (1 + target2Pct), t1 * 1.02);
  const t3 = Math.max(price * (1 + target3Pct), t2 * 1.03);
  
  const finalEntry = Math.min(entry, price * 0.98);
  const finalStop = Math.min(stop, finalEntry * 0.96);
  const rr = (t1 - finalEntry) / (finalEntry - finalStop);
  
  const f2 = n => +n.toFixed(price < 1 ? 4 : 2);
  const pct = n => +(((n - price) / price) * 100).toFixed(2);
  
  return {
    support: f2(support),
    resistance: f2(resistance),
    entry: f2(finalEntry),
    stop: f2(finalStop),
    t1: f2(t1),
    t2: f2(t2),
    t3: f2(t3),
    t1Pct: pct(t1),
    t2Pct: pct(t2),
    t3Pct: pct(t3),
    slPct: pct(finalStop),
    entryPct: pct(finalEntry),
    risk: f2(finalEntry - finalStop),
    reward: f2(t1 - finalEntry),
    rr: +rr.toFixed(2),
    atr: f2(atr),
    atrPct: +(atrPct * 100).toFixed(2),
    stopPct: +(stopPct * 100).toFixed(2),
    target1Pct: +(target1Pct * 100).toFixed(2),
  };
}

// ─── المستويات البسيطة ─────────────────────────────────────────────
function calcLevels(s) {
  const price = s.price;
  const tr = Math.max(s.high - s.low, Math.abs(s.high - s.prevClose), Math.abs(s.low - s.prevClose));
  const atr = Math.max(tr, price * 0.02);
  const t1 = +(price + atr * 0.5).toFixed(2), t2 = +(price + atr * 1.0).toFixed(2), t3 = +(price + atr * 1.8).toFixed(2);
  const sl = +Math.max(price - atr * 0.8, price * 0.92).toFixed(2);
  return {
    t1, t2, t3, sl,
    t1Pct: +(((t1 - price) / price) * 100).toFixed(2), t2Pct: +(((t2 - price) / price) * 100).toFixed(2),
    t3Pct: +(((t3 - price) / price) * 100).toFixed(2), slPct: +(((sl - price) / price) * 100).toFixed(2),
    risk: +(price - sl).toFixed(2),
  };
}

// ─── بنية السوق الاحترافية ─────────────────────────────────────────
function computeStructureLevels(price, bars, tradeStyle = "مضاربة") {
  if (!bars || bars.length < 12 || !price) return null;
  
  const prof = calcProfessionalLevels(price, bars, tradeStyle);
  const recent = bars.slice(-60);
  const { highs, lows } = findPivots(recent, 2);
  const recLows = recent.slice(-12).map(b => b.l);
  const recHighs = recent.slice(-12).map(b => b.h);
  const lowsBelow = lows.filter(l => l < price);
  const highsAbove = highs.filter(h => h > price);
  
  const support = prof.support;
  const resistance = prof.resistance;
  const swingHigh = Math.max(resistance, ...recent.map(b => b.h));
  const swingLow = support;
  const range = Math.max(swingHigh - swingLow, price * 0.005);
  const highsBelow = highs.filter(h => h <= price * 1.001);
  const confirm = highsBelow.length ? Math.max(...highsBelow) : support + range * 0.5;
  const trendUp = price >= confirm;
  
  const riskEntry = prof.entry - prof.stop;
  const rr = riskEntry > 0 ? +(((prof.t1 - prof.entry) / riskEntry).toFixed(2)) : null;
  
  let flag = "ينتظر تأكيد ⏳";
  if (trendUp && rr >= 1.3 && price >= prof.entry && price < prof.t1) {
    flag = "دخول صحيح ✅";
  } else if (trendUp && rr >= 1.0) {
    flag = "مقبول";
  } else if (price > prof.t1) {
    flag = "ملاحقة ⚠️";
  } else if (price < prof.support) {
    flag = "هابط ⛔";
  }
  
  const f2 = n => +Number(n).toFixed(price < 1 ? 4 : 2);
  const pct = n => +(((n - price) / price) * 100).toFixed(2);
  
  return {
    trend: trendUp ? "صاعد مؤكد ✅" : "ينتظر تأكيد ⏳",
    support: f2(support), supportPct: pct(support),
    entry: f2(prof.entry), entryPct: pct(prof.entry),
    confirm: f2(confirm), confirmPct: pct(confirm),
    stop: f2(prof.stop), stopPct: pct(prof.stop),
    resistance: f2(resistance), resistancePct: pct(resistance),
    t1: f2(prof.t1), t1Pct: pct(prof.t1),
    t2: f2(prof.t2), t2Pct: pct(prof.t2),
    t3: f2(prof.t3), t3Pct: pct(prof.t3),
    liquidity: f2(Math.max(prof.t3 * 1.05, resistance + range * 0.5)),
    peak: f2(Math.max(prof.t3 * 1.10, resistance + range * 0.8)),
    rr: rr || prof.rr,
    atrPct: prof.atrPct,
    stopPct: prof.stopPct,
    target1Pct: prof.target1Pct,
    flag: flag,
    posInBand: +(((price - support) / Math.max(resistance - support, 0.01))).toFixed(2),
  };
}

function findPivots(bars, w = 2) {
  const highs = [], lows = [];
  for (let i = w; i < bars.length - w; i++) {
    let isHigh = true, isLow = true;
    for (let j = i - w; j <= i + w; j++) {
      if (j === i) continue;
      if (bars[j].h >= bars[i].h) isHigh = false;
      if (bars[j].l <= bars[i].l) isLow = false;
    }
    if (isHigh) highs.push(bars[i].h);
    if (isLow) lows.push(bars[i].l);
  }
  return { highs, lows };
}

// ════════════════ الإضافات الذكية ════════════════

function detectBreakout(price, resistance, volume, avgVolume) {
  if (!resistance || !volume || !avgVolume) return false;
  return price > resistance && volume > avgVolume * 2;
}

function calculateRiskScore(s) {
  let risk = 0;
  if (s.atr14 && s.atr14 > s.price * 0.05) risk += 3;
  else if (s.atr14 && s.atr14 > s.price * 0.03) risk += 2;
  if (s.volume && s.volume < 500_000) risk += 2;
  if (s.news_age_h != null && s.news_age_h < 2 && s.news_sentiment === 'negative') risk += 2;
  if (s.price < 5) risk += 1;
  if (s.rsi != null && s.rsi > 72) risk += 1;
  return Math.min(risk, 10);
}

function detectPreBreakout(bars, resistance, volume, avgVolume) {
  if (!bars || bars.length < 10 || !resistance) return false;
  const recent = bars.slice(-5);
  const price = bars[bars.length - 1].c;
  const distanceToResistance = (resistance - price) / price;
  const volTrend = volume > avgVolume * 1.3;
  const nearResistance = distanceToResistance < 0.02 && distanceToResistance > 0;
  const recentCloses = recent.map(b => b.c);
  const uptrend = recentCloses[recentCloses.length - 1] > recentCloses[0];
  return nearResistance && volTrend && uptrend;
}

function getAvgVolume(bars) {
  if (!bars || bars.length < 20) return 0;
  const volumes = bars.map(b => b.v);
  return volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
}

function detectSmartBounce(bars) {
  if (!bars || bars.length < 20) return null;
  
  const closes = bars.map(b => b.c);
  const volumes = bars.map(b => b.v);
  const price = closes[closes.length - 1];
  
  const avgVol = getAvgVolume(bars);
  const support = Math.min(...closes.slice(-20));
  const cross = detectCross(closes);
  const rsi = calcRSI14(bars);
  
  const ma5 = calcMA(closes, 5);
  const ma10 = calcMA(closes, 10);
  
  const nearSupport = price <= support * (1 + 0.015);
  const crossCondition = cross;
  const volumeCondition = bars[bars.length - 1]?.v > avgVol * 1.5;
  const rsiCondition = rsi !== null && rsi >= 30 && rsi <= 50;
  const greenCandle = bars[bars.length - 1]?.c > bars[bars.length - 1]?.o;
  const priceAboveMA = ma5 !== null && ma10 !== null && price > ma5 && ma5 > ma10;
  const volumeAboveMin = bars[bars.length - 1]?.v >= 200_000;
  
  const allMet = nearSupport && crossCondition && volumeCondition && rsiCondition && greenCandle && priceAboveMA && volumeAboveMin;
  
  return {
    isBounce: allMet,
    conditions: {
      nearSupport,
      cross: crossCondition,
      volume: volumeCondition,
      rsi: rsiCondition,
      greenCandle,
      priceAboveMA,
      volumeAboveMin,
    },
    support,
    price,
    avgVol,
    rsi,
    ma5,
    ma10,
    confidence: [nearSupport, crossCondition, volumeCondition, rsiCondition, greenCandle, priceAboveMA, volumeAboveMin]
      .filter(v => v).length / 7,
  };
}

// ════════════════ حركة السوق ════════════════
function buildMovers(tickers, n = 15) {
  const MIN_PRICE = 1;
  const MIN_DOLLAR_VOL = 1e6;
  const rows = [];
  for (const tk of tickers) {
    if (!tk.ticker || tk.ticker.includes(".")) continue;
    if (!/^[A-Z]{1,5}$/.test(tk.ticker)) continue;
    const day = tk.day || {}, prev = tk.prevDay || {}, min = tk.min || {};
    const price = min.vw || min.c || tk.lastTrade?.p || day.c || prev.c || 0;
    const volume = day.v || min.av || 0;
    if (price < MIN_PRICE) continue;
    const dollarVol = price * volume;
    if (dollarVol < MIN_DOLLAR_VOL) continue;
    let changePct = tk.todaysChangePerc;
    if (changePct == null && prev.c) changePct = ((price - prev.c) / prev.c) * 100;
    rows.push({
      symbol: tk.ticker,
      price: +price.toFixed(2),
      change_pct: +(changePct || 0).toFixed(2),
      volume,
      dollar_vol: Math.round(dollarVol),
    });
  }
  const byChangeDesc = [...rows].sort((a, b) => b.change_pct - a.change_pct).slice(0, n);
  const byChangeAsc = [...rows].sort((a, b) => a.change_pct - b.change_pct).slice(0, n);
  const byVolume = [...rows].sort((a, b) => b.volume - a.volume).slice(0, n);
  const byValue = [...rows].sort((a, b) => b.dollar_vol - a.dollar_vol).slice(0, n);
  return { gainers: byChangeDesc, losers: byChangeAsc, volume: byVolume, value: byValue };
}

function calcEP(s) {
  let t = 0;
  const W = { rvol: 30, change: 25, gap: 15, vwap: 10, range: 10, volume: 10 };
  const rv = s.rvol || 0;
  t += rv >= 50 ? W.rvol * 1.15 : rv >= 20 ? W.rvol * 1.1 : rv >= 10 ? W.rvol
    : rv >= 5 ? W.rvol * .80 : rv >= 3 ? W.rvol * .60 : rv >= 2 ? W.rvol * .40 : rv >= 1.5 ? W.rvol * .20 : 0;
  const ch = s.changePct || 0;
  t += ch >= 10 && ch <= 30 ? W.change : ch >= 5 && ch < 10 ? W.change * .70 : ch >= 3 && ch < 5 ? W.change * .45
    : ch > 30 && ch <= 50 ? W.change * .85 : ch > 50 && ch <= 80 ? W.change * .65
    : ch > 80 && ch <= 120 ? W.change * .45 : ch > 120 ? W.change * .30 : 0;
  const g = s.gapPct || 0;
  t += g >= 20 ? W.gap * 1.2 : g >= 10 ? W.gap : g >= 5 ? W.gap * .60 : g >= 2 ? W.gap * .30 : 0;
  if (s.price > s.vwap && s.vwap > 0) t += W.vwap;
  else if (s.vwap > 0 && s.price >= s.vwap * 0.99) t += W.vwap * 0.5;
  if (s.high > s.low) {
    const pos = (s.price - s.low) / (s.high - s.low);
    t += pos >= 0.8 ? W.range : pos >= 0.6 ? W.range * .6 : pos >= 0.4 ? W.range * .3 : 0;
  }
  t += s.volume >= 5e6 ? W.volume : s.volume >= 2e6 ? W.volume * .7 : s.volume >= 1e6 ? W.volume * .5 : s.volume >= 5e5 ? W.volume * .3 : 0;
  if (rv >= 10 && ch >= 10) t += 8;
  if (rv >= 50) t += 5;
  let ep = Math.min(Math.round((t / Object.values(W).reduce((a, b) => a + b, 0)) * 100), 99);
  if (ch > 30 && ch <= 50) ep -= 4;
  else if (ch > 50 && ch <= 80) ep -= 8;
  else if (ch > 80 && ch <= 120) ep -= 12;
  else if (ch > 120) ep -= 16;
  return Math.max(0, Math.min(ep, 99));
}

// ════════════════ جلب السوق (محسّن للسرعة) ════════════════
async function fetchTopStocks() {
  // ✅ جلب 300 سهم فقط (بدلاً من 500) لتوفير الوقت
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?limit=300&apiKey=${POLYGON_KEY}`;
  
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) throw new Error(`Polygon ${res.status}`);
      const data = await res.json();
      
      const valid = data.tickers.filter(tk => {
        if (!tk.ticker || tk.ticker.includes(".")) return false;
        if (!/^[A-Z]{1,6}$/.test(tk.ticker)) return false;
        
        const day = tk.day || {};
        const min = tk.min || {};
        const price = min.vw || min.c || tk.lastTrade?.p || day.c || 0;
        const volume = day.v || min.av || 0;
        const prevClose = tk.prevDay?.c || 0;
        
        if (price < 0.5 || price > 800) return false;
        if (volume < 100_000) return false;
        
        let changePct = tk.todaysChangePerc;
        if (changePct == null && prevClose > 0) {
          changePct = ((price - prevClose) / prevClose) * 100;
        }
        
        if (Math.abs(changePct || 0) < 2) return false;
        if (Math.abs(changePct || 0) > 40) return false;
        
        return {
          ...tk,
          _price: price,
          _volume: volume,
          _changePct: changePct || 0,
          _dollarVol: price * volume,
        };
      }).filter(tk => tk !== false);
      
      const byVolume = [...valid].sort((a, b) => b._volume - a._volume);
      const topByVolume = byVolume.slice(0, 200);
      
      const byChange = [...valid]
        .filter(tk => tk._changePct >= 2 && tk._changePct <= 40)
        .sort((a, b) => b._changePct - a._changePct);
      const topByChange = byChange.slice(0, 60);
      
      const merged = [...topByVolume, ...topByChange];
      const seen = new Set();
      const unique = merged.filter(tk => {
        if (seen.has(tk.ticker)) return false;
        seen.add(tk.ticker);
        return true;
      });
      
      console.log(`✅ جلب ${unique.length} سهماً`);
      return unique;
      
    } catch (err) {
      clearTimeout(id);
      if (attempt === 1) throw err;
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error("Failed to fetch top stocks");
}

async function fetchAggs(symbol, multiplier, timespan, lookbackDays, limit) {
  const cacheKey = `${symbol}-${multiplier}-${timespan}-${lookbackDays}-${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}&apiKey=${POLYGON_KEY}`;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    const data = await res.json();
    const results = (data.results && data.results.length) ? data.results : null;
    if (results) setCache(cacheKey, results);
    return results;
  } catch {
    clearTimeout(id);
    return null;
  }
}

function frameFor(style) {
  return style === "مضاربة"
    ? { mult: 60, span: "minute", days: 30, limit: 600 }
    : { mult: 1, span: "day", days: 140, limit: 200 };
}

async function fetchNews(symbol) {
  const cacheKey = `news-${symbol}`;
  const cached = getCached(cacheKey, 120000);
  if (cached) return cached;
  
  const url = `https://api.polygon.io/v2/reference/news?ticker=${symbol}&limit=3&order=desc&sort=published_utc&apiKey=${POLYGON_KEY}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return { ageH: null, sentiment: null, hasNews: false };
    const data = await res.json();
    const results = data.results || [];
    if (!results.length) return { ageH: null, sentiment: null, hasNews: false };
    const latest = results[0];
    const ageH = latest.published_utc ? (Date.now() - new Date(latest.published_utc).getTime()) / 3600000 : null;
    let sentiment = null;
    if (Array.isArray(latest.insights)) {
      const ins = latest.insights.find(i => i.ticker === symbol);
      if (ins) sentiment = ins.sentiment;
    }
    const result = { ageH: ageH != null ? +ageH.toFixed(1) : null, sentiment, hasNews: true };
    setCache(cacheKey, result);
    return result;
  } catch {
    clearTimeout(id);
    return { ageH: null, sentiment: null, hasNews: false };
  }
}

const STRETCH = {
  ENABLED: true,
  WARN: 10,
  PEN_K: 0.4,
  PEN_CAP: 8,
  BONUS_STRONG: 3,
  DROP: 18,
};

function computeTech(bars) {
  if (!bars || bars.length < 21) return null;
  const closes = bars.map(b => b.c);
  const price = closes[closes.length - 1];
  const sma9 = calcSMA(closes, 9), sma21 = calcSMA(closes, 21), sma50 = calcSMA(closes, 50);
  const ema9 = calcEMA(closes, 9), ema21 = calcEMA(closes, 21);
  const ema20 = calcEMA(closes, 20), ema50 = calcEMA(closes, 50);
  const rsiRaw = calcRSI14(bars), atr = calcATR14(bars), macd = calcMACD(closes);
  let maSignal = null, maBonus = 0;
  if (sma9 && sma21 && sma9 > sma21) { maBonus += 6; maSignal = "صاعد"; }
  if (ema9 && ema21 && ema9 > ema21) { maBonus += 5; maSignal = maSignal === "صاعد" ? "صاعد قوي ⚡" : "EMA صاعد"; }
  if (sma21 && price > sma21) maBonus += 3;
  if (sma50 && price > sma50) maBonus += 2;
  const sma9p = calcSMA(closes.slice(0, -3), 9), sma21p = calcSMA(closes.slice(0, -3), 21);
  const freshGolden = !!(sma9p && sma21p && sma9p <= sma21p && sma9 > sma21);
  if (freshGolden) { maBonus += 6; maSignal = "تقاطع ذهبي 🌟"; }
  let recentMaxJump = 0;
  const lastN = closes.slice(-8);
  for (let i = 1; i < lastN.length; i++) {
    const j = ((lastN[i] - lastN[i - 1]) / lastN[i - 1]) * 100;
    if (j > recentMaxJump) recentMaxJump = j;
  }
  const stretch9 = ema9 ? ((price - ema9) / ema9) * 100 : null;
  const stretch20 = ema20 ? ((price - ema20) / ema20) * 100 : null;
  const strongAligned = !!(ema9 && ema20 && ema50 && ema9 > ema20 && ema20 > ema50 && price > ema9 && price > ema20);
  return {
    price, atr, macd,
    rsi: rsiRaw != null ? Math.round(rsiRaw) : null,
    maSignal, maBonus: Math.min(maBonus, 20),
    priceAboveMA21: !!(sma21 && price > sma21),
    sma21: sma21 || null,
    priceAboveEMA20: !!(ema20 && price > ema20),
    aligned: !!(sma9 && sma21 && price > sma21 && sma9 > sma21),
    strongAligned,
    stretch9: stretch9 != null ? +stretch9.toFixed(2) : null,
    stretch20: stretch20 != null ? +stretch20.toFixed(2) : null,
    freshGolden,
    recentMaxJump: +recentMaxJump.toFixed(1),
    bars,
  };
}

// ════════════════ VIX Rank ════════════════
async function fetchVixRank() {
  try {
    const to = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - 370 * 86400000).toISOString().split("T")[0];
    const url = `https://api.polygon.io/v2/aggs/ticker/VIXY/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=400&apiKey=${POLYGON_KEY}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return { rank: null, value: null, available: false };
    const data = await res.json();
    const bars = data.results || [];
    if (bars.length < 30) return { rank: null, value: null, available: false };
    const closes = bars.map(b => b.c).filter(v => v != null);
    const current = closes[closes.length - 1];
    const below = closes.filter(v => v < current).length;
    const rank = Math.round((below / closes.length) * 100);
    return { rank, value: +current.toFixed(2), available: true, proxy: "VIXY" };
  } catch {
    return { rank: 50, value: null, available: false, fallback: true };
  }
}

// ════════════════ الحفظ في Supabase ════════════════
async function saveSignals(signals) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !signals.length) return { saved: 0, skipped: true };
  const sigDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
    .toISOString().split("T")[0];
  const nowISO = new Date().toISOString();
  const rows = signals.map(s => ({
    symbol: s.symbol, signal_date: sigDate, type: s.type, entry_price: s.price, change_pct: s.changePct,
    volume: Math.round(s.volume), rvol: s.rvol, ep: s.ep, score: s.ep, is_hot: s.is_hot,
    target1: s.levels.t1, target2: s.levels.t2, target3: s.levels.t3, stop_loss: s.levels.sl,
    status: "OPEN", ma_signal: s.ma_signal || null, rsi: s.rsi ?? null,
    atr14: s.levels?.atr14 ?? null, early_watch: s.early_watch || false,
    is_target: s.is_target || false, news_age_h: s.news_age_h ?? null,
    vcp: s.vcp || false, vcp_contraction: s.vcp_contraction ?? null,
    fresh_zone: s.fresh_zone || false,
    premarket_watch: s.premarket_watch || false,
    structure: s.structure || null,
    is_smart_bounce: s.is_smart_bounce || false,
    smart_bounce_confidence: s.smart_bounce_confidence || 0,
    created_at: nowISO,
  }));
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/signals?on_conflict=symbol,signal_date`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });
    return { saved: res.ok ? rows.length : 0, status: res.status };
  } catch (err) { return { saved: 0, error: err.message }; }
}

// ════════════════ MAIN HANDLER ════════════════
export default async function handler(req, res) {
  const t0 = Date.now();
  const HARD_DEADLINE = t0 + HARD_DEADLINE_MS;
  const isSubscriber = req.query.sub === "1";

  try {
    const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const etH = etNow.getHours(), etM = etNow.getMinutes();
    const isPreMarket = (etH >= 4 && (etH < 9 || (etH === 9 && etM < 30)));
    const minVolume = isPreMarket ? 50_000 : FILTER.MIN_VOLUME;

    const [allTickers, vixData] = await Promise.all([
      fetchTopStocks(),
      fetchVixRank(),
    ]);
    const vixRank = vixData.available ? vixData.rank : null;

    if (Date.now() > HARD_DEADLINE) {
      console.log('⏰ Hard deadline reached after market fetch');
      return res.status(200).json({
        success: true,
        timeout: true,
        total: 0,
        results: [],
        leaders: [],
        speculation: [],
        earlyWatch: [],
        movers: { gainers: [], losers: [], volume: [], value: [] },
      });
    }

    const spyT = allTickers.find(t => t.ticker === "SPY");
    const spyPx = spyT?._price || 0;
    const spyVW = spyT?.day?.vw || 0;
    const marketWeak = spyPx > 0 && spyVW > 0 && spyPx < spyVW;
    const marketKnown = spyPx > 0 && spyVW > 0;
    const t1 = Date.now();

    const candidates = [];
    for (const tk of allTickers) {
      if (Date.now() > HARD_DEADLINE) break;
      
      const day = tk.day || {}, prev = tk.prevDay || {}, min = tk.min || {};
      const price = min.vw || min.c || tk.lastTrade?.p || day.c || prev.c || 0;
      const volume = day.v || min.av || 0;
      if (!tk.ticker || tk.ticker.includes(".")) continue;
      if (!/^[A-Z]{1,6}$/.test(tk.ticker)) continue;
      if (price < FILTER.MIN_PRICE || price > FILTER.MAX_PRICE) continue;
      if (volume < minVolume) continue;
      const prevClose = prev.c || day.o || price;
      let changePct = tk.todaysChangePerc;
      if (changePct == null || changePct === 0) changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      if (changePct < FILTER.MIN_CHANGE) continue;
      if (changePct > FILTER.MAX_CHANGE) continue;
      const gapPct = (day.o && prevClose) ? ((day.o - prevClose) / prevClose) * 100 : 0;
      let rvol = (prev.v && prev.v > 0) ? +(volume / prev.v).toFixed(1) : 0;
      if (rvol > FILTER.MAX_RVOL) continue;
      candidates.push({
        symbol: tk.ticker, price: +price.toFixed(2), open: day.o || price, volume,
        vwap: day.vw || min.vw || 0, high: day.h || min.h || price, low: day.l || min.l || price,
        prevClose, changePct: +changePct.toFixed(2), gapPct: +gapPct.toFixed(2), rvol,
      });
    }

    if (Date.now() > HARD_DEADLINE) {
      console.log('⏰ Hard deadline reached after candidate filtering');
      return res.status(200).json({
        success: true,
        timeout: true,
        total: 0,
        results: [],
        leaders: [],
        speculation: [],
        earlyWatch: [],
        movers: { gainers: [], losers: [], volume: [], value: [] },
      });
    }

    const scored = candidates.map(s => {
      const ep = calcEP(s);
      const levels = calcLevels(s);
      const is_hot = ep >= 65 && s.rvol >= 6 && s.changePct >= 6;
      const dollarVolume = s.price * s.volume;
      const isScalp = s.changePct >= 5 && s.rvol >= 5;
      const isInvest = s.price >= 20 && dollarVolume >= 100_000_000 && s.changePct <= 15;
      const type = isInvest ? "استثمار" : (isScalp ? "مضاربة" : "مضاربة");
      return { ...s, ep, levels, is_hot, type, trade_style: type, dollarVolume,
        signal: ep >= 80 ? "💥 انفجاري" : ep >= 60 ? "🔥 عالي" : "👀 مراقبة" };
    });

    scored.sort((a, b) => (b.is_hot !== a.is_hot) ? (b.is_hot ? 1 : -1) : (b.ep !== a.ep) ? b.ep - a.ep : b.rvol - a.rvol);

    const heavyLimit = isPreMarket ? FILTER.PREMARKET_LIMIT : FILTER.HEAVY_LIMIT;
    const top = scored.slice(0, heavyLimit);

    await inBatches(top, 6, async (s) => {
      if (Date.now() > HARD_DEADLINE) {
        s._drop = true;
        s._dropReason = "timeout";
        return;
      }
      
      const fr = frameFor(s.trade_style);
      const wantNews = s.changePct > 10 || s.rvol > 6 || s.ep >= 65;
      s._newsFetched = wantNews;
      const [bars, news] = await Promise.all([
        fetchAggs(s.symbol, fr.mult, fr.span, fr.days, fr.limit),
        wantNews ? fetchNews(s.symbol) : Promise.resolve({ ageH: null, sentiment: null, hasNews: false }),
      ]);

      const tech = computeTech(bars);
      s._tech = tech;
      s._news = news;
      s._drop = false;

      if (tech) {
        s.ep = Math.min(s.ep + tech.maBonus, 99);
        s.ma_signal = tech.maSignal;
        if (tech.rsi != null) {
          s.rsi = tech.rsi;
          if (tech.rsi >= 80) s.ep = Math.max(0, s.ep - 8);
          else if (tech.rsi >= 72) s.ep = Math.max(0, s.ep - 4);
          else if (tech.rsi >= 50 && tech.rsi <= 65) s.ep = Math.min(99, s.ep + 3);
        } else s.rsi = null;
        if (tech.macd && tech.macd.bullish) s.ep = Math.min(99, s.ep + (tech.macd.rising ? 7 : 5));

        if (tech.bars && tech.bars.length >= 30) {
          const vcpRes = detectVCP(tech.bars);
          if (vcpRes.vcp) {
            s.ep = Math.min(99, s.ep + vcpRes.score);
            s.vcp = true;
            s.vcp_contraction = vcpRes.contraction;
          }
        }
        if (marketKnown) {
          if (marketWeak) s.ep = Math.max(0, s.ep - 3);
          else s.ep = Math.min(99, s.ep + 2);
        }
        if (tech.bars && tech.bars.length >= 15) {
          const profLevels = calcProfessionalLevels(s.price, tech.bars, s.trade_style);
          s.levels = {
            t1: profLevels.t1,
            t2: profLevels.t2,
            t3: profLevels.t3,
            sl: profLevels.stop,
            t1Pct: profLevels.t1Pct,
            t2Pct: profLevels.t2Pct,
            t3Pct: profLevels.t3Pct,
            slPct: profLevels.slPct,
            risk: profLevels.risk,
            atr14: profLevels.atr,
            rr: profLevels.rr,
            entry: profLevels.entry,
            entryPct: profLevels.entryPct,
            support: profLevels.support,
            resistance: profLevels.resistance,
          };
          s.levels_source = "professional_dynamic";
          
          s.structure = computeStructureLevels(s.price, tech.bars, s.trade_style);
          
          if (s.structure && s.structure.support) {
            const fz = freshZoneBonus(tech.bars, s.structure.support);
            if (fz.bonus !== 0) s.ep = Math.min(99, Math.max(0, s.ep + fz.bonus));
            s.fresh_zone = fz.fresh;
            s.zone_touches = fz.touches;
          }
        } else {
          s.levels_source = "atr_basic";
          s.structure = null;
        }
        s.week_max_jump = tech.recentMaxJump;

        const rsiOK = s.rsi != null && s.rsi <= REBOUND.RSI_MAX;
        const dvolOK = s.price * (s.volume || 0) >= REBOUND.MIN_DOLLAR_VOL && s.price >= REBOUND.MIN_PRICE;
        const vixOK = vixRank == null || vixRank < REBOUND.MAX_VIX_RANK;
        if (rsiOK) s._rebRsi = true;
        if (rsiOK && dvolOK) s._rebDvol = true;
        if (rsiOK && dvolOK && vixOK) {
          s._rebVix = true;
          const isHourly = fr.mult === 60 && fr.span === "minute";
          const isDaily = fr.mult === 1 && fr.span === "day";
          let hourlyCloses = isHourly && tech.bars ? tech.bars.map(b => b.c) : null;
          let dailyCloses = isDaily && tech.bars ? tech.bars.map(b => b.c) : null;
          if (!hourlyCloses) {
            const hb = await fetchAggs(s.symbol, 60, "minute", 30, 600);
            hourlyCloses = (hb && hb.length) ? hb.map(b => b.c) : null;
          }
          if (!dailyCloses) {
            const db = await fetchAggs(s.symbol, 1, "day", 100, 120);
            dailyCloses = (db && db.length) ? db.map(b => b.c) : null;
            if (db && db.length >= 15) s._dailyBars = db;
          } else {
            s._dailyBars = tech.bars;
          }
          const ret3 = return3M(dailyCloses);
          if (ret3 != null && ret3 >= REBOUND.MIN_RET_3M) s._rebRet3 = true;
          if (s._rebRet3 && emaCrossedUp(hourlyCloses, 9, 21, 1)) s._rebCross = true;
          if (isReboundCandidate(s, vixRank, hourlyCloses, dailyCloses)) {
            s.type = "ارتداد";
            s.trade_style = "ارتداد";
            s.levels = calcReboundLevels(s.price);
            s.levels_source = "rebound_3pct";
            s.is_rebound = true;
            if (s._dailyBars && s._dailyBars.length >= 15) {
              s.structure = computeStructureLevels(s.price, s._dailyBars, s.trade_style);
            }
            s.ep = Math.min(99, s.ep + 6);
          }
        }

        let smartBounce = null;
        if (tech && tech.bars && tech.bars.length >= 20) {
          const threeMinBars = await fetchAggs(s.symbol, 3, "minute", 1, 30);
          if (threeMinBars && threeMinBars.length >= 20) {
            smartBounce = detectSmartBounce(threeMinBars);
            if (smartBounce && smartBounce.isBounce) {
              s.is_smart_bounce = true;
              s.smart_bounce_confidence = Math.round(smartBounce.confidence * 100);
              s.smart_bounce_support = smartBounce.support;
              s.ep = Math.min(99, s.ep + 10);
              s.signal = "🔄 ارتداد سريع";
              s.type = "ارتداد سريع";
              s.early_watch = true;
              s.is_rebound = true;
            }
          }
        }

      } else {
        s.ma_signal = null; s.rsi = s.rsi ?? null; s.levels_source = "atr_basic"; s.week_max_jump = null;
      }

      const freshNews = news.hasNews && news.ageH != null && news.ageH <= 48;
      if (freshNews) {
        s.ep = Math.min(99, s.ep + (news.sentiment === "positive" ? 6 : 3));
      }
      if (s.changePct > 20 && !freshNews) s.ep = Math.max(0, s.ep - 8);
      s.news_age_h = news.ageH;

      if (s.changePct > 12) {
        s.ep = Math.max(0, s.ep - Math.round((s.changePct - 12) * 0.7));
      }

      if (tech && tech.bars && tech.bars.length >= 20) {
        const avgVol = getAvgVolume(tech.bars);
        const resistance = s.structure?.resistance || null;
        s._breakout = detectBreakout(s.price, resistance, s.volume || 0, avgVol);
        s._riskScore = calculateRiskScore(s);
        s._preBreakout = detectPreBreakout(tech.bars, resistance, s.volume || 0, avgVol);
      } else {
        s._breakout = false;
        s._riskScore = 5;
        s._preBreakout = false;
      }

      if (STRETCH.ENABLED && tech) {
        if (tech.stretch9 != null && tech.stretch9 > STRETCH.WARN) {
          const pen = Math.min(STRETCH.PEN_CAP, Math.round((tech.stretch9 - STRETCH.WARN) * STRETCH.PEN_K));
          s.ep = Math.max(0, s.ep - pen);
        }
        if (tech.strongAligned) s.ep = Math.min(99, s.ep + STRETCH.BONUS_STRONG);
        const freshNewsX = !!(news && news.hasNews && news.ageH != null && news.ageH <= 24);
        if (tech.stretch9 != null && tech.stretch9 > STRETCH.DROP && s.changePct > 12 && !tech.freshGolden && !freshNewsX) {
          s._drop = true; if (!s._dropReason) s._dropReason = "stretch";
        }
      }

      if (s.structure) {
        const st = s.structure;
        const band = st.resistance - st.support;
        const pos = band > 0 ? (s.price - st.support) / band : 1;
        const confirmed = s.price >= st.confirm;
        const rrOk = st.rr != null && st.rr >= 1.3;
        const room = st.resistance > s.price * 1.01;
        const fresh = pos <= 0.72;

        let adj = 0, flag;
        if (confirmed && rrOk && room && fresh) { adj = 7; flag = "دخول صحيح ✅"; }
        else if (confirmed && (rrOk || fresh)) { adj = 2; flag = "مقبول"; }
        else { adj = -6; flag = "ملاحقة/غير مؤكد ⚠️"; }
        if (st.rr != null && st.rr < 1) adj -= 4;

        s.ep = Math.max(0, Math.min(99, s.ep + adj));
        st.flag = flag;
        st.posInBand = +pos.toFixed(2);

        if (s.changePct > 12 && pos > 0.80) { s._drop = true; if (!s._dropReason) s._dropReason = "late"; }

        if (tech && tech.bars && tech.bars.length >= 3) {
          const lc = tech.bars.slice(-3).map(b => b.c);
          const dropPct = lc[0] > 0 ? (lc[0] - lc[2]) / lc[0] : 0;
          const fallingNow = lc[2] < lc[1] && lc[1] < lc[0] && dropPct > 0.03;
          const confirmedUp = s.price >= st.confirm && tech.priceAboveMA21
            && (tech.macd ? tech.macd.bullish : true);
          const lastBar = tech.bars[tech.bars.length - 1];
          const reversalBar = lastBar && lastBar.c > lastBar.o;
          if (fallingNow && !confirmedUp && !reversalBar) {
            s._drop = true; if (!s._dropReason) s._dropReason = "strict_gems";
            st.flag = "هابط بلا تأكيد ⛔";
          }
        }
      }

      if (s.price < FILTER.STRICT_PRICE) {
        const pass = tech && tech.aligned
          && s.rvol >= 5
          && tech.rsi != null && tech.rsi >= 50 && tech.rsi <= 68
          && tech.macd && tech.macd.bullish
          && s.ep >= 70;
        if (!pass) { s._drop = true; if (!s._dropReason) s._dropReason = "penny_gate"; }
      } else {
        if (tech) {
          const nearMA21 = tech.sma21 && s.price >= tech.sma21 * 0.96;
          const trendPass = tech.priceAboveMA21
            || (nearMA21 && tech.macd && tech.macd.bullish)
            || (tech.priceAboveEMA20 && tech.macd && tech.macd.bullish);
          if (!trendPass) { s._drop = true; if (!s._dropReason) s._dropReason = "trend_gate"; }
          else if (isPreMarket) { s.premarket_watch = true; }
        } else {
          s.ep = Math.min(s.ep, 60);
          s._drop = true; if (!s._dropReason) s._dropReason = "no_tech";
        }
      }

      s.is_hot = s.ep >= 65 && s.rvol >= 6 && s.changePct >= 6;
      s.signal = s.ep >= 80 ? "💥 انفجاري" : s.ep >= 60 ? "🔥 عالي" : "👀 مراقبة";
      if (s.is_smart_bounce) s.signal = "🔄 ارتداد سريع";

      const strongMA = ["تقاطع ذهبي 🌟", "صاعد قوي ⚡", "EMA صاعد"].includes(s.ma_signal);
      const inEarlyZone = s.changePct >= 2 && s.changePct <= 20;
      let early = 0;
      if (strongMA) early++;
      if (s.rsi != null && s.rsi >= 45 && s.rsi <= 70) early++;
      if (s.rvol != null && s.rvol >= 3 && s.rvol <= 30) early++;
      if (s.ep >= 65) early++;
      if (s.week_max_jump != null && s.week_max_jump <= 25) early++;
      s.early_watch = inEarlyZone && early >= 2 && s.price >= 3;

      const earlyStage = s.changePct >= 2 && s.changePct <= 20;
      const volHigh = s.volume >= 500_000;
      const liqIn = s.rvol >= 3;
      const rsiPos = s.rsi != null && s.rsi >= 45 && s.rsi <= 70;
      const macdBull = !!(tech && tech.macd && tech.macd.bullish);
      const primaryConfluence = !s._drop && earlyStage && volHigh && liqIn && rsiPos && macdBull;
      s._primaryConfluence = primaryConfluence;
    });

    if (Date.now() > HARD_DEADLINE) {
      console.log('⏰ Hard deadline reached during final processing');
      return res.status(200).json({
        success: true,
        timeout: true,
        total: 0,
        results: [],
        leaders: [],
        speculation: [],
        earlyWatch: [],
        movers: { gainers: [], losers: [], volume: [], value: [] },
      });
    }

    const finalists = top.filter(s => s._primaryConfluence);
    await inBatches(finalists, 4, async (s) => {
      if (Date.now() > HARD_DEADLINE) return;
      const other = s.trade_style === "مضاربة"
        ? { mult: 1, span: "day", days: 140, limit: 200 }
        : { mult: 60, span: "minute", days: 30, limit: 600 };
      const otherBars = await fetchAggs(s.symbol, other.mult, other.span, other.days, other.limit);
      const otherTech = computeTech(otherBars);
      if (otherTech && otherTech.priceAboveMA21) {
        s.is_target = true;
        s.signal = "🎯 الهدف";
        s.ep = Math.max(s.ep, 90);
        s.is_hot = true;
      }
    });

    let survivors = top.filter(s => !s._drop);
    const tier = s => {
      if (s.is_target) return 5;
      if (s.structure && s.structure.flag === "دخول صحيح ✅") return 4;
      if (s.early_watch) return 3;
      if (s.structure && s.structure.flag === "مقبول") return 2;
      if (s.is_hot) return 1;
      return 0;
    };
    survivors.sort((a, b) => {
      const ta = tier(a), tb = tier(b);
      if (tb !== ta) return tb - ta;
      if (b.ep !== a.ep) return b.ep - a.ep;
      return b.rvol - a.rvol;
    });

    let saveResult = { skipped: true, reason: "subscriber scan" };
    if (!isSubscriber) {
      const toSave = survivors.filter(s => s.ep >= FILTER.SAVE_MIN_EP);
      saveResult = await saveSignals(toSave);
    }

    const dropBy = r => top.filter(s => s._dropReason === r).length;
    const debug = {
      market_scanned: allTickers.length,
      market_regime: marketKnown ? (marketWeak ? "ضعيف (SPY تحت VWAP)" : "قوي") : null,
      after_filter: candidates.length,
      top_selected: top.length,
      tech_analyzed: top.filter(s => s._tech).length,
      news_fetched: top.filter(s => s._newsFetched).length,
      timed_out: top.filter(s => s._timedOut).length,
      primary_confluence: top.filter(s => s._primaryConfluence).length,
      targets: top.filter(s => s.is_target).length,
      dropped_total: top.filter(s => s._drop).length,
      dropped_late: dropBy("late"),
      dropped_strict_gems: dropBy("strict_gems"),
      dropped_stretch: dropBy("stretch"),
      dropped_penny_gate: dropBy("penny_gate"),
      dropped_trend_gate: dropBy("trend_gate"),
      dropped_no_tech: dropBy("no_tech"),
      dropped_timeout: dropBy("timeout"),
      survivors: survivors.length,
      below_save_ep: survivors.filter(s => s.ep < FILTER.SAVE_MIN_EP).length,
      saved: saveResult.saved || 0,
      smart_bounce: survivors.filter(s => s.is_smart_bounce).length,
      rebound_funnel: {
        rsi_pass: top.filter(s => s._rebRsi).length,
        dvol_pass: top.filter(s => s._rebDvol).length,
        vix_pass: top.filter(s => s._rebVix).length,
        ret3_pass: top.filter(s => s._rebRet3).length,
        cross_pass: top.filter(s => s._rebCross).length,
        final: top.filter(s => s.is_rebound).length,
        smart_bounce: survivors.filter(s => s.is_smart_bounce).length,
      },
    };
    const pctOf = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    debug.rates = {
      analyze_pct: pctOf(debug.tech_analyzed, debug.top_selected),
      timeout_pct: pctOf(debug.timed_out, debug.top_selected),
      survival_pct: pctOf(debug.survivors, debug.top_selected),
      save_pct: pctOf(debug.saved, debug.survivors),
      drop_trend_pct: pctOf(debug.dropped_trend_gate, debug.tech_analyzed),
      drop_gems_pct: pctOf(debug.dropped_strict_gems, debug.tech_analyzed),
      drop_stretch_pct: pctOf(debug.dropped_stretch, debug.tech_analyzed),
    };

    if (req.query.light === "1") {
      return res.status(200).json({
        success: true, light: true,
        total: survivors.length,
        hot: survivors.filter(s => s.is_hot).length,
        target: survivors.filter(s => s.is_target).length,
        early: survivors.filter(s => s.early_watch).length,
        rebound: survivors.filter(s => s.is_rebound).length,
        breakout: survivors.filter(s => s._breakout).length,
        preBreakout: survivors.filter(s => s._preBreakout).length,
        smartBounce: survivors.filter(s => s.is_smart_bounce).length,
        avgRiskScore: survivors.length > 0 ? Math.round(survivors.reduce((a, s) => a + (s._riskScore || 5), 0) / survivors.length) : 0,
        vix: vixData.available ? { rank: vixRank, value: vixData.value } : { available: false },
        saved: saveResult.saved || 0, saveResult,
        timing: { market_fetch: t1 - t0, total_ms: Date.now() - t0 },
        market_scanned: allTickers.length, after_filter: candidates.length,
        debug,
      });
    }

    const toCard = s => ({
      symbol: s.symbol, price: s.price, change_pct: s.changePct, score: s.ep, signal: s.signal,
      type: s.type, volume: s.volume, rvol: s.rvol, is_hot: s.is_hot, vwap: s.vwap,
      ma_signal: s.ma_signal || null, rsi: s.rsi ?? null, early_watch: s.early_watch || false,
      week_max_jump: s.week_max_jump ?? null, levels: s.levels, atr14: s.levels?.atr14 || null,
      levels_source: s.levels_source || "atr_basic", is_target: s.is_target || false,
      news_age_h: s.news_age_h ?? null,
      structure: s.structure || null,
      breakout: s._breakout || false,
      riskScore: s._riskScore || 5,
      preBreakout: s._preBreakout || false,
      is_smart_bounce: s.is_smart_bounce || false,
      smart_bounce_confidence: s.smart_bounce_confidence || 0,
    });

    const results = survivors.map(toCard);
    const leaders = results.filter(s => s.type === "استثمار");
    const speculation = results.filter(s => s.type !== "استثمار");
    const early = results.filter(s => s.early_watch);
    const movers = buildMovers(allTickers, 15);

    return res.status(200).json({
      success: true, total: results.length,
      market_regime: debug.market_regime,
      hot: results.filter(s => s.is_hot).length,
      target: results.filter(s => s.is_target).length,
      early: early.length,
      breakout: results.filter(s => s.breakout).length,
      preBreakout: results.filter(s => s.preBreakout).length,
      smartBounce: results.filter(s => s.is_smart_bounce).length,
      avgRiskScore: results.length > 0 ? Math.round(results.reduce((a, s) => a + (s.riskScore || 5), 0) / results.length) : 0,
      saved: saveResult.saved || 0, saveResult,
      timing: { market_fetch: t1 - t0, total_ms: Date.now() - t0 },
      market_scanned: allTickers.length, after_filter: candidates.length,
      debug,
      results, leaders, speculation, earlyWatch: early,
      movers,
    });

  } catch (error) {
    console.error('Scan error:', error);
    return res.status(200).json({ 
      success: false, 
      error: error.message, 
      results: [], 
      leaders: [], 
      speculation: [],
      earlyWatch: [],
      movers: { gainers: [], losers: [], volume: [], value: [] },
    });
  }
}
