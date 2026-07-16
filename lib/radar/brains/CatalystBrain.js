// lib/radar/brains/CatalystBrain.js — محفزات السهم
import { Brain } from '../core/Brain.js';

export class CatalystBrain extends Brain {
  static dependencies = ['Market Brain'];

  constructor(config = {}) {
    super('Catalyst Brain', {
      weight: 0.9,
      enabled: true,
      timeHorizon: 'intraday',
      ...config,
    });
  }

  async analyze(context) {
    const reasons = [];
    const warnings = [];
    const metrics = {};

    const news = context.news || [];
    const earnings = context.earnings || null;
    const symbolData = context.symbolData || {};

    let score = 50;
    let confidence = 60;

    // ─── 1. الأخبار الحديثة ─────────────────────────────
    if (news && news.length > 0) {
      const recentNews = news.filter(n => n.ageHours < 2);
      if (recentNews.length > 0) {
        score += 15;
        confidence += 10;
        reasons.push(`✅ خبر حديث (${recentNews.length})`);
        for (const n of recentNews.slice(0, 2)) {
          reasons.push(`  📰 ${n.title?.slice(0, 50)}...`);
        }
      } else {
        const oldNews = news.filter(n => n.ageHours < 24);
        if (oldNews.length > 0) {
          score += 5;
          reasons.push(`📰 أخبار خلال 24 ساعة (${oldNews.length})`);
        }
      }
    }

    // ─── 2. الأرباح ──────────────────────────────────────
    if (earnings) {
      if (earnings.daysUntil > 0 && earnings.daysUntil <= 3) {
        score += 10;
        warnings.push(`⚠️ أرباح خلال ${earnings.daysUntil} يوم (تقلبات محتملة)`);
        confidence -= 5;
      } else if (earnings.daysUntil < 0 && earnings.daysUntil >= -1) {
        score -= 15;
        warnings.push('⚠️ أرباح صدرت أمس (تقلبات عالية)');
        confidence -= 10;
      }
    }

    // ─── 3. FDA / عقود / موافقات ────────────────────────
    if (symbolData.fdaDate) {
      const daysUntilFDA = Math.ceil((new Date(symbolData.fdaDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilFDA > 0 && daysUntilFDA <= 7) {
        score += 15;
        reasons.push(`✅ FDA خلال ${daysUntilFDA} يوم (محفز قوي)`);
        confidence += 10;
      }
    }

    // ─── 4. النتيجة النهائية ────────────────────────────
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.hasNews = news && news.length > 0;
    metrics.hasEarnings = !!earnings;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
