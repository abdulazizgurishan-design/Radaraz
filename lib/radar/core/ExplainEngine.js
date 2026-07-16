// lib/radar/core/ExplainEngine.js
export class ExplainEngine {
  constructor(config = {}) {
    this.config = {
      language: config.language || 'ar', // 'ar', 'en'
      format: config.format || 'detailed', // 'detailed', 'short'
      ...config,
    };
  }

  generateExplanation(context, decision) {
    if (!decision) {
      decision = context.getFinalDecision();
    }

    const results = context.getAllBrainResults();

    // جمع الأسباب من جميع الـ Brains
    const allReasons = [];
    const allWarnings = [];
    const allMetrics = {};

    for (const [name, result] of Object.entries(results)) {
      if (result?.reasons) {
        for (const reason of result.reasons) {
          allReasons.push(this.normalizeReason(reason, name));
        }
      }
      if (result?.warnings) {
        for (const warning of result.warnings) {
          allWarnings.push(this.normalizeReason(warning, name));
        }
      }
      if (result?.metrics) {
        allMetrics[name] = result.metrics;
      }
    }

    // ترتيب الإيجابيات (حسب التأثير)
    const positives = allReasons
      .filter(r => (r.impact || 0) > 0)
      .sort((a, b) => (b.impact || 0) - (a.impact || 0));

    const negatives = allReasons
      .filter(r => (r.impact || 0) < 0)
      .sort((a, b) => (a.impact || 0) - (b.impact || 0));

    // توليد التقرير
    const report = {
      grade: decision?.grade || 'UNKNOWN',
      gradeLabel: decision?.gradeLabel || 'غير معروف',
      score: decision?.score || 0,
      confidence: decision?.confidence || 0,
      regime: decision?.metrics?.regime || 'neutral',
      positives: positives.slice(0, 8),
      negatives: negatives.slice(0, 4),
      warnings: allWarnings.slice(0, 4),
      summary: this.generateSummary(positives, negatives, allWarnings, decision),
      details: this.generateDetails(results, allMetrics),
    };

    return this.formatReport(report);
  }

  normalizeReason(reason, brainName) {
    if (typeof reason === 'string') {
      return {
        id: `reason_${Date.now()}`,
        impact: reason.includes('+') || reason.includes('✅') || reason.includes('✔') ? 5 : -5,
        severity: reason.includes('⚠') || reason.includes('⚠️') ? 'high' : 'medium',
        title: reason.replace(/[+-]\d+\s*/, '').trim(),
        description: reason,
        source: brainName,
      };
    }
    return {
      ...reason,
      source: brainName,
    };
  }

  generateSummary(positives, negatives, warnings, decision) {
    const totalPositives = positives.length;
    const totalNegatives = negatives.length;
    const totalWarnings = warnings.length;

    let summary = `🔍 تحليل ${decision?.symbol || 'السهم'}\n`;

    if (totalPositives > totalNegatives) {
      summary += `✅ ${totalPositives} إيجابيات vs ${totalNegatives} سلبيات\n`;
    } else if (totalNegatives > totalPositives) {
      summary += `⚠️ ${totalNegatives} سلبيات vs ${totalPositives} إيجابيات\n`;
    } else {
      summary += `📊 ${totalPositives} إيجابيات و ${totalNegatives} سلبيات\n`;
    }

    if (totalWarnings > 0) {
      summary += `⚠️ ${totalWarnings} تحذيرات\n`;
    }

    summary += `🏷️ التصنيف: ${decision?.gradeLabel || decision?.grade || 'غير معروف'}`;

    return summary;
  }

  generateDetails(results, metrics) {
    const details = {};
    for (const [name, result] of Object.entries(results)) {
      if (result) {
        details[name] = {
          score: result.score,
          confidence: result.confidence,
          verdict: result.verdict,
          timeHorizon: result.timeHorizon,
          metrics: metrics[name] || {},
        };
      }
    }
    return details;
  }

  formatReport(report) {
    const format = this.config.format;

    if (format === 'short') {
      return {
        grade: report.grade,
        gradeLabel: report.gradeLabel,
        score: report.score,
        confidence: report.confidence,
        summary: report.summary,
        topPositives: report.positives.slice(0, 3).map(r => r.title),
        warnings: report.warnings.slice(0, 2).map(w => w.title),
      };
    }

    // Detailed format
    return {
      grade: report.grade,
      gradeLabel: report.gradeLabel,
      score: report.score,
      confidence: report.confidence,
      regime: report.regime,
      summary: report.summary,
      positives: report.positives.map(r => ({
        title: r.title,
        description: r.description,
        impact: r.impact,
        severity: r.severity,
        source: r.source,
      })),
      negatives: report.negatives.map(r => ({
        title: r.title,
        description: r.description,
        impact: r.impact,
        severity: r.severity,
        source: r.source,
      })),
      warnings: report.warnings.map(w => ({
        title: w.title,
        description: w.description,
        severity: w.severity,
        source: w.source,
      })),
      details: report.details,
    };
  }
}
