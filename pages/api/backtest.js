// pages/api/backtest.js
// ============================================================
// RadarAZ — Backtest (تقرير شامل على العيّنة المقيّمة)
// المصدر: جدول signals (٤٢٣٥+ صفقة مقيّمة، حقول النتيجة جاهزة).
// لا يعيد حساب النتائج ولا يلمس Polygon — يقرأ الحقول ويجمّعها.
//
// تعريف النتيجة (الأدقّ، حسب قرارك):
//   win     = target1_hit=true  و stop_hit=false
//   loss    = stop_hit=true     و target1_hit=false
//   ambiguous = ضربت الاثنين (فئة منفصلة — لا تُحسب في win rate)
//   pending = لا هدف ولا وقف (مفتوحة)
//
// win rate = wins / (wins + losses)  — الملتبسة والمعلّقة مستبعدة من المقام.
//
// الاستخدام:
//   /api/backtest                → كل العيّنة
//   /api/backtest?days=90        → آخر 90 يوماً
//   /api/backtest?from=2026-01-01&to=2026-03-01
// ============================================================

import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('❌ SUPABASE service key is missing.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const PAGE = 1000; // حجم صفحة القراءة من Supabase

// ── تصنيف صفقة واحدة إلى: win | loss | ambiguous | pending ──
// التعريف الموحّد (مطابق /api/evaluate v5):
//   win  = target1_hit && !stop_hit && result_pct > 0  (ربح فعلي، لا مجرّد لمس)
//   loss = stop_hit، أو أُغلقت بعائد ≤ 0
//   ambiguous = لمست الهدف والوقف معاً
//   pending = لم تُقيَّم بعد (لا result_pct)
function classify(s) {
  const t1 = s.target1_hit === true;
  const stop = s.stop_hit === true;
  const hasResult = s.result_pct != null;
  // معلّقة: لا هدف ولا وقف ولا نتيجة مُسجّلة بعد
  if (!hasResult && !t1 && !stop) return 'pending';
  if (t1 && stop) return 'ambiguous';
  if (t1 && !stop && hasResult && Number(s.result_pct) > 0) return 'win';
  if (stop || (hasResult && Number(s.result_pct) <= 0)) return 'loss';
  // لمست الهدف لكن بلا نتيجة موجبة مؤكّدة بعد → معلّقة
  return 'pending';
}

// ── عائد الصفقة للمقاييس المالية ──
// نفضّل result_pct (النتيجة النهائية المعتمدة)، ثم close_gain_pct، ثم max_gain_pct.
function tradeReturn(s) {
  if (s.result_pct != null) return Number(s.result_pct);
  if (s.close_gain_pct != null) return Number(s.close_gain_pct);
  if (s.max_gain_pct != null) return Number(s.max_gain_pct);
  return null;
}

// ── هيكل مجمِّع فارغ ──
function emptyAgg() {
  return {
    total: 0, wins: 0, losses: 0, ambiguous: 0, pending: 0,
    t1: 0, t2: 0, t3: 0, stops: 0,
    sumReturn: 0, retCount: 0,
    grossWin: 0, grossLoss: 0, // للـ profit factor
    sumMaxGain: 0, maxGainCount: 0,
  };
}

// ── إدخال صفقة في مجمِّع ──
function feed(agg, s, cls) {
  agg.total++;
  if (cls === 'win') agg.wins++;
  else if (cls === 'loss') agg.losses++;
  else if (cls === 'ambiguous') agg.ambiguous++;
  else agg.pending++;

  if (s.target1_hit) agg.t1++;
  if (s.target2_hit) agg.t2++;
  if (s.target3_hit) agg.t3++;
  if (s.stop_hit) agg.stops++;

  const ret = tradeReturn(s);
  if (ret != null) {
    agg.sumReturn += ret; agg.retCount++;
    if (ret >= 0) agg.grossWin += ret; else agg.grossLoss += Math.abs(ret);
  }
  if (s.max_gain_pct != null) { agg.sumMaxGain += Number(s.max_gain_pct); agg.maxGainCount++; }
}

// ── تحويل مجمِّع إلى مقاييس نهائية ──
function finalize(agg) {
  const decided = agg.wins + agg.losses; // مقام win rate (المحسومة فقط)
  const winRate = decided > 0 ? (agg.wins / decided) * 100 : null;
  const avgReturn = agg.retCount > 0 ? agg.sumReturn / agg.retCount : null;
  const profitFactor = agg.grossLoss > 0 ? agg.grossWin / agg.grossLoss
    : (agg.grossWin > 0 ? Infinity : null);
  const avgMaxGain = agg.maxGainCount > 0 ? agg.sumMaxGain / agg.maxGainCount : null;
  return {
    total: agg.total,
    wins: agg.wins,
    losses: agg.losses,
    ambiguous: agg.ambiguous,
    pending: agg.pending,
    decided,
    winRate: winRate != null ? Number(winRate.toFixed(1)) : null,
    avgReturnPct: avgReturn != null ? Number(avgReturn.toFixed(2)) : null,
    profitFactor: profitFactor === Infinity ? null : (profitFactor != null ? Number(profitFactor.toFixed(2)) : null),
    avgMaxGainPct: avgMaxGain != null ? Number(avgMaxGain.toFixed(2)) : null,
    targets: { t1: agg.t1, t2: agg.t2, t3: agg.t3, stops: agg.stops },
  };
}

// ── مفتاح تجميع الدرجة (ep/score) إلى شرائح ──
function scoreBucket(v) {
  const x = Number(v || 0);
  if (x >= 85) return '85-100';
  if (x >= 75) return '75-84';
  if (x >= 65) return '65-74';
  if (x >= 55) return '55-64';
  if (x >= 45) return '45-54';
  return '0-44';
}

// ── نوع الإشارة (أولوية واضحة) ──
function signalType(s) {
  if (s.is_hot) return 'breakout';        // اختراق
  if (s.is_smart_bounce) return 'smart_bounce'; // ارتداد ذكي
  if (s.early_watch) return 'early_watch';      // رصد مبكر
  if (s.vcp) return 'vcp';
  return 'other';
}

// ── فئة السعر ──
function priceTier(s) {
  const p = Number(s.entry_price ?? 0);
  if (p > 0 && p < 1) return 'sub_1';
  if (p >= 1 && p < 10) return '1_10';
  if (p >= 10 && p < 50) return '10_50';
  if (p >= 50) return '50_plus';
  return 'unknown';
}

// ── ساعة الإشارة (بتوقيت نيويورك) ──
function nyHour(s) {
  const ts = s.scan_time || s.created_at;
  if (!ts) return 'unknown';
  try {
    const h = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', hour12: false,
    }).format(new Date(ts));
    return String(parseInt(h, 10)).padStart(2, '0') + ':00';
  } catch { return 'unknown'; }
}

