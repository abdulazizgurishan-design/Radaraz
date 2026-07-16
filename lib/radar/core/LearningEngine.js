// lib/radar/core/LearningEngine.js — v16
export class LearningEngine {
  constructor(config = {}) {
    this.config = {
      minTrades: 50,
      learningRate: 0.1,
      ...config,
    };

    this.history = [];
    this.analysis = {
      byScore: {},
      byFactor: {},
      byGrade: {},
      byTiming: {},
    };
  }

  // ─── تسجيل صفقة ────────────────────────────────────────
  record(trade) {
    this.history.push({
      ...trade,
      timestamp: new Date().toISOString(),
    });

    // تحليل محدود عند التسجيل
    this._analyzeTrade(trade);
  }

  // ─── تحليل صفقة واحدة ──────────────────────────────────
  _analyzeTrade(trade) {
    // 1. تحليل حسب السكور
    const score = Math.round(trade.predictionScore / 10) * 10;
    if (!this.analysis.byScore[score]) {
      this.analysis.byScore[score] = { total: 0, wins: 0 };
    }
    this.analysis.byScore[score].total++;
    if (trade.success) this.analysis.byScore[score].wins++;

    // 2. تحليل حسب العوامل
    if (trade.factors) {
      for (const [factor, value] of Object.entries(trade.factors)) {
        if (!this.analysis.byFactor[factor]) {
          this.analysis.byFactor[factor] = { total: 0, wins: 0 };
        }
        this.analysis.byFactor[factor].total++;
        if (trade.success) this.analysis.byFactor[factor].wins++;
      }
    }

    // 3. تحليل حسب التصنيف
    const grade = trade.grade || 'WATCH';
    if (!this.analysis.byGrade[grade]) {
      this.analysis.byGrade[grade] = { total: 0, wins: 0 };
    }
    this.analysis.byGrade[grade].total++;
    if (trade.success) this.analysis.byGrade[grade].wins++;

    // 4. تحليل حسب التوقيت
    const timing = trade.timing || 'UNKNOWN';
    if (!this.analysis.byTiming[timing]) {
      this.analysis.byTiming[timing] = { total: 0, wins: 0 };
    }
    this.analysis.byTiming[timing].total++;
    if (trade.success) this.analysis.byTiming[timing].wins++;
  }

  // ─── حساب دقة العوامل ──────────────────────────────────
  getFactorAccuracy() {
    const result = {};
    for (const [factor, data] of Object.entries(this.analysis.byFactor)) {
      if (data.total > 10) {
        result[factor] = {
          accuracy: (data.wins / data.total) * 100,
          samples: data.total,
        };
      }
    }
    return result;
  }

  // ─── حساب دقة السكور ──────────────────────────────────
  getScoreAccuracy() {
    const result = {};
    for (const [score, data] of Object.entries(this.analysis.byScore)) {
      if (data.total > 5) {
        result[score] = {
          accuracy: (data.wins / data.total) * 100,
          samples: data.total,
        };
      }
    }
    return result;
  }

  // ─── حساب دقة التصنيف ──────────────────────────────────
  getGradeAccuracy() {
    const result = {};
    for (const [grade, data] of Object.entries(this.analysis.byGrade)) {
      if (data.total > 5) {
        result[grade] = {
          accuracy: (data.wins / data.total) * 100,
          samples: data.total,
        };
      }
    }
    return result;
  }

  // ─── حساب دقة التوقيت ──────────────────────────────────
  getTimingAccuracy() {
    const result = {};
    for (const [timing, data] of Object.entries(this.analysis.byTiming)) {
      if (data.total > 5) {
        result[timing] = {
          accuracy: (data.wins / data.total) * 100,
          samples: data.total,
        };
      }
    }
    return result;
  }

  // ─── الحصول على الأوزان المحسنة ──────────────────────
  getOptimizedWeights(baseWeights) {
    const factorAccuracy = this.getFactorAccuracy();
    const optimized = { ...baseWeights };
    const totalWeight = Object.values(baseWeights).reduce((a, b) => a + b, 0);

    for (const [factor, weight] of Object.entries(baseWeights)) {
      const accuracy = factorAccuracy[factor];
      if (accuracy && accuracy.samples > 10) {
        // ضرب الوزن في دقة العامل
        const factor = (accuracy.accuracy / 100); // 0-1
        optimized[factor] = weight * (0.5 + factor * 0.5);
      }
    }

    // إعادة التطبيع
    const newTotal = Object.values(optimized).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(optimized)) {
      optimized[key] = optimized[key] / newTotal;
    }

    return optimized;
  }

  // ─── تقرير التعلم الكامل ──────────────────────────────
  getLearningReport() {
    const totalTrades = this.history.length;
    if (totalTrades === 0) {
      return { message: 'لا توجد بيانات كافية للتعلم' };
    }

    return {
      totalTrades,
      scoreAccuracy: this.getScoreAccuracy(),
      gradeAccuracy: this.getGradeAccuracy(),
      timingAccuracy: this.getTimingAccuracy(),
      factorAccuracy: this.getFactorAccuracy(),
      bestScore: this._getBestScore(),
      bestTiming: this._getBestTiming(),
    };
  }

  // ─── أفضل سكور ──────────────────────────────────────────
  _getBestScore() {
    const scores = this.getScoreAccuracy();
    let best = null;
    let bestAccuracy = 0;
    for (const [score, data] of Object.entries(scores)) {
      if (data.samples > 10 && data.accuracy > bestAccuracy) {
        bestAccuracy = data.accuracy;
        best = score;
      }
    }
    return best ? { score: best, accuracy: Math.round(bestAccuracy) } : null;
  }

  // ─── أفضل توقيت ──────────────────────────────────────────
  _getBestTiming() {
    const timings = this.getTimingAccuracy();
    let best = null;
    let bestAccuracy = 0;
    for (const [timing, data] of Object.entries(timings)) {
      if (data.samples > 10 && data.accuracy > bestAccuracy) {
        bestAccuracy = data.accuracy;
        best = timing;
      }
    }
    return best ? { timing: best, accuracy: Math.round(bestAccuracy) } : null;
  }

  // ─── تصدير البيانات للتعلم ────────────────────────────
  exportData() {
    return {
      history: this.history.slice(-500), // آخر 500 صفقة
      analysis: this.analysis,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── استيراد بيانات سابقة ──────────────────────────────
  importData(data) {
    if (data.history) {
      this.history = data.history;
    }
    if (data.analysis) {
      this.analysis = data.analysis;
    }
  }
}
