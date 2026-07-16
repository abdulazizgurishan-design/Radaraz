// lib/radar/core/OpportunityRanking.js
export class OpportunityRanking {
  constructor(config = {}) {
    this.config = {
      maxResults: config.maxResults || 10,
      minGrade: config.minGrade || 'GOOD',
      ...config,
    };
  }

  rank(signals, context) {
    // حساب درجة كل إشارة
    const scoredSignals = signals.map(signal => {
      const score = this._calculateScore(signal, context);
      return {
        ...signal,
        rankingScore: score,
      };
    });

    // ترتيب تنازلي
    scoredSignals.sort((a, b) => b.rankingScore - a.rankingScore);

    // تصفية حسب الحد الأدنى
    const minScore = this._getMinScore();
    const filtered = scoredSignals.filter(s => s.rankingScore >= minScore);

    // اختيار الأفضل
    const top = filtered.slice(0, this.config.maxResults);

    return {
      total: scoredSignals.length,
      filtered: filtered.length,
      top: top,
      topSymbols: top.map(s => s.symbol),
    };
  }

  _calculateScore(signal, context) {
    const decision = signal.decision || {};
    const features = context?.features || {};

    let score = 0;

    // 1. السكور الأساسي
    score += (decision.score || 0) * 0.30;

    // 2. الثقة
    score += (decision.confidence || 0) * 0.20;

    // 3. السيولة (RVOL)
    const rvol = features.relativeVolume || 1;
    if (rvol > 3) score += 20;
    else if (rvol > 2) score += 15;
    else if (rvol > 1.5) score += 10;

    // 4. حالة السوق
    const regime = features.marketRegime || 'neutral';
    if (regime === 'strong') score += 10;
    else if (regime === 'weak') score -= 10;

    // 5. RR المتوقع
    const rr = features.expectedRR || 0;
    if (rr > 2) score += 10;
    else if (rr > 1.5) score += 5;

    // 6. حداثة الإشارة
    const timestamp = signal.timestamp || new Date().toISOString();
    const ageHours = (Date.now() - new Date(timestamp).getTime()) / 3600000;
    if (ageHours < 1) score += 10;
    else if (ageHours < 4) score += 5;

    // 7. التصنيف
    const grade = decision.grade || 'AVOID';
    const gradeScores = { ELITE: 20, PRIME: 15, STRONG: 10, GOOD: 5, WATCH: 0, AVOID: -10 };
    score += gradeScores[grade] || 0;

    return Math.min(Math.max(score, 0), 100);
  }

  _getMinScore() {
    const grade = this.config.minGrade;
    const thresholds = { ELITE: 90, PRIME: 80, STRONG: 70, GOOD: 60, WATCH: 50, AVOID: 0 };
    return thresholds[grade] || 60;
  }
}
