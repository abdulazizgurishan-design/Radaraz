// lib/radar/core/FeatureNormalizer.js
// ============================================================
// RadarAZ v20.1 - Feature Normalizer
// ============================================================

export class FeatureNormalizer {
  static normalizeATR(atr, price) {
    const p = Number(price ?? 0);
    const a = Number(atr ?? 0);
    if (p <= 0 || a <= 0) return 0;
    const result = (a / p) * 100;
    return Number.isFinite(result) ? result : 0;
  }

  static calculateZScore(volume, avgVolume, stdDev = null) {
    const v = Number(volume ?? 0);
    const avg = Number(avgVolume ?? 0);
    if (avg <= 0) return 0;
    if (stdDev && Number.isFinite(stdDev) && stdDev > 0) {
      const result = (v - avg) / stdDev;
      return Number.isFinite(result) ? result : 0;
    }
    const result = (v - avg) / avg;
    return Number.isFinite(result) ? result : 0;
  }

  static normalizeEMADistance(price, ema) {
    const p = Number(price ?? 0);
    const e = Number(ema ?? 0);
    if (p <= 0 || e <= 0) return 0;
    const result = ((p - e) / e) * 100;
    return Number.isFinite(result) ? result : 0;
  }

  static normalizeRSI(rsi) {
    const r = Number(rsi ?? 50);
    if (r <= 0) return 0;
    if (r >= 100) return 1;
    const result = r / 100;
    return Number.isFinite(result) ? result : 0.5;
  }

  static normalizeAll(features) {
    const { price = 0, atr = 0, volume = 0, avgVolume = 0, stdDev = null, rsi = 50, ema9 = 0, ema21 = 0 } = features;

    const atrPercent = this.normalizeATR(atr, price);
    const volumeZScore = this.calculateZScore(volume, avgVolume, stdDev);
    const ema9Distance = this.normalizeEMADistance(price, ema9);
    const ema21Distance = this.normalizeEMADistance(price, ema21);
    const normalizedRSI = this.normalizeRSI(rsi);

    return {
      raw: {
        price: Number(price) || 0,
        atr: Number(atr) || 0,
        volume: Number(volume) || 0,
        avgVolume: Number(avgVolume) || 0,
        rsi: Number(rsi) || 50,
        ema9: Number(ema9) || 0,
        ema21: Number(ema21) || 0,
      },
      normalized: {
        atrPercent: parseFloat(atrPercent.toFixed(4)),
        volumeZScore: parseFloat(volumeZScore.toFixed(4)),
        ema9Distance: parseFloat(ema9Distance.toFixed(4)),
        ema21Distance: parseFloat(ema21Distance.toFixed(4)),
        normalizedRSI: parseFloat(normalizedRSI.toFixed(4)),
      },
    };
  }

  static normalizeBatch(featuresArray) {
    if (!Array.isArray(featuresArray) || featuresArray.length === 0) return [];
    return featuresArray.map(f => this.normalizeAll(f));
  }
}
