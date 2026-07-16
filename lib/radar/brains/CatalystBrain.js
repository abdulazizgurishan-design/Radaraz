// lib/radar/brains/CatalystBrain.js — v18
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
    const symbolData = context.symbolData || {};
    const features = context.features || {};

    let score = 50;
    let confidence = 60;

    // ─── 1. الأخبار (آخر 5 أخبار) ──────────────────────────
    if (news && news.length > 0) {
      const recentNews = news.filter(n => n.ageHours < 2);
      const olderNews = news.filter(n => n.ageHours >= 2 && n.ageHours < 24);

      // أخبار حديثة (أقل من ساعتين)
      if (recentNews.length > 0) {
        score += 15;
        confidence += 10;
        reasons.push(`✅ خبر حديث (${recentNews.length})`);

        // تحليل المشاعر
        for (const n of recentNews.slice(0, 3)) {
          const sentiment = n.sentiment || 'محايد';
          if (sentiment === 'إيجابي') {
            score += 5;
            reasons.push(`  📰 ${n.title?.slice(0, 40)}... (إيجابي)`);
          } else if (sentiment === 'سلبي') {
            warnings.push(`  📰 ${n.title?.slice(0, 40)}... (سلبي)`);
            score -= 5;
          }
        }
      } else if (olderNews.length > 0) {
        score += 5;
        reasons.push(`📰 أخبار خلال 24 ساعة (${olderNews.length})`);
      }

      // كلمات مفتاحية
      const keywords = ['FDA', 'approval', 'contract', 'earnings', 'upgrade', 'partner', 'breakthrough', 'AI', 'patent'];
      let keywordCount = 0;
      for (const n of news) {
        if (n.title) {
          for (const kw of keywords) {
            if (n.title.includes(kw)) keywordCount++;
          }
        }
      }
      if (keywordCount > 0) {
        score += Math.min(keywordCount * 3, 15);
        reasons.push(`✅ كلمات مفتاحية: ${keywordCount}`);
      }
    }

    // ─── 2. الأرباح ──────────────────────────────────────────
    const earnings = context.earnings || null;
    if (earnings) {
      if (earnings.daysUntil > 0 && earnings.daysUntil <= 3) {
        score += 10;
        warnings.push(`⚠️ أرباح خلال ${earnings.daysUntil} يوم (تقلبات)`);
        confidence -= 5;
      } else if (earnings.daysUntil < 0 && earnings.daysUntil >= -1) {
        score -= 15;
        warnings.push('⚠️ أرباح صدرت أمس (تقلبات عالية)');
        confidence -= 10;
      }
    }

    // ─── 3. FDA / موافقات ────────────────────────────────────
    if (symbolData.fdaDate) {
      const daysUntilFDA = Math.ceil((new Date(symbolData.fdaDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilFDA > 0 && daysUntilFDA <= 7) {
        score += 15;
        reasons.push(`✅ FDA خلال ${daysUntilFDA} يوم (محفز قوي)`);
        confidence += 10;
      }
    }

    // ─── 4. النتيجة النهائية ────────────────────────────────
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.hasNews = news && news.length > 0;
    metrics.hasEarnings = !!earnings;
    metrics.newsCount = news?.length || 0;
    metrics.recentNewsCount = news?.filter(n => n.ageHours < 2).length || 0;
    metrics.catalystScore = finalScore;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
