// pages/api/trade.js — v11 (FINAL OPTIMIZED)
// ════════════════════════════════════════════════════════════════════════
//  ✅ خفض minRR من 1.3 → 1.0 (يسمح بدخول صفقات بمخاطرة مقبولة)
//  ✅ خفض maxLossPct من 7% → 5% (يقلل المخاطرة ويحسّن R:R)
//  ✅ خفض فلتر الأخبار من <1 ساعة → <0.5 ساعة (يسمح بدخول أسرع)
//  ✅ إضافة فلتر "سعر مرتفع" — ينتظر تصحيح
//  ✅ تحسين الـ Debug لعرض أسباب الرفض
// ════════════════════════════════════════════════════════════════════════

const ALPACA_KEY    = process.env.ALPACA_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET;
const ALPACA_BASE   = "https://paper-api.alpaca.markets";
const ALPACA_DATA   = "https://data.alpaca.markets";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

const STRATEGY = {
  engine: "smart",
  addEnabled: true,

  minScore: 68,
  minPrice: 3,
  minChangePct: 1,
  maxChangePct: 40,
  minVolume: 100_000,
  
  maxRSI: 70,
  skipChasers: true,
  
  // 🔴 تم خفض minRR من 1.3 → 1.0
  minRR: 1.0,
  entryBuffer: 1.01,
  minRoomPct: 0.015,

  // 🔴 تم خفض maxLossPct من 7% → 5%
  maxLossPct: 0.05,
  maxDriftPct: 0.03,
  riskPerTradePct: 0.015,
  maxPositionPct: 0.22,
  minPositionPct: 0.04,
  maxDeployedPct: 0.85,

  initialFraction: 0.60,
  tp1Fraction: 1.0,
  tp1FillNudge: 0.998,
  breakevenAfterTp1: true,

  tieredExit: true,
  scalpT1Sell: 0.50,
  investT1Sell: 0.33,

  trailEnabled: true,
  trailTiers: [
    { gain: 0.03, lock: 0.00 },
    { gain: 0.06, lock: 0.03 },
    { gain: 0.10, lock: 0.06 },
    { gain: 0.15, lock: 0.10 },
    { gain: 0.22, lock: 0.15 },
  ],
  maxTrades: 6,
};

const H    = { "APCA-API-KEY-ID": ALPACA_KEY, "APCA-API-SECRET-KEY": ALPACA_SECRET, "Content-Type": "application/json" };
const SB_H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

// ───────── Alpaca ─────────
async function getAccount()        { const r = await fetch(`${ALPACA_BASE}/v2/account`, { headers: H }); return r.json(); }
async function getAllPositions()   { try { const r = await fetch(`${ALPACA_BASE}/v2/positions`, { headers: H }); const d = await r.json(); return Array.isArray(d) ? d : []; } catch { return []; } }
async function getPositionQty(sym) { try { const r = await fetch(`${ALPACA_BASE}/v2/positions/${sym}`, { headers: H }); if (!r.ok) return 0; const d = await r.json(); return Math.abs(parseInt(d.qty)) || 0; } catch { return 0; } }
async function getLatestPrice(sym) { try { const r = await fetch(`${ALPACA_DATA}/v2/stocks/${sym}/trades/latest`, { headers: H }); if (!r.ok) return null; const d = await r.json(); return d?.trade?.p ?? null; } catch { return null; } }
async function getOpenOrders(sym)  { try { const r = await fetch(`${ALPACA_BASE}/v2/orders?status=open&symbols=${sym}&nested=true`, { headers: H }); const d = await r.json(); return Array.isArray(d) ? d : []; } catch { return []; } }
async function cancelOrder(id)     { try { await fetch(`${ALPACA_BASE}/v2/orders/${id}`, { method: "DELETE", headers: H }); } catch {} }
async function cancelAll(sym)      { const oo = await getOpenOrders(sym); for (const o of oo) await cancelOrder(o.id); }
async function buyMarket(sym, qty) { const r = await fetch(`${ALPACA_BASE}/v2/orders`, { method: "POST", headers: H, body: JSON.stringify({ symbol: sym, qty: String(qty), side: "buy", type: "market", time_in_force: "day" }) }); return r.json(); }

async function buyBracket(sym, qty, tp, sl) {
  const dec = (Number(tp) < 1 || Number(sl) < 1) ? 4 : 2;
  const r = await fetch(`${ALPACA_BASE}/v2/orders`, {
    method: "POST", headers: H,
    body: JSON.stringify({
      symbol: sym, qty: String(qty), side: "buy", type: "market", time_in_force: "day",
      order_class: "bracket",
      take_profit: { limit_price: Number(tp).toFixed(dec) },
      stop_loss:   { stop_price:  Number(sl).toFixed(dec) },
    }),
  });
  return r.json();
}

