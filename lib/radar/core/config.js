// lib/radar/core/config.js — الإعدادات العامة ودوال التصنيف
// ═══════════════════════════════════════════════════════════════════

// ─── إعدادات الأوزان والعتبات ──────────────────────────────────
export const CONFIG = {
  // الأوزان الجديدة (v14+)
  weights: {
    market: 1.2,
    liquidity: 1.3,
    momentum: 0.8,
    trend: 1.0,
    structure: 1.4,
    dna: 1.0,
    sector: 1.1,
    relativeStrength: 1.2,
    risk: 1.3,
    catalyst: 0.9,
  },

  // عتبات التصنيف
  thresholds: {
    ELITE: 85,
    PRIME: 75,
    STRONG: 65,
    GOOD: 55,
    WATCHING: 45,
    AVOID: 0,
  },

  // شروط القطع (Gating)
  gates: {
    minConfidence: 60,
    maxRisk: 70,
    minRR: 1.5,
    maxLateMomentum: 15,
  },

  // إعدادات التوقيت
  timing: {
    preBreakout: { maxResistanceDistance: 3, minRR: 2.0 },
    breakout: { maxResistanceDistance: 0, minRR: 1.5 },
    earlyMomentum: { maxChange: 5, minRR: 1.2 },
    lateMomentum: { maxChange: 10, minRR: 0.8 },
    exhaustion: { maxChange: 15, minRR: 0.5 },
  },

  // Early Accumulation
  earlyAccumulation: {
    rvolTrend: [1.0, 1.3, 1.6, 2.1],
    minVolume: 50000,
    maxSpread: 0.5,
  },

  // Price Compression
  priceCompression: {
    maxATRPct: 3,
    minBollingerWidth: 0.5,
    vcpContraction: 12,
  },
};

// ─── تصنيفات الواجهة (Grade) ──────────────────────────────────
export const GRADE_CONFIG = {
  ELITE: {
    label: '🏆 نخبة',
    color: '#00d4aa',
    bg: 'rgba(0,212,170,0.15)',
    border: 'rgba(0,212,170,0.3)',
    description: 'فرصة استثنائية',
  },
  PRIME: {
    label: '⭐ ممتاز',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.15)',
    border: 'rgba(52,211,153,0.3)',
    description: 'فرصة ممتازة',
  },
  STRONG: {
    label: '💪 قوي',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.15)',
    border: 'rgba(96,165,250,0.3)',
    description: 'فرصة قوية',
  },
  GOOD: {
    label: '📊 جيد',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.15)',
    border: 'rgba(251,191,36,0.3)',
    description: 'فرصة جيدة',
  },
  WATCH: {
    label: '👀 مراقبة',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.15)',
    border: 'rgba(148,163,184,0.3)',
    description: 'يحتاج متابعة',
  },
  AVOID: {
    label: '❌ تجنب',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.15)',
    border: 'rgba(239,68,68,0.3)',
    description: 'لا تدخل',
  },
};

// ─── دوال مساعدة للتصنيف ──────────────────────────────────────
export function getGradeConfig(grade) {
  return GRADE_CONFIG[grade] || GRADE_CONFIG.WATCH;
}

export function getGradeLabel(grade) {
  const config = getGradeConfig(grade);
  return config.label;
}

export function getGradeColor(grade) {
  const config = getGradeConfig(grade);
  return config.color;
}

// ─── توقيت الإشارة (Timing) ────────────────────────────────────
export const TIMING_CONFIG = {
  PRE_BREAKOUT: {
    label: 'قبل الاختراق',
    icon: '⚡',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.15)',
    border: 'rgba(52,211,153,0.3)',
    description: 'أفضل توقيت للدخول',
    priority: 1,
  },
  BREAKOUT: {
    label: 'اختراق',
    icon: '🚀',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.15)',
    border: 'rgba(96,165,250,0.3)',
    description: 'توقيت جيد للدخول',
    priority: 2,
  },
  EARLY_MOMENTUM: {
    label: 'زخم مبكر',
    icon: '📈',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.15)',
    border: 'rgba(251,191,36,0.3)',
    description: 'بداية زخم',
    priority: 3,
  },
  WAIT: {
    label: 'مراقبة',
    icon: '⏳',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.15)',
    border: 'rgba(148,163,184,0.3)',
    description: 'ينتظر تأكيد',
    priority: 4,
  },
  LATE: {
    label: 'متأخر',
    icon: '⚠️',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.15)',
    border: 'rgba(239,68,68,0.3)',
    description: 'تجنب الدخول',
    priority: 5,
  },
  UNKNOWN: {
    label: 'غير معروف',
    icon: '❓',
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.15)',
    border: 'rgba(107,114,128,0.3)',
    description: 'لم يتم تحديد التوقيت',
    priority: 99,
  },
};

// ─── دوال مساعدة للتوقيت ──────────────────────────────────────
export function getTimingConfig(timing) {
  return TIMING_CONFIG[timing] || TIMING_CONFIG.UNKNOWN;
}

export function getTimingLabel(timing) {
  const config = getTimingConfig(timing);
  return config.label;
}

export function getTimingPriority(timing) {
  const config = getTimingConfig(timing);
  return config.priority;
}

// ─── إعدادات المخاطرة ──────────────────────────────────────────
export const RISK_CONFIG = {
  low: { label: '🟢 منخفضة', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  medium: { label: '🟡 متوسطة', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  high: { label: '🔴 مرتفعة', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

export function getRiskConfig(score) {
  if (score >= 70) return RISK_CONFIG.low;
  if (score >= 50) return RISK_CONFIG.medium;
  return RISK_CONFIG.high;
}

// ─── إعدادات حالة السوق ───────────────────────────────────────
export const REGIME_CONFIG = {
  strong: { label: '📈 سوق قوي', color: '#34d399', icon: '📈' },
  bull: { label: '📈 سوق صاعد', color: '#60a5fa', icon: '📈' },
  neutral: { label: '📊 سوق محايد', color: '#fbbf24', icon: '📊' },
  weak: { label: '📉 سوق ضعيف', color: '#f87171', icon: '📉' },
  bear: { label: '📉 سوق هابط', color: '#ef4444', icon: '📉' },
  risk_off: { label: '🔴 Risk-Off', color: '#ef4444', icon: '🔴' },
};

export function getRegimeConfig(regime) {
  return REGIME_CONFIG[regime] || REGIME_CONFIG.neutral;
}// ===============================
// v20 Feature Builder Config
// ===============================
export const SCAN_CONFIG = {
  DEFAULT_HOLDING_PERIOD_HOURS: 4,
  MIN_PRICE: 1,
  MIN_VOLUME: 100000,
  TARGET1_MULTIPLIER: 2,
  TARGET2_MULTIPLIER: 3.5,
  TARGET3_MULTIPLIER: 5,
  STOP_MULTIPLIER: 1.5,
  MODEL_VERSION: "v20",
};
