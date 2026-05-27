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
  const email = req.query.email || (req.body && req.body.email);

  if (!email) return res.status(400).json({ error: 'email required' });

  const SUPABASE_URL = 'https://ypxrrghhkjbeojzphdln.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };

  // تحقق إذا سبق وجرّب
  const check = await fetch(
    `${SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}&select=id,plan`,
    { headers }
  );
  const existing = await check.json();

  if (Array.isArray(existing) && existing.length > 0) {
    return res.status(200).json({
      error: 'used',
      message: 'هذا الإيميل استخدم التجربة المجانية مسبقاً'
    });
  }

  const access_key = generateKey();
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const insert = await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ email, access_key, plan: 'trial', expires_at }),
  });

  if (!insert.ok) {
    const err = await insert.text();
    return res.status(500).json({ error: err });
  }

  return res.status(200).json({
    success: true,
    access_key,
    expires_at
  });
}
