// pages/api/scan.js
import { dataProvider } from '../../lib/radar/core/DataProvider';
import { analyzeNewsBatch } from '../../lib/radar/services/NewsEngine';
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

// عتبة عرض التوصيات الجاهزة (تُطابق DISPLAY_MIN_SCORE في الواجهة).
const DISPLAY_MIN_SCORE = 43;

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
        const dailyBars = await dataProvider.getBars(stock.symbol, {
          timeframe: 'day',
          limit: 60,
          adjusted: true,
          minRequired: 20,
        });

        let atrPercent = 0;
        if (dailyBars && dailyBars.length >= 14) {
          const atr = IndicatorEngine.calculateATRWilder(dailyBars, 14);
          atrPercent = stock.price > 0 ? (atr / stock.price) * 100 : 0;
        }

        const timeframe = 'day';
        const bars = dailyBars || [];

        const featureVector = FeatureBuilder.buildFromBars(
          stock,
          bars,
          marketContext,
          timeframe,
          dailyBars || []
        );

        const score = PredictionEngine.calculate(
          featureVector,
          model.weights,
          model.rule_weight,
          model.ai_weight
        );

        console.log(`🔍 [DEBUG] ${stock.symbol}: bars=${bars?.length || 0}, ema9=${featureVector.ema9?.toFixed(2) || 0}, ema21=${featureVector.ema21?.toFixed(2) || 0}, rsi=${featureVector.rsi?.toFixed(1) || 0}, atr=${featureVector.atr?.toFixed(3) || 0}, rvol=${featureVector.rvol?.toFixed(2) || 0}, rvolSrc=${featureVector.rvolSource || '-'}, macd=${featureVector.macd ? '✅' : '❌'}, score=${score.toFixed(1)}`);

        return { stock, featureVector, score, bars, timeframe, dailyBars, atrPercent };
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
      if (result.status === 'fulfilled' && result.value) results.push(result.value);
    }
  }

  console.log(`✅ processBatch finished with ${results.length} results out of ${stocks.length}`);

  if (batchRateLimits > 0) consecutiveRateLimits += batchRateLimits;
  else consecutiveRateLimits = Math.max(0, consecutiveRateLimits - 1);

  return results;
}

