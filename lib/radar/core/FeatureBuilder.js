// lib/radar/core/FeatureBuilder.js
// ============================================================
// RadarAZ v20.2 - Feature Builder
// ✅ RVOL الحقيقي من Daily Bars
// ✅ rvolSource لتتبع مصدر RVOL
// ✅ fallbackReason
// ✅ AUDIT ADD (v20.1): breakout / nearResistance / aboveVWAP محسوبة فعلياً
//
// ✅ STRUCTURE FIX (v20.2) — إصلاح الجذر:
//    - المقاومة/الدعم تُصنَّف الآن بالموضع النسبي للسعر لا بالفتحة (slot).
//      resistance = أقرب مستوى فوق السعر (أو null عند الاختراق).
//      support    = أقرب مستوى تحت السعر. هذا يعالج انقلاب الدعم/المقاومة
//      تلقائياً (القمّة المكسورة تصبح دعماً بدل أن تبقى "مقاومة" تحت السعر).
//    - منطقة دخول حقيقية [entry_low, entry_high] بدل نقطة entry = price.
//    - entry_type يفصل حالة الاختراق (breakout) صراحةً.
//    - structureValid: فاحص منطقي يُصدره هذا الملف ليقرأه حارس scan.js
//      فيُسقِط/يُعلِّم الإشارة غير المتّسقة بدل إصلاحها صامتاً (نظافة الداتا).
// ============================================================

import { SCAN_CONFIG } from './config.js';
import { IndicatorEngine } from './IndicatorEngine.js';
import { FeatureNormalizer } from './FeatureNormalizer.js';

// عدد الشموع للنظر للخلف عند حساب المستويات (20 يوم ≈ مقاومة/دعم شهر، مناسب للمضاربة)
const RESISTANCE_LOOKBACK = 20;

export class FeatureBuilder {
  // ─────────────────────────────────────────────────────────
  // حساب مستويات البنية (support/resistance) بالموضع النسبي للسعر.
  //
  // الجوهر: نجمع القمم والقيعان ضمن نافذة النظر للخلف (+ VWAP كمستوى
  // داخلي)، ثم نقسّمها إلى ما هو فوق السعر وما هو تحته:
  //   resistance = أصغر مستوى فوق السعر (أقرب سقف).
  //   support    = أكبر مستوى تحت السعر (أقرب أرضية).
  // بهذا تنقلب القمّة المكسورة تلقائياً إلى دعم لأنها صارت تحت السعر.
  // ─────────────────────────────────────────────────────────
  static _computeStructure(price, vwap, dailyBars, intradayBars) {
    const result = {
      breakout: false,
      nearResistance: false,
      aboveVWAP: vwap > 0 && price > vwap,
      resistance: null,   // أقرب سقف فوق السعر (null عند الاختراق)
      support: null,      // أقرب أرضية تحت السعر
      priorMaxHigh: null, // أعلى قمّة في النافذة (لكشف الاختراق فقط)
    };

    if (!(price > 0)) return result;

    // نفضّل الشموع اليومية للبنية؛ نرجع للشموع اللحظية إن غابت اليومية.
    const useDaily = Array.isArray(dailyBars) && dailyBars.length >= 5;
    const src = useDaily ? dailyBars : intradayBars;
    if (!Array.isArray(src) || src.length < 5) return result;

    // نستبعد الشمعة الأخيرة (اليوم/الشمعة الجارية) ثم نأخذ نافذة النظر للخلف.
    const windowed = src.slice(-RESISTANCE_LOOKBACK - 1, -1);
    const source = windowed.length > 0 ? windowed : src.slice(0, -1);
    if (source.length === 0) return result;

    const highs = source.map(b => Number(b.high) || 0).filter(v => v > 0);
    const lows = source.map(b => Number(b.low) || 0).filter(v => v > 0);
    if (highs.length === 0) return result;

    const priorMaxHigh = Math.max(...highs);
    result.priorMaxHigh = priorMaxHigh;

    // مرشّحو المستويات: القمم + القيعان (تنقلب أدوارها بموضعها من السعر)،
    // بالإضافة إلى VWAP كمستوى داخلي فعّال في المضاربة اللحظية.
    const levels = [...highs, ...lows];
    if (vwap > 0) levels.push(vwap);

    const eps = price * 0.0005; // منطقة ميتة 0.05% حتى لا نلتقط السعر نفسه
    const above = levels.filter(v => v > price + eps);
    const below = levels.filter(v => v < price - eps);

    result.resistance = above.length ? Math.min(...above) : null; // أقرب سقف
    result.support = below.length ? Math.max(...below) : null;     // أقرب أرضية

    // اختراق: السعر تجاوز أعلى قمّة في النافذة ولا يوجد سقف فوقه.
    result.breakout = price >= priorMaxHigh - eps && result.resistance === null;

    // قريب من المقاومة: ضمن 2% تحت أقرب سقف فعلي فوق السعر.
    result.nearResistance =
      result.resistance != null &&
      ((result.resistance - price) / price) * 100 <= 2;

    return result;
  }

