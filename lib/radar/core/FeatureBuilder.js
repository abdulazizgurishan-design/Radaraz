// lib/radar/core/FeatureBuilder.js
export class FeatureBuilder {
  static build(stock, marketContext) {
    return {
      price: stock.close || 0,
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
      volatility_regime: 'Normal',
      liquidity_regime: 'Normal',
      fed_regime: 'Neutral',
      risk_appetite: 'Neutral'
    };
  }

  static buildFromBrains(brainResults, marketContext) {
    // نسخة مبسطة لاستخدامها حالياً
    return this.build({}, marketContext);
  }
}
