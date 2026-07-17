// pages/api/scan.js
import { DataProvider } from '../../lib/radar/core/DataProvider';
import { FeatureBuilder } from '../../lib/radar/core/FeatureBuilder';
import { PredictionEngine } from '../../lib/radar/services/PredictionEngine';
import { ConfidenceEngine } from '../../lib/radar/services/ConfidenceEngine';
import { StorageEngine } from '../../lib/radar/services/StorageEngine';
import { cache } from '../../lib/radar/core/CacheManager';
import { createClient } from '@supabase/supabase-js';

// ✅ استخدام SERVICE_ROLE_KEY إلزامي
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_MODEL = {
  version: 'v19.8',
  weights: {
    earlyAccumulation: 0.30,
    breakoutProbability: 0.25,
    structure: 0.20,
    liquidity: 0.15,
    marketRegime: 0.10,
  },
  rule_weight: 0.6,
  ai_weight: 0.4,
};

export default async function handler(req, res) {
  const startTime = Date.now();

  try {
    // 1. سياق السوق
    let marketContext = {
      spy_change: 0,
      vix: 18,
      regime: 'Neutral',
      hour: new Date().getHours(),
      day_of_week_index: new Date().getDay(),
      volatility_regime: 'Normal',
      liquidity_regime: 'Normal',
      fed_regime: 'Neutral',
      risk_appetite: 'Neutral',
      top_sector: 'Unknown',
    };

    try {
      if (typeof DataProvider.fetchMarketContext === 'function') {
        const real = await DataProvider.fetchMarketContext();
        marketContext = { ...marketContext, ...real };
      }
    } catch (e) { /* تجاهل */ }

    // 2. جلب النموذج النشط (مع Cache)
    const getChampion = async () => {
      const cached = cache.get('champion_model');
      if (cached) return cached;

      const { data } = await supabase
        .from('model_registry')
        .select('version, weights, rule_weight, ai_weight')
        .eq('status', 'CHAMPION')
        .single();

      const model = data || DEFAULT_MODEL;
      cache.set('champion_model', model, 60);
      return model;
    };

    const model = await getChampion();

    // 3. مسح الأسهم (مع بيانات وهمية للاختبار)
    let rawStocks = [];
    if (typeof DataProvider.scanStocks === 'function') {
      try {
        rawStocks = await DataProvider.scanStocks();
      } catch (e) { /* */ }
    }

    if (rawStocks.length === 0) {
      rawStocks = [
        { symbol: 'AAPL', close: 150, volume: 1000000, rvol: 5, atr: 0.5, ema9: 148, ema21: 147, vwap: 149, rsi: 60, sectorRank: 2 },
        { symbol: 'TSLA', close: 200, volume: 2000000, rvol: 7, atr: 1.2, ema9: 198, ema21: 195, vwap: 197, rsi: 65, sectorRank: 1 },
        { symbol: 'NVDA', close: 800, volume: 1500000, rvol: 6, atr: 2.5, ema9: 790, ema21: 780, vwap: 785, rsi: 70, sectorRank: 3 },
        { symbol: 'AMD', close: 120, volume: 800000, rvol: 4, atr: 0.8, ema9: 118, ema21: 117, vwap: 119, rsi: 55, sectorRank: 4 },
        { symbol: 'MSFT', close: 350, volume: 1200000, rvol: 5.5, atr: 1.0, ema9: 345, ema21: 340, vwap: 342, rsi: 62, sectorRank: 2 },
      ];
    }

    if (rawStocks.length === 0) {
      return res.status(200).json({
        signals: [],
        meta: { message: 'لا توجد بيانات أسهم متاحة حالياً' },
      });
    }

    // 4. المعالجة والتجميع (بدون temp_id)
    const finalSignals = [];
    const snapshotsBatch = [];
    const predictionsBatch = [];
    const MAX_STOCKS = Math.min(rawStocks.length, 100);

    for (let i = 0; i < MAX_STOCKS; i++) {
      const stock = rawStocks[i];
      try {
        const featureVector = FeatureBuilder.build(stock, marketContext);
        const context = FeatureBuilder.buildContext(marketContext);
        const score = PredictionEngine.calculate(
          featureVector,
          model.weights,
          model.rule_weight,
          model.ai_weight
        );
        const confidence = ConfidenceEngine.calculateBreakdown(featureVector);
        const symbol = stock.symbol || stock.Symbol || 'UNKNOWN';

        snapshotsBatch.push({
          symbol,
          price: featureVector.price,
          feature_vector: featureVector,
          context,
        });

        predictionsBatch.push({
          model_version: model.version,
          predicted_score: score,
          confidence_dist: confidence.breakdown,
        });

        if (score >= 50) {
          finalSignals.push({
            symbol,
            price: featureVector.price,
            predictionScore: parseFloat(score.toFixed(1)),
            confidence: confidence.total,
            grade: getGrade(score),
            brainVersion: model.version,
            timing: stock.timing || 'BREAKOUT',
          });
        }
      } catch (err) {
        console.error(`❌ خطأ في السهم ${stock.symbol || 'unknown'}:`, err.message);
      }
    }

    // 5. حفظ البيانات (Bulk Insert مع ترتيب مضمون)
    if (snapshotsBatch.length > 0) {
      const savedSnapshots = await StorageEngine.saveSnapshotsBulk(snapshotsBatch);

      if (savedSnapshots.length > 0 && predictionsBatch.length > 0) {
        // ✅ الربط بالترتيب (مضمون في Supabase)
        const finalPredictions = savedSnapshots.map((row, index) => ({
          feature_id: row.id,
          model_version: predictionsBatch[index]?.model_version || model.version,
          predicted_score: predictionsBatch[index]?.predicted_score || 0,
          confidence_dist: predictionsBatch[index]?.confidence_dist || {},
        }));

        await StorageEngine.savePredictionsBulk(finalPredictions);
      }
    }

    // 6. الإخراج
    res.status(200).json({
      signals: finalSignals.sort((a, b) => b.predictionScore - a.predictionScore),
      meta: {
        totalScanned: rawStocks.length,
        totalSignals: finalSignals.length,
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        brainVersion: model.version,
        savedSnapshots: snapshotsBatch.length,
      },
    });

  } catch (error) {
    console.error('❌ خطأ عام:', error);
    res.status(500).json({
      error: 'فشل في تشغيل المسح',
      details: error.message,
    });
  }
}

function getGrade(score) {
  if (score >= 85) return 'ELITE';
  if (score >= 75) return 'PRIME';
  if (score >= 65) return 'STRONG';
  if (score >= 55) return 'GOOD';
  return 'WATCH';
}
