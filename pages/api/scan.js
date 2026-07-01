// pages/api/scan.js — STANDALONE EDITION v3 (Multi-Timeframe + MACD + News + Target)
// ═══════════════════════════════════════════════════════════════════
//  مسح مستقل تماماً — صفر اعتماد على جداول أخرى
//  ─────────────────────────────────────────────────────────────────
//  ترقيات هذا الإصدار:
//   ✅ المتوسطات/RSI/ATR/MACD حسب نوع الصفقة
//   ✅ إضافة MA50 + MACD(12,26,9) لتأكيد الاتجاه
//   ✅ المتوسطات صارت "بوابة" (gate) لا مجرد بونص
//   ✅ غربال صارم للأسهم أقل من $1
//   ✅ طبقة الأخبار اللحظية (Polygon News)
//   ✅ شارة 🎯 "الهدف" — التقاء كامل على الفريمين (نخبة)
//   ✅ أهداف واقعية (مضاربة على ATR 60د = أضيق وأقرب للتحقق)
//   ✅ إضافة أقسام جديدة: مناطق مراقبة 🔵 + زخم متأخر 🚀 + فرص خفية 💎
//   ✅ وقف خسارة ذكي: 4%-7% + بنية السوق (الدعم الحقيقي)
//   ✅ نظام Pre-Market / After-Hours الديناميكي
//   ✅ نظام الفترات الذهبية للتداول الآلي (4:30م-6:30م | 10م-11م)
//   ✅ تحسين عدد الإشارات: خفض MIN_PRICE, MIN_VOLUME, MIN_CHANGE, SAVE_MIN_EP
// ═══════════════════════════════════════════════════════════════════

export const config = { maxDuration: 60 };

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
  CACHE.aggs.set(key, { data, time: Date.now() });
}

// ─── 🕐 نظام حالة السوق الديناميكي ──────────────────────────────
function getMarketStatus() {
  const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const etH = etNow.getHours(), etM = etNow.getMinutes();
  const day = etNow.getDay();
  const isWeekend = day === 0 || day === 6;
  
  const isPreMarket = !isWeekend && (etH >= 4 && (etH < 9 || (etH === 9 && etM < 30)));
  const isMarketOpen = !isWeekend && (etH > 9 || (etH === 9 && etM >= 30)) && etH < 16;
  const isAfterHours = !isWeekend && etH >= 16 && etH < 20;
  const isClosed = isWeekend || etH >= 20 || etH < 4;
  
  let status, label, icon, warning, mode;
  if (isPreMarket) {
    status = "premarket";
    label = "🔵 Pre-Market";
    icon = "🔵";
    warning = "⚠️ سيولة أقل · تقلب أعلى · تداول بحذر";
    mode = "premarket";
  } else if (isMarketOpen) {
    status = "open";
    label = "🟢 السوق مفتوح";
    icon = "🟢";
    warning = "";
    mode = "open";
  } else if (isAfterHours) {
    status = "afterhours";
    label = "🟡 After-Hours";
    icon = "🟡";
    warning = "⚠️ سيولة منخفضة · تداول بحذر";
    mode = "afterhours";
  } else {
    status = "closed";
    label = "🔴 السوق مغلق";
    icon = "🔴";
    warning = "⏳ سيتم تحديث الإشارات بعد فتح السوق";
    mode = "closed";
  }
  
  return {
    status,
    label,
    icon,
    warning,
    mode,
    isPreMarket,
    isMarketOpen,
    isAfterHours,
    isClosed,
    saudiTime: {
      preMarketStart: "11:00 ص",
      preMarketEnd: "4:30 م",
      marketOpen: "4:30 م",
      marketClose: "11:00 م",
    }
  };
}

// ─── 🕐 نظام الفترات الذهبية للتداول الآلي ──────────────────────
function getTradingSession() {
  const saudiNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const h = saudiNow.getHours(), m = saudiNow.getMinutes();
  const minutes = h * 60 + m;
  
  const isSession1 = minutes >= 16 * 60 + 30 && minutes < 18 * 60 + 30;
  const isSession2 = minutes >= 22 * 60 && minutes < 23 * 60;
  const isGoldenHour = minutes >= 16 * 60 + 30 && minutes < 18 * 60;
  
  let session = "off";
  let label = "🔴 خارج أوقات التداول الآلي";
  let config = null;
  
  if (isSession1) {
    session = "session1";
    label = "🟢 الزخم الصباحي (4:30م - 6:30م)";
    config = {
      name: "الزخم الصباحي",
      timeframe: "1min",
      maxChange: 8,
      minChange: 2,
      targetMult: 1.5,
      stopMult: 1.2,
      minEP: 70,
      minRVOL: 6,
      maxHoldMinutes: 15,
      strategy: "sniper_momentum",
      maxPrice: 50,
      minPrice: 3,
    };
  } else if (isSession2) {
    session = "session2";
    label = "🟡 الزخم المسائي (10:00م - 11:00م)";
    config = {
      name: "الزخم المسائي",
      timeframe: "5min",
      maxChange: 5,
      minChange: 1.5,
      targetMult: 1.2,
      stopMult: 1.0,
      minEP: 65,
      minRVOL: 4,
      maxHoldMinutes: 20,
      strategy: "late_momentum",
      maxPrice: 30,
      minPrice: 2,
    };
  }
  
  return { session, label, config, isSession1, isSession2, isGoldenHour, minutes };
}

