// pages/api/mark-displayed.js
// ختم الإشارات التي عُرضت للمشتركين (للتقارير)
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { symbols } = req.body;
    if (!symbols || !symbols.length) {
      return res.status(200).json({ success: true, stamped: 0 });
    }

    // ختم الإشارات التي عُرضت
    const { error } = await fetch(`${SUPABASE_URL}/rest/v1/signals`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        displayed: true,
        displayed_at: new Date().toISOString(),
      }),
      // نطبق على الرموز الموجودة في القائمة
      // نستخدم فلتر in
    });

    // Supabase PATCH مع in filter
    const symbolsStr = symbols.map(s => `"${s}"`).join(",");
    const url = `${SUPABASE_URL}/rest/v1/signals?symbol=in.(${symbolsStr})&displayed=eq.false`;
    
    const r = await fetch(url, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        displayed: true,
        displayed_at: new Date().toISOString(),
      }),
    });

    if (!r.ok) {
      console.error(`❌ mark-displayed: ${r.status}`);
    }

    return res.status(200).json({
      success: true,
      stamped: symbols.length,
    });

  } catch (error) {
    console.error("❌ mark-displayed error:", error);
    return res.status(200).json({
      success: false,
      error: error.message,
    });
  }
}
