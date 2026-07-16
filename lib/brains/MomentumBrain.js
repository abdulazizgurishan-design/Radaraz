// lib/radar/brains/MomentumBrain.js
import { Brain } from '../core/Brain.js';

export class MomentumBrain extends Brain {
  static dependencies = ['Market Brain', 'Liquidity Brain'];

  constructor(config = {}) {
    super('Momentum Brain', {
      weight: 1.1,
      enabled: true,
      timeHorizon: 'intraday',
      ...config,
    });
  }

  async analyze(context) {
    const reasons = [];
    const warnings = [];
    const metrics = {};

    const features = context.features || {};
    const price = context.price || 0;
    const changePct = features.changePct || 0;

    const rsi = features.rsi14 || 0;
    const atr = features.atr14 || 0;
    const vcp = features.vcp || false;
    const vwapDistance = features.vwapDistance || 0;
    const ma21 = features.ma21 || 0;
    const ma50 = features.ma50 || 0;

    let score = 50;
    let confidence = 60;

    // 1. RSI
    if (rsi >= 45 && rsi <= 65) {
      score += 25;
      confidence += 10;
      reasons.push(`✅ RSI ${rsi} (مثالي)`);
    } else if (rsi >= 40 && rsi <= 70) {
      score += 15;
      confidence += 5;
      reasons.push(`📊 RSI ${rsi} (جيد)`);
    } else if (rsi > 70) {
      warnings.push(`⚠️ RSI ${rsi} (مشبع شرائي)`);
      score -= 10;
      confidence -= 5;
    } else {
      warnings.push(`⚠️ RSI ${rsi} (ضعيف)`);
      score -= 10;
    }

    // 2. VCP
    if (vcp) {
      score += 15;
      reasons.push('✅ VCP مكتمل (استعداد للانفجار)');
    }

    // 3. فوق المتوسطات
    if (price > ma21 && ma21 > ma50) {
      score += 15;
      reasons.push('✅ السعر فوق MA21 و MA21 فوق MA50');
    } else if (price > ma21) {
      score += 8;
      reasons.push('📊 السعر فوق MA21');
    } else {
      warnings.push('⚠️ السعر تحت MA21');
      score -= 10;
    }

    // 4. فوق VWAP
    if (vwapDistance > 2) {
      score += 10;
      reasons.push(`✅ فوق VWAP بنسبة ${vwapDistance.toFixed(1)}%`);
    } else if (vwapDistance > 0) {
      score += 5;
      reasons.push(`📊 قريب من VWAP (${vwapDistance.toFixed(1)}%)`);
    } else {
      warnings.push(`⚠️ تحت VWAP (${vwapDistance.toFixed(1)}%)`);
      score -= 5;
    }

    // 5. التغير السعري
    if (changePct >= 2 && changePct <= 8) {
      score += 10;
      reasons.push(`✅ تغير ${changePct.toFixed(1)}% (زخم معتدل)`);
    } else if (changePct > 0 && changePct < 2) {
      score += 5;
      reasons.push(`📊 تغير ${changePct.toFixed(1)}% (بداية زخم)`);
    } else if (changePct < 0) {
      warnings.push(`⚠️ تغير ${changePct.toFixed(1)}% (سلبي)`);
      score -= 5;
    }

    // 6. ATR
    const atrPct = price > 0 ? (atr / price) * 100 : 0;
    if (atrPct >= 3 && atrPct <= 8) {
      score += 5;
      reasons.push(`✅ ATR ${atrPct.toFixed(1)}% (مناسب)`);
    } else if (atrPct > 8) {
      warnings.push(`⚠️ ATR ${atrPct.toFixed(1)}% (مرتفع)`);
      score -= 5;
    }

    // 7. النتيجة النهائية
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.rsi = rsi;
    metrics.atr = atr;
    metrics.atrPct = atrPct;
    metrics.vcp = vcp;
    metrics.vwapDistance = vwapDistance;
    metrics.changePct = changePct;
    metrics.momentumScore = finalScore;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
