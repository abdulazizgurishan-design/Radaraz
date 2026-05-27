import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { key } = req.query;

  if (!key) return res.status(400).json({ valid: false, reason: "no_key" });

  const { data, error } = await supabase
    .from('subscribers')
    .select('*')
    .eq('access_key', key)
    .single();

  if (error || !data) {
    return res.status(200).json({ valid: false, reason: "not_found" });
  }

  const now = new Date();
  const expires = new Date(data.expires_at);

  if (!data.is_active || now > expires) {
    return res.status(200).json({ valid: false, reason: "expired", email: data.email });
  }

  return res.status(200).json({
    valid: true,
    plan: data.plan,
    expires_at: data.expires_at,
    email: data.email
  });
}
