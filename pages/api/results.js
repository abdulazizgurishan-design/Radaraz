// pages/api/results.js — التقرير الشامل المستقل (للاقتناع الذاتي + التصوير)
// ═══════════════════════════════════════════════════════════════════
//  يقرأ الإشارات المُقيّمة من Supabase ويحسب المحصلة الحقيقية:
//   • لو دخلت كل إشارة بـ$1000 → كم ربحت/خسرت (عند الإغلاق + عند أعلى سعر)
//   • نسبة الربح · Profit Factor · أبرز الرابحة · أكبر الخسائر · تحليل النوع
//  ?view=today | week | all   (افتراضي: all)
//  ?format=json   → JSON بدل HTML
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.RADARAZ_SUPABASE_KEY;

const PER_TRADE = 1000;

function etDate(d) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function fetchSignals() {
  const url = `${SUPABASE_URL}/rest/v1/signals?select=*&status=eq.CLOSED&order=created_at.desc&limit=2000`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

function compute(signals) {
  let netClose = 0, netMax = 0, wins = 0, losses = 0, flat = 0;
  let grossWin = 0, grossLoss = 0;
  for (const s of signals) {
    const cg = Number(s.close_gain_pct) || 0;
    const mg = Number(s.max_gain_pct) || 0;
    netClose += PER_TRADE * cg / 100;
    netMax   += PER_TRADE * mg / 100;
    if (cg > 0) { wins++; grossWin += PER_TRADE * cg / 100; }
    else if (cg < 0) { losses++; grossLoss += Math.abs(PER_TRADE * cg / 100); }
    else flat++;
  }
  const pf = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? 999 : 0);
  const sorted = [...signals].sort((a, b) => (Number(b.close_gain_pct) || 0) - (Number(a.close_gain_pct) || 0));
  const byType = (t) => {
    const arr = signals.filter(s => s.type === t);
    const w = arr.filter(s => (Number(s.close_gain_pct) || 0) > 0).length;
    return { n: arr.length, w, rate: arr.length ? Math.round(w / arr.length * 100) : 0 };
  };
  const hit = signals.filter(s => s.target1_hit || s.target2_hit || s.target3_hit).length;
  const pureStop = signals.filter(s => s.stop_hit && !s.target1_hit).length;
  const decided = hit + pureStop;
  return {
    count: signals.length, wins, losses, flat,
    winRate: (wins + losses) ? Math.round(wins / (wins + losses) * 100) : 0,
    targetRate: decided ? Math.round(hit / decided * 100) : 0,
    hit, pureStop, decided,
    netClose: Math.round(netClose), netMax: Math.round(netMax),
    profitFactor: +pf.toFixed(2),
    avgClose: signals.length ? +(signals.reduce((a, s) => a + (Number(s.close_gain_pct) || 0), 0) / signals.length).toFixed(2) : 0,
    top: sorted.filter(s => (Number(s.close_gain_pct) || 0) > 0).slice(0, 8),
    worst: sorted.filter(s => (Number(s.close_gain_pct) || 0) < 0).slice(-8).reverse(),
    scalp: byType("مضاربة"), invest: byType("استثمار"),
  };
}

function row(s) {
  const cg = Number(s.close_gain_pct) || 0;
  const mg = Number(s.max_gain_pct) || 0;
  const col = cg >= 0 ? "#34d399" : "#f87171";
  return '<tr><td style="font-weight:700">' + s.symbol + '</td>'
    + '<td style="color:' + col + ';font-family:monospace">' + (cg >= 0 ? "+" : "") + cg.toFixed(1) + '%</td>'
    + '<td style="color:#fbbf24;font-family:monospace">+' + mg.toFixed(1) + '%</td>'
    + '<td style="color:#64748b">' + (s.type || "") + '</td></tr>';
}

