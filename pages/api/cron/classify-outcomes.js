// pages/api/cron/classify-outcomes.js
// ============================================================
// RadarAZ — Outcome Classifier (Backtesting core)
// يقيّم الإشارات المحفوظة: هل ضربت الهدف أم الوقف؟
//
// إصلاح نهائي (لا patch):
//  1) توافق خلفي كامل لأسماء الحقول:
//     entry  ← entry / entryPrice
//     target ← target / target1
//     stop   ← stop_loss / stop
//     ويقرأ من مسارين: full_snapshot.feature_vector  و  feature_vector
//  2) توقيع getBars الصحيح (limit / timeframe / minRequired) — لا from/to.
//  3) حالة pending مستقلة: إشارة لم ينضج تقييمها بعد ≠ noData.
//  4) تقرير مفصّل بكل الحالات + عيّنة من كل حالة.
//  5) تشخيص مؤقت (DEBUG_KEYS) يُطبع مفاتيح feature_vector — يُزال بعد التأكد.
// ============================================================
import { createClient } from '@supabase/supabase-js';
import { dataProvider } from '../../../lib/radar/core/DataProvider';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is missing.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── إعدادات النضج ──
const MIN_MATURITY_DAYS = 2;   // أقل من هذا العمر = pending (لم ينضج للتقييم)
const MAX_EVAL_DAYS = 10;      // أقدم من هذا بلا نتيجة = expired (انتهت نافذة التقييم)
const DEBUG_KEYS = true;       // ← تشخيص مؤقت؛ اجعله false بعد التأكد

// قراءة feature_vector من كلا المسارين (توافق خلفي)
function extractFV(snapshot) {
  return (
    snapshot?.full_snapshot?.feature_vector ??
    snapshot?.feature_vector ??
    snapshot?.full_snapshot ??
    {}
  );
}

// قراءة المستويات بكل الأسماء المحتملة (توافق خلفي)
function extractLevels(fv, snapshot) {
  const entry =
    fv.entry ?? fv.entryPrice ??
    snapshot.entry ?? snapshot.entryPrice ?? null;

  const target =
    fv.target ?? fv.target1 ??
    snapshot.target ?? snapshot.target1 ?? null;

  const stop =
    fv.stop_loss ?? fv.stop ??
    snapshot.stop_loss ?? snapshot.stop ?? null;

  return {
    entry: entry != null ? Number(entry) : null,
    target: target != null ? Number(target) : null,
    stop: stop != null ? Number(stop) : null,
  };
}

