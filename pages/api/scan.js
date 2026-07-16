// pages/api/scan.js — v19.7 (إصلاح خطأ نحوي في buildStructure)
export const config = { maxDuration: 15 };

const POLYGON_KEY = process.env.POLYGON_API_KEY || process.env.POLYGON_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

// ─── الإعدادات المحسّنة ──────────────────────────────────────────
const CFG_DEFAULT = {
  BUDGET: 8000,
  MIN_PRICE: 0.20,
  MIN_VOLUME: 1000,
  MIN_DOLLARVOL: 10000,
  BATCH: 100,
  AGGS_TIMEOUT: 2000,
  SAVE_MIN_EP: 35,
  MIN_RR: 0.5,
  HEAVY_LIMIT: 150,
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
  const bars = data && data.results && Array.isArray(data.results) ? data.results : null;
  if (bars) setCache(key, bars);
  return bars;
}

function cleanBars(bars) {
  if (!bars || !Array.isArray(bars)) return null;
  const out = bars.filter(b => b && b.c > 0 && b.h > 0 && b.l > 0 && b.h >= b.l && b.v >= 0);
  return out.length ? out : null;
}

function splitSuspect(bars) {
  if (!bars || !Array.isArray(bars) || bars.length < 10) return false;
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
  if (!arr || !Array.isArray(arr) || arr.length < p) return null;
  let s = 0;
  for (let i = arr.length - p; i < arr.length; i++) s += arr[i];
  return s / p;
}

function rsi14(closes) {
  if (!closes || !Array.isArray(closes) || closes.length < 15) return null;
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
  if (!bars || !Array.isArray(bars) || bars.length < 15) return null;
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
  if (!bars || !Array.isArray(bars) || bars.length < 40) return null;
  const oldC = bars[0].c,
    nowC = bars[bars.length - 1].c;
  if (!oldC || oldC <= 0) return null;
  const ret = ((nowC - oldC) / oldC) * 100;
  if (ret > 300 || ret < -95) return null;
  return Math.round(ret);
}

function ret20(bars) {
  if (!bars || !Array.isArray(bars) || bars.length < 21) return null;
  const oldC = bars[bars.length - 21].c,
    nowC = bars[bars.length - 1].c;
  if (!oldC || oldC <= 0) return null;
  return ((nowC - oldC) / oldC) * 100;
}

function vcpCheck(bars) {
  if (!bars || !Array.isArray(bars) || bars.length < 30) return { vcp: false, contraction: null };
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
  if (!bars || !Array.isArray(bars) || bars.length < 5) return false;
  const b = bars.slice(-4, -1);
  if (b.length < 3) return false;
  return b.every((bar, i) => i === 0 ?
    bar.c > bars[bars.length - 5].c :
    bar.c > b[i - 1].c);
}

// ─── Early Accumulation ──────────────────────────────────────────
function calculateEarlyAccumulation(bars, price) {
  if (!bars || !Array.isArray(bars) || bars.length < 30) return { score: 0, reasons: [] };
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);
  const closes = bars.map(b => b.c);
  const vols = bars.map(b => b.v);
  let score = 0;
  const reasons = [];
  const atr = atr14(bars);
  const atrPct = (atr / price) * 100;
  if (atrPct < 2) { score += 15;
    reasons.push('ATR منخفض'); } else if (atrPct < 3) { score += 8;
    reasons.push('ATR متوسط'); }
  const last5Lows = lows.slice(-5);
  const higherLows = last5Lows.every((l, i) => i === 0 || l > last5Lows[i - 1]);
  if (higherLows) { score += 10;
    reasons.push('Higher Lows'); }
  const avgVol = sma(vols.slice(0, -1), 20);
  const lastVol = vols[vols.length - 1];
  if (avgVol && lastVol < avgVol * 0.7) { score += 10;
    reasons.push('Volume Dry Up'); }
  const range10 = ((Math.max(...highs.slice(-10)) - Math.min(...lows.slice(-10))) / price) * 100;
  if (range10 < 3) { score += 10;
    reasons.push('Tight Range'); }
  const ma21 = sma(closes, 21);
  const ma50 = sma(closes, 50);
  if (ma21 && price > ma21) { score += 8;
    reasons.push('فوق MA21'); }
  if (ma50 && price > ma50) { score += 5;
    reasons.push('فوق MA50'); }
  const last5Highs = highs.slice(-5);
  const higherHighs = last5Highs.every((h, i) => i === 0 || h > last5Highs[i - 1]);
  if (higherHighs) { score += 8;
    reasons.push('Higher Highs'); }
  return { score: Math.min(score, 100), reasons };
}

