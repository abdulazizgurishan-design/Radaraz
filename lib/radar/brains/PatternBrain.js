// lib/radar/brains/PatternBrain.js — v18
import { Brain } from '../core/Brain.js';

export class PatternBrain extends Brain {
  static dependencies = ['Market Brain', 'Liquidity Brain'];

  constructor(config = {}) {
    super('Pattern Brain', {
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

    const bars = context.bars || [];
    const price = context.price || 0;
    const features = context.features || {};

    if (!bars || bars.length < 30) {
      return this.formatResult(50, 50, 0, 'neutral', ['⚠️ بيانات غير كافية'], [], {}, 50);
    }

    const highs = bars.map(b => b.h);
    const lows = bars.map(b => b.l);
    const closes = bars.map(b => b.c);
    const vols = bars.map(b => b.v);

    let score = 50;
    let confidence = 60;
    const patterns = [];

    // ─── 1. Early Accumulation ──────────────────────────────
    // ATR Compression
    const atr = features.atr14 || 0;
    const atrPct = price > 0 ? (atr / price) * 100 : 0;
    if (atrPct < 2) {
      score += 15;
      confidence += 10;
      reasons.push('✅ ATR منخفض (ضغط سعري)');
      patterns.push('ATR Compression');
    }

    // Higher Lows
    const last5Lows = lows.slice(-5);
    const higherLows = last5Lows.every((l, i) => i === 0 || l > last5Lows[i - 1]);
    if (higherLows) {
      score += 10;
      reasons.push('✅ Higher Lows (قاع مرتفع)');
      patterns.push('Higher Lows');
    }

    // Higher Highs
    const last5Highs = highs.slice(-5);
    const higherHighs = last5Highs.every((h, i) => i === 0 || h > last5Highs[i - 1]);
    if (higherHighs) {
      score += 8;
      reasons.push('✅ Higher Highs (قمة أعلى)');
      patterns.push('Higher Highs');
    }

    // Volume Dry Up
    const avgVol = sma(vols.slice(0, -1), 20);
    const lastVol = vols[vols.length - 1];
    if (avgVol && lastVol < avgVol * 0.7) {
      score += 10;
      reasons.push('✅ Volume Dry Up (انخفاض الحجم)');
      patterns.push('Volume Dry Up');
    }

    // Tight Range
    const range10 = ((Math.max(...highs.slice(-10)) - Math.min(...lows.slice(-10))) / price) * 100;
    if (range10 < 3) {
      score += 10;
      reasons.push('✅ Tight Range (مدى ضيق)');
      patterns.push('Tight Range');
    }

    // ─── 2. VCP ──────────────────────────────────────────────
    const vcp = vcpCheck(bars);
    if (vcp.vcp) {
      score += 12;
      reasons.push(`✅ VCP مكتمل (${vcp.contraction}%)`);
      patterns.push('VCP');
    }

    // ─── 3. OBV (On-Balance Volume) ──────────────────────────
    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) obv += vols[i];
      else if (closes[i] < closes[i - 1]) obv -= vols[i];
    }
    const obvTrend = obv > 0 ? 'صاعد' : 'هابط';
    if (obvTrend === 'صاعد') {
      score += 8;
      reasons.push('✅ OBV صاعد (قوة شرائية)');
      patterns.push('OBV Up');
    }

    // ─── 4. CMF (Chaikin Money Flow) ──────────────────────────
    let cmf = 0;
    let cmfVol = 0;
    for (let i = Math.max(0, bars.length - 20); i < bars.length; i++) {
      const b = bars[i];
      const mfMultiplier = ((b.c - b.l) - (b.h - b.c)) / (b.h - b.l);
      cmf += mfMultiplier * b.v;
      cmfVol += b.v;
    }
    const cmfValue = cmfVol > 0 ? cmf / cmfVol : 0;
    if (cmfValue > 0.1) {
      score += 8;
      reasons.push('✅ CMF موجب (سيولة ذكية)');
      patterns.push('CMF Positive');
    } else if (cmfValue < -0.1) {
      warnings.push('⚠️ CMF سالب (سيولة خارجة)');
      score -= 8;
    }

    // ─── 5. Anchored VWAP ──────────────────────────────────────
    // سيتم إضافته في الإصدارات القادمة

    // ─── 6. النتيجة النهائية ────────────────────────────────
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.patterns = patterns;
    metrics.obvTrend = obvTrend;
    metrics.cmf = cmfValue;
    metrics.atrPct = atrPct;
    metrics.vcpComplete = vcp.vcp;
    metrics.higherLows = higherLows;
    metrics.higherHighs = higherHighs;
    metrics.patternScore = finalScore;

    if (patterns.length >= 4) {
      reasons.push(`✅ ${patterns.length} أنماط متطابقة (قوة)`);
    }

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
