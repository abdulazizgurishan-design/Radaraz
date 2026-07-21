// lib/radar/core/SmartTimeframeEngine.js
// ============================================================
// RadarAZ v20.1 - Smart Timeframe Engine (معدل)
// ============================================================
// ✅ تجنب الإطارات 1 و 5 دقائق للأسهم ذات السيولة المنخفضة
// ============================================================

import { SCAN_CONFIG } from './config.js';

export class SmartTimeframeEngine {
  static getTimeframe(stock, atrPercent = 0) {
    const rvol = this._calculateRVOL(stock);
    const change = Math.abs(stock.change_pct || 0);
    const dollarVol = stock.dollar_vol || 0;
    const price = stock.price || 0;

    const beta = stock.beta || this._estimateBeta(change);
    const spread = stock.spread || this._estimateSpread(dollarVol);
    const float = stock.float || this._estimateFloat(dollarVol);

    const config = SCAN_CONFIG.TIMEFRAME_CONFIG;

    // ✅ الشرط الأول: إذا كان السهم نشطاً جداً (سيولة عالية) استخدم 15 دقيقة بدلاً من 1
    if (rvol > config.rvolThresholds['1'] &&
        change > config.volatilityThresholds['1'] &&
        dollarVol > config.dollarVolThresholds['1'] &&
        atrPercent > config.atrPercentThresholds['1'] &&
        spread < 0.02) {
      return '15'; // ✅ بدلاً من '1'
    }

    // ✅ الشرط الثاني: نشط ولكن ليس كثيراً (استخدم 15 بدلاً من 5)
    if (rvol > config.rvolThresholds['5'] &&
        change > config.volatilityThresholds['5'] &&
        dollarVol > config.dollarVolThresholds['5'] &&
        atrPercent > config.atrPercentThresholds['5'] &&
        spread < 0.05) {
      return '15'; // ✅ بدلاً من '5'
    }

    // مضاربة عادية (يبقى 15)
    if (rvol > config.rvolThresholds['15'] &&
        change > config.volatilityThresholds['15'] &&
        dollarVol > config.dollarVolThresholds['15']) {
      return '15';
    }

    // سوينج (60)
    if (dollarVol > config.dollarVolThresholds['60'] &&
        change > config.volatilityThresholds['60']) {
      return '60';
    }

    // استثماري (يومي)
    return 'day';
  }

  static _calculateRVOL(stock) {
    if (stock.avgVolume && stock.avgVolume > 0) {
      return stock.volume / stock.avgVolume;
    }
    const dollarVol = stock.dollar_vol || 0;
    if (dollarVol > 10000000) return 5;
    if (dollarVol > 5000000) return 3.5;
    if (dollarVol > 2000000) return 2.5;
    if (dollarVol > 1000000) return 1.5;
    return 1;
  }

  static _estimateBeta(change) {
    if (change > 5) return 2.5;
    if (change > 3) return 1.8;
    if (change > 1.5) return 1.2;
    if (change > 0.5) return 0.8;
    return 0.5;
  }

  static _estimateSpread(dollarVol) {
    if (dollarVol > 5000000) return 0.01;
    if (dollarVol > 2000000) return 0.02;
    if (dollarVol > 1000000) return 0.05;
    return 0.1;
  }

  static _estimateFloat(dollarVol) {
    if (dollarVol > 10000000) return 100;
    if (dollarVol > 5000000) return 50;
    if (dollarVol > 2000000) return 20;
    if (dollarVol > 1000000) return 10;
    return 5;
  }

  static getIndicatorSettings(timeframe) {
    const settings = {
      '1': { rsiPeriod: 9, atrPeriod: 10, emaFast: 5, emaSlow: 13, macdFast: 6, macdSlow: 13, macdSignal: 5 },
      '5': { rsiPeriod: 12, atrPeriod: 14, emaFast: 9, emaSlow: 21, macdFast: 8, macdSlow: 17, macdSignal: 9 },
      '15': { rsiPeriod: 14, atrPeriod: 14, emaFast: 9, emaSlow: 21, macdFast: 12, macdSlow: 26, macdSignal: 9 },
      '60': { rsiPeriod: 14, atrPeriod: 14, emaFast: 12, emaSlow: 26, macdFast: 12, macdSlow: 26, macdSignal: 9 },
      'day': { rsiPeriod: 21, atrPeriod: 20, emaFast: 20, emaSlow: 50, macdFast: 12, macdSlow: 26, macdSignal: 9 },
    };
    return settings[timeframe] || settings['15'];
  }
}