// ─── Breakout Probability ─────────────────────────────────────────
function calculateBreakoutProbability(price, bars, structure) {
  if (!structure || !bars || !Array.isArray(bars) || bars.length < 30) return { probability: 50, reasons: [] };
  let prob = 50;
  const reasons = [];
  const resistanceDist = structure.resistanceDistance || 100;
  if (resistanceDist <= 2) { prob += 15;
    reasons.push('مقاومة قريبة جداً'); } else if (resistanceDist <= 5) { prob += 10;
    reasons.push('مقاومة قريبة'); }
  const atr = atr14(bars);
  const atrPct = (atr / price) * 100;
  if (atrPct < 2) { prob += 10;
    reasons.push('ATR منخفض'); }
  const lows = bars.map(b => b.l);
  const last5Lows = lows.slice(-5);
  const higherLows = last5Lows.every((l, i) => i === 0 || l > last5Lows[i - 1]);
  if (higherLows) { prob += 10;
    reasons.push('Higher Lows'); }
  const vols = bars.map(b => b.v);
  const avgVol = sma(vols.slice(0, -1), 20);
  const lastVol = vols[vols.length - 1];
  if (avgVol && lastVol > avgVol * 1.5) { prob += 10;
    reasons.push('حجم مرتفع'); }
  const vcp = vcpCheck(bars);
  if (vcp.vcp) { prob += 10;
    reasons.push('VCP مكتمل'); }
  if (structure.rr >= 2.5) { prob += 10;
    reasons.push('RR ممتاز'); } else if (structure.rr >= 1.5) { prob += 5;
    reasons.push('RR جيد'); }
  return { probability: Math.min(prob, 100), reasons };
}

