// lib/radar/services/PredictionEngine.js

export class PredictionEngine {

  static calculate(fv, weights = {}, ruleWeight = 0.7, aiWeight = 0.3) {

    const ruleScore = this.ruleBasedScore(fv, weights);

    // سيتم استبداله لاحقاً بالنموذج الذكي
    const aiScore = 0;

    return Math.round(
      (ruleScore * ruleWeight) +
      (aiScore * aiWeight)
    );
  }

  static ruleBasedScore(fv, weights = {}) {

    const W = {
      trend: 0.20,
      momentum: 0.20,
      liquidity: 0.15,
      structure: 0.15,
      volatility: 0.10,
      market: 0.10,
      volume: 0.10,
      ...weights
    };

    // --------------------------
    // Trend
    // --------------------------
    const trend =
      fv.ema21 > 0
        ? Math.max(
            0,
            Math.min((fv.ema9 - fv.ema21) / fv.ema21 * 20, 1)
          )
        : 0;

    // --------------------------
    // RSI
    // أفضل منطقة 55-65
    // --------------------------
    let momentum = 0;

    if (fv.rsi >= 50 && fv.rsi <= 70) {
      momentum = (fv.rsi - 50) / 20;
    } else if (fv.rsi > 70) {
      momentum = 0.3;
    }

    // --------------------------
    // RVOL
    // --------------------------
    const volume =
      Math.max(0, Math.min(fv.rvol / 3, 1));

    // --------------------------
    // Liquidity
    // --------------------------
    const liquidity =
      Math.max(
        0,
        Math.min((fv.volume || 0) / 3000000, 1)
      );

    // --------------------------
    // ATR
    // --------------------------
    const volatility =
      Math.max(
        0,
        Math.min((fv.atr || 0) / (fv.close * 0.08), 1)
      );

    // --------------------------
    // Market Regime
    // --------------------------
    let market = 0.5;

    if (fv.marketRegime === "strong") market = 1;
    else if (fv.marketRegime === "neutral") market = 0.6;
    else if (fv.marketRegime === "weak") market = 0.25;

    // --------------------------
    // Structure
    // --------------------------
    const structure =
      fv.breakout
        ? 1
        : fv.nearResistance
        ? 0.7
        : fv.aboveVWAP
        ? 0.5
        : 0.2;

    // --------------------------
    // Final Score
    // --------------------------
    const score =

      trend * 100 * W.trend +

      momentum * 100 * W.momentum +

      liquidity * 100 * W.liquidity +

      structure * 100 * W.structure +

      volatility * 100 * W.volatility +

      market * 100 * W.market +

      volume * 100 * W.volume;

    return Math.max(
      0,
      Math.min(Math.round(score), 100)
    );
  }
}
