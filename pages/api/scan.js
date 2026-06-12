// pages/api/scan.js — STANDALONE EDITION
// ═══════════════════════════════════════════════════════════════════
//  مسح مستقل تماماً — صفر اعتماد على جداول أخرى
//  ─────────────────────────────────────────────────────────────────
//  الفلسفة: طلب واحد لكامل السوق → فلترة → حساب EP → حفظ
//  لا watchlist_active · لا ticker_meta · لا refresh-meta
//  كل شيء من Polygon snapshot الواحد (يرجع ~12000 سهم في طلب واحد)
//
//  هذا يحل جذرياً:
//   ✅ لا timeout (طلب واحد بدل 1200)
//   ✅ لا اعتماد على جداول قد تفرغ
//   ✅ لا cron chains تنكسر
//   ✅ يشتغل حتى لو كل شي ثاني معطّل
// ═══════════════════════════════════════════════════════════════════

export const config = { maxDuration: 60 };

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// ─── إعدادات الفلترة ───────────────────────────────────────────────
const FILTER = {
  MIN_PRICE:      0.30,
  MAX_PRICE:      500,
  MIN_VOLUME:     300_000,      // حجم يومي حقيقي
  MIN_CHANGE:     3,            // أقل تغيير % للاهتمام
  MAX_RESULTS:    60,           // أقصى إشارات
  SAVE_MIN_EP:    50,           // الحد الأدنى للحفظ في Supabase
  LEADER_MCAP:    2_000_000_000,
};

// ─── جلب snapshot لكامل السوق (طلب واحد!) ─────────────────────────
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
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ─── EP MODEL v2 (نفس المنطق، يعتمد فقط على بيانات snapshot) ───────
function calcEP(s) {
  let t = 0;
  const W = { rvol: 30, change: 25, gap: 15, vwap: 10, range: 10, volume: 10 };

  // RVOL (volume / avg) — أهم إشارة
  const rv = s.rvol || 0;
  t += rv>=50  ? W.rvol*1.15
     : rv>=20  ? W.rvol*1.1
     : rv>=10  ? W.rvol
     : rv>=5   ? W.rvol*.80
     : rv>=3   ? W.rvol*.60
     : rv>=2   ? W.rvol*.40
     : rv>=1.5 ? W.rvol*.20 : 0;

  // Change % — منحنى مخاطرة:
  // المنطقة الذهبية (3-30%) تأخذ نقاط كاملة، فوقها يقل المردود تدريجياً
  // لأن الدخول على سهم صعد كثيراً = مخاطرة شراء القمة
  const ch = s.changePct || 0;
  t += ch>=10 && ch<=30 ? W.change            // 🟢 المنطقة الذهبية — كامل
     : ch>=5  && ch<10   ? W.change*.70        // بداية الزخم
     : ch>=3  && ch<5    ? W.change*.45        // مبكر جداً
     : ch>30  && ch<=50  ? W.change*.85        // ممتد قليلاً
     : ch>50  && ch<=80  ? W.change*.65        // ممتد
     : ch>80  && ch<=120 ? W.change*.45        // ممتد كثيراً ⚠️
     : ch>120            ? W.change*.30 : 0;    // دخول متأخر — مخاطرة عالية

  // Gap
  const g = s.gapPct || 0;
  t += g>=20 ? W.gap*1.2
     : g>=10 ? W.gap
     : g>=5  ? W.gap*.60
     : g>=2  ? W.gap*.30 : 0;

  // VWAP
  if (s.price > s.vwap && s.vwap > 0) t += W.vwap;
  else if (s.vwap > 0 && s.price >= s.vwap * 0.99) t += W.vwap * 0.5;

  // Range position (قرب من القمة اليومية = قوة)
  if (s.high > s.low) {
    const pos = (s.price - s.low) / (s.high - s.low);
    t += pos >= 0.8 ? W.range : pos >= 0.6 ? W.range*.6 : pos >= 0.4 ? W.range*.3 : 0;
  }

  // Volume مطلق
  t += s.volume >= 5e6 ? W.volume
     : s.volume >= 2e6 ? W.volume*.7
     : s.volume >= 1e6 ? W.volume*.5
     : s.volume >= 5e5 ? W.volume*.3 : 0;

  // Velocity bonus
  if (rv >= 10 && ch >= 10) t += 8;
  if (rv >= 50) t += 5;

  let ep = Math.min(Math.round((t / Object.values(W).reduce((a,b)=>a+b,0)) * 100), 99);

  // ⚠️ خصم مخاطرة الامتداد (Overextension Penalty)
  // كل ما ارتفع السهم أكثر فوق المنطقة الذهبية، قلّت نقاطه
  // يحمي المشترك من الدخول المتأخر قرب القمة
  if (ch > 30 && ch <= 50)  ep -= 4;   // ممتد قليلاً
  else if (ch > 50 && ch <= 80)  ep -= 8;   // ممتد
  else if (ch > 80 && ch <= 120) ep -= 12;  // ممتد كثيراً
  else if (ch > 120)             ep -= 16;  // دخول متأخر خطر

  return Math.max(0, Math.min(ep, 99));
}

