// lib/radar/core/DecisionAudit.js
export class DecisionAudit {
  constructor() {
    this.audits = [];
    this.maxAudits = 10000;
  }

  // تسجيل قرار
  record(decision) {
    const audit = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...decision,
    };

    this.audits.push(audit);
    if (this.audits.length > this.maxAudits) {
      this.audits.shift();
    }

    return audit;
  }

  // استرجاع قرار
  getAudit(id) {
    return this.audits.find(a => a.id === id) || null;
  }

  // استرجاع قرارات سهم معين
  getAuditsBySymbol(symbol, limit = 10) {
    return this.audits
      .filter(a => a.symbol === symbol)
      .slice(-limit);
  }

  // استرجاع قرارات حسب التصنيف
  getAuditsByGrade(grade, limit = 50) {
    return this.audits
      .filter(a => a.grade === grade)
      .slice(-limit);
  }

  // إحصائيات القرارات
  getStats() {
    const total = this.audits.length;
    if (total === 0) return null;

    const grades = {};
    const scores = [];

    for (const audit of this.audits) {
      grades[audit.grade] = (grades[audit.grade] || 0) + 1;
      scores.push(audit.score);
    }

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      total,
      avgScore: Math.round(avgScore),
      grades,
      lastAudit: this.audits[this.audits.length - 1]?.timestamp || null,
    };
  }

  // تصدير للتحليل
  export(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.audits, null, 2);
    }
    return this.audits;
  }
}