// ─── إعدادات ديناميكية حسب حالة السوق ──────────────────────────
function getMarketConfig(mode) {
  const preMarketConfig = {
    MIN_PRICE: 0.50,
    MIN_VOLUME: 50_000,
    MIN_CHANGE: 2,
    MAX_CHANGE: 30,
    HEAVY_LIMIT: 30,
    SAVE_MIN_EP: 50,
    TIMEFRAME_MULT: 5,
    TIMEFRAME_SPAN: "minute",
  };
  
  const openMarketConfig = {
    MIN_PRICE: 2.00,
    MIN_VOLUME: 300_000,
    MIN_CHANGE: 2,
    MAX_CHANGE: 35,
    HEAVY_LIMIT: 45,
    SAVE_MIN_EP: 55,
    TIMEFRAME_MULT: 1,
    TIMEFRAME_SPAN: "minute",
  };
  
  const afterHoursConfig = {
    MIN_PRICE: 0.50,
    MIN_VOLUME: 50_000,
    MIN_CHANGE: 2,
    MAX_CHANGE: 25,
    HEAVY_LIMIT: 25,
    SAVE_MIN_EP: 45,
    TIMEFRAME_MULT: 5,
    TIMEFRAME_SPAN: "minute",
  };
  
  const closedConfig = {
    MIN_PRICE: 0,
    MIN_VOLUME: 0,
    MIN_CHANGE: 0,
    MAX_CHANGE: 0,
    HEAVY_LIMIT: 0,
    SAVE_MIN_EP: 0,
    TIMEFRAME_MULT: 0,
    TIMEFRAME_SPAN: "minute",
  };
  
  const configs = {
    premarket: preMarketConfig,
    open: openMarketConfig,
    afterhours: afterHoursConfig,
    closed: closedConfig,
  };
  
  return configs[mode] || openMarketConfig;
}

// ─── 🎯 أهداف سريعة للصفقات الآلية ──────────────────────────────
function calcFastTargets(price, atr, sessionConfig) {
  const risk = (atr || price * 0.015) * sessionConfig.stopMult;
  
  const t1 = price + risk * sessionConfig.targetMult;
  const t2 = price + risk * (sessionConfig.targetMult + 0.5);
  const t3 = price + risk * (sessionConfig.targetMult + 1.0);
  
  return {
    t1: +t1.toFixed(2),
    t2: +t2.toFixed(2),
    t3: +t3.toFixed(2),
    sl: +(price - risk).toFixed(2),
    risk: +risk.toFixed(2),
    t1Pct: +(((t1 - price) / price) * 100).toFixed(2),
    t2Pct: +(((t2 - price) / price) * 100).toFixed(2),
    t3Pct: +(((t3 - price) / price) * 100).toFixed(2),
    slPct: -((risk / price) * 100).toFixed(2),
    strategy: sessionConfig.strategy,
    session: sessionConfig.name,
  };
}

// ─── إعدادات الفلترة ───────────────────────────────────────────────
const FILTER = {
  MIN_PRICE:      2.00,      // 🆕 3.00 → 2.00
  MAX_PRICE:      500,
  MIN_VOLUME:     300_000,   // 🆕 500_000 → 300_000
  MIN_CHANGE:     2,         // 🆕 3 → 2
  MAX_CHANGE:     35,
  MAX_RVOL:       80,
  MAX_RESULTS:    60,
  HEAVY_LIMIT:    45,
  SAVE_MIN_EP:    55,        // 🆕 60 → 55
  STRICT_PRICE:   1.00,
  WATCH_MIN_EP:   50,
  LATE_CHANGE:    15,
  HIDDEN_VOLUME:  300000,
  HIGH_MIN_EP:    75,
  HIGH_MIN_RVOL:  8,
};

// ─── مزج البنية (Swing) في الاختيار ───────────────────────────────
const STRUCT = {
  MIN_RR:        1.5,
  MAX_POS:       0.66,
  BONUS_VALID:   7,
  BONUS_OK:      2,
  PENALTY_LATE:  6,
  PENALTY_BADRR: 4,
  DROP_LATE:     true,
  DROP_CHANGE:   10,
  DROP_POS:      0.80,
  STRICT_GEMS:   true,
};

// ─── 🛑 إعدادات الوقف الذكي ──────────────────────────────────────
const STOP_CONFIG = {
  MIN_PCT: 0.04,
  MAX_PCT: 0.07,
  SCALP_TARGET_MULT: 1.5,
  SMART_TARGET_MULT: 2.0,
};

// ════════════════ أدوات المؤشرات ════════════════

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

function emaCrossedUp(closes, fast = 9, slow = 21, lookback = 2) {
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
  const sigLast  = sig[sig.length - 1];
  if (macdLast == null || sigLast == null) return null;
  const hist = macdLast - sigLast;
  const macdPrev = macdLine[macdLine.length - 2];
  const sigPrev  = sig[sig.length - 2];
  const histPrev = (macdPrev != null && sigPrev != null) ? macdPrev - sigPrev : null;
  return {
    bullish: macdLast > sigLast && hist > 0,
    rising:  histPrev != null ? hist > histPrev : false,
  };
}

function calcSupportResistance(bars, price) {
  if (!bars || bars.length < 10) return { resistances: [], supports: [] };
  const recent = bars.slice(-20);
  const resistances = [...new Set(recent.map(b => b.h))].filter(h => h > price).sort((a, b) => a - b);
  const supports    = [...new Set(recent.map(b => b.l))].filter(l => l < price).sort((a, b) => b - a);
  return { resistances, supports };
}

function calcFibTargets(bars, price) {
  if (!bars || bars.length < 10) return [];
  const recent = bars.slice(-20);
  const swingLow  = Math.min(...recent.map(b => b.l));
  const swingHigh = Math.max(...recent.map(b => b.h));
  const range = swingHigh - swingLow;
  if (range <= 0) return [];
  return [swingHigh + range * 0.272, swingHigh + range * 0.618, swingHigh + range * 1.0].filter(f => f > price);
}

