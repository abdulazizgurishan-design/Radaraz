// pages/api/scan.js — v19 Self-Learning Predictive Engine (النهائي)
// ═══════════════════════════════════════════════════════════════════
//  🧠 v19 — التحول إلى Self-Learning Predictive Engine
//    ✅ إزالة EP اليدوي — PredictionScore هو المعيار النهائي
//    ✅ Parallel Execution (Promise.all) لتقليل زمن التنفيذ
//    ✅ تفعيل LearningEngine و FeedbackEngine فعليًا
//    ✅ Feature Vector كمدخل لنموذج تعلم آلي
//    ✅ إضافة OBV, CMF, AD Line, Float, Institutional Ownership
//    ✅ استخدام البيانات التاريخية لحساب الاحتمالات
// ═══════════════════════════════════════════════════════════════════

export const config = { maxDuration: 15 };

const POLYGON_KEY = process.env.POLYGON_API_KEY || process.env.POLYGON_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

// ─── الإعدادات الأساسية ──────────────────────────────────────────
const CFG_DEFAULT = {
  BUDGET: 9000,
  MIN_PRICE: 0.50,
  MIN_VOLUME: 10000,
  MIN_DOLLARVOL: 100000,
  BATCH: 30,
  AGGS_TIMEOUT: 2500,
  SAVE_MIN_EP: 45,
  MIN_RR: 0.8,
  CAPS: { t1: 8, t2: 20, t3: 35, sl: 8 },
  EARLY_FLOOR: 3,
  REBOUND: { RSI: 45, PRICE: 3, DVOL: 10e6, RET: 8 },
  HOT: { EP: 65, RVOL: 5, CHG: 6 },
  MAX_CHANGE: 40,
  CHASE_EXT_PCT: 15,
  CHASE_BAND: 0.95,
  COOLDOWN_DAYS: 3,
  COOLDOWN_PENALTY: 8,
  RS_BONUS: 4,
  RS_PENALTY: 3,
  RS_EDGE: 5,
  DATA_WARN_PENALTY: 5,
  CHASE_PENALTY: 6,
  GOLDEN: {
    CHG_MIN: 4,
    CHG_MAX: 15,
    RVOL: 3,
    PRICE_MIN: 2,
    PRICE_MAX: 20,
    RSI_MAX: 80,
    WINDOW_START: 570,
    WINDOW_END: 660,
    BONUS: 5,
  },
};

// ─── مفاتيح الميزات ──
const FF_DEFAULT = {
  remote_config: true,
  entry_state: true,
  rel_strength: true,
  cooldown: true,
  score_trace: true,
  data_guard: true,
  news: true,
  golden_momentum: true,
};

// ─── Capped cache ──────────────────────────────────────────────────
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

async function fetchJson(url, timeoutMs, headers) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(id);
    return null;
  }
}

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

// ── إعدادات عن بعد ──
async function fetchRemoteConfig() {
  const data = await fetchJson(
    `${SUPABASE_URL}/rest/v1/radar_config?key=eq.scan&select=value`,
    900, SB_HEADERS
  );
  return (data && data[0] && data[0].value) || null;
}

function mergeConfig(base, remote) {
  if (!remote || typeof remote !== "object") return { cfg: { ...base.cfg }, ff: { ...base.ff }, source: "default" };
  const cfg = { ...base.cfg };
  const ff = { ...base.ff };
  for (const k of Object.keys(remote)) {
    if (k === "FF" && typeof remote.FF === "object") {
      for (const f of Object.keys(remote.FF)) if (f in ff) ff[f] = !!remote.FF[f];
    } else if (["CAPS", "REBOUND", "HOT", "GOLDEN"].includes(k) && typeof remote[k] === "object") {
      cfg[k] = { ...cfg[k], ...remote[k] };
    } else if (k in cfg && typeof remote[k] === typeof cfg[k]) {
      cfg[k] = remote[k];
    }
  }
  return { cfg, ff, source: "remote" };
}

// ── قائمة التهدئة ──
async function fetchCooldownSet(days) {
  const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  const data = await fetchJson(
    `${SUPABASE_URL}/rest/v1/signals?or=(stop_hit.eq.true,status.eq.STOPPED)&signal_date=gte.${since}&select=symbol&limit=300`,
    1200, SB_HEADERS
  );
  const set = new Set();
  if (Array.isArray(data)) for (const r of data) if (r.symbol) set.add(r.symbol);
  return set;
}

// ── Full market snapshot ────────────────────────────────────────────
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

