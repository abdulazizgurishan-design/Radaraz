// lib/radar/services/ConfidenceEngine.js
export class ConfidenceEngine {
  static calculateBreakdown(featureVector) {
    const breakdown = {
      rvol: Math.min(featureVector.rvol / 10, 0.25) * 100,
      trend: (featureVector.ema9 > featureVector.ema21 ? 0.20 : 0.05) * 100,
      sector: (featureVector.sector_rank < 3 ? 0.15 : 0.05) * 100,
      market: (featureVector.spy > 0 ? 0.15 : 0.05) * 100,
      pattern: (featureVector.rsi > 50 ? 0.10 : 0.05) * 100,
    };

    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const normalized = {};
    Object.keys(breakdown).forEach(key => {
      normalized[key] = parseFloat(((breakdown[key] / total) * 100).toFixed(1));
    });

    return {
      total: Math.min(Math.round(total), 100),
      breakdown: normalized,
    };
  }
}
