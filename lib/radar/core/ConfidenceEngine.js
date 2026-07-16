// lib/radar/core/ConfidenceEngine.js — v16
export class ConfidenceEngine {
  constructor(config = {}) {
    this.config = {
      minDataPoints: 10,
      ...config,
    };
  }

  calculate(signal, features, historicalData = null) {
    let confidence = 70;
    const factors = [];

    // ─── 1. جودة البيانات ──────────────────────────────────
    let dataQuality = 100;
    if (!signal.bars || signal.bars.length < 30) {
      dataQuality -= 20;
      factors.push({ factor: 'بيانات كافية', impact: -20 });
    }
    if (!signal.price || signal.price <= 0) {
      dataQuality -= 30;
      factors.push({ factor: 'سعر صحيح', impact: -30 });
    }
    if (dataQuality < 50) {
      factors.push({ factor: 'جودة البيانات', impact: -20 });
    }
    confidence = confidence * (dataQuality / 100);

    // ─── 2. اتساق الـ Brains ──────────────────────────────
    const brainResults = signal.brainResults || {};
    const scores = Object.values(brainResults).map(r => r?.score || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length || 50;
    const variance = scores.reduce((a, b) => a + Math.pow(b - avgScore, 2), 0) / scores.length;

    if (variance < 100) {
      confidence += 10;
      factors.push({ factor: 'اتساق الـ Brains', impact: 10 });
    } else if (variance > 400) {
      confidence -= 10;
      factors.push({ factor: 'تباين الـ Brains', impact: -10 });
    }

    // ─── 3. السيولة ────────────────────────────────────────
    const rvol = features.relativeVolume || 1;
    if (rvol > 2) {
      confidence += 10;
      factors.push({ factor: 'سيولة عالية', impact: 10 });
    } else if (rvol < 0.8) {
      confidence -= 10;
      factors.push({ factor: 'سيولة منخفضة', impact: -10 });
    }

    // ─── 4. السوق ──────────────────────────────────────────
    const regime = features.marketRegime || 'neutral';
    if (regime === 'strong' || regime === 'strong_bull') {
      confidence += 10;
      factors.push({ factor: 'سوق قوي', impact: 10 });
    } else if (regime === 'bear' || regime === 'weak') {
      confidence -= 10;
      factors.push({ factor: 'سوق ضعيف', impact: -10 });
    }

    // ─── 5. البيانات التاريخية (إذا كانت متاحة) ──────────
    if (historicalData && historicalData.length > 0) {
      const similarSignals = historicalData.filter(h =>
        Math.abs(h.predictionScore - signal.predictionScore) < 5
      );
      if (similarSignals.length > 10) {
        const winRate = similarSignals.filter(h => h.success).length / similarSignals.length;
        const adjustment = (winRate - 0.5) * 20;
        confidence += adjustment;
        factors.push({
          factor: 'أداء تاريخي',
          impact: Math.round(adjustment),
          details: `${similarSignals.length} صفقة مشابهة`,
        });
      }
    }

    // ─── 6. التصنيف ────────────────────────────────────────
    const grade = signal.grade || 'WATCH';
    const gradeAdjustments = {
      ELITE: 10,
      PRIME: 7,
      STRONG: 4,
      GOOD: 0,
      WATCH: -5,
      AVOID: -15,
    };
    const gradeAdj = gradeAdjustments[grade] || 0;
    confidence += gradeAdj;
    if (gradeAdj !== 0) {
      factors.push({ factor: `تصنيف ${grade}`, impact: gradeAdj });
    }

    // ─── 7. النتيجة النهائية ──────────────────────────────
    let finalConfidence = Math.min(Math.max(confidence, 0), 100);

    // ─── 8. مستوى الثقة ──────────────────────────────────
    let level = 'متوسطة';
    if (finalConfidence >= 80) level = 'عالية جداً';
    else if (finalConfidence >= 70) level = 'عالية';
    else if (finalConfidence >= 55) level = 'متوسطة';
    else if (finalConfidence >= 40) level = 'منخفضة';
    else level = 'منخفضة جداً';

    return {
      confidence: Math.round(finalConfidence),
      level,
      factors: factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
      breakdown: factors,
    };
  }
}