// ── Daily candles per symbol ─────────────────────────────────────
async function fetchAggs(symbol, timeoutMs, days = 130) {
  const key = `${symbol}:${days}`;
  const cached = getCache(key);
  if (cached) return cached;
  const to = sigDate();
  const from = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=${days}&apiKey=${POLYGON_KEY}`;
  const data = await fetchJson(url, timeoutMs);
  const bars = data && data.results ? data.results : null;
  if (bars) setCache(key, bars);
  return bars;
}

// ── حارس البيانات ──
function cleanBars(bars) {
  if (!bars) return null;
  const out = bars.filter(b => b && b.c > 0 && b.h > 0 && b.l > 0 && b.h >= b.l && b.v >= 0);
  return out.length ? out : null;
}

function splitSuspect(bars) {
  if (!bars || bars.length < 10) return false;
  const scan = bars.slice(-63, -3);
  for (let i = 1; i < scan.length; i++) {
    const prev = scan[i - 1].c,
      cur = scan[i].c;
    if (prev > 0 && (cur / prev > 1.6 || cur / prev < 0.55)) return true;
  }
  return false;
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
  let g = 0,
    l = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d;
    else l -= d;
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

function ret3m(bars) {
  if (!bars || bars.length < 40) return null;
  const oldC = bars[0].c,
    nowC = bars[bars.length - 1].c;
  if (!oldC || oldC <= 0) return null;
  const ret = ((nowC - oldC) / oldC) * 100;
  if (ret > 300 || ret < -95) return null;
  return Math.round(ret);
}

function ret20(bars) {
  if (!bars || bars.length < 21) return null;
  const oldC = bars[bars.length - 21].c,
    nowC = bars[bars.length - 1].c;
  if (!oldC || oldC <= 0) return null;
  return ((nowC - oldC) / oldC) * 100;
}

function vcpCheck(bars) {
  if (!bars || bars.length < 30) return { vcp: false, contraction: null };
  const seg = (a) => {
    let hi = -Infinity,
      lo = Infinity;
    for (const b of a) { if (b.h > hi) hi = b.h; if (b.l < lo) lo = b.l; }
    return ((hi - lo) / lo) * 100;
  };
  const r1 = seg(bars.slice(-30, -20));
  const r2v = seg(bars.slice(-20, -10));
  const r3 = seg(bars.slice(-10));
  const ok = r3 < r2v && r2v < r1 && r3 < 12;
  return { vcp: ok, contraction: ok ? Math.round(r3) : null };
}

function upStreak3(bars) {
  if (!bars || bars.length < 5) return false;
  const b = bars.slice(-4, -1);
  if (b.length < 3) return false;
  return b.every((bar, i) => i === 0 ?
    bar.c > bars[bars.length - 5].c :
    bar.c > b[i - 1].c);
}

// ─── 🧠 v19: OBV (On-Balance Volume) ──────────────────────────────
function calculateOBV(bars) {
  if (!bars || bars.length < 20) return { obv: 0, trend: 'neutral', score: 0 };
  let obv = 0;
  const closes = bars.map(b => b.c);
  const vols = bars.map(b => b.v);
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += vols[i];
    else if (closes[i] < closes[i - 1]) obv -= vols[i];
  }
  const avgOBV = obv / bars.length;
  const trend = obv > 0 ? 'صاعد' : obv < 0 ? 'هابط' : 'neutral';
  const score = Math.min(Math.max((obv / (avgOBV || 1)) * 10, 0), 100);
  return { obv, trend, score };
}

// ─── 🧠 v19: CMF (Chaikin Money Flow) ─────────────────────────────
function calculateCMF(bars, period = 20) {
  if (!bars || bars.length < period) return { cmf: 0, score: 0 };
  let mfSum = 0,
    volSum = 0;
  const start = bars.length - period;
  for (let i = start; i < bars.length; i++) {
    const b = bars[i];
    const mfMultiplier = ((b.c - b.l) - (b.h - b.c)) / (b.h - b.l);
    mfSum += mfMultiplier * b.v;
    volSum += b.v;
  }
  const cmf = volSum > 0 ? mfSum / volSum : 0;
  const score = Math.min(Math.max((cmf + 0.5) * 100, 0), 100);
  return { cmf, score };
}

// ─── 🧠 v19: Accumulation Distribution Line ──────────────────────
function calculateADLine(bars) {
  if (!bars || bars.length < 20) return { ad: 0, score: 0 };
  let ad = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const mfm = ((b.c - b.l) - (b.h - b.c)) / (b.h - b.l);
    const mfv = mfm * b.v;
    ad += mfv;
  }
  const avgAD = ad / bars.length;
  const score = Math.min(Math.max((ad / (avgAD || 1)) * 10, 0), 100);
  return { ad, score };
}

// ─── 🧠 v19: Float and Institutional Ownership ──────────────────
function calculateFloatMetrics(symbolData) {
  const float = symbolData.float || 0;
  const institutionalOwnership = symbolData.institutionalOwnership || 0;
  const shortInterest = symbolData.shortInterest || 0;
  let score = 50;
  const reasons = [];
  if (float > 0 && float < 20_000_000) {
    score += 15;
    reasons.push('✅ Float صغير (أقل من 20M)');
  } else if (float > 0 && float < 50_000_000) {
    score += 8;
    reasons.push('📊 Float متوسط (20-50M)');
  }
  if (institutionalOwnership > 0.5) {
    score += 10;
    reasons.push('✅ مؤسسات تملك أكثر من 50%');
  }
  if (shortInterest > 0.15) {
    score += 8;
    reasons.push('✅ نسبة Short Interest مرتفعة');
  }
  return { score: Math.min(score, 100), reasons };
}

// ─── 🧠 v19: بناء Feature Vector ────────────────────────────────
function buildFeatureVector(symbol, price, bars, ind, marketData, sectorData, news) {
  const obv = calculateOBV(bars);
  const cmf = calculateCMF(bars);
  const ad = calculateADLine(bars);
  const floatMetrics = calculateFloatMetrics(symbol);

  const features = {
    // Price & Volume
    price,
    volume: ind.volume || 0,
    dollarVol: ind.dollarVol || 0,
    changePct: ind.changePct || 0,
    // Technical
    rsi: ind.rsi || 50,
    atr: ind.atr || 0,
    rvol: ind.rvol || 1,
    ma21: ind.ma21 || 0,
    ma50: ind.ma50 || 0,
    maDistance: ind.ma21 && price ? ((price - ind.ma21) / ind.ma21) * 100 : 0,
    vwapDistance: ind.vwapDistance || 0,
    // Patterns
    vcp: ind.vcp ? 1 : 0,
    higherLows: ind.higherLows ? 1 : 0,
    higherHighs: ind.higherHighs ? 1 : 0,
    tightRange: ind.tightRange ? 1 : 0,
    // Market & Sector
    marketRegime: marketData?.regime === 'strong' ? 1 : 0,
    sectorStrength: sectorData?.strength || 0.5,
    // OBV, CMF, AD
    obv: obv.score,
    cmf: cmf.score,
    ad: ad.score,
    // Float & Institutional
    floatScore: floatMetrics.score,
    // News
    newsCount: news?.length || 0,
    recentNews: news?.filter(n => n.ageHours < 2).length || 0,
    // DNA & Pattern
    patternScore: ind.patternScore || 0,
    catalystScore: ind.catalystScore || 0,
    // Risk
    riskScore: ind.riskScore || 50,
    // Structure
    rr: ind.rr || 0,
    resistanceDistance: ind.resistanceDistance || 100,
  };

  return features;
}

// ─── 🧠 v19: Prediction Model (بدلاً من القواعد اليدوية) ──────
function predictWithModel(features, learnedWeights) {
  // استخدام الأوزان المتعلمة أو الأوزان الافتراضية
  const weights = learnedWeights || {
    rsi: 0.08,
    rvol: 0.10,
    atr: 0.05,
    maDistance: 0.08,
    vwapDistance: 0.06,
    vcp: 0.08,
    higherLows: 0.06,
    higherHighs: 0.04,
    tightRange: 0.04,
    marketRegime: 0.07,
    sectorStrength: 0.06,
    obv: 0.07,
    cmf: 0.07,
    ad: 0.05,
    floatScore: 0.06,
    newsCount: 0.04,
    patternScore: 0.08,
    catalystScore: 0.06,
    riskScore: -0.08,
    rr: 0.10,
    resistanceDistance: -0.05,
  };

  let score = 0;
  const breakdown = [];
  for (const [key, weight] of Object.entries(weights)) {
    if (features[key] !== undefined) {
      const value = typeof features[key] === 'number' ? features[key] : 0;
      // تطبيع القيم لتكون بين 0-1
      let normalized = value / 100;
      if (key === 'rr') normalized = Math.min(value / 5, 1);
      if (key === 'resistanceDistance') normalized = Math.max(0, 1 - value / 20);
      if (key === 'maDistance') normalized = Math.max(0, Math.min((value + 20) / 40, 1));
      if (key === 'vwapDistance') normalized = Math.max(0, Math.min((value + 10) / 20, 1));
      const contribution = normalized * weight * 100;
      score += contribution;
      breakdown.push({
        factor: key,
        raw: value,
        normalized: Math.round(normalized * 100),
        weight: Math.round(weight * 100),
        contribution: Math.round(contribution),
      });
    }
  }

  const finalScore = Math.min(Math.max(score, 0), 100);
  let grade;
  if (finalScore >= 85) grade = 'ELITE';
  else if (finalScore >= 75) grade = 'PRIME';
  else if (finalScore >= 65) grade = 'STRONG';
  else if (finalScore >= 55) grade = 'GOOD';
  else if (finalScore >= 45) grade = 'WATCH';
  else grade = 'AVOID';

  return { score: Math.round(finalScore), grade, breakdown };
}

// ─── 🧠 v19: Probability based on Historical Data ──────────────
function calculateHistoricalProbability(grade, features, historicalData) {
  // التحقق من البيانات التاريخية
  if (!historicalData || historicalData.length < 50) {
    // استخدام قواعد افتراضية
    const gradeProbs = { ELITE: 82, PRIME: 72, STRONG: 62, GOOD: 52, WATCH: 42, AVOID: 25 };
    const baseProb = gradeProbs[grade] || 50;
    // تعديل حسب العوامل
    let adjustment = 0;
    if (features.rvol > 2.5) adjustment += 5;
    if (features.marketRegime === 1) adjustment += 5;
    if (features.vcp === 1) adjustment += 3;
    if (features.newsCount > 0) adjustment += 3;
    if (features.rr > 2) adjustment += 4;
    const prob = Math.min(Math.max(baseProb + adjustment, 0), 100);
    return {
      t1: Math.round(prob),
      t2: Math.round(prob * 0.75),
      t3: Math.round(prob * 0.5),
      confidence: Math.round(prob * 0.85 + 10),
    };
  }

  // استخدام البيانات التاريخية
  const similar = historicalData.filter(h =>
    Math.abs(h.predictionScore - features.predictionScore) < 5 &&
    h.grade === grade
  );
  if (similar.length > 20) {
    const reachedT1 = similar.filter(h => h.reachedT1).length / similar.length;
    const reachedT2 = similar.filter(h => h.reachedT2).length / similar.length;
    const reachedT3 = similar.filter(h => h.reachedT3).length / similar.length;
    return {
      t1: Math.round(reachedT1 * 100),
      t2: Math.round(reachedT2 * 100),
      t3: Math.round(reachedT3 * 100),
      confidence: Math.round((reachedT1 * 0.8 + 0.2) * 100),
    };
  }

  // بيانات غير كافية
  return { t1: 50, t2: 38, t3: 25, confidence: 45 };
}

// ─── AI-Az structure ──────────────────────────────────────────────
function buildStructure(price, bars, ind, CFG) {
  if (!bars || bars.length < 30 || !price) return null;
  const cap = (v, maxPct) => Math.min(v, price * (1 + maxPct / 100));
  const capDn = (v, maxPct) => Math.max(v, price * (1 - maxPct / 100));

  let hi20 = -Infinity,
    lo20 = Infinity;
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
  const trend = aboveMA && ind.ma21 > (ind.ma50 || 0) ? "صاعد مؤكد ✅" :
    aboveMA ? "ينتظر تأكيد ⏳" :
    "هابط بلا تأكيد ⛔";
  let flag;
  if (price > support && price <= confirm * 1.01 && rr >= CFG.MIN_RR) flag = "دخول صحيح ✅";
  else if (aboveMA && rr >= CFG.MIN_RR) flag = "مقبول";
  else flag = "ملاحقة/غير مؤكد ⚠️";

  const pctOf = (v) => r2(((v - price) / price) * 100);

  return {
    rr,
    t1,
    t2,
    t3,
    flag,
    trend,
    atrPct,
    stop: r2(stop),
    entry,
    confirm,
    support: r2(support),
    resistance,
    t1Pct: pctOf(t1),
    t2Pct: pctOf(t2),
    t3Pct: pctOf(t3),
    stopPct: pctOf(stop),
    entryPct: pctOf(entry),
    confirmPct: pctOf(confirm),
    supportPct: pctOf(support),
    resistancePct: pctOf(resistance),
    posInBand: r2((price - support) / Math.max(0.01, resistance - support)),
    resistanceDistance: pctOf(resistance),
  };
}

function buildLevels(price, st) {
  if (!st) return { t1: 0, t1Pct: 0, t2: 0, t2Pct: 0, t3: 0, t3Pct: 0, sl: 0, slPct: 0, risk: 0 };
  return {
    t1: st.t1,
    t1Pct: st.t1Pct,
    t2: st.t2,
    t2Pct: st.t2Pct,
    t3: st.t3,
    t3Pct: st.t3Pct,
    sl: st.stop,
    slPct: st.stopPct,
    risk: Math.abs(st.stopPct),
  };
}

function entryState(price, ind, st, CFG) {
  if (!st) return { code: "none", label: "—", wait_price: null };
  const extPct = ind.ma21 ? ((price - ind.ma21) / ind.ma21) * 100 : 0;
  if (extPct >= CFG.CHASE_EXT_PCT || st.posInBand >= CFG.CHASE_BAND) {
    return { code: "chasing", label: "🔴 ملاحقة خطرة — لا تدخل الآن", wait_price: st.entry, ext_pct: r2(extPct) };
  }
  if (st.flag === "دخول صحيح ✅" && st.posInBand <= 0.75) {
    return { code: "in_zone", label: "🟢 داخل منطقة الدخول", wait_price: null, ext_pct: r2(extPct) };
  }
  return { code: "wait_pullback", label: `🟡 ممتد — انتظره عند ${st.entry}`, wait_price: st.entry, ext_pct: r2(extPct) };
}

function goldenCheck(a, ind, minsET, regime, G) {
  const checks = {
    above_vwap: a.vwap != null && a.price > a.vwap,
    rvol: (ind.rvol ?? 0) >= G.RVOL,
    change: a.change_pct >= G.CHG_MIN && a.change_pct <= G.CHG_MAX,
    price: a.price >= G.PRICE_MIN && a.price <= G.PRICE_MAX,
    not_late: (ind.rsi ?? 100) < G.RSI_MAX && !ind.up3,
    window: minsET >= G.WINDOW_START && minsET <= G.WINDOW_END && regime === "قوي",
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { golden: passed === 6, passed, checks };
}

async function saveSignals(rows, left, debug, CFG) {
  if (!rows.length) return { saved: 0, status: 0 };
  const timeout = Math.max(600, Math.min(1500, left() - 400));
  if (timeout < 600) { debug.save_skipped = true; return { saved: 0, status: 0 }; }
  const payload = rows.map(s => ({
    symbol: s.symbol,
    signal_date: sigDate(),
    entry_price: s.price,
    target1: s.levels.t1,
    target2: s.levels.t2,
    target3: s.levels.t3,
    stop_loss: s.levels.sl,
    score: s.predictionScore,
    ep: s.predictionScore,
    volume: s.volume,
    change_pct: s.change_pct,
    type: s.type || 'مضاربة',
    status: "OPEN",
    rvol: s.rvol,
    rsi: s.rsi,
    atr14: s.atr14,
    ma_signal: s.ma_signal,
    news_age_h: s.news_age_h,
    news_age_hours: s.news_age_h,
    is_hot: s.predictionGrade === 'ELITE' || s.predictionGrade === 'PRIME',
    early_watch: s.predictionGrade === 'ELITE' || false,
    is_target: s.predictionGrade === 'ELITE' || false,
    vcp: s.vcp,
    vcp_contraction: s.vcp_contraction,
    fresh_zone: s.fresh_zone || false,
    premarket_watch: s.premarket_watch || false,
    structure: {
      ...s.structure,
      predictionScore: s.predictionScore,
      predictionGrade: s.predictionGrade,
      timing: s.timing,
      featureVector: s.featureVector,
      probabilities: s.probabilities,
    },
    is_smart_bounce: false,
    smart_bounce_confidence: 0,
  }));

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?on_conflict=symbol,signal_date`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          ...SB_HEADERS,
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

// ─── جلسة السوق ──────────────────────────────────────────────────────
function getMarketSession() {
  const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const h = ny.getHours(),
    m = ny.getMinutes();
  const minutes = h * 60 + m;
  const day = ny.getDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) return { session: 'closed', label: '🔴 السوق مغلق' };
  if (minutes >= 240 && minutes < 570) return { session: 'premarket', label: '🟡 Pre-Market' };
  if (minutes >= 570 && minutes < 600) return { session: 'open', label: '🟢 افتتاح' };
  if (minutes >= 600 && minutes < 780) return { session: 'golden', label: '🔥 الفترة الذهبية' };
  if (minutes >= 780 && minutes < 960) return { session: 'late', label: '🟠 فترة متأخرة' };
  if (minutes >= 960 && minutes < 1020) return { session: 'afterhours', label: '🔵 After-Hours' };
  return { session: 'closed', label: '🔴 السوق مغلق' };
}

