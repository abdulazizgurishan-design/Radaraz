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
}
