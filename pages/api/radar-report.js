// pages/api/radar-report.js
// ─────────────────────────────────────────────
//  تقرير الرادار المتكامل - يقرأ كل الإشارات
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

    // 1️⃣ جلب جميع إشارات اليوم (المفتوحة والمقفلة)
    const r = await fetch(`${SUPABASE_URL}/rest/v1/signals?signal_date=eq.${today}&select=*&order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const allSignals = await r.json();

    // 2️⃣ جلب سجل الرادار اليومي (المعروضة في الرادار)
    const logRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_logs?date=eq.${today}&select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const logs = await logRes.json();
    const log = logs?.[0]?.log_data || { signals: [] };

    // 3️⃣ الإشارات المعروضة في الرادار (من daily_logs)
    const displayedSymbols = log.signals
      .filter(s => (s.ep || 0) >= MIN_EP)
      .map(s => s.symbol);

    // 4️⃣ الإشارات القوية (EP ≥ 60) المعروضة
    const displayedSignals = allSignals.filter(s =>
      displayedSymbols.includes(s.symbol) && (s.ep || s.score || 0) >= MIN_EP
    );

    // 5️⃣ تحليل الإشارات المعروضة فقط
    const closed = displayedSignals.filter(s => s.status === "CLOSED");
    const open = displayedSignals.filter(s => s.status === "OPEN");
    const hit = closed.filter(s => s.target1_hit || s.target2_hit || s.target3_hit);
    const stopHit = closed.filter(s => s.stop_hit && !s.target1_hit);
    const totalClosed = closed.length;
    const winRate = totalClosed > 0 ? Math.round((hit.length / totalClosed) * 100) : 0;

    const totalGain = hit.reduce((a, s) => a + (s.max_gain_pct || 0), 0);
    const totalLoss = stopHit.reduce((a, s) => a + Math.abs(s.close_gain_pct || 0), 0);
    const profitFactor = totalLoss > 0 ? (totalGain / totalLoss).toFixed(2) : "0.00";

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

    // 7️⃣ التقرير النهائي المتكامل
    const report = {
      date: dateStr,
      summary: {
        totalSignals: allSignals.length,
        displayedInRadar: displayedSignals.length,
        open: open.length,
        closed: totalClosed,
        hit: hit.length,
        stopHit: stopHit.length,
        winRate: winRate,
        profitFactor: parseFloat(profitFactor),
        displayRate: allSignals.length > 0 ? Math.round((displayedSignals.length / allSignals.length) * 100) : 0,
      },
      topGainers: topGainers,
      displayedSymbols: displayedSignals.map(s => s.symbol),
    };

    return res.status(200).json({ success: true, report });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
