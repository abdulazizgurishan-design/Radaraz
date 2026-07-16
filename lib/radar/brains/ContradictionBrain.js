// lib/radar/brains/ContradictionBrain.js
import { Brain } from '../core/Brain.js';

export class ContradictionBrain extends Brain {
  static dependencies = [];

  constructor(config = {}) {
    super('Contradiction Brain', {
      weight: 0.8,
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
      return this.formatResult(50, 50, 0, 'neutral', ['⚠️ بيانات غير كافية للكشف عن التناقضات'], [], { detected: false });
    }

    // استخراج التصويتات
    const verdicts = {};
    const scores = {};

    for (const [name, result] of Object.entries(results)) {
      if (result?.verdict) {
        verdicts[name] = result.verdict;
      }
      if (result?.score !== undefined) {
        scores[name] = result.score;
      }
    }

    // 1. تحليل التناقضات في التصويتات
    const bullish = Object.values(verdicts).filter(v => v === 'bullish').length;
    const bearish = Object.values(verdicts).filter(v => v === 'bearish').length;
    const neutral = Object.values(verdicts).filter(v => v === 'neutral').length;
    const total = Object.values(verdicts).length;

    let contradictionScore = 100;
    let confidence = 90;

    // 2. حساب نسبة التناقض
    const maxVote = Math.max(bullish, bearish, neutral);
    const consensusRatio = maxVote / total;

    if (consensusRatio < 0.5) {
      contradictionScore -= 30;
      confidence -= 25;
      warnings.push(`⚠️ تناقض حاد: ${bullish} صاعد, ${bearish} هابط, ${neutral} محايد`);
    } else if (consensusRatio < 0.7) {
      contradictionScore -= 15;
      confidence -= 10;
      warnings.push(`⚠️ تناقض متوسط: ${bullish} صاعد, ${bearish} هابط, ${neutral} محايد`);
    } else {
      reasons.push(`✅ إجماع قوي: ${(consensusRatio * 100).toFixed(0)}% من الـ Brains متفقة`);
    }

    // 3. تحليل التناقضات في الدرجات
    if (Object.keys(scores).length >= 2) {
      const scoreValues = Object.values(scores);
      const avgScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
      const maxScore = Math.max(...scoreValues);
      const minScore = Math.min(...scoreValues);
      const spread = maxScore - minScore;

      if (spread > 40) {
        contradictionScore -= 15;
        confidence -= 10;
        warnings.push(`⚠️ تباين كبير في الدرجات (${spread.toFixed(0)} نقطة)`);
      } else if (spread > 20) {
        contradictionScore -= 5;
        confidence -= 5;
        warnings.push(`⚠️ تباين متوسط في الدرجات (${spread.toFixed(0)} نقطة)`);
      }
    }

    // 4. حالات خاصة (تناقضات معروفة)
    const momentumScore = results['Momentum Brain']?.score || 0;
    const liquidityScore = results['Liquidity Brain']?.score || 0;

    if (momentumScore > 80 && liquidityScore < 30) {
      contradictionScore -= 20;
      confidence -= 15;
      warnings.push('⚠️ تناقض: زخم قوي جداً لكن سيولة ضعيفة');
    }

    const trendScore = results['Trend Brain']?.score || 0;
    const marketScore = results['Market Brain']?.score || 0;

    if (trendScore > 70 && marketScore < 40) {
      contradictionScore -= 15;
      confidence -= 10;
      warnings.push('⚠️ تناقض: السهم صاعد لكن السوق ضعيف');
    }

    // 5. النتيجة النهائية
    const finalScore = Math.min(Math.max(contradictionScore, 0), 100);
    const finalConfidence = Math.min(Math.max(confidence, 0), 100);

    const verdict = finalScore >= 70 ? 'bullish' : finalScore >= 50 ? 'neutral' : 'bearish';
    const impact = (finalScore - 50) / 10;

    metrics.consensusRatio = consensusRatio;
    metrics.bullishCount = bullish;
    metrics.bearishCount = bearish;
    metrics.neutralCount = neutral;
    metrics.totalBrains = total;
    metrics.contradictionDetected = finalScore < 70;

    if (finalScore >= 80) {
      reasons.push('✅ لا توجد تناقضات جوهرية في التحليل');
    }

    return this.formatResult(finalScore, finalConfidence, impact, verdict, reasons, warnings, metrics, 100 - finalConfidence);
  }
}
