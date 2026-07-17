// pages/api/scan-debug.js
import { DataProvider } from '../../lib/radar/core/DataProvider';
import { FeatureBuilder } from '../../lib/radar/core/FeatureBuilder';
import { PredictionEngine } from '../../lib/radar/services/PredictionEngine';
import { ConfidenceEngine } from '../../lib/radar/services/ConfidenceEngine';
import { StorageEngine } from '../../lib/radar/services/StorageEngine';
import { cache } from '../../lib/radar/core/CacheManager';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is missing.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // 1. جلب النموذج النشط
    const { data: model } = await supabase
      .from('model_registry')
      .select('version, weights')
      .eq('status', 'CHAMPION')
      .single();

    // 2. جلب بيانات وهمية
    const rawStocks = [
      { symbol: 'AAPL', close: 150, volume: 1000000, rvol: 5, atr: 0.5, ema9: 148, ema21: 147, vwap: 149, rsi: 60, sectorRank: 2 },
      { symbol: 'TSLA', close: 200, volume: 2000000, rvol: 7, atr: 1.2, ema9: 198, ema21: 195, vwap: 197, rsi: 65, sectorRank: 1 },
    ];

    const marketContext = { spy_change: 0, vix: 18, regime: 'Neutral', hour: 10, day_of_week_index: 3 };

    const snapshotsBatch = [];
    for (const stock of rawStocks) {
      const featureVector = FeatureBuilder.build(stock, marketContext);
      const context = FeatureBuilder.buildContext(marketContext);
      snapshotsBatch.push({
        symbol: stock.symbol,
        price: featureVector.price,
        feature_vector: featureVector,
        context,
      });
    }

    // 3. محاولة الحفظ
    console.log('📤 محاولة حفظ', snapshotsBatch.length, 'سجلات');
    const result = await StorageEngine.saveSnapshotsBulk(snapshotsBatch);
    console.log('✅ نتيجة الحفظ:', result);

    res.status(200).json({
      success: true,
      modelVersion: model?.version || 'unknown',
      savedCount: result.length,
      result,
    });
  } catch (error) {
    console.error('❌ خطأ:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
}
