// pages/api/evaluate.js — v4 (إصلاح تلوث الإحصائيات + بداية نظيفة)
// ═══════════════════════════════════════════════════════════════════
//  🏗️ مبني على v3 — نفس منطق التقييم (شموع دقائق لليوم الأول + شموع يومية
//     للأيام التالية + حسم الترتيب المتحفظ) — لم يُمس، فقط طبقة الإحصائيات.
//
//  🆕 v4 — إصلاح تلوث الإحصائيات الذي ظهر في أول تشغيل:
//   🔴 المشكلة: avg_win_pct طلع 0.38% (رقم مستحيل) لأن 700 صف قديم كان
//      result_pct فيها NULL (العمود أُنشئ للتو)، والكود كان يعوّضها بصفر
//      عبر (result_pct ?? close_gain_pct ?? 0) — يسحب المتوسط للأسفل زوراً.
//   ✅ الإصلاح: avg() الآن تستبعد أي صف result_pct = null من الحساب تماماً
//      بدل احتسابه صفراً — صف بلا نتيجة معروفة لا يدخل المتوسط، لا يُشوّهه.
//   ✅ عتبة "بداية نظيفة" STATS_SINCE قابلة للتعديل عبر ?statsSince=YYYY-MM-DD
//      — تفصل إحصائيات ما بعد نشر v11/v12 عن تراث v10/evaluate-v2 المختلط
//      (ذاك كان يُغلق كل إشارة بعد يوم واحد حتى لو هدفها T2/T3 بعيد).
//   ✅ عدّاد شفاف جديد: excluded_no_result — كم صفاً استُبعد من الحساب
//      لأنه بلا result_pct، حتى تعرف حجم "التلوث" القديم بوضوح.
//   ✅ by_score تستبعد نفس الصفوف — المقارنة بين الشرائح تصير ذات معنى فعلي.
//
//  🎛️ الاستخدام:
//   /api/evaluate?secret=...                          → دورة تقييم عادية
//   /api/evaluate?secret=...&statsSince=2026-07-13     → إحصائيات بعد تاريخ محدد فقط
//   (بدون statsSince: الافتراضي 30 يوماً كالسابق، لكن مع استبعاد التلوث)
// ═══════════════════════════════════════════════════════════════════

const POLYGON_KEY = process.env.POLYGON_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ypxrrghhkjbeojzphdln.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const BASE = "https://api.polygon.io";

const MAX_HOLD_DAYS = 10;   // أيام تداول قبل الإغلاق كـ EXPIRED — عدّلها حسب استراتيجيتك

export const config = { maxDuration: 60 };

const pct = (v, entry) => +(((v - entry) / entry) * 100).toFixed(2);

async function fetchRetry(url, options = {}, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    const part = await Promise.all(items.slice(i, i + size).map(fn));
    out.push(...part);
  }
  return out;
}

async function fetchJsonTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── تقييم اليوم الأول بشموع الدقائق (كما في v3 — لم يُمس) ───────────
async function evalFirstDay(sig, day, today) {
  const sameDay = sig.created_at && String(sig.created_at).split("T")[0] === day;
  const cutoff = sameDay ? new Date(sig.created_at).getTime() : 0;

  const murl = `${BASE}/v2/aggs/ticker/${sig.symbol}/range/1/minute/${day}/${day}?sort=asc&limit=50000&apiKey=${POLYGON_KEY}`;
  const data = await fetchJsonTimeout(murl, 4500);
  let bars = (data?.results || []).filter(b => b.t >= cutoff);
  if (!bars.length) bars = data?.results || [];
  if (!bars.length) return null;

  const high  = Math.max(...bars.map(b => b.h));
  const low   = Math.min(...bars.map(b => b.l));
  const close = bars[bars.length - 1].c;

  const tHitBar  = high >= sig.target1 ? bars.find(b => b.h >= sig.target1) : null;
  const t2HitBar = high >= sig.target2 ? bars.find(b => b.h >= sig.target2) : null;
  const t3HitBar = high >= sig.target3 ? bars.find(b => b.h >= sig.target3) : null;
  const stopBar  = low <= sig.stop_loss ? bars.find(b => b.l <= sig.stop_loss) : null;
  const tHitTime = tHitBar ? tHitBar.t : Infinity;
  const stopTime = stopBar ? stopBar.t : Infinity;

  const stoppedFirst = !!stopBar && stopTime <= tHitTime;

  let effHigh = high;
  if (stoppedFirst) {
    const upto = bars.filter(b => b.t <= stopTime);
    effHigh = upto.length ? Math.max(...upto.map(b => b.h)) : sig.entry_price;
  }

  return {
    stopped: stoppedFirst,
    t1: !!tHitBar && !stoppedFirst,
    t2: !!t2HitBar && !stoppedFirst,
    t3: !!t3HitBar && !stoppedFirst,
    t1At: (!stoppedFirst && tHitBar)  ? new Date(tHitBar.t).toISOString()  : null,
    t2At: (!stoppedFirst && t2HitBar) ? new Date(t2HitBar.t).toISOString() : null,
    t3At: (!stoppedFirst && t3HitBar) ? new Date(t3HitBar.t).toISOString() : null,
    effHigh, low, close,
  };
}

