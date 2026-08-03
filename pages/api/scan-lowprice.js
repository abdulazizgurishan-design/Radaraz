// pages/api/scan-lowprice.js
// ============================================================
// RadarAZ — قسم الأسهم منخفضة السعر (0.20$ – 10$) — مسار مستقل.
// v20.3: نفس دماغ الرادار الرئيسي (التنبؤ الاستباقي + فصل توصيات/اختراقات)،
// بفلاتر سعر/سيولة صارمة، وكتابة طبقة عرض latest_signals (scan_type='lowprice').
// المسح للكرون فقط (حارس CRON_SECRET) — المشترك يقرأ عبر /api/signals?type=lowprice.
// ============================================================

import { dataProvider } from '../../lib/radar/core/DataProvider';
import { filterByMarketCap } from '../../lib/radar/services/MarketCapEngine';
import { FilterEngine } from '../../lib/radar/core/FilterEngine';
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

const LOWPRICE_CONFIG = {
  MIN_PRICE: 0.20,
  MAX_PRICE: 10.00,
  SUB_DOLLAR_THRESHOLD: 1.0,
  MIN_VOLUME: 1_000_000,
  MIN_DOLLAR_VOL: 3_000_000,   // ← شدّها/خفّفها من هنا
  MAX_CHANGE_PCT: 30,
  MAX_GAP_PCT: 15,
  MAX_ANALYSIS_STOCKS: SCAN_CONFIG.MAX_ANALYSIS_STOCKS || 300,
  DISPLAY_MIN_SCORE: 43,   // v20.6: رُفع من 30 مع تطبيع السكور (÷0.7 ≈ ×1.43)
  // 🆕 v20.5: نطاق القيمة السوقية — استهداف الأسهم الصغيرة النامية (مايكرو-كاب).
  // قابل للضبط: وسّعه إن مرّت أسهم قليلة جداً. اجعل ENABLE_MCAP=false لتعطيله.
  ENABLE_MCAP: true,
  MIN_MARKET_CAP: 10_000_000,   // 10 مليون
  MAX_MARKET_CAP: 50_000_000,   // 50 مليون
  // 🆕 v20.5: بوابة «الفرصة الحيّة» — تلتقط بداية الحركة قبل انتهائها.
  // المنطق: سيولة نسبية كافية + حجم يستيقظ (لا ينفجر) + لم يرتفع بعد.
  ENABLE_LIVE_GATE: true,
  TURNOVER_MIN: 0.20,        // نسبة الدوران: التداول اليومي ≥ 20% من القيمة السوقية (لا سهم ميت)
  RVOL_WAKE_MIN: 1.0,        // الحجم بدأ يفوق معدّله (بداية اهتمام في المايكرو-كاب)
  RVOL_WAKE_MAX: 5.0,        // لا ينفجر (فوقه = فات الأوان)
  CHANGE_MIN: -2,            // لم ينهَر
  CHANGE_MAX: 8,             // لم ينفجر (فوقه = الفرصة انتهت)
};

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
  if (consecutiveRateLimits > 3) currentBatchSize = Math.max(3, currentBatchSize - 2);
  else if (consecutiveRateLimits === 0 && currentBatchSize < 20) currentBatchSize = Math.min(20, currentBatchSize + 1);
  return currentBatchSize;
};

async function processBatch(stocks, marketContext, model) {
  console.log(`🚀 [lowprice] processBatch started with ${stocks.length} stocks`);
  const BATCH_SIZE = getAdaptiveBatchSize();
  const results = [];
  let batchRateLimits = 0;

  for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
    const batch = stocks.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (stock) => {
      try {
        const dailyBars = await dataProvider.getBars(stock.symbol, {
          timeframe: 'day', limit: 60, adjusted: true, minRequired: 20,
        });
        let atrPercent = 0;
        if (dailyBars && dailyBars.length >= 14) {
          const atr = IndicatorEngine.calculateATRWilder(dailyBars, 14);
          atrPercent = stock.price > 0 ? (atr / stock.price) * 100 : 0;
        }
        const timeframe = 'day';
        const bars = dailyBars || [];
        const featureVector = FeatureBuilder.buildFromBars(stock, bars, marketContext, timeframe, dailyBars || []);
        const score = PredictionEngine.calculate(featureVector, model.weights, model.rule_weight, model.ai_weight);
        return { stock, featureVector, score, bars, timeframe, dailyBars, atrPercent };
      } catch (err) {
        console.error("[lowprice] SYMBOL:", stock.symbol, "ERR:", err.message);
        if (err.message?.includes("429")) batchRateLimits++;
        return null;
      }
    });
    const batchResults = await Promise.allSettled(batchPromises);
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) results.push(result.value);
    }
  }

  console.log(`✅ [lowprice] processBatch finished with ${results.length}/${stocks.length}`);
  if (batchRateLimits > 0) consecutiveRateLimits += batchRateLimits;
  else consecutiveRateLimits = Math.max(0, consecutiveRateLimits - 1);
  return results;
}

