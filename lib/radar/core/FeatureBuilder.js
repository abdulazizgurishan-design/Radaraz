// lib/radar/core/FeatureBuilder.js
// ============================================================
// RadarAZ v20.1 - Feature Builder
// ✅ RVOL الحقيقي من Daily Bars
// ✅ rvolSource لتتبع مصدر RVOL
// ✅ fallbackReason
// ============================================================

import { SCAN_CONFIG } from './config.js';
import { IndicatorEngine } from './IndicatorEngine.js';
import { FeatureNormalizer } from './FeatureNormalizer.js';

export class FeatureBuilder {
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
    let avgDailyVolume = 0;
    let rvol = 1;
    let rvolSource = 'intraday'; // ✅ مصدر RVOL

    if (dailyBars && dailyBars.length >= 20) {
      // ✅ استخدام Daily Bars لحساب متوسط 20 يوم
      const dailyVolumes = dailyBars.slice(-20).map(b => b.volume);
      avgDailyVolume = dailyVolumes.reduce((a, b) => a + b, 0) / dailyVolumes.length;
      rvol = avgDailyVolume > 0 ? volume / avgDailyVolume : 1;
      rvolSource = 'daily';
    } else if (stock.avgVolume && stock.avgVolume > 0) {
      // ✅ استخدام avgVolume من Snapshot كبديل
      avgDailyVolume = stock.avgVolume;
      rvol = avgDailyVolume > 0 ? volume / avgDailyVolume : 1;
      rvolSource = 'snapshot';
    } else {
      // ✅ Fallback: استخدام الشموع الحالية
      const avgVolume = bars.reduce((a, b) => a + b.volume, 0) / bars.length;
      rvol = avgVolume > 0 ? volume / avgVolume : 1;
      rvolSource = 'intraday';
    }

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

    // ─── أهداف التداول ──────────────────────────────────────
    const entry = price;
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

    const risk = Math.max(entry - stop, 0.000001);
    const reward = target1 - entry;
    const riskReward = Number((reward / risk).toFixed(2));
    const holding_period_hours = SCAN_CONFIG.DEFAULT_HOLDING_PERIOD_HOURS || 4;

    return {
      price,
      volume,
      rvol: parseFloat(rvol.toFixed(2)),
      rvolSource, // ✅ مصدر RVOL
      atr,
      rsi,
      ema9,
      ema21,
      ema50,
      vwap: vwapIndicator,
      gap,
      change_pct,
      macd,
      normalizedATRPercent: normalized.normalized.atrPercent,
      normalizedVolumeZScore: normalized.normalized.volumeZScore,
      normalizedEMADistance9: normalized.normalized.ema9Distance,
      normalizedEMADistance21: normalized.normalized.ema21Distance,
      normalizedRSI: normalized.normalized.normalizedRSI,
      timeframe,
      indicatorSettings: settings,
      dataQuality: dataQualityIndicator,
      entry,
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

    const entry = price;
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
      normalizedATRPercent: 0,
      normalizedVolumeZScore: 0,
      normalizedEMADistance9: 0,
      normalizedEMADistance21: 0,
      normalizedRSI: rsi / 100,
      timeframe,
      indicatorSettings: {},
      dataQuality: 'FALLBACK',
      entry,
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

    const entry = price;
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
      entry,
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
