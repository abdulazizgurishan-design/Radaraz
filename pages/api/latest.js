// pages/api/latest.js
// قراءة سريعة للفرص المحفوظة من Supabase (بدون مسح حيّ) — تظهر فوراً عند فتح الصفحة.
// الكرون يمسح ويحفظ؛ المستخدم يقرأ من هنا (كاش) ثم تُحدّث الواجهة بمسح حيّ بالخلفية.

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ypxrrghhkjbeojzphdln.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const LIMIT = 120;

async function query(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return { ok: false, status: r.status, rows: [] };
  return { ok: true, status: r.status, rows: await r.json() };
}

export default async function handler(req, res) {
  // كاش خفيف على حافة الـ CDN — يخفّف الضغط ويسرّع التحميل المتكرر
  res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=60");

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json({ results: [], cached: true, error: "no_supabase" });
  }

  try {
    // تاريخ اليوم بتوقيت السوق (ET)
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
      .toISOString().split("T")[0];

    // 1) فرص اليوم أولاً (الأعلى نقاطاً)
    let { ok, rows } = await query(
      `signals?signal_date=eq.${today}&order=score.desc&limit=${LIMIT}`
    );

    // 2) لو اليوم فاضي (صباح باكر/عطلة) → أحدث الفرص المحفوظة أياً كان يومها
    let fallback = false;
    if (ok && rows.length === 0) {
      const r2 = await query(`signals?order=created_at.desc&limit=${LIMIT}`);
      rows = r2.rows;
      fallback = true;
    }

    return res.status(200).json({
      results: rows,
      count: rows.length,
      cached: true,
      fallback,
      signal_date: today,
    });
  } catch (e) {
    return res.status(200).json({ results: [], cached: true, error: e.message });
  }
}
