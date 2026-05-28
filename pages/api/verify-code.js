import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  // تحقق من الكود
  const { data: record } = await supabase
    .from('verification_codes')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .eq('code', code.trim())
    .single();

  if (!record) {
    return res.status(400).json({ error: 'invalid_code' });
  }

  if (new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: 'expired' });
  }

  // احذف الكود بعد الاستخدام
  await supabase.from('verification_codes').delete().eq('id', record.id);

  // أنشئ مفتاح الوصول
  const access_key = 'TRIAL-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await supabase.from('subscribers').insert({
    email: email.trim().toLowerCase(),
    access_key,
    plan: 'trial',
    expires_at,
  });

  return res.status(200).json({ success: true, access_key });
}
