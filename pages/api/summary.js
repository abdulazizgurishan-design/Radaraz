const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  try {
    const today = new Date().toISOString().split("T")[0];

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?scan_time=gte.${today}T00:00:00&select=*&order=score.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const signals = await r.json();

    const closed = signals.filter(s => s.status === "CLOSED");

    return res.status(200).json({
      total:   signals.length,
      t1:      closed.filter(s => s.target1_hit).length,
      t2:      closed.filter(s => s.target2_hit).length,
      t3:      closed.filter(s => s.target3_hit).length,
      stops:   closed.filter(s => s.stop_hit).length,
      signals,
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
