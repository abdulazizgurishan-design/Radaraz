// lib/radar/core/config.js
// ============================================================
// RadarAZ v20.1 - Configuration (محسّن للسرعة القصوى)
// ============================================================

export const SCAN_CONFIG = {
  // مدة الاحتفاظ الافتراضية (بالساعات)
  DEFAULT_HOLDING_PERIOD_HOURS: 4,

  // الحد الأدنى للسعر للتداول
  MIN_PRICE: 2,

  // الحد الأدنى للحجم
  MIN_VOLUME: 200000,

  // الحد الأدنى للسيولة
  MIN_DOLLAR_VOL: 1000000,

  // مضاعفات ATR للأهداف الثلاثة والوقف
  TARGET1_MULTIPLIER: 2,
  TARGET2_MULTIPLIER: 3.5,
  TARGET3_MULTIPLIER: 5,
  STOP_MULTIPLIER: 1.5,

  // إصدار النموذج
  MODEL_VERSION: "v20.1",

  // ✅ عدد الأسهم التي سيتم تحليلها (مخفض للسرعة القصوى)
  MAX_ANALYSIS_STOCKS: 50,

  // ============================================================
  // إعدادات الفريمات الذكية (SmartTimeframeEngine)
  // ============================================================
  TIMEFRAME_CONFIG: {
    rvolThresholds: {
      '1': 5,
      '5': 2.5,
      '15': 1.2,
      '60': 0.5,
      'day': 0,
    },
    volatilityThresholds: {
      '1': 3,
      '5': 1.5,
      '15': 0.5,
      '60': 0.2,
      'day': 0,
    },
    dollarVolThresholds: {
      '1': 5000000,
      '5': 2000000,
      '15': 1000000,
      '60': 500000,
      'day': 100000,
    },
    atrPercentThresholds: {
      '1': 2.0,
      '5': 1.0,
      '15': 0.5,
      '60': 0.2,
      'day': 0,
    },
  },

  // ============================================================
  // إعدادات المؤشرات حسب الفريم (IndicatorEngine)
  // ============================================================
  INDICATOR_SETTINGS: {
    '1': { rsiPeriod: 9, atrPeriod: 10, emaFast: 5, emaSlow: 13, macdFast: 6, macdSlow: 13, macdSignal: 5 },
    '5': { rsiPeriod: 12, atrPeriod: 14, emaFast: 9, emaSlow: 21, macdFast: 8, macdSlow: 17, macdSignal: 9 },
    '15': { rsiPeriod: 14, atrPeriod: 14, emaFast: 9, emaSlow: 21, macdFast: 12, macdSlow: 26, macdSignal: 9 },
    '60': { rsiPeriod: 14, atrPeriod: 14, emaFast: 12, emaSlow: 26, macdFast: 12, macdSlow: 26, macdSignal: 9 },
    'day': { rsiPeriod: 21, atrPeriod: 20, emaFast: 20, emaSlow: 50, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  },
};