  // ─────────────────────────────────────────────────────────
  // حساب منطقة الدخول + الثابت المنطقي.
  // منطقة الدخول = نطاق عند السعر أو أسفله قليلاً نحو أقرب دعم،
  // بعرض محكوم بـ 0.5×ATR (أو 0.5% إن غاب ATR).
  //   stop < entry_low ≤ entry_high ≤ price < target1 < target2 < target3
  //   resistance (إن وُجد) > price ،  support (إن وُجد) < price
  // ─────────────────────────────────────────────────────────
  static _buildEntryZone(price, atr, structure, stop, target1, target2, target3) {
    const band = atr > 0 ? atr * 0.5 : price * 0.005;

    let entry_high = price;                 // لا ندخل فوق السوق افتراضياً
    let entry_low = price - band;

    // لا نُنزل قاع منطقة الدخول أسفل أقرب دعم (لا نشتري تحت الأرضية).
    if (structure.support != null && structure.support < price) {
      entry_low = Math.max(entry_low, structure.support);
    }

    // أمان: اضمن entry_low < entry_high دائماً.
    if (!(entry_low < entry_high)) {
      entry_low = entry_high - Math.max(price * 0.001, band * 0.25);
    }
    if (entry_low < 0) entry_low = entry_high * 0.999;

    const entry_type = structure.breakout
      ? 'breakout'
      : structure.support != null
        ? 'pullback_zone'
        : 'momentum';

    // الفاحص المنطقي — يقرأه حارس scan.js.
    const structureValid =
      entry_low <= entry_high &&
      entry_high <= price + 1e-9 &&
      stop < entry_low &&
      target1 > entry_high &&
      target2 > target1 &&
      target3 > target2 &&
      (structure.resistance == null || structure.resistance > price) &&
      (structure.support == null || structure.support < price);

    return {
      entry: entry_high,               // تعبئة سوقية قابلة للتحقّق (توافق classify-outcomes)
      entry_low: Number(entry_low.toFixed(4)),
      entry_high: Number(entry_high.toFixed(4)),
      entry_zone: [Number(entry_low.toFixed(4)), Number(entry_high.toFixed(4))],
      entry_type,
      structureValid,
    };
  }

