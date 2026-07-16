// lib/radar/core/DecisionEngine.js — v14 (مع Timing)
import { CONFIG } from './config.js';

export class DecisionEngine {
  constructor(config = {}) {
    this.config = {
      thresholds: CONFIG.thresholds,
      gates: CONFIG.gates,
      timing: CONFIG.timing,
      ...config,
    };
  }

  decide(context) {
    const results = context.getAllBrainResults();
    const reasons = [];
    const warnings = [];
    const metrics = {};

    // ─── 1. استخراج النتائج ────────────────────────────
    const market = results['Market Brain'];
    const liquidity = results['Liquidity Brain'];
    const momentum = results['Momentum Brain'];
    const trend = results['Trend Brain'];
    const structure = results['Structure Brain'];
    const dna = results['DNA Brain'];
    const sector = results['Sector Brain'];
    const relativeStrength = results['RelativeStrength Brain'];
    const risk = results['Risk Brain'];
    const portfolio = results['Portfolio Brain'];

    // ─── 2. الأسئلة المنطقية (10 أسئلة) ────────────────
    let score = 50;
    let confidence = 50;
    let passedGates = 0;
    const totalGates = 10;

    // س1: هل السوق يسمح بالدخول؟
    if (market && market.verdict === 'bullish' && market.score >= 60) {
      score += 8;
      confidence += 5;
      reasons.push('✅ السوق داعم');
      passedGates++;
    } else if (market && market.verdict === 'bearish') {
      warnings.push('⚠️ السوق ضعيف');
      score -= 10;
      confidence -= 10;
    } else {
      passedGates++;
    }

    // س2: هل القطاع قوي؟
    if (sector && sector.verdict === 'bullish' && sector.score >= 60) {
      score += 6;
      confidence += 5;
      reasons.push('✅ القطاع قوي');
      passedGates++;
    } else if (sector && sector.verdict === 'bearish') {
      warnings.push('⚠️ القطاع ضعيف');
      score -= 8;
      confidence -= 5;
    } else {
      passedGates++;
    }

    // س3: هل السهم أقوى من القطاع؟
    if (relativeStrength && relativeStrength.verdict === 'bullish') {
      score += 6;
      reasons.push('✅ السهم أقوى من القطاع');
      passedGates++;
    } else {
      passedGates++;
    }

    // س4: هل يوجد تجميع حقيقي؟
    if (liquidity && liquidity.score >= 65) {
      score += 10;
      confidence += 5;
      reasons.push('✅ تجميع واضح');
      passedGates++;
    } else {
      warnings.push('⚠️ لا يوجد تجميع واضح');
      score -= 5;
    }

    // س5: هل الاختراق قريب؟
    if (structure && structure.metrics?.resistanceDistance !== undefined) {
      const dist = structure.metrics.resistanceDistance;
      if (dist <= 3) {
        score += 10;
        reasons.push(`✅ اختراق قريب (${dist.toFixed(1)}%)`);
        passedGates++;
      } else if (dist <= 6) {
        score += 5;
        reasons.push(`📊 اختراق متوسط (${dist.toFixed(1)}%)`);
        passedGates++;
      } else {
        warnings.push(`⚠️ بعيد عن الاختراق (${dist.toFixed(1)}%)`);
        score -= 5;
      }
    }

    // س6: هل المسافة للمقاومة مناسبة؟
    // (نفس السؤال 5)

    // س7: هل نسبة العائد للمخاطرة ممتازة؟
    if (structure && structure.metrics?.rr !== undefined) {
      const rr = structure.metrics.rr;
      if (rr >= 2.0) {
        score += 8;
        reasons.push(`✅ RR ممتاز (${rr.toFixed(1)})`);
        passedGates++;
      } else if (rr >= 1.5) {
        score += 5;
        reasons.push(`📊 RR جيد (${rr.toFixed(1)})`);
        passedGates++;
      } else if (rr < 1.0) {
        warnings.push(`⚠️ RR منخفض (${rr.toFixed(1)})`);
        score -= 10;
      }
    }

    // س8: هل المخاطرة مقبولة؟
    if (risk && risk.score >= 60) {
      score += 8;
      confidence += 5;
      reasons.push('✅ مخاطرة منخفضة');
      passedGates++;
    } else if (risk && risk.score < 40) {
      warnings.push('⚠️ مخاطرة عالية');
      score -= 15;
      confidence -= 10;
    } else {
      passedGates++;
    }

    // س9: هل لدينا صفقة أفضل؟
    // (يتم تقييمه في الـ Ranking)

    // س10: هل الوقت مناسب للدخول؟
    const timing = this._determineTiming(structure, momentum);
    if (timing === 'PRE_BREAKOUT' || timing === 'BREAKOUT') {
      score += 8;
      reasons.push(`✅ التوقيت: ${timing}`);
      passedGates++;
    } else if (timing === 'LATE_MOMENTUM' || timing === 'EXHAUSTION') {
      warnings.push(`⚠️ التوقيت: ${timing}`);
      score -= 10;
      confidence -= 10;
    } else {
      passedGates++;
    }

    // ─── 3. التصنيف النهائي ────────────────────────────
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    // التحقق من الشروط الأساسية (Gating)
    const isGated = passedGates >= CONFIG.gates.minConfidence / 10 &&
                    (risk?.score || 50) >= CONFIG.gates.maxRisk &&
                    (structure?.metrics?.rr || 0) >= CONFIG.gates.minRR;

    let grade, gradeLabel;
    const t = this.config.thresholds;

    if (isGated && finalScore >= t.ELITE) {
      grade = 'ELITE';
      gradeLabel = '🏆 نخبة';
    } else if (isGated && finalScore >= t.PRIME) {
      grade = 'PRIME';
      gradeLabel = '⭐ ممتاز';
    } else if (finalScore >= t.STRONG) {
      grade = 'STRONG';
      gradeLabel = '💪 قوي';
    } else if (finalScore >= t.GOOD) {
      grade = 'GOOD';
      gradeLabel = '📊 جيد';
    } else if (finalScore >= t.WATCH) {
      grade = 'WATCH';
      gradeLabel = '👀 مراقبة';
    } else {
      grade = 'AVOID';
      gradeLabel = '❌ تجنب';
    }

    metrics.gatesPassed = passedGates;
    metrics.totalGates = totalGates;
    metrics.timing = timing;

    return {
      score: Math.round(finalScore),
      confidence: Math.round(finalConfidence),
      grade,
      gradeLabel,
      timing,
      reasons,
      warnings,
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Timing Detection ──────────────────────────────
  _determineTiming(structure, momentum) {
    if (!structure || !momentum) return 'UNKNOWN';

    const resistanceDist = structure.metrics?.resistanceDistance || 100;
    const changePct = momentum.metrics?.changePct || 0;
    const rr = structure.metrics?.rr || 0;

    // PRE-BREAKOUT
    if (resistanceDist <= 3 && resistanceDist > 0 && rr >= 2.0) {
      return 'PRE_BREAKOUT';
    }

    // BREAKOUT
    if (resistanceDist <= 0 && rr >= 1.5) {
      return 'BREAKOUT';
    }

    // EARLY MOMENTUM
    if (changePct > 0 && changePct <= 5 && rr >= 1.2) {
      return 'EARLY_MOMENTUM';
    }

    // LATE MOMENTUM
    if (changePct > 5 && changePct <= 10 && rr >= 0.8) {
      return 'LATE_MOMENTUM';
    }

    // EXHAUSTION
    if (changePct > 10) {
      return 'EXHAUSTION';
    }

    return 'UNKNOWN';
  }
}