// ─── حساب الأهداف ووقف الخسارة (ATR-based) ───────────────────────
function calcLevels(s) {
  const price = s.price;
  const tr  = Math.max(s.high - s.low, Math.abs(s.high - s.prevClose), Math.abs(s.low - s.prevClose));
  const atr = Math.max(tr, price * 0.02);

  const t1 = +(price + atr * 0.5).toFixed(2);
  const t2 = +(price + atr * 1.0).toFixed(2);
  const t3 = +(price + atr * 1.8).toFixed(2);
  const sl = +Math.max(price - atr * 0.8, price * 0.90).toFixed(2);

  return {
    t1, t2, t3, sl,
    t1Pct: +(((t1-price)/price)*100).toFixed(2),
    t2Pct: +(((t2-price)/price)*100).toFixed(2),
    t3Pct: +(((t3-price)/price)*100).toFixed(2),
    slPct: +(((sl-price)/price)*100).toFixed(2),
    risk:  +(price - sl).toFixed(2),
  };
}

// ─── حفظ في Supabase ──────────────────────────────────────────────
async function saveSignals(signals) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !signals.length) {
    return { saved: 0, skipped: true };
  }
  const rows = signals.map(s => ({
    symbol:      s.symbol,
    type:        s.type,
    entry_price: s.price,
    change_pct:  s.changePct,
    volume:      Math.round(s.volume),
    rvol:        s.rvol,
    ep:          s.ep,
    score:       s.ep,
    is_hot:      s.is_hot,
    target1:     s.levels.t1,
    target2:     s.levels.t2,
    target3:     s.levels.t3,
    stop_loss:   s.levels.sl,
    status:      "OPEN",
    ma_signal:   s.ma_signal || null,
    rsi:         s.rsi ?? null,
    atr14:       s.levels?.atr14 ?? null,
    early_watch: s.early_watch || false,
    created_at:  new Date().toISOString(),
  }));

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/signals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
    return { saved: res.ok ? rows.length : 0, status: res.status };
  } catch (err) {
    return { saved: 0, error: err.message };
  }
}

