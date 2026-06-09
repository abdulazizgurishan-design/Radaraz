const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  try {
    // استخدم تاريخ اليوم بتوقيت UTC
    const now = new Date();
    const todayUTC = now.toISOString().split('T')[0];

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?scan_time=gte.${todayUTC}T00:00:00+00:00&order=scan_time.desc&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const data = await r.json();
    const signals = Array.isArray(data) ? data : [];

    if (signals.length === 0) {
      return res.status(200).json({
        total: 0, t1: 0, t2: 0, t3: 0, stops: 0, signals: [],
      });
    }

    let t1 = 0, t2 = 0, t3 = 0, stops = 0;
    signals.forEach(s => {
      if (s.target3_hit) t3++;
      else if (s.target2_hit) t2++;
      else if (s.target1_hit) t1++;
      if (s.stop_hit) stops++;
    });

    return res.status(200).json({
      total: signals.length,
      t1, t2, t3, stops,
      signals: signals.sort((a, b) => (b.score || 0) - (a.score || 0)),
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
