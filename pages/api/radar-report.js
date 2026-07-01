// pages/api/radar-report.js
// ─────────────────────────────────────────────
//  تقرير الرادار المتكامل - مثل تقرير يدوي
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

    // 3️⃣ تصفية الإشارات القوية (EP ≥ 60)
    const displayedSymbols = log.signals
      .filter(s => (s.ep || 0) >= MIN_EP)
      .map(s => s.symbol);

    const strongSignals = allSignals.filter(s => (s.ep || s.score || 0) >= MIN_EP);
    const displayedStrong = strongSignals.filter(s => displayedSymbols.includes(s.symbol));

    // 4️⃣ تحليل الأداء
    const closed = displayedStrong.filter(s => s.status === "CLOSED");
    const open = displayedStrong.filter(s => s.status === "OPEN");
    const hit = closed.filter(s => s.target1_hit || s.target2_hit || s.target3_hit);
    const stopHit = closed.filter(s => s.stop_hit && !s.target1_hit);
    const totalClosed = closed.length;
    const winRate = totalClosed > 0 ? Math.round((hit.length / totalClosed) * 100) : 0;

    // 5️⃣ حساب الأرباح والخسائر
    const totalGain = hit.reduce((a, s) => a + (s.max_gain_pct || 0), 0);
    const totalLoss = stopHit.reduce((a, s) => a + Math.abs(s.close_gain_pct || 0), 0);
    const profitFactor = totalLoss > 0 ? (totalGain / totalLoss).toFixed(2) : "0.00";

    const avgGain = hit.length > 0 ? (hit.reduce((a, s) => a + (s.max_gain_pct || 0), 0) / hit.length).toFixed(2) : "0.00";
    const avgLoss = stopHit.length > 0 ? (stopHit.reduce((a, s) => a + Math.abs(s.close_gain_pct || 0), 0) / stopHit.length).toFixed(2) : "0.00";

    // 6️⃣ أفضل وأسوأ الصفقات
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

    const topLosers = [...stopHit]
      .sort((a, b) => (a.close_gain_pct || 0) - (b.close_gain_pct || 0))
      .slice(0, 5)
      .map(s => ({
        symbol: s.symbol,
        loss: (s.close_gain_pct || 0).toFixed(2),
        entry: s.entry_price,
        stopPrice: s.stop_loss,
        caughtAt: s.created_at,
        hitAt: s.updated_at,
      }));

    // 7️⃣ توزيع حسب النوع
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

    // 8️⃣ توزيع حسب الساعة
    const byHour = {};
    displayedStrong.forEach(s => {
      const hour = s.created_at ? new Date(s.created_at).getHours() : 0;
      byHour[hour] = (byHour[hour] || 0) + 1;
    });

    // 9️⃣ بناء التقرير الكامل
    const report = {
      date: dateStr,
      summary: {
        totalDisplayed: displayedStrong.length,
        totalSaved: strongSignals.length,
        closed: totalClosed,
        open: open.length,
        hit: hit.length,
        stopHit: stopHit.length,
        winRate,
        profitFactor: parseFloat(profitFactor),
        avgGain: parseFloat(avgGain),
        avgLoss: parseFloat(avgLoss),
        displayRate: strongSignals.length > 0 ? Math.round((displayedStrong.length / strongSignals.length) * 100) : 0,
      },
      topGainers,
      topLosers,
      byType,
      byHour,
      signals: displayedStrong.map(s => ({
        symbol: s.symbol,
        ep: s.ep || s.score,
        change: s.change_pct,
        price: s.entry_price,
        type: s.type,
        status: s.status,
        caughtAt: s.created_at,
        hitAt: s.target1_hit_at,
        maxGain: s.max_gain_pct,
        target1: s.target1,
        target2: s.target2,
        target3: s.target3,
        stop: s.stop_loss,
        is_hot: s.is_hot,
        is_target: s.is_target,
        early_watch: s.early_watch,
        structure: s.structure?.flag || null,
      })),
    };

    return res.status(200).json({ success: true, report });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