async function stopSell(sym, qty, sl) {
  try {
    const r = await fetch(`${ALPACA_BASE}/v2/orders`, {
      method: "POST", headers: H,
      body: JSON.stringify({ symbol: sym, qty: String(qty), side: "sell", type: "stop",
        stop_price: Number(sl).toFixed(Number(sl) < 1 ? 4 : 2), time_in_force: "day" }),
    });
    return r.json();
  } catch { return null; }
}

async function ocoSell(sym, qty, tp, sl) {
  const r = await fetch(`${ALPACA_BASE}/v2/orders`, {
    method: "POST", headers: H,
    body: JSON.stringify({
      symbol: sym, qty: String(qty), side: "sell", type: "limit", time_in_force: "day",
      order_class: "oco",
      take_profit: { limit_price: tp.toFixed(2) },
      stop_loss:   { stop_price: sl.toFixed(2) },
    }),
  });
  return r.json();
}

async function placeExits(sym, qty, p) {
  const raw = Number(p.t1) * STRATEGY.tp1FillNudge;
  const t1px = +raw.toFixed(Number(p.t1) < 1 ? 4 : 2);
  const resp = await ocoSell(sym, qty, t1px, Number(p.stop));
  if (resp && (resp.code || resp.status === "rejected")) {
    await stopSell(sym, qty, Number(p.stop));
    return { ok: false, fallback: true };
  }
  return { ok: true };
}

