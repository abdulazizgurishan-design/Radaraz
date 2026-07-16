// lib/radar/core/DynamicWeightsEngine.js — v16
export class DynamicWeightsEngine {
  constructor(config = {}) {
    this.config = {
      // الأوزان الأساسية
      baseWeights: {
        earlyAccumulation: 0.30,
        breakoutProbability: 0.25,
        structure: 0.20,
        liquidity: 0.15,
        marketContext: 0.10,
        sectorStrength: 0.00, // يُضاف ديناميكياً
      },
      // تعديلات حسب الجلسة
      sessionAdjustments: {
        premarket: {
          earlyAccumulation: 1.4,
          liquidity: 1.3,
          marketContext: 1.2,
          structure: 0.8,
          breakoutProbability: 0.7,
        },
        golden: {
          earlyAccumulation: 1.2,
          breakoutProbability: 1.3,
          structure: 1.1,
          liquidity: 1.0,
          marketContext: 0.8,
        },
        open: {
          earlyAccumulation: 1.0,
          breakoutProbability: 1.0,
          structure: 1.0,
          liquidity: 1.0,
          marketContext: 1.0,
        },
        late: {
          earlyAccumulation: 0.7,
          structure: 1.3,
          breakoutProbability: 1.2,
          liquidity: 0.8,
          marketContext: 0.8,
        },
        afterhours: {
          earlyAccumulation: 0.6,
          liquidity: 1.5,
          marketContext: 1.3,
          structure: 0.6,
          breakoutProbability: 0.5,
        },
        closed: {
          earlyAccumulation: 0.5,
          liquidity: 0.5,
          structure: 0.5,
          breakoutProbability: 0.5,
          marketContext: 0.5,
        },
      },
      // تعديلات حسب حالة السوق
      regimeAdjustments: {
        strong_bull: {
          earlyAccumulation: 1.2,
          breakoutProbability: 1.3,
          structure: 1.1,
          liquidity: 1.0,
          marketContext: 0.8,
        },
        bull: {
          earlyAccumulation: 1.1,
          breakoutProbability: 1.2,
          structure: 1.0,
          liquidity: 1.0,
          marketContext: 0.9,
        },
        neutral: {
          earlyAccumulation: 1.0,
          breakoutProbability: 1.0,
          structure: 1.0,
          liquidity: 1.0,
          marketContext: 1.0,
        },
        weak_bull: {
          earlyAccumulation: 0.8,
          structure: 1.2,
          liquidity: 0.9,
          breakoutProbability: 0.9,
          marketContext: 1.1,
        },
        bear: {
          earlyAccumulation: 0.5,
          structure: 1.5,
          liquidity: 0.7,
          breakoutProbability: 0.6,
          marketContext: 1.3,
        },
      },
      ...config,
    };

    this.learningData = {
      weights: {},
      lastUpdate: null,
    };
  }

  // ─── حساب الأوزان الديناميكية ──────────────────────────
  getWeights(session, regime, performance = null) {
    // 1. الأوزان الأساسية
    let weights = { ...this.config.baseWeights };

    // 2. تعديل حسب الجلسة
    const sessionAdj = this.config.sessionAdjustments[session] || this.config.sessionAdjustments.closed;
    for (const [key, mult] of Object.entries(sessionAdj)) {
      if (weights[key] !== undefined) {
        weights[key] = weights[key] * mult;
      }
    }

    // 3. تعديل حسب حالة السوق
    const regimeAdj = this.config.regimeAdjustments[regime] || this.config.regimeAdjustments.neutral;
    for (const [key, mult] of Object.entries(regimeAdj)) {
      if (weights[key] !== undefined) {
        weights[key] = weights[key] * mult;
      }
    }

    // 4. إضافة Sector Strength إذا كان متاحاً
    weights.sectorStrength = 0.10;

    // 5. تطبيع الأوزان (مجموعها = 1)
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(weights)) {
      weights[key] = weights[key] / total;
    }

    // 6. تحديث من التعلم (إذا كان متاحاً)
    if (performance && Object.keys(performance).length > 0) {
      weights = this._applyLearning(weights, performance);
    }

    return weights;
  }

  // ─── تطبيق نتائج التعلم ──────────────────────────────────
  _applyLearning(weights, performance) {
    const adjusted = { ...weights };
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    for (const [key, perf] of Object.entries(performance)) {
      if (adjusted[key] !== undefined && perf.accuracy) {
        // إذا كان أداء العامل جيداً، نزيد وزنه
        const accuracy = perf.accuracy / 100; // 0-1
        const factor = 0.8 + accuracy * 0.4; // 0.8-1.2
        adjusted[key] = adjusted[key] * factor;
      }
    }

    // إعادة التطبيع
    const newTotal = Object.values(adjusted).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(adjusted)) {
      adjusted[key] = adjusted[key] / newTotal;
    }

    return adjusted;
  }

  // ─── تحديث بيانات التعلم ──────────────────────────────────
  updateLearning(weights, accuracy) {
    this.learningData.weights = weights;
    this.learningData.lastUpdate = new Date().toISOString();
  }

  // ─── الحصول على الأوزان الحالية ──────────────────────────
  getCurrentWeights() {
    return this.learningData.weights;
  }

  // ─── تقرير الأوزان ──────────────────────────────────────
  getWeightReport(session, regime) {
    const weights = this.getWeights(session, regime);
    const report = {
      session,
      regime,
      weights,
      breakdown: Object.entries(weights).map(([key, value]) => ({
        factor: key,
        weight: Math.round(value * 100),
      })),
    };
    return report;
  }
}
