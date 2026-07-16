// lib/radar/brains/RiskBrain.js
import { Brain } from '../core/Brain.js';

export class RiskBrain extends Brain {
  static dependencies = ['Market Brain', 'Liquidity Brain'];

  constructor(config = {}) {
    super('Risk Brain', {
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

    const features = context.features || {};
    const symbolData = context.symbolData || {};

    const price = context.price || 0;
    const gap = features.gapPercent || 0;
    const atrPct = features.atr14 && price > 0 ? (features.atr14 / price) * 100 : 0;
    const volume = symbolData.volume || 0;
    const dollarVol = symbolData.dollar_vol || 0;

    let riskScore = 100;
    let confidence = 80;

    // 1. Gap Risk
    if (Math.abs(gap) > 10) {
      riskScore -= 30;
      confidence -= 20;
      warnings.push(`⚠️ Gap كبير (${gap.toFixed(1)}%)`);
    } else if (Math.abs(gap) > 5) {
      riskScore -= 15;
      confidence -= 10;
      warnings.push(`⚠️ Gap متوسط (${gap.toFixed(1)}%)`);
    } else {
      reasons.push(`✅ Gap منخفض (${gap.toFixed(1)}%)`);
    }

    // 2. ATR Risk
    if (atrPct > 10) {
      riskScore -= 25;
      confidence -= 15;
      warnings.push(`⚠️ ATR مرتفع جداً (${atrPct.toFixed(1)}%)`);
    } else if (atrPct > 7) {
      riskScore -= 15;
      confidence -= 10;
      warnings.push(`⚠️ ATR مرتفع (${atrPct.toFixed(1)}%)`);
    } else {
      reasons.push(`✅ ATR مناسب (${atrPct.toFixed(1)}%)`);
    }

    // 3. Liquidity Risk
    if (dollarVol < 1_000_000) {
      riskScore -= 20;
      confidence -= 15;
      warnings.push(`⚠️ سيولة منخفضة ($${(dollarVol / 1_000_000).toFixed(1)}M)`);
    } else if (dollarVol < 5_000_000) {
      riskScore -= 10;
      confidence -= 10;
      warnings.push(`⚠️ سيولة متوسطة ($${(dollarVol / 1_000_000).toFixed(1)}M)`);
    } else {
      reasons.push(`✅ سيولة ممتازة ($${(dollarVol / 1_000_000).toFixed(0)}M)`);
    }

    // 4. Market Risk (من Market Brain)
    const marketData = context.marketData || {};
    const regime = marketData.regime || 'neutral';
    if (regime === 'risk_off') {
      riskScore -= 20;
      confidence -= 15;
      warnings.push('⚠️ السوق في حالة Risk-Off');
    } else if (regime === 'weak') {
      riskScore -= 10;
      confidence -= 10;
      warnings.push('⚠️ السوق ضعيف');
    } else {
      reasons.push('✅ السوق داعم');
    }

    // 5. النتيجة النهائية
    const finalScore = Math.min(Math.max(riskScore, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.gap = gap;
    metrics.atrPct = atrPct;
    metrics.dollarVol = dollarVol;
    metrics.riskScore = finalScore;
    metrics.riskLevel = finalScore >= 70 ? 'منخفضة' : finalScore >= 50 ? 'متوسطة' : 'مرتفعة';

    if (finalScore >= 70) {
      reasons.push('✅ مخاطرة منخفضة');
    }

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
