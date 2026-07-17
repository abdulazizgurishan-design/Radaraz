// lib/radar/services/PredictionEngine.js
export class PredictionEngine {
  static calculate(featureVector, weights, ruleWeight = 0.6, aiWeight = 0.4) {
    // Layer 1: Rule Engine
    const ruleScore = this.ruleBasedScore(featureVector);
    
    // Layer 2: AI (مؤقتاً 0)
    const aiScore = 0;
    
    return (ruleScore * ruleWeight) + (aiScore * aiWeight);
  }

  static ruleBasedScore(fv) {
    let score = 0;
    if (fv.rvol > 5) score += 25;
    if (fv.ema9 > fv.ema21) score += 20;
    if (fv.sector_rank < 3) score += 15;
    if (fv.vix < 20) score += 10;
    if (fv.gap > 1) score += 10;
    if (fv.rsi > 55 && fv.rsi < 70) score += 10;
    if (fv.volume > 1000000) score += 5;
    return Math.min(score, 100);
  }
}
