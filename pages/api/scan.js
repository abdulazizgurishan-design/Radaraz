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

  // Change %
  const ch = s.changePct || 0;
  t += ch>=30 ? W.change*1.2
     : ch>=20 ? W.change
     : ch>=10 ? W.change*.80
     : ch>=5  ? W.change*.55
     : ch>=3  ? W.change*.35 : 0;

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

  const MAX = Object.values(W).reduce((a,b)=>a+b,0);
  return Math.min(Math.round((t / MAX) * 100), 99);
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

// ─── MAIN HANDLER ─────────────────────────────────────────────────
export default async function handler(req, res) {
  const t0 = Date.now();
  const isSubscriber = req.query.sub === "1";  // مسح المشترك لا يحفظ

  try {
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
      if (volume < FILTER.MIN_VOLUME)           continue;

      const prevClose = prev.c || day.o || price;

      // التغيير %: من Polygon → fallback يدوي من السعر الحالي مقابل إغلاق أمس
      let changePct = t.todaysChangePerc;
      if (changePct == null || changePct === 0) {
        changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      }
      if (Math.abs(changePct) < FILTER.MIN_CHANGE) continue;

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
      const type = s.changePct > 0 && s.volume > 5e6 && s.price > 10 ? "قيادي" : "مضاربة";
      return { ...s, ep, levels, is_hot, type,
        signal: ep >= 80 ? "💥 انفجاري" : ep >= 60 ? "🔥 عالي" : "👀 مراقبة" };
    });

    // 4. ترتيب: HOT → EP → RVOL
    scored.sort((a, b) => {
      if (b.is_hot !== a.is_hot) return b.is_hot ? 1 : -1;
      if (b.ep !== a.ep) return b.ep - a.ep;
      return b.rvol - a.rvol;
    });

    // 5. أعلى N نتيجة
    const top = scored.slice(0, FILTER.MAX_RESULTS);

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
      levels:     s.levels,
    });

    const results     = top.map(toCard);
    const leaders     = results.filter(s => s.type === "قيادي");
    const speculation = results.filter(s => s.type !== "قيادي");

    return res.status(200).json({
      success:     true,
      total:       results.length,
      hot:         results.filter(s => s.is_hot).length,
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
