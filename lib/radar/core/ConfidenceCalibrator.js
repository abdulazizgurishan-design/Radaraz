// lib/radar/core/ConfidenceCalibrator.js
export class ConfidenceCalibrator {
  constructor(config = {}) {
    this.config = {
      minSamples: config.minSamples || 50,
      calibrationWindow: config.calibrationWindow || 500,
      ...config,
    };

    this.calibrationData = {};
  }

  // تسجيل نتيجة صفقة
  record(brainName, confidence, outcome) {
    if (!this.calibrationData[brainName]) {
      this.calibrationData[brainName] = [];
    }

    this.calibrationData[brainName].push({
      confidence,
      outcome, // true = win, false = loss
      timestamp: new Date().toISOString(),
    });

    // الحفاظ على حجم النافذة
    const window = this.config.calibrationWindow;
    if (this.calibrationData[brainName].length > window) {
      this.calibrationData[brainName] = this.calibrationData[brainName].slice(-window);
    }
  }

  // تصحيح الثقة
  calibrate(brainName, rawConfidence) {
    const data = this.calibrationData[brainName];
    if (!data || data.length < this.config.minSamples) {
      // لا توجد بيانات كافية، نرجع الثقة كما هي
      return rawConfidence;
    }

    // حساب المنحنى
    const confidenceRanges = [
      { min: 0, max: 20 },
      { min: 20, max: 40 },
      { min: 40, max: 60 },
      { min: 60, max: 80 },
      { min: 80, max: 100 },
    ];

    let range = confidenceRanges.find(r => rawConfidence >= r.min && rawConfidence < r.max);
    if (!range) range = confidenceRanges[confidenceRanges.length - 1];

    // حساب النجاح الفعلي في هذا النطاق
    const filtered = data.filter(d => d.confidence >= range.min && d.confidence < range.max);
    if (filtered.length < 5) {
      // لا توجد بيانات كافية في هذا النطاق
      return rawConfidence;
    }

    const winRate = filtered.filter(d => d.outcome).length / filtered.length;

    // تصحيح الثقة: إذا كان winRate أقل من النطاق، ننزل الثقة
    const expectedWinRate = (range.min + range.max) / 2 / 100;
    let calibrated = rawConfidence;

    if (winRate < expectedWinRate * 0.8) {
      // أقل من المتوقع بكثير
      calibrated = rawConfidence * 0.85;
    } else if (winRate < expectedWinRate * 0.95) {
      // أقل قليلاً من المتوقع
      calibrated = rawConfidence * 0.95;
    } else if (winRate > expectedWinRate * 1.1) {
      // أفضل من المتوقع
      calibrated = Math.min(rawConfidence * 1.05, 100);
    }

    return Math.min(Math.max(calibrated, 0), 100);
  }

  // الحصول على إحصائيات التصحيح
  getStats(brainName) {
    const data = this.calibrationData[brainName];
    if (!data) return null;

    const total = data.length;
    const wins = data.filter(d => d.outcome).length;

    return {
      brainName,
      totalSamples: total,
      winRate: total > 0 ? (wins / total) * 100 : 0,
      calibratedSamples: total,
    };
  }

  // تصدير بيانات التصحيح
  exportCalibration() {
    const result = {};
    for (const [brainName, data] of Object.entries(this.calibrationData)) {
      result[brainName] = {
        samples: data.length,
        winRate: data.filter(d => d.outcome).length / data.length * 100,
      };
    }
    return result;
  }
}
