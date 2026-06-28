// /api/dashboard — لوحة قيادة RadarAZ: يحسب المؤشرات الحاسمة (KPIs)
//   • المشتركون: نشط / منتهي / جدد هذا الشهر + اتجاه النمو
//   • الإيراد: شهري تقريبي + متوسط لكل مشترك
//   • Retention: % التجديد (المشتركون الذين جدّدوا بعد انتهاء أول اشتراك)
//   • نسبة نجاح الإشارات: win rate + Profit Factor (من الإشارات المُقيّمة)
//   • التحويل: نسبة trial → paid
// محمي بنفس CRON_SECRET (؟secret=) أو باسوورد admin.
//
// ملاحظة: يقرأ مباشرة من Supabase REST (نفس نمط evaluate/scan).

const SUPABASE_URL = "https://ypxrrghhkjbeojzphdln.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;

// أسعار الباقات (لحساب الإيراد) — رمزية
const PRICE = { monthly: 18, quarterly: 40, trial: 0 };

const H = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function sbFetch(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

// تاريخ بصيغة YYYY-MM-DD
function dayStr(d) { return new Date(d).toISOString().split("T")[0]; }

// بداية الشهر الحالي
function monthStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
}
// بداية الشهر الماضي
function lastMonthStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() - 1, 1).toISOString();
}

export default async function handler(req, res) {
  // الحماية: secret أو باسوورد admin
  const ok = req.query.secret === CRON_SECRET || req.query.pw === "123451";
  if (!ok) return res.status(401).json({ error: "Unauthorized" });

  try {
    const now = new Date();
    const nowISO = now.toISOString();
    const mStart = monthStart();
    const lmStart = lastMonthStart();

    // ── 1) المشتركون ──
    const subs = await sbFetch("subscribers?select=*&limit=5000");

    const paidPlans = (s) => s.plan === "monthly" || s.plan === "quarterly";
    const isActive = (s) => s.is_active && s.expires_at && new Date(s.expires_at) > now;
    const isExpired = (s) => !s.expires_at || new Date(s.expires_at) <= now;

    const totalSubs   = subs.length;
    const activeSubs  = subs.filter(isActive);
    const paidActive  = activeSubs.filter(paidPlans);
    const trialActive = activeSubs.filter((s) => s.plan === "trial");
    const expiredSubs = subs.filter((s) => paidPlans(s) && isExpired(s));

    // جدد هذا الشهر / الشهر الماضي (من created_at)
    const newThisMonth = subs.filter((s) => s.created_at && s.created_at >= mStart);
    const newLastMonth = subs.filter((s) => s.created_at && s.created_at >= lmStart && s.created_at < mStart);
    const paidNewThisMonth = newThisMonth.filter(paidPlans);

    // اتجاه النمو
    const growthPct = newLastMonth.length > 0
      ? Math.round(((newThisMonth.length - newLastMonth.length) / newLastMonth.length) * 100)
      : (newThisMonth.length > 0 ? 100 : 0);

    // ── 2) الإيراد ──
    const monthlyRevenue = paidActive.reduce((sum, s) => sum + (PRICE[s.plan] || 0), 0);
    const arpu = paidActive.length > 0 ? +(monthlyRevenue / paidActive.length).toFixed(1) : 0;

    // ── 3) Retention (التجديد) ──
    // مبسّط: من المشتركين المدفوعين الذين انتهى أول اشتراك، كم لا يزال نشطاً أو جدّد؟
    // device_resets أو وجود اشتراك ممتد = مؤشر. هنا: نسبة النشطين من إجمالي المدفوعين.
    const allPaid = subs.filter(paidPlans);
    const retentionPct = allPaid.length > 0
      ? Math.round((paidActive.length / allPaid.length) * 100)
      : 0;

    // ── 4) التحويل (trial → paid) ──
    // كم % من إجمالي من جرّب (trial) تحوّل لمدفوع؟ (تقريبي: حسب الإيميلات المشتركة)
    const trialEmails = new Set(subs.filter((s) => s.plan === "trial").map((s) => s.email));
    const paidEmails  = new Set(allPaid.map((s) => s.email));
    let converted = 0;
    trialEmails.forEach((e) => { if (paidEmails.has(e)) converted++; });
    const conversionPct = trialEmails.size > 0
      ? Math.round((converted / trialEmails.size) * 100)
      : 0;

    // ── 5) نسبة نجاح الإشارات ──
    const closed = await sbFetch("signals?select=*&status=eq.CLOSED&order=created_at.desc&limit=2000");
    const evaluated = closed.length;
    const hit = closed.filter((s) => s.target1_hit || s.target2_hit || s.target3_hit).length;
    const pureStop = closed.filter((s) => s.stop_hit && !s.target1_hit).length;
    const winRate = evaluated > 0 ? Math.round((hit / evaluated) * 100) : 0;

    // Profit Factor: مجموع المكاسب ÷ مجموع الخسائر (من close_gain_pct)
    let grossWin = 0, grossLoss = 0;
    closed.forEach((s) => {
      const g = Number(s.close_gain_pct) || 0;
      if (g > 0) grossWin += g; else grossLoss += Math.abs(g);
    });
    const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : (grossWin > 0 ? 99 : 0);

    // توزيع حسب النوع
    const byType = {};
    ["استثمار", "مضاربة", "ارتداد"].forEach((t) => {
      const arr = closed.filter((s) => s.type === t);
      const w = arr.filter((s) => s.target1_hit || s.target2_hit || s.target3_hit).length;
      byType[t] = { total: arr.length, win: w, rate: arr.length ? Math.round((w / arr.length) * 100) : 0 };
    });

    // ── الرد ──
    return res.status(200).json({
      success: true,
      generated_at: nowISO,
      // المشتركون
      subscribers: {
        total: totalSubs,
        active_paid: paidActive.length,
        active_trial: trialActive.length,
        expired: expiredSubs.length,
        new_this_month: newThisMonth.length,
        new_paid_this_month: paidNewThisMonth.length,
        new_last_month: newLastMonth.length,
        growth_pct: growthPct,
      },
      // الإيراد
      revenue: {
        monthly_active: monthlyRevenue,
        arpu,                              // متوسط الإيراد لكل مشترك مدفوع
      },
      // المعايير الحاسمة
      retention_pct: retentionPct,         // ≥40% جيد
      conversion_pct: conversionPct,       // trial→paid، ≥25% جيد
      // أداء المنتج
      signals: {
        evaluated,
        win_rate: winRate,                 // ≥55% جيد
        profit_factor: profitFactor,       // ≥1.5 جيد
        hit, pure_stop: pureStop,
        by_type: byType,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
