import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) key += '-';
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  // تحقق إذا سبق وجرّب
  const { data: existing } = await supabase
    .from('subscribers')
    .select('id, plan')
    .eq('email', email)
    .single();

  if (existing) {
    return res.status(200).json({ 
      error: 'used', 
      message: 'هذا الإيميل استخدم التجربة المجانية مسبقاً' 
    });
  }

  const access_key = generateKey();
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ساعة

  const { error } = await supabase.from('subscribers').insert({
    email,
    access_key,
    plan: 'trial',
    expires_at: expires_at.toISOString(),
  });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ 
    success: true, 
    access_key,
    expires_at: expires_at.toISOString()
  });
}
