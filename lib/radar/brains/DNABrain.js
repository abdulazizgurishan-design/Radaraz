// lib/radar/brains/DNABrain.js
import { Brain } from '../core/Brain.js';

export class DNABrain extends Brain {
  static dependencies = ['Market Brain'];

  constructor(config = {}) {
    super('DNA Brain', {
      weight: 0.8,
      enabled: true,
      timeHorizon: 'swing',
      ...config,
    });
  }

  async analyze(context) {
    const reasons = [];
    const warnings = [];
    const metrics = {};

    const features = context.features || {};
    const bars = context.bars || [];
    const symbolData = context.symbolData || {};

    const price = context.price || 0;
    const closes = bars.map(b => b.c);
    const highs = bars.map(b => b.h);
    const lows = bars.map(b => b.l);
    const volumes = bars.map(b => b.v);

    let score = 50;
    let confidence = 50;

    // 1. Trend Score
    let trendScore = 50;
    if (closes.length >= 50) {
      const ma21 = features.ma21 || 0;
      const ma50 = features.ma50 || 0;
      if (ma21 > ma50) {
        const diff = (ma21 - ma50) / ma50;
        trendScore = Math.min(50 + diff * 200, 95);
      } else {
        const diff = (ma50 - ma21) / ma50;
        trendScore = Math.max(50 - diff * 100, 10);
      }
    }

    // 2. Average Intraday Move
    let avgMove = 0;
    if (bars.length >= 20) {
      let totalMove = 0;
      for (let i = 0; i < bars.length; i++) {
        totalMove += (highs[i] - lows[i]) / lows[i];
      }
      avgMove = (totalMove / bars.length) * 100;
    }

    // 3. Volatility
    let volatility = 0;
    if (closes.length >= 20) {
      let sqSum = 0;
      for (let i = 1; i < closes.length; i++) {
        const ret = (closes[i] - closes[i - 1]) / closes[i - 1];
        sqSum += ret * ret;
      }
      volatility = Math.sqrt(sqSum / (closes.length - 1)) * 100;
    }

    // 4. Breakout Quality
    let breakoutQuality = 'C';
    if (bars.length >= 20) {
      const last20High = Math.max(...highs.slice(-20));
      const lastHigh = highs[highs.length - 1];
      const breakPct = ((lastHigh - last20High) / last20High) * 100;
      if (breakPct > 3) breakoutQuality = 'A';
      else if (breakPct > 1.5) breakoutQuality = 'B';
      else if (breakPct > 0.5) breakoutQuality = 'C';
      else breakoutQuality = 'D';
    }

    // 5. Preferred Volume
    let preferredVolume = 'متوسط';
    if (volumes.length >= 20) {
      const avgVol = features.avgVolume || 1;
      const lastVol = volumes[volumes.length - 1] || 0;
      const ratio = lastVol / avgVol;
      if (ratio > 2) preferredVolume = 'مرتفع';
      else if (ratio > 1.3) preferredVolume = 'جيد';
      else preferredVolume = 'متوسط';
    }

    // 6. Gap Success (تقديري)
    let gapSuccess = 50;

    // حساب النتيجة النهائية
    score = trendScore * 0.3 + (100 - Math.min(avgMove * 2, 40)) * 0.2 +
            (100 - Math.min(volatility * 2, 40)) * 0.2 +
            (breakoutQuality === 'A' ? 90 : breakoutQuality === 'B' ? 75 : breakoutQuality === 'C' ? 60 : 40) * 0.2 +
            (preferredVolume === 'مرتفع' ? 80 : preferredVolume === 'جيد' ? 65 : 50) * 0.1;

    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence + (finalScore - 50) / 5, 30), 90);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.trendScore = trendScore;
    metrics.avgMove = avgMove;
    metrics.volatility = volatility;
    metrics.breakoutQuality = breakoutQuality;
    metrics.preferredVolume = preferredVolume;
    metrics.dnaScore = finalScore;

    if (finalScore >= 70) {
      reasons.push(`✅ DNA قوي (Trend ${trendScore.toFixed(0)}, Breakout ${breakoutQuality})`);
    }

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
