// pages/api/results.js — سجل إنجازات RadarAZ (Track Record)
// صفحة تسويقية: الإشارات التي أصابت الهدف، بتوقيت السعودية، قابلة للنسخ.
// تعتمد على الأعمدة التي يكتبها evaluate.js: target1_hit, target1_hit_at, max_gain_pct, status...

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ypxrrghhkjbeojzphdln.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

// تحويل ISO (UTC) → توقيت السعودية (UTC+3) ثم تنسيق
function ast(iso) {
  if (!iso) return null;
  const d = new Date(new Date(iso).getTime() + 3 * 3600 * 1000);
  if (isNaN(d)) return null;
  const p = n => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default async function handler(req, res) {
  try {
    // آخر الإشارات المُقيَّمة (CLOSED) لحساب النسبة + عرض الرابحين
    const url = `${SUPABASE_URL}/rest/v1/signals?status=eq.CLOSED&select=symbol,entry_price,target1,created_at,signal_date,target1_hit,target1_hit_at,max_gain_pct,evaluated_at&order=evaluated_at.desc&limit=400`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const rows = r.ok ? await r.json() : [];

    const closed = Array.isArray(rows) ? rows : [];
    const wins   = closed.filter(s => s.target1_hit);                       // أصاب الهدف
    const losses = closed.filter(s => !s.target1_hit && s.stop_hit);        // ضرب الوقف
    const neutral = closed.filter(s => !s.target1_hit && !s.stop_hit);      // لا هدف ولا وقف
    const decided = wins.length + losses.length;                            // الصفقات المحسومة
    const winRate = decided ? Math.round((wins.length / decided) * 100) : 0;
    const avgGain = wins.length ? +(wins.reduce((a, s) => a + (s.max_gain_pct || 0), 0) / wins.length).toFixed(1) : 0;
    const avgLoss = losses.length ? +(losses.reduce((a, s) => a + (s.max_gain_pct || 0), 0) / losses.length).toFixed(1) : 0;

    // فلتر العرض: wins (افتراضي للتسويق) | losses | all
    const view = ["wins", "losses", "all"].includes(req.query.view) ? req.query.view : "wins";
    const pool = view === "wins" ? wins : view === "losses" ? losses : closed;

    // بناء البطاقات (واعية بالنتيجة) + نص النسخ
    const cards = pool.map(s => {
      const isWin = !!s.target1_hit;
      const isLoss = !s.target1_hit && s.stop_hit;
      const caught = ast(s.created_at) || { date: s.signal_date || "—", time: "—" };
      const hit = ast(s.target1_hit_at) || ast(s.evaluated_at) || { date: s.signal_date || "—", time: "—" };
      const gain = s.max_gain_pct != null ? `${s.max_gain_pct > 0 ? "+" : ""}${s.max_gain_pct}%` : "—";
      const entry = s.entry_price != null ? `$${(+s.entry_price).toFixed(2)}` : "—";
      const tgt = s.target1 != null ? `$${(+s.target1).toFixed(2)}` : "—";
      const badge = isWin ? "🎯 أصاب الهدف" : isLoss ? "🛑 ضرب الوقف" : "➖ بلا حسم";
      const color = isWin ? "#34d399" : isLoss ? "#f87171" : "#9aa4b8";
      const secondLine = isWin
        ? `✅ الهدف: ${hit.date} · ${hit.time} @ ${tgt}`
        : isLoss
          ? `🛑 ضرب وقف الخسارة (${gain})`
          : `➖ أغلق دون هدف/وقف (${gain})`;
      const copyText =
        `${isWin ? "🎯" : isLoss ? "🛑" : "➖"} $${s.symbol}  ${gain}\n` +
        `📅 التُقط: ${caught.date} · ${caught.time} (السعودية) @ ${entry}\n` +
        `${isWin ? `✅ الهدف: ${hit.date} · ${hit.time} @ ${tgt}` : secondLine}\n` +
        `— RadarAZ`;
      return { symbol: s.symbol, gain, entry, secondLine, caught, badge, color, isWin, copyText };
    });

    const cardsHtml = cards.map(c => `
      <div class="card" style="border-color:${c.color}33">
        <div class="row1">
          <span class="sym">$${esc(c.symbol)}</span>
          <span class="badge" style="color:${c.color};background:${c.color}1a;border-color:${c.color}40">${esc(c.badge)}</span>
          <span class="gain" style="color:${c.color}">${esc(c.gain)}</span>
        </div>
        <div class="line"><span class="lbl">📅 التُقط</span><span>${esc(c.caught.date)} · ${esc(c.caught.time)} <span class="dim">(السعودية)</span> @ ${esc(c.entry)}</span></div>
        <div class="line"><span>${esc(c.secondLine)}</span></div>
        <button class="copy" data-copy="${esc(c.copyText)}">📋 نسخ</button>
      </div>`).join("");

    const allText = cards.filter(c => c.isWin).map(c => c.copyText).join("\n\n") || cards.map(c => c.copyText).join("\n\n");

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>سجل إنجازات RadarAZ</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0e1a; color: #e8edf6; font-family: -apple-system, "SF Pro", system-ui, sans-serif; padding: 18px; max-width: 640px; margin: 0 auto; }
  h1 { font-size: 22px; text-align: center; margin-bottom: 4px; }
  h1 .az { color: #7c8cff; }
  .sub { text-align: center; color: rgba(255,255,255,0.4); font-size: 12px; margin-bottom: 18px; }
  .stats { display: flex; gap: 10px; margin-bottom: 18px; }
  .stat { flex: 1; background: rgba(124,140,255,0.08); border: 1px solid rgba(124,140,255,0.2); border-radius: 14px; padding: 14px 8px; text-align: center; }
  .stat .v { font-size: 24px; font-weight: 800; color: #34d399; }
  .stat .k { font-size: 11px; color: rgba(255,255,255,0.45); margin-top: 3px; }
  .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px; margin-bottom: 10px; }
  .row1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .sym { font-size: 18px; font-weight: 800; font-family: monospace; }
  .gain { font-size: 18px; font-weight: 800; color: #34d399; }
  .badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; border: 1px solid; }
  .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
  .tab { flex: 1; text-align: center; text-decoration: none; padding: 9px; border-radius: 10px; font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.55); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
  .tab.on { color: #fff; background: rgba(124,140,255,0.2); border-color: rgba(124,140,255,0.4); }
  .line { display: flex; gap: 8px; font-size: 13px; color: #cdd6ea; margin: 3px 0; }
  .line .lbl { min-width: 64px; color: rgba(255,255,255,0.5); }
  .dim { color: rgba(255,255,255,0.35); }
  .copy { margin-top: 10px; width: 100%; background: rgba(124,140,255,0.15); color: #aab4ff; border: 1px solid rgba(124,140,255,0.3); border-radius: 10px; padding: 9px; font-size: 13px; font-weight: 700; cursor: pointer; }
  .copy:active { background: rgba(124,140,255,0.3); }
  .copyall { width: 100%; background: #7c8cff; color: #fff; border: none; border-radius: 12px; padding: 13px; font-size: 15px; font-weight: 800; cursor: pointer; margin-bottom: 18px; }
  .empty { text-align: center; color: rgba(255,255,255,0.4); padding: 40px 0; font-size: 14px; }
  .note { text-align: center; color: rgba(255,255,255,0.3); font-size: 11px; margin-top: 14px; line-height: 1.7; }
</style></head>
<body>
  <h1>🎯 سجل إنجازات <span class="az">RadarAZ</span></h1>
  <div class="sub">تقييم صادق لإشارات الرادار — بتوقيت السعودية</div>
  <div class="stats">
    <div class="stat"><div class="v" style="color:#34d399">${wins.length}</div><div class="k">أصاب الهدف</div></div>
    <div class="stat"><div class="v" style="color:#f87171">${losses.length}</div><div class="k">ضرب الوقف</div></div>
    <div class="stat"><div class="v" style="color:#7c8cff">${winRate}%</div><div class="k">نسبة النجاح</div></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="v" style="color:#34d399;font-size:18px">+${avgGain}%</div><div class="k">متوسط ربح الرابح</div></div>
    <div class="stat"><div class="v" style="color:#f87171;font-size:18px">${avgLoss}%</div><div class="k">متوسط خسارة الخاسر</div></div>
    <div class="stat"><div class="v" style="color:#9aa4b8;font-size:18px">${neutral.length}</div><div class="k">بلا حسم</div></div>
  </div>
  <div class="tabs">
    <a class="tab ${view === "all" ? "on" : ""}" href="?view=all">الكل (${closed.length})</a>
    <a class="tab ${view === "wins" ? "on" : ""}" href="?view=wins">الرابحون (${wins.length})</a>
    <a class="tab ${view === "losses" ? "on" : ""}" href="?view=losses">الخاسرون (${losses.length})</a>
  </div>
  ${cards.some(c => c.isWin) ? `<button class="copyall" data-copy="${esc(allText)}">📋 نسخ إنجازات الرادار (الرابحون)</button>` : ""}
  ${cardsHtml || `<div class="empty">لا توجد نتائج في هذا العرض بعد.<br>تظهر بعد تشغيل التقييم (evaluate) على إشارات اليوم.</div>`}
  <div class="note">النتائج محسوبة من أعلى/أدنى سعر يوم الإشارة مقابل سعر الالتقاط ووقف الخسارة.<br>نعرض الرابح والخاسر بشفافية. الأداء السابق لا يضمن نتائج مستقبلية.</div>
<script>
  document.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.getAttribute("data-copy")); const t = b.textContent; b.textContent = "✅ تم النسخ"; setTimeout(() => b.textContent = t, 1500); }
    catch { alert("انسخ يدوياً:\\n\\n" + b.getAttribute("data-copy")); }
  }));
</script>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
    return res.status(200).send(html);
  } catch (e) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`<html dir="rtl"><body style="background:#0a0e1a;color:#e8edf6;font-family:sans-serif;padding:40px;text-align:center"><h2>تعذّر تحميل النتائج</h2><p style="color:#888">${esc(e.message)}</p></body></html>`);
  }
}