export default async function handler(req, res) {
  const startTime = Date.now();
  try {
    // نطاق التاريخ
    let fromDate = req.query.from || null;
    let toDate = req.query.to || null;
    if (!fromDate && req.query.days) {
      const d = Math.min(Math.max(parseInt(req.query.days) || 0, 1), 400);
      fromDate = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    }

    // ── جلب كل الصفوف بالتصفّح (paging) ──
    let all = [];
    let offset = 0;
    for (let guard = 0; guard < 60; guard++) { // حدّ أمان: 60k صف
      let q = supabase
        .from('signals')
        .select('symbol, entry_price, target1_hit, target2_hit, target3_hit, stop_hit, result_pct, close_gain_pct, max_gain_pct, max_loss_pct, ep, score, is_hot, early_watch, is_smart_bounce, vcp, scan_time, created_at, signal_date, status')
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (fromDate) q = q.gte('signal_date', fromDate);
      if (toDate) q = q.lte('signal_date', toDate);

      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    // تفريد بـ (symbol + signal_date) — صفقة واحدة لكل سهم/يوم (يطابق summary)
    const seen = new Set();
    const trades = all.filter((s) => {
      const k = `${s.symbol}|${s.signal_date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // ── التجميع ──
    const overall = emptyAgg();
    const byType = {}, byScore = {}, byHour = {}, byPrice = {}, byDate = {};

    const bump = (map, key, s, cls) => {
      if (!map[key]) map[key] = emptyAgg();
      feed(map[key], s, cls);
    };

    for (const s of trades) {
      const cls = classify(s);
      feed(overall, s, cls);
      bump(byType, signalType(s), s, cls);
      bump(byScore, scoreBucket(s.ep ?? s.score), s, cls);
      bump(byHour, nyHour(s), s, cls);
      bump(byPrice, priceTier(s), s, cls);
      bump(byDate, s.signal_date || 'unknown', s, cls);
    }

    const finalizeMap = (map) => {
      const out = {};
      for (const k of Object.keys(map)) out[k] = finalize(map[k]);
      return out;
    };

    // ترتيب byDate تنازلياً وتحويله لمصفوفة موجزة (للرسم الزمني)
    const equityByDate = Object.keys(byDate).sort().map((d) => {
      const f = finalize(byDate[d]);
      return { date: d, trades: f.total, winRate: f.winRate, avgReturnPct: f.avgReturnPct };
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return res.status(200).json({
      message: '✅ Backtest',
      meta: {
        source: 'signals',
        definition: 'win = target1_hit && !stop_hit ; loss = stop_hit && !target1_hit ; ambiguous = both ; pending = neither',
        winRateDenominator: 'wins + losses (ambiguous & pending excluded)',
        range: { from: fromDate || 'all', to: toDate || 'now' },
        rawRows: all.length,
        uniqueTrades: trades.length,
        duration: `${duration}s`,
      },
      overall: finalize(overall),
      byType: finalizeMap(byType),
      byScore: finalizeMap(byScore),
      byHour: finalizeMap(byHour),
      byPrice: finalizeMap(byPrice),
      timeline: equityByDate,
    });
  } catch (error) {
    console.error('❌ backtest error:', error);
    return res.status(500).json({ error: error.message });
  }
}
