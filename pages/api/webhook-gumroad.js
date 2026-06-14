export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      const params = new URLSearchParams(data);
      const obj = {};
      for (const [key, value] of params.entries()) {
        obj[key] = value;
      }
      resolve(obj);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = await parseBody(req);
    const email = body.email;
    const productId = body.product_permalink;
    // 🔗 كود الإحالة من Gumroad (إن استُخدم كود مسوّق)
    const offerCode = (body.offer_code || '').trim().toUpperCase();

    if (!email) return res.status(400).json({ error: 'no email' });

    let days = 30;
    let plan = 'monthly';
    let planAr = 'شهري';
    if (productId && productId.includes('ereqyb')) {
      days = 90;
      plan = '3months';
      planAr = '3 أشهر';
    }

    const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const expires_date = new Date(expires_at).toLocaleDateString('ar-SA');

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let access_key = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) access_key += '-';
      access_key += chars[Math.floor(Math.random() * chars.length)];
    }

    const SUPABASE_URL = 'https://ypxrrghhkjbeojzphdln.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    };

    // 🔗 تحقّق: هل الكود المستخدم كود مسوّق مسجّل؟
    let referral_code = null;
    if (offerCode) {
      try {
        const affRes = await fetch(
          `${SUPABASE_URL}/rest/v1/affiliates?code=eq.${encodeURIComponent(offerCode)}&status=eq.assigned&select=code`,
          { headers }
        );
        const affRows = await affRes.json();
        if (Array.isArray(affRows) && affRows.length > 0) {
          referral_code = offerCode;  // كود مسوّق صحيح → نربطه
        }
      } catch {
        // لو فشل التحقق، نكمل بدون ربط (لا نوقف الاشتراك)
      }
    }

    const check = await fetch(
      `${SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}&select=id`,
      { headers }
    );
    const existing = await check.json();

    // الحقول المحفوظة (نضيف referral_code فقط إن وُجد كود مسوّق صحيح)
    const subFields = { access_key, plan, expires_at, is_active: true };
    if (referral_code) subFields.referral_code = referral_code;

    if (Array.isArray(existing) && existing.length > 0) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(subFields),
        }
      );
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ email, ...subFields }),
      });
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'RADAR AZ PRO <noreply@radaraz.com>',
        to: email,
        subject: '🎉 مفتاح اشتراكك في RADAR AZ PRO',
        html: `
          <div dir="rtl" style="font-family:Arial;max-width:500px;margin:0 auto;background:#080c18;color:#fff;padding:32px;border-radius:16px;">
            <h1 style="color:#6366f1;text-align:center;letter-spacing:3px;">RADAR AZ PRO</h1>
            <p style="font-size:16px;">مرحباً! 🎉</p>
            <p>شكراً لاشتراكك في <strong>RADAR AZ PRO</strong> — باقة <strong>${planAr}</strong></p>
            <div style="background:#0d1829;border:1px solid #6366f1;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
              <p style="color:rgba(255,255,255,0.5);font-size:12px;margin-bottom:8px;">مفتاح الدخول الخاص بك</p>
              <p style="font-size:24px;font-weight:900;letter-spacing:4px;color:#00d4ff;font-family:monospace;">${access_key}</p>
              <p style="color:rgba(255,255,255,0.3);font-size:11px;">صالح حتى: ${expires_date}</p>
            </div>
            <p style="font-size:14px;">خطوات الدخول:</p>
            <ol style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.8;">
              <li>افتح <a href="https://radaraz.com/app" style="color:#6366f1;">radaraz.com/app</a></li>
              <li>أدخل المفتاح أعلاه</li>
              <li>اضغط دخول وابدأ المسح 🚀</li>
            </ol>
            <p style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:24px;text-align:center;">الشرعية مسؤوليتك · الالتزام بوقف الخسارة يخفف المخاطرة</p>
          </div>
        `,
      }),
    });

    return res.status(200).json({ success: true, referral_linked: !!referral_code });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