// كائن الإشارة الكامل + خصائص القسم منخفض السعر.
function buildSignalObject(item, score, confidence, setup) {
  const { stock, featureVector: fv, timeframe } = item;
  const symbol = stock.symbol;
  const price = fv.price || 0;
  const pct = (t) => (price > 0 && t != null) ? ((t - price) / price) * 100 : 0;
  const isSubDollar = price < LOWPRICE_CONFIG.SUB_DOLLAR_THRESHOLD;
  const dollarVol = stock.dollar_vol != null ? stock.dollar_vol : (price * (fv.volume || 0));

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
    t1: fv.target1, t2: fv.target2, t3: fv.target3,
    stop: fv.stop, rr: fv.riskReward,
    trend: fv.ema9 > fv.ema21 ? 'صاعد مؤكد ✅' : 'ينتظر تأكيد ⏳',
  };

  let entry_state = null, wait_price = null;
  if (fv.breakout) entry_state = 'chasing';
  else if (fv.nearResistance) entry_state = 'in_zone';
  else { entry_state = 'wait_pullback'; wait_price = fv.entry_low ?? fv.entry; }

  return {
    symbol,
    price: parseFloat(price.toFixed(4)),
    change_pct: parseFloat((fv.change_pct || 0).toFixed(2)),
    score: parseFloat(score.toFixed(1)),
    predictionScore: parseFloat(score.toFixed(1)),
    confidence: confidence.total,
    predictionGrade: getGrade(score),
    grade: getGrade(score),
    brainVersion: item.brainVersion,
    timing: fv.timing || 'BREAKOUT',
    timeframe,

    setup_stage: setup.stage,
    setup_label: setup.label,
    actionable: setup.actionable,

    rsi: fv.rsi != null ? parseFloat(fv.rsi.toFixed(1)) : null,
    rvol: fv.rvol != null ? parseFloat(fv.rvol.toFixed(2)) : null,
    atr14: fv.atr != null ? parseFloat(fv.atr.toFixed(3)) : null,
    volume: fv.volume || 0,
    dollar_vol: Math.round(dollarVol),
    ma_signal: fv.ema9 > fv.ema21 ? '🟡 تقاطع ذهبي' : null,

    levels, structure, entry_state, wait_price,
    entry_low: fv.entry_low, entry_high: fv.entry_high,
    entry_zone: fv.entry_zone, entry_type: fv.entry_type,
    support: fv.support ?? fv.stop, resistance: fv.resistance,
    breakout: fv.breakout || false,
    preBreakout: fv.nearResistance || false,
    aboveVWAP: fv.aboveVWAP || false,

    // خصائص القسم منخفض السعر
    scan_type: 'lowprice',
    price_tier: isSubDollar ? 'sub_dollar' : 'low',
    sub_dollar: isSubDollar,
    market_cap: stock.market_cap != null ? Math.round(stock.market_cap) : null,
    market_cap_m: stock.market_cap != null ? Math.round(stock.market_cap / 1e6) : null, // بالمليون للعرض
    risk_warning: isSubDollar
      ? '⚠️ سهم دون 1$ ومايكرو-كاب: تقلب وسبريد مرتفعان، سيولة قد تكون وهمية، واحتمال تلاعب. حجم صغير جداً وإدارة مخاطر صارمة.'
      : '⚠️ سهم مايكرو-كاب صغير: تقلب عالٍ واحتمال تلاعب. للمضاربة الواعية فقط بحجم صغير.',

    type: 'مضاربة',
  };
}

