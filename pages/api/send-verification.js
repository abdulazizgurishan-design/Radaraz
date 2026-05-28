import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  // تحقق إذا استخدم التجربة مسبقاً
  const { data: existing } = await supabase
    .from('subscribers')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .single();

  if (existing) {
    return res.status(400).json({ error: 'used' });
  }

  // أنشئ كود عشوائي
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 دقائق

  // احذف أي كود قديم لنفس الإيميل
  await supabase.from('verification_codes').delete().eq('email', email);

  // احفظ الكود
  await supabase.from('verification_codes').insert({
    email: email.trim().toLowerCase(),
    code,
    expires_at,
  });

  // أرسل الإيميل
  await resend.emails.send({
    from: 'Radaraz <noreply@radaraz.com>',
    to: email,
    subject: 'كود التحقق — راداراز',
    html: `
      <div style="font-family:system-ui;background:#080c18;color:#fff;padding:40px;text-align:center;border-radius:16px;">
        <h2 style="color:#a5b4fc;">🛡️ كود التحقق</h2>
        <p style="color:rgba(255,255,255,0.6);">استخدم هذا الكود للحصول على تجربتك المجانية</p>
        <div style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.4);border-radius:12px;padding:20px;margin:24px 0;font-size:36px;font-weight:900;letter-spacing:8px;color:#a5b4fc;">
          ${code}
        </div>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;">صالح لمدة 10 دقائق · Valid for 10 minutes</p>
      </div>
    `,
  });

  return res.status(200).json({ success: true });
}