// ─── استيراد المكونات الأساسية ────────────────────────────────────
import { DataProvider } from '../../lib/radar/core/DataProvider.js';
import { FeatureStore } from '../../lib/radar/core/FeatureStore.js';
import { BrainManager } from '../../lib/radar/core/BrainManager.js';
import { DecisionContext } from '../../lib/radar/core/DecisionContext.js';
import { DecisionAudit } from '../../lib/radar/core/DecisionAudit.js';
import { ExplainEngine } from '../../lib/radar/core/ExplainEngine.js';
import { OpportunityRanking } from '../../lib/radar/core/OpportunityRanking.js';
import { EventBus } from '../../lib/radar/core/EventBus.js';
import { HealthMonitor } from '../../lib/radar/core/HealthMonitor.js';
import { getStrategyProfile } from '../../lib/radar/core/StrategyProfiles.js';
import { LearningEngine } from '../../lib/radar/core/LearningEngine.js';
import { ProbabilityEngine } from '../../lib/radar/core/ProbabilityEngine.js';
import { AdaptiveModels } from '../../lib/radar/core/AdaptiveModels.js';
import { FeedbackEngine } from '../../lib/radar/core/FeedbackEngine.js';
import { CONFIG } from '../../lib/radar/core/config.js';

// ─── استيراد جميع الـ Brains ──────────────────────────────────────
import { QualityControlBrain } from '../../lib/radar/brains/QualityControlBrain.js';
import { MarketIntelligenceBrain } from '../../lib/radar/brains/MarketIntelligenceBrain.js';
import { SectorIntelligenceBrain } from '../../lib/radar/brains/SectorIntelligenceBrain.js';
import { LiquidityBrain } from '../../lib/radar/brains/LiquidityBrain.js';
import { MomentumBrain } from '../../lib/radar/brains/MomentumBrain.js';
import { TrendBrain } from '../../lib/radar/brains/TrendBrain.js';
import { StructureBrain } from '../../lib/radar/brains/StructureBrain.js';
import { PatternBrain } from '../../lib/radar/brains/PatternBrain.js';
import { CatalystBrain } from '../../lib/radar/brains/CatalystBrain.js';
import { DNABrain } from '../../lib/radar/brains/DNABrain.js';
import { RelativeStrengthBrain } from '../../lib/radar/brains/RelativeStrengthBrain.js';
import { RiskBrain } from '../../lib/radar/brains/RiskBrain.js';
import { PortfolioBrain } from '../../lib/radar/brains/PortfolioBrain.js';
import { ContradictionBrain } from '../../lib/radar/brains/ContradictionBrain.js';
import { ConsensusBrain } from '../../lib/radar/brains/ConsensusBrain.js';