export default async function handler(req, res) {
  const isFromCron = req.headers["x-vercel-cron"] === "true";
  const headerSecret = req.headers["x-cron-secret"];
  const querySecret = req.query.secret;
  const isAuthorized = isFromCron || headerSecret === CRON_SECRET || querySecret === CRON_SECRET;
  if (!isAuthorized) return res.status(401).json({ error: "Unauthorized" });

  try {
    const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const dow = etNow.getDay();
    const force = req.query.force === "1";
    if ((dow === 0 || dow === 6) && !force) {
      return res.status(200).json({ success: true, message: "عطلة نهاية الأسبوع — لا تقييم (?force=1 للتشغيل اليدوي)", evaluated: 0 });
    }

    // 1) كل الإشارات المفتوحة
    const r = await fetchRetry(
      `${SUPABASE_URL}/rest/v1/signals?status=eq.OPEN&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const signals = await r.json();
    if (!signals?.length) {
      return res.status(200).json({ success: true, message: "لا توجد إشارات مفتوحة", evaluated: 0 });
    }

    const today = etNow.toISOString().split("T")[0];

    // 2) تقييم كل إشارة عبر كل أيامها منذ الرصد — دفعات من 10
    const updates = await inBatches(signals, 10, async (sig) => {
      try {
        const day = sig.signal_date
          || (sig.created_at ? String(sig.created_at).split("T")[0] : today);

        const d1 = await evalFirstDay(sig, day, today);
        if (!d1) return null;

        let stopped = d1.stopped;
        let t1 = d1.t1, t2 = d1.t2, t3 = d1.t3;
        let t1At = d1.t1At, t2At = d1.t2At, t3At = d1.t3At;
        let maxHigh = d1.effHigh;
        let minLow  = d1.low;
        let lastClose = d1.close;
        let tradingDays = 1;

        if (!stopped && !t3 && day < today) {
          const nextDay = new Date(new Date(day).getTime() + 86400000).toISOString().split("T")[0];
          const durl = `${BASE}/v2/aggs/ticker/${sig.symbol}/range/1/day/${nextDay}/${today}?adjusted=true&sort=asc&limit=60&apiKey=${POLYGON_KEY}`;
          const ddata = await fetchJsonTimeout(durl, 4000);
          const dbars = ddata?.results || [];

          for (const b of dbars) {
            tradingDays++;
            const hitStop = b.l <= sig.stop_loss;

            if (hitStop) {
              stopped = true;
              minLow = Math.min(minLow, b.l);
              break;
            }
            if (b.h > maxHigh) maxHigh = b.h;
            if (b.l < minLow)  minLow  = b.l;
            lastClose = b.c;

            const iso = new Date(b.t).toISOString();
            if (!t1 && b.h >= sig.target1) { t1 = true; t1At = iso; }
            if (!t2 && b.h >= sig.target2) { t2 = true; t2At = iso; }
            if (!t3 && b.h >= sig.target3) { t3 = true; t3At = iso; break; }
          }
        }

        let status = "OPEN";
        let result_pct = null;
        if (stopped) {
          status = "STOPPED";
          result_pct = pct(sig.stop_loss, sig.entry_price);
        } else if (t3) {
          status = "T3_HIT";
          result_pct = pct(sig.target3, sig.entry_price);
        } else if (tradingDays >= MAX_HOLD_DAYS) {
          status = t2 ? "T2_HIT" : t1 ? "T1_HIT" : "EXPIRED";
          result_pct = t2 ? pct(sig.target2, sig.entry_price)
                     : t1 ? pct(sig.target1, sig.entry_price)
                     : pct(lastClose, sig.entry_price);
        }

        const fields = {
          high_price: maxHigh, low_price: minLow, close_price: lastClose,
          target1_hit: t1, target2_hit: t2, target3_hit: t3, stop_hit: stopped,
          target1_hit_at: t1At, target2_hit_at: t2At, target3_hit_at: t3At,
          max_gain_pct: pct(maxHigh, sig.entry_price),
          max_loss_pct: pct(minLow, sig.entry_price),
          close_gain_pct: pct(lastClose, sig.entry_price),
          evaluated_at: new Date().toISOString(),
          status,
        };
        if (status !== "OPEN") {
          fields.result_pct = result_pct;
          fields.closed_at = today;
        }
        return { id: sig.id, ...fields, _closed: status !== "OPEN" };
      } catch {
        return null;
      }
    });

    // 3) تحديث السجلات — دفعات
    const valid = updates.filter(Boolean);
    let updated = 0, closedNow = 0;
    await inBatches(valid, 10, async (u) => {
      const { id, _closed, ...fields } = u;
      const resp = await fetchRetry(`${SUPABASE_URL}/rest/v1/signals?id=eq.${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify(fields),
      });
      if (resp.ok) { updated++; if (_closed) closedNow++; }
      return null;
    });

    // 4) 📊 إحصائيات الأداء — 🆕 v4: نظيفة من التلوث + بداية قابلة للتحديد
    // statsSince: افتراضياً 30 يوماً كالسابق، لكن يمكن تحديد تاريخ نشر v11/v12
    // يدوياً عبر ?statsSince=YYYY-MM-DD لفصل البيانات الحديثة عن التراث القديم
    const defaultSince = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const statsSince = (req.query.statsSince && /^\d{4}-\d{2}-\d{2}$/.test(req.query.statsSince))
      ? req.query.statsSince
      : defaultSince;

    const sr = await fetchRetry(
      `${SUPABASE_URL}/rest/v1/signals?status=neq.OPEN&signal_date=gte.${statsSince}` +
      `&select=status,result_pct,close_gain_pct,score,is_hot,type,target1_hit&limit=1000`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const closedAll = (await sr.json()) || [];

    // 🆕 v4: الفصل الحاسم — صف بلا result_pct معروف لا يدخل أي حساب إحصائي
    // (كان الكود القديم يعوّضه بـ close_gain_pct ?? 0 فيُلوّث المتوسط بأصفار وهمية)
    const closed = closedAll.filter(s => s.result_pct != null);
    const excludedNoResult = closedAll.length - closed.length;

    const isWin = s => ["T1_HIT", "T2_HIT", "T3_HIT"].includes(s.status) || s.target1_hit === true;
    const wins = closed.filter(isWin);
    const stops = closed.filter(s => s.status === "STOPPED");
    const avg = arr => arr.length ? +(arr.reduce((a, s) => a + s.result_pct, 0) / arr.length).toFixed(2) : 0;

    const bucket = (lo, hi) => {
      const g = closed.filter(s => (s.score ?? 0) >= lo && (s.score ?? 0) < hi);
      const w = g.filter(isWin);
      return g.length ? { count: g.length, win_rate: +((w.length / g.length) * 100).toFixed(1) } : null;
    };

    return res.status(200).json({
      success: true,
      evaluated: updated,
      closed_now: closedNow,
      still_open: valid.filter(u => !u._closed).length,
      total_open: signals.length,
      no_data: signals.length - valid.length,
      performance_30d: {
        stats_since: statsSince,   // 🆕 v4: شفافية — من أي تاريخ حُسبت هذه الأرقام
        closed_total: closed.length,
        excluded_no_result: excludedNoResult,   // 🆕 v4: كم صفاً قديماً استُبعد (بلا result_pct)
        win_rate_pct: closed.length ? +((wins.length / closed.length) * 100).toFixed(1) : null,
        avg_win_pct: avg(wins),
        avg_loss_pct: avg(stops),
        stopped_count: stops.length,
        by_score: {
          "55-65": bucket(55, 65),
          "65-75": bucket(65, 75),
          "75-99": bucket(75, 100),
        },
        hot_signals: (() => {
          const h = closed.filter(s => s.is_hot);
          const w = h.filter(isWin);
          return h.length ? { count: h.length, win_rate: +((w.length / h.length) * 100).toFixed(1) } : null;
        })(),
      },
    });

  } catch (error) {
    return res.status(500).json({ error: error.message, cause: String(error.cause || "") });
  }
}
