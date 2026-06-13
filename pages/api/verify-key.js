// verify-key.js — التحقق من المفتاح + ربط الجهاز (حماية من المشاركة)
const SUPABASE_URL = "https://ypxrrghhkjbeojzphdln.supabase.co";

export default async function handler(req, res) {
  // المفتاح + بصمة الجهاز (تُرسل من المتصفح)
  const key      = req.query.key || req.body?.key;
  const deviceId = req.query.device || req.body?.device || null;

  if (!key) return res.status(400).json({ valid: false, reason: "no_key" });

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/subscribers?access_key=eq.${key}&select=*`,
      {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(200).json({ valid: false, reason: "not_found" });
    }

    const subscriber = data[0];

    if (!subscriber || !subscriber.expires_at) {
      return res.status(200).json({ valid: false, reason: "not_found" });
    }

    const now     = new Date();
    const expires = new Date(subscriber.expires_at);

    // 1️⃣ تحقق الصلاحية أولاً
    if (!subscriber.is_active || now > expires) {
      return res.status(200).json({
        valid: false,
        reason: "expired",
        email: subscriber.email,
      });
    }

    // 2️⃣ منطق ربط الجهاز
    const boundDevice = subscriber.device_id;

    // لو ما أُرسلت بصمة جهاز (توافق قديم) — نسمح بدون ربط
    if (deviceId) {
      if (!boundDevice) {
        // أول دخول → اربط المفتاح بهذا الجهاز
        await fetch(
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
              device_id: deviceId,
              device_locked_at: now.toISOString(),
            }),
          }
        );
      } else if (boundDevice !== deviceId) {
        // جهاز مختلف → رفض (مشاركة محتملة)
        return res.status(200).json({
          valid: false,
          reason: "device_mismatch",
          email: subscriber.email,
        });
      }
      // boundDevice === deviceId → نفس الجهاز، يكمل ✅
    }

    return res.status(200).json({
      valid: true,
      plan: subscriber.plan,
      expires_at: subscriber.expires_at,
      email: subscriber.email,
    });

  } catch (error) {
    return res.status(500).json({ valid: false, reason: error.message });
  }
}