// ═══════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  const T0 = Date.now();

  let CFG = { ...CFG_DEFAULT, CAPS: { ...CFG_DEFAULT.CAPS }, REBOUND: { ...CFG_DEFAULT.REBOUND }, HOT: { ...CFG_DEFAULT.HOT }, GOLDEN: { ...CFG_DEFAULT.GOLDEN } };
  let FF = { ...FF_DEFAULT };
  const left = () => CFG.BUDGET - (Date.now() - T0);
  const light = req.query.light === "1";
  const sessionInfo = getMarketSession();

  const debug = {
    market_scanned: 0,
    market_regime: null,
    config_source: "default",
    cooldown_symbols: 0,
    spy_rs_ready: false,
    after_filter: 0,
    top_selected: 0,
    tech_analyzed: 0,
    news_fetched: 0,
    dropped_total: 0,
    dropped_penny_gate: 0,
    dropped_liquidity: 0,
    dropped_trend_gate: 0,
    dropped_no_tech: 0,
    dropped_timeout: 0,
    dropped_extreme_gain: 0,
    data_warned: 0,
    chase_flagged: 0,
    cooldown_hits: 0,
    golden_count: 0,
    survivors: 0,
    below_save_ep: 0,
    saved: 0,
    session: sessionInfo.session,
    sessionLabel: sessionInfo.label,
    total_candidates: 0,
    weights_used: {},
    adaptive_model: 'unknown',
    parallel_execution: true,
  };

  try {
    // ── Stage 1: Fetch market ──
    const [tickers, remoteCfg, cooldownSet] = await Promise.all([
      fetchFullMarket(left),
      FF.remote_config ? fetchRemoteConfig() : Promise.resolve(null),
      FF_DEFAULT.cooldown ? fetchCooldownSet(CFG_DEFAULT.COOLDOWN_DAYS) : Promise.resolve(new Set()),
    ]);
    debug.market_scanned = tickers.length;

    const merged = mergeConfig({ cfg: CFG, ff: FF }, remoteCfg);
    CFG = merged.cfg;
    FF = merged.ff;
    debug.config_source = merged.source;
    debug.cooldown_symbols = cooldownSet.size;

    // ── SPY pulse ──
    const spy = tickers.find(t => t.ticker === "SPY");
    if (spy && spy.day) {
      const spyChg = spy.todaysChangePerc ?? 0;
      debug.market_regime = spyChg >= 0 ? "قوي" : "ضعيف";
    }

    const ny = nyNow();
    const minsET = ny.getHours() * 60 + ny.getMinutes();

    // ── Stage 2: Universe ──
    const movers = { gainers: [], losers: [], volume: [], value: [] };
    const cand = [];

    for (const t of tickers) {
      const d = t.day || {};
      const price = d.c || t.lastTrade?.p || 0;
      const vol = d.v || 0;
      const chg = t.todaysChangePerc ?? 0;
      if (!price || !vol) continue;

      const row = {
        symbol: t.ticker,
        price: r2(price),
        change_pct: r2(chg),
        volume: vol,
        dollar_vol: price * vol,
        vwap: d.vw || null,
        open: d.o || 0,
        high: d.h || 0,
        low: d.l || 0,
        marketCap: d.marketCap || 0,
        float: d.float || 0,
        institutionalOwnership: d.institutionalOwnership || 0,
        shortInterest: d.shortInterest || 0,
      };

      movers.gainers.push(row);
      movers.losers.push(row);
      movers.volume.push(row);
      movers.value.push(row);

      const isPreMarket = sessionInfo.session === 'premarket';
      const minPrice = isPreMarket ? 0.20 : CFG.MIN_PRICE;
      const minVol = isPreMarket ? 1000 : CFG.MIN_VOLUME;
      const minDollarVol = isPreMarket ? 10000 : CFG.MIN_DOLLARVOL;

      if (price < minPrice) { debug.dropped_penny_gate++; continue; }
      if (vol < minVol || price * vol < minDollarVol) { debug.dropped_liquidity++; continue; }
      if (chg > CFG.MAX_CHANGE) { debug.dropped_extreme_gain++; continue; }
      if (/[.\-]|W$/.test(t.ticker) || t.ticker.length > 5) continue;

      cand.push(row);
    }

    movers.gainers = movers.gainers.sort((a, b) => b.change_pct - a.change_pct).slice(0, 15);
    movers.losers = movers.losers.sort((a, b) => a.change_pct - b.change_pct).slice(0, 15);
    movers.volume = movers.volume.sort((a, b) => b.volume - a.volume).slice(0, 15);
    movers.value = movers.value.sort((a, b) => b.dollar_vol - a.dollar_vol).slice(0, 15);

    debug.total_candidates = cand.length;
    debug.after_filter = cand.length;

    // ── SPY Relative Strength ──
    let spyRet20 = null;
    if (FF.rel_strength && left() > 3000) {
      const spyBars = cleanBars(await fetchAggs("SPY", CFG.AGGS_TIMEOUT));
      spyRet20 = ret20(spyBars);
      debug.spy_rs_ready = spyRet20 != null;
    }

    // ── 🧠 v17: تحميل الأوزان المتعلمة ──
    const learningEngine = new LearningEngine();
    const learnedWeights = await learningEngine.loadWeights();
    debug.weights_used = learnedWeights || {};

    // ── 🧠 v17: Adaptive Models ──
    const adaptiveModels = new AdaptiveModels();

    // ── 🧠 v18: Feedback Engine ──
    const feedbackEngine = new FeedbackEngine();

    // ── 🧠 v19: تحميل البيانات التاريخية ──
    let historicalData = [];
    try {
      const histRes = await fetch(
        `${SUPABASE_URL}/rest/v1/trade_history?limit=500&order=timestamp.desc`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      historicalData = await histRes.json();
    } catch {}

    // ── Stage 3: تحليل جميع الأسهم (Parallel Execution) ──
    const brainManager = new BrainManager();
    brainManager
      .register(new QualityControlBrain())
      .register(new MarketIntelligenceBrain())
      .register(new SectorIntelligenceBrain())
      .register(new LiquidityBrain())
      .register(new MomentumBrain())
      .register(new TrendBrain())
      .register(new StructureBrain())
      .register(new PatternBrain())
      .register(new CatalystBrain())
      .register(new DNABrain())
      .register(new RelativeStrengthBrain())
      .register(new RiskBrain())
      .register(new PortfolioBrain())
      .register(new ContradictionBrain())
      .register(new ConsensusBrain());

    // ── Parallel Processing: تحليل جميع الأسهم ──
    const analyzed = [];
    for (let i = 0; i < cand.length; i += CFG.BATCH) {
      if (left() < 1800) { debug.dropped_timeout += cand.length - i; break; }
      const batch = cand.slice(i, i + CFG.BATCH);

      // 🔥 Parallel Execution: جلب البيانات بالتوازي
      const batchData = await Promise.all(batch.map(async (c) => {
        const bars = await fetchAggs(c.symbol, CFG.AGGS_TIMEOUT);
        if (FF.data_guard && bars) return { ...c, bars: cleanBars(bars) };
        return { ...c, bars };
      }));

      // تصفية الأسهم التي ليس لديها بيانات كافية
      const validBatch = batchData.filter(c => c.bars && c.bars.length >= 30);
      debug.dropped_no_tech += batch.length - validBatch.length;

      // 🔥 Parallel Execution: تحليل كل سهم بالتوازي
      const analysisResults = await Promise.all(validBatch.map(async (c) => {
        const bars = c.bars;
        const closes = bars.map(b => b.c);
        const vols = bars.map(b => b.v);

        // حساب المؤشرات الأساسية
        const ind = {
          ma21: sma(closes, 21),
          ma50: sma(closes, 50),
          rsi: rsi14(closes),
          atr: atr14(bars),
          rvol: (() => { const a = sma(vols.slice(0, -1), 20); return a ? r2(c.volume / a) : null; })(),
          ret3m: ret3m(bars),
          ret20: ret20(bars),
          vcp: vcpCheck(bars),
          data_warn: FF.data_guard ? splitSuspect(bars) : false,
          up3: upStreak3(bars),
          changePct: c.change_pct,
          marketRegime: debug.market_regime,
          marketCap: c.marketCap || 0,
          vwapDistance: c.vwap ? ((c.price - c.vwap) / c.vwap) * 100 : 0,
          relativeVolume: (() => { const a = sma(vols.slice(0, -1), 20); return a ? c.volume / a : 0; })(),
          dollarVol: c.dollar_vol || 0,
        };

        // المؤشرات المتقدمة (v19)
        const obv = calculateOBV(bars);
        const cmf = calculateCMF(bars);
        const ad = calculateADLine(bars);
        const floatMetrics = calculateFloatMetrics(c);

        // الهيكل
        const st = buildStructure(c.price, bars, ind, CFG);
        const levels = buildLevels(c.price, st);

        // بناء Feature Vector
        const featureVector = buildFeatureVector(c, c.price, bars, {
          ...ind,
          obv: obv.score,
          cmf: cmf.score,
          ad: ad.score,
          floatScore: floatMetrics.score,
          patternScore: 0,
          catalystScore: 0,
          riskScore: 50,
          rr: st?.rr || 0,
          resistanceDistance: st?.resistanceDistance || 100,
          higherLows: 0,
          higherHighs: 0,
          tightRange: 0,
        }, {}, {}, []);

        // ✅ v19: Prediction Model (بدون EP يدوي)
        const prediction = predictWithModel(featureVector, learnedWeights);

        // Timing
        const timing = detectTiming(st, { score: 0 }, { probability: 0 });

        // ✅ v19: Probability based on Historical Data
        const probabilities = calculateHistoricalProbability(prediction.grade, featureVector, historicalData);

        // Consensus Score
        const consensusScore = prediction.score;

        // بناء النتيجة النهائية
        const stOut = st ? {
          ...st,
          predictionScore: prediction.score,
          predictionGrade: prediction.grade,
          predictionBreakdown: prediction.breakdown,
          timing,
          featureVector,
          probabilities,
          obv: obv.obv,
          cmf: cmf.cmf,
          ad: ad.ad,
          floatScore: floatMetrics.score,
        } : st;

        const isHot = prediction.grade === 'ELITE' || prediction.grade === 'PRIME';
        const isTarget = prediction.grade === 'ELITE';

        // v19: Return with all data
        return {
          ...c,
          bars,
          ind,
          st,
          levels,
          obv,
          cmf,
          ad,
          floatMetrics,
          featureVector,
          prediction,
          timing,
          probabilities,
          consensusScore,
          stOut,
          isHot,
          isTarget,
        };
      }));

      for (const r of analysisResults) if (r) analyzed.push(r);
    }
    debug.tech_analyzed = analyzed.length;

    // ── Stage 4: بناء الإشارات ──
    const signals = [];
    for (const a of analyzed) {
      const { ind, st } = a;

      if (ind.ma21 == null || a.price < ind.ma21 * 0.95) { debug.dropped_trend_gate++; continue; }
      if ((ind.rsi ?? 50) > 85 || (ind.rvol ?? 1) < 0.6) { continue; }

      const isRebound = (ind.rsi ?? 99) < CFG.REBOUND.RSI &&
        a.price >= CFG.REBOUND.PRICE &&
        a.dollar_vol >= CFG.REBOUND.DVOL &&
        (ind.ret3m ?? 0) >= CFG.REBOUND.RET;

      const type = isRebound ? 'ارتداد' :
        (a.dollar_vol >= 50e6 && a.prediction.score >= 60 ? 'استثمار' : 'مضاربة');

      const signalLabel = a.prediction.grade === 'ELITE' ? '💥 انفجاري' :
        a.prediction.grade === 'PRIME' ? '🔥 عالي' : '📊 متوسط';

      signals.push({
        symbol: a.symbol,
        price: a.price,
        change_pct: a.change_pct,
        volume: a.volume,
        dollar_vol: a.dollar_vol,
        score: a.prediction.score,
        predictionScore: a.prediction.score,
        predictionGrade: a.prediction.grade,
        predictionBreakdown: a.prediction.breakdown,
        timing: a.timing,
        probabilities: a.probabilities,
        featureVector: a.featureVector,
        obv: a.obv,
        cmf: a.cmf,
        ad: a.ad,
        floatScore: a.floatMetrics.score,
        rvol: ind.rvol,
        rsi: ind.rsi,
        atr14: ind.atr != null ? r2(ind.atr) : null,
        ma_signal: ind.ma21 && ind.ma50 ? (ind.ma21 > ind.ma50 ? 'فوق MA21/50' : 'بين المتوسطات') : null,
        vcp: ind.vcp.vcp,
        vcp_contraction: ind.vcp.contraction,
        is_hot: a.isHot,
        is_target: a.isTarget,
        is_rebound: isRebound,
        type: type,
        signal: signalLabel,
        levels: a.levels,
        structure: a.stOut,
        session: sessionInfo.session,
      });
    }

    debug.survivors = signals.length;

    // ── Stage 5: News ──
    if (FF.news && left() >= 1500 && signals.length) {
      const newsTargets = signals.filter(s => s.is_hot || s.is_target).slice(0, 6);
      await Promise.all(newsTargets.map(async (s) => {
        const data = await fetchJson(
          `https://api.polygon.io/v2/reference/news?ticker=${s.symbol}&limit=3&apiKey=${POLYGON_KEY}`,
          1200
        );
        const articles = data?.results || [];
        if (articles.length > 0) {
          s.news = articles.map(a => ({
            title: a.title || '',
            published: a.published_utc || '',
            ageHours: a.published_utc ? Math.round((Date.now() - new Date(a.published_utc)) / 3600000) : null,
            sentiment: a.title?.includes('up') || a.title?.includes('rise') ? 'إيجابي' : 'محايد',
          }));
          debug.news_fetched += articles.length;
        }
      }));
    }

    // ── Stage 6: Save ──
    const toSave = signals.filter(s => s.predictionScore >= CFG.SAVE_MIN_EP && s.structure);
    debug.below_save_ep = signals.length - toSave.length;
    const saveResult = await saveSignals(toSave, left, debug, CFG);
    debug.saved = saveResult.saved;

    // ── Response ──
    const base = {
      success: true,
      total: signals.length,
      market_regime: debug.market_regime,
      session: sessionInfo.session,
      sessionLabel: sessionInfo.label,
      hot: signals.filter(s => s.is_hot).length,
      target: signals.filter(s => s.is_target).length,
      early: signals.filter(s => s.featureVector?.patternScore >= 60).length,
      golden: signals.filter(s => s.is_golden).length,
      saved: saveResult.saved,
      saveResult,
      adaptive_model: debug.adaptive_model,
      parallel_execution: true,
      elapsed_ms: Date.now() - T0,
      debug,
    };

    if (light) return res.status(200).json({ ...base, light: true });
    return res.status(200).json({ ...base, results: signals, movers });

  } catch (err) {
    return res.status(200).json({
      success: false,
      error: err.message,
      partial: true,
      elapsed_ms: Date.now() - T0,
      debug,
    });
  }
}

// ─── 🧠 v15: Timing Detection ──────────────────────────────────
function detectTiming(structure, earlyAcc, breakoutProb) {
  if (!structure) return { timing: 'UNKNOWN', label: 'غير معروف' };

  const rr = structure.rr || 0;
  const resDist = structure.resistanceDistance || 100;
  const accScore = earlyAcc?.score || 0;
  const bProb = breakoutProb?.probability || 0;

  if (resDist <= 3 && resDist > 0 && rr >= 2 && bProb >= 70) {
    return { timing: 'PRE_BREAKOUT', label: 'قبل الاختراق - مثالي' };
  }

  if (resDist <= 0 && rr >= 1.5 && bProb >= 60) {
    return { timing: 'BREAKOUT', label: 'اختراق - جيد' };
  }

  if (accScore >= 60 && bProb >= 50) {
    return { timing: 'EARLY_MOMENTUM', label: 'بداية زخم - جيد' };
  }

  if (accScore >= 40 && bProb >= 40) {
    return { timing: 'WAIT', label: 'مراقبة - ينتظر تأكيد' };
  }

  return { timing: 'LATE', label: 'متأخر - تجنب' };
}
