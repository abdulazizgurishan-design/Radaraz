// lib/radar/brains/QualityControlBrain.js
import { Brain } from '../core/Brain.js';

export class QualityControlBrain extends Brain {
  static dependencies = [];

  constructor(config = {}) {
    super('Quality Control Brain', {
      weight: 1.0,
      enabled: true,
      ...config,
    });
  }

  async analyze(context) {
    const reasons = [];
    const warnings = [];
    const metrics = {};
    let qualityScore = 100;
    let confidence = 95;

    // 1. التحقق من البيانات الأساسية
    if (!context.price || context.price <= 0) {
      warnings.push('⚠️ السعر غير موجود أو صفر');
      qualityScore -= 30;
      confidence -= 20;
    }

    if (!context.bars || context.bars.length < 30) {
      warnings.push(`⚠️ بيانات الشموع غير كافية (${context.bars?.length || 0})`);
      qualityScore -= 20;
      confidence -= 15;
    }

    // 2. التحقق من ATR
    const atr = context.features?.atr14 || 0;
    if (atr === 0) {
      warnings.push('⚠️ ATR = 0 (بيانات غير صالحة)');
      qualityScore -= 25;
      confidence -= 20;
    }

    // 3. التحقق من VWAP
    const vwap = context.features?.vwap || 0;
    if (vwap === 0) {
      warnings.push('⚠️ VWAP غير موجود');
      qualityScore -= 10;
      confidence -= 10;
    }

    // 4. التحقق من API
    if (context.marketData?.error) {
      warnings.push('⚠️ فشل جلب بيانات السوق (API)');
      qualityScore -= 20;
      confidence -= 15;
    }

    // 5. التحقق من Gap
    const gap = context.features?.gapPercent || 0;
    if (Math.abs(gap) > 15) {
      warnings.push(`⚠️ Gap كبير (${gap.toFixed(1)}%) - خطر`);
      qualityScore -= 15;
      confidence -= 10;
    }

    // 6. التحقق من التقلب
    const atrPct = context.price > 0 ? (atr / context.price) * 100 : 0;
    if (atrPct > 10) {
      warnings.push(`⚠️ ATR مرتفع جداً (${atrPct.toFixed(1)}%)`);
      qualityScore -= 10;
      confidence -= 5;
    }

    // 7. التحقق من حجم التداول
    const volume = context.symbolData?.volume || 0;
    if (volume < 50_000) {
      warnings.push(`⚠️ حجم تداول منخفض (${volume.toLocaleString()})`);
      qualityScore -= 15;
      confidence -= 10;
    }

    // 8. التحقق من البيانات المكررة أو غير المنطقية
    const bars = context.bars || [];
    if (bars.length > 0) {
      const lastClose = bars[bars.length - 1]?.c || 0;
      if (lastClose > 0 && context.price) {
        const diffPct = Math.abs((lastClose - context.price) / context.price) * 100;
        if (diffPct > 5) {
          warnings.push(`⚠️ السعر الحالي لا يتطابق مع آخر إغلاق (${diffPct.toFixed(1)}%)`);
          qualityScore -= 10;
          confidence -= 10;
        }
      }
    }

    // النتيجة النهائية
    qualityScore = Math.min(Math.max(qualityScore, 0), 100);
    confidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = qualityScore >= 70 ? 'bullish' : qualityScore >= 50 ? 'neutral' : 'bearish';
    const impact = (qualityScore - 50) / 10;

    if (qualityScore >= 85) {
      reasons.push('✅ جميع البيانات صالحة وجاهزة للتحليل');
    }

    if (qualityScore >= 70) {
      reasons.push('✅ البيانات الأساسية سليمة');
    }

    metrics.qualityScore = qualityScore;
    metrics.hasWarnings = warnings.length > 0;
    metrics.warningCount = warnings.length;

    return this.formatResult(qualityScore, confidence, impact, verdict, reasons, warnings, metrics, 100 - confidence);
  }
}
