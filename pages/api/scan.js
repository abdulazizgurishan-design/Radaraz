// pages/api/scan.js
import { dataProvider } from '../../lib/radar/core/DataProvider';
import { FilterEngine } from '../../lib/radar/core/FilterEngine';
import { SmartTimeframeEngine } from '../../lib/radar/core/SmartTimeframeEngine';
import { IndicatorEngine } from '../../lib/radar/core/IndicatorEngine';
import { FeatureBuilder } from '../../lib/radar/core/FeatureBuilder';
import { PredictionEngine } from '../../lib/radar/services/PredictionEngine';
import { ConfidenceEngine } from '../../lib/radar/services/ConfidenceEngine';
import { StorageEngine } from '../../lib/radar/services/StorageEngine';
import { SCAN_CONFIG } from '../../lib/radar/core/config.js';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is missing.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_MODEL = {
  version: 'v20.1',
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

let currentBatchSize = 20;
let consecutiveRateLimits = 0;

const getAdaptiveBatchSize = () => {
  if (consecutiveRateLimits > 3) {
    currentBatchSize = Math.max(3, currentBatchSize - 2);
  } else if (consecutiveRateLimits === 0 && currentBatchSize < 20) {
    currentBatchSize = Math.min(20, currentBatchSize + 1);
  }
  return currentBatchSize;
};

// ─── processBatch (محسّن للسرعة) ──────────────────────────────
async function processBatch(stocks, marketContext, model) {
  console.log(`🚀 processBatch started with ${stocks.length} stocks`);

  const BATCH_SIZE = getAdaptiveBatchSize();
  const results = [];
  let batchRateLimits = 0;

  for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
    const batch = stocks.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (stock) => {
      try {
        // ✅ 1. جلب Daily Bars (عدد أقل للسرعة)
        console.log(stock.symbol, "1 daily");
        const dailyBars = await dataProvider.getBars(stock.symbol, {
          timeframe: 'day',
          limit: 20,        // ✅ مخفض من 30
          adjusted: true,
          minRequired: 3,   // ✅ مخفض من 15
        });

        // 2. حساب ATR% واختيار الفريم
        console.log(stock.symbol, "2 timeframe");
        let atrPercent = 0;
        if (dailyBars && dailyBars.length >= 14) {
          const atr = IndicatorEngine.calculateATRWilder(dailyBars, 14);
          atrPercent = stock.price > 0 ? (atr / stock.price) * 100 : 0;
        }
        const timeframe = SmartTimeframeEngine.getTimeframe(stock, atrPercent);

        // ✅ 3. جلب Intraday Bars (عدد أقل للسرعة)
        console.log(stock.symbol, "3 bars");
        const bars = await dataProvider.getBars(stock.symbol, {
          timeframe,
          limit: 30,        // ✅ مخفض من 50
          adjusted: true,
          minRequired: 3,   // ✅ مخفض من 10
        });

        // 4. بناء Feature Vector
        console.log(stock.symbol, "4 feature");
        const featureVector = FeatureBuilder.buildFromBars(
          stock,
          bars || [],
          marketContext,
          timeframe,
          dailyBars || []
        );

        // 5. حساب التوقع
        console.log(stock.symbol, "5 score");
        const score = PredictionEngine.calculate(
          featureVector,
          model.weights,
          model.rule_weight,
          model.ai_weight
        );

        console.log(`✅ ${stock.symbol} completed`);
        return {
          stock,
          featureVector,
          score,
          bars,
          timeframe,
          dailyBars,
          atrPercent,
        };
      } catch (err) {
        console.error("=================================");
        console.error("SYMBOL:", stock.symbol);
        console.error("ERROR MESSAGE:", err.message);
        console.error("ERROR STACK:", err.stack);
        console.error("=================================");
        if (err.message?.includes("429")) batchRateLimits++;
        return null;
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
  }

  console.log(`✅ processBatch finished with ${results.length} results out of ${stocks.length}`);

  if (batchRateLimits > 0) {
    consecutiveRateLimits += batchRateLimits;
  } else {
    consecutiveRateLimits = Math.max(0, consecutiveRateLimits - 1);
  }

  return results;
}

// ─── Main Handler ──────────────────────────────────────────────
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
      const real = await dataProvider.getMarketData();
      if (real) {
        marketContext = {
          ...marketContext,
          spy_change: real.spy?.change || 0,
          vix: real.vix?.price || 18,
          regime: real.regime || 'Neutral',
        };
      }
    } catch (e) {
      console.warn('⚠️ Using default market context:', e.message);
    }

    // 2. جلب النموذج النشط
    const { data: modelData } = await supabase
      .from('model_registry')
      .select('version, weights, rule_weight, ai_weight')
      .eq('status', 'CHAMPION')
      .single();

    const model = modelData || DEFAULT_MODEL;

    // 3. جلب القائمة الكاملة من Polygon
    let universe = [];
    try {
      universe = await dataProvider.getUniverse();
      console.log('🔍 [scan.js] Universe length BEFORE filter:', universe.length);
      if (universe.length > 0) {
        console.log('🔍 [scan.js] First stock sample:', JSON.stringify(universe[0], null, 2));
        console.log('🔍 [scan.js] Data quality:', {
          price_gt_zero: universe.filter(s => Number(s.price) > 0).length,
          volume_gt_zero: universe.filter(s => Number(s.volume) > 0).length,
          dollar_gt_zero: universe.filter(s => Number(s.dollar_vol) > 0).length,
        });
      } else {
        console.warn('⚠️ [scan.js] Universe is empty BEFORE filter!');
      }
    } catch (error) {
      console.error('❌ Failed to fetch universe:', error.message);
    }

    if (universe.length === 0) {
      return res.status(200).json({
        signals: [],
        meta: { message: 'لا توجد بيانات من Polygon', totalScanned: 0 },
      });
    }

    // 4. إعداد خيارات الفلترة
    const filterOptions = {
      limit: SCAN_CONFIG.MAX_ANALYSIS_STOCKS || 300,
      minPrice: SCAN_CONFIG.MIN_PRICE || 2,
      minVolume: SCAN_CONFIG.MIN_VOLUME || 200000,
      minDollarVol: SCAN_CONFIG.MIN_DOLLAR_VOL || 1000000,
      maxChangePct: 15,
      minRvol: 1.5,
      maxGapPct: 5,
    };

    console.log('🔍 [scan.js] Filter options:', filterOptions);

    // 5. استدعاء FilterEngine
    let filtered = [];
    try {
      filtered = FilterEngine.filter(universe, filterOptions);
      console.log('🔍 [scan.js] FilterEngine.filter returned:', filtered.length);
    } catch (error) {
      console.error('❌ [scan.js] FilterEngine.filter threw an error:', error.message);
      filtered = [];
    }

    const analysisLimit = SCAN_CONFIG.MAX_ANALYSIS_STOCKS || 300;
    const analysisStocks = filtered.slice(0, analysisLimit);

    console.log(`📊 بعد الفلاتر: ${filtered.length} سهم، سيتم تحليل: ${analysisStocks.length}`);

    if (analysisStocks.length === 0) {
      return res.status(200).json({
        signals: [],
        meta: {
          totalScanned: universe.length,
          totalFiltered: filtered.length,
          message: 'لا توجد أسهم للتحليل',
        },
      });
    }

    // 6. معالجة الدفعات
    const processed = await processBatch(analysisStocks, marketContext, model);

    console.log("🔍 processed.length =", processed.length);

    // 7. بناء الإشارات والحفظ
    const finalSignals = [];
    const snapshotsBatch = [];
    const predictionsBatch = [];
    let totalTimeframes = {};

    for (const item of processed) {
      if (!item) continue;

      const { stock, featureVector, score, timeframe } = item;
      const confidence = ConfidenceEngine.calculateBreakdown(featureVector);
      const symbol = stock.symbol;

      totalTimeframes[timeframe] = (totalTimeframes[timeframe] || 0) + 1;

      snapshotsBatch.push({
        symbol,
        price: featureVector.price,
        feature_vector: featureVector,
        context: FeatureBuilder.buildContext(marketContext),
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
          timing: featureVector.timing || 'BREAKOUT',
          timeframe,
        });
      }
    }

    // 8. حفظ البيانات
    if (snapshotsBatch.length > 0) {
      try {
        const savedSnapshots = await StorageEngine.saveSnapshotsBulk(snapshotsBatch);

        if (savedSnapshots.length > 0 && predictionsBatch.length > 0) {
          const finalPredictions = savedSnapshots.map((row, index) => ({
            feature_id: row.id,
            model_version: predictionsBatch[index]?.model_version || model.version,
            predicted_score: predictionsBatch[index]?.predicted_score || 0,
            confidence_dist: predictionsBatch[index]?.confidence_dist || {},
          }));

          await StorageEngine.savePredictionsBulk(finalPredictions);
        }
      } catch (storageError) {
        console.error('❌ فشل في حفظ البيانات:', storageError);
      }
    }

    // 9. الإخراج
    res.status(200).json({
      signals: finalSignals.sort((a, b) => b.predictionScore - a.predictionScore),
      meta: {
        totalScanned: universe.length,
        totalFiltered: filtered.length,
        totalSignals: finalSignals.length,
        savedSnapshots: snapshotsBatch.length,
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        brainVersion: model.version,
        timeframeBreakdown: totalTimeframes,
        batchSizeUsed: currentBatchSize,
        analysisLimit: analysisLimit,
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
