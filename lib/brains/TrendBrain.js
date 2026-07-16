// lib/radar/brains/TrendBrain.js
import { Brain } from '../core/Brain.js';

export class TrendBrain extends Brain {
  static dependencies = ['Market Brain'];

  constructor(config = {}) {
    super('Trend Brain', {
      weight: 1.0,
      enabled: true,
      timeHorizon: 'swing',
      ...config,
    });
  }

  async analyze(context) {
    const reasons = [];
    const warnings = [];
    const metrics = {};

    const features = context.features || {};
    const price = context.price || 0;

    const ma21 = features.ma21 || 0;
    const ma50 = features.ma50 || 0;
    const ema9 = features.ema9 || 0;
    const ema21 = features.ema21 || 0;
    const ema50 = features.ema50 || 0;

    let score = 50;
    let confidence = 60;

    // 1. MA5 > MA20 > MA50 (اتجاه صاعد قوي)
    if (price > ma21 && ma21 > ma50) {
      score += 25;
      confidence += 15;
      reasons.push('✅ اتجاه صاعد قوي (MA5 > MA20 > MA50)');
    } else if (price > ma21) {
      score += 15;
      confidence += 10;
      reasons.push('📈 اتجاه صاعد');
    } else if (ma21 > ma50) {
      score += 8;
      reasons.push('📊 اتجاه عرضي مع ميل صاعد');
    } else if (price < ma21 && ma21 < ma50) {
      warnings.push('⚠️ اتجاه هابط');
      score -= 15;
      confidence -= 10;
    } else {
      reasons.push('📊 اتجاه عرضي');
      score += 5;
    }

    // 2. EMA Cross
    if (ema9 > ema21 && ema21 > ema50) {
      score += 15;
      reasons.push('✅ تقاطع إيجابي للمتوسطات (9 > 21 > 50)');
    } else if (ema9 > ema21) {
      score += 8;
      reasons.push('📊 تقاطع إيجابي (9 > 21)');
    } else if (ema9 < ema21) {
      warnings.push('⚠️ تقاطع سلبي (9 < 21)');
      score -= 10;
    }

    // 3. النتيجة النهائية
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.ma21 = ma21;
    metrics.ma50 = ma50;
    metrics.ema9 = ema9;
    metrics.ema21 = ema21;
    metrics.ema50 = ema50;
    metrics.price = price;
    metrics.trendScore = finalScore;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
