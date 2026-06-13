const POLYGON_KEY = process.env.POLYGON_API_KEY;
const SUPABASE_URL = "https://ypxrrghhkjbeojzphdln.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const BASE = "https://api.polygon.io";

// السماح لـ Vercel بوقت تنفيذ أطول (حتى 60 ثانية)
export const config = { maxDuration: 60 };

// إعادة محاولة خفيفة لأخطاء DNS المؤقتة (مرة واحدة فقط — لتجنّب البطء)
async function fetchRetry(url, options = {}, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

export default async function handler(req, res) {
  // حماية — يقبل من Vercel Cron أو السيكريت (header أو query للمجدول الخارجي)
  const isFromCron = req.headers['x-vercel-cron'] === 'true';
  const headerSecret = req.headers["x-cron-secret"];
  const querySecret = req.query.secret;
  const isAuthorized = isFromCron || headerSecret === CRON_SECRET || querySecret === CRON_SECRET;

  if (!isAuthorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // تخطّي عطلة نهاية الأسبوع (السوق مغلق — لا بيانات)
    const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const dow = etNow.getDay(); // 0=أحد 6=سبت
    if (dow === 0 || dow === 6) {
      return res.status(200).json({ success: true, message: "عطلة نهاية الأسبوع — لا تقييم", evaluated: 0 });
    }

    // 1. جيب كل الإشارات المفتوحة
    const r = await fetchRetry(
      `${SUPABASE_URL}/rest/v1/signals?status=eq.OPEN&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const signals = await r.json();
    if (!signals?.length) return res.status(200).json({ message: "لا توجد إشارات مفتوحة" });

    // 2. احسب تاريخ اليوم (ET timezone)
    const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const date = et.toISOString().split("T")[0];

    console.log(`📊 Evaluating ${signals.length} signals for ${date}`);

    // 3. قيّم كل إشارة
    const updates = await Promise.all(signals.map(async (sig) => {
      try {
        const url = `${BASE}/v2/aggs/ticker/${sig.symbol}/range/1/day/${date}/${date}?apiKey=${POLYGON_KEY}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);  // 4s timeout لكل طلب (سرعة)
        const r2 = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        const d = await r2.json();
        const bar = d?.results?.[0];
        if (!bar) {
          console.log(`⚠️ ${sig.symbol}: No data for ${date}`);
          return null;
        }

        const high  = bar.h;
        const low   = bar.l;
        const close = bar.c;

        const t1_hit   = high >= sig.target1;
        const t2_hit   = high >= sig.target2;
        const t3_hit   = high >= sig.target3;
        const stop_hit = low  <= sig.stop_loss;

        const max_gain_pct   = parseFloat(((high  - sig.entry_price) / sig.entry_price * 100).toFixed(2));
        const close_gain_pct = parseFloat(((close - sig.entry_price) / sig.entry_price * 100).toFixed(2));

        console.log(`✓ ${sig.symbol}: H=$${high}, L=$${low}, C=$${close} → T1:${t1_hit?'✅':'❌'} T2:${t2_hit?'✅':'❌'} T3:${t3_hit?'✅':'❌'} SL:${stop_hit?'🛑':'❌'}`);

        return {
          id: sig.id,
          high_price:     high,
          low_price:      low,
          close_price:    close,
          target1_hit:    t1_hit,
          target2_hit:    t2_hit,
          target3_hit:    t3_hit,
          stop_hit:       stop_hit,
          max_gain_pct,
          close_gain_pct,
          evaluated_at:   new Date().toISOString(),
          status:         "CLOSED",
        };
      } catch (err) {
        console.error(`💥 ${sig.symbol}: ${err.message}`);
        return null;
      }
    }));

    // 4. حدّث كل سجل في Supabase
    const valid = updates.filter(Boolean);
    let updated = 0;

    for (const u of valid) {
      const { id, ...fields } = u;
      const resp = await fetchRetry(`${SUPABASE_URL}/rest/v1/signals?id=eq.${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify(fields),
      });
      if (resp.ok) updated++;
    }

    console.log(`✅ Updated ${updated} signals`);

    return res.status(200).json({
      success: true,
      evaluated: updated,
      date,
      total_signals: signals.length,
    });

  } catch (error) {
    console.error("💥 Error:", error.message);
    return res.status(500).json({ error: error.message, cause: String(error.cause || "") });
  }
}
