// lib/radar/brains/StructureBrain.js — v14 (Price Compression + Breakout)
import { Brain } from '../core/Brain.js';
import { CONFIG } from '../core/config.js';

export class StructureBrain extends Brain {
  static dependencies = ['Market Brain', 'Momentum Brain'];

  constructor(config = {}) {
    super('Structure Brain', {
      weight: 1.4,
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

    let score = 50;
    let confidence = 60;
    let compressionScore = 0;

    // ─── 1. Price Compression ──────────────────────────
    if (bars.length >= 30) {
      const highs = bars.map(b => b.h);
      const lows = bars.map(b => b.l);
      const closes = bars.map(b => b.c);

      // ATR منخفض (ضغط)
      if (atrPct < CONFIG.priceCompression.maxATRPct) {
        compressionScore += 20;
        reasons.push(`✅ ATR منخفض (${atrPct.toFixed(1)}%) — ضغط سعري`);
      } else if (atrPct < CONFIG.priceCompression.maxATRPct * 1.5) {
        compressionScore += 10;
        reasons.push(`📊 ATR متوسط (${atrPct.toFixed(1)}%)`);
      } else {
        warnings.push(`⚠️ ATR مرتفع (${atrPct.toFixed(1)}%) — لا يوجد ضغط`);
        compressionScore -= 10;
      }

      // VCP (انكماش التذبذب)
      const range1 = ((Math.max(...highs.slice(-30, -20)) - Math.min(...lows.slice(-30, -20))) / price) * 100;
      const range2 = ((Math.max(...highs.slice(-20, -10)) - Math.min(...lows.slice(-20, -10))) / price) * 100;
      const range3 = ((Math.max(...highs.slice(-10)) - Math.min(...lows.slice(-10))) / price) * 100;

      if (range3 < range2 && range2 < range1 && range3 < CONFIG.priceCompression.vcpContraction) {
        compressionScore += 20;
        reasons.push(`✅ VCP مكتمل (${range3.toFixed(1)}%) — انكماش تدريجي`);
      } else if (range3 < range2) {
        compressionScore += 10;
        reasons.push(`📊 VCP في التكوين (${range3.toFixed(1)}%)`);
      }

      // Higher Lows (آخر 5 شموع)
      const last5Lows = lows.slice(-5);
      const higherLows = last5Lows.every((l, i) => i === 0 || l > last5Lows[i - 1]);
      if (higherLows) {
        compressionScore += 10;
        reasons.push('✅ Higher Lows (قاع مرتفع)');
      }

      metrics.higherLows = higherLows;
      metrics.range1 = range1;
      metrics.range2 = range2;
      metrics.range3 = range3;
    }

    // ─── 2. Breakout Distance ──────────────────────────
    const support = price * 0.92;
    const resistance = price * 1.08;
    const resistanceDistance = ((resistance - price) / price) * 100;

    if (resistanceDistance > 0 && resistanceDistance <= 3) {
      compressionScore += 25;
      reasons.push(`✅ قرب من المقاومة (${resistanceDistance.toFixed(1)}%) — اختراق وشيك`);
    } else if (resistanceDistance > 3 && resistanceDistance <= 6) {
      compressionScore += 15;
      reasons.push(`📊 مسافة متوسطة للمقاومة (${resistanceDistance.toFixed(1)}%)`);
    } else {
      warnings.push(`⚠️ بعيد عن المقاومة (${resistanceDistance.toFixed(1)}%)`);
      compressionScore -= 10;
    }

    // ─── 3. Risk/Reward ─────────────────────────────────
    const stop = price * 0.92;
    const t1 = price * 1.04;
    const t2 = price * 1.08;
    const t3 = price * 1.12;

    const risk = price - stop;
    const reward = t2 - price;
    const rr = risk > 0 ? reward / risk : 0;

    if (rr >= 2.5) {
      compressionScore += 20;
      reasons.push(`✅ RR ممتاز (${rr.toFixed(1)})`);
    } else if (rr >= 1.5) {
      compressionScore += 10;
      reasons.push(`📊 RR جيد (${rr.toFixed(1)})`);
    } else if (rr >= 1.0) {
      compressionScore += 5;
      reasons.push(`📊 RR مقبول (${rr.toFixed(1)})`);
    } else {
      warnings.push(`⚠️ RR منخفض (${rr.toFixed(1)})`);
      compressionScore -= 15;
    }

    // ─── 4. النتيجة النهائية ──────────────────────────
    score = Math.min(Math.max(compressionScore + 30, 0), 100);
    confidence = Math.min(Math.max(confidence + (score - 50) / 5, 30), 95);

    const verdict = score >= 70 ? 'bullish' : score >= 50 ? 'neutral' : 'bearish';
    const impact = (score - 50) / 10;

    metrics.compressionScore = compressionScore;
    metrics.atrPct = atrPct;
    metrics.resistanceDistance = resistanceDistance;
    metrics.rr = rr;
    metrics.support = support;
    metrics.resistance = resistance;
    metrics.stop = stop;
    metrics.t1 = t1;
    metrics.t2 = t2;
    metrics.t3 = t3;

    if (score >= 70) {
      reasons.push('✅ ضغط سعري + اختراق قريب + RR ممتاز');
    }

    return this.formatResult(score, confidence, impact, verdict, reasons, warnings, metrics, 100 - confidence);
  }
}