  static buildFromBars(stock, bars, marketContext, timeframe = '5', dailyBars = null) {
    // ─── حماية من bars فارغة ──────────────────────────────
    if (!bars || bars.length < 3) {
      return this._buildFallback(stock, marketContext, timeframe, 'NO_BARS');
    }

    // ─── جودة البيانات ────────────────────────────────────
    let dataQuality = 'HIGH';
    if (bars.length < 5) dataQuality = 'VERY_LOW';
    else if (bars.length < 10) dataQuality = 'LOW';
    else if (bars.length < 20) dataQuality = 'MEDIUM';

    const price = stock.price || 0;
    const volume = stock.volume || 0;
    const vwap = stock.vwap || price;
    const open = stock.open || price;
    const high = stock.high || price;
    const low = stock.low || price;
    const prevClose = stock.prevClose || price;
    const change_pct = stock.change_pct || 0;

    // ─── مؤشرات ────────────────────────────────────────────
    const indicators = IndicatorEngine.calculateAll(bars, timeframe);
    const atr = indicators.atr || 0;
    const rsi = indicators.rsi || 50;
    const ema9 = indicators.ema9 || price;
    const ema21 = indicators.ema21 || price;
    const ema50 = indicators.ema50 || price;
    const macd = indicators.macd || null;
    const vwapIndicator = indicators.vwap || vwap;
    const settings = indicators.settings || {};
    const dataQualityIndicator = indicators.dataQuality || 'HIGH';

    // ─── RVOL الحقيقي (من Daily Bars) ─────────────────────
    // ✅ TIMING FIX v2: نستبعد اليوم الجاري (غير المكتمل) تماماً بمقارنة تاريخ
    // كل شمعة بتاريخ اليوم. حجم "اليوم الجاري" أثناء الجلسة يمثّل جزءاً من
    // اليوم فقط، فمقارنته بمتوسط أيام كاملة تعطي RVOL منخفضاً زائفاً. نقارن
    // آخر يوم *مكتمل* (أمس) بمتوسط الأيام المكتملة قبله.
    let avgDailyVolume = 0;
    let rvol = 1;
    let rvolSource = 'intraday';

    const todayStr = new Date().toISOString().split('T')[0];
    const completedDays = (Array.isArray(dailyBars) ? dailyBars : []).filter(b => {
      if (!b || b.timestamp == null) return true; // لا تاريخ → اعتبرها مكتملة
      const barDate = String(b.timestamp).split('T')[0];
      return barDate !== todayStr; // استبعد شمعة اليوم الجاري
    });

    if (completedDays.length >= 21) {
      const lastCompletedVol = Number(completedDays[completedDays.length - 1].volume) || 0;
      const priorDays = completedDays.slice(-21, -1); // 20 يوماً قبل آخر يوم مكتمل
      avgDailyVolume = priorDays.reduce((a, b) => a + (Number(b.volume) || 0), 0) / priorDays.length;
      rvol = avgDailyVolume > 0 ? lastCompletedVol / avgDailyVolume : 1;
      rvolSource = 'daily';
    } else if (completedDays.length >= 6) {
      // بيانات أقل: متوسط ما هو متاح من أيام مكتملة.
      const lastCompletedVol = Number(completedDays[completedDays.length - 1].volume) || 0;
      const priorDays = completedDays.slice(0, -1);
      avgDailyVolume = priorDays.reduce((a, b) => a + (Number(b.volume) || 0), 0) / priorDays.length;
      rvol = avgDailyVolume > 0 ? lastCompletedVol / avgDailyVolume : 1;
      rvolSource = 'daily_short';
    } else if (stock.avgVolume && stock.avgVolume > 0) {
      avgDailyVolume = stock.avgVolume;
      rvol = avgDailyVolume > 0 ? volume / avgDailyVolume : 1;
      rvolSource = 'snapshot';
    } else {
      const avgVolume = bars.reduce((a, b) => a + b.volume, 0) / bars.length;
      rvol = avgVolume > 0 ? volume / avgVolume : 1;
      rvolSource = 'intraday';
    }

    // ─── Structure (support / resistance / breakout / VWAP) ────
    // ✅ STRUCTURE FIX v20.2: مستويات مصنّفة بالموضع النسبي للسعر.
    const structure = this._computeStructure(price, vwapIndicator, dailyBars, bars);

    // ─── Gap ──────────────────────────────────────────────
    const gap = prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0;

    // ─── Normalization ──────────────────────────────────────
    const normalized = FeatureNormalizer.normalizeAll({
      price,
      atr,
      volume,
      avgVolume: avgDailyVolume || volume,
      rsi,
      ema9,
      ema21,
    });

    // ─── أهداف/وقف التداول (ATR كما هو — لم نغيّر منطق الأهداف) ──
    let stop, target1, target2, target3, target_source;

    if (atr > 0) {
      stop = price - atr * SCAN_CONFIG.STOP_MULTIPLIER;
      target1 = price + atr * SCAN_CONFIG.TARGET1_MULTIPLIER;
      target2 = price + atr * SCAN_CONFIG.TARGET2_MULTIPLIER;
      target3 = price + atr * SCAN_CONFIG.TARGET3_MULTIPLIER;
      target_source = 'atr_based';
    } else {
      stop = price * 0.97;
      target1 = price * 1.04;
      target2 = price * 1.08;
      target3 = price * 1.12;
      target_source = 'percent_based';
    }

    // ─── منطقة الدخول + الفاحص المنطقي ─────────────────────
    const zone = this._buildEntryZone(price, atr, structure, stop, target1, target2, target3);
    const entry = zone.entry;

    const risk = Math.max(entry - stop, 0.000001);
    const reward = target1 - entry;
    const riskReward = Number((reward / risk).toFixed(2));
    const holding_period_hours = SCAN_CONFIG.DEFAULT_HOLDING_PERIOD_HOURS || 4;

    return {
      price,
      volume,
      rvol: parseFloat(rvol.toFixed(2)),
      rvolSource,
      atr,
      rsi,
      ema9,
      ema21,
      ema50,
      vwap: vwapIndicator,
      gap,
      change_pct,
      macd,
      // ✅ حقول البنية التي يقرأها PredictionEngine + البطاقة
      breakout: structure.breakout,
      nearResistance: structure.nearResistance,
      aboveVWAP: structure.aboveVWAP,
      resistance: structure.resistance, // أقرب سقف فوق السعر (أو null)
      support: structure.support,       // ✅ جديد: أقرب أرضية تحت السعر
      normalizedATRPercent: normalized.normalized.atrPercent,
      normalizedVolumeZScore: normalized.normalized.volumeZScore,
      normalizedEMADistance9: normalized.normalized.ema9Distance,
      normalizedEMADistance21: normalized.normalized.ema21Distance,
      normalizedRSI: normalized.normalized.normalizedRSI,
      timeframe,
      indicatorSettings: settings,
      dataQuality: dataQualityIndicator,
      // ✅ منطقة الدخول (بدل النقطة الواحدة)
      entry,
      entry_low: zone.entry_low,
      entry_high: zone.entry_high,
      entry_zone: zone.entry_zone,
      entry_type: zone.entry_type,
      structureValid: zone.structureValid, // ✅ يقرأه حارس scan.js
      stop,
      target1,
      target2,
      target3,
      riskReward,
      target_source,
      holding_period_hours,
      spy: Number(marketContext.spy_change ?? 0),
      vix: Number(marketContext.vix ?? 18),
      hour: Number(marketContext.hour ?? 9),
      day_of_week: Number(marketContext.day_of_week_index ?? 0),
      market_regime: marketContext.regime ?? 'Neutral',
      sector: stock.sector || 'Unknown',
      sectorRank: stock.sectorRank || 5,
      timing: stock.timing || 'BREAKOUT',
    };
  }

