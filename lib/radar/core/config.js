// lib/radar/core/config.js — الأوزان الجديدة لـ v14
export const CONFIG = {
  // ─── الأوزان الجديدة (v14) ──────────────────────────
  weights: {
    market: 1.2,
    liquidity: 1.3,      // Early Accumulation
    momentum: 0.8,       // تأكيد وليس اختيار
    trend: 1.0,
    structure: 1.4,      // Price Compression + Breakout
    dna: 1.0,
    sector: 1.1,
    relativeStrength: 1.2,
    risk: 1.3,
    catalyst: 0.9,
  },

  // ─── عتبات التصنيف ──────────────────────────────────
  thresholds: {
    ELITE: 85,
    PRIME: 75,
    STRONG: 65,
    GOOD: 55,ه
    WATCH: 45,
    AVOID: 0,
  },

  // ─── شروط القطع (Gating) ────────────────────────────
  gates: {
    minConfidence: 60,
    maxRisk: 70,
    minRR: 1.5,
    maxLateMomentum: 15, // تغير % أقصى للدخول
  },

  // ─── Timing ──────────────────────────────────────────
  timing: {
    preBreakout: { maxResistanceDistance: 3, minRR: 2.0 },
    breakout: { maxResistanceDistance: 0, minRR: 1.5 },
    earlyMomentum: { maxChange: 5, minRR: 1.2 },
    lateMomentum: { maxChange: 10, minRR: 0.8 },
    exhaustion: { maxChange: 15, minRR: 0.5 },
  },

  // ─── Early Accumulation ──────────────────────────────
  earlyAccumulation: {
    rvolTrend: [1.0, 1.3, 1.6, 2.1], // تدريجي
    minVolume: 50000,
    maxSpread: 0.5,
  },

  // ─── Price Compression ──────────────────────────────
  priceCompression: {
    maxATRPct: 3,
    minBollingerWidth: 0.5,
    vcpContraction: 12,
  },
};
