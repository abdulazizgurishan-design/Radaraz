// lib/radar/brains/LiquidityBrain.js
import { Brain } from '../core/Brain.js';

export class LiquidityBrain extends Brain {
  static dependencies = ['Market Brain'];

  constructor(config = {}) {
    super('Liquidity Brain', {
      weight: 1.0,
      enabled: true,
      timeHorizon: 'intraday',
      ...config,
    });
  }

  async analyze(context) {
    const reasons = [];
    const warnings = [];
    const metrics = {};

    const features = context.features || {};
    const symbolData = context.symbolData || {};

    const price = context.price || 0;
    const volume = symbolData.volume || 0;
    const dollarVol = symbolData.dollar_vol || 0;
    const rvol = features.relativeVolume || 0;

    let score = 50;
    let confidence = 60;

    // 1. RVOL
    if (rvol >= 3) {
      score += 25;
      confidence += 15;
      reasons.push(`✅ RVOL ${rvol.toFixed(1)}x (حجم ضخم)`);
    } else if (rvol >= 2) {
      score += 20;
      confidence += 10;
      reasons.push(`✅ RVOL ${rvol.toFixed(1)}x (حجم قوي)`);
    } else if (rvol >= 1.5) {
      score += 10;
      confidence += 5;
      reasons.push(`📊 RVOL ${rvol.toFixed(1)}x (حجم جيد)`);
    } else {
      warnings.push(`⚠️ RVOL ${rvol.toFixed(1)}x (حجم منخفض)`);
      score -= 10;
      confidence -= 10;
    }

    // 2. Dollar Volume
    if (dollarVol >= 10_000_000) {
      score += 20;
      reasons.push(`✅ Dollar Volume $${(dollarVol / 1_000_000).toFixed(0)}M (سيولة ممتازة)`);
    } else if (dollarVol >= 5_000_000) {
      score += 15;
      reasons.push(`📊 Dollar Volume $${(dollarVol / 1_000_000).toFixed(0)}M (سيولة جيدة)`);
    } else if (dollarVol >= 1_000_000) {
      score += 8;
      reasons.push(`📊 Dollar Volume $${(dollarVol / 1_000_000).toFixed(0)}M (سيولة مقبولة)`);
    } else {
      warnings.push(`⚠️ Dollar Volume $${(dollarVol / 1_000_000).toFixed(1)}M (سيولة منخفضة)`);
      score -= 10;
      confidence -= 5;
    }

    // 3. الحجم المطلق
    if (volume >= 1_000_000) {
      score += 10;
      reasons.push(`✅ حجم ${(volume / 1_000_000).toFixed(1)}M (مرتفع)`);
    } else if (volume >= 500_000) {
      score += 5;
      reasons.push(`📊 حجم ${(volume / 1_000_000).toFixed(1)}M (جيد)`);
    }

    // 4. النتيجة النهائية
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.rvol = rvol;
    metrics.volume = volume;
    metrics.dollarVol = dollarVol;
    metrics.liquidityScore = finalScore;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
