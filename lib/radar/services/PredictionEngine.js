// lib/radar/services/PredictionEngine.js
// ============================================================
// RadarAZ v20.2 - Prediction Engine (Day-Trading Calibration)
// ✅ AUDIT FIX (v20.1): field names now match FeatureBuilder output
//    (price / market_regime / breakout / nearResistance / aboveVWAP).
// ✅ CALIBRATION (v20.2): tuned for FAST DAY-TRADING signals.
//    - Momentum / Volume / Volatility are now the dominant weights.
//    - Fixed three "choke" formulas that collapsed every score:
//        • volume: was rvol/3 (rvol≈1 → 0.33). Now rvol=1 is baseline 0.4,
//          scaling up to 1.0 at rvol≥2.5.
//        • liquidity: was /3,000,000 (too high). Now /1,000,000.
//        • volatility: was atr/(price*0.08) linear. Now rewards the
//          2–6% ATR band that day-traders actually want.
//    These fixes lift genuinely strong setups above 50–60 while leaving
//    weak/quiet names below, restoring meaning to the display threshold.
// ============================================================

export class PredictionEngine {

  static calculate(fv, weights = {}, ruleWeight = 0.7, aiWeight = 0.3) {

    const ruleScore = this.ruleBasedScore(fv, weights);

    // سيتم استبداله لاحقاً بالنموذج الذكي (aiScore) بعد جمع بيانات backtesting
    const aiScore = 0;

    return Math.round(
      (ruleScore * ruleWeight) +
      (aiScore * aiWeight)
    );
  }

  static ruleBasedScore(fv, weights = {}) {

    // ⚡ أوزان المضاربة اليومية: الزخم والحجم والتقلّب أولاً،
    // الاتجاه البطيء والسوق العام أقل تأثيراً.
    const W = {
      momentum: 0.24,
      volume: 0.20,
      volatility: 0.16,
      structure: 0.14,
      trend: 0.12,
      liquidity: 0.08,
      market: 0.06,
      ...weights
    };

    // ✅ FeatureBuilder produces `price`, not `close`.
    const price = Number(fv.price ?? fv.close ?? 0);

    // --------------------------
    // Trend (ema9 vs ema21) — حساسية أعلى للمضاربة (×30 بدل ×20)
    // --------------------------
    const trend =
      fv.ema21 > 0
        ? Math.max(0, Math.min((fv.ema9 - fv.ema21) / fv.ema21 * 30, 1))
        : 0;

    // --------------------------
    // Momentum (RSI) — للمضاربة نكافئ الزخم القوي في نطاق 55-75.
    // بناء الزخم (45-55) يعطي درجة جزئية؛ الإشباع (>75) يبقى قوياً لكن أقل.
    // --------------------------
    let momentum = 0;
    if (fv.rsi >= 55 && fv.rsi <= 75) {
      momentum = 0.6 + ((fv.rsi - 55) / 20) * 0.4;   // 0.6 → 1.0
    } else if (fv.rsi > 75) {
      momentum = 0.7;                                 // إشباع شرائي لكن زخم قوي
    } else if (fv.rsi >= 45) {
      momentum = ((fv.rsi - 45) / 10) * 0.6;          // 0 → 0.6 (بناء زخم)
    }

    // --------------------------
    // Volume (RVOL)
    // ✅ FIX: كان /3 يخنق كل شيء (rvol≈1 → 0.33).
    // للمضاربة: rvol=1 عادي (0.4)، rvol=2 جيد (0.8)، rvol≥2.5 ممتاز (1.0).
    // --------------------------
    let volume = 0;
    const rv = fv.rvol || 0;
    if (rv >= 2.5) volume = 1.0;
    else if (rv >= 1) volume = 0.4 + (rv - 1) * 0.4;  // 0.4 → 1.0
    else volume = rv * 0.4;                            // <1 ضعيف

    // --------------------------
    // Liquidity
    // ✅ FIX: 3M كانت عالية جداً. 1M سيولة جيدة كافية للمضاربة.
    // --------------------------
    const liquidity =
      Math.max(0, Math.min((fv.volume || 0) / 1000000, 1));

    // --------------------------
    // Volatility (ATR% of price)
    // ✅ FIX: المضاربة تحب التقلّب. النطاق المثالي 2–6% يعطي 1.0،
    // الهادئ جداً (<1%) ضعيف، والمتقلّب جداً (>6%) خطر فيُخفَّض قليلاً.
    // --------------------------
    const atrPct = price > 0 ? ((fv.atr || 0) / price) * 100 : 0;
    let volatility = 0;
    if (atrPct >= 2 && atrPct <= 6) volatility = 1.0;
    else if (atrPct > 6) volatility = 0.7;
    else if (atrPct >= 1) volatility = 0.4 + (atrPct - 1) * 0.6; // 0.4 → 1.0
    else volatility = atrPct * 0.4;

    // --------------------------
    // Market Regime
    // ✅ FeatureBuilder produces `market_regime` (mixed case) → normalize.
    // --------------------------
    const regime = String(fv.market_regime ?? fv.marketRegime ?? '').toLowerCase();
    let market = 0.5;
    if (regime === 'strong' || regime === 'bull') market = 1;
    else if (regime === 'neutral') market = 0.6;
    else if (regime === 'weak' || regime === 'bear') market = 0.25;

    // --------------------------
    // Structure
    // breakout / nearResistance حقول حقيقية من FeatureBuilder (أعلى قمة).
    // الأولوية: اختراق مؤكد > قرب مقاومة > فوق VWAP > مسافة VWAP متدرّجة.
    // --------------------------
    let structure;
    if (fv.breakout === true) {
      structure = 1.0;
    } else if (fv.nearResistance === true) {
      structure = 0.7;
    } else {
      const vwap = Number(fv.vwap ?? 0);
      if (fv.aboveVWAP === true && vwap > 0 && price > 0) {
        const distPct = ((price - vwap) / vwap) * 100;
        structure = distPct >= 2 ? 0.6 : 0.5;
      } else if (vwap > 0 && price > 0) {
        const distPct = ((price - vwap) / vwap) * 100;
        if (distPct >= -0.2) structure = 0.45;
        else if (distPct >= -2) structure = 0.3;
        else structure = 0.2;
      } else {
        structure = 0.2;
      }
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

    return Math.max(0, Math.min(Math.round(score), 100));
  }
}
