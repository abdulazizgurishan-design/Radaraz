// lib/radar/core/ProbabilityEngine.js — v17
export class ProbabilityEngine {
  constructor(config = {}) {
    this.config = {
      minSamples: 20,
      ...config,
    };
  }

  calculate(signal, historicalData = null) {
    const predictionScore = signal.predictionScore || 50;
    const grade = signal.grade || 'WATCH';
    const timing = signal.timing || 'UNKNOWN';

    // ─── 1. الاحتمال الأساسي من Prediction Score ──────
    let baseProb = predictionScore / 100;

    // ─── 2. تعديل حسب التصنيف ──────────────────────────
    const gradeMultipliers = {
      ELITE: 1.15,
      PRIME: 1.08,
      STRONG: 1.02,
      GOOD: 0.95,
      WATCH: 0.85,
      AVOID: 0.60,
    };
    const gradeMult = gradeMultipliers[grade] || 0.90;

    // ─── 3. تعديل حسب التوقيت ──────────────────────────
    const timingMultipliers = {
      PRE_BREAKOUT: 1.10,
      BREAKOUT: 1.05,
      EARLY_MOMENTUM: 1.02,
      WAIT: 0.90,
      LATE: 0.70,
    };
    const timingMult = timingMultipliers[timing] || 0.90;

    // ─── 4. الاحتمال النهائي ────────────────────────────
    let probT1 = baseProb * gradeMult * timingMult;
    let probT2 = probT1 * 0.75;
    let probT3 = probT2 * 0.65;

    // ─── 5. تعديل من البيانات التاريخية ──────────────────
    if (historicalData && historicalData.length > 0) {
      const similarSignals = historicalData.filter(h =>
        Math.abs(h.predictionScore - predictionScore) < 5
      );

      if (similarSignals.length > this.config.minSamples) {
        const actualT1 = similarSignals.filter(h => h.reachedT1).length / similarSignals.length;
        const actualT2 = similarSignals.filter(h => h.reachedT2).length / similarSignals.length;
        const actualT3 = similarSignals.filter(h => h.reachedT3).length / similarSignals.length;

        // تصحيح الاحتمالات بالبيانات الفعلية
        probT1 = (probT1 + actualT1) / 2;
        probT2 = (probT2 + actualT2) / 2;
        probT3 = (probT3 + actualT3) / 2;
      }
    }

    // ─── 6. التأكد من النطاق ────────────────────────────
    probT1 = Math.min(Math.max(probT1, 0), 1);
    probT2 = Math.min(Math.max(probT2, 0), probT1);
    probT3 = Math.min(Math.max(probT3, 0), probT2);

    // ─── 7. حساب Expected Return ──────────────────────────
    const avgWin = 0.08;
    const avgLoss = 0.06;
    const expectedReturn = (probT1 * avgWin) - ((1 - probT1) * avgLoss);

    return {
      t1: Math.round(probT1 * 100),
      t2: Math.round(probT2 * 100),
      t3: Math.round(probT3 * 100),
      expectedReturn: Math.round(expectedReturn * 100),
      grade,
      timing,
      baseScore: predictionScore,
    };
  }
}
