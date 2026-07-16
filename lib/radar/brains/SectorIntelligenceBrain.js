// lib/radar/brains/SectorIntelligenceBrain.js — v17
import { Brain } from '../core/Brain.js';

export class SectorIntelligenceBrain extends Brain {
  static dependencies = ['Market Brain'];

  constructor(config = {}) {
    super('Sector Intelligence Brain', {
      weight: 1.2,
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
    const symbol = context.symbol || '';

    // ─── 1. قوة القطاع الحقيقية ────────────────────────
    // يجب أن تأتي من API خارجي أو قاعدة بيانات
    // هذه بيانات افتراضية، سيتم استبدالها بـ Supabase
    const sectorStrengthMap = {
      'Technology': 18,
      'Healthcare': 7,
      'Energy': -2,
      'Financial': 11,
      'Consumer': 5,
      'Industrial': 3,
      'Utilities': -5,
      'Real Estate': -3,
      'Materials': 2,
      'Communication': 8,
    };

    const sector = sectorData.sector || 'unknown';
    const sectorMomentum = sectorStrengthMap[sector] || 0;

    // ─── 2. ترتيب القطاع ────────────────────────────────
    const sortedSectors = Object.entries(sectorStrengthMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const sectorRank = sortedSectors.indexOf(sector) + 1;
    const totalSectors = sortedSectors.length;
    const sectorPercentile = ((totalSectors - sectorRank) / totalSectors) * 100;

    // ─── 3. حساب النقاط ──────────────────────────────────
    let score = 50;
    let confidence = 60;

    // قوة القطاع
    if (sectorMomentum > 10) {
      score += 20;
      confidence += 10;
      reasons.push(`✅ قطاع ${sector} قوي جداً (${sectorMomentum}%)`);
    } else if (sectorMomentum > 5) {
      score += 12;
      confidence += 5;
      reasons.push(`📊 قطاع ${sector} جيد (${sectorMomentum}%)`);
    } else if (sectorMomentum > 0) {
      score += 5;
      reasons.push(`📊 قطاع ${sector} متوسط (${sectorMomentum}%)`);
    } else {
      warnings.push(`⚠️ قطاع ${sector} ضعيف (${sectorMomentum}%)`);
      score -= 10;
      confidence -= 5;
    }

    // ترتيب القطاع
    if (sectorPercentile > 80) {
      score += 10;
      reasons.push(`✅ القطاع من الأقوى (ترتيب ${sectorRank}/${totalSectors})`);
    } else if (sectorPercentile > 60) {
      score += 5;
      reasons.push(`📊 القطاع جيد (ترتيب ${sectorRank}/${totalSectors})`);
    } else if (sectorPercentile < 20) {
      warnings.push(`⚠️ القطاع ضعيف (ترتيب ${sectorRank}/${totalSectors})`);
      score -= 10;
    }

    // ─── 4. حجم القطاع ──────────────────────────────────
    const sectorVolume = sectorData.volume || 1;
    const avgSectorVolume = sectorData.avgVolume || 1;
    const volRatio = sectorVolume / avgSectorVolume;

    if (volRatio > 2) {
      score += 10;
      reasons.push(`✅ حجم قطاع مرتفع (${volRatio.toFixed(1)}x)`);
    } else if (volRatio > 1.5) {
      score += 5;
      reasons.push(`📊 حجم قطاع جيد (${volRatio.toFixed(1)}x)`);
    } else if (volRatio < 0.5) {
      warnings.push(`⚠️ حجم قطاع منخفض (${volRatio.toFixed(1)}x)`);
      score -= 5;
    }

    // ─── 5. النتيجة النهائية ────────────────────────────
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.sector = sector;
    metrics.sectorMomentum = sectorMomentum;
    metrics.sectorRank = sectorRank;
    metrics.sectorPercentile = Math.round(sectorPercentile);
    metrics.sectorVolRatio = volRatio;
    metrics.sectorStrength = finalScore;
    metrics.sectorRecommendation = finalScore >= 80 ? '🔥 قوي جداً' :
      finalScore >= 65 ? '📈 قوي' :
      finalScore >= 50 ? '📊 محايد' : '📉 ضعيف';

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
