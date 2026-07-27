// lib/radar/services/StorageEngine.js
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export class StorageEngine {
  // ══════════════════════════════════════════════════════════
  // بيانات التعلّم الدائمة (append) — feature_store. لا تُمَس.
  // ══════════════════════════════════════════════════════════
  static async saveSnapshotsBulk(snapshotsArray) {
    if (!snapshotsArray || snapshotsArray.length === 0) {
      return [];
    }

    const cleanData = snapshotsArray.map((item) => {
      const fv = item.feature_vector || {};
      const ctx = item.context || {};

      return {
        symbol: item.symbol,
        snapshot_timestamp: new Date().toISOString(),
        price: Number(item.price ?? 0),

        volume: Number(fv.volume ?? item.volume ?? 0),
        rvol: Number(fv.rvol ?? fv.relativeVolume ?? 0),
        atr: Number(fv.atr ?? fv.atr14 ?? 0),
        ema9: Number(fv.ema9 ?? fv.ema_9 ?? 0),
        ema21: Number(fv.ema21 ?? fv.ema_21 ?? 0),

        market_context: {
          regime: ctx.market_regime ?? 'Neutral',
          spy_change: Number(ctx.spy_change ?? ctx.spy ?? 0),
          vix: Number(ctx.vix ?? 0),
          hour: Number(ctx.hour ?? new Date().getHours()),
          day_of_week: Number(ctx.day_of_week_index ?? new Date().getDay()),
        },
        sector_context: {
          name: fv.sector_name ?? 'Unknown',
          rank: Number(fv.sector_rank ?? 5),
          change: Number(fv.sector_change ?? 0),
        },
        macro_context: {
          fed_regime: ctx.fed_regime ?? 'Neutral',
          risk_appetite: ctx.risk_appetite ?? 'Neutral',
          liquidity_regime: ctx.liquidity_regime ?? 'Normal',
          volatility_regime: ctx.volatility_regime ?? 'Normal',
        },

        full_snapshot: {
          feature_vector: fv,
          context: ctx,
          raw: item.raw ?? {},
        },

        success: null,
        evaluation_status: 'PENDING',
      };
    });

    if (cleanData.length > 0) {
      const first = cleanData[0];
      console.log('[StorageEngine] 📦 أول سجل:', {
        symbol: first.symbol,
        price: first.price,
        volume: first.volume,
        rvol: first.rvol,
        atr: first.atr,
      });
    }
    console.log(`📤 [StorageEngine] محاولة إدراج ${cleanData.length} سجل...`);

    const { data, error } = await supabase
      .from('feature_store')
      .insert(cleanData)
      .select('id');

    if (error) {
      console.error('❌ [StorageEngine] فشل الإدراج:', JSON.stringify(error, null, 2));
      throw new Error(`Supabase insert failed: ${error.message} (Code: ${error.code})`);
    }

    console.log(`✅ [StorageEngine] تم إدراج ${data?.length || 0} سجل.`);
    return data.map((row) => ({ id: row.id }));
  }

  static async savePredictionsBulk(predictionsArray) {
    if (!predictionsArray || predictionsArray.length === 0) {
      return false;
    }

    const { error } = await supabase
      .from('prediction_results')
      .insert(predictionsArray);

    if (error) {
      console.error('❌ [StorageEngine] فشل إدراج التوقعات:', JSON.stringify(error, null, 2));
      throw new Error(`Predictions insert failed: ${error.message}`);
    }

    return true;
  }

  // ══════════════════════════════════════════════════════════
  // طبقة العرض (replace) — latest_signals. استبدال ذرّي عبر scan_batch_id.
  // القراءة تأخذ أحدث دفعة فقط، فلا يرى المشترك جدولاً فارغاً أو نصف مسح.
  // ══════════════════════════════════════════════════════════

  // كتابة قسم واحد (ready أو breakout) من مسح واحد بدفعته.
  // آمنة: مصفوفة فارغة تُعيد true (لا شيء لكتابته ليس خطأ).
  static async saveLatestSignalsBulk(signals, scanType, section, batchId) {
    if (!signals || signals.length === 0) return true;

    const rows = signals.map((s) => ({
      symbol: s.symbol,
      scan_type: scanType,
      section,
      scan_batch_id: batchId,
      score: Number(s.predictionScore ?? s.score ?? 0),
      signal: s, // الكائن الكامل (jsonb)
    }));

    const { error } = await supabase.from('latest_signals').insert(rows);
    if (error) {
      console.error('❌ [StorageEngine] فشل إدراج latest_signals:', JSON.stringify(error, null, 2));
      throw new Error(`latest_signals insert failed: ${error.message}`);
    }
    return true;
  }

  // كتابة حركة السوق (movers) كصفّ واحد ضمن نفس الدفعة، ليخدمها /api/signals.
  static async saveLatestMovers(movers, scanType, batchId) {
    if (!movers) return true;
    const { error } = await supabase.from('latest_signals').insert([{
      symbol: '__MOVERS__',
      scan_type: scanType,
      section: 'movers',
      scan_batch_id: batchId,
      score: 0,
      signal: movers,
    }]);
    if (error) {
      console.warn('⚠️ [StorageEngine] فشل إدراج movers (غير حرج):', error.message);
    }
    return true;
  }

  // تنظيف تلقائي: يُبقي أحدث `keep` دُفعات لكل scan_type ويحذف ما قبلها.
  // يُستدعى بعد نجاح الكتابة، ومغلّف عند الاستدعاء فلا يُسقط المسح إن فشل.
  static async pruneOldBatches(scanType, keep = 3) {
    // نجلب أحدث الصفوف لاستخراج معرّفات الدُفعات المميّزة (batchId = ISO timestamp).
    const { data, error } = await supabase
      .from('latest_signals')
      .select('scan_batch_id')
      .eq('scan_type', scanType)
      .order('scan_batch_id', { ascending: false })
      .limit(1000);

    if (error || !data || data.length === 0) return;

    const distinct = [];
    for (const r of data) {
      if (!distinct.includes(r.scan_batch_id)) distinct.push(r.scan_batch_id);
    }
    const toDelete = distinct.slice(keep);
    if (toDelete.length === 0) return;

    const { error: delErr } = await supabase
      .from('latest_signals')
      .delete()
      .eq('scan_type', scanType)
      .in('scan_batch_id', toDelete);

    if (delErr) {
      console.warn('⚠️ [StorageEngine] فشل تنظيف الدُفعات القديمة (غير حرج):', delErr.message);
    }
  }

  // قراءة أحدث دفعة لنوع مسح، مقسّمة إلى ready / breakouts. تُستخدم في /api/signals.
  static async getLatestSignals(scanType = 'main') {
    // أحدث batchId (ترتيب نصّي على ISO timestamp صحيح زمنياً).
    const { data: latest, error: e1 } = await supabase
      .from('latest_signals')
      .select('scan_batch_id')
      .eq('scan_type', scanType)
      .order('scan_batch_id', { ascending: false })
      .limit(1);

    if (e1 || !latest || latest.length === 0) {
      return { batchId: null, ready: [], breakouts: [] };
    }

    const batchId = latest[0].scan_batch_id;

    // نقرأ الإشارات (ready/breakout) بحدّ عالٍ صريح حتى لا تُقتطع.
    const { data: rows, error: e2 } = await supabase
      .from('latest_signals')
      .select('section, score, signal')
      .eq('scan_type', scanType)
      .eq('scan_batch_id', batchId)
      .in('section', ['ready', 'breakout'])
      .order('score', { ascending: false })
      .limit(2000);

    // نقرأ صفّ movers باستعلام منفصل صريح (score=0، فقد يسقط من ترتيب/حدّ الإشارات).
    let movers = null;
    try {
      const { data: mv } = await supabase
        .from('latest_signals')
        .select('signal')
        .eq('scan_type', scanType)
        .eq('scan_batch_id', batchId)
        .eq('section', 'movers')
        .limit(1);
      if (mv && mv.length > 0) movers = mv[0].signal;
    } catch {}

    if (e2 || !rows) {
      return { batchId, ready: [], breakouts: [], movers };
    }

    const ready = rows.filter((r) => r.section === 'ready').map((r) => r.signal);
    const breakouts = rows.filter((r) => r.section === 'breakout').map((r) => r.signal);
    return { batchId, ready, breakouts, movers };
  }
}
