// enable-two-devices.js — تفعيل جهازين لمفتاح معيّن (بتحكم الأدمن فقط)
// يضبط allow_two_devices = true للمفتاح، فيسمح verify-key بربط جهاز ثانٍ (PC + جوال)
const SUPABASE_URL = "https://ypxrrghhkjbeojzphdln.supabase.co";
const ADMIN_PASS = "123451";

export default async function handler(req, res) {
  const key  = req.query.key  || req.body?.key;
  const pass = req.query.pass || req.body?.pass;

  // 🔒 حماية: الأدمن فقط
  if (pass !== ADMIN_PASS) {
    return res.status(200).json({ success: false, reason: "unauthorized" });
  }
  if (!key) return res.status(200).json({ success: false, reason: "no_key" });

  try {
    // 1️⃣ تحقق من وجود المفتاح
    const check = await fetch(
      `${SUPABASE_URL}/rest/v1/subscribers?access_key=eq.${key}&select=*`,
      {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
      }
    );
    const data = await check.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(200).json({ success: false, reason: "not_found" });
    }

    const subscriber = data[0];

    // 2️⃣ فعّل جهازين لهذا المفتاح
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
        body: JSON.stringify({ allow_two_devices: true }),
      }
    );

    return res.status(200).json({
      success: true,
      email: subscriber.email,
      allow_two_devices: true,
      message: "تم تفعيل جهازين لهذا المفتاح (PC + جوال)",
    });

  } catch (error) {
    return res.status(200).json({ success: false, reason: error.message });
  }
}
