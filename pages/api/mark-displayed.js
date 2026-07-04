// pages/api/mark-displayed.js — v2 (مُصحح)
// ختم الإشارات المعروضة فعلاً للمشترك — لصفوف اليوم فقط
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.RADARAZ_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { symbols } = req.body || {};
    if (!Array.isArray(symbols) || !symbols.length) {
      return res.status(200).json({ success: true, stamped: 0 });
    }

    // 🛡️ تعقيم: أحرف كبيرة فقط 1-6، بلا تكرار، سقف 300 (يمنع حقن فلاتر PostgREST)
    const clean = [...new Set(
      symbols.filter(s => typeof s === "string" && /^[A-Z]{1,6}$/.test(s))
    )].slice(0, 300);
    if (!clean.length) {
      return res.status(200).json({ success: true, stamped: 0 });
    }

    // 📅 نفس تاريخ scan.js (بتوقيت نيويورك) — الختم لصفوف اليوم فقط
    const sigDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
      .toISOString().split("T")[0];

    const url = `${SUPABASE_URL}/rest/v1/signals`
      + `?symbol=in.(${clean.join(",")})`
      + `&signal_date=eq.${sigDate}`
      + `&or=(displayed.is.null,displayed.eq.false)`;

    const r = await fetch(url, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        displayed: true,
        displayed_at: new Date().toISOString(),
      }),
    });

    let stamped = 0;
    if (r.ok) {
      const rows = await r.json();
      stamped = Array.isArray(rows) ? rows.length : 0;
    } else {
      console.error(`❌ mark-displayed: ${r.status}`);
    }

    return res.status(200).json({ success: r.ok, stamped, status: r.status });

  } catch (error) {
    console.error("❌ mark-displayed error:", error);
    return res.status(200).json({ success: false, error: error.message });
  }
}
