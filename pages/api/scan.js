// pages/api/scan.js — v14 Orchestrator (Predictive Scanner)
import { DataProvider } from '../../lib/radar/core/DataProvider.js';
import { FeatureStore } from '../../lib/radar/core/FeatureStore.js';
import { BrainManager } from '../../lib/radar/core/BrainManager.js';
import { DecisionContext } from '../../lib/radar/core/DecisionContext.js';
import { DecisionEngine } from '../../lib/radar/core/DecisionEngine.js';
import { DecisionAudit } from '../../lib/radar/core/DecisionAudit.js';
import { ExplainEngine } from '../../lib/radar/core/ExplainEngine.js';
import { OpportunityRanking } from '../../lib/radar/core/OpportunityRanking.js';
import { EventBus } from '../../lib/radar/core/EventBus.js';
import { HealthMonitor } from '../../lib/radar/core/HealthMonitor.js';
import { LearningCollector } from '../../lib/radar/core/LearningCollector.js';
import { getStrategyProfile } from '../../lib/radar/core/StrategyProfiles.js';
import { CONFIG } from '../../lib/radar/core/config.js';

// استيراد جميع الـ Brains (v14)
import { QualityControlBrain } from '../../lib/radar/brains/QualityControlBrain.js';
import { MarketBrain } from '../../lib/radar/brains/MarketBrain.js';
import { LiquidityBrain } from '../../lib/radar/brains/LiquidityBrain.js';
import { MomentumBrain } from '../../lib/radar/brains/MomentumBrain.js';
import { TrendBrain } from '../../lib/radar/brains/TrendBrain.js';
import { StructureBrain } from '../../lib/radar/brains/StructureBrain.js';
import { DNABrain } from '../../lib/radar/brains/DNABrain.js';
import { SectorBrain } from '../../lib/radar/brains/SectorBrain.js';
import { RelativeStrengthBrain } from '../../lib/radar/brains/RelativeStrengthBrain.js';
import { RiskBrain } from '../../lib/radar/brains/RiskBrain.js';
import { PortfolioBrain } from '../../lib/radar/brains/PortfolioBrain.js';
import { ContradictionBrain } from '../../lib/radar/brains/ContradictionBrain.js';
import { ConsensusBrain } from '../../lib/radar/brains/ConsensusBrain.js';
import { CatalystBrain } from '../../lib/radar/brains/CatalystBrain.js';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  const T0 = Date.now();
  const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // ─── 1. التهيئة ───
    const dataProvider = new DataProvider();
    const featureStore = new FeatureStore({ version: 3 });
    const eventBus = new EventBus();
    const healthMonitor = new HealthMonitor();
    const decisionAudit = new DecisionAudit();
    const learningCollector = new LearningCollector();
    const strategyProfile = getStrategyProfile(req.query.strategy || 'day');

    // ─── 2. إنشاء BrainManager وتسجيل الـ Brains ───
    const brainManager = new BrainManager();

    // تسجيل جميع الـ Brains (بما في ذلك CatalystBrain الجديد)
    brainManager
      .register(new QualityControlBrain())
      .register(new MarketBrain())
      .register(new LiquidityBrain())      // ✅ v14: Early Accumulation
      .register(new MomentumBrain())
      .register(new TrendBrain())
      .register(new StructureBrain())      // ✅ v14: Price Compression
      .register(new DNABrain())
      .register(new SectorBrain())
      .register(new RelativeStrengthBrain())
      .register(new RiskBrain())
      .register(new PortfolioBrain())
      .register(new ContradictionBrain())
      .register(new ConsensusBrain())
      .register(new CatalystBrain());      // ✅ جديد

    // ─── 3. جلب البيانات ───
    const marketData = await dataProvider.getMarketData();
    const universe = await dataProvider.getUniverse();
    const symbols = universe.slice(0, 80); // أول 80 سهم

    // ─── 4. تحليل كل سهم ───
    const results = [];

    for (const symbolData of symbols) {
      // جلب البيانات
      const bars = await dataProvider.getBars(symbolData.symbol, 50);
      const sectorData = await dataProvider.getSectorData(symbolData.symbol);
      const news = await dataProvider.getNews(symbolData.symbol);

      // استخراج الميزات
      const features = featureStore.getFeatures(
        symbolData.symbol,
        symbolData.price,
        bars,
        marketData,
        sectorData
      );

      // إنشاء السياق
      let context = new DecisionContext(symbolData.symbol, symbolData.price, {
        symbolData,
        bars,
        marketData,
        sectorData,
        features,
        news,
        executionContext: { scanId, strategy: strategyProfile.id },
      });

      // تشغيل جميع الـ Brains
      const brainResults = await brainManager.analyzeAll(context);
      context = context.setBrainResults(brainResults);

      // ─── 5. Decision Engine ───
      const decisionEngine = new DecisionEngine();
      const decision = decisionEngine.decide(context);
      context = context.setDecision(decision);

      // ─── 6. Explain Engine ───
      const explainEngine = new ExplainEngine({ language: 'ar', format: 'detailed' });
      const explanation = explainEngine.generateExplanation(context, decision);

      // ─── 7. Decision Audit ───
      const audit = decisionAudit.record({
        symbol: symbolData.symbol,
        scanId,
        decision,
        features,
        brainResults,
        context: context.toJSON(),
        version: '2.0.0',
      });

      // ─── 8. إصدار الأحداث ───
      eventBus.emit('brain.finished', { symbol: symbolData.symbol, scanId });
      eventBus.emit('decision.created', { symbol: symbolData.symbol, decision, audit });

      // ─── 9. تخزين النتيجة ───
      results.push({
        symbol: symbolData.symbol,
        price: symbolData.price,
        change_pct: symbolData.change_pct,
        volume: symbolData.volume,
        dollar_vol: symbolData.dollar_vol,
        decision: {
          score: decision.score,
          confidence: decision.confidence,
          grade: decision.grade,
          gradeLabel: decision.gradeLabel,
          timing: decision.timing || 'UNKNOWN',
          regime: decision.regime,
        },
        explanation: explanation,
        brains: Object.fromEntries(
          Object.entries(brainResults).map(([name, result]) => [
            name,
            {
              score: result?.score || 0,
              confidence: result?.confidence || 0,
              verdict: result?.verdict || 'neutral',
              timeHorizon: result?.timeHorizon || 'intraday',
            }
          ])
        ),
        features: {
          rsi: features.rsi14,
          rvol: features.relativeVolume,
          vwapDistance: features.vwapDistance,
          atr: features.atr14,
          gap: features.gapPercent,
        },
        auditId: audit.id,
      });
    }

    // ─── 10. Opportunity Ranking ───
    const ranking = new OpportunityRanking({
      maxResults: 10,
      minGrade: 'GOOD',
    });
    const ranked = ranking.rank(results, { features: featureStore });

    // ─── 11. Health Monitor ───
    const healthReport = healthMonitor.getHealthReport();

    // ─── 12. حفظ النتائج في Supabase ───
    const saved = await saveResults(ranked.top);

    // ─── 13. الرد ───
    return res.status(200).json({
      success: true,
      scanId,
      strategy: strategyProfile.id,
      total: results.length,
      ranked: ranked.top.length,
      results: ranked.top.slice(0, 10),
      market: {
        regime: marketData?.regime || 'neutral',
        spy: marketData?.spy?.price || 0,
        vix: marketData?.vix?.price || 0,
      },
      health: healthReport,
      saved: saved,
      elapsed_ms: Date.now() - T0,
    });
  } catch (error) {
    console.error('❌ Scan Orchestrator Error:', error.message);
    return res.status(200).json({
      success: false,
      error: error.message,
      scanId,
      elapsed_ms: Date.now() - T0,
    });
  }
}