export default async function handler(req, res) {
  const startTime = Date.now();

  try {
    // Market Context
    let marketContext = {
      spy_change: 0, vix: 18, regime: 'Neutral',
      hour: new Date().getHours(), day_of_week_index: new Date().getDay(),
      volatility_regime: 'Normal', liquidity_regime: 'Normal',
      fed_regime: 'Neutral', risk_appetite: 'Neutral', top_sector: 'Unknown',
    };
    try {
      const real = await dataProvider.getMarketData();
      if (real) {
        marketContext = { ...marketContext, spy_change: real.spy?.change || 0, vix: real.vix?.price || 18, regime: real.regime || 'Neutral' };
      }
    } catch (e) {
      console.warn('⚠️ [lowprice] default market context:', e.message);
    }

    // Champion Model
    const { data: modelData } = await supabase
      .from('model_registry')
      .select('version, weights, rule_weight, ai_weight')
      .eq('status', 'CHAMPION')
      .single();
    const model = modelData || DEFAULT_MODEL;

    // Universe
    let universe = [];
    try {
      universe = await dataProvider.getUniverse();
      console.log('🔍 [lowprice] Universe length:', universe.length);
    } catch (error) {
      console.error('❌ [lowprice] fetch universe:', error.message);
    }

    if (universe.length === 0) {
      return res.status(200).json({
        signals: [], breakouts: [],
        movers: { gainers: [], losers: [], volume: [], value: [] },
        meta: { message: 'لا توجد بيانات من Polygon', totalScanned: 0, scan_type: 'lowprice' },
      });
    }

    // الحدّ السعري المزدوج [0.20, 10]
    const bandUniverse = universe.filter(s =>
      s && Number(s.price) >= LOWPRICE_CONFIG.MIN_PRICE && Number(s.price) <= LOWPRICE_CONFIG.MAX_PRICE
    );
    console.log(`🎯 [lowprice] ضمن النطاق:`, bandUniverse.length);
    const movers = buildMovers(bandUniverse);

    if (bandUniverse.length === 0) {
      return res.status(200).json({
        signals: [], breakouts: [], movers,
        meta: { totalScanned: universe.length, totalInBand: 0, message: 'لا أسهم ضمن النطاق', scan_type: 'lowprice' },
      });
    }

    // فلاتر سيولة صارمة
    const filterOptions = {
      limit: LOWPRICE_CONFIG.MAX_ANALYSIS_STOCKS,
      minPrice: LOWPRICE_CONFIG.MIN_PRICE,
      minVolume: LOWPRICE_CONFIG.MIN_VOLUME,
      minDollarVol: LOWPRICE_CONFIG.MIN_DOLLAR_VOL,
      maxChangePct: LOWPRICE_CONFIG.MAX_CHANGE_PCT,
      minRvol: 0,
      maxGapPct: LOWPRICE_CONFIG.MAX_GAP_PCT,
    };
    let filtered = [];
    try {
      filtered = FilterEngine.filter(bandUniverse, filterOptions);
    } catch (error) {
      console.error('❌ [lowprice] FilterEngine:', error.message);
      filtered = [];
    }
    // تأكيد صارم إضافي للقيمة الدولارية
    filtered = filtered.filter(s => {
      const dv = s.dollar_vol != null ? s.dollar_vol : (Number(s.price) * Number(s.volume));
      return dv >= LOWPRICE_CONFIG.MIN_DOLLAR_VOL && Number(s.volume) >= LOWPRICE_CONFIG.MIN_VOLUME;
    });

    // 🆕 v20.5: فلتر القيمة السوقية — نطبّقه على الناجين القلائل فقط (نداء لكل سهم).
    // يستهدف الأسهم الصغيرة النامية (10-50 مليون)، لا العمالقة الرخيصة.
    if (LOWPRICE_CONFIG.ENABLE_MCAP && filtered.length > 0) {
      try {
        const capped = filtered.slice(0, LOWPRICE_CONFIG.MAX_ANALYSIS_STOCKS); // سقف نداءات
        const { kept, checked, withCapCount } = await filterByMarketCap(
          capped,
          LOWPRICE_CONFIG.MIN_MARKET_CAP,
          LOWPRICE_CONFIG.MAX_MARKET_CAP,
          5
        );
        console.log(`🏢 [lowprice/MCAP] فُحص ${checked}، له قيمة ${withCapCount}، ضمن النطاق [${LOWPRICE_CONFIG.MIN_MARKET_CAP/1e6}-${LOWPRICE_CONFIG.MAX_MARKET_CAP/1e6}M]: ${kept.length}`);
        filtered = kept;
      } catch (mcapErr) {
        console.error('❌ [lowprice] فشل فلتر القيمة السوقية (نُبقي القائمة كما هي):', mcapErr.message);
        // عند الفشل: لا نكسر المسح — نُبقي filtered كما هو (fail-open)
      }
    }

    const analysisStocks = filtered.slice(0, LOWPRICE_CONFIG.MAX_ANALYSIS_STOCKS);
    console.log(`📊 [lowprice] بعد الفلاتر الصارمة: ${filtered.length}، سيُحلَّل: ${analysisStocks.length}`);

    if (analysisStocks.length === 0) {
      return res.status(200).json({
        signals: [], breakouts: [], movers,
        meta: { totalScanned: universe.length, totalInBand: bandUniverse.length, totalFiltered: 0, message: 'لا أسهم اجتازت السيولة الصارمة', scan_type: 'lowprice' },
      });
    }

    // Process
    const processed = await processBatch(analysisStocks, marketContext, model);

    // Build signals — قسمان
    const readySignals = [];
    const breakoutSignals = [];
    const snapshotsBatch = [];
    const predictionsBatch = [];
    let structureSkipped = 0;

    for (const item of processed) {
      if (!item) continue;
      const { stock, featureVector: fv, score } = item;
      item.brainVersion = model.version;
      const confidence = ConfidenceEngine.calculateBreakdown(fv);
      const symbol = stock.symbol;
      const price = fv.price || 0;

      // وسم البيانات داخل feature_vector
      fv.scan_type = 'lowprice';
      fv.price_tier = price < LOWPRICE_CONFIG.SUB_DOLLAR_THRESHOLD ? 'sub_dollar' : 'low';

      snapshotsBatch.push({ symbol, price: fv.price, feature_vector: fv, context: FeatureBuilder.buildContext(marketContext) });
      predictionsBatch.push({ model_version: model.version, predicted_score: score, confidence_dist: confidence.breakdown });

      if (fv.structureValid === false) {
        structureSkipped++;
        console.warn(`⚠️ [lowprice/STRUCT] ${symbol} skipped: inconsistent levels`);
        continue;
      }

      const setup = PredictionEngine.classifySetup(fv);
      const isReady = setup.actionable && score >= LOWPRICE_CONFIG.DISPLAY_MIN_SCORE;
      const isBreakout = setup.stage === 'breakout';
      if (!isReady && !isBreakout) continue;

      // 🆕 v20.5: بوابة «الفرصة الحيّة» — تُطبّق على التوصيات الجاهزة فقط.
      // تستبعد: السهم الميّت (سيولة نسبية ضعيفة)، المنفجر (حجم/صعود تجاوز)،
      // والممتد. تُبقي: بداية الحركة قرب القاعدة قبل الانفجار.
      if (isReady && LOWPRICE_CONFIG.ENABLE_LIVE_GATE) {
        const L = LOWPRICE_CONFIG;
        const dv = stock.dollar_vol != null ? stock.dollar_vol : (price * (fv.volume || 0));
        const mcap = stock.market_cap || 0;
        const turnover = mcap > 0 ? dv / mcap : 0;
        const rvol = fv.rvol != null ? fv.rvol : 0;
        const chg = fv.change_pct != null ? fv.change_pct : 0;

        // بوابة 1: سيولة نسبية (لا سهم ميت)
        const liquidOk = turnover >= L.TURNOVER_MIN;
        // بوابة 2: الحجم يستيقظ ولا ينفجر
        const volOk = rvol >= L.RVOL_WAKE_MIN && rvol <= L.RVOL_WAKE_MAX;
        // بوابة 3: لم يرتفع كثيراً بعد (الفرصة حيّة) + مرحلة مبكرة
        const priceOk = chg >= L.CHANGE_MIN && chg <= L.CHANGE_MAX;
        const stageOk = setup.stage !== 'extended' && setup.stage !== 'breakout';

        if (!(liquidOk && volOk && priceOk && stageOk)) {
          // تشخيص: لماذا رُفض هذا السهم؟
          const reasons = [];
          if (!liquidOk) reasons.push(`turnover ${turnover.toFixed(2)}<${L.TURNOVER_MIN}`);
          if (!volOk) reasons.push(`rvol ${rvol.toFixed(2)} خارج[${L.RVOL_WAKE_MIN},${L.RVOL_WAKE_MAX}]`);
          if (!priceOk) reasons.push(`chg ${chg.toFixed(1)}% خارج[${L.CHANGE_MIN},${L.CHANGE_MAX}]`);
          if (!stageOk) reasons.push(`stage=${setup.stage}`);
          console.log(`  ⊘ [gate] ${stock.symbol}: ${reasons.join(' · ')}`);
          continue;
        }
      }

      const signalObj = buildSignalObject(item, score, confidence, setup);
      if (isReady) readySignals.push(signalObj);
      else breakoutSignals.push(signalObj);
    }

    if (structureSkipped > 0) console.log(`🛡️ [lowprice/STRUCT] استُبعدت ${structureSkipped} إشارة.`);
    console.log(`🎯 [lowprice] جاهزة: ${readySignals.length} | اختراقات: ${breakoutSignals.length}${LOWPRICE_CONFIG.ENABLE_LIVE_GATE ? ' (بعد بوابة الفرصة الحيّة)' : ''}`);

    // Save snapshots (بيانات التعلّم)
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
        console.error('❌ [lowprice] فشل حفظ البيانات:', storageError);
      }
    }

    // كتابة طبقة العرض (معزولة، غير حرجة)
    try {
      const batchId = new Date().toISOString();
      await StorageEngine.saveLatestSignalsBulk(readySignals, 'lowprice', 'ready', batchId);
      await StorageEngine.saveLatestSignalsBulk(breakoutSignals, 'lowprice', 'breakout', batchId);
      await StorageEngine.saveLatestMovers(movers, 'lowprice', batchId);
      await StorageEngine.pruneOldBatches('lowprice', 3);

      // 🆕 v20.6: اكتب التوصيات الجاهزة في جدول signals (الأدمن/الباك-تيست/التقييم).
      //   كان مفقوداً — لهذا لم تظهر السنتات في signals منذ استبدال الملف.
      //   نميّزها بـ scan_type='lowprice' (يُستبعدها البوت، وتُقاس منفصلة).
      try {
        await StorageEngine.saveSignalsForAdmin(readySignals, { isHot: false, scanType: 'lowprice' });
      } catch (adminErr) {
        console.error('❌ [lowprice] فشل كتابة signals (غير حرج):', adminErr.message);
      }
      console.log(`🗂️ latest_signals[lowprice] batch=${batchId} ready=${readySignals.length} breakout=${breakoutSignals.length}`);
    } catch (lsError) {
      console.error('❌ [lowprice] فشل كتابة latest_signals (غير حرج):', lsError.message);
    }

    // Response — وضع خفيف للكرون (?light=1) يتفادى حدّ حجم الرد.
    const meta8 = {
        scan_type: 'lowprice',
        priceBand: { min: LOWPRICE_CONFIG.MIN_PRICE, max: LOWPRICE_CONFIG.MAX_PRICE },
        liquidity: { minVolume: LOWPRICE_CONFIG.MIN_VOLUME, minDollarVol: LOWPRICE_CONFIG.MIN_DOLLAR_VOL },
        totalScanned: universe.length,
        totalInBand: bandUniverse.length,
        totalFiltered: filtered.length,
        totalSignals: readySignals.length,
        totalBreakouts: breakoutSignals.length,
        structureSkipped,
        savedSnapshots: snapshotsBatch.length,
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        brainVersion: model.version,
        batchSizeUsed: currentBatchSize,
    };

    if (req.query && (req.query.light === '1' || req.query.light === 'true')) {
      return res.status(200).json({ ok: true, meta: meta8 });
    }

    res.status(200).json({
      signals: readySignals.sort((a, b) => b.predictionScore - a.predictionScore),
      breakouts: breakoutSignals.sort((a, b) => b.change_pct - a.change_pct),
      movers,
      meta: meta8,
    });
  } catch (error) {
    console.error('❌ [lowprice] خطأ عام:', error);
    res.status(500).json({ error: 'فشل في تشغيل مسح الأسهم منخفضة السعر', details: error.message });
  }
}

function getGrade(score) {
  if (score >= 85) return 'ELITE';
  if (score >= 75) return 'PRIME';
  if (score >= 65) return 'STRONG';
  if (score >= 55) return 'GOOD';
  return 'WATCH';
}

function buildMovers(list) {
  const valid = (list || []).filter(s => s && s.symbol && s.price > 0 && s.volume > 0)
    .map(s => ({
      symbol: s.symbol, price: s.price, change_pct: s.change_pct || 0,
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
