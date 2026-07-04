// pages/api/summary.js — v2 (نافذة 30 يوماً + تفريد صحيح بالرمز واليوم)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  try {
    // ?days=1 لتبويب الإشارات (اليوم فقط) · ?days=30 للنتائج والتقارير
    const days = Math.min(Math.max(parseInt(req.query.days) || 1, 1), 60);
    const fromDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?select=*&signal_date=gte.${fromDate}&order=created_at.desc&limit=1000`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );

    const data = await r.json();
    const all = Array.isArray(data) ? data : [];

    // تفريد بمفتاح (سهم + يوم) — صفقات الأيام المختلفة تبقى مستقلة
    const seen = new Set();
    const signals = all.filter(s => {
      const k = `${s.symbol}|${s.signal_date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    let t1 = 0, t2 = 0, t3 = 0, stops = 0;
    for (const s of signals) {
      if (s.target3_hit) t3++;
      else if (s.target2_hit) t2++;
      else if (s.target1_hit) t1++;
      if (s.stop_hit) stops++;
    }

    const sorted = signals.sort((a, b) => {
      if (b.is_hot !== a.is_hot) return b.is_hot ? 1 : -1;
      return (b.ep || b.score || 0) - (a.ep || a.score || 0);
    });

    return res.status(200).json({ total: sorted.length, t1, t2, t3, stops, signals: sorted });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
