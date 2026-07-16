// lib/radar/core/StrategyProfiles.js
export const STRATEGY_PROFILES = {
  scalp: {
    id: 'scalp',
    name: 'سكالب',
    timeHorizon: 'intraday',
    maxHoldingMinutes: 30,
    minRR: 0.5,
    stopLossPct: 0.03,
    target1Pct: 0.02,
    target2Pct: 0.04,
    target3Pct: 0.06,
    minConfidence: 65,
    minScore: 60,
    enabledBrains: ['market', 'liquidity', 'momentum', 'structure'],
    weights: {
      market: 0.8,
      liquidity: 1.2,
      momentum: 1.3,
      structure: 1.1,
    },
  },

  day: {
    id: 'day',
    name: 'تداول يومي',
    timeHorizon: 'intraday',
    maxHoldingMinutes: 390,
    minRR: 1.0,
    stopLossPct: 0.04,
    target1Pct: 0.035,
    target2Pct: 0.06,
    target3Pct: 0.09,
    minConfidence: 70,
    minScore: 65,
    enabledBrains: ['market', 'liquidity', 'momentum', 'trend', 'structure', 'sector'],
    weights: {
      market: 1.0,
      liquidity: 1.0,
      momentum: 1.0,
      trend: 1.0,
      structure: 1.0,
      sector: 0.8,
    },
  },

  swing: {
    id: 'swing',
    name: 'متوسط المدى',
    timeHorizon: 'swing',
    maxHoldingDays: 10,
    minRR: 2.0,
    stopLossPct: 0.06,
    target1Pct: 0.05,
    target2Pct: 0.10,
    target3Pct: 0.15,
    minConfidence: 75,
    minScore: 70,
    enabledBrains: ['market', 'liquidity', 'trend', 'structure', 'sector', 'dna', 'relative_strength'],
    weights: {
      market: 1.0,
      liquidity: 0.8,
      trend: 1.3,
      structure: 1.2,
      sector: 1.0,
      dna: 1.1,
      relative_strength: 1.0,
    },
  },

  position: {
    id: 'position',
    name: 'استثمار طويل',
    timeHorizon: 'position',
    maxHoldingDays: 90,
    minRR: 3.0,
    stopLossPct: 0.08,
    target1Pct: 0.06,
    target2Pct: 0.12,
    target3Pct: 0.20,
    minConfidence: 80,
    minScore: 75,
    enabledBrains: ['market', 'trend', 'structure', 'sector', 'dna', 'relative_strength', 'risk'],
    weights: {
      market: 0.8,
      trend: 1.4,
      structure: 1.3,
      sector: 1.1,
      dna: 1.2,
      relative_strength: 1.0,
      risk: 1.0,
    },
  },
};

// الحصول على بروفايل
export function getStrategyProfile(id) {
  return STRATEGY_PROFILES[id] || STRATEGY_PROFILES.day;
}

// الحصول على جميع البروفايلات
export function getAllStrategyProfiles() {
  return Object.values(STRATEGY_PROFILES);
}
