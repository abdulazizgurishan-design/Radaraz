// lib/radar/brains/MarketIntelligenceBrain.js — v17
import { Brain } from '../core/Brain.js';

export class MarketIntelligenceBrain extends Brain {
  static dependencies = [];

  constructor(config = {}) {
    super('Market Intelligence Brain', {
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

    const marketData = context.marketData || {};
    const features = context.features || {};

    // ─── 1. استخراج بيانات السوق ────────────────────────
    const spy = marketData.spy || {};
    const qqq = marketData.qqq || {};
    const iwm = marketData.iwm || {};
    const vix = marketData.vix || {};
    const dxy = marketData.dxy || {};
    const tlt = marketData.tlt || {};

    // ─── 2. حساب النقاط ──────────────────────────────────
    let score = 60;
    let confidence = 70;
    const marketFactors = [];

    // SPY
    const spyAboveVwap = spy.price > spy.vwap;
    const spyChange = spy.change || 0;
    if (spyAboveVwap && spyChange > 0.5) {
      score += 10;
      confidence += 5;
      reasons.push('✅ SPY فوق VWAP و صاعد');
      marketFactors.push({ factor: 'SPY', value: 'قوي', impact: 10 });
    } else if (spyAboveVwap) {
      score += 5;
      reasons.push('📊 SPY فوق VWAP');
      marketFactors.push({ factor: 'SPY', value: 'جيد', impact: 5 });
    } else {
      warnings.push('⚠️ SPY تحت VWAP');
      score -= 8;
      marketFactors.push({ factor: 'SPY', value: 'ضعيف', impact: -8 });
    }

    // QQQ (التكنولوجيا)
    const qqqAboveVwap = qqq.price > qqq.vwap;
    const qqqChange = qqq.change || 0;
    if (qqqAboveVwap && qqqChange > 0.5) {
      score += 8;
      reasons.push('✅ QQQ قوي (التكنولوجيا داعمة)');
      marketFactors.push({ factor: 'QQQ', value: 'قوي', impact: 8 });
    } else if (qqqAboveVwap) {
      score += 4;
      reasons.push('📊 QQQ جيد');
      marketFactors.push({ factor: 'QQQ', value: 'جيد', impact: 4 });
    } else {
      warnings.push('⚠️ QQQ ضعيف');
      score -= 6;
      marketFactors.push({ factor: 'QQQ', value: 'ضعيف', impact: -6 });
    }

    // IWM (الأسهم الصغيرة)
    const iwmAboveVwap = iwm.price > iwm.vwap;
    const iwmChange = iwm.change || 0;
    if (iwmAboveVwap && iwmChange > 0.5) {
      score += 6;
      reasons.push('✅ IWM قوي (الأسهم الصغيرة داعمة)');
      marketFactors.push({ factor: 'IWM', value: 'قوي', impact: 6 });
    } else if (iwmAboveVwap) {
      score += 3;
      reasons.push('📊 IWM جيد');
      marketFactors.push({ factor: 'IWM', value: 'جيد', impact: 3 });
    } else {
      warnings.push('⚠️ IWM ضعيف');
      score -= 5;
      marketFactors.push({ factor: 'IWM', value: 'ضعيف', impact: -5 });
    }

    // VIX (التقلب)
    const vixLow = vix.price < 18;
    const vixHigh = vix.price > 25;
    if (vixLow) {
      score += 6;
      reasons.push(`✅ VIX منخفض (${vix.price.toFixed(1)})`);
      marketFactors.push({ factor: 'VIX', value: 'منخفض', impact: 6 });
    } else if (vixHigh) {
      warnings.push(`⚠️ VIX مرتفع (${vix.price.toFixed(1)})`);
      score -= 8;
      marketFactors.push({ factor: 'VIX', value: 'مرتفع', impact: -8 });
    } else {
      reasons.push(`📊 VIX متوسط (${vix.price.toFixed(1)})`);
      marketFactors.push({ factor: 'VIX', value: 'متوسط', impact: 0 });
    }

    // DXY (الدولار)
    const dxyChange = dxy.change || 0;
    if (dxyChange > 0.5) {
      warnings.push('⚠️ الدولار قوي (ضغط على الأسهم)');
      score -= 5;
      marketFactors.push({ factor: 'DXY', value: 'قوي', impact: -5 });
    } else if (dxyChange < -0.5) {
      reasons.push('✅ الدولار ضعيف (داعم للأسهم)');
      score += 5;
      marketFactors.push({ factor: 'DXY', value: 'ضعيف', impact: 5 });
    }

    // TLT (السندات)
    const tltChange = tlt.change || 0;
    if (tltChange > 0.5) {
      warnings.push('⚠️ السندات صاعدة (خوف من السوق)');
      score -= 3;
      marketFactors.push({ factor: 'TLT', value: 'صاعد', impact: -3 });
    } else if (tltChange < -0.5) {
      reasons.push('✅ السندات هابطة (ثقة بالسوق)');
      score += 3;
      marketFactors.push({ factor: 'TLT', value: 'هابط', impact: 3 });
    }

    // ─── 3. حالة السوق النهائية ──────────────────────────
    let regime = 'neutral';
    if (score >= 85) regime = 'strong_bull';
    else if (score >= 70) regime = 'bull';
    else if (score >= 55) regime = 'neutral';
    else if (score >= 40) regime = 'weak_bull';
    else regime = 'bear';

    let recommendation = 'متوسط';
    if (score >= 80) recommendation = '🔥 قوي جداً - مناسب للدخول';
    else if (score >= 65) recommendation = '📈 قوي - مناسب';
    else if (score >= 50) recommendation = '📊 محايد - انتظار';
    else recommendation = '📉 ضعيف - تجنب الدخول';

    // ─── 4. النتيجة النهائية ────────────────────────────
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.regime = regime;
    metrics.recommendation = recommendation;
    metrics.marketFactors = marketFactors;
    metrics.spyAboveVwap = spyAboveVwap;
    metrics.qqqAboveVwap = qqqAboveVwap;
    metrics.iwmAboveVwap = iwmAboveVwap;
    metrics.vixPrice = vix.price;
    metrics.dxyChange = dxyChange;
    metrics.tltChange = tltChange;
    metrics.marketScore = finalScore;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
