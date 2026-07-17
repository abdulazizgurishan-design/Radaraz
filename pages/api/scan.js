// pages/api/scan.js
import { DataProvider } from '../../../lib/radar/core/DataProvider';
import { BrainManager } from '../../../lib/radar/core/BrainManager';
import { FeatureBuilder } from '../../../lib/radar/core/FeatureBuilder';
import { PredictionEngine } from '../../../lib/radar/services/PredictionEngine';
import { ConfidenceEngine } from '../../../lib/radar/services/ConfidenceEngine';
import { StorageEngine } from '../../../lib/radar/services/StorageEngine';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const startTime = Date.now();

  // ==============================================
  // 1. جلب سياق السوق (World Model)
  // ==============================================
  let marketContext;
  try {
    marketContext = await DataProvider.fetchMarketContext();
  } catch (error) {
    console.error('❌ خطأ في جلب سياق السوق:', error);
    return res.status(500).json({ error: 'فشل في جلب بيانات السوق' });
  }

  // ==============================================
  // 2. حكم السوق (لا تتداول)
  // ==============================================
  const verdict = evaluateMarket(marketContext);
  if (!verdict.allowTrading) {
    return res.status(200).json({
      signals: [],
      marketVerdict: verdict,
      message: verdict.reason
    });
  }

  // ==============================================
  // 3. جلب النموذج النشط (Champion)
  // ==============================================
  const { data: activeModel, error: modelError } = await supabase
    .from('model_registry')
    .select('version, weights, rule_weight, ai_weight')
    .eq('status', 'CHAMPION')
    .single();

  if (modelError || !activeModel) {
    console.warn('⚠️ لا يوجد نموذج Champion، سيتم استخدام الإعدادات الافتراضية');
  }

  const model = activeModel || {
    version: 'v19.8',
    weights: { earlyAccumulation: 0.30, breakoutProbability: 0.25, structure: 0.20, liquidity: 0.15, marketRegime: 0.10 },
    rule_weight: 0.6,
    ai_weight: 0.4
  };

  // ==============================================
  // 4. جلب قائمة الأسهم المرشحة (المسح الأولي)
  // ==============================================
  // ملاحظة: هذه الدالة تعيد قائمة بالرموز التي تتجاوز الحد الأدنى للسيولة والسعر
  let stockSymbols;
  try {
    stockSymbols = await DataProvider.getScreenerSymbols(); 
    // مثال: تعيد ['AAPL', 'TSLA', 'NVDA', ...] (أول 500 سهم حسب السيولة)
  } catch (error) {
    console.error('❌ خطأ في جلب قائمة الأسهم:', error);
    return res.status(500).json({ error: 'فشل في جلب قائمة الأسهم' });
  }

  // ==============================================
  // 5. المعالجة المتوازية عبر BrainManager
  // ==============================================
  const MAX_STOCKS = 150; // للحفاظ على سرعة الاستجابة (4-6 ثوانٍ)
  const symbolsToProcess = stockSymbols.slice(0, MAX_STOCKS);

  const finalSignals = [];
  const savePromises = [];

  // نقوم بمعالجة الأسهم بشكل متوازي (BrainManager يتولى الـ Parallel Execution داخلياً)
  for (const symbol of symbolsToProcess) {
    try {
      // 5.1 جلب بيانات الشموع (Bars) للسهم
      const bars = await DataProvider.getBars(symbol, '5min', 50); // آخر 50 شمعة

      if (!bars || bars.length < 20) {
        continue; // بيانات غير كافية، نتجاوز هذا السهم
      }

      // 5.2 تشغيل جميع الـ Brains الـ 15 بالتوازي
      // BrainManager سيعيد كائن يحتوي على مخرجات كل Brain
      const brainResults = await BrainManager.executeAllBrains(symbol, bars, marketContext);

      // 5.3 بناء Feature Vector الموحد من مخرجات الـ Brains
      const featureVector = FeatureBuilder.buildFromBrains(brainResults, marketContext);
      const context = FeatureBuilder.buildContext(marketContext);

      // 5.4 حساب Prediction Score باستخدام الأوزان المتعلمة
      const predictionScore = PredictionEngine.calculate(
        featureVector,
        model.weights,
        model.rule_weight,
        model.ai_weight
      );

      // 5.5 حساب توزيع الثقة (Confidence Breakdown)
      const confidence = ConfidenceEngine.calculateBreakdown(featureVector);

      // 5.6 حفظ اللقطة في Feature Store (غير متزامن)
      const featureId = await StorageEngine.saveSnapshot(
        symbol,
        featureVector.price,
        featureVector,
        context
      );

      // 5.7 حفظ نتيجة التوقع في prediction_results
      if (featureId) {
        await StorageEngine.savePrediction(
          featureId,
          model.version,
          predictionScore,
          confidence.breakdown
        );
      }

      // 5.8 تجهيز الإشارات القوية للمستخدم (فقط إذا تجاوزت الحد الأدنى)
      if (predictionScore >= 50) {
        finalSignals.push({
          symbol: symbol,
          price: featureVector.price,
          predictionScore: parseFloat(predictionScore.toFixed(1)),
          confidence: confidence.total,
          confidenceBreakdown: confidence.breakdown,
          grade: getGrade(predictionScore),
          brainVersion: model.version,
          timing: brainResults.structure?.timing || 'BREAKOUT',
          // معلومات إضافية للـ Memory Replay
          rvol: featureVector.rvol,
          sector: featureVector.sector_name,
          marketRegime: marketContext.regime
        });
      }

    } catch (err) {
      console.error(`❌ خطأ في معالجة السهم ${symbol}:`, err.message);
      // نكمل مع بقية الأسهم
    }
  }

  // ==============================================
  // 6. الإخراج النهائي
  // ==============================================
  res.status(200).json({
    signals: finalSignals.sort((a, b) => b.predictionScore - a.predictionScore),
    meta: {
      totalScanned: symbolsToProcess.length,
      totalSignals: finalSignals.length,
      executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      brainVersion: model.version,
      marketVerdict: verdict,
      confidenceAvg: finalSignals.reduce((acc, s) => acc + s.confidence, 0) / (finalSignals.length || 1)
    }
  });
}

// ==============================================
// دوال مساعدة
// ==============================================

function evaluateMarket(context) {
  const { regime, vix, spy_change } = context;

  if (regime === 'Bear' && vix > 25) {
    return {
      allowTrading: false,
      reason: `⚠️ سوق دببة مع VIX مرتفع (${vix.toFixed(1)})، انتظر الاستقرار.`,
      regime,
      vix,
      spy_change
    };
  }

  if (spy_change < -2) {
    return {
      allowTrading: false,
      reason: `⚠️ SPY يهبط بشدة (${spy_change.toFixed(2)}%)، التداول غير آمن.`,
      regime,
      vix,
      spy_change
    };
  }

  return {
    allowTrading: true,
    reason: 'ظروف السوق مناسبة للتداول.',
    regime,
    vix,
    spy_change
  };
}

function getGrade(score) {
  if (score >= 85) return 'ELITE';
  if (score >= 75) return 'PRIME';
  if (score >= 65) return 'STRONG';
  if (score >= 55) return 'GOOD';
  return 'WATCH';
}
