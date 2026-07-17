// lib/radar/core/FeatureBuilder.js
export class FeatureBuilder {
  static build(stock, marketContext) {
    return {
      price: stock.close || stock.price || 0,
      volume: stock.volume || 0,
      rvol: stock.rvol || 0,
      atr: stock.atr || 0,
      rsi: stock.rsi || 50,
      ema9: stock.ema9 || 0,
      ema21: stock.ema21 || 0,
      ema50: stock.ema50 || 0,
      vwap: stock.vwap || 0,
      gap: stock.gap || 0,
      float: stock.float || 0,
      shortInterest: stock.shortInterest || 0,
      sector_rank: stock.sectorRank || 5,
      spy: marketContext.spy_change || 0,
      vix: marketContext.vix || 18,
      hour: marketContext.hour || 9,
      day_of_week: marketContext.day_of_week_index || 0,
    };
  }

  static buildContext(marketContext) {
    return {
      market_regime: marketContext.regime || 'Neutral',
      volatility_regime: marketContext.volatility_regime || 'Normal',
      liquidity_regime: marketContext.liquidity_regime || 'Normal',
      fed_regime: marketContext.fed_regime || 'Neutral',
      risk_appetite: marketContext.risk_appetite || 'Neutral',
      top_sector: marketContext.top_sector || 'Unknown',
    };
  }

  static buildFromBrains(brainResults, marketContext) {
    const stock = {
      close: brainResults.structure?.price || 0,
      volume: brainResults.liquidity?.volume || 0,
      rvol: brainResults.liquidity?.rvol || 0,
      atr: brainResults.momentum?.atr || 0,
      rsi: brainResults.momentum?.rsi || 50,
      ema9: brainResults.trend?.ema9 || 0,
      ema21: brainResults.trend?.ema21 || 0,
      ema50: brainResults.trend?.ema50 || 0,
      gap: brainResults.structure?.gap || 0,
      sectorRank: brainResults.sector?.rank || 5,
    };
    return this.build(stock, marketContext);
  }
}