// ─── 🛑 حساب الوقف الذكي (حسب بنية السوق) ──────────────────────
function calculateSmartStop(price, structure, atr) {
  const MAX_STOP_PCT = STOP_CONFIG.MAX_PCT;
  const MIN_STOP_PCT = STOP_CONFIG.MIN_PCT;
  
  let stopFromStructure = null;
  if (structure && structure.support) {
    stopFromStructure = structure.support * 0.995;
  }
  
  const atrStop = price - (atr || price * 0.03) * 1.2;
  let stop = stopFromStructure || atrStop;
  
  const maxStop = price * (1 - MIN_STOP_PCT);
  const minStop = price * (1 - MAX_STOP_PCT);
  
  stop = Math.min(stop, maxStop);
  stop = Math.max(stop, minStop);
  
  if (stop >= price) {
    stop = price * (1 - MIN_STOP_PCT);
  }
  
  return {
    stop: Math.round(stop * 100) / 100,
    stopPct: -(((price - stop) / price) * 100).toFixed(2),
    usedStructure: !!stopFromStructure,
  };
}

// ─── أهداف المضاربة (Scalp) مع الوقف الذكي ──────────────────────
function calcScalpLevels(price, bars, structure) {
  const atr = calcATR14(bars) || price * 0.03;
  const stopData = calculateSmartStop(price, structure, atr);
  const sl = stopData.stop;
  const risk = price - sl;
  
  let t1 = price + risk * 1.5;
  let t2 = price + risk * 2.5;
  let t3 = price + risk * 4.0;
  
  t2 = Math.max(t2, t1 * 1.02);
  t3 = Math.max(t3, t2 * 1.02);
  
  const dec = price < 1 ? 3 : 2;
  const f2 = n => +n.toFixed(dec);
  const pct = n => +(((n - price) / price) * 100).toFixed(2);
  
  return {
    t1: f2(t1), t2: f2(t2), t3: f2(t3), sl: f2(sl),
    t1Pct: pct(t1), t2Pct: pct(t2), t3Pct: pct(t3), 
    slPct: pct(sl),
    risk: f2(risk), 
    atr14: f2(atr),
    usedStructure: stopData.usedStructure,
    stopPct: stopData.stopPct,
  };
}

// ─── أهداف الاستثمار (Smart) مع الوقف الذكي ──────────────────────
function calcSmartLevels(price, bars, structure) {
  const atr = calcATR14(bars) || price * 0.05;
  const stopData = calculateSmartStop(price, structure, atr);
  const sl = stopData.stop;
  const risk = price - sl;
  
  const { resistances, supports } = calcSupportResistance(bars, price);
  const fibs = calcFibTargets(bars, price);
  
  let t1 = price + risk * 2.0;
  let t2 = price + risk * 3.5;
  let t3 = price + risk * 5.0;
  
  if (resistances.length > 0 && resistances[0] > t1) {
    t1 = Math.min(resistances[0], t1 * 1.2);
  }
  if (resistances.length > 1 && resistances[1] > t2) {
    t2 = Math.min(resistances[1], t2 * 1.2);
  }
  if (fibs.length > 1 && fibs[1] > t2) {
    t3 = Math.max(t3, fibs[1]);
  }
  
  t2 = Math.max(t2, t1 * 1.04);
  t3 = Math.max(t3, t2 * 1.05);
  
  const f2 = n => +n.toFixed(2);
  const pct = n => +(((n - price) / price) * 100).toFixed(2);
  
  return {
    t1: f2(t1), t2: f2(t2), t3: f2(t3), sl: f2(sl),
    t1Pct: pct(t1), t2Pct: pct(t2), t3Pct: pct(t3), 
    slPct: pct(sl),
    risk: f2(price - sl), 
    atr14: f2(atr),
    usedStructure: stopData.usedStructure,
    stopPct: stopData.stopPct,
  };
}

const SMART_STOP = {
  ENABLED: true,
  NOISE_ATR_MULT: 1.2,
  NOISE_MIN_PCT:  0.04,
  SCALP_FLOOR:    0.04,
  SCALP_CAP:      0.07,
  SCALP_ATR_K:    1.2,
  SMART_FLOOR:    0.04,
  SMART_CAP:      0.07,
  SMART_ATR_K:    1.3,
  MIN_RR:         1.3,
  SCALP_T1_CAP:   0.30,
  SMART_T1_CAP:   0.60,
};

const REBOUND = {
  ENABLED:        true,
  RSI_MAX:        30,
  MIN_PRICE:      10,
  MIN_DOLLAR_VOL: 50_000_000,
  MIN_RET_3M:     20,
  STRONG_JUMP:    8,
  TARGET_PCT:     3.0,
  MAX_HOLD_DAYS:  10,
  STOP_PCT:       7,
  MAX_VIX_RANK:   70,
};

function return3M(dailyCloses) {
  if (!dailyCloses || dailyCloses.length < 40) return null;
  const now = dailyCloses[dailyCloses.length - 1];
  const idx = Math.max(0, dailyCloses.length - 63);
  const then = dailyCloses[idx];
  if (!then || then <= 0) return null;
  return ((now - then) / then) * 100;
}

function isReboundCandidate(s, vixRank, hourlyCloses, dailyCloses) {
  if (!REBOUND.ENABLED) return false;
  if (s.rsi == null || s.rsi > REBOUND.RSI_MAX) return false;
  if (s.price < REBOUND.MIN_PRICE) return false;
  const dvol = s.price * (s.volume || 0);
  if (dvol < REBOUND.MIN_DOLLAR_VOL) return false;
  if (vixRank != null && vixRank >= REBOUND.MAX_VIX_RANK) return false;
  const ret3 = return3M(dailyCloses);
  if (ret3 == null || ret3 < REBOUND.MIN_RET_3M) return false;
  s._ret3m = +ret3.toFixed(1);
  if (!emaCrossedUp(hourlyCloses, 9, 21, 2)) return false;
  return true;
}

