// pages/api/affiliate-register.js
// تسجيل مسوّق: يحجز أول كود متاح + يولّد مفتاح 5 أرقام
const SUPABASE_URL = "https://ypxrrghhkjbeojzphdln.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  try {
    const { name, email, exp_market, exp_marketing, audience, telegram } = req.body || {};

    if (!name || !email || !email.includes("@")) {
      return res.status(400).json({ error: "missing", message: "الاسم والإيميل مطلوبان" });
    }

    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    };

    // 1. هل هذا الإيميل مسجّل مسبقاً؟ (يرجّع كوده الموجود)
    const existRes = await fetch(
      `${SUPABASE_URL}/rest/v1/affiliates?email=eq.${encodeURIComponent(email)}&select=code,secret_key`,
      { headers }
    );
    const existing = await existRes.json();
    if (Array.isArray(existing) && existing.length > 0 && existing[0].code) {
      return res.status(200).json({
        success: true,
        already: true,
        code: existing[0].code,
        secret_key: existing[0].secret_key,
        message: "أنت مسجّل مسبقاً — هذا كودك",
      });
    }

    // 2. احجز أول كود متاح
    const availRes = await fetch(
      `${SUPABASE_URL}/rest/v1/affiliates?status=eq.available&select=id,code&order=id.asc&limit=1`,
      { headers }
    );
    const avail = await availRes.json();
    if (!Array.isArray(avail) || avail.length === 0) {
      return res.status(200).json({
        success: false,
        no_codes: true,
        message: "نفدت الأكواد حالياً — سنتواصل معك قريباً",
      });
    }

    const chosen = avail[0];
    // مفتاح 5 أرقام
    const secret_key = String(Math.floor(10000 + Math.random() * 90000));

    // 3. اربط الكود بالمسوّق
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/affiliates?id=eq.${chosen.id}&status=eq.available`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "assigned",
          name, email, secret_key,
          exp_market: exp_market || null,
          exp_marketing: exp_marketing || null,
          audience: audience || null,
          telegram: telegram || null,
          assigned_at: new Date().toISOString(),
        }),
      }
    );

    if (!patchRes.ok) {
      const txt = await patchRes.text();
      return res.status(200).json({ success: false, message: "تعذّر الحجز، حاول مجدداً", detail: txt });
    }

    return res.status(200).json({
      success: true,
      code: chosen.code,
      secret_key,
      message: "تم التسجيل بنجاح",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
