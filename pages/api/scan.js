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

async function processBatch(stocks, marketContext, model) {
  console.log(`🚀 processBatch started with ${stocks.length} stocks`);

  const BATCH_SIZE = getAdaptiveBatchSize();
  const results = [];
  let batchRateLimits = 0;

  for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
    const batch = stocks.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (stock) => {
      try {
        // 1. Daily Bars — الأساس الموثوق للتحليل.
        // Polygon يُرجع البيانات اليومية بشكل كامل وموثوق (30+ شمعة فوراً)،
        // بعكس الشموع الساعية التي تتعثّر بالصفحات. لذا نعتمد على اليومية.
        const dailyBars = await dataProvider.getBars(stock.symbol, {
          timeframe: 'day',
          limit: 60,          // ~60 يوم تداول: كافٍ لكل المؤشرات (EMA50/RSI/MACD/RVOL20)
          adjusted: true,
          minRequired: 20,    // نحتاج 20+ شمعة لحساب RVOL الحقيقي و EMA بدقة
        });

        // 2. ATR% (من نفس البيانات اليومية)
        let atrPercent = 0;
        if (dailyBars && dailyBars.length >= 14) {
          const atr = IndicatorEngine.calculateATRWilder(dailyBars, 14);
          atrPercent = stock.price > 0 ? (atr / stock.price) * 100 : 0;
        }

        // 3. ✅ التحليل يعتمد على الإطار اليومي الموثوق.
        // (SmartTimeframeEngine كان يختار أطراً ساعية متعثّرة؛ نتجاوزه ونثبّت
        // 'day' لضمان نتائج موثوقة لكل سهم. يمكن إعادة تفعيل الأطر الساعية
        // لاحقاً بعد حل مشكلة جلب الشموع الساعية من Polygon.)
        const timeframe = 'day';
        const bars = dailyBars || [];

        // 4. Feature Vector
        const featureVector = FeatureBuilder.buildFromBars(
          stock,
          bars,
          marketContext,
          timeframe,
          dailyBars || []
        );

        // 5. Prediction Score
        const score = PredictionEngine.calculate(
          featureVector,
          model.weights,
          model.rule_weight,
          model.ai_weight
        );

        // ✅ سجل DEBUG
        console.log(`🔍 [DEBUG] ${stock.symbol}: bars=${bars?.length || 0}, ema9=${featureVector.ema9?.toFixed(2) || 0}, ema21=${featureVector.ema21?.toFixed(2) || 0}, rsi=${featureVector.rsi?.toFixed(1) || 0}, atr=${featureVector.atr?.toFixed(3) || 0}, rvol=${featureVector.rvol?.toFixed(2) || 0}, rvolSrc=${featureVector.rvolSource || '-'}, macd=${featureVector.macd ? '✅' : '❌'}, score=${score.toFixed(1)}`);

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

export default async function handler(req, res) {
  const startTime = Date.now();

  try {
    // 1. Market Context
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

    // 2. Champion Model
    const { data: modelData } = await supabase
      .from('model_registry')
      .select('version, weights, rule_weight, ai_weight')
      .eq('status', 'CHAMPION')
      .single();

    const model = modelData || DEFAULT_MODEL;

    // 3. Universe
    let universe = [];
    try {
      universe = await dataProvider.getUniverse();
      console.log('🔍 [scan.js] Universe length:', universe.length);
    } catch (error) {
      console.error('❌ Failed to fetch universe:', error.message);
    }

    if (universe.length === 0) {
      return res.status(200).json({
        signals: [],
        meta: { message: 'لا توجد بيانات من Polygon', totalScanned: 0 },
      });
    }

    // 4. Filter
    const filterOptions = {
      limit: SCAN_CONFIG.MAX_ANALYSIS_STOCKS || 300,
      minPrice: SCAN_CONFIG.MIN_PRICE || 2,
      minVolume: SCAN_CONFIG.MIN_VOLUME || 200000,
      minDollarVol: SCAN_CONFIG.MIN_DOLLAR_VOL || 1000000,
      maxChangePct: 15,
      // Kept at 0: FilterEngine RVOL relies on universe-level avgVolume which
      // currently equals same-day volume (rvol always 1). Real rvol is computed
      // in FeatureBuilder from daily bars and feeds the score.
      minRvol: 0,
      maxGapPct: 5,
    };

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

    // 5. Process
    const processed = await processBatch(analysisStocks, marketContext, model);
    console.log("🔍 processed.length =", processed.length);

    // 6. Build signals
    const finalSignals = [];
    const snapshotsBatch = [];
    const predictionsBatch = [];
    let totalTimeframes = {};

    for (const item of processed) {
      if (!item) continue;

      const { stock, featureVector: fv, score, timeframe } = item;
      const confidence = ConfidenceEngine.calculateBreakdown(fv);
      const symbol = stock.symbol;

      totalTimeframes[timeframe] = (totalTimeframes[timeframe] || 0) + 1;

      snapshotsBatch.push({
        symbol,
        price: fv.price,
        feature_vector: fv,
        context: FeatureBuilder.buildContext(marketContext),
      });

      predictionsBatch.push({
        model_version: model.version,
        predicted_score: score,
        confidence_dist: confidence.breakdown,
      });

      // ✅ عتبة مخفضة إلى 30 مؤقتاً للتشخيص (تُطابق DISPLAY_MIN_SCORE في الواجهة)
      if (score >= 30) {
        const price = fv.price || 0;
        const pct = (target) =>
          (price > 0 && target != null) ? ((target - price) / price) * 100 : 0;

        // ─── levels: الأهداف/الوقف (محسوبة أصلاً من ATR داخل FeatureBuilder) ───
        // الواجهة تقرأ levels.t1/t2/t3/sl مع النسب المئوية.
        const levels = {
          t1: fv.target1, t1Pct: parseFloat(pct(fv.target1).toFixed(1)),
          t2: fv.target2, t2Pct: parseFloat(pct(fv.target2).toFixed(1)),
          t3: fv.target3, t3Pct: parseFloat(pct(fv.target3).toFixed(1)),
          sl: fv.stop,    slPct: parseFloat(pct(fv.stop).toFixed(1)),
          risk: fv.riskReward,
        };

        // ─── structure: خريطة مبسطة تقرأها StructureMap في الواجهة ───
        const structure = {
          support: fv.stop,
          entry: fv.entry,
          confirm: fv.resistance || price,
          resistance: fv.resistance,
          t1: fv.target1,
          t2: fv.target2,
          t3: fv.target3,
          stop: fv.stop,
          rr: fv.riskReward,
          trend: fv.ema9 > fv.ema21 ? 'صاعد مؤكد ✅' : 'ينتظر تأكيد ⏳',
        };

        // ─── حالة الدخول ───
        // اختراق مؤكد = ملاحقة (لا تدخل الآن)؛ قرب المقاومة = داخل المنطقة؛
        // غير ذلك = انتظر ارتداداً لمنطقة الدخول.
        let entry_state = null;
        let wait_price = null;
        if (fv.breakout) {
          entry_state = 'chasing';
        } else if (fv.nearResistance) {
          entry_state = 'in_zone';
        } else {
          entry_state = 'wait_pullback';
          wait_price = fv.entry;
        }

        finalSignals.push({
          symbol,
          price: parseFloat(price.toFixed(2)),
          change_pct: parseFloat((fv.change_pct || 0).toFixed(2)),
          // نرسل score و predictionScore معاً لتوافق الواجهة القديمة والجديدة
          score: parseFloat(score.toFixed(1)),
          predictionScore: parseFloat(score.toFixed(1)),
          confidence: confidence.total,
          predictionGrade: getGrade(score),
          grade: getGrade(score),
          brainVersion: model.version,
          timing: fv.timing || 'BREAKOUT',
          timeframe,

          // ─── مؤشرات البطاقة (تبويب المؤشرات) ───
          rsi: fv.rsi != null ? parseFloat(fv.rsi.toFixed(1)) : null,
          rvol: fv.rvol != null ? parseFloat(fv.rvol.toFixed(2)) : null,
          atr14: fv.atr != null ? parseFloat(fv.atr.toFixed(2)) : null,
          volume: fv.volume || 0,
          ma_signal: fv.ema9 > fv.ema21 ? '🟡 تقاطع ذهبي' : null,

          // ─── المستويات والبنية ───
          levels,
          structure,
          entry_state,
          wait_price,

          // ─── شارات ───
          breakout: fv.breakout || false,
          preBreakout: fv.nearResistance || false,
          aboveVWAP: fv.aboveVWAP || false,

          type: 'مضاربة',
        });
      }
    }

    // 7. Save
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

    // 8. Response
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