function calcReboundLevels(price) {
  const f = v => +v.toFixed(price < 1 ? 4 : 2);
  const t1 = f(price * (1 + REBOUND.TARGET_PCT / 100));
  const sl = f(price * (1 - REBOUND.STOP_PCT / 100));
  return {
    entry: price, t1, t2: t1, t3: t1, sl,
    t1Pct: REBOUND.TARGET_PCT, t2Pct: REBOUND.TARGET_PCT, t3Pct: REBOUND.TARGET_PCT,
    rr: (REBOUND.TARGET_PCT / REBOUND.STOP_PCT).toFixed(2),
    atr14: price * 0.03, source: "rebound_3pct", hold_days: REBOUND.MAX_HOLD_DAYS,
  };
}

function applyStructureLevels(price, levels, structure, tradeStyle) {
  if (!SMART_STOP.ENABLED || !structure) return levels;
  if (!structure.support || !structure.stop || structure.stop >= price) return levels;

  const atr = levels?.atr14 || price * 0.03;
  const isScalp = tradeStyle === "مضاربة";
  
  let sl = structure.stop;
  
  const MIN_STOP_PCT = 0.04;
  const MAX_STOP_PCT = 0.07;
  
  const minStop = price * (1 - MAX_STOP_PCT);
  const maxStop = price * (1 - MIN_STOP_PCT);
  
  sl = Math.min(sl, maxStop);
  sl = Math.max(sl, minStop);
  
  if (sl >= price) {
    sl = price * (1 - MIN_STOP_PCT);
  }
  
  const risk = price - sl;
  if (risk <= 0) return levels;

  const t1Cap = isScalp ? SMART_STOP.SCALP_T1_CAP : SMART_STOP.SMART_T1_CAP;
  
  const cand = [structure.resistance, structure.t1, structure.t2, structure.t3]
    .filter(x => typeof x === "number" && x > price * 1.012)
    .sort((a, b) => a - b);
  const ups = [];
  for (const v of cand) if (!ups.length || v > ups[ups.length - 1] * 1.015) ups.push(v);

  let t1, t2, t3;
  if (ups.length >= 1 && (ups[0] - price) / price <= t1Cap) {
    t1 = ups[0];
    t2 = ups[1] || (t1 + risk);
    t3 = ups[2] || (t2 + Math.max(t2 - t1, risk));
  } else {
    const k1 = isScalp ? 1.5 : 2.0;
    const k2 = isScalp ? 2.5 : 3.5;
    const k3 = isScalp ? 4.0 : 5.0;
    t1 = Math.max(price + risk * k1, price * 1.015);
    t2 = Math.max(price + risk * k2, t1 * 1.02);
    t3 = Math.max(price + risk * k3, t2 * 1.02);
  }

  const dec = price < 1 ? 3 : 2;
  const f = n => +n.toFixed(dec);
  const pc = n => +(((n - price) / price) * 100).toFixed(2);
  
  return {
    ...levels,
    t1: f(t1), t2: f(t2), t3: f(t3), sl: f(sl),
    t1Pct: pc(t1), t2Pct: pc(t2), t3Pct: pc(t3), slPct: pc(sl),
    risk: f(risk), 
    atr14: levels?.atr14 ?? f(atr),
    usedStructure: true,
    stopPct: pc(sl),
    smart_structure: true,
  };
}

function calcLevels(s) {
  const price = s.price;
  const tr  = Math.max(s.high - s.low, Math.abs(s.high - s.prevClose), Math.abs(s.low - s.prevClose));
  const atr = Math.max(tr, price * 0.02);
  
  const stopPct = Math.min(Math.max(0.04, atr / price * 1.2), 0.07);
  const sl = price * (1 - stopPct);
  const risk = price - sl;
  
  const t1 = +(price + risk * 1.5).toFixed(2);
  const t2 = +(price + risk * 2.5).toFixed(2);
  const t3 = +(price + risk * 4.0).toFixed(2);
  
  return {
    t1, t2, t3, sl,
    t1Pct: +(((t1 - price) / price) * 100).toFixed(2),
    t2Pct: +(((t2 - price) / price) * 100).toFixed(2),
    t3Pct: +(((t3 - price) / price) * 100).toFixed(2),
    slPct: +(((sl - price) / price) * 100).toFixed(2),
    risk: +(price - sl).toFixed(2),
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
    if (isLow)  lows.push(bars[i].l);
  }
  return { highs, lows };
}

function computeStructureLevels(price, bars) {
  if (!bars || bars.length < 12 || !price) return null;
  const recent = bars.slice(-60);
  const { highs, lows } = findPivots(recent, 2);
  const recLows  = recent.slice(-12).map(b => b.l);
  const recHighs = recent.slice(-12).map(b => b.h);
  const lowsBelow  = lows.filter(l => l < price);
  const highsAbove = highs.filter(h => h > price);
  const support    = lowsBelow.length  ? Math.max(...lowsBelow)  : Math.min(...recLows);
  const resistance = highsAbove.length ? Math.min(...highsAbove) : Math.max(...recHighs);
  const swingHigh = Math.max(resistance, ...recent.map(b => b.h));
  const swingLow  = support;
  const range = Math.max(swingHigh - swingLow, price * 0.005);
  const highsBelow = highs.filter(h => h <= price * 1.001);
  const confirm = highsBelow.length ? Math.max(...highsBelow) : support + range * 0.5;
  const trendUp = price >= confirm;
  const buffer = Math.max(range * 0.10, price * 0.0005);
  const entry = support + (price - support) * 0.382;
  const STOP_CAP = price * 0.92;
  let stop = support - buffer;
  if (stop < STOP_CAP) stop = STOP_CAP;
  const riskEntry = entry - stop;
  let t1   = (resistance > price * 1.005) ? resistance : swingHigh + range * 0.272;
  t1 = Math.max(t1, price * 1.005);
  let t2   = Math.max(swingHigh + range * 0.272, t1 * 1.003);
  let t3   = Math.max(swingHigh + range * 0.618, t2 * 1.003);
  let liq  = Math.max(swingHigh + range * 1.0,   t3 * 1.003);
  let peak = Math.max(swingHigh + range * 1.618, liq * 1.003);
  const T1_CAP = price * 1.08;
  const T2_CAP = price * 1.20;
  const T3_CAP = price * 1.35;
  t1 = Math.min(t1, T1_CAP);
  t2 = Math.min(Math.max(t2, t1 * 1.01), T2_CAP);
  t3 = Math.min(Math.max(t3, t2 * 1.01), T3_CAP);
  liq  = Math.max(liq,  t3 * 1.02);
  peak = Math.max(peak, liq * 1.02);
  const f2 = n => +Number(n).toFixed(2);
  const pct = n => +(((n - price) / price) * 100).toFixed(2);
  const rr = riskEntry > 0 ? +(((t1 - entry) / riskEntry).toFixed(2)) : null;
  return {
    trend: trendUp ? "صاعد مؤكد ✅" : "ينتظر تأكيد ⏳",
    support: f2(support),       supportPct: pct(support),
    entry: f2(entry),           entryPct: pct(entry),
    confirm: f2(confirm),       confirmPct: pct(confirm),
    stop: f2(stop),             stopPct: pct(stop),
    resistance: f2(resistance), resistancePct: pct(resistance),
    t1: f2(t1),   t1Pct: pct(t1),
    t2: f2(t2),   t2Pct: pct(t2),
    t3: f2(t3),   t3Pct: pct(t3),
    liquidity: f2(liq),  liquidityPct: pct(liq),
    peak: f2(peak),      peakPct: pct(peak),
    rr,
  };
}