// ───────── Supabase ─────────
async function planList() { try { const r = await fetch(`${SUPABASE_URL}/rest/v1/bot_positions?status=eq.active&select=*`, { headers: SB_H }); const d = await r.json(); return Array.isArray(d) ? d : []; } catch { return []; } }
async function planSave(p) {
  p.updated_at = new Date().toISOString();
  await fetch(`${SUPABASE_URL}/rest/v1/bot_positions?on_conflict=symbol`, {
    method: "POST", headers: { ...SB_H, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(p),
  });
}
async function planClose(sym) {
  await fetch(`${SUPABASE_URL}/rest/v1/bot_positions?symbol=eq.${sym}`, {
    method: "PATCH", headers: SB_H, body: JSON.stringify({ status: "closed", updated_at: new Date().toISOString() }),
  });
}

function suitableEntry(st, price, t1, stopPx, minRR, buffer, minRoom) {
  if (!st || !price || !t1 || !stopPx) return false;
  const risk = price - stopPx;
  if (risk <= 0) return false;
  const rr = (t1 - price) / risk;
  return price > st.support &&
         price <= st.confirm * buffer &&
         t1 >= price * (1 + minRoom) &&
         rr >= minRR;
}

export default async function handler(req, res) {
  try {
    const log = { managed: [], entered: [], skipped: [], warnings: [] };
    const debug = { phase: "manage_only" };
    const now = new Date();
    const et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const mins = et.getHours() * 60 + et.getMinutes(), day = et.getDay();
    const weekend = day === 0 || day === 6;
    const canManage = !weekend && mins >= 575 && mins <= 958;
    const canEnter  = !weekend && mins >= 590 && mins < 900;

    if (!canManage)
      return res.status(200).json({ success: true, message: "خارج ساعات الإدارة", ...log });

    // ═══ المرحلة 1: إدارة المراكز المفتوحة ═══
    if (STRATEGY.engine === "smart") {
      const plans = await planList();
      for (const p of plans) {
        const sym = p.symbol;
        const held = await getPositionQty(sym);
        const live = await getLatestPrice(sym);

        if (held === 0) {
          await cancelAll(sym);
          await planClose(sym);
          log.managed.push({ symbol: sym, action: "أُغلق المركز" });
          continue;
        }

        if (p.add_enabled && !p.added && !p.tp1_done && live &&
            live <= Number(p.add_level) && live > Number(p.stop) && p.add_qty > 0) {
          const acct = await getAccount();
          if (parseFloat(acct.cash || 0) >= p.add_qty * live) {
            await buyMarket(sym, p.add_qty);
            const newTotal = held + p.add_qty;
            p.avg_entry = (Number(p.avg_entry) * held + live * p.add_qty) / newTotal;
            p.total_qty = newTotal; p.added = true;
            await cancelAll(sym);
            await placeExits(sym, newTotal, p);
            await planSave(p);
            log.managed.push({ symbol: sym, action: "إضافة متدرّجة", addQty: p.add_qty, newAvg: +Number(p.avg_entry).toFixed(2) });
            continue;
          }
        }

        if (STRATEGY.tieredExit && !p.tp1_done && live && Number(p.t1) > 0 &&
            live >= Number(p.t1) * STRATEGY.tp1FillNudge && held >= 2) {
          const sellFrac = Number(p.t1_sell_frac) || STRATEGY.scalpT1Sell;
          const sellQty = Math.max(1, Math.floor(held * sellFrac));
          const keepQty = held - sellQty;
          await cancelAll(sym);
          const sellResp = await fetch(`${ALPACA_BASE}/v2/orders`, {
            method: "POST", headers: H,
            body: JSON.stringify({ symbol: sym, qty: String(sellQty), side: "sell", type: "market", time_in_force: "day" }),
          }).then(r => r.json()).catch(() => null);
          p.tp1_done = true;
          p.stop = +Number(p.avg_entry).toFixed(Number(p.avg_entry) < 1 ? 4 : 2);
          if (keepQty >= 1) {
            const t3px = +(Number(p.t3) || live * 1.5).toFixed(Number(live) < 1 ? 4 : 2);
            let ok = await ocoSell(sym, keepQty, t3px, p.stop);
            if (!ok || ok.code) { await stopSell(sym, keepQty, p.stop); }
          }
          await planSave(p);
          log.managed.push({ symbol: sym, action: `جني ${Math.round(sellFrac*100)}% عند T1 + الباقي بوقف تعادل`, sold: sellQty, kept: keepQty, type: p.stock_type });
          continue;
        }

        const tp1q = Math.floor(Number(p.total_qty) * STRATEGY.tp1Fraction);
        const remain = Number(p.total_qty) - tp1q;
        if (!p.tp1_done && held <= remain && held < Number(p.total_qty) && live && live > Number(p.avg_entry)) {
          p.tp1_done = true; p.be_moved = STRATEGY.breakevenAfterTp1;
          await cancelAll(sym);
          await placeExits(sym, held, p);
          await planSave(p);
          log.managed.push({ symbol: sym, action: "جني T1 + وقف تعادل", remaining: held, stop: STRATEGY.breakevenAfterTp1 ? +Number(p.avg_entry).toFixed(2) : Number(p.stop) });
          continue;
        }

        if (STRATEGY.trailEnabled && live && Number(p.avg_entry) > 0) {
          const gain = (live - Number(p.avg_entry)) / Number(p.avg_entry);
          let newLock = null;
          for (const tier of STRATEGY.trailTiers) {
            if (gain >= tier.gain) newLock = tier.lock;
          }
          if (newLock != null) {
            const newStop = +(Number(p.avg_entry) * (1 + newLock)).toFixed(Number(p.avg_entry) < 1 ? 4 : 2);
            const curStop = Number(p.stop) || 0;
            if (newStop > curStop && newStop < live) {
              await cancelAll(sym);
              const t3px = +(Number(p.t3) || live * 1.5).toFixed(Number(live) < 1 ? 4 : 2);
              let ok = await ocoSell(sym, held, t3px, newStop);
              if (!ok || ok.code) { await stopSell(sym, held, newStop); }
              p.stop = newStop; p.trail_lock = newLock;
              await planSave(p);
              log.managed.push({ symbol: sym, action: "🔼 رفع الوقف (trailing)", gainPct: +(gain*100).toFixed(1), newStop, protects: `+${(newLock*100).toFixed(0)}%` });
              continue;
            }
          }
        }

        const oo = await getOpenOrders(sym);
        if (oo.length === 0) {
          await placeExits(sym, held, p);
          log.managed.push({ symbol: sym, action: "إصلاح أوامر الحماية", held });
          continue;
        }
        log.managed.push({ symbol: sym, action: "تتبّع", held, live });
      }
    }

    // ═══ المرحلة 2: دخول صفقات جديدة ═══
    if (canEnter) {
      const todayET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
        .toISOString().split("T")[0];
      let candidates = [];
      try {
        const sr = await fetch(`${SUPABASE_URL}/rest/v1/signals?select=*&signal_date=eq.${todayET}&order=score.desc&limit=100`, { headers: SB_H });
        if (sr.ok) {
          const rows = await sr.json();
          candidates = (Array.isArray(rows) ? rows : []).map(r => ({ ...r, price: r.entry_price }));
        }
      } catch { /* تجاهل */ }

      const filtered = candidates.filter(s => {
        if (s.score < STRATEGY.minScore) return false;
        if (s.price < STRATEGY.minPrice) return false;
        if (s.change_pct < STRATEGY.minChangePct || s.change_pct > STRATEGY.maxChangePct) return false;
        if (s.volume < STRATEGY.minVolume) return false;
        if (s.rsi != null && s.rsi > STRATEGY.maxRSI) return false;
        if (s.vwap && s.price <= s.vwap) return false;
        if (!s.structure || s.structure.stop == null || s.structure.t1 == null) return false;
        const f = s.structure.flag || "";
        if (STRATEGY.skipChasers && (f.indexOf("ملاحقة") >= 0 || f.indexOf("غير مؤكد") >= 0 || f.indexOf("هابط") >= 0)) return false;
        return true;
      });

      const validEntry = x => x.structure && (x.structure.flag || "").indexOf("صحيح") >= 0;
      filtered.sort((a, b) => {
        if (!!b.is_target   !== !!a.is_target)   return b.is_target   ? 1 : -1;
        if (validEntry(b)   !== validEntry(a))   return validEntry(b) ? 1 : -1;
        if (!!b.early_watch !== !!a.early_watch) return b.early_watch ? 1 : -1;
        return (b.score || 0) - (a.score || 0);
      });

      const acct = await getAccount();
      const balance = parseFloat(acct.equity || acct.cash || 0);
      const positions = await getAllPositions();
      const activePlans = await planList();
      const openSymbols = new Set([...positions.map(p => p.symbol), ...activePlans.map(p => p.symbol)]);
      let openCount = openSymbols.size;
      let deployed = positions.reduce((s, p) => s + Math.abs(parseFloat(p.market_value || 0)), 0);
      const maxDeployed = balance * STRATEGY.maxDeployedPct;

      for (const s of filtered) {
        if (openCount >= STRATEGY.maxTrades) break;
        if (openSymbols.has(s.symbol)) continue;
        const st = s.structure;
        const live = await getLatestPrice(s.symbol);
        const px = live || s.price;
        if (!px) { log.skipped.push({ symbol: s.symbol, reason: "لا يوجد سعر" }); continue; }

        const radarPx = Number(s.price) || px;
        const driftPct = ((px - radarPx) / radarPx) * 100;
        if (driftPct > STRATEGY.maxDriftPct * 100) {
          log.skipped.push({ symbol: s.symbol, reason: `سعر متأخر ${driftPct.toFixed(1)}% (رادار ${radarPx} → حي ${px.toFixed(2)})` });
          continue;
        }

        // 🆕 فلتر الأخبار الجديدة (<0.5 ساعة) — خفّف من 1 ساعة
        if (s.news_age_h != null && s.news_age_h < 0.5) {
          log.skipped.push({ symbol: s.symbol, reason: `خبر جديد (${s.news_age_h.toFixed(1)} ساعة) — ننتظر` });
          continue;
        }

        // فلتر الخبر السلبي
        if (s.news_sentiment === "negative") {
          log.skipped.push({ symbol: s.symbol, reason: "خبر سلبي — تم الرفض" });
          continue;
        }

        // 🆕 فلتر "سعر مرتفع" — ينتظر تصحيح
        const entryPrice = st.entry || radarPx;
        if (px > entryPrice * 1.05) {
          log.skipped.push({ symbol: s.symbol, reason: `سعر مرتفع (${((px/entryPrice-1)*100).toFixed(1)}% فوق الدخول) — ننتظر تصحيح` });
          continue;
        }

        // إعادة حساب المستويات
        const priceShift = px - radarPx;
        const support  = Number(st.support != null ? st.support : radarPx * 0.97);
        const confirm  = Number(st.confirm != null ? st.confirm : radarPx);
        const t1     = Number(s.target1   != null ? s.target1   : st.t1) + priceShift;
        const t3     = Number(s.target3   != null ? s.target3   : st.t3) + priceShift;
        let   stopPx = support > 0 && support < px ? support * 0.995
                     : Number(s.stop_loss != null ? s.stop_loss : st.stop);

        if (stopPx > 0 && px <= stopPx) {
          log.skipped.push({ symbol: s.symbol, reason: `ضرب الوقف (${stopPx.toFixed(2)}) قبل الدخول` });
          continue;
        }

        // 🔴 maxLossPct 5% (من 7%)
        const capFloor = px * (1 - STRATEGY.maxLossPct);
        if (stopPx < capFloor) {
          const oldStop = stopPx;
          stopPx = capFloor;
          log.warnings.push({ symbol: s.symbol, message: `وقف مصحح: ${oldStop.toFixed(2)} → ${stopPx.toFixed(2)} (حد 5%)` });
        }

        const rrLive = (px - stopPx) > 0 ? (t1 - px) / (px - stopPx) : 0;
        // 🔴 minRR 1.0 (من 1.3)
        if (rrLive < STRATEGY.minRR) {
          log.skipped.push({ symbol: s.symbol, reason: `R:R ${rrLive.toFixed(1)} بعد إعادة الحساب`, px: +px.toFixed(2) });
          continue;
        }

        const stLive = { ...st, support, confirm, t1, stop: stopPx, t3, rr: +rrLive.toFixed(2), entry: px };

        if (!suitableEntry(stLive, px, t1, stopPx, STRATEGY.minRR, STRATEGY.entryBuffer, STRATEGY.minRoomPct)) {
          log.skipped.push({ symbol: s.symbol, reason: "خارج منطقة الدخول / R:R ضعيف", px: +px.toFixed(2), confirm: +confirm.toFixed(2) });
          continue;
        }

        const riskPerShare = px - stopPx;
        if (riskPerShare <= 0) { log.skipped.push({ symbol: s.symbol, reason: "وقف غير صالح" }); continue; }

        let fullValue = (balance * STRATEGY.riskPerTradePct) * px / riskPerShare;
        fullValue = Math.min(fullValue, balance * STRATEGY.maxPositionPct);
        if (fullValue < balance * STRATEGY.minPositionPct) { log.skipped.push({ symbol: s.symbol, reason: "تحت أرضية المركز" }); continue; }
        if (deployed + fullValue > maxDeployed) { log.skipped.push({ symbol: s.symbol, reason: "بلغ سقف الانتشار" }); break; }

        const fullQty = Math.floor(fullValue / px);
        if (fullQty < 2) { log.skipped.push({ symbol: s.symbol, reason: "كمية صغيرة" }); continue; }
        const initialQty = Math.max(1, Math.floor(fullQty * STRATEGY.initialFraction));
        const addQty = fullQty - initialQty;

        const brTp = STRATEGY.tieredExit
          ? +(Number(t3) || Number(t1) * 1.2).toFixed(Number(t3) < 1 ? 4 : 2)
          : +(Number(t1) * STRATEGY.tp1FillNudge).toFixed(Number(t1) < 1 ? 4 : 2);
        const buy = await buyBracket(s.symbol, initialQty, brTp, stopPx);
        if (buy.status === "rejected" || buy.code) {
          log.skipped.push({ symbol: s.symbol, reason: "رُفض البراكِت (لا دخول بلا وقف)", err: buy.message || null });
          continue;
        }

        const plan = {
          symbol: s.symbol, status: "active",
          initial_qty: initialQty, add_qty: addQty, added: false, add_enabled: STRATEGY.addEnabled && addQty > 0,
          total_qty: initialQty, avg_entry: px, add_level: (support + px) / 2, stop: stopPx, t1: t1, t3: t3,
          support: support, confirm: confirm, tp1_done: false, be_moved: false,
          stock_type: s.type || "مضاربة",
          t1_sell_frac: (s.type === "استثمار") ? STRATEGY.investT1Sell : STRATEGY.scalpT1Sell,
        };
        await planSave(plan);

        deployed += initialQty * px; openCount++; openSymbols.add(s.symbol);
        log.entered.push({ symbol: s.symbol, px: +px.toFixed(2), initialQty, reserveAdd: addQty, stop: +stopPx.toFixed(2), tp1: +t1.toFixed(2), exit: "bracket@TP1", rr: +((t1 - px) / (px - stopPx)).toFixed(2) });
      }

      const skipTally = {};
      for (const sk of log.skipped) skipTally[sk.reason] = (skipTally[sk.reason] || 0) + 1;
      debug.phase = "enter";
      debug.candidates = candidates.length;
      debug.after_filter = filtered.length;
      debug.open_before = openSymbols.size - log.entered.length;
      debug.max_trades = STRATEGY.maxTrades;
      debug.entered = log.entered.length;
      debug.skipped = log.skipped.length;
      debug.skip_reasons = skipTally;
      debug.warnings = log.warnings.length;
      debug.deployed_pct = balance > 0 ? Math.round((deployed / balance) * 100) : 0;
    }

    return res.status(200).json({
      success: true, engine: STRATEGY.engine,
      time_et: `${et.getHours()}:${String(et.getMinutes()).padStart(2, "0")}`,
      debug,
      ...log,
    });
  } catch (e) {
    return res.status(200).json({ success: false, error: e.message });
  }
}
