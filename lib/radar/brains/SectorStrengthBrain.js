// lib/radar/brains/SectorStrengthBrain.js — v16
import { Brain } from '../core/Brain.js';

export class SectorStrengthBrain extends Brain {
  static dependencies = ['Market Brain'];

  constructor(config = {}) {
    super('Sector Strength Brain', {
      weight: 1.1,
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
    const sectorData = context.sectorData || {};
    const marketData = context.marketData || {};

    const sector = sectorData.sector || 'unknown';
    const sectorChange = sectorData.change || 0;
    const sectorVolume = sectorData.volume || 0;
    const sectorRank = sectorData.rank || 50; // 0-100 ترتيب القطاع

    const spyChange = marketData.spy?.change || 0;
    const qqqChange = marketData.qqq?.change || 0;
    const iwmChange = marketData.iwm?.change || 0;

    let score = 50;
    let confidence = 60;

    // ─── 1. قوة القطاع مقابل SPY ──────────────────────────
    const sectorVsSpy = sectorChange - spyChange;

    if (sectorVsSpy > 1) {
      score += 20;
      confidence += 10;
      reasons.push(`✅ القطاع أقوى من SPY بنسبة ${sectorVsSpy.toFixed(1)}%`);
    } else if (sectorVsSpy > 0.5) {
      score += 12;
      confidence += 5;
      reasons.push(`📊 القطاع أفضل من SPY (${sectorVsSpy.toFixed(1)}%)`);
    } else if (sectorVsSpy > 0) {
      score += 5;
      reasons.push(`📊 القطاع متوافق مع SPY`);
    } else {
      warnings.push(`⚠️ القطاع أضعف من SPY (${sectorVsSpy.toFixed(1)}%)`);
      score -= 10;
      confidence -= 5;
    }

    // ─── 2. ترتيب القطاع بين القطاعات ──────────────────────
    if (sectorRank >= 80) {
      score += 15;
      confidence += 10;
      reasons.push(`✅ القطاع من الأقوى (ترتيب ${Math.round(sectorRank)})`);
    } else if (sectorRank >= 60) {
      score += 10;
      confidence += 5;
      reasons.push(`📊 القطاع جيد (ترتيب ${Math.round(sectorRank)})`);
    } else if (sectorRank >= 40) {
      score += 5;
      reasons.push(`📊 القطاع متوسط (ترتيب ${Math.round(sectorRank)})`);
    } else {
      warnings.push(`⚠️ القطاع ضعيف (ترتيب ${Math.round(sectorRank)})`);
      score -= 10;
      confidence -= 5;
    }

    // ─── 3. حجم القطاع مقابل المتوسط ───────────────────────
    const avgSectorVolume = sectorData.avgVolume || 1;
    const sectorVolRatio = sectorVolume / avgSectorVolume;

    if (sectorVolRatio > 2) {
      score += 10;
      reasons.push(`✅ حجم القطاع مرتفع (${sectorVolRatio.toFixed(1)}x)`);
    } else if (sectorVolRatio > 1.5) {
      score += 5;
      reasons.push(`📊 حجم القطاع جيد (${sectorVolRatio.toFixed(1)}x)`);
    } else if (sectorVolRatio < 0.5) {
      warnings.push(`⚠️ حجم القطاع منخفض (${sectorVolRatio.toFixed(1)}x)`);
      score -= 5;
    }

    // ─── 4. اتجاه القطاع (آخر 5 أيام) ──────────────────────
    const sectorTrend = sectorData.trend || 0; // -100 to 100

    if (sectorTrend > 20) {
      score += 10;
      reasons.push(`✅ اتجاه القطاع صاعد بقوة (${Math.round(sectorTrend)})`);
    } else if (sectorTrend > 5) {
      score += 5;
      reasons.push(`📊 اتجاه القطاع صاعد (${Math.round(sectorTrend)})`);
    } else if (sectorTrend < -20) {
      warnings.push(`⚠️ اتجاه القطاع هابط (${Math.round(sectorTrend)})`);
      score -= 10;
      confidence -= 5;
    }

    // ─── 5. النتيجة النهائية ──────────────────────────────
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.sector = sector;
    metrics.sectorRank = sectorRank;
    metrics.sectorVsSpy = sectorVsSpy;
    metrics.sectorVolRatio = sectorVolRatio;
    metrics.sectorTrend = sectorTrend;
    metrics.sectorStrength = finalScore;

    // ─── 6. توصيات القطاع ──────────────────────────────────
    let sectorRecommendation = 'متوسط';
    if (finalScore >= 80) sectorRecommendation = '🔥 قوي جداً';
    else if (finalScore >= 65) sectorRecommendation = '📈 قوي';
    else if (finalScore >= 50) sectorRecommendation = '📊 محايد';
    else sectorRecommendation = '📉 ضعيف';

    metrics.sectorRecommendation = sectorRecommendation;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
