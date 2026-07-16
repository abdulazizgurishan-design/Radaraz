// lib/radar/brains/ConsensusBrain.js 
import { Brain } from '../core/Brain.js';

export class ConsensusBrain extends Brain {
  static dependencies = [];

  constructor(config = {}) {
    super('Consensus Brain', {
      weight: 1.0,
      enabled: true,
      timeHorizon: 'intraday',
      ...config,
    });
  }

  async analyze(context) {
    const reasons = [];
    const warnings = [];
    const metrics = {};

    const results = context.getAllBrainResults();
    const brainNames = Object.keys(results);

    if (brainNames.length < 2) {
      return this.formatResult(50, 50, 0, 'neutral', ['⚠️ بيانات غير كافية للإجماع'], [], { consensus: 0 });
    }

    // 1. جمع التصويتات
    const verdicts = [];
    const scores = [];

    for (const [name, result] of Object.entries(results)) {
      if (result?.verdict) verdicts.push(result.verdict);
      if (result?.score !== undefined) scores.push(result.score);
    }

    // 2. حساب الإجماع
    const bullish = verdicts.filter(v => v === 'bullish').length;
    const bearish = verdicts.filter(v => v === 'bearish').length;
    const neutral = verdicts.filter(v => v === 'neutral').length;
    const totalVerdicts = verdicts.length;

    const maxVote = Math.max(bullish, bearish, neutral);
    const consensusPercent = totalVerdicts > 0 ? (maxVote / totalVerdicts) * 100 : 0;

    // 3. حساب متوسط الدرجات (مرجح بثقة كل Brain)
    let weightedScore = 0;
    let totalWeight = 0;

    for (const [name, result] of Object.entries(results)) {
      if (result?.score !== undefined && result?.confidence !== undefined) {
        const weight = result.confidence / 100;
        weightedScore += result.score * weight;
        totalWeight += weight;
      }
    }

    const avgScore = totalWeight > 0 ? weightedScore / totalWeight : 50;

    // 4. حساب الثقة الكلية
    let confidence = 70;

    if (consensusPercent >= 80) {
      confidence += 20;
      reasons.push(`✅ إجماع قوي (${consensusPercent.toFixed(0)}%)`);
    } else if (consensusPercent >= 60) {
      confidence += 10;
      reasons.push(`✅ إجماع متوسط (${consensusPercent.toFixed(0)}%)`);
    } else {
      confidence -= 15;
      warnings.push(`⚠️ إجماع ضعيف (${consensusPercent.toFixed(0)}%)`);
    }

    if (avgScore >= 70) {
      confidence += 10;
      reasons.push(`✅ متوسط الدرجات مرتفع (${avgScore.toFixed(0)})`);
    } else if (avgScore < 50) {
      confidence -= 10;
      warnings.push(`⚠️ متوسط الدرجات منخفض (${avgScore.toFixed(0)})`);
    }

    if (totalVerdicts >= 5) {
      confidence += 5;
      reasons.push(`✅ مشاركة ${totalVerdicts} Brains في القرار`);
    }

    const verdictDirection = bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral';
    const scoreDirection = avgScore >= 60 ? 'bullish' : avgScore <= 40 ? 'bearish' : 'neutral';

    if (verdictDirection !== scoreDirection) {
      confidence -= 10;
      warnings.push(`⚠️ عدم توافق: التصويت ${verdictDirection} لكن الدرجات ${scoreDirection}`);
    }

    confidence = Math.min(Math.max(confidence, 0), 100);

    // 5. النتيجة النهائية
    const consensusScore = (consensusPercent * 0.6 + (avgScore / 100) * 100 * 0.4);
    const finalScore = Math.min(Math.max(consensusScore, 0), 100);

    const verdict = consensusPercent >= 70 ? 'bullish' : consensusPercent >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.consensusPercent = Math.round(consensusPercent);
    metrics.bullish = bullish;
    metrics.bearish = bearish;
    metrics.neutral = neutral;
    metrics.totalBrains = totalVerdicts;
    metrics.avgScore = Math.round(avgScore);
    metrics.verdictDirection = verdictDirection;
    metrics.scoreDirection = scoreDirection;

    return this.formatResult(finalScore, confidence, impact, verdict, reasons, warnings, metrics, 100 - confidence);
  }
}
