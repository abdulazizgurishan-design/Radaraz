// lib/radar/core/HealthMonitor.js
export class HealthMonitor {
  constructor(config = {}) {
    this.config = {
      maxExecutionTime: config.maxExecutionTime || 5000, // 5 ثواني
      maxFailures: config.maxFailures || 5,
      checkInterval: config.checkInterval || 60, // ثانية
      ...config,
    };

    this.stats = {};
    this.alerts = [];
  }

  // تسجيل تنفيذ Brain
  recordExecution(brainName, executionTime, success) {
    if (!this.stats[brainName]) {
      this.stats[brainName] = {
        executions: 0,
        failures: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
        lastExecution: null,
        status: 'healthy',
      };
    }

    const stat = this.stats[brainName];
    stat.executions++;
    if (!success) stat.failures++;
    stat.totalTime += executionTime;
    stat.avgTime = stat.totalTime / stat.executions;
    stat.maxTime = Math.max(stat.maxTime, executionTime);
    stat.minTime = Math.min(stat.minTime, executionTime);
    stat.lastExecution = new Date().toISOString();

    // التحقق من الصحة
    this._checkHealth(brainName, stat);
  }

  // التحقق من صحة Brain
  _checkHealth(brainName, stat) {
    const warnings = [];

    // وقت التنفيذ
    if (stat.avgTime > this.config.maxExecutionTime) {
      warnings.push(`Avg execution time (${Math.round(stat.avgTime)}ms) exceeds limit`);
    }

    // نسبة الفشل
    if (stat.executions > 10 && (stat.failures / stat.executions) > 0.1) {
      warnings.push(`Failure rate (${Math.round(stat.failures / stat.executions * 100)}%) exceeds 10%`);
    }

    // عدد الفشل المتتالي
    if (stat.failures > this.config.maxFailures) {
      warnings.push(`More than ${this.config.maxFailures} consecutive failures`);
    }

    if (warnings.length > 0) {
      stat.status = 'warning';
      for (const warning of warnings) {
        this._addAlert(brainName, warning);
      }
    } else {
      stat.status = 'healthy';
    }
  }

  // إضافة تنبيه
  _addAlert(brainName, message) {
    this.alerts.push({
      brainName,
      message,
      timestamp: new Date().toISOString(),
      resolved: false,
    });

    // الحفاظ على حجم التنبيهات
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
  }

  // الحصول على إحصائيات
  getStats(brainName) {
    if (brainName) {
      return this.stats[brainName] || null;
    }
    return this.stats;
  }

  // الحصول على التنبيهات
  getAlerts(resolved = false) {
    return this.alerts.filter(a => a.resolved === resolved);
  }

  // حل تنبيه
  resolveAlert(index) {
    if (this.alerts[index]) {
      this.alerts[index].resolved = true;
    }
  }

  // تقرير الصحة
  getHealthReport() {
    const report = {
      totalBrains: Object.keys(this.stats).length,
      healthy: 0,
      warning: 0,
      unknown: 0,
      details: {},
    };

    for (const [name, stat] of Object.entries(this.stats)) {
      const status = stat.status || 'unknown';
      report[status] = (report[status] || 0) + 1;
      report.details[name] = {
        status,
        executions: stat.executions,
        failures: stat.failures,
        avgTime: Math.round(stat.avgTime),
        lastExecution: stat.lastExecution,
      };
    }

    return report;
  }

  // إعادة تعيين الإحصائيات
  reset() {
    this.stats = {};
    this.alerts = [];
  }
}
