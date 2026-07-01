// pages/api/radar-report.js
// ─────────────────────────────────────────────
//  تقرير الرادار اليومي - يثبت ظهور الإشارات
// ─────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 1️⃣ جلب جميع إشارات اليوم من Supabase
    const r = await fetch(`${SUPABASE_URL}/rest/v1/signals?signal_date=eq.${today}&select=*&order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const allSignals = await r.json();
    
    // 2️⃣ جلب سجل الرادار اليومي (إن وجد)
    const logRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_logs?date=eq.${today}&select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const logs = await logRes.json();
    const log = logs?.[0]?.log_data || { signals: [] };
    
    // 3️⃣ تحليل الإشارات
    const displayedSymbols = log.signals.map(s => s.symbol);
    const allSymbols = allSignals.map(s => s.symbol);
    
    // 4️⃣ تصنيف الإشارات
    const displayed = allSignals.filter(s => displayedSymbols.includes(s.symbol));
    const notDisplayed = allSignals.filter(s => !displayedSymbols.includes(s.symbol));
    
    // 5️⃣ أفضل الصفقات (أعلى ربح)
    const topGainers = [...displayed]
      .filter(s => s.max_gain_pct && s.max_gain_pct > 0)
      .sort((a, b) => (b.max_gain_pct || 0) - (a.max_gain_pct || 0))
      .slice(0, 10);
    
    // 6️⃣ إحصائيات الأداء
    const closed = displayed.filter(s => s.status === "CLOSED");
    const hit = closed.filter(s => s.target1_hit || s.target2_hit || s.target3_hit);
    const stopHit = closed.filter(s => s.stop_hit && !s.target1_hit);
    const totalClosed = closed.length;
    const winRate = totalClosed > 0 ? Math.round((hit.length / totalClosed) * 100) : 0;
    
    const totalGain = hit.reduce((a, s) => a + (s.max_gain_pct || 0), 0);
    const totalLoss = stopHit.reduce((a, s) => a + Math.abs(s.close_gain_pct || 0), 0);
    const profitFactor = totalLoss > 0 ? (totalGain / totalLoss).toFixed(2) : "0.00";
    
    // 7️⃣ بناء التقرير
    const report = {
      date: today,
      summary: {
        totalSignals: allSignals.length,
        displayedInRadar: displayed.length,
        notDisplayed: notDisplayed.length,
        displayRate: allSignals.length > 0 ? Math.round((displayed.length / allSignals.length) * 100) : 0,
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
      displayedSignals: displayed.map(s => ({
        symbol: s.symbol,
        ep: s.ep || s.score,
        change: s.change_pct,
        price: s.entry_price,
        type: s.type,
        status: s.status,
        caughtAt: s.created_at,
        hitAt: s.target1_hit_at,
        maxGain: s.max_gain_pct,
      })),
      notDisplayedSignals: notDisplayed.map(s => ({
        symbol: s.symbol,
        ep: s.ep || s.score,
        change: s.change_pct,
        reason: s.ep < 60 ? "EP أقل من 60" : "لم يستوفِ شروط الفلترة",
      })),
      byHour: log.signals.reduce((acc, s) => {
        const hour = s.created_at ? new Date(s.created_at).getHours() : 0;
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {}),
    };
    
    return res.status(200).json({ success: true, report });
    
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