// ─── Structure (تم إصلاح الخطأ النحوي) ───────────────────────────
function buildStructure(price, bars, ind, CFG) {
  if (!bars || !Array.isArray(bars) || bars.length < 30 || !price) return null;
  const cap = (v, maxPct) => Math.min(v, price * (1 + maxPct / 100));
  const capDn = (v, maxPct) => Math.max(v, price * (1 - maxPct / 100)); // ✅ إصلاح: كان price(Math * ...) خطأ
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

// ─── دالة الحفظ مع تحويل القيم العشرية إلى أعداد صحيحة ──────
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
    score: Math.round(s.predictionScore || s.score || 0),
    ep: Math.round(s.predictionScore || s.score || 0),
    volume: s.volume,
    change_pct: s.change_pct,
    type: s.type || 'مضاربة',
    status: "OPEN",
    rvol: s.rvol !== undefined && s.rvol !== null ? Math.round(s.rvol * 100) / 100 : null,
    rsi: s.rsi !== undefined && s.rsi !== null ? Math.round(s.rsi) : null,
    atr14: s.atr14 !== undefined && s.atr14 !== null ? Math.round(s.atr14 * 100) / 100 : null,
    ma_signal: s.ma_signal || null,
    news_age_h: s.news_age_h !== undefined && s.news_age_h !== null ? Math.round(s.news_age_h) : null,
    news_age_hours: s.news_age_h !== undefined && s.news_age_h !== null ? Math.round(s.news_age_h) : null,
    is_hot: s.predictionGrade === 'ELITE' || s.predictionGrade === 'PRIME',
    early_watch: s.predictionGrade === 'ELITE' || false,
    is_target: s.predictionGrade === 'ELITE' || false,
    vcp: s.vcp || false,
    vcp_contraction: s.vcp_contraction !== undefined && s.vcp_contraction !== null ? Math.round(s.vcp_contraction) : null,
    fresh_zone: s.fresh_zone || false,
    premarket_watch: s.premarket_watch || false,
    structure: {
      rr: s.structure?.rr || 0,
      t1: s.structure?.t1 || 0,
      t2: s.structure?.t2 || 0,
      t3: s.structure?.t3 || 0,
      stop: s.structure?.stop || 0,
      entry: s.structure?.entry || 0,
      support: s.structure?.support || 0,
      resistance: s.structure?.resistance || 0,
      flag: s.structure?.flag || '',
      trend: s.structure?.trend || '',
      predictionScore: Math.round(s.predictionScore || 0),
      predictionGrade: s.predictionGrade || 'WATCH',
      timing: s.timing?.timing || 'UNKNOWN',
      earlyAccumulationScore: Math.round(s.earlyAccumulation?.score || 0),
      breakoutProbabilityScore: Math.round(s.breakoutProbability?.probability || 0),
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
    let errorText = '';
    if (!res.ok) {
      try {
        errorText = await res.text();
      } catch {}
      console.error('❌ Supabase save error:', res.status, errorText);
    }
    return { saved: res.ok ? payload.length : 0, status: res.status, error: errorText };
  } catch (err) {
    clearTimeout(id);
    debug.save_timeout = true;
    console.error('❌ Save exception:', err.message);
    return { saved: 0, status: 0, error: err.message };
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
    dropped_low_interest: 0,
    save_error: '',
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
      };

      movers.gainers.push(row);
      movers.losers.push(row);
      movers.volume.push(row);
      movers.value.push(row);

      const isPreMarket = sessionInfo.session === 'premarket';
      const minPrice = isPreMarket ? 0.20 : CFG.MIN_PRICE;
      const minVol = isPreMarket ? 1000 : CFG.MIN_VOLUME;
      const minDollarVol = isPreMarket ? 10000 : CFG.MIN_DOLLARVOL;

      if (Math.abs(chg) < 0.1 && vol < 50000) {
        debug.dropped_low_interest++;
        continue;
      }

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

    let spyRet20 = null;
    if (FF.rel_strength && left() > 3000) {
      const spyBars = cleanBars(await fetchAggs("SPY", CFG.AGGS_TIMEOUT));
      spyRet20 = ret20(spyBars);
      debug.spy_rs_ready = spyRet20 != null;
    }

    let learnedWeights = {};
    try {
      const resW = await fetch(
        `${SUPABASE_URL}/rest/v1/radar_weights?id=eq.1&select=weights`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const dataW = await resW.json();
      if (dataW && dataW[0] && dataW[0].weights) {
        learnedWeights = dataW[0].weights;
        debug.weights_used = learnedWeights;
      }
    } catch {}

    // ── Stage 3: تحليل الأسهم ──
    const analyzed = [];
    const timeLimit = left() - 2000;
    for (let i = 0; i < cand.length && Date.now() - T0 < timeLimit; i += CFG.BATCH) {
      if (left() < 1800) { debug.dropped_timeout += cand.length - i; break; }
      const batch = cand.slice(i, i + CFG.BATCH);

      const batchData = await Promise.all(batch.map(async (c) => {
        let bars = await fetchAggs(c.symbol, CFG.AGGS_TIMEOUT);
        if (!bars || !Array.isArray(bars) || bars.length < 30) {
          debug.dropped_no_tech++;
          return null;
        }
        if (FF.data_guard) {
          bars = cleanBars(bars);
          if (!bars || !Array.isArray(bars) || bars.length < 30) {
            debug.dropped_no_tech++;
            return null;
          }
        }
        return { ...c, bars };
      }));

      const validBatch = batchData.filter(c => c !== null);
      debug.dropped_no_tech += batch.length - validBatch.length;

      const analysisResults = await Promise.all(validBatch.map(async (c) => {
        const bars = c.bars;
        const closes = bars.map(b => b.c);
        const vols = bars.map(b => b.v);

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

        const earlyAcc = calculateEarlyAccumulation(bars, c.price);
        const st = buildStructure(c.price, bars, ind, CFG);
        const levels = buildLevels(c.price, st);
        const breakoutProb = calculateBreakoutProbability(c.price, bars, st);

        let predictionScore = 50;
        let predictionGrade = 'WATCH';
        const breakdown = [];

        if (earlyAcc.score > 0) {
          predictionScore += earlyAcc.score * 0.30;
          breakdown.push({ factor: 'Early Accumulation', score: earlyAcc.score });
        }
        if (breakoutProb.probability > 0) {
          predictionScore += breakoutProb.probability * 0.25;
          breakdown.push({ factor: 'Breakout Probability', score: breakoutProb.probability });
        }
        if (st && st.rr) {
          const rrScore = Math.min(st.rr * 20, 100);
          predictionScore += rrScore * 0.20;
          breakdown.push({ factor: 'Structure', score: rrScore });
        }
        if (ind.rvol) {
          const rvolScore = Math.min(ind.rvol * 20, 100);
          predictionScore += rvolScore * 0.15;
          breakdown.push({ factor: 'Liquidity', score: rvolScore });
        }
        if (debug.market_regime === 'قوي') {
          predictionScore += 10;
          breakdown.push({ factor: 'Market Regime', score: 10 });
        }

        predictionScore = Math.min(Math.max(predictionScore, 0), 100);
        if (predictionScore >= 85) predictionGrade = 'ELITE';
        else if (predictionScore >= 75) predictionGrade = 'PRIME';
        else if (predictionScore >= 65) predictionGrade = 'STRONG';
        else if (predictionScore >= 55) predictionGrade = 'GOOD';
        else if (predictionScore >= 45) predictionGrade = 'WATCH';
        else predictionGrade = 'AVOID';

        const timing = { timing: 'UNKNOWN', label: 'غير معروف' };
        if (st && st.resistanceDistance !== undefined) {
          if (st.resistanceDistance <= 3 && st.resistanceDistance > 0 && st.rr >= 2) {
            timing.timing = 'PRE_BREAKOUT';
            timing.label = 'قبل الاختراق - مثالي';
          } else if (st.resistanceDistance <= 0 && st.rr >= 1.5) {
            timing.timing = 'BREAKOUT';
            timing.label = 'اختراق - جيد';
          } else if (earlyAcc.score >= 60 && breakoutProb.probability >= 50) {
            timing.timing = 'EARLY_MOMENTUM';
            timing.label = 'بداية زخم - جيد';
          } else if (earlyAcc.score >= 40 && breakoutProb.probability >= 40) {
            timing.timing = 'WAIT';
            timing.label = 'مراقبة - ينتظر تأكيد';
          } else {
            timing.timing = 'LATE';
            timing.label = 'متأخر - تجنب';
          }
        }

        const isHot = predictionGrade === 'ELITE' || predictionGrade === 'PRIME';
        const isTarget = predictionGrade === 'ELITE';

        const stOut = st ? {
          ...st,
          predictionScore,
          predictionGrade,
          timing,
          earlyAccumulation: earlyAcc,
          breakoutProbability: breakoutProb,
        } : st;

        return {
          ...c,
          bars,
          ind,
          st,
          levels,
          earlyAcc,
          breakoutProb,
          predictionScore,
          predictionGrade,
          timing,
          isHot,
          isTarget,
          stOut,
          breakdown,
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
        (a.dollar_vol >= 50e6 && a.predictionScore >= 60 ? 'استثمار' : 'مضاربة');

      const signalLabel = a.predictionGrade === 'ELITE' ? '💥 انفجاري' :
        a.predictionGrade === 'PRIME' ? '🔥 عالي' : '📊 متوسط';

      signals.push({
        symbol: a.symbol,
        price: a.price,
        change_pct: a.change_pct,
        volume: a.volume,
        dollar_vol: a.dollar_vol,
        score: a.predictionScore,
        predictionScore: a.predictionScore,
        predictionGrade: a.predictionGrade,
        timing: a.timing,
        earlyAccumulation: a.earlyAcc,
        breakoutProbability: a.breakoutProb,
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
    if (saveResult.error) {
      debug.save_error = saveResult.error.slice(0, 500);
    }

    const base = {
      success: true,
      total: signals.length,
      market_regime: debug.market_regime,
      session: sessionInfo.session,
      sessionLabel: sessionInfo.label,
      hot: signals.filter(s => s.is_hot).length,
      target: signals.filter(s => s.is_target).length,
      early: signals.filter(s => s.earlyAccumulation?.score >= 60).length,
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
    console.error('❌ Scan Error:', err.message, err.stack);
    return res.status(200).json({
      success: false,
      error: err.message,
      partial: true,
      elapsed_ms: Date.now() - T0,
      debug,
    });
  }
}