function buildMovers(tickers, n = 15) {
  const MIN_PRICE = 3;
  const MIN_DOLLAR_VOL = 2e6;
  const rows = [];
  for (const tk of tickers) {
    if (!tk.ticker || tk.ticker.includes(".")) continue;
    if (!/^[A-Z]{1,6}$/.test(tk.ticker)) continue;
    const day = tk.day || {}, prev = tk.prevDay || {}, min = tk.min || {};
    const price  = min.vw || min.c || tk.lastTrade?.p || day.c || prev.c || 0;
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
  const byChangeAsc  = [...rows].sort((a, b) => a.change_pct - b.change_pct).slice(0, n);
  const byVolume     = [...rows].sort((a, b) => b.volume - a.volume).slice(0, n);
  const byValue      = [...rows].sort((a, b) => b.dollar_vol - a.dollar_vol).slice(0, n);
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

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

async function fetchFullMarket() {
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`Polygon ${res.status}`);
    const data = await res.json();
    return data.tickers || [];
  } catch (err) { clearTimeout(id); throw err; }
}

async function fetchAggs(symbol, multiplier, timespan, lookbackDays, limit) {
  const cacheKey = getCacheKey(symbol, multiplier, timespan, lookbackDays, limit);
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);
  const url  = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}&apiKey=${POLYGON_KEY}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    const data = await res.json();
    const results = (data.results && data.results.length) ? data.results : null;
    if (results) setCache(cacheKey, results);
    return results;
  } catch (err) {
    clearTimeout(id);
    return null;
  }
}

function frameFor(style) {
  return style === "مضاربة"
    ? { mult: 60, span: "minute", days: 30,  limit: 600 }
    : { mult: 1,  span: "day",    days: 140, limit: 200 };
}

const STRETCH = {
  ENABLED:   true,
  WARN:      10,
  PEN_K:     0.4,
  PEN_CAP:   8,
  BONUS_STRONG: 3,
  DROP:      18,
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
  const stretch9  = ema9  ? ((price - ema9)  / ema9)  * 100 : null;
  const stretch20 = ema20 ? ((price - ema20) / ema20) * 100 : null;
  const strongAligned = !!(ema9 && ema20 && ema50 && ema9 > ema20 && ema20 > ema50 && price > ema9 && price > ema20);
  return {
    price, atr, macd,
    rsi: rsiRaw != null ? Math.round(rsiRaw) : null,
    maSignal, maBonus: Math.min(maBonus, 20),
    priceAboveMA21: !!(sma21 && price > sma21),
    priceAboveEMA20: !!(ema20 && price > ema20),
    aligned: !!(sma9 && sma21 && price > sma21 && sma9 > sma21),
    strongAligned,
    stretch9:  stretch9  != null ? +stretch9.toFixed(2)  : null,
    stretch20: stretch20 != null ? +stretch20.toFixed(2) : null,
    freshGolden,
    recentMaxJump: +recentMaxJump.toFixed(1),
    bars,
  };
}

async function fetchNews(symbol) {
  const cacheKey = `news-${symbol}`;
  const cached = getCached(cacheKey, 120000);
  if (cached) return cached;
  const url = `https://api.polygon.io/v2/reference/news?ticker=${symbol}&limit=3&order=desc&sort=published_utc&apiKey=${POLYGON_KEY}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 3500);
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
    const result = { 
      ageH: ageH != null ? +ageH.toFixed(1) : null, 
      sentiment, 
      hasNews: true 
    };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    clearTimeout(id);
    return { ageH: null, sentiment: null, hasNews: false };
  }
}

async function fetchVixRank() {
  try {
    const to = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - 370 * 86400000).toISOString().split("T")[0];
    const url = `https://api.polygon.io/v2/aggs/ticker/VIXY/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=400&apiKey=${POLYGON_KEY}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000);
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
  } catch { return { rank: null, value: null, available: false }; }
}

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
    structure: s.structure || null,
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

