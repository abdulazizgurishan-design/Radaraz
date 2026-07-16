// lib/radar/core/FeedbackEngine.js — v18
export class FeedbackEngine {
  constructor(config = {}) {
    this.config = {
      rewardMultiplier: 1.1,
      penaltyMultiplier: 0.9,
      minTradesForFeedback: 10,
      ...config,
    };
  }

  // ─── تسجيل نتيجة صفقة ──────────────────────────────────────
  recordTrade(trade) {
    const result = {
      symbol: trade.symbol,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      pnl: trade.pnl,
      pnlPct: trade.pnlPct,
      reachedT1: trade.reachedT1 || false,
      reachedT2: trade.reachedT2 || false,
      reachedT3: trade.reachedT3 || false,
      stopped: trade.stopped || false,
      duration: trade.duration || 0,
      predictionScore: trade.predictionScore || 0,
      grade: trade.grade || 'WATCH',
      timing: trade.timing || 'UNKNOWN',
      timestamp: new Date().toISOString(),
    };

    // حفظ في قاعدة البيانات
    this._saveTrade(result);

    // تحديث الأوزان
    this._updateWeights(result);
  }

  // ─── حفظ الصفقة ────────────────────────────────────────────
  async _saveTrade(trade) {
    try {
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

      await fetch(`${SUPABASE_URL}/rest/v1/trade_history`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trade),
      });
    } catch (error) {
      console.error('Failed to save trade:', error.message);
    }
  }

  // ─── تحديث الأوزان بناءً على النتائج ──────────────────────
  async _updateWeights(trade) {
    const success = trade.pnl > 0 || trade.reachedT1;

    // تحميل الأوزان الحالية
    const currentWeights = await this._loadWeights();

    // تحديث الأوزان
    const updatedWeights = { ...currentWeights };

    // العوامل التي ساهمت في النجاح/الفشل
    const factors = trade.factors || {};

    for (const [factor, value] of Object.entries(factors)) {
      if (updatedWeights[factor] !== undefined) {
        if (success) {
          // مكافأة: زيادة الوزن
          updatedWeights[factor] = updatedWeights[factor] * this.config.rewardMultiplier;
        } else {
          // عقوبة: تخفيض الوزن
          updatedWeights[factor] = updatedWeights[factor] * this.config.penaltyMultiplier;
        }
      }
    }

    // تطبيع الأوزان
    const total = Object.values(updatedWeights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(updatedWeights)) {
      updatedWeights[key] = updatedWeights[key] / total;
    }

    // حفظ الأوزان الجديدة
    await this._saveWeights(updatedWeights);
  }

  // ─── تحميل الأوزان ──────────────────────────────────────────
  async _loadWeights() {
    try {
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/radar_weights?id=eq.1&select=*`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      const data = await res.json();
      if (data && data[0] && data[0].weights) {
        return data[0].weights;
      }
    } catch (error) {
      console.error('Failed to load weights:', error.message);
    }
    return {
      earlyAccumulation: 0.30,
      breakoutProbability: 0.25,
      structure: 0.20,
      liquidity: 0.15,
      marketContext: 0.10,
      sectorStrength: 0.00,
    };
  }

  // ─── حفظ الأوزان ────────────────────────────────────────────
  async _saveWeights(weights) {
    try {
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

      await fetch(`${SUPABASE_URL}/rest/v1/radar_weights`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: 1,
          weights: weights,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to save weights:', error.message);
    }
  }

  // ─── تحليل أداء العوامل ──────────────────────────────────────
  async analyzeFactorPerformance() {
    try {
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/trade_history?limit=500`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      const trades = await res.json();

      if (!trades || trades.length < this.config.minTradesForFeedback) {
        return { message: 'بيانات غير كافية' };
      }

      const factorPerformance = {};

      for (const trade of trades) {
        const factors = trade.factors || {};
        const success = trade.pnl > 0 || trade.reachedT1;

        for (const [factor, value] of Object.entries(factors)) {
          if (!factorPerformance[factor]) {
            factorPerformance[factor] = { total: 0, wins: 0 };
          }
          factorPerformance[factor].total++;
          if (success) factorPerformance[factor].wins++;
        }
      }

      const result = {};
      for (const [factor, data] of Object.entries(factorPerformance)) {
        if (data.total > 10) {
          result[factor] = {
            winRate: (data.wins / data.total) * 100,
            samples: data.total,
          };
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to analyze performance:', error.message);
      return null;
    }
  }
}
