// lib/radar/brains/LiquidityBrain.js — v14 (Early Accumulation)
import { Brain } from '../core/Brain.js';

export class LiquidityBrain extends Brain {
  static dependencies = ['Market Brain'];

  constructor(config = {}) {
    super('Liquidity Brain', {
      weight: 1.3,
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
    const symbolData = context.symbolData || {};
    const bars = context.bars || [];

    const price = context.price || 0;
    const volume = symbolData.volume || 0;
    const dollarVol = symbolData.dollar_vol || 0;
    const rvol = features.relativeVolume || 0;
    const spread = symbolData.spread || 0;

    let score = 50;
    let confidence = 60;
    let accumulationScore = 0;

    // ─── 1. Early Accumulation Detection ──────────────
    if (bars && bars.length >= 30) {
      const vols = bars.map(b => b.v);
      const last5 = vols.slice(-5);
      const prev5 = vols.slice(-10, -5);
      const prev10 = vols.slice(-20, -10);

      const avgLast5 = last5.reduce((a, b) => a + b, 0) / last5.length;
      const avgPrev5 = prev5.reduce((a, b) => a + b, 0) / prev5.length;
      const avgPrev10 = prev10.reduce((a, b) => a + b, 0) / prev10.length;

      // RVOL Trend: تدريجي وليس مفاجئ
      const rvolTrend = avgLast5 / avgPrev5;
      const rvolLong = avgLast5 / avgPrev10;

      if (rvolTrend > 1.0 && rvolTrend < 1.8) {
        accumulationScore += 20;
        reasons.push('✅ RVOL يرتفع تدريجياً (تجميع ذكي)');
      } else if (rvolTrend > 1.8) {
        warnings.push('⚠️ RVOL قفز بشكل مفاجئ (قد يكون متأخراً)');
        accumulationScore += 5;
      } else {
        accumulationScore += 5;
      }

      if (rvolLong > 1.2 && rvolLong < 2.0) {
        accumulationScore += 10;
        reasons.push('✅ حجم مرتفع مقارنة بآخر 20 دقيقة (سيولة تدخل)');
      }

      metrics.rvolTrend = rvolTrend;
      metrics.rvolLong = rvolLong;
    }

    // ─── 2. Liquidity Quality ──────────────────────────
    if (dollarVol >= 10_000_000) {
      accumulationScore += 15;
      reasons.push('✅ Dollar Volume مرتفع (سيولة ممتازة)');
    } else if (dollarVol >= 5_000_000) {
      accumulationScore += 10;
      reasons.push('📊 Dollar Volume جيد');
    } else if (dollarVol >= 1_000_000) {
      accumulationScore += 5;
    } else {
      warnings.push('⚠️ Dollar Volume منخفض');
      accumulationScore -= 10;
    }

    // ─── 3. Spread ──────────────────────────────────────
    if (spread < 0.2) {
      accumulationScore += 10;
      reasons.push('✅ Spread ضيق (سيولة عالية)');
    } else if (spread > 1) {
      warnings.push('⚠️ Spread واسع (سيولة منخفضة)');
      accumulationScore -= 10;
    }

    // ─── 4. RVOL Stability ─────────────────────────────
    if (rvol >= 1.5 && rvol <= 3.5) {
      accumulationScore += 10;
      reasons.push(`✅ RVOL ${rvol.toFixed(1)}x (مستقر)`);
    } else if (rvol > 3.5) {
      warnings.push(`⚠️ RVOL ${rvol.toFixed(1)}x (مرتفع جداً)`);
      accumulationScore -= 5;
    } else if (rvol < 1.0) {
      warnings.push(`⚠️ RVOL ${rvol.toFixed(1)}x (منخفض)`);
      accumulationScore -= 5;
    }

    // ─── 5. النتيجة النهائية ──────────────────────────
    score = Math.min(Math.max(accumulationScore + 30, 0), 100);
    confidence = Math.min(Math.max(confidence + (score - 50) / 5, 30), 95);

    const verdict = score >= 70 ? 'bullish' : score >= 50 ? 'neutral' : 'bearish';
    const impact = (score - 50) / 10;

    metrics.accumulationScore = accumulationScore;
    metrics.rvol = rvol;
    metrics.dollarVol = dollarVol;
    metrics.spread = spread;

    if (score >= 70) {
      reasons.push('✅ تجميع واضح وسيولة ذكية');
    }

    return this.formatResult(score, confidence, impact, verdict, reasons, warnings, metrics, 100 - confidence);
  }
}
