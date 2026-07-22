// lib/radar/services/PredictionEngine.js
// ============================================================
// RadarAZ v20.1 - Prediction Engine
// ✅ AUDIT FIX: field names now match what FeatureBuilder actually produces.
//    Previously fv.close / fv.marketRegime / fv.breakout / fv.nearResistance /
//    fv.aboveVWAP did not exist on the feature vector, so the volatility,
//    market and structure components were permanently broken (NaN or constant),
//    collapsing every score into a narrow 20–33 band.
// ============================================================

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

    // ✅ AUDIT FIX: FeatureBuilder produces `price`, not `close`.
    const price = Number(fv.price ?? fv.close ?? 0);

    // --------------------------
    // Trend  (ema9 vs ema21)
    // --------------------------
    const trend =
      fv.ema21 > 0
        ? Math.max(
            0,
            Math.min((fv.ema9 - fv.ema21) / fv.ema21 * 20, 1)
          )
        : 0;

    // --------------------------
    // Momentum (RSI) — أفضل منطقة 50-70
    // --------------------------
    let momentum = 0;

    if (fv.rsi >= 50 && fv.rsi <= 70) {
      momentum = (fv.rsi - 50) / 20;
    } else if (fv.rsi > 70) {
      momentum = 0.3;
    }

    // --------------------------
    // Volume (RVOL)
    // --------------------------
    const volume =
      Math.max(0, Math.min((fv.rvol || 0) / 3, 1));

    // --------------------------
    // Liquidity
    // --------------------------
    const liquidity =
      Math.max(
        0,
        Math.min((fv.volume || 0) / 3000000, 1)
      );

    // --------------------------
    // Volatility (ATR% of price)
    // ✅ AUDIT FIX: used fv.close (undefined → NaN). Now uses price.
    // Guard against price=0 to avoid division by zero.
    // --------------------------
    const volatility =
      price > 0
        ? Math.max(0, Math.min((fv.atr || 0) / (price * 0.08), 1))
        : 0;

    // --------------------------
    // Market Regime
    // ✅ AUDIT FIX: FeatureBuilder produces `market_regime` (not marketRegime)
    // with values like 'Neutral'/'strong'/'weak' (mixed case). Normalize to
    // lower-case before comparing.
    // --------------------------
    const regime = String(fv.market_regime ?? fv.marketRegime ?? '').toLowerCase();
    let market = 0.5;
    if (regime === 'strong' || regime === 'bull') market = 1;
    else if (regime === 'neutral') market = 0.6;
    else if (regime === 'weak' || regime === 'bear') market = 0.25;

    // --------------------------
    // Structure
    // ✅ AUDIT FIX: breakout / nearResistance were never produced by
    // FeatureBuilder, so structure always collapsed to 0.2. We now derive an
    // aboveVWAP signal from fields that DO exist (price vs vwap). breakout and
    // nearResistance remain a follow-up (need real resistance calc from bars);
    // until then structure uses a graded aboveVWAP / near-VWAP measure so it is
    // no longer a dead constant.
    // --------------------------
    let structure = 0.2;
    const vwap = Number(fv.vwap ?? 0);
    if (vwap > 0 && price > 0) {
      const distPct = ((price - vwap) / vwap) * 100;
      if (distPct >= 2) structure = 0.8;        // comfortably above VWAP
      else if (distPct >= 0.2) structure = 0.6; // above VWAP
      else if (distPct >= -0.2) structure = 0.45; // hugging VWAP
      else if (distPct >= -2) structure = 0.3;  // slightly below
      else structure = 0.2;                     // well below VWAP
    }

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
