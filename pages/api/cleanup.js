// pages/api/cleanup.js — تنظيف تلقائي لجدول signals
// يحذف الإشارات الأقدم من 24 ساعة لمنع تضخّم الجدول
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  try {
    // الحد: احذف كل إشارة أقدم من 24 ساعة
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const url = `${SUPABASE_URL}/rest/v1/signals?created_at=lt.${cutoff}`;

    const r = await fetch(url, {
      method: "DELETE",
      headers: {
        apikey:        SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer:        "return=representation",
      },
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(200).json({ success: false, status: r.status, error: txt });
    }

    const deleted = await r.json();

    return res.status(200).json({
      success:     true,
      deleted:     Array.isArray(deleted) ? deleted.length : 0,
      cutoff,
      message:     `حُذفت الإشارات الأقدم من 24 ساعة`,
    });
  } catch (error) {
    return res.status(200).json({ success: false, error: error.message });
  }
}
