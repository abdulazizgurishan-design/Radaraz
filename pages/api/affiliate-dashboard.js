// pages/api/affiliate-dashboard.js
// دخول المسوّق (إيميل + مفتاح) → إحصائياته + مشتركيه
// أو تحديث طريقة الدفع
const SUPABASE_URL = "https://ypxrrghhkjbeojzphdln.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const COMMISSION = 4; // $ لكل مشترك نشط شهرياً

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  try {
    const { email, secret_key, action, payout_method, payout_address } = req.body || {};

    if (!email || !secret_key) {
      return res.status(400).json({ error: "missing", message: "الإيميل والمفتاح مطلوبان" });
    }

    // 1. تحقّق من المسوّق
    const affRes = await fetch(
      `${SUPABASE_URL}/rest/v1/affiliates?email=eq.${encodeURIComponent(email)}&secret_key=eq.${encodeURIComponent(secret_key)}&select=*`,
      { headers }
    );
    const affRows = await affRes.json();
    if (!Array.isArray(affRows) || affRows.length === 0) {
      return res.status(200).json({ success: false, reason: "invalid", message: "الإيميل أو المفتاح غير صحيح" });
    }
    const aff = affRows[0];

    // 2. تحديث طريقة الدفع (إن طُلب)
    if (action === "save_payout") {
      await fetch(
        `${SUPABASE_URL}/rest/v1/affiliates?id=eq.${aff.id}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ payout_method, payout_address }),
        }
      );
      return res.status(200).json({ success: true, saved: true, message: "تم حفظ طريقة الدفع" });
    }

    // 3. اجلب المشتركين عبر كوده
    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscribers?referral_code=eq.${encodeURIComponent(aff.code)}&select=expires_at,is_active,created_at&order=created_at.desc`,
      { headers }
    );
    const subs = await subRes.json();
    const list = Array.isArray(subs) ? subs : [];

    const now = Date.now();
    const active = list.filter(s => s.is_active && (!s.expires_at || new Date(s.expires_at).getTime() > now));

    // مشتركون جدد هذا الشهر
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const newThisMonth = list.filter(s => s.created_at && new Date(s.created_at) >= monthStart).length;

    // قائمة مبسّطة (بدون بيانات شخصية — فقط تواريخ + حالة)
    const subscribers = list.slice(0, 50).map((s, i) => ({
      idx: list.length - i,
      date: s.created_at,
      active: s.is_active && (!s.expires_at || new Date(s.expires_at).getTime() > now),
    }));

    return res.status(200).json({
      success: true,
      affiliate: {
        name: aff.name,
        code: aff.code,
        payout_method: aff.payout_method || null,
        payout_address: aff.payout_address || null,
      },
      stats: {
        activeCount: active.length,
        totalCount: list.length,
        newThisMonth,
        commission: active.length * COMMISSION,
      },
      subscribers,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
