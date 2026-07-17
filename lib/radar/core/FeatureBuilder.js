// lib/radar/core/FeatureBuilder.js
import { SCAN_CONFIG } from './config.js';

export class FeatureBuilder {
  static build(stock, marketContext) {
    // استخراج القيم مع تحويل آمن
    const price = Number(stock.close ?? stock.price ?? 0);
    const volume = Number(stock.volume ?? 0);
    const rvol = Number(stock.rvol ?? 0);
    const atr = Number(stock.atr ?? 0);
    const rsi = Number(stock.rsi ?? 50);
    const ema9 = Number(stock.ema9 ?? 0);
    const ema21 = Number(stock.ema21 ?? 0);
    const ema50 = Number(stock.ema50 ?? 0);
    const vwap = Number(stock.vwap ?? 0);
    const gap = Number(stock.gap ?? 0);
    const float = Number(stock.float ?? 0);
    const shortInterest = Number(stock.shortInterest ?? 0);
    const sector_rank = Number(stock.sectorRank ?? 5);
    const sector_name = stock.sector ?? 'Unknown';
    const sector_change = Number(stock.sectorChange ?? 0);

    const entry = price;
    let stop, target1, target2, target3, target_source;

    if (atr > 0) {
      stop = price - atr * SCAN_CONFIG.STOP_MULTIPLIER;
      target1 = price + atr * SCAN_CONFIG.TARGET1_MULTIPLIER;
      target2 = price + atr * SCAN_CONFIG.TARGET2_MULTIPLIER;
      target3 = price + atr * SCAN_CONFIG.TARGET3_MULTIPLIER;
      target_source = 'fallback_atr';
    } else {
      stop = price * 0.97;
      target1 = price * 1.04;
      target2 = price * 1.08;
      target3 = price * 1.12;
      target_source = 'fallback_percent';
    }

    const risk = Math.max(entry - stop, 0.000001);
    const reward = target1 - entry;
    const riskReward = Number((reward / risk).toFixed(2));

    // ✅ استخدام القيمة من config مباشرة
    const holding_period_hours = SCAN_CONFIG.DEFAULT_HOLDING_PERIOD_HOURS;

    return {
      price,
      volume,
      rvol,
      atr,
      rsi,
      ema9,
      ema21,
      ema50,
      vwap,
      gap,
      float,
      shortInterest,
      sector_rank,
      sector_name,
      sector_change,

      entry,
      stop,
      target1,
      target2,
      target3,
      riskReward,
      target_source,
      holding_period_hours,

      spy: Number(marketContext.spy_change ?? 0),
      vix: Number(marketContext.vix ?? 18),
      hour: Number(marketContext.hour ?? 9),
      day_of_week: Number(marketContext.day_of_week_index ?? 0),
      market_regime: marketContext.regime ?? 'Neutral',
    };
  }

  static buildContext(marketContext) {
    return {
      market_regime: marketContext.regime ?? 'Neutral',
      volatility_regime: marketContext.volatility_regime ?? 'Normal',
      liquidity_regime: marketContext.liquidity_regime ?? 'Normal',
      fed_regime: marketContext.fed_regime ?? 'Neutral',
      risk_appetite: marketContext.risk_appetite ?? 'Neutral',
      top_sector: marketContext.top_sector ?? 'Unknown',
      spy_change: Number(marketContext.spy_change ?? 0),
      vix: Number(marketContext.vix ?? 18),
      hour: Number(marketContext.hour ?? 9),
      day_of_week: Number(marketContext.day_of_week_index ?? 0),
    };
  }
}
