// lib/radar/core/Brain.js
export class Brain {
  // كل Brain يعلن Dependencies الخاصة به
  static dependencies = [];

  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    this.weight = config.weight || 1.0;
    this.historicalAccuracy = null;
    this.executionTime = 0;
    this.lastResult = null;
    this.timeHorizon = config.timeHorizon || 'intraday'; // intraday, 1H, 4H, swing, position
  }

  async analyze(context) {
    throw new Error(`analyze() must be implemented in ${this.name}`);
  }

  // النتيجة الموسعة (Score + Confidence + Impact + Verdict + Uncertainty)
  formatResult(score, confidence, impact, verdict, reasons = [], warnings = [], metrics = {}, uncertainty = 0) {
    return {
      score: Math.min(Math.max(score, 0), 100),
      confidence: Math.min(Math.max(confidence, 0), 100),
      impact: impact || 0,
      verdict: verdict || 'neutral', // 'bullish', 'bearish', 'neutral'
      timeHorizon: this.timeHorizon,
      reasons: Array.isArray(reasons) ? reasons : [reasons],
      warnings: Array.isArray(warnings) ? warnings : [warnings],
      metrics: metrics,
      uncertainty: Math.min(Math.max(uncertainty, 0), 100),
      timestamp: new Date().toISOString(),
    };
  }

  // Reasons هيكلية (Structured)
  createReason(id, impact, severity, title, description) {
    return {
      id,
      impact: impact || 0,
      severity: severity || 'medium', // 'high', 'medium', 'low'
      title,
      description,
    };
  }

  getResult() { return this.lastResult; }
  getScore() { return this.lastResult?.score || 0; }
  getConfidence() { return this.lastResult?.confidence || 0; }
  getVerdict() { return this.lastResult?.verdict || 'neutral'; }
  getImpact() { return this.lastResult?.impact || 0; }
  getUncertainty() { return this.lastResult?.uncertainty || 0; }
  getTimeHorizon() { return this.timeHorizon; }
  getReasons() { return this.lastResult?.reasons || []; }
  getWarnings() { return this.lastResult?.warnings || []; }
  getMetrics() { return this.lastResult?.metrics || {}; }

  getDetails() {
    return {
      name: this.name,
      enabled: this.enabled,
      weight: this.weight,
      accuracy: this.historicalAccuracy,
      executionTime: this.executionTime,
      timeHorizon: this.timeHorizon,
      ...this.lastResult,
    };
  }

  setAccuracy(accuracy) { this.historicalAccuracy = accuracy; }
  setWeight(weight) { this.weight = weight; }
  enable() { this.enabled = true; }
  disable() { this.enabled = false; }
}
