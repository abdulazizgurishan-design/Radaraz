// lib/radar/brains/PortfolioBrain.js
import { Brain } from '../core/Brain.js';

export class PortfolioBrain extends Brain {
  static dependencies = ['Market Brain', 'Sector Brain'];

  constructor(config = {}) {
    super('Portfolio Brain', {
      weight: 0.7,
      enabled: true,
      timeHorizon: 'position',
      ...config,
    });
  }

  async analyze(context) {
    const reasons = [];
    const warnings = [];
    const metrics = {};

    const portfolio = context.portfolio || {};
    const sectorData = context.sectorData || {};
    const symbolData = context.symbolData || {};

    const currentSymbol = symbolData.symbol || '';
    const currentSector = sectorData.sector || 'غير معروف';

    // افتراضيات المحفظة (لو لم تكن موجودة)
    const holdings = portfolio.holdings || [];
    const maxSectorExposure = portfolio.maxSectorExposure || 0.30;
    const maxPositionSize = portfolio.maxPositionSize || 0.10;

    let score = 50;
    let confidence = 60;

    // 1. التحقق من تكرار القطاع
    const sectorHoldings = holdings.filter(h => h.sector === currentSector);
    const sectorExposure = sectorHoldings.reduce((sum, h) => sum + (h.value / portfolio.totalValue || 0), 0);

    if (sectorExposure + 0.02 > maxSectorExposure) {
      warnings.push(`⚠️ تعرض القطاع ${currentSector} مرتفع (${(sectorExposure * 100).toFixed(0)}%)`);
      score -= 20;
      confidence -= 15;
    } else if (sectorExposure > maxSectorExposure * 0.7) {
      warnings.push(`⚠️ تعرض القطاع ${currentSector} متوسط (${(sectorExposure * 100).toFixed(0)}%)`);
      score -= 10;
      confidence -= 10;
    } else {
      reasons.push(`✅ تعرض القطاع ${currentSector} مناسب (${(sectorExposure * 100).toFixed(0)}%)`);
    }

    // 2. التحقق من تكرار السهم نفسه
    const existingPosition = holdings.find(h => h.symbol === currentSymbol);
    if (existingPosition) {
      warnings.push(`⚠️ لديك بالفعل مركز في ${currentSymbol}`);
      score -= 15;
      confidence -= 10;
    }

    // 3. عدد الصفقات المفتوحة
    const openPositions = holdings.filter(h => h.status === 'open').length;
    const maxPositions = portfolio.maxPositions || 10;

    if (openPositions >= maxPositions) {
      warnings.push(`⚠️ عدد الصفقات المفتوحة ${openPositions} (الحد ${maxPositions})`);
      score -= 15;
      confidence -= 10;
    } else {
      reasons.push(`✅ عدد الصفقات المفتوحة ${openPositions}/${maxPositions}`);
    }

    // 4. النتيجة النهائية
    const finalScore = Math.min(Math.max(score, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.sectorExposure = sectorExposure;
    metrics.openPositions = openPositions;
    metrics.maxPositions = maxPositions;
    metrics.hasExistingPosition = !!existingPosition;
    metrics.portfolioScore = finalScore;

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
