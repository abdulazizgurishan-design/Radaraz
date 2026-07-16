// lib/radar/brains/StructureBrain.js
import { Brain } from '../core/Brain.js';

export class StructureBrain extends Brain {
  static dependencies = ['Market Brain', 'Momentum Brain'];

  constructor(config = {}) {
    super('Structure Brain', {
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

    const price = context.price || 0;
    const bars = context.bars || [];
    const features = context.features || {};
    const marketRegime = features.marketRegime || 'neutral';

    const atr = features.atr14 || price * 0.03;
    const atrPct = price > 0 ? (atr / price) * 100 : 0;

    // حساب الدعم والمقاومة
    let support = price * 0.92;
    let resistance = price * 1.08;

    if (bars.length >= 20) {
      const highs = bars.slice(-20).map(b => b.h);
      const lows = bars.slice(-20).map(b => b.l);
      support = Math.max(Math.min(...lows), price * 0.85);
      resistance = Math.max(Math.max(...highs), price * 1.02);
    }

    // حساب الأهداف الديناميكية
    const stopPct = marketRegime === 'strong' ? 0.06 : 0.08;
    const target1Pct = marketRegime === 'strong' ? 0.04 : 0.035;
    const target2Pct = marketRegime === 'strong' ? 0.07 : 0.06;
    const target3Pct = marketRegime === 'strong' ? 0.10 : 0.09;

    const stop = price * (1 - stopPct);
    const t1 = price * (1 + Math.max(target1Pct, atrPct * 0.8 / 100));
    const t2 = price * (1 + Math.max(target2Pct, atrPct * 1.6 / 100));
    const t3 = price * (1 + Math.max(target3Pct, atrPct * 2.8 / 100));

    // RR
    const risk = price - stop;
    const reward = t2 - price;
    const rr = risk > 0 ? reward / risk : 0;

    let score = 50;
    let confidence = 60;

    // 1. RR
    if (rr >= 2) {
      score += 30;
      confidence += 15;
      reasons.push(`✅ RR ${rr.toFixed(1)} (ممتاز)`);
    } else if (rr >= 1.5) {
      score += 20;
      confidence += 10;
      reasons.push(`📊 RR ${rr.toFixed(1)} (جيد)`);
    } else if (rr >= 1) {
      score += 10;
      confidence += 5;
      reasons.push(`📊 RR ${rr.toFixed(1)} (مقبول)`);
    } else {
      warnings.push(`⚠️ RR ${rr.toFixed(1)} (منخفض)`);
      score -= 10;
      confidence -= 10;
    }

    // 2. منطقة الدخول
    const entry = Math.min(price, (support + price) / 2);
    const confirm = Math.min(price * 1.01, resistance * 1.001);

    if (price > support && price <= confirm * 1.01 && rr >= 1) {
      score += 20;
      reasons.push('✅ داخل منطقة الدخول');
    } else if (price > support) {
      score += 10;
      reasons.push('📊 فوق الدعم، ينتظر تأكيد');
    } else {
      warnings.push('⚠️ تحت الدعم (خطر)');
      score -= 15;
    }

    // 3. النتيجة النهائية
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.stop = stop;
    metrics.t1 = t1;
    metrics.t2 = t2;
    metrics.t3 = t3;
    metrics.rr = rr;
    metrics.support = support;
    metrics.resistance = resistance;
    metrics.entry = entry;
    metrics.confirm = confirm;
    metrics.structureScore = finalScore;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
