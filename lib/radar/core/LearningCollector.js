// lib/radar/core/LearningCollector.js
export class LearningCollector {
  constructor() {
    this.trades = [];
    this.analysis = {};
  }

  // تسجيل صفقة
  record(trade) {
    this.trades.push({
      ...trade,
      timestamp: new Date().toISOString(),
    });

    // تحليل محدود عند التسجيل
    this.analyzeTrade(trade);
  }

  // تحليل صفقة واحدة
  analyzeTrade(trade) {
    const brainName = trade.brainName || 'unknown';
    if (!this.analysis[brainName]) {
      this.analysis[brainName] = {
        total: 0,
        wins: 0,
        losses: 0,
        totalScore: 0,
      };
    }

    const analysis = this.analysis[brainName];
    analysis.total++;
    analysis.totalScore += trade.score || 0;

    if (trade.result === 'win') {
      analysis.wins++;
    } else if (trade.result === 'loss') {
      analysis.losses++;
    }
  }

  // حساب دقة كل Brain
  getAccuracy(brainName) {
    const data = this.analysis[brainName];
    if (!data || data.total === 0) return null;
    return (data.wins / data.total) * 100;
  }

  // تحديث أوزان الـ Brains بناءً على الأداء
  getUpdatedWeights() {
    const weights = {};
    for (const [brainName, data] of Object.entries(this.analysis)) {
      if (data.total > 10) {
        const accuracy = this.getAccuracy(brainName);
        weights[brainName] = Math.max(0.5, Math.min(1.5, accuracy / 100));
      } else {
        weights[brainName] = 1.0;
      }
    }
    return weights;
  }

  // الحصول على أفضل Brain
  getBestBrain() {
    let best = null;
    let bestAccuracy = 0;

    for (const [brainName, data] of Object.entries(this.analysis)) {
      if (data.total > 20) {
        const accuracy = this.getAccuracy(brainName);
        if (accuracy > bestAccuracy) {
          bestAccuracy = accuracy;
          best = brainName;
        }
      }
    }

    return best;
  }

  // الحصول على تقرير الأداء
  getPerformanceReport() {
    const report = {};

    for (const [brainName, data] of Object.entries(this.analysis)) {
      const accuracy = this.getAccuracy(brainName);
      report[brainName] = {
        totalTrades: data.total,
        wins: data.wins,
        losses: data.losses,
        accuracy: accuracy !== null ? Math.round(accuracy) : null,
        avgScore: data.total > 0 ? Math.round(data.totalScore / data.total) : 0,
        weight: accuracy !== null ? Math.max(0.5, Math.min(1.5, accuracy / 100)) : 1.0,
      };
    }

    return report;
  }

  // حفظ البيانات للتعلم المستقبلي
  toJSON() {
    return {
      trades: this.trades.slice(-500), // آخر 500 صفقة
      analysis: this.analysis,
      updatedAt: new Date().toISOString(),
    };
  }

  // تحميل بيانات سابقة
  loadData(data) {
    if (data.analysis) {
      this.analysis = data.analysis;
    }
    if (data.trades) {
      this.trades = data.trades;
    }
  }
}
