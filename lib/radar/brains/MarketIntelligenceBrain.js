// lib/radar/brains/MarketIntelligenceBrain.js — v16
import { Brain } from '../core/Brain.js';

export class MarketIntelligenceBrain extends Brain {
  static dependencies = [];

  constructor(config = {}) {
    super('Market Intelligence Brain', {
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
    const features = context.features || {};

    const spy = marketData.spy || {};
    const qqq = marketData.qqq || {};
    const iwm = marketData.iwm || {};
    const vix = marketData.vix || {};

    let score = 60;
    let confidence = 70;

    // ─── 1. SPY ──────────────────────────────────────────────
    const spyAboveVwap = spy.price > spy.vwap;
    const spyChange = spy.change || 0;

    if (spyAboveVwap && spyChange > 0.5) {
      score += 10;
      confidence += 5;
      reasons.push('✅ SPY فوق VWAP و صاعد (سوق قوي)');
    } else if (spyAboveVwap) {
      score += 5;
      reasons.push('📊 SPY فوق VWAP');
    } else if (spyChange < -0.5) {
      warnings.push('⚠️ SPY هابط (سوق ضعيف)');
      score -= 10;
      confidence -= 5;
    } else {
      warnings.push('⚠️ SPY تحت VWAP');
      score -= 5;
    }

    // ─── 2. QQQ (التكنولوجيا) ──────────────────────────────
    const qqqAboveVwap = qqq.price > qqq.vwap;
    const qqqChange = qqq.change || 0;

    if (qqqAboveVwap && qqqChange > 0.5) {
      score += 8;
      reasons.push('✅ QQQ قوي (التكنولوجيا داعمة)');
    } else if (qqqAboveVwap) {
      score += 4;
      reasons.push('📊 QQQ جيد');
    } else if (qqqChange < -0.5) {
      warnings.push('⚠️ QQQ ضعيف (التكنولوجيا متراجعة)');
      score -= 8;
      confidence -= 5;
    }

    // ─── 3. IWM (الأسهم الصغيرة) ──────────────────────────
    const iwmAboveVwap = iwm.price > iwm.vwap;
    const iwmChange = iwm.change || 0;

    if (iwmAboveVwap && iwmChange > 0.5) {
      score += 6;
      reasons.push('✅ IWM قوي (الأسهم الصغيرة داعمة)');
    } else if (iwmAboveVwap) {
      score += 3;
      reasons.push('📊 IWM جيد');
    } else if (iwmChange < -0.5) {
      warnings.push('⚠️ IWM ضعيف (الأسهم الصغيرة متراجعة)');
      score -= 6;
    }

    // ─── 4. VIX (التقلب) ────────────────────────────────────
    const vixLow = vix.price < 18;
    const vixHigh = vix.price > 25;

    if (vixLow) {
      score += 6;
      reasons.push(`✅ VIX منخفض (${vix.price.toFixed(1)}) — السوق هادئ`);
    } else if (vixHigh) {
      warnings.push(`⚠️ VIX مرتفع (${vix.price.toFixed(1)}) — تقلبات عالية`);
      score -= 8;
      confidence -= 5;
    } else {
      reasons.push(`📊 VIX متوسط (${vix.price.toFixed(1)})`);
    }

    // ─── 5. Breadth (توسع السوق) ──────────────────────────
    // سيتم إضافته عند توفر البيانات

    // ─── 6. حالة السوق النهائية ──────────────────────────
    let regime = 'neutral';
    if (score >= 80) regime = 'strong_bull';
    else if (score >= 65) regime = 'bull';
    else if (score >= 50) regime = 'neutral';
    else if (score >= 35) regime = 'weak_bull';
    else regime = 'bear';

    metrics.regime = regime;
    metrics.spyPrice = spy.price;
    metrics.spyVwap = spy.vwap;
    metrics.spyAboveVwap = spyAboveVwap;
    metrics.qqqAboveVwap = qqqAboveVwap;
    metrics.iwmAboveVwap = iwmAboveVwap;
    metrics.vixPrice = vix.price;
    metrics.vixLow = vixLow;
    metrics.vixHigh = vixHigh;
    metrics.marketScore = score;

    // ─── 7. توصية السوق ──────────────────────────────────
    let marketRecommendation = 'متوسط';
    if (score >= 80) marketRecommendation = '🔥 قوي جداً - مناسب للدخول';
    else if (score >= 65) marketRecommendation = '📈 قوي - مناسب';
    else if (score >= 50) marketRecommendation = '📊 محايد - انتظار';
    else marketRecommendation = '📉 ضعيف - تجنب الدخول';

    metrics.marketRecommendation = marketRecommendation;

    // ─── 8. النتيجة النهائية ──────────────────────────────
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