function html(r, view) {
  const label = view === "today" ? "اليوم" : view === "week" ? "آخر 7 أيام" : "كل الفترة";
  const netCol = r.netClose >= 0 ? "#34d399" : "#f87171";
  return '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">'
+ '<meta name="viewport" content="width=device-width,initial-scale=1">'
+ '<title>التقرير الشامل — RadarAZ</title><style>'
+ 'body{margin:0;background:#080c18;color:#e8edf6;font-family:system-ui,-apple-system,sans-serif;padding:16px}'
+ '.wrap{max-width:680px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}'
+ '.sub{color:#64748b;font-size:13px;margin-bottom:20px}'
+ '.grid{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}'
+ '.box{flex:1;min-width:140px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px;text-align:center}'
+ '.big{font-size:26px;font-weight:900;direction:ltr}.lbl{font-size:11px;color:#64748b;margin-top:6px}'
+ '.card{background:rgba(15,23,42,.5);border:1px solid rgba(99,102,241,.2);border-radius:16px;padding:18px;margin-bottom:16px}'
+ '.ctitle{font-size:14px;font-weight:800;margin-bottom:12px}'
+ 'table{width:100%;border-collapse:collapse;font-size:13px}'
+ 'td{padding:7px 6px;border-bottom:1px solid rgba(255,255,255,.05);text-align:right}'
+ '.note{font-size:11px;color:#475569;line-height:1.7;margin-top:18px;border-top:1px solid rgba(255,255,255,.06);padding-top:12px}'
+ '.tabs{display:flex;gap:8px;margin-bottom:18px}'
+ '.tab{padding:8px 16px;border-radius:10px;font-size:13px;text-decoration:none;color:#94a3b8;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}'
+ '.tab.on{background:rgba(52,211,153,.2);color:#34d399;border-color:rgba(52,211,153,.4)}'
+ '</style></head><body><div class="wrap">'
+ '<h1>📋 التقرير الشامل</h1>'
+ '<div class="sub">لو دخلت كل إشارة بـ$' + PER_TRADE + ' · ' + label + ' · ' + r.count + ' إشارة مُقيّمة</div>'
+ '<div class="tabs">'
+ '<a class="tab ' + (view === "today" ? "on" : "") + '" href="?view=today">اليوم</a>'
+ '<a class="tab ' + (view === "week" ? "on" : "") + '" href="?view=week">7 أيام</a>'
+ '<a class="tab ' + (view === "all" ? "on" : "") + '" href="?view=all">الكل</a>'
+ '</div>'
+ '<div class="grid">'
+ '<div class="box"><div class="big" style="color:' + netCol + '">' + (r.netClose >= 0 ? "+" : "") + r.netClose.toLocaleString() + '$</div><div class="lbl">المحصلة عند الإغلاق</div></div>'
+ '<div class="box"><div class="big" style="color:#fbbf24">' + (r.netMax >= 0 ? "+" : "") + r.netMax.toLocaleString() + '$</div><div class="lbl">لو خرجت عند أعلى سعر</div></div>'
+ '</div>'
+ '<div class="grid">'
+ '<div class="box"><div class="big" style="color:#a5b4fc">' + r.winRate + '%</div><div class="lbl">نسبة الربح (إغلاق)</div></div>'
+ '<div class="box"><div class="big" style="color:' + (r.profitFactor >= 1 ? "#34d399" : "#f87171") + '">' + r.profitFactor + '</div><div class="lbl">Profit Factor</div></div>'
+ '<div class="box"><div class="big" style="color:' + (r.avgClose >= 0 ? "#34d399" : "#f87171") + '">' + (r.avgClose >= 0 ? "+" : "") + r.avgClose + '%</div><div class="lbl">متوسط الإغلاق</div></div>'
+ '</div>'
+ '<div class="card"><div class="ctitle" style="color:#34d399">🏆 أبرز الرابحة</div>'
+ '<table><tr><td>السهم</td><td>الإغلاق</td><td>أعلى سعر</td><td>النوع</td></tr>' + r.top.map(row).join("") + '</table></div>'
+ '<div class="card"><div class="ctitle" style="color:#f87171">🔻 أكبر الخسائر (مين أكل الأرباح)</div>'
+ '<table><tr><td>السهم</td><td>الإغلاق</td><td>أعلى سعر</td><td>النوع</td></tr>' + r.worst.map(row).join("") + '</table></div>'
+ '<div class="card"><div class="ctitle">📊 تحليل حسب النوع</div><table>'
+ '<tr><td>⚡ مضاربة</td><td>' + r.scalp.w + '/' + r.scalp.n + ' رابح</td><td style="color:#a5b4fc">' + r.scalp.rate + '%</td></tr>'
+ '<tr><td>📈 استثمار</td><td>' + r.invest.w + '/' + r.invest.n + ' رابح</td><td style="color:#a5b4fc">' + r.invest.rate + '%</td></tr>'
+ '</table></div>'
+ '<div class="note">💡 المحصلة "عند الإغلاق" = لو احتفظت بالسهم حتى نهاية اليوم. "عند أعلى سعر" = لو خرجت عند القمة. الفرق الكبير بينهما يعني الإشارات تصعد فعلاً، لكن التوقيت/الوقف يحدّد ربحك الحقيقي.<br><br>📊 الأرقام مبنية على إشارات مُقيّمة فعلياً بعد إغلاق السوق. ليست نصيحة استثمارية.</div>'
+ '</div></body></html>';
}

export default async function handler(req, res) {
  try {
    const view = ["today", "week", "all"].includes(req.query.view) ? req.query.view : "all";
    const all = await fetchSignals();
    const today = etDate(Date.now());
    const weekAgo = etDate(Date.now() - 7 * 86400000);
    const filtered = all.filter(s => {
      const d = s.signal_date || etDate(s.created_at);
      if (view === "today") return d === today;
      if (view === "week")  return d >= weekAgo;
      return true;
    });
    const report = compute(filtered);
    if (req.query.format === "json") {
      return res.status(200).json({ view, ...report });
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html(report, view));
  } catch (e) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send('<html dir="rtl"><body style="background:#080c18;color:#f87171;font-family:system-ui;padding:40px;text-align:center">تعذّر توليد التقرير: ' + e.message + '</body></html>');
  }
}
