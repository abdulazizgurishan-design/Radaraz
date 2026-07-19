// lib/radar/core/IndicatorEngine.js
// ============================================================
// RadarAZ v20.1 - Indicator Engine
// ✅ EMA Series (O(n))
// ✅ RSI Series (كامل)
// ✅ MACD Series (O(n) مع محاذاة صحيحة)
// ✅ ATR Wilder (مرة واحدة)
// ============================================================

export class IndicatorEngine {
  // ─── EMA Series (O(n)) ──────────────────────────────────
  static calculateEMASeries(closes, period) {
    if (!closes || closes.length < period) return null;

    const result = [];
    let sma = 0;
    for (let i = 0; i < period; i++) {
      sma += closes[i];
    }
    sma /= period;
    result.push(sma);

    const k = 2 / (period + 1);
    let ema = sma;
    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
      result.push(ema);
    }

    return result;
  }

  // ─── RSI Series (كامل) ──────────────────────────────────
  static calculateRSISeries(closes, period = 14) {
    if (!closes || closes.length < period + 1) {
      return closes.map(() => 50);
    }

    const result = [];
    let avgGain = 0, avgLoss = 0;

    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) avgGain += diff;
      else avgLoss -= diff;
    }
    avgGain /= period;
    avgLoss /= period;

    if (avgLoss === 0) result.push(100);
    else {
      const rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
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

      if (avgLoss === 0) result.push(100);
      else {
        const rs = avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
      }
    }

    return result;
  }

  static calculateRSI(closes, period = 14) {
    const series = this.calculateRSISeries(closes, period);
    return series ? series[series.length - 1] : 50;
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

  // ─── MACD Series (O(n) مع محاذاة صحيحة) ──────────────
  static calculateMACDSeries(closes, fast = 12, slow = 26, signal = 9) {
    if (!closes || closes.length < slow) return null;

    // حساب EMA Series للـ fast و slow
    const emaFastSeries = this.calculateEMASeries(closes, fast);
    const emaSlowSeries = this.calculateEMASeries(closes, slow);

    if (!emaFastSeries || !emaSlowSeries) return null;

    // محاذاة: نأخذ أطول سلسلة (عادة slow)
    const macdValues = [];
    const minLength = Math.min(emaFastSeries.length, emaSlowSeries.length);

    // نبدأ من الفهرس الذي تتوفر فيه كلتا السلسلتين
    for (let i = 0; i < minLength; i++) {
      macdValues.push(emaFastSeries[i] - emaSlowSeries[i]);
    }

    if (macdValues.length < signal) {
      return {
        macd: macdValues[macdValues.length - 1] || 0,
        signal: 0,
        histogram: 0,
        macdValues,
      };
    }

    // حساب Signal Line من سلسلة MACD
    const signalLine = this.calculateEMASeries(macdValues, signal);
    const lastMacd = macdValues[macdValues.length - 1] || 0;
    const lastSignal = signalLine ? signalLine[signalLine.length - 1] : 0;

    return {
      macd: lastMacd,
      signal: lastSignal,
      histogram: lastMacd - lastSignal,
      macdValues,
      signalValues: signalLine,
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

  // ─── حساب الكل (مع خيار Debug) ────────────────────────
  static calculateAll(bars, timeframe = '5', debug = false) {
    const closes = bars.map(b => b.close);
    const settings = this._getSettings(timeframe);

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
      ema9: ema9Series ? ema9Series[ema9Series.length - 1] : null,
      ema21: ema21Series ? ema21Series[ema21Series.length - 1] : null,
      ema50: ema50Series ? ema50Series[ema50Series.length - 1] : null,
      rsi: rsiSeries ? rsiSeries[rsiSeries.length - 1] : 50,
      atr,
      vwap,
      macd: macdData ? {
        macd: macdData.macd,
        signal: macdData.signal,
        histogram: macdData.histogram,
      } : null,
      settings,
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
