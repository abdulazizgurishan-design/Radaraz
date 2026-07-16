// lib/radar/brains/MarketBrain.js
import { Brain } from '../core/Brain.js';

export class MarketBrain extends Brain {
  static dependencies = [];

  constructor(config = {}) {
    super('Market Brain', {
      weight: 1.2,
      enabled: true,
      timeHorizon: 'intraday',
      ...config,
    });
  }

  async analyze(context) {
    const reasons = [];
    const warnings = [];
    const metrics = {};

    const marketData = context.marketData || {};
    const spy = marketData.spy || {};
    const qqq = marketData.qqq || {};
    const iwm = marketData.iwm || {};
    const vix = marketData.vix || {};

    let score = 60;
    let confidence = 70;

    // 1. تحليل SPY
    const spyAboveVwap = spy.price > spy.vwap;
    if (spyAboveVwap) {
      score += 15;
      confidence += 5;
      reasons.push('✅ SPY فوق VWAP (سوق قوي)');
    } else {
      warnings.push('⚠️ SPY تحت VWAP (سوق ضعيف)');
      score -= 15;
      confidence -= 10;
    }

    // 2. تحليل QQQ
    const qqqAboveVwap = qqq.price > qqq.vwap;
    if (qqqAboveVwap) {
      score += 10;
      reasons.push('✅ QQQ فوق VWAP (التكنولوجيا قوية)');
    } else {
      score -= 10;
      warnings.push('⚠️ QQQ تحت VWAP (التكنولوجيا ضعيفة)');
    }

    // 3. تحليل IWM
    const iwmAboveVwap = iwm.price > iwm.vwap;
    if (iwmAboveVwap) {
      score += 5;
      reasons.push('✅ IWM فوق VWAP (الأسهم الصغيرة قوية)');
    } else {
      score -= 5;
      warnings.push('⚠️ IWM تحت VWAP (الأسهم الصغيرة ضعيفة)');
    }

    // 4. تحليل VIX
    const vixLow = vix.price < 20;
    if (vixLow) {
      score += 10;
      reasons.push('✅ VIX منخفض (السوق هادئ)');
    } else if (vix.price > 25) {
      warnings.push('⚠️ VIX مرتفع (تقلبات عالية)');
      score -= 10;
      confidence -= 5;
    }

    // 5. حالة السوق النهائية
    let regime = 'neutral';
    if (score >= 80) regime = 'strong';
    else if (score >= 60) regime = 'neutral';
    else if (score >= 40) regime = 'weak';
    else regime = 'risk_off';

    // 6. النتيجة النهائية
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.regime = regime;
    metrics.spyPrice = spy.price;
    metrics.spyVwap = spy.vwap;
    metrics.spyAboveVwap = spyAboveVwap;
    metrics.qqqAboveVwap = qqqAboveVwap;
    metrics.iwmAboveVwap = iwmAboveVwap;
    metrics.vixLow = vixLow;
    metrics.score = finalScore;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
