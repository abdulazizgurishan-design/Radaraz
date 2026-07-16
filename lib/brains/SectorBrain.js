// lib/radar/brains/SectorBrain.js
import { Brain } from '../core/Brain.js';

export class SectorBrain extends Brain {
  static dependencies = ['Market Brain'];

  constructor(config = {}) {
    super('Sector Brain', {
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
    const sectorData = context.sectorData || {};

    const sector = sectorData.sector || 'غير معروف';
    const sectorStrength = sectorData.strength || 0.5;

    let score = 50;
    let confidence = 60;

    // 1. قوة القطاع
    if (sectorStrength >= 0.7) {
      score += 25;
      confidence += 15;
      reasons.push(`✅ قطاع ${sector} قوي (${(sectorStrength * 100).toFixed(0)}%)`);
    } else if (sectorStrength >= 0.5) {
      score += 15;
      confidence += 10;
      reasons.push(`📊 قطاع ${sector} جيد (${(sectorStrength * 100).toFixed(0)}%)`);
    } else {
      warnings.push(`⚠️ قطاع ${sector} ضعيف (${(sectorStrength * 100).toFixed(0)}%)`);
      score -= 10;
      confidence -= 10;
    }

    // 2. اتجاه القطاع مقابل SPY
    const spyChange = features.spyChange || 0;
    const sectorChange = sectorData.change || 0;
    const relativeStrength = sectorChange - spyChange;

    if (relativeStrength > 1) {
      score += 15;
      reasons.push(`✅ القطاع أقوى من SPY بنسبة ${relativeStrength.toFixed(1)}%`);
    } else if (relativeStrength > 0) {
      score += 8;
      reasons.push(`📊 القطاع متوافق مع SPY`);
    } else {
      warnings.push(`⚠️ القطاع أضعف من SPY بنسبة ${Math.abs(relativeStrength).toFixed(1)}%`);
      score -= 10;
    }

    // 3. النتيجة النهائية
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.sector = sector;
    metrics.sectorStrength = sectorStrength;
    metrics.relativeStrength = relativeStrength;
    metrics.sectorScore = finalScore;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