// ─── حساب EMA من مصفوفة أسعار ─────────────────────────────────────
function calcEMA(prices, period) {
  if (!prices || prices.length < period) return null;
  const k = 2 / (period + 1);
  // ابدأ بـ SMA لأول period
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// ─── حساب SMA البسيط ──────────────────────────────────────────────
function calcSMA(prices, period) {
  if (!prices || prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ─── ATR14 بتمهيد Wilder (المعيار العالمي — مطابق TradingView) ──────
// الشموع القديمة تؤثر بوزن نسبي متناقص، أدق من المتوسط البسيط
function calcATR14(bars) {
  if (!bars || bars.length < 15) return null;
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].h, l = bars[i].l, pc = bars[i-1].c;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length < 14) return null;
  // أول ATR = متوسط بسيط لأول 14 شمعة
  let atr = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
  // تمهيد Wilder على باقي الشموع: ATR = (ATR_prev × 13 + TR) / 14
  for (let i = 14; i < trs.length; i++) {
    atr = (atr * 13 + trs[i]) / 14;
  }
  return atr;
}

// ─── RSI14 بتمهيد Wilder (مؤشر القوة النسبية) ───────────────────
// >75 = إشباع شرائي (خطر) · 55-65 = زخم فتي صحي (مثالي)
function calcRSI14(bars) {
  if (!bars || bars.length < 15) return null;
  const closes = bars.map(b => b.c);
  let gains = 0, losses = 0;
  // أول 14 تغيير
  for (let i = 1; i <= 14; i++) {
    const diff = closes[i] - closes[i-1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / 14, avgLoss = losses / 14;
  // تمهيد Wilder على الباقي
  for (let i = 15; i < closes.length; i++) {
    const diff = closes[i] - closes[i-1];
    const g = diff >= 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * 13 + g) / 14;
    avgLoss = (avgLoss * 13 + l) / 14;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ─── دعم/مقاومة من القمم والقيعان (آخر 20 شمعة) ──────────────────
function calcSupportResistance(bars, price) {
  if (!bars || bars.length < 10) return { resistances: [], supports: [] };
  const recent = bars.slice(-20);
  const highs = recent.map(b => b.h);
  const lows  = recent.map(b => b.l);

  // المقاومات: قمم أعلى من السعر الحالي (مرتبة تصاعدياً)
  const resistances = [...new Set(highs)]
    .filter(h => h > price)
    .sort((a, b) => a - b);

  // الدعوم: قيعان أقل من السعر الحالي (مرتبة تنازلياً = الأقرب أولاً)
  const supports = [...new Set(lows)]
    .filter(l => l < price)
    .sort((a, b) => b - a);

  return { resistances, supports };
}

// ─── مستويات فيبوناتشي (امتداد من القاع للقمة) ───────────────────
function calcFibTargets(bars, price) {
  if (!bars || bars.length < 10) return [];
  const recent = bars.slice(-20);
  const swingLow  = Math.min(...recent.map(b => b.l));
  const swingHigh = Math.max(...recent.map(b => b.h));
  const range = swingHigh - swingLow;
  if (range <= 0) return [];

  // امتدادات فيبوناتشي الصاعدة من القمة
  return [
    swingHigh + range * 0.272,  // 127.2%
    swingHigh + range * 0.618,  // 161.8%
    swingHigh + range * 1.0,    // 200%
  ].filter(f => f > price);
}

// ─── حساب أهداف ووقف ذكي (ATR + دعم/مقاومة + فيبوناتشي) ──────────
function calcSmartLevels(price, bars) {
  const atr = calcATR14(bars) || price * 0.05;
  const { resistances, supports } = calcSupportResistance(bars, price);
  const fibs = calcFibTargets(bars, price);

  // الأهداف: ندمج ATR + مقاومات + فيبوناتشي، ونختار الأقرب المنطقي لكل مستوى
  const atrT1 = price + atr * 1.0;
  const atrT2 = price + atr * 2.0;
  const atrT3 = price + atr * 3.0;

  // T1 = الأقرب من (ATR×1 أو أول مقاومة) — هدف واقعي قريب
  // بحد أدنى +3% حتى لا يكون قريباً جداً
  let t1 = resistances[0] && resistances[0] < atrT1 * 1.3
    ? Math.min(resistances[0], atrT1 * 1.3)
    : atrT1;
  t1 = Math.max(t1, price * 1.03);

  // T2 = ATR×2 أو ثاني مقاومة (لا يقل عن T1 + هامش)
  let t2 = resistances[1] && resistances[1] > t1
    ? Math.max(atrT2, Math.min(resistances[1], atrT2 * 1.2))
    : atrT2;
  t2 = Math.max(t2, t1 * 1.04);

  // T3 = الأبعد من (ATR×3 أو فيبوناتشي 161%) — هدف الانفجار
  let t3 = fibs[1] && fibs[1] > t2 ? Math.max(atrT3, Math.min(fibs[1], atrT3 * 1.3)) : atrT3;
  t3 = Math.max(t3, t2 * 1.05);

  // SL = الأذكى من (تحت أقرب دعم بهامش) أو (ATR×1.5)، بحد أقصى -12%
  const atrSL = price - atr * 1.5;
  const supportSL = supports[0] ? supports[0] * 0.985 : atrSL;  // 1.5% تحت الدعم
  const sl = Math.max(
    Math.min(atrSL, supportSL),   // الأبعد حماية بين الاثنين
    price * 0.88                   // لكن لا يتجاوز -12%
  );

  const f2 = n => +n.toFixed(2);
  const pct = n => +(((n - price) / price) * 100).toFixed(2);

  return {
    t1: f2(t1), t2: f2(t2), t3: f2(t3), sl: f2(sl),
    t1Pct: pct(t1), t2Pct: pct(t2), t3Pct: pct(t3), slPct: pct(sl),
    risk: f2(price - sl),
    atr14: f2(atr),
  };
}

// ─── جلب شموع يومية + حساب تقاطع المتوسطات (MA9 × MA21 + EMA) ─────
// يرجع كائن { maBonus, maSignal, bars } — يرفع EP فقط، لا يستبعد
async function fetchMACrossover(symbol) {
  try {
    // آخر 30 يوم تداول (يكفي لـ MA21 + EMA + ATR14)
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 50 * 86400000).toISOString().slice(0, 10);
    const url  = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50&apiKey=${POLYGON_KEY}`;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);

    if (!res.ok) return { maBonus: 0, maSignal: null, bars: null };
    const data = await res.json();
    const bars = data.results || [];
    if (bars.length < 21) return { maBonus: 0, maSignal: null, bars: bars.length ? bars : null };

    const closes = bars.map(b => b.c);

    const sma9   = calcSMA(closes, 9);
    const sma21  = calcSMA(closes, 21);
    const ema9   = calcEMA(closes, 9);
    const ema21  = calcEMA(closes, 21);
    const price  = closes[closes.length - 1];

    let maBonus = 0;
    let maSignal = null;

    // تقاطع SMA صاعد (MA9 فوق MA21)
    if (sma9 && sma21 && sma9 > sma21) {
      maBonus += 6;
      maSignal = "صاعد";
    }
    // تأكيد EMA (أسرع استجابة)
    if (ema9 && ema21 && ema9 > ema21) {
      maBonus += 5;
      maSignal = maSignal === "صاعد" ? "صاعد قوي ⚡" : "EMA صاعد";
    }
    // السعر فوق MA21 = اتجاه سليم
    if (sma21 && price > sma21) {
      maBonus += 3;
    }
    // golden cross حديث (SMA9 عبر SMA21 خلال آخر 3 شموع)
    const sma9_prev  = calcSMA(closes.slice(0, -3), 9);
    const sma21_prev = calcSMA(closes.slice(0, -3), 21);
    if (sma9_prev && sma21_prev && sma9_prev <= sma21_prev && sma9 > sma21) {
      maBonus += 6; // تقاطع ذهبي طازج = إشارة قوية
      maSignal = "تقاطع ذهبي 🌟";
    }

    // 🔍 حساب الهدوء الأسبوعي — أعلى ارتفاع يومي خلال آخر 7 شموع
    // إذا السهم كان هادئاً (لم يقفز بحدة)، فهو مرشح للرصد المبكر
    let weekMaxJump = 0;
    const last7 = bars.slice(-8); // 7 أيام + اليوم المرجعي
    for (let i = 1; i < last7.length - 1; i++) {  // نستثني شمعة اليوم نفسها
      const jump = ((last7[i].c - last7[i-1].c) / last7[i-1].c) * 100;
      if (jump > weekMaxJump) weekMaxJump = jump;
    }

    return { maBonus: Math.min(maBonus, 20), maSignal, bars, weekMaxJump: +weekMaxJump.toFixed(1), rsi: calcRSI14(bars) };
  } catch {
    return { maBonus: 0, maSignal: null, bars: null, weekMaxJump: 0, rsi: null };
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────
export default async function handler(req, res) {
  const t0 = Date.now();
  const isSubscriber = req.query.sub === "1";  // مسح المشترك لا يحفظ

  try {
    // ⚡ فوليوم ديناميكي حسب توقيت السوق (Pre-Market vs الجلسة الرسمية)
    //   قبل الافتتاح: حجم أقل (50K) لاصطياد الفرص المبكرة جداً
    //   أثناء الجلسة: حجم أعلى (300K) لضمان سيولة حقيقية
    const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const etH = etNow.getHours(), etM = etNow.getMinutes();
    const isPreMarket = (etH >= 4 && (etH < 9 || (etH === 9 && etM < 30)));
    const minVolume = isPreMarket ? 50_000 : FILTER.MIN_VOLUME;

    // 1. جلب كامل السوق (طلب واحد!)
    const allTickers = await fetchFullMarket();
    const t1 = Date.now();

    // 2. تحويل + فلترة
    const candidates = [];
    for (const t of allTickers) {
      const day  = t.day || {};
      const prev = t.prevDay || {};
      const min  = t.min || {};
      // السعر الحالي: آخر صفقة → آخر دقيقة → إغلاق اليوم → إغلاق أمس
      const price  = t.lastTrade?.p || min.c || day.c || prev.c || 0;
      // الحجم: حجم اليوم → حجم آخر دقيقة المتراكم
      const volume = day.v || min.av || 0;

      // فلترة أساسية
      if (!t.ticker || t.ticker.includes(".")) continue;
      if (!/^[A-Z]{1,6}$/.test(t.ticker))       continue;
      if (price < FILTER.MIN_PRICE || price > FILTER.MAX_PRICE) continue;
      if (volume < minVolume)                   continue;

      const prevClose = prev.c || day.o || price;

      // التغيير %: من Polygon → fallback يدوي من السعر الحالي مقابل إغلاق أمس
      let changePct = t.todaysChangePerc;
      if (changePct == null || changePct === 0) {
        changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      }
      // ⚠️ زخم صاعد فقط — استبعاد الأسهم الهابطة (لا ارتداد)
      if (changePct < FILTER.MIN_CHANGE) continue;

      const gapPct = (day.o && prevClose) ? ((day.o - prevClose) / prevClose) * 100 : 0;
      const rvol = (prev.v && prev.v > 0) ? +(volume / prev.v).toFixed(1) : 0;

      candidates.push({
        symbol:    t.ticker,
        price:     +price.toFixed(2),
        open:      day.o || price,
        volume,
        vwap:      day.vw || min.vw || 0,
        high:      day.h || min.h || price,
        low:       day.l || min.l || price,
        prevClose,
        changePct: +changePct.toFixed(2),
        gapPct:    +gapPct.toFixed(2),
        rvol,
      });
    }

    // 3. حساب EP لكل مرشّح
    const scored = candidates.map(s => {
      const ep = calcEP(s);
      const levels = calcLevels(s);
      const is_hot = ep >= 75 && s.rvol >= 10 && s.changePct >= 10;

      // 🏆 تصنيف القيادي الاحترافي:
      // القيادي الحقيقي = سعر مؤسسي + سيولة دولارية ضخمة + حركة غير جنونية
      // (نتجنّب تصنيف السهم البيني الرخيص المنفجر كـ"قيادي" خطأً)
      const dollarVolume = s.price * s.volume;       // السيولة الدولارية الفعلية
      const isLeader =
        s.price >= 20 &&                              // سعر مؤسسي (مو بيني)
        dollarVolume >= 100_000_000 &&                // سيولة دولارية ≥ 100M
        s.changePct <= 40;                            // حركة منطقية (مو مضاربة جنونية)
      const type = isLeader ? "قيادي" : "مضاربة";

      return { ...s, ep, levels, is_hot, type, dollarVolume,
        signal: ep >= 80 ? "💥 انفجاري" : ep >= 60 ? "🔥 عالي" : "👀 مراقبة" };
    });

    // 4. ترتيب: HOT → EP → RVOL
    scored.sort((a, b) => {
      if (b.is_hot !== a.is_hot) return b.is_hot ? 1 : -1;
      if (b.ep !== a.ep) return b.ep - a.ep;
      return b.rvol - a.rvol;
    });

    // 5. أعلى N نتيجة (مبدئياً قبل MA)
    const top = scored.slice(0, FILTER.MAX_RESULTS);

    // 5.5 ⚡ تطبيق تقاطع المتوسطات (MA9 × MA21 + EMA) على المرشّحين فقط
    //     يرفع EP فقط — لا يستبعد أي سهم
    await Promise.all(top.map(async (s) => {
      const { maBonus, maSignal, bars, weekMaxJump, rsi } = await fetchMACrossover(s.symbol);
      if (maBonus > 0) {
        s.ep = Math.min(s.ep + maBonus, 99);  // يرفع EP بحد أقصى 99
        s.ma_signal = maSignal;
        s.ma_bonus = maBonus;
      } else {
        s.ma_signal = null;
        s.ma_bonus = 0;
      }

      // 📊 RSI14 — تعديل EP حسب القوة النسبية:
      //   >78 إشباع شرائي خطر (خصم) · 80+ خطر شديد
      //   50-65 زخم فتي صحي (مكافأة) · يحمي من شراء القمم
      s.rsi = rsi != null ? Math.round(rsi) : null;
      if (rsi != null) {
        if      (rsi >= 80) s.ep = Math.max(0, s.ep - 8);   // إشباع شديد
        else if (rsi >= 72) s.ep = Math.max(0, s.ep - 4);   // إشباع
        else if (rsi >= 50 && rsi <= 65) s.ep = Math.min(99, s.ep + 3); // زخم فتي صحي
      }

      // أعد تقييم HOT و signal بعد كل التعديلات
      s.is_hot = s.ep >= 75 && s.rvol >= 10 && s.changePct >= 10;
      s.signal = s.ep >= 80 ? "💥 انفجاري" : s.ep >= 60 ? "🔥 عالي" : "👀 مراقبة";

      // 🎯 أهداف ووقف ذكي (ATR14 + دعم/مقاومة + فيبوناتشي)
      // يعيد استخدام نفس بيانات الشموع — صفر تكلفة إضافية
      if (bars && bars.length >= 15) {
        s.levels = calcSmartLevels(s.price, bars);
        s.levels_source = "smart";
      } else {
        s.levels_source = "atr_basic";  // fallback للأهداف التقريبية
      }

      // 🔍 رصد مبكر — السهم الجاهز قبل الانفجار:
      //   • ارتفاع يومي 3-10% (بداية مبكرة)
      //   • EP ≥ 75 (جودة عالية)
      //   • تأكيد فني صارم (تقاطع ذهبي أو EMA صاعد)
      //   • هادئ أسبوعياً (لم يقفز >15% بأي يوم خلال الأسبوع)
      const strongMA = s.ma_signal === "تقاطع ذهبي 🌟"
                    || s.ma_signal === "صاعد قوي ⚡"
                    || s.ma_signal === "EMA صاعد";
      s.early_watch = (
        s.changePct >= 3 && s.changePct <= 10 &&
        s.ep >= 75 &&
        strongMA &&
        (weekMaxJump != null && weekMaxJump <= 15)
      );
      s.week_max_jump = weekMaxJump ?? null;
    }));

    // أعد الترتيب بعد رفع EP بالمتوسطات
    top.sort((a, b) => {
      if (b.is_hot !== a.is_hot) return b.is_hot ? 1 : -1;
      if (b.ep !== a.ep) return b.ep - a.ep;
      return b.rvol - a.rvol;
    });

    // 6. حفظ (فقط للمسح غير المشترك، وفقط EP >= حد)
    let saveResult = { skipped: true, reason: "subscriber scan" };
    if (!isSubscriber) {
      const toSave = top.filter(s => s.ep >= FILTER.SAVE_MIN_EP);
      saveResult = await saveSignals(toSave);
    }

    // 7. تجهيز الرد بصيغة الواجهة
    const toCard = s => ({
      symbol:     s.symbol,
      price:      s.price,
      change_pct: s.changePct,
      score:      s.ep,
      signal:     s.signal,
      type:       s.type,
      volume:     s.volume,
      rvol:       s.rvol,
      is_hot:     s.is_hot,
      vwap:       s.vwap,
      ma_signal:  s.ma_signal || null,
      ma_bonus:   s.ma_bonus || 0,
      rsi:        s.rsi ?? null,
      early_watch: s.early_watch || false,
      week_max_jump: s.week_max_jump ?? null,
      levels:     s.levels,
      atr14:      s.levels?.atr14 || null,
      levels_source: s.levels_source || "atr_basic",
    });

    const results     = top.map(toCard);
    const leaders     = results.filter(s => s.type === "قيادي");
    const speculation = results.filter(s => s.type !== "قيادي");
    const early       = results.filter(s => s.early_watch);  // 🔍 رصد مبكر

    return res.status(200).json({
      success:     true,
      total:       results.length,
      hot:         results.filter(s => s.is_hot).length,
      early:       early.length,
      saved:       saveResult.saved || 0,
      saveResult,
      timing: {
        market_fetch: t1 - t0,
        total_ms:     Date.now() - t0,
      },
      market_scanned: allTickers.length,
      after_filter:   candidates.length,
      results,
      leaders,
      speculation,
      earlyWatch:  early,
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      error:   error.message,
      results: [],
      leaders: [],
      speculation: [],
    });
  }
}
