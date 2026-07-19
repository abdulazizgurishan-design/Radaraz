// lib/radar/core/IndicatorEngine.js
// ============================================================
// RadarAZ v20.1 - Indicator Engine
// ✅ EMA محاذية | MACD محاذي | RSI Series | ATR Wilder
// ✅ dataQuality: VERY_LOW (<5), LOW (<10), MEDIUM (<20), HIGH (>=20)
// ============================================================

import { SCAN_CONFIG } from './config.js';

export class IndicatorEngine {
  // ─── EMA Series (محاذية) ──────────────────────────────────
  static calculateEMASeries(closes, period) {
    if (!closes || closes.length === 0) return null;

    const result = new Array(closes.length).fill(null);

    // ✅ شرط واضح: إذا كانت البيانات أقل من الفترة
    if (closes.length <= period) {
      return result; // كل القيم null
    }

    // حساب SMA للفترة الأولى
    let sma = 0;
    for (let i = 0; i < period; i++) {
      sma += closes[i];
    }
    sma /= period;
    result[period - 1] = sma;

    const k = 2 / (period + 1);
    let ema = sma;
    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
      result[i] = ema;
    }

    return result;
  }

  // ─── RSI Series ──────────────────────────────────────────
  static calculateRSISeries(closes, period = 14) {
    if (!closes || closes.length === 0) {
      return [];
    }

    const result = new Array(closes.length).fill(50);

    if (closes.length < period + 1) {
      return result;
    }

    let avgGain = 0, avgLoss = 0;

    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) avgGain += diff;
      else avgLoss -= diff;
    }
    avgGain /= period;
    avgLoss /= period;

    if (avgLoss === 0) result[period] = 100;
    else {
      const rs = avgGain / avgLoss;
      result[period] = 100 - (100 / (1 + rs));
    }

    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) {
        avgGain = (avgGain * (period - 1) + diff) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - diff) / period;
      }

      if (avgLoss === 0) result[i] = 100;
      else {
        const rs = avgGain / avgLoss;
        result[i] = 100 - (100 / (1 + rs));
      }
    }

    return result;
  }

  static calculateRSI(closes, period = 14) {
    const series = this.calculateRSISeries(closes, period);
    return series && series.length > 0 ? series[series.length - 1] : 50;
  }

  static calculateEMA(closes, period) {
    const series = this.calculateEMASeries(closes, period);
    return series ? series[series.length - 1] : null;
  }

  // ─── ATR Wilder ──────────────────────────────────────────
  static calculateATRWilder(bars, period = 14) {
    if (!bars || bars.length < period + 1) return 0;

    let trSum = 0;
    for (let i = 1; i <= period; i++) {
      const high = bars[i].high;
      const low = bars[i].low;
      const prevClose = bars[i - 1].close;
      const hl = high - low;
      const hc = Math.abs(high - prevClose);
      const lc = Math.abs(low - prevClose);
      trSum += Math.max(hl, hc, lc);
    }

    let atr = trSum / period;

    for (let i = period + 1; i < bars.length; i++) {
      const high = bars[i].high;
      const low = bars[i].low;
      const prevClose = bars[i - 1].close;
      const hl = high - low;
      const hc = Math.abs(high - prevClose);
      const lc = Math.abs(low - prevClose);
      const tr = Math.max(hl, hc, lc);
      atr = ((atr * (period - 1)) + tr) / period;
    }

    return atr;
  }

  // ─── MACD Series (محاذي) ──────────────────────────────────
  static calculateMACDSeries(closes, fast = 12, slow = 26, signal = 9) {
    if (!closes || closes.length < slow) return null;

    const emaFastSeries = this.calculateEMASeries(closes, fast);
    const emaSlowSeries = this.calculateEMASeries(closes, slow);

    if (!emaFastSeries || !emaSlowSeries) return null;

    const length = closes.length;
    const macdValues = new Array(length).fill(null);

    // محاذاة صحيحة: نأخذ القيم غير null من كلتا السلسلتين
    for (let i = 0; i < length; i++) {
      if (emaFastSeries[i] !== null && emaSlowSeries[i] !== null) {
        macdValues[i] = emaFastSeries[i] - emaSlowSeries[i];
      }
    }

    // حساب Signal Line فقط على القيم الصالحة
    const validMacd = macdValues.filter(v => v !== null);
    if (validMacd.length < signal) {
      return {
        macd: validMacd.length > 0 ? validMacd[validMacd.length - 1] : 0,
        signal: 0,
        histogram: 0,
        macdValues,
      };
    }

    const signalLineFull = this.calculateEMASeries(validMacd, signal);

    const signalValues = new Array(length).fill(null);
    let validIndex = 0;
    for (let i = 0; i < length; i++) {
      if (macdValues[i] !== null) {
        if (signalLineFull && validIndex < signalLineFull.length) {
          signalValues[i] = signalLineFull[validIndex];
        }
        validIndex++;
      }
    }

    let lastMacd = 0, lastSignal = 0;
    for (let i = length - 1; i >= 0; i--) {
      if (macdValues[i] !== null) {
        lastMacd = macdValues[i];
        break;
      }
    }
    for (let i = length - 1; i >= 0; i--) {
      if (signalValues[i] !== null) {
        lastSignal = signalValues[i];
        break;
      }
    }

    return {
      macd: lastMacd,
      signal: lastSignal,
      histogram: lastMacd - lastSignal,
      macdValues,
      signalValues,
    };
  }

  static calculateMACD(closes, fast = 12, slow = 26, signal = 9) {
    const result = this.calculateMACDSeries(closes, fast, slow, signal);
    if (!result) return null;
    return {
      macd: result.macd,
      signal: result.signal,
      histogram: result.histogram,
    };
  }

  // ─── VWAP ────────────────────────────────────────────────
  static calculateVWAP(bars) {
    if (!bars || bars.length === 0) return 0;
    let totalValue = 0, totalVolume = 0;
    for (const bar of bars) {
      const typical = (bar.high + bar.low + bar.close) / 3;
      totalValue += typical * bar.volume;
      totalVolume += bar.volume;
    }
    return totalVolume > 0 ? totalValue / totalVolume : 0;
  }

  // ─── calculateAll ─────────────────────────────────────────
  static calculateAll(bars, timeframe = '5', debug = false) {
    // ✅ تحسين جودة البيانات
    if (!bars || bars.length === 0) {
      const settings = this._getSettings(timeframe);
      return {
        ema9: 0,
        ema21: 0,
        ema50: 0,
        rsi: 50,
        atr: 0,
        vwap: 0,
        macd: null,
        settings,
        dataQuality: 'NO_DATA',
      };
    }

    const closes = bars.map(b => b.close);
    const settings = this._getSettings(timeframe);

    // ✅ تصنيف جودة البيانات
    let dataQuality;
    if (bars.length < 5) dataQuality = 'VERY_LOW';
    else if (bars.length < 10) dataQuality = 'LOW';
    else if (bars.length < 20) dataQuality = 'MEDIUM';
    else dataQuality = 'HIGH';

    const ema9Series = this.calculateEMASeries(closes, settings.emaFast);
    const ema21Series = this.calculateEMASeries(closes, settings.emaSlow);
    const ema50Series = this.calculateEMASeries(closes, 50);
    const rsiSeries = this.calculateRSISeries(closes, settings.rsiPeriod);
    const macdData = this.calculateMACDSeries(
      closes,
      settings.macdFast,
      settings.macdSlow,
      settings.macdSignal
    );
    const atr = this.calculateATRWilder(bars, settings.atrPeriod);
    const vwap = this.calculateVWAP(bars);

    const lastIndex = closes.length - 1;

    const result = {
      ema9: ema9Series ? ema9Series[lastIndex] : 0,
      ema21: ema21Series ? ema21Series[lastIndex] : 0,
      ema50: ema50Series ? ema50Series[lastIndex] : 0,
      rsi: rsiSeries ? rsiSeries[lastIndex] : 50,
      atr,
      vwap,
      macd: macdData ? {
        macd: macdData.macd,
        signal: macdData.signal,
        histogram: macdData.histogram,
      } : null,
      settings,
      dataQuality,
    };

    if (debug) {
      result.series = {
        ema9: ema9Series,
        ema21: ema21Series,
        ema50: ema50Series,
        rsi: rsiSeries,
        macd: macdData,
      };
    }

    return result;
  }

  static _getSettings(timeframe) {
    const settings = {
      '1': { rsiPeriod: 9, atrPeriod: 10, emaFast: 5, emaSlow: 13, macdFast: 6, macdSlow: 13, macdSignal: 5 },
      '5': { rsiPeriod: 12, atrPeriod: 14, emaFast: 9, emaSlow: 21, macdFast: 8, macdSlow: 17, macdSignal: 9 },
      '15': { rsiPeriod: 14, atrPeriod: 14, emaFast: 9, emaSlow: 21, macdFast: 12, macdSlow: 26, macdSignal: 9 },
      '60': { rsiPeriod: 14, atrPeriod: 14, emaFast: 12, emaSlow: 26, macdFast: 12, macdSlow: 26, macdSignal: 9 },
      'day': { rsiPeriod: 21, atrPeriod: 20, emaFast: 20, emaSlow: 50, macdFast: 12, macdSlow: 26, macdSignal: 9 },
    };
    return settings[timeframe] || settings['5'];
  }
}