export default async function handler(req, res) {
  const startTime = Date.now();

  const results = {
    processed: 0,
    success: 0,      // ضربت الهدف
    failure: 0,      // ضربت الوقف
    pending: 0,      // لم ينضج بعد (عمر < MIN_MATURITY_DAYS) أو لم يُلمس أيّهما
    expired: 0,      // مرّت نافذة التقييم بلا نتيجة
    missingLevels: 0,
    noData: 0,       // فشل جلب شموع فعلي
  };
  const samples = {}; // عيّنة من كل حالة

  const addSample = (status, obj) => {
    if (!samples[status]) samples[status] = obj;
  };

  try {
    // اجلب الإشارات غير المُقيّمة (success = null)، الأقدم أولاً
    // ملاحظة: الأعمدة الفعلية في feature_store هي full_snapshot / success /
    // evaluation_* / snapshot_timestamp. الـ feature_vector يعيش داخل full_snapshot.
    const { data: rows, error } = await supabase
      .from('feature_store')
      .select('id, symbol, snapshot_timestamp, full_snapshot')
      .is('success', null)
      .order('snapshot_timestamp', { ascending: true })
      .limit(200);

    if (error) throw error;

    const now = Date.now();

    for (const snapshot of (rows || [])) {
      results.processed++;
      const symbol = snapshot.symbol;

      const fv = extractFV(snapshot);

      // ── تشخيص مؤقت ──
      if (DEBUG_KEYS && results.processed <= 3) {
        console.log(`🔍 [${symbol}] feature_vector keys:`, Object.keys(fv || {}));
        console.log(`🔍 [${symbol}] levels probe:`, {
          entry: fv.entry, entryPrice: fv.entryPrice,
          target: fv.target, target1: fv.target1,
          target2: fv.target2, target3: fv.target3,
          stop: fv.stop, stop_loss: fv.stop_loss,
        });
      }

      const entryPrice =
        fv.price ?? fv.entry ?? fv.entryPrice ??
        snapshot.full_snapshot?.price ??
        extractLevels(fv, snapshot).entry;
      const { target, stop } = extractLevels(fv, snapshot);

      if (!entryPrice || !target || !stop) {
        results.missingLevels++;
        addSample('missingLevels', { symbol, entryPrice, target, stop, fvKeys: Object.keys(fv || {}) });
        continue;
      }

      // ── فحص النضج ──
      const ageMs = now - new Date(snapshot.snapshot_timestamp).getTime();
      const ageDays = ageMs / 86400000;

      if (ageDays < MIN_MATURITY_DAYS) {
        results.pending++;
        addSample('pending', { symbol, ageDays: Number(ageDays.toFixed(2)), note: 'لم ينضج بعد' });
        continue;
      }

      // ── جلب الشموع اليومية اللاحقة (توقيع getBars الصحيح: limit) ──
      // نحتاج شموعاً تغطّي من تاريخ الإشارة حتى الآن. limit = أيام العمر + هامش.
      const limit = Math.min(Math.ceil(ageDays) + 5, 30);
      let bars = [];
      try {
        bars = await dataProvider.getBars(symbol, {
          timeframe: 'day',
          limit,
          adjusted: true,
          minRequired: 1,
        });
      } catch (e) {
        results.noData++;
        addSample('noData', { symbol, reason: 'getBars_threw', error: e.message });
        continue;
      }

      if (!bars || bars.length === 0) {
        results.noData++;
        addSample('noData', { symbol, reason: 'no_bars_returned' });
        continue;
      }

      // احتفظ فقط بالشموع بعد تاريخ الإشارة (التقييم المستقبلي)
      const predTs = new Date(snapshot.snapshot_timestamp).getTime();
      const forwardBars = bars.filter(b => new Date(b.timestamp).getTime() > predTs);

      if (forwardBars.length === 0) {
        // شموع موجودة لكن لا شيء بعد الإشارة بعد → ما زالت مفتوحة
        if (ageDays > MAX_EVAL_DAYS) {
          results.expired++;
          addSample('expired', { symbol, ageDays: Number(ageDays.toFixed(1)) });
          await markResult(snapshot.id, { success: null, evaluation_status: 'EXPIRED', evaluation_reason: 'no_forward_bars' });
        } else {
          results.pending++;
          addSample('pending', { symbol, note: 'لا شموع لاحقة بعد' });
        }
        continue;
      }

      // ── منطق التقييم: أيّهما لُمس أولاً، الهدف أم الوقف؟ ──
      let outcome = null;   // 'target' | 'stop'
      let hitBar = null;
      for (const b of forwardBars) {
        const hitTarget = b.high >= target;
        const hitStop = b.low <= stop;
        if (hitTarget && hitStop) {
          // كلاهما في نفس الشمعة: تحفّظاً نعتبره وقفاً (الأسوأ)
          outcome = 'stop'; hitBar = b; break;
        }
        if (hitTarget) { outcome = 'target'; hitBar = b; break; }
        if (hitStop) { outcome = 'stop'; hitBar = b; break; }
      }

      if (outcome === 'target') {
        results.success++;
        const ret = entryPrice > 0 ? ((target - entryPrice) / entryPrice) * 100 : 0;
        addSample('success', { symbol, entryPrice, target, hitAt: hitBar.timestamp, returnPct: Number(ret.toFixed(2)) });
        await markResult(snapshot.id, {
          success: true, evaluation_status: 'CLASSIFIED', evaluation_reason: 'target_hit',
          forward_return_4h: Number(ret.toFixed(4)),
        });
      } else if (outcome === 'stop') {
        results.failure++;
        const ret = entryPrice > 0 ? ((stop - entryPrice) / entryPrice) * 100 : 0;
        addSample('failure', { symbol, entryPrice, stop, hitAt: hitBar.timestamp, returnPct: Number(ret.toFixed(2)) });
        await markResult(snapshot.id, {
          success: false, evaluation_status: 'CLASSIFIED', evaluation_reason: 'stop_hit',
          forward_return_4h: Number(ret.toFixed(4)),
        });
      } else {
        // لم يُلمس أيّهما بعد
        if (ageDays > MAX_EVAL_DAYS) {
          results.expired++;
          addSample('expired', { symbol, ageDays: Number(ageDays.toFixed(1)), note: 'لا هدف ولا وقف خلال النافذة' });
          await markResult(snapshot.id, { success: null, evaluation_status: 'EXPIRED', evaluation_reason: 'no_hit_in_window' });
        } else {
          results.pending++;
          addSample('pending', { symbol, note: 'مفتوحة — لم تضرب بعد' });
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const classified = results.success + results.failure;
    const winRate = classified > 0 ? Number(((results.success / classified) * 100).toFixed(1)) : null;

    return res.status(200).json({
      message: '✅ تم التصنيف',
      ...results,
      classified,
      winRate,
      duration: `${duration}s`,
      samples,   // عيّنة من كل حالة (تشخيص) — يمكن إزالتها لاحقاً
    });
  } catch (error) {
    console.error('❌ classify-outcomes error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// كتابة النتيجة في feature_store
async function markResult(id, fields) {
  try {
    await supabase.from('feature_store').update(fields).eq('id', id);
  } catch (e) {
    console.error(`❌ markResult failed for ${id}:`, e.message);
  }
}
