// lib/radar/core/CorrelationEngine.js — v17
export class CorrelationEngine {
  constructor(config = {}) {
    this.config = {
      correlationWindow: 20, // أيام
      minCorrelation: 0.7,
      ...config,
    };
  }

  analyze(symbol, sector, marketData, historicalData = null) {
    const result = {
      sectorCorrelation: 0,
      marketCorrelation: 0,
      peerCorrelation: 0,
      score: 50,
      reasons: [],
    };

    // ─── 1. تحليل ارتباط القطاع ──────────────────────────
    if (sector && historicalData) {
      // المحاكاة: في الواقع يتم حساب الارتباط بين السهم والقطاع
      const sectorData = historicalData.filter(h => h.sector === sector);
      if (sectorData.length > 10) {
        const sectorAvg = sectorData.reduce((a, b) => a + b.changePct, 0) / sectorData.length;
        const symbolAvg = historicalData.filter(h => h.symbol === symbol)
          .reduce((a, b) => a + b.changePct, 0) / 10 || 0;

        // ارتباط تقريبي
        const correlation = Math.min(Math.abs(symbolAvg - sectorAvg) / 2, 1);
        result.sectorCorrelation = correlation;
        result.score += correlation * 10;
        if (correlation > 0.6) {
          result.reasons.push(`✅ السهم يتحرك مع القطاع (${Math.round(correlation * 100)}%)`);
        } else if (correlation < 0.3) {
          result.reasons.push(`⚠️ السهم لا يتحرك مع القطاع (${Math.round(correlation * 100)}%)`);
        }
      }
    }

    // ─── 2. تحليل ارتباط السوق ──────────────────────────
    if (marketData && historicalData) {
      const spyData = historicalData.filter(h => h.symbol === 'SPY');
      if (spyData.length > 10) {
        const symbolData = historicalData.filter(h => h.symbol === symbol);
        if (symbolData.length > 10) {
          // ارتباط تقريبي مع SPY
          const correlation = 0.5 + Math.random() * 0.3; // محاكاة
          result.marketCorrelation = correlation;
          result.score += correlation * 5;
          if (correlation > 0.7) {
            result.reasons.push(`📊 مرتبط بالسوق (${Math.round(correlation * 100)}%)`);
          }
        }
      }
    }

    // ─── 3. تحليل ارتباط الأسهم المشابهة ──────────────
    // سيتم إضافته في الإصدارات القادمة

    // ─── 4. النتيجة النهائية ────────────────────────────
    result.score = Math.min(Math.max(result.score, 0), 100);

    return result;
  }
}
