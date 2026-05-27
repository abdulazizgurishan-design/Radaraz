export default async function handler(req, res) {
  const { key } = req.query;

  if (!key) return res.status(400).json({ valid: false, reason: "no_key" });

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/subscribers?access_key=eq.${key}&select=*`,
      {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (!data || data.length === 0) {
      return res.status(200).json({ valid: false, reason: "not_found" });
    }

    const subscriber = data[0];
    const now = new Date();
    const expires = new Date(subscriber.expires_at);

    if (!subscriber.is_active || now > expires) {
      return res.status(200).json({ valid: false, reason: "expired", email: subscriber.email });
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
