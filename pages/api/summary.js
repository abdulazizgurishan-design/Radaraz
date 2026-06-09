// pages/api/summary.js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  try {
    // فلتر إشارات اليوم فقط (بتوقيت ET)
    const now = new Date();
    const et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const todayET = et.toISOString().slice(0, 10); // YYYY-MM-DD

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?select=*&created_at=gte.${todayET}T00:00:00&order=created_at.desc&limit=200`,
      {
        headers: {
          apikey:        SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const data = await r.json();
    const all  = Array.isArray(data) ? data : [];

    // حذف المكررات — يبقى آخر إشارة لكل سهم
    const seen    = new Set();
    const signals = all.filter(s => {
      if (seen.has(s.symbol)) return false;
      seen.add(s.symbol);
      return true;
    });

    if (signals.length === 0) {
      return res.status(200).json({
        total: 0, t1: 0, t2: 0, t3: 0, stops: 0, signals: [],
      });
    }

    let t1 = 0, t2 = 0, t3 = 0, stops = 0;
    signals.forEach(s => {
      if (s.target3_hit)      t3++;
      else if (s.target2_hit) t2++;
      else if (s.target1_hit) t1++;
      if (s.stop_hit)         stops++;
    });

    // ترتيب: HOT أولاً ثم EP/score تنازلياً
    const sorted = signals.sort((a, b) => {
      if (b.is_hot !== a.is_hot) return b.is_hot ? 1 : -1;
      return (b.ep || b.score || 0) - (a.ep || a.score || 0);
    });

    return res.status(200).json({
      total: sorted.length,
      t1, t2, t3, stops,
      signals: sorted,
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