  // ─── Fallback ──────────────────────────────────────────────
  static _buildFallback(stock, marketContext, timeframe = '5', reason = 'UNKNOWN') {
    const price = stock.price || 0;
    const volume = stock.volume || 0;
    const atr = stock.atr || 0;
    const rsi = stock.rsi || 50;
    const ema9 = stock.ema9 || price;
    const ema21 = stock.ema21 || price;
    const ema50 = stock.ema50 || price;
    const vwap = stock.vwap || price;
    const gap = stock.gap || 0;
    const change_pct = stock.change_pct || 0;

    let stop, target1, target2, target3, target_source;

    if (atr > 0) {
      stop = price - atr * SCAN_CONFIG.STOP_MULTIPLIER;
      target1 = price + atr * SCAN_CONFIG.TARGET1_MULTIPLIER;
      target2 = price + atr * SCAN_CONFIG.TARGET2_MULTIPLIER;
      target3 = price + atr * SCAN_CONFIG.TARGET3_MULTIPLIER;
      target_source = 'fallback_atr';
    } else {
      stop = price * 0.97;
      target1 = price * 1.04;
      target2 = price * 1.08;
      target3 = price * 1.12;
      target_source = 'fallback_percent';
    }

    // بنية محايدة في وضع الـ fallback: لا مقاومة/دعم معروفَين.
    const structure = { breakout: false, nearResistance: false, aboveVWAP: false, resistance: null, support: null, priorMaxHigh: null };
    const zone = this._buildEntryZone(price, atr, structure, stop, target1, target2, target3);
    const entry = zone.entry;

    const risk = Math.max(entry - stop, 0.000001);
    const reward = target1 - entry;
    const riskReward = Number((reward / risk).toFixed(2));
    const holding_period_hours = SCAN_CONFIG.DEFAULT_HOLDING_PERIOD_HOURS || 4;

    return {
      price,
      volume,
      rvol: 1,
      rvolSource: 'fallback',
      atr,
      rsi,
      ema9,
      ema21,
      ema50,
      vwap,
      gap,
      change_pct,
      macd: null,
      breakout: false,
      nearResistance: false,
      aboveVWAP: false,
      resistance: null,
      support: null,
      normalizedATRPercent: 0,
      normalizedVolumeZScore: 0,
      normalizedEMADistance9: 0,
      normalizedEMADistance21: 0,
      normalizedRSI: rsi / 100,
      timeframe,
      indicatorSettings: {},
      dataQuality: 'FALLBACK',
      entry,
      entry_low: zone.entry_low,
      entry_high: zone.entry_high,
      entry_zone: zone.entry_zone,
      entry_type: zone.entry_type,
      structureValid: zone.structureValid,
      stop,
      target1,
      target2,
      target3,
      riskReward,
      target_source,
      holding_period_hours,
      spy: Number(marketContext.spy_change ?? 0),
      vix: Number(marketContext.vix ?? 18),
      hour: Number(marketContext.hour ?? 9),
      day_of_week: Number(marketContext.day_of_week_index ?? 0),
      market_regime: marketContext.regime ?? 'Neutral',
      sector: stock.sector || 'Unknown',
      sectorRank: stock.sectorRank || 5,
      timing: stock.timing || 'BREAKOUT',
      fallbackReason: reason,
    };
  }

