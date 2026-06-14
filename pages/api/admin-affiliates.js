// pages/api/admin-affiliates.js
// لوحة الأدمن: كل المسوّقين + عدد مشتركيهم + عمولاتهم
const SUPABASE_URL = "https://ypxrrghhkjbeojzphdln.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASS = "123451";
const COMMISSION = 4;
const NET = 14; // صافي ربحك لكل مشترك ($18-$2 خصم-$2... = حسب معادلتك: $16-$3 عمولة فعلية، نعرض تقديري)

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export default async function handler(req, res) {
  const pass = req.query.pass || req.body?.pass;
  if (pass !== ADMIN_PASS) {
    return res.status(403).json({ error: "unauthorized" });
  }

  try {
    // كل المسوّقين المسجّلين
    const affRes = await fetch(
      `${SUPABASE_URL}/rest/v1/affiliates?status=eq.assigned&select=*&order=assigned_at.desc`,
      { headers }
    );
    const affiliates = await affRes.json();
    if (!Array.isArray(affiliates)) {
      return res.status(200).json({ success: true, affiliates: [], totals: {} });
    }

    const now = Date.now();

    // لكل مسوّق: عدّ مشتركيه النشطين
    const enriched = await Promise.all(affiliates.map(async (aff) => {
      try {
        const subRes = await fetch(
          `${SUPABASE_URL}/rest/v1/subscribers?referral_code=eq.${encodeURIComponent(aff.code)}&select=expires_at,is_active`,
          { headers }
        );
        const subs = await subRes.json();
        const list = Array.isArray(subs) ? subs : [];
        const active = list.filter(s => s.is_active && (!s.expires_at || new Date(s.expires_at).getTime() > now)).length;
        return {
          name: aff.name,
          email: aff.email,
          code: aff.code,
          telegram: aff.telegram,
          payout_method: aff.payout_method,
          payout_address: aff.payout_address,
          activeCount: active,
          totalCount: list.length,
          commission: active * COMMISSION,
          assigned_at: aff.assigned_at,
        };
      } catch {
        return {
          name: aff.name, email: aff.email, code: aff.code,
          telegram: aff.telegram, payout_method: aff.payout_method,
          payout_address: aff.payout_address,
          activeCount: 0, totalCount: 0, commission: 0, assigned_at: aff.assigned_at,
        };
      }
    }));

    // الإجماليات
    const totalActive = enriched.reduce((s, a) => s + a.activeCount, 0);
    const totalCommission = enriched.reduce((s, a) => s + a.commission, 0);
    const netProfit = totalActive * NET;

    return res.status(200).json({
      success: true,
      affiliates: enriched,
      totals: {
        affiliateCount: enriched.length,
        totalActive,
        totalCommission,
        netProfit,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