// ─── دالة حفظ النتائج في Supabase ──────────────────────
async function saveResults(results) {
  if (!results || results.length === 0) {
    return { saved: 0, status: 200, message: 'لا توجد نتائج للحفظ' };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

  const payload = results.map(s => ({
    symbol: s.symbol,
    signal_date: new Date().toISOString().split('T')[0],
    entry_price: s.price,
    score: s.decision.score,
    ep: s.decision.confidence,
    volume: s.volume,
    change_pct: s.change_pct,
    type: s.decision.grade === 'ELITE' || s.decision.grade === 'PRIME' ? 'استثمار' : 'مضاربة',
    status: 'OPEN',
    rvol: s.features?.rvol || null,
    rsi: s.features?.rsi || null,
    atr14: s.features?.atr || null,
    is_hot: s.decision.grade === 'ELITE' || false,
    is_target: s.decision.grade === 'PRIME' || false,
    structure: {
      grade: s.decision.grade,
      confidence: s.decision.confidence,
      timing: s.decision.timing,
      regime: s.decision.regime,
      explanation: s.explanation,
    },
  }));

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?on_conflict=symbol,signal_date`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(payload),
      }
    );

    return {
      saved: res.ok ? payload.length : 0,
      status: res.status,
      message: res.ok ? 'تم الحفظ بنجاح' : 'فشل الحفظ',
    };
  } catch (error) {
    console.error('❌ Save Error:', error.message);
    return { saved: 0, status: 500, message: error.message };
  }
}