  // ─── build() ──────────────────────────────────────────────
  static build(stock, marketContext) {
    const price = Number(stock.close ?? stock.price ?? 0);
    const volume = Number(stock.volume ?? 0);
    const rvol = Number(stock.rvol ?? 0);
    const atr = Number(stock.atr ?? 0);
    const rsi = Number(stock.rsi ?? 50);
    const ema9 = Number(stock.ema9 ?? 0);
    const ema21 = Number(stock.ema21 ?? 0);
    const ema50 = Number(stock.ema50 ?? 0);
    const vwap = Number(stock.vwap ?? 0);
    const gap = Number(stock.gap ?? 0);
    const float = Number(stock.float ?? 0);
    const shortInterest = Number(stock.shortInterest ?? 0);
    const sector_rank = Number(stock.sectorRank ?? 5);
    const sector_name = stock.sector ?? 'Unknown';
    const sector_change = Number(stock.sectorChange ?? 0);

    let stop, target1, target2, target3, target_source;

    if (atr > 0) {
      stop = price - atr * SCAN_CONFIG.STOP_MULTIPLIER;
      target1 = price + atr * SCAN_CONFIG.TARGET1_MULTIPLIER;
      target2 = price + atr * SCAN_CONFIG.TARGET2_MULTIPLIER;
      target3 = price + atr * SCAN_CONFIG.TARGET3_MULTIPLIER;
      target_source = 'fallback_atr';
    } else {
      stop = price * 0.97;
      target1 = price * 1.04;
      target2 = price * 1.08;
      target3 = price * 1.12;
      target_source = 'fallback_percent';
    }

    // لا شموع هنا → بنية غير معروفة، لكن نُنتج منطقة دخول متّسقة.
    const structure = { breakout: false, nearResistance: false, aboveVWAP: false, resistance: null, support: null, priorMaxHigh: null };
    const zone = this._buildEntryZone(price, atr, structure, stop, target1, target2, target3);
    const entry = zone.entry;

    const risk = Math.max(entry - stop, 0.000001);
    const reward = target1 - entry;
    const riskReward = Number((reward / risk).toFixed(2));
    const holding_period_hours = SCAN_CONFIG.DEFAULT_HOLDING_PERIOD_HOURS || 4;

    return {
      price,
      volume,
      rvol,
      rvolSource: 'legacy',
      atr,
      rsi,
      ema9,
      ema21,
      ema50,
      vwap,
      gap,
      float,
      shortInterest,
      sector_rank,
      sector_name,
      sector_change,
      resistance: null,
      support: null,
      entry,
      entry_low: zone.entry_low,
      entry_high: zone.entry_high,
      entry_zone: zone.entry_zone,
      entry_type: zone.entry_type,
      structureValid: zone.structureValid,
      stop,
      target1,
      target2,
      target3,
      riskReward,
      target_source,
      holding_period_hours,
      spy: Number(marketContext.spy_change ?? 0),
      vix: Number(marketContext.vix ?? 18),
      hour: Number(marketContext.hour ?? 9),
      day_of_week: Number(marketContext.day_of_week_index ?? 0),
      market_regime: marketContext.regime ?? 'Neutral',
    };
  }

  // ─── buildContext() ────────────────────────────────────────
  static buildContext(marketContext) {
    return {
      market_regime: marketContext.regime ?? 'Neutral',
      volatility_regime: marketContext.volatility_regime ?? 'Normal',
      liquidity_regime: marketContext.liquidity_regime ?? 'Normal',
      fed_regime: marketContext.fed_regime ?? 'Neutral',
      risk_appetite: marketContext.risk_appetite ?? 'Neutral',
      top_sector: marketContext.top_sector ?? 'Unknown',
      spy_change: Number(marketContext.spy_change ?? 0),
      vix: Number(marketContext.vix ?? 18),
      hour: Number(marketContext.hour ?? 9),
      day_of_week: Number(marketContext.day_of_week_index ?? 0),
    };
  }
}
