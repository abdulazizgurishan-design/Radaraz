// lib/radar/core/FeatureStore.js
export class FeatureStore {
  constructor(config = {}) {
    this.version = config.version || 3;
    this.cache = new Map();
  }

  // استخراج الميزات من البيانات
  extractFeatures(symbol, price, bars, marketData, sectorData) {
    const cacheKey = `${symbol}_${this.version}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const closes = bars?.map(b => b.c) || [];
    const highs = bars?.map(b => b.h) || [];
    const lows = bars?.map(b => b.l) || [];
    const volumes = bars?.map(b => b.v) || [];

    const features = {
      version: this.version,
      price,
      high: highs[highs.length - 1] || 0,
      low: lows[lows.length - 1] || 0,
      close: closes[closes.length - 1] || 0,
      rsi14: this._calculateRSI(closes, 14),
      atr14: this._calculateATR(bars, 14),
      ema9: this._calculateEMA(closes, 9),
      ema21: this._calculateEMA(closes, 21),
      ema50: this._calculateEMA(closes, 50),
      volume: volumes[volumes.length - 1] || 0,
      avgVolume: this._calculateSMA(volumes, 20),
      relativeVolume: this._calculateRelativeVolume(volumes),
      vwap: null,
      vwapDistance: 0,
      ma21: this._calculateSMA(closes, 21),
      ma50: this._calculateSMA(closes, 50),
      changePct: 0,
      gapPercent: this._calculateGap(bars),
      marketRegime: marketData?.regime || 'neutral',
      spyChange: marketData?.spy?.change || 0,
      sector: sectorData?.sector || null,
      sectorStrength: sectorData?.strength || 0.5,
      timestamp: new Date().toISOString(),
    };

    // حساب VWAP
    if (bars && bars.length > 0) {
      let vwapSum = 0, volSum = 0;
      for (const bar of bars) {
        const typical = (bar.h + bar.l + bar.c) / 3;
        vwapSum += typical * bar.v;
        volSum += bar.v;
      }
      features.vwap = volSum > 0 ? vwapSum / volSum : 0;
      features.vwapDistance = features.vwap > 0 ? ((price - features.vwap) / features.vwap) * 100 : 0;
    }

    // تغير السعر
    if (closes.length >= 2) {
      features.changePct = ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
    }

    this.cache.set(cacheKey, features);
    return features;
  }

  // ─── دوال حساب المؤشرات ──────────────────────────────

  _calculateRSI(closes, period) {
    if (!closes || closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    return Math.round(100 - 100 / (1 + avgGain / avgLoss));
  }

  _calculateATR(bars, period) {
    if (!bars || bars.length < period + 1) return 0;
    const trs = [];
    for (let i = 1; i < bars.length; i++) {
      trs.push(Math.max(
        bars[i].h - bars[i].l,
        Math.abs(bars[i].h - bars[i-1].c),
        Math.abs(bars[i].l - bars[i-1].c)
      ));
    }
    if (trs.length < period) return 0;
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  _calculateEMA(closes, period) {
    if (!closes || closes.length < period) return 0;
    const multiplier = 2 / (period + 1);
    let ema = closes[0];
    for (let i = 1; i < closes.length; i++) {
      ema = (closes[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  _calculateSMA(arr, period) {
    if (!arr || arr.length < period) return 0;
    return arr.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  _calculateRelativeVolume(volumes) {
    const avg = this._calculateSMA(volumes, 20);
    const last = volumes[volumes.length - 1] || 0;
    return avg > 0 ? last / avg : 0;
  }

  _calculateGap(bars) {
    if (!bars || bars.length < 2) return 0;
    const currentOpen = bars[bars.length - 1].o;
    const prevClose = bars[bars.length - 2].c;
    if (prevClose === 0) return 0;
    return ((currentOpen - prevClose) / prevClose) * 100;
  }

  getFeatures(symbol, price, bars, marketData, sectorData) {
    return this.extractFeatures(symbol, price, bars, marketData, sectorData);
  }

  clearCache() {
    this.cache.clear();
  }
}
