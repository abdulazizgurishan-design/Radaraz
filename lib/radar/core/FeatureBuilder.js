// lib/radar/core/FeatureBuilder.js (أضف هذه الدالة الجديدة)

static buildFromBrains(brainResults, marketContext) {
  // brainResults مثال: { liquidity: { rvol: 6.2, dollarVolume: 50000000 }, momentum: { rsi: 62, atr: 0.21 }, ... }

  return {
    // من LiquidityBrain
    price: brainResults.structure?.price || 0,
    volume: brainResults.liquidity?.volume || 0,
    rvol: brainResults.liquidity?.rvol || 0,
    dollarVolume: brainResults.liquidity?.dollarVolume || 0,

    // من MomentumBrain
    atr: brainResults.momentum?.atr || 0,
    rsi: brainResults.momentum?.rsi || 50,
    ema9: brainResults.trend?.ema9 || 0,
    ema21: brainResults.trend?.ema21 || 0,
    ema50: brainResults.trend?.ema50 || 0,
    vwap: brainResults.structure?.vwap || 0,

    // من StructureBrain
    gap: brainResults.structure?.gap || 0,
    entry: brainResults.structure?.entry || 0,
    stop: brainResults.structure?.stop || 0,
    target1: brainResults.structure?.target1 || 0,

    // من SectorIntelligenceBrain
    sector_name: brainResults.sector?.name || 'Unknown',
    sector_rank: brainResults.sector?.rank || 5,
    sector_change: brainResults.sector?.change || 0,

    // من MarketIntelligenceBrain
    spy: marketContext.spy_change || 0,
    vix: marketContext.vix || 18,
    market_regime: marketContext.regime || 'Neutral',

    // من PatternBrain
    earlyAccumulation: brainResults.pattern?.earlyAccumulation || 0,
    breakoutProbability: brainResults.pattern?.breakoutProbability || 0,

    // من RiskBrain
    float: brainResults.risk?.float || 0,
    shortInterest: brainResults.risk?.shortInterest || 0,

    // معلومات الوقت
    hour: marketContext.hour || 9,
    day_of_week: marketContext.day_of_week_index || 0,
    timestamp: new Date().toISOString()
  };
}
