// pages/api/radar-report.js
// ─────────────────────────────────────────────
//  تقرير الرادار - الإشارات القوية فقط (EP ≥ 60)
// ─────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MIN_EP = 60; // نفس عتبة الرادار

export default async function handler(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
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
    
    // 3️⃣ الإشارات القوية فقط (EP ≥ 60)
    const strongSignals = allSignals.filter(s => (s.ep || s.score || 0) >= MIN_EP);
    const strongSymbols = strongSignals.map(s => s.symbol);
    
    // 4️⃣ الإشارات المعروضة في الرادار (EP ≥ 60)
    const displayedSymbols = log.signals
      .filter(s => (s.ep || 0) >= MIN_EP)
      .map(s => s.symbol);
    
    // 5️⃣ الإشارات القوية المعروضة
    const displayedStrong = strongSignals.filter(s => displayedSymbols.includes(s.symbol));
    const notDisplayed = strongSignals.filter(s => !displayedSymbols.includes(s.symbol));
    
    // 6️⃣ إحصائيات الإشارات القوية المعروضة فقط
    const closed = displayedStrong.filter(s => s.status === "CLOSED");
    const hit = closed.filter(s => s.target1_hit || s.target2_hit || s.target3_hit);
    const stopHit = closed.filter(s => s.stop_hit && !s.target1_hit);
    const totalClosed = closed.length;
    const winRate = totalClosed > 0 ? Math.round((hit.length / totalClosed) * 100) : 0;
    
    const totalGain = hit.reduce((a, s) => a + (s.max_gain_pct || 0), 0);
    const totalLoss = stopHit.reduce((a, s) => a + Math.abs(s.close_gain_pct || 0), 0);
    const profitFactor = totalLoss > 0 ? (totalGain / totalLoss).toFixed(2) : "0.00";
    
    // 7️⃣ أفضل الصفقات
    const topGainers = [...displayedStrong]
      .filter(s => s.max_gain_pct && s.max_gain_pct > 0)
      .sort((a, b) => (b.max_gain_pct || 0) - (a.max_gain_pct || 0))
      .slice(0, 10);
    
    // 8️⃣ التقرير النهائي
    const report = {
      date: today,
      summary: {
        totalStrong: strongSignals.length,
        displayed: displayedStrong.length,
        notDisplayed: notDisplayed.length,
        displayRate: strongSignals.length > 0 ? Math.round((displayedStrong.length / strongSignals.length) * 100) : 0,
        closed: totalClosed,
        hit: hit.length,
        stopHit: stopHit.length,
        winRate,
        profitFactor: parseFloat(profitFactor),
      },
      topGainers: topGainers.map(s => ({
        symbol: s.symbol,
        gain: (s.max_gain_pct || 0).toFixed(2),
        target: s.target3_hit ? "T3 🏆" : s.target2_hit ? "T2 🎯" : "T1 ✅",
        entryPrice: s.entry_price,
        targetPrice: s.target1,
        caughtAt: s.created_at,
        hitAt: s.target1_hit_at,
      })),
      displayedSymbols: displayedStrong.map(s => s.symbol),
    };
    
    return res.status(200).json({ success: true, report });
    
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
