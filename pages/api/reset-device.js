// reset-device.js — نقل المفتاح لجهاز جديد (للأدمن)
// يمسح device_id فيقدر المشترك يدخل من جهاز جديد ويُربط من جديد
const SUPABASE_URL = "https://ypxrrghhkjbeojzphdln.supabase.co";
const ADMIN_PASS = "123451";  // نفس باسوورد الأدمن

export default async function handler(req, res) {
  const key  = req.query.key  || req.body?.key;
  const pass = req.query.pass || req.body?.pass;

  // حماية: لازم باسوورد الأدمن
  if (pass !== ADMIN_PASS) {
    return res.status(403).json({ success: false, reason: "unauthorized" });
  }
  if (!key) {
    return res.status(400).json({ success: false, reason: "no_key" });
  }

  try {
    // اجلب المشترك أولاً (لقراءة عدد مرات النقل)
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscribers?access_key=eq.${key}&select=*`,
      {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
      }
    );
    const rows = await getRes.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({ success: false, reason: "not_found" });
    }
    const sub = rows[0];
    const resets = (sub.device_resets || 0) + 1;

    // امسح device_id + زِد عداد النقل
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscribers?access_key=eq.${key}`,
      {
        method: "PATCH",
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          device_id: null,
          device_locked_at: null,
          device_resets: resets,
        }),
      }
    );

    if (!patchRes.ok) {
      const txt = await patchRes.text();
      return res.status(200).json({ success: false, reason: txt });
    }

    return res.status(200).json({
      success: true,
      email: sub.email,
      device_resets: resets,
      message: `تم تحرير المفتاح — يقدر المشترك يدخل من جهاز جديد`,
    });
  } catch (error) {
    return res.status(200).json({ success: false, reason: error.message });
  }
}
