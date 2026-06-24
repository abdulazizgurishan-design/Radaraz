// pages/api/evaluate.js — v2 (per-signal-date + batched)
// ═══════════════════════════════════════════════════════════════════
//  ترقيات هذا الإصدار:
//   ✅ يقيّم كل إشارة حسب يومها الصحيح (signal_date) — لا "اليوم" للجميع
//   ✅ تنفيذ على دفعات (10) — يمنع إغراق Polygon بمئات الطلبات المتزامنة
//   ✅ يتعامل مع تراكم الإشارات القديمة المفتوحة (backlog) بشكل صحيح
// ═══════════════════════════════════════════════════════════════════

const POLYGON_KEY = process.env.POLYGON_API_KEY;
const SUPABASE_URL = "https://ypxrrghhkjbeojzphdln.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const BASE = "https://api.polygon.io";

export const config = { maxDuration: 60 };

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

// تنفيذ على دفعات محكومة التزامن
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    const part = await Promise.all(items.slice(i, i + size).map(fn));
    out.push(...part);
  }
  return out;
}

export default async function handler(req, res) {
  const isFromCron = req.headers["x-vercel-cron"] === "true";
  const headerSecret = req.headers["x-cron-secret"];
  const querySecret = req.query.secret;
  const isAuthorized = isFromCron || headerSecret === CRON_SECRET || querySecret === CRON_SECRET;
  if (!isAuthorized) return res.status(401).json({ error: "Unauthorized" });

  try {
    // تخطّي عطلة نهاية الأسبوع
    const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const dow = etNow.getDay();
    if (dow === 0 || dow === 6) {
      return res.status(200).json({ success: true, message: "عطلة نهاية الأسبوع — لا تقييم", evaluated: 0 });
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

    // تاريخ اليوم (ET) كاحتياطي للإشارات القديمة بدون signal_date
    const today = etNow.toISOString().split("T")[0];

    // 2) قيّم كل إشارة حسب يومها الصحيح — على دفعات من 10
    const updates = await inBatches(signals, 10, async (sig) => {
      try {
        // يوم الإشارة: signal_date → تاريخ الإنشاء → اليوم
        const d = sig.signal_date
          || (sig.created_at ? String(sig.created_at).split("T")[0] : today);

        // ⏱️ نقيس فقط حركة السعر بعد لحظة الرصد (created_at) — لا نظلم الإشارة بنزولٍ
        //    حصل صباحاً قبل أن يرصدها الرادار. نطبّق القطع فقط إذا كان الرصد بنفس اليوم.
        const sameDay = sig.created_at && String(sig.created_at).split("T")[0] === d;
        const cutoff = sameDay ? new Date(sig.created_at).getTime() : 0;

        // شموع الدقائق ليوم الإشارة (طلب واحد لكل إشارة)
        const murl = `${BASE}/v2/aggs/ticker/${sig.symbol}/range/1/minute/${d}/${d}?sort=asc&limit=50000&apiKey=${POLYGON_KEY}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4500);
        const r2 = await fetch(murl, { signal: ctrl.signal });
        clearTimeout(timer);
        const data = await r2.json();
        let bars = (data?.results || []).filter(b => b.t >= cutoff);
        if (!bars.length) bars = data?.results || [];   // الرصد بعد آخر شمعة → نكتفي باليوم كامل
        if (!bars.length) return null;                   // لا بيانات إطلاقاً

        const high  = Math.max(...bars.map(b => b.h));
        const low   = Math.min(...bars.map(b => b.l));
        const close = bars[bars.length - 1].c;

        const t1_reached = high >= sig.target1;
        const t2_reached = high >= sig.target2;
        const t3_reached = high >= sig.target3;
        const stop_reached = low <= sig.stop_loss;

        // ⏱️ حسم الترتيب: أول دقيقة لمس فيها السعر الهدف، وأول دقيقة لمس فيها الوقف
        const tHitBar  = t1_reached  ? bars.find(b => b.h >= sig.target1)  : null;
        const stopBar  = stop_reached ? bars.find(b => b.l <= sig.stop_loss) : null;
        const tHitTime = tHitBar ? tHitBar.t : Infinity;
        const stopTime = stopBar ? stopBar.t : Infinity;

        // النتيجة الحقيقية حسب ما حصل أولاً (وعند التساوي في نفس الدقيقة → نحسبها خسارة تحفّظاً):
        const stoppedFirst = stop_reached && stopTime <= tHitTime;
        const t1_hit = t1_reached && !stoppedFirst;
        const t2_hit = t2_reached && !stoppedFirst;
        const t3_hit = t3_reached && !stoppedFirst;
        const stop_hit = stoppedFirst;

        // أقصى ربح يُحتسب فقط حتى لحظة ضرب الوقف (لا نُجمّل بربح حصل بعد خروجنا)
        let effHigh = high;
        if (stoppedFirst) {
          const upto = bars.filter(b => b.t <= stopTime);
          effHigh = upto.length ? Math.max(...upto.map(b => b.h)) : sig.entry_price;
        }
        const max_gain_pct = +(((effHigh - sig.entry_price) / sig.entry_price) * 100).toFixed(2);
        const close_gain_pct = +(((close - sig.entry_price) / sig.entry_price) * 100).toFixed(2);

        // وقت إصابة الهدف الأول (للرابح الفعلي فقط)
        const target1_hit_at = (t1_hit && tHitBar) ? new Date(tHitBar.t).toISOString() : null;

        return {
          id: sig.id,
          high_price: high, low_price: low, close_price: close,
          target1_hit: t1_hit, target2_hit: t2_hit, target3_hit: t3_hit, stop_hit,
          target1_hit_at,
          max_gain_pct, close_gain_pct,
          evaluated_at: new Date().toISOString(),
          status: "CLOSED",
        };
      } catch {
        return null;
      }
    });

    // 3) حدّث السجلات (على دفعات كذلك)
    const valid = updates.filter(Boolean);
    let updated = 0;
    await inBatches(valid, 10, async (u) => {
      const { id, ...fields } = u;
      const resp = await fetchRetry(`${SUPABASE_URL}/rest/v1/signals?id=eq.${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify(fields),
      });
      if (resp.ok) updated++;
      return null;
    });

    return res.status(200).json({
      success: true,
      evaluated: updated,
      total_open: signals.length,
      no_data: signals.length - valid.length,
    });

  } catch (error) {
    return res.status(500).json({ error: error.message, cause: String(error.cause || "") });
  }
}