// ═══════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  const t0 = Date.now();
  const DEADLINE = t0 + 6500;
  const isSubscriber = req.query.sub === "1";

  try {
    // ─── 🕐 حالة السوق والإعدادات الديناميكية ──────────────────────
    const marketStatus = getMarketStatus();
    const config = getMarketConfig(marketStatus.mode);
    const tradingSession = getTradingSession();
    
    if (marketStatus.mode === "closed") {
      return res.status(200).json({
        success: true,
        message: "⏳ السوق مغلق - سيتم تحديث الإشارات بعد فتح السوق",
        marketStatus,
        tradingSession,
        results: [],
        leaders: [],
        speculation: [],
        opportunities: { ready: [], watch: [], late: [], hidden: [] },
        counts: { ready: 0, watch: 0, late: 0, hidden: 0, total: 0 },
      });
    }

    const isTradingSession = tradingSession.session !== "off";
    const sessionConfig = tradingSession.config;

    const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const etH = etNow.getHours(), etM = etNow.getMinutes();
    const isPreMarket = marketStatus.isPreMarket;
    const isAfterHours = marketStatus.isAfterHours;
    
    let minVolume = isPreMarket || isAfterHours ? 50_000 : FILTER.MIN_VOLUME;
    let minPrice = isPreMarket || isAfterHours ? 0.50 : FILTER.MIN_PRICE;
    let minChange = isPreMarket || isAfterHours ? 2 : FILTER.MIN_CHANGE;
    let maxChange = isPreMarket || isAfterHours ? 30 : FILTER.MAX_CHANGE;

    if (isTradingSession) {
      minVolume = 100_000;
      minPrice = sessionConfig.minPrice || 2;
      minChange = sessionConfig.minChange;
      maxChange = sessionConfig.maxChange;
    }

    const [allTickers, vixData] = await Promise.all([
      fetchFullMarket(),
      fetchVixRank(),
    ]);
    const vixRank = vixData.available ? vixData.rank : null;
    const t1 = Date.now();

    const candidates = [];
    for (const tk of allTickers) {
      const day = tk.day || {}, prev = tk.prevDay || {}, min = tk.min || {};
      const price  = min.vw || min.c || tk.lastTrade?.p || day.c || prev.c || 0;
      const volume = day.v || min.av || 0;
      if (!tk.ticker || tk.ticker.includes(".")) continue;
      if (!/^[A-Z]{1,6}$/.test(tk.ticker)) continue;
      if (price < minPrice || price > (sessionConfig?.maxPrice || FILTER.MAX_PRICE)) continue;
      if (volume < minVolume) continue;
      const prevClose = prev.c || day.o || price;
      let changePct = tk.todaysChangePerc;
      if (changePct == null || changePct === 0) changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      if (changePct < minChange) continue;
      if (changePct > maxChange) continue;
      const gapPct = (day.o && prevClose) ? ((day.o - prevClose) / prevClose) * 100 : 0;
      let rvol = (prev.v && prev.v > 0) ? +(volume / prev.v).toFixed(1) : 0;
      if (rvol > FILTER.MAX_RVOL) continue;
      candidates.push({
        symbol: tk.ticker, price: +price.toFixed(2), open: day.o || price, volume,
        vwap: day.vw || min.vw || 0, high: day.h || min.h || price, low: day.l || min.l || price,
        prevClose, changePct: +changePct.toFixed(2), gapPct: +gapPct.toFixed(2), rvol,
      });
    }

    const scored = candidates.map(s => {
      const ep = calcEP(s);
      const levels = calcLevels(s);
      const is_hot = ep >= 75 && s.rvol >= 10 && s.changePct >= 10;
      const dollarVolume = s.price * s.volume;
      const isScalp  = s.changePct >= 5 && s.rvol >= 5;
      const isInvest = s.price >= 20 && dollarVolume >= 100_000_000 && s.changePct <= 15;
      const type = isInvest ? "استثمار" : (isScalp ? "مضاربة" : "مضاربة");
      
      let signalLabel = ep >= 80 ? "💥 انفجاري" : ep >= 60 ? "🔥 عالي" : "👀 مراقبة";
      if (isTradingSession) {
        signalLabel = `⚡ ${sessionConfig.strategy === "sniper_momentum" ? "قناص" : "زخم"} ${ep >= 80 ? "🔥" : "💪"}`;
      }
      
      return { ...s, ep, levels, is_hot, type, trade_style: type, dollarVolume,
        signal: signalLabel,
        isTradingSession,
        sessionStrategy: isTradingSession ? sessionConfig.strategy : null,
        sessionName: isTradingSession ? sessionConfig.name : null,
      };
    });

    scored.sort((a, b) => (b.is_hot !== a.is_hot) ? (b.is_hot ? 1 : -1) : (b.ep !== a.ep) ? b.ep - a.ep : b.rvol - a.rvol);
    const top = scored.slice(0, config.HEAVY_LIMIT || FILTER.HEAVY_LIMIT);

    await inBatches(top, 30, async (s) => {
      if (Date.now() > DEADLINE) { s._timedOut = true; return; }
      
      let fr;
      if (isPreMarket || isAfterHours) {
        fr = { mult: 5, span: "minute", days: 7, limit: 500 };
      } else if (isTradingSession) {
        fr = { mult: 1, span: "minute", days: 5, limit: 300 };
      } else {
        fr = frameFor(s.trade_style);
      }
      
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
        
        if (tech.bars && tech.bars.length >= 15) {
          s.structure = computeStructureLevels(s.price, tech.bars);
          
          if (isTradingSession) {
            const atr = calcATR14(tech.bars) || s.price * 0.02;
            s.levels = calcFastTargets(s.price, atr, sessionConfig);
            s.levels_source = `fast_${sessionConfig.strategy}`;
          } else {
            s.levels = s.trade_style === "مضاربة" 
              ? calcScalpLevels(s.price, tech.bars, s.structure) 
              : calcSmartLevels(s.price, tech.bars, s.structure);
            s.levels_source = s.trade_style === "مضاربة" ? "scalp_60m_structure" : "smart_daily_structure";
          }
          
          if (s.structure && s.structure.support) {
            const fz = freshZoneBonus(tech.bars, s.structure.support);
            if (fz.bonus !== 0) s.ep = Math.min(99, Math.max(0, s.ep + fz.bonus));
            s.fresh_zone = fz.fresh;
            s.zone_touches = fz.touches;
          }
          
          const smart = applyStructureLevels(s.price, s.levels, s.structure, s.trade_style);
          if (smart.smart_structure) { s.levels = smart; s.levels_source += "+structure"; }
        } else {
          s.levels = calcLevels(s);
          s.levels_source = "atr_basic";
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
          const isDaily  = fr.mult === 1  && fr.span === "day";
          let hourlyCloses = isHourly && tech.bars ? tech.bars.map(b => b.c) : null;
          let dailyCloses  = isDaily  && tech.bars ? tech.bars.map(b => b.c) : null;
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
          if (s._rebRet3 && emaCrossedUp(hourlyCloses, 9, 21, 2)) s._rebCross = true;
          if (isReboundCandidate(s, vixRank, hourlyCloses, dailyCloses)) {
            s.type = "ارتداد";
            s.trade_style = "ارتداد";
            s.levels = calcReboundLevels(s.price);
            s.levels_source = "rebound_3pct";
            s.is_rebound = true;
            if (s._dailyBars && s._dailyBars.length >= 15) {
              s.structure = computeStructureLevels(s.price, s._dailyBars);
            }
            s.ep = Math.min(99, s.ep + 6);
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
        const rrOk = st.rr != null && st.rr >= STRUCT.MIN_RR;
        const room = st.resistance > s.price * 1.01;
        const fresh = pos <= STRUCT.MAX_POS;

        let adj = 0, flag;
        if (confirmed && rrOk && room && fresh) { adj = STRUCT.BONUS_VALID; flag = "دخول صحيح ✅"; }
        else if (confirmed && (rrOk || fresh))  { adj = STRUCT.BONUS_OK;    flag = "مقبول"; }
        else                                    { adj = -STRUCT.PENALTY_LATE; flag = "ملاحقة/غير مؤكد ⚠️"; }
        if (st.rr != null && st.rr < 1) adj -= STRUCT.PENALTY_BADRR;

        s.ep = Math.max(0, Math.min(99, s.ep + adj));
        st.flag = flag;
        st.posInBand = +pos.toFixed(2);

        if (STRUCT.DROP_LATE && s.changePct > STRUCT.DROP_CHANGE && pos > STRUCT.DROP_POS) { s._drop = true; if (!s._dropReason) s._dropReason = "late"; }

        if (STRUCT.STRICT_GEMS && tech.bars && tech.bars.length >= 3) {
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
          const trendPass = tech.priceAboveMA21 || (tech.priceAboveEMA20 && tech.macd && tech.macd.bullish);
          if (!trendPass) { s._drop = true; if (!s._dropReason) s._dropReason = "trend_gate"; }
        } else {
          s.ep = Math.min(s.ep, 72);
          if (s.changePct > 15) { s._drop = true; if (!s._dropReason) s._dropReason = "no_tech_ext"; }
          else if (s.ep < 60) { s._drop = true; if (!s._dropReason) s._dropReason = "no_tech_lowep"; }
        }
      }

      s.is_hot = s.ep >= 75 && s.rvol >= 10 && s.changePct >= 10;
      
      if (isTradingSession) {
        s.signal = `⚡ ${sessionConfig.strategy === "sniper_momentum" ? "قناص" : "زخم"} ${s.ep >= 80 ? "🔥" : "💪"}`;
        s.session_label = sessionConfig.name;
        s.session_strategy = sessionConfig.strategy;
      } else {
        s.signal = s.ep >= 80 ? "💥 انفجاري" : s.ep >= 60 ? "🔥 عالي" : "👀 مراقبة";
      }

      const strongMA = ["تقاطع ذهبي 🌟", "صاعد قوي ⚡", "EMA صاعد"].includes(s.ma_signal);
      const inEarlyZone = s.changePct >= 2 && s.changePct <= 15;
      let early = 0;
      if (strongMA) early++;
      if (s.rsi != null && s.rsi >= 50 && s.rsi <= 68) early++;
      if (s.rvol != null && s.rvol >= 3 && s.rvol <= 30) early++;
      if (s.ep >= 65) early++;
      if (s.week_max_jump != null && s.week_max_jump <= 25) early++;
      s.early_watch = inEarlyZone && early >= 2;

      const earlyStage = s.changePct >= 2 && s.changePct <= 15;
      const volHigh = s.volume >= 1_000_000;
      const liqIn = s.rvol >= 4;
      const rsiPos = s.rsi != null && s.rsi >= 50 && s.rsi <= 68;
      const macdBull = !!(tech && tech.macd && tech.macd.bullish);
      const primaryConfluence = !s._drop && earlyStage && volHigh && liqIn && rsiPos && macdBull && tech && tech.aligned;
      s._primaryConfluence = primaryConfluence;
    });

    const finalists = top.filter(s => s._primaryConfluence);
    await inBatches(finalists, 12, async (s) => {
      if (Date.now() > DEADLINE) return;
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
      const toSave = survivors.filter(s => s.ep >= (config.SAVE_MIN_EP || FILTER.SAVE_MIN_EP));
      saveResult = await saveSignals(toSave);
    }

    const dropBy = r => top.filter(s => s._dropReason === r).length;
    const debug = {
      market_scanned:   allTickers.length,
      after_filter:     candidates.length,
      top_selected:     top.length,
      tech_analyzed:    top.filter(s => s._tech).length,
      news_fetched:     top.filter(s => s._newsFetched).length,
      timed_out:        top.filter(s => s._timedOut).length,
      primary_confluence: top.filter(s => s._primaryConfluence).length,
      targets:          top.filter(s => s.is_target).length,
      dropped_total:    top.filter(s => s._drop).length,
      dropped_late:     dropBy("late"),
      dropped_strict_gems: dropBy("strict_gems"),
      dropped_stretch:  dropBy("stretch"),
      dropped_penny_gate: dropBy("penny_gate"),
      dropped_trend_gate: dropBy("trend_gate"),
      dropped_no_tech:  dropBy("no_tech_ext") + dropBy("no_tech_lowep"),
      survivors:        survivors.length,
      below_save_ep:    survivors.filter(s => s.ep < (config.SAVE_MIN_EP || FILTER.SAVE_MIN_EP)).length,
      saved:            saveResult.saved || 0,
      session: {
        active: isTradingSession,
        label: tradingSession.label,
        strategy: isTradingSession ? sessionConfig.strategy : null,
        signals_count: survivors.filter(s => s.isTradingSession).length,
      },
      rebound_funnel: {
        rsi_pass:   top.filter(s => s._rebRsi).length,
        dvol_pass:  top.filter(s => s._rebDvol).length,
        vix_pass:   top.filter(s => s._rebVix).length,
        ret3_pass:  top.filter(s => s._rebRet3).length,
        cross_pass: top.filter(s => s._rebCross).length,
        final:      top.filter(s => s.is_rebound).length,
      },
    };
    const pctOf = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    debug.rates = {
      analyze_pct:      pctOf(debug.tech_analyzed, debug.top_selected),
      timeout_pct:      pctOf(debug.timed_out, debug.top_selected),
      survival_pct:     pctOf(debug.survivors, debug.top_selected),
      save_pct:         pctOf(debug.saved, debug.survivors),
      drop_trend_pct:   pctOf(debug.dropped_trend_gate, debug.tech_analyzed),
      drop_gems_pct:    pctOf(debug.dropped_strict_gems, debug.tech_analyzed),
      drop_stretch_pct: pctOf(debug.dropped_stretch, debug.tech_analyzed),
    };

    if (req.query.light === "1") {
      return res.status(200).json({
        success: true, light: true,
        total: survivors.length,
        hot:    survivors.filter(s => s.is_hot).length,
        target: survivors.filter(s => s.is_target).length,
        early:  survivors.filter(s => s.early_watch).length,
        rebound: survivors.filter(s => s.is_rebound).length,
        session: {
          active: isTradingSession,
          label: tradingSession.label,
          signals: survivors.filter(s => s.isTradingSession).length,
        },
        vix:    vixData.available ? { rank: vixRank, value: vixData.value } : { available: false },
        saved:  saveResult.saved || 0, saveResult,
        timing: { market_fetch: t1 - t0, total_ms: Date.now() - t0 },
        market_scanned: allTickers.length, after_filter: candidates.length,
        marketStatus,
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
      vcp: s.vcp || false,
      vcp_contraction: s.vcp_contraction ?? null,
      isTradingSession: s.isTradingSession || false,
      sessionStrategy: s.sessionStrategy || null,
      sessionName: s.sessionName || null,
    });

    const results     = survivors.map(toCard);
    const leaders     = results.filter(s => s.type === "استثمار");
    const speculation = results.filter(s => s.type !== "استثمار");
    const early       = results.filter(s => s.early_watch);
    const movers      = buildMovers(allTickers, 15);

    const opportunities = {
      ready: survivors.filter(s => 
        s.ep >= 70 && 
        s.changePct <= 15 && 
        s.changePct >= 3 &&
        !s._drop
      ),
      watch: survivors.filter(s => 
        s.ep >= 50 && 
        s.ep < 70 && 
        s.changePct <= 12 &&
        s.changePct >= 2 &&
        !s._drop
      ),
      late: survivors.filter(s => 
        s.changePct > 15 && 
        s.ep >= 60 &&
        s.rvol >= 5 &&
        !s._drop
      ),
      hidden: survivors.filter(s => 
        s.volume < 300000 && 
        s.ep >= 65 &&
        s.changePct <= 15 &&
        !s._drop
      ),
    };

    const usedSymbols = new Set();
    const filterUnique = (arr) => {
      return arr.filter(s => {
        if (usedSymbols.has(s.symbol)) return false;
        usedSymbols.add(s.symbol);
        return true;
      });
    };

    opportunities.ready = filterUnique(opportunities.ready);
    opportunities.watch = filterUnique(opportunities.watch);
    opportunities.late = filterUnique(opportunities.late);
    opportunities.hidden = filterUnique(opportunities.hidden);

    const sessionTrades = survivors.filter(s => s.isTradingSession && !s._drop);

    const responseData = {
      success: true,
      total: results.length,
      hot: results.filter(s => s.is_hot).length,
      target: results.filter(s => s.is_target).length,
      early: early.length,
      saved: saveResult.saved || 0,
      saveResult,
      timing: { market_fetch: t1 - t0, total_ms: Date.now() - t0 },
      market_scanned: allTickers.length,
      after_filter: candidates.length,
      marketStatus,
      tradingSession: {
        active: isTradingSession,
        label: tradingSession.label,
        strategy: isTradingSession ? sessionConfig.strategy : null,
        signals: sessionTrades.map(toCard),
        count: sessionTrades.length,
      },
      debug,
      results,
      leaders,
      speculation,
      earlyWatch: early,
      movers,
      opportunities: {
        ready: opportunities.ready.map(toCard),
        watch: opportunities.watch.map(toCard),
        late: opportunities.late.map(toCard),
        hidden: opportunities.hidden.map(toCard),
      },
      counts: {
        ready: opportunities.ready.length,
        watch: opportunities.watch.length,
        late: opportunities.late.length,
        hidden: opportunities.hidden.length,
        total: opportunities.ready.length + opportunities.watch.length + opportunities.late.length + opportunities.hidden.length,
      }
    };

    return res.status(200).json(responseData);

  } catch (error) {
    return res.status(200).json({ 
      success: false, 
      error: error.message, 
      results: [], 
      leaders: [], 
      speculation: [],
      marketStatus: getMarketStatus(),
      tradingSession: getTradingSession(),
    });
  }
}
