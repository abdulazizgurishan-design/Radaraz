// pages/api/radar-report.js
// ─────────────────────────────────────────────
//  تقرير الرادار المتكامل - الإشارات المعروضة فقط
//  مع تشخيص الخسائر
// ─────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MIN_EP = 60;

export default async function handler(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const saudiNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    const dateStr = saudiNow.toLocaleDateString("ar-SA", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // 1️⃣ جلب جميع إشارات اليوم
    const r = await fetch(`${SUPABASE_URL}/rest/v1/signals?signal_date=eq.${today}&select=*&order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const allSignals = await r.json();

    // 2️⃣ جلب سجل الرادار اليومي
    const logRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_logs?date=eq.${today}&select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const logs = await logRes.json();
    const log = logs?.[0]?.log_data || { signals: [] };

    // 3️⃣ الإشارات المعروضة في الرادار (EP ≥ 60)
    const displayedSymbols = log.signals
      .filter(s => (s.ep || 0) >= MIN_EP)
      .map(s => s.symbol);

    // 4️⃣ الإشارات القوية المعروضة
    const displayedSignals = allSignals.filter(s =>
      displayedSymbols.includes(s.symbol) && (s.ep || s.score || 0) >= MIN_EP
    );

    // 5️⃣ تحليل الإشارات المعروضة
    const closed = displayedSignals.filter(s => s.status === "CLOSED");
    const hit = closed.filter(s => s.target1_hit || s.target2_hit || s.target3_hit);
    const stopHit = closed.filter(s => s.stop_hit && !s.target1_hit);
    const totalClosed = closed.length;
    const winRate = totalClosed > 0 ? Math.round((hit.length / totalClosed) * 100) : 0;

    const totalGain = hit.reduce((a, s) => a + (s.max_gain_pct || 0), 0);
    const totalLoss = stopHit.reduce((a, s) => a + Math.abs(s.close_gain_pct || 0), 0);
    const profitFactor = totalLoss > 0 ? (totalGain / totalLoss).toFixed(2) : "0.00";

    const avgGain = hit.length > 0 ? (hit.reduce((a, s) => a + (s.max_gain_pct || 0), 0) / hit.length).toFixed(2) : "0.00";
    const avgLoss = stopHit.length > 0 ? (stopHit.reduce((a, s) => a + Math.abs(s.close_gain_pct || 0), 0) / stopHit.length).toFixed(2) : "0.00";

    // 6️⃣ أفضل الصفقات
    const topGainers = [...hit]
      .sort((a, b) => (b.max_gain_pct || 0) - (a.max_gain_pct || 0))
      .slice(0, 6)
      .map(s => ({
        symbol: s.symbol,
        gain: (s.max_gain_pct || 0).toFixed(2),
        target: s.target3_hit ? "T3 🏆" : s.target2_hit ? "T2 🎯" : "T1 ✅",
        entry: s.entry_price,
        targetPrice: s.target1,
        caughtAt: s.created_at,
        hitAt: s.target1_hit_at,
      }));

    // 7️⃣ تحليل الخاسرين (تشخيص الأسباب)
    const losersAnalysis = stopHit.map(s => {
      const lossPct = Math.abs(s.close_gain_pct || 0);
      const stopPct = s.entry_price ? ((s.entry_price - s.stop_loss) / s.entry_price) * 100 : 0;
      const rsiAtEntry = s.rsi || 0;
      const volume = s.volume || 0;
      const type = s.type || "مضاربة";
      const structureFlag = s.structure?.flag || "غير محدد";

      let reasons = [];
      let severity = "🟡";

      if (stopPct < 4) {
        reasons.push("⛔ وقف قريب جداً (أقل من 4%)");
        severity = "🔴";
      }
      if (rsiAtEntry >= 72) {
        reasons.push("📊 RSI مرتفع (إشباع شرائي)");
        severity = "🔴";
      }
      if (volume < 100_000) {
        reasons.push("📉 سيولة ضعيفة (حجم منخفض)");
        severity = "🟡";
      }
      if (structureFlag.includes("ملاحقة") || structureFlag.includes("غير مؤكد")) {
        reasons.push("⏰ دخول متأخر (بنية غير صحيحة)");
        severity = "🔴";
      }
      if (s.news_age_h == null || s.news_age_h > 48) {
        reasons.push("📰 بلا أخبار (خبر قديم أو معدوم)");
        severity = "🟡";
      }
      if (Math.abs(s.change_pct || 0) > 30) {
        reasons.push("📈 تغيير حاد (> 30%)");
        severity = "🔴";
      }
      if (s.vcp && s.vcp_contraction < 20) {
        reasons.push("📉 VCP ضعيف (انكماش قليل)");
        severity = "🟡";
      }
      if (s.is_hot && lossPct > 5) {
        reasons.push("🔥 زخم وهمي (HOT ضعيف)");
        severity = "🔴";
      }

      if (reasons.length === 0) {
        reasons.push("❓ سبب غير محدد - يحتاج تحليل يدوي");
      }

      return {
        symbol: s.symbol,
        loss: lossPct.toFixed(2),
        entry: s.entry_price,
        stop: s.stop_loss,
        stopPct: stopPct.toFixed(2),
        rsi: rsiAtEntry,
        volume: volume,
        type: type,
        structure: structureFlag,
        reasons: reasons,
        severity: severity,
        caughtAt: s.created_at,
        hitAt: s.updated_at,
      };
    });

    // 8️⃣ إحصائيات الخسائر
    const lossStats = {
      total: losersAnalysis.length,
      byReason: {},
      byType: {},
      avgLoss: losersAnalysis.length > 0
        ? (losersAnalysis.reduce((a, s) => a + parseFloat(s.loss), 0) / losersAnalysis.length).toFixed(2)
        : 0,
      closeStopAvg: losersAnalysis.length > 0
        ? (losersAnalysis.reduce((a, s) => a + parseFloat(s.stopPct), 0) / losersAnalysis.length).toFixed(2)
        : 0,
      severe: losersAnalysis.filter(s => s.severity === "🔴").length,
      warning: losersAnalysis.filter(s => s.severity === "🟡").length,
    };

    for (const loser of losersAnalysis) {
      for (const reason of loser.reasons) {
        if (!lossStats.byReason[reason]) lossStats.byReason[reason] = 0;
        lossStats.byReason[reason]++;
      }
      if (!lossStats.byType[loser.type]) lossStats.byType[loser.type] = 0;
      lossStats.byType[loser.type]++;
    }

    // 9️⃣ توزيع حسب النوع
    const byType = {};
    for (const s of closed) {
      const type = s.type || "مضاربة";
      if (!byType[type]) byType[type] = { total: 0, win: 0 };
      byType[type].total++;
      if (s.target1_hit || s.target2_hit || s.target3_hit) byType[type].win++;
    }
    for (const type in byType) {
      byType[type].rate = byType[type].total > 0 ? Math.round((byType[type].win / byType[type].total) * 100) : 0;
    }

    // 🔟 التقرير النهائي
    const report = {
      date: dateStr,
      summary: {
        totalSignals: allSignals.length,
        displayedInRadar: displayedSignals.length,
        closed: totalClosed,
        hit: hit.length,
        stopHit: stopHit.length,
        winRate: winRate,
        profitFactor: parseFloat(profitFactor),
        avgGain: parseFloat(avgGain),
        avgLoss: parseFloat(avgLoss),
        displayRate: allSignals.length > 0 ? Math.round((displayedSignals.length / allSignals.length) * 100) : 0,
      },
      topGainers: topGainers,
      topLosers: losersAnalysis.slice(0, 10),
      lossStats: lossStats,
      byType: byType,
      displayedSymbols: displayedSignals.map(s => s.symbol),
    };

    return res.status(200).json({ success: true, report });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