// ─────────────────────────────────────────────────────────
// بناء كائن الإشارة الكامل (مشترك بين التوصيات الجاهزة والاختراقات).
// ─────────────────────────────────────────────────────────
function buildSignalObject(item, score, confidence, setup) {
  const { stock, featureVector: fv, timeframe } = item;
  const symbol = stock.symbol;
  const price = fv.price || 0;
  const pct = (target) =>
    (price > 0 && target != null) ? ((target - price) / price) * 100 : 0;

  const levels = {
    t1: fv.target1, t1Pct: parseFloat(pct(fv.target1).toFixed(1)),
    t2: fv.target2, t2Pct: parseFloat(pct(fv.target2).toFixed(1)),
    t3: fv.target3, t3Pct: parseFloat(pct(fv.target3).toFixed(1)),
    sl: fv.stop,    slPct: parseFloat(pct(fv.stop).toFixed(1)),
    risk: fv.riskReward,
  };

  const structure = {
    support: fv.support ?? fv.stop,
    entry: fv.entry,
    entry_low: fv.entry_low,
    entry_high: fv.entry_high,
    entry_zone: fv.entry_zone,
    entry_type: fv.entry_type,
    confirm: fv.resistance || price,
    resistance: fv.resistance,
    t1: fv.target1,
    t2: fv.target2,
    t3: fv.target3,
    stop: fv.stop,
    rr: fv.riskReward,
    trend: fv.ema9 > fv.ema21 ? 'صاعد مؤكد ✅' : 'ينتظر تأكيد ⏳',
  };

  // حالة الدخول التفصيلية (تُبقى للتوافق مع الواجهة القديمة).
  let entry_state = null;
  let wait_price = null;
  if (fv.breakout) {
    entry_state = 'chasing';
  } else if (fv.nearResistance) {
    entry_state = 'in_zone';
  } else {
    entry_state = 'wait_pullback';
    wait_price = fv.entry_low ?? fv.entry;
  }

  return {
    symbol,
    price: parseFloat(price.toFixed(2)),
    change_pct: parseFloat((fv.change_pct || 0).toFixed(2)),
    score: parseFloat(score.toFixed(1)),
    predictionScore: parseFloat(score.toFixed(1)),
    confidence: confidence.total,
    predictionGrade: getGrade(score),
    grade: getGrade(score),
    brainVersion: item.brainVersion,
    timing: fv.timing || 'BREAKOUT',
    timeframe,

    // ─── مرحلة الإعداد (التنبؤ الاستباقي) ───
    setup_stage: setup.stage,      // pre_breakout | approaching | pullback | building | breakout | extended
    setup_label: setup.label,
    actionable: setup.actionable,  // true = توصية جاهزة | false = فات الدخول (اختراق/ممتد)

    rsi: fv.rsi != null ? parseFloat(fv.rsi.toFixed(1)) : null,
    rvol: fv.rvol != null ? parseFloat(fv.rvol.toFixed(2)) : null,
    atr14: fv.atr != null ? parseFloat(fv.atr.toFixed(2)) : null,
    volume: fv.volume || 0,
    ma_signal: fv.ema9 > fv.ema21 ? '🟡 تقاطع ذهبي' : null,

    levels,
    structure,
    entry_state,
    wait_price,

    entry_low: fv.entry_low,
    entry_high: fv.entry_high,
    entry_zone: fv.entry_zone,
    entry_type: fv.entry_type,
    support: fv.support ?? fv.stop,
    resistance: fv.resistance,

    breakout: fv.breakout || false,
    preBreakout: fv.nearResistance || false,
    aboveVWAP: fv.aboveVWAP || false,

    type: 'مضاربة',
  };
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
        breakouts: [],
        movers: { gainers: [], losers: [], volume: [], value: [] },
        meta: { message: 'لا توجد بيانات من Polygon', totalScanned: 0 },
      });
    }

    const movers = buildMovers(universe);

    // 4. Filter
    const filterOptions = {
      limit: SCAN_CONFIG.MAX_ANALYSIS_STOCKS || 300,
      minPrice: SCAN_CONFIG.MIN_PRICE || 2,
      minVolume: SCAN_CONFIG.MIN_VOLUME || 200000,
      minDollarVol: SCAN_CONFIG.MIN_DOLLAR_VOL || 1000000,
      maxChangePct: 15,
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
        breakouts: [],
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

    // 6. Build signals — قسمان: توصيات جاهزة (actionable) واختراقات جارية.
    const readySignals = [];     // ← data.signals (الأساسي)
    const breakoutSignals = [];  // ← data.breakouts (اختراقات جارية / تنبيه)
    const snapshotsBatch = [];
    const predictionsBatch = [];
    let totalTimeframes = {};
    let structureSkipped = 0;

    for (const item of processed) {
      if (!item) continue;

      const { stock, featureVector: fv, score, timeframe } = item;
      item.brainVersion = model.version;
      const confidence = ConfidenceEngine.calculateBreakdown(fv);
      const symbol = stock.symbol;

      totalTimeframes[timeframe] = (totalTimeframes[timeframe] || 0) + 1;

      // الـ snapshot يُحفظ لكل سهم (خام، للتعلّم) ويحمل structureValid + scan_type.
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

      // ─── حارس البنية (يطبّق على القسمين معاً) ───
      if (fv.structureValid === false) {
        structureSkipped++;
        console.warn(
          `⚠️ [STRUCT] ${symbol} skipped: inconsistent levels ` +
          `(price=${fv.price}, entry=${fv.entry}, support=${fv.support}, ` +
          `resistance=${fv.resistance}, stop=${fv.stop}, t1=${fv.target1})`
        );
        continue;
      }

      // ─── تصنيف مرحلة الإعداد (استباقي مقابل مطاردة) ───
      const setup = PredictionEngine.classifySetup(fv);

      const isReady = setup.actionable && score >= DISPLAY_MIN_SCORE; // توصية جاهزة
      const isBreakout = setup.stage === 'breakout';                  // اختراق جارٍ

      // extended أو ضعيف غير قابل للدخول → snapshot فقط، لا يُعرض.
      if (!isReady && !isBreakout) continue;

      const signalObj = buildSignalObject(item, score, confidence, setup);

      if (isReady) readySignals.push(signalObj);
      else breakoutSignals.push(signalObj);
    }

    if (structureSkipped > 0) {
      console.log(`🛡️ [STRUCT] استُبعدت ${structureSkipped} إشارة لعدم اتساق البنية (محفوظة في snapshots).`);
    }
    console.log(`🎯 توصيات جاهزة: ${readySignals.length} | اختراقات جارية: ${breakoutSignals.length}`);

    // 7.b ─── إثراء التوصيات الجاهزة بتحليل الأخبار (Polygon sentiment) ───
    // مقتصد: نجلب الأخبار للمرشّحين فقط (لا كل الـuniverse). معزول: فشله لا يكسر المسح.
    // الأثر: خبر إيجابي حديث يعزّز الدرجة (+15%)، سلبي يخفضها (-30%)، محايد/قديم بلا أثر.
    try {
      const NEWS_ENABLED = process.env.NEWS_ENABLED !== 'false'; // مفعّل افتراضياً؛ لإطفائه: NEWS_ENABLED=false
      if (NEWS_ENABLED && readySignals.length > 0) {
        const symbols = readySignals.map((s) => s.symbol).slice(0, 40); // سقف أمان للنداءات
        const newsMap = await analyzeNewsBatch(symbols, 5);
        for (const sig of readySignals) {
          const nw = newsMap[sig.symbol];
          if (!nw || !nw.available) continue;
          // خزّن حقول الأخبار للعرض
          sig.news_sentiment = nw.sentiment;      // positive | negative | neutral
          sig.news_fresh = nw.fresh;
          sig.news_age_h = nw.age_h;
          sig.news_headline = nw.headline;
          // طبّق عامل الدرجة (مع إبقاء الأصل للمقارنة)
          if (nw.score_factor && nw.score_factor !== 1.0) {
            sig.score_before_news = sig.predictionScore;
            sig.predictionScore = Math.round(Math.min(100, Math.max(0, sig.predictionScore * nw.score_factor)));
            sig.score = sig.predictionScore;
          }
        }
        // أعد ترتيب التوصيات بعد تأثير الأخبار
        readySignals.sort((a, b) => b.predictionScore - a.predictionScore);
        const boosted = readySignals.filter((s) => s.news_sentiment === 'positive' && s.news_fresh).length;
        const flagged = readySignals.filter((s) => s.news_sentiment === 'negative' && s.news_fresh).length;
        console.log(`📰 أخبار: ${boosted} معزّزة (إيجابي) · ${flagged} مخفّضة (سلبي)`);
      }
    } catch (newsErr) {
      console.error('❌ فشل إثراء الأخبار (غير حرج):', newsErr.message);
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

    // 7.b ─── كتابة طبقة العرض (latest_signals) — استبدال ذرّي + تنظيف تلقائي ───
    // معزولة تماماً: فشلها لا يُسقط المسح ولا يؤثّر على feature_store (بيانات التعلّم).
    try {
      const batchId = new Date().toISOString(); // طابع الدفعة
      await StorageEngine.saveLatestSignalsBulk(readySignals, 'main', 'ready', batchId);
      await StorageEngine.saveLatestSignalsBulk(breakoutSignals, 'main', 'breakout', batchId);
      await StorageEngine.saveLatestMovers(movers, 'main', batchId);
      await StorageEngine.pruneOldBatches('main', 3); // يُبقي أحدث 3 دُفعات
      console.log(`🗂️ latest_signals[main] batch=${batchId} ready=${readySignals.length} breakout=${breakoutSignals.length}`);
    } catch (lsError) {
      console.error('❌ فشل كتابة latest_signals (غير حرج):', lsError.message);
    }

    // 7.c ─── كتابة جدول الأدمن القديم (signals) — يقرأه /api/summary والتقارير ───
    // معزولة تماماً: فشلها لا يؤثّر على المشترك ولا على feature_store.
    // 🆕 v20.5: نحفظ التوصيات الجاهزة فقط. الاختراقات (breakout) أثبتت بالأرقام
    //   أنها تخسر دائماً (صفر رابحة من 10، عائد -5.5%)، فلا نحفظها كتوصيات مُقيّمة
    //   ولا نعرضها في الأداء. تبقى في latest_signals كتنبيه «اختراقات جارية» فقط.
    try {
      await StorageEngine.saveSignalsForAdmin(readySignals, { isHot: false });
      // (لم نعد نحفظ breakoutSignals — أثبتت خسارتها المستمرة)
    } catch (adminErr) {
      console.error('❌ فشل كتابة signals للأدمن (غير حرج):', adminErr.message);
    }

    // 8. Response
    // وضع خفيف للكرون (?light=1): لا نُرجّع الإشارات الكاملة (الكرون لا يحتاجها،
    // والواجهة تقرأ من /api/signals) — يتفادى حدّ حجم الرد في cron-job.org.
    const meta8 = {
        totalScanned: universe.length,
        totalFiltered: filtered.length,
        totalSignals: readySignals.length,
        totalBreakouts: breakoutSignals.length,
        structureSkipped,
        savedSnapshots: snapshotsBatch.length,
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        brainVersion: model.version,
        timeframeBreakdown: totalTimeframes,
        batchSizeUsed: currentBatchSize,
        analysisLimit: analysisLimit,
    };

    if (req.query && (req.query.light === '1' || req.query.light === 'true')) {
      return res.status(200).json({ ok: true, meta: meta8 });
    }

    // ── توافق مع صفحة الأدمن: تتوقّع success/total/hot/saved ──
    const isAdmin = req.headers && req.headers['x-admin-scan'] === 'true';
    if (isAdmin) {
      return res.status(200).json({
        success: true,
        total: readySignals.length + breakoutSignals.length,
        hot: breakoutSignals.length,
        saved: meta8.savedSnapshots || 0,
        signals: readySignals.sort((a, b) => b.predictionScore - a.predictionScore),
        breakouts: breakoutSignals.sort((a, b) => b.change_pct - a.change_pct),
        movers,
        meta: meta8,
      });
    }

    res.status(200).json({
      signals: readySignals.sort((a, b) => b.predictionScore - a.predictionScore),
      breakouts: breakoutSignals.sort((a, b) => b.change_pct - a.change_pct),
      movers,
      meta: meta8,
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

function buildMovers(universe) {
  const valid = (universe || []).filter(s => s && s.symbol && s.price > 0 && s.volume > 0)
    .map(s => ({
      symbol: s.symbol,
      price: s.price,
      change_pct: s.change_pct || 0,
      volume: s.volume || 0,
      dollar_vol: s.dollar_vol != null ? s.dollar_vol : (s.price * s.volume),
    }));

  const byChange = [...valid].sort((a, b) => b.change_pct - a.change_pct);
  const byVolume = [...valid].sort((a, b) => b.volume - a.volume);
  const byValue  = [...valid].sort((a, b) => b.dollar_vol - a.dollar_vol);

  return {
    gainers: byChange.slice(0, 20),
    losers:  byChange.slice(-20).reverse(),
    volume:  byVolume.slice(0, 20),
    value:   byValue.slice(0, 20),
  };
}
