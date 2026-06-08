const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  try {
    // جيب كل الإشارات من اليوم
    const today = new Date().toISOString().split('T')[0];
    
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?created_at=gte.${today}T00:00:00Z&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const signals = await r.json();

    if (!signals || signals.length === 0) {
      return res.status(200).json({
        total: 0,
        t1: 0,
        t2: 0,
        t3: 0,
        stops: 0,
        signals: [],
      });
    }

    // احسب الإحصائيات
    let t1 = 0, t2 = 0, t3 = 0, stops = 0;

    signals.forEach(s => {
      if (s.target3_hit) t3++;
      else if (s.target2_hit) t2++;
      else if (s.target1_hit) t1++;
      
      if (s.stop_hit) stops++;
    });

    return res.status(200).json({
      total: signals.length,
      t1,
      t2,
      t3,
      stops,
      signals: signals.sort((a, b) => (b.max_gain_pct || 0) - (a.max_gain_pct || 0)),
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
