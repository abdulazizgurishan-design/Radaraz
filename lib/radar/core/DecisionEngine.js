// lib/radar/core/DecisionEngine.js
export class DecisionEngine {
  constructor(config = {}) {
    this.config = {
      thresholds: {
        ELITE: 90,
        PRIME: 80,
        STRONG: 70,
        GOOD: 60,
        WATCH: 50,
        AVOID: 0,
      },
      // الأوزان الديناميكية حسب Market Regime
      regimeWeights: {
        strong: { market: 1.2, liquidity: 1.0, momentum: 1.1, trend: 1.2, structure: 1.1 },
        neutral: { market: 1.0, liquidity: 1.0, momentum: 1.0, trend: 1.0, structure: 1.0 },
        weak: { market: 0.6, liquidity: 0.8, momentum: 0.7, trend: 1.3, structure: 1.2 },
        risk_off: { market: 0.3, liquidity: 0.5, momentum: 0.5, trend: 1.5, structure: 1.5 },
      },
      ...config,
    };
  }

  decide(context) {
    const results = context.getAllBrainResults();
    const reasons = [];
    const warnings = [];
    const metrics = {};

    // 1. استخراج النتائج الرئيسية
    const market = results['Market Brain'];
    const liquidity = results['Liquidity Brain'];
    const momentum = results['Momentum Brain'];
    const trend = results['Trend Brain'];
    const structure = results['Structure Brain'];
    const consensus = results['Consensus Brain'];
    const contradiction = results['Contradiction Brain'];
    const risk = results['Risk Brain'];
    const portfolio = results['Portfolio Brain'];

    // 2. تحديد Regime (من Market Brain)
    const regime = market?.metrics?.regime || 'neutral';
    const weights = this.config.regimeWeights[regime] || this.config.regimeWeights.neutral;

    // 3. حساب النقاط المرجحة
    let totalScore = 50;
    let totalConfidence = 50;

    // Market
    if (market) {
      const w = weights.market || 1.0;
      totalScore += (market.score - 50) * w * 0.25;
      totalConfidence += (market.confidence - 50) * w * 0.2;
      if (market.verdict === 'bullish') {
        reasons.push({ id: 'market_bullish', impact: 15, severity: 'high', title: 'السوق داعم', description: 'SPY فوق VWAP' });
      } else if (market.verdict === 'bearish') {
        warnings.push({ id: 'market_bearish', impact: -15, severity: 'high', title: 'السوق ضعيف', description: 'SPY تحت VWAP' });
      }
    }

    // Liquidity
    if (liquidity) {
      const w = weights.liquidity || 1.0;
      totalScore += (liquidity.score - 50) * w * 0.15;
      totalConfidence += (liquidity.confidence - 50) * w * 0.15;
      if (liquidity.verdict === 'bullish') {
        reasons.push({ id: 'liquidity_bullish', impact: 10, severity: 'high', title: 'سيولة ممتازة', description: 'RVOL مرتفع' });
      } else if (liquidity.verdict === 'bearish') {
        warnings.push({ id: 'liquidity_bearish', impact: -10, severity: 'high', title: 'سيولة ضعيفة', description: 'حجم تداول منخفض' });
      }
    }

    // Momentum
    if (momentum) {
      const w = weights.momentum || 1.0;
      totalScore += (momentum.score - 50) * w * 0.20;
      totalConfidence += (momentum.confidence - 50) * w * 0.20;
      if (momentum.verdict === 'bullish') {
        reasons.push({ id: 'momentum_bullish', impact: 12, severity: 'high', title: 'زخم قوي', description: 'RSI و ATR يدعمان الصعود' });
      } else if (momentum.verdict === 'bearish') {
        warnings.push({ id: 'momentum_bearish', impact: -12, severity: 'high', title: 'زخم ضعيف', description: 'RSI منخفض' });
      }
    }

    // Trend
    if (trend) {
      const w = weights.trend || 1.0;
      totalScore += (trend.score - 50) * w * 0.15;
      totalConfidence += (trend.confidence - 50) * w * 0.15;
      if (trend.verdict === 'bullish') {
        reasons.push({ id: 'trend_bullish', impact: 10, severity: 'high', title: 'اتجاه صاعد', description: 'MA5 > MA20 > MA50' });
      } else if (trend.verdict === 'bearish') {
        warnings.push({ id: 'trend_bearish', impact: -10, severity: 'high', title: 'اتجاه هابط', description: 'MA5 تحت MA20' });
      }
    }

    // Structure
    if (structure) {
      const w = weights.structure || 1.0;
      totalScore += (structure.score - 50) * w * 0.15;
      totalConfidence += (structure.confidence - 50) * w * 0.15;
      if (structure.verdict === 'bullish') {
        reasons.push({ id: 'structure_bullish', impact: 12, severity: 'high', title: 'هيكل مثالي', description: 'RR مرتفع ومنطقة دخول واضحة' });
      } else if (structure.verdict === 'bearish') {
        warnings.push({ id: 'structure_bearish', impact: -12, severity: 'high', title: 'هيكل ضعيف', description: 'RR منخفض' });
      }
    }

    // Consensus
    if (consensus) {
      totalScore += (consensus.score - 50) * 0.10;
      totalConfidence += (consensus.confidence - 50) * 0.10;
      if (consensus.verdict === 'bullish') {
        reasons.push({ id: 'consensus_bullish', impact: 8, severity: 'medium', title: 'إجماع قوي', description: `${consensus.metrics?.consensusPercent || 0}% من الـ Brains متفقة` });
      } else if (consensus.verdict === 'bearish') {
        warnings.push({ id: 'consensus_bearish', impact: -8, severity: 'medium', title: 'إجماع ضعيف', description: 'الـ Brains غير متفق عليها' });
      }
    }

    // Contradiction
    if (contradiction && contradiction.verdict === 'bearish') {
      totalScore -= 10;
      totalConfidence -= 10;
      warnings.push({ id: 'contradiction_detected', impact: -10, severity: 'high', title: 'تناقضات في التحليل', description: 'بعض الـ Brains تتعارض مع بعضها' });
    }

    // Risk
    if (risk) {
      const riskScore = risk.score;
      if (riskScore < 30) {
        totalScore -= 15;
        totalConfidence -= 15;
        warnings.push({ id: 'risk_high', impact: -15, severity: 'high', title: 'مخاطرة عالية', description: 'Gap / Float / News Risk مرتفع' });
      } else if (riskScore < 50) {
        totalScore -= 8;
        totalConfidence -= 8;
        warnings.push({ id: 'risk_medium', impact: -8, severity: 'medium', title: 'مخاطرة متوسطة', description: 'بعض عوامل المخاطرة مرتفعة' });
      } else {
        reasons.push({ id: 'risk_low', impact: 5, severity: 'medium', title: 'مخاطرة منخفضة', description: 'جميع عوامل المخاطرة منخفضة' });
      }
    }

    // Portfolio (يمنع تكرار المخاطرة)
    if (portfolio && portfolio.verdict === 'bearish') {
      totalScore -= 10;
      totalConfidence -= 10;
      warnings.push({ id: 'portfolio_overlap', impact: -10, severity: 'high', title: 'تكرار قطاعي', description: 'لديك بالفعل أسهم مشابهة في المحفظة' });
    }

    // 4. التصنيف النهائي
    const finalScore = Math.min(Math.max(totalScore, 0), 100);
    const finalConfidence = Math.min(Math.max(totalConfidence, 0), 100);

    let grade, gradeLabel;
    const t = this.config.thresholds;
    if (finalScore >= t.ELITE) {
      grade = 'ELITE';
      gradeLabel = '🏆 فرصة استثنائية';
    } else if (finalScore >= t.PRIME) {
      grade = 'PRIME';
      gradeLabel = '⭐ فرصة ممتازة';
    } else if (finalScore >= t.STRONG) {
      grade = 'STRONG';
      gradeLabel = '💪 فرصة قوية';
    } else if (finalScore >= t.GOOD) {
      grade = 'GOOD';
      gradeLabel = '📊 فرصة جيدة';
    } else if (finalScore >= t.WATCH) {
      grade = 'WATCH';
      gradeLabel = '👀 مراقبة';
    } else {
      grade = 'AVOID';
      gradeLabel = '❌ تجنب';
    }

    metrics.regime = regime;
    metrics.totalBrains = Object.keys(results).length;
    metrics.activeBrains = Object.values(results).filter(r => r && r.score !== undefined).length;

    const decision = {
      score: Math.round(finalScore),
      confidence: Math.round(finalConfidence),
      grade,
      gradeLabel,
      reasons,
      warnings,
      metrics,
      regime,
      timestamp: new Date().toISOString(),
    };

    return decision;
  }
}
