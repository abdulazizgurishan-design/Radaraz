// pages/backtest.js — لوحة الباك-تيست البصرية (تقرأ /api/backtest)
// صفحة مستقلة لا تلمس admin.js. افتحها على /backtest
import { useState, useEffect, useCallback } from "react";

const C = {
  bg: "#080c18", card: "rgba(20,26,44,0.6)", border: "rgba(120,140,255,0.14)",
  ink: "#eaf0ff", sub: "rgba(210,220,255,0.5)", faint: "rgba(210,220,255,0.3)",
  green: "#34d399", red: "#f43f5e", amber: "#fbbf24", blue: "#60a5fa", iris: "#7c6cff",
};

const fmtPct = (v) => (v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(1) + "%");
const fmtNum = (v) => (v == null ? "—" : v);

function Stat({ label, value, color, sub }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || C.ink, fontFamily: "ui-monospace, monospace", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// شريط أفقي بسيط للنِسب (بلا مكتبات)
function Bar({ pct, color }) {
  const w = Math.max(0, Math.min(100, pct || 0));
  return (
    <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.6s" }} />
    </div>
  );
}

function BreakdownTable({ title, data, subtitle }) {
  if (!data || Object.keys(data).length === 0) return null;
  const rows = Object.entries(data)
    .map(([k, v]) => ({ key: k, ...v }))
    .filter((r) => r.total > 0)
    .sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1));

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: C.faint, marginBottom: 12 }}>{subtitle}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => {
          const wr = r.winRate;
          const color = wr == null ? C.faint : wr >= 55 ? C.green : wr >= 45 ? C.amber : C.red;
          return (
            <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 96, fontSize: 12, color: C.ink, fontWeight: 600 }}>{r.key}</div>
              <div style={{ width: 44, fontSize: 13, fontWeight: 800, color, fontFamily: "monospace", textAlign: "right" }}>
                {wr == null ? "—" : wr.toFixed(0) + "%"}
              </div>
              <Bar pct={wr} color={color} />
              <div style={{ width: 108, fontSize: 10.5, color: C.sub, textAlign: "right", fontFamily: "monospace" }}>
                {r.decided}✓ / {r.total} · {fmtPct(r.avgReturnPct)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BacktestPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [days, setDays] = useState(0); // 0 = الكل

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const url = days > 0 ? `/api/backtest?days=${days}` : "/api/backtest";
      const res = await fetch(url);
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setData(j);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const ov = data?.overall;
  // علم أمان التسويق: عيّنة كافية + نجاح جيّد + عائد موجب
  const safe = ov && ov.decided >= 30 && (ov.winRate ?? 0) >= 50 && (ov.avgReturnPct ?? -1) > 0;

  const ranges = [
    { v: 0, label: "الكل" },
    { v: 30, label: "٣٠ يوم" },
    { v: 14, label: "١٤ يوم" },
    { v: 7, label: "٧ أيام" },
  ];

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: `radial-gradient(1200px 600px at 50% -10%, #0b0f1e, #070912)`, color: C.ink, fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>📊 الباك-تيست</div>
            <div style={{ fontSize: 12, color: C.sub }}>أداء التوصيات على البيانات المقيّمة</div>
          </div>
          <button onClick={load} disabled={loading} style={{ background: `linear-gradient(135deg, ${C.iris}, #a78bfa)`, border: "none", borderRadius: 12, padding: "10px 18px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {loading ? "⟳ تحديث…" : "🔄 تحديث"}
          </button>
        </div>

        {/* range selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {ranges.map((r) => (
            <button key={r.v} onClick={() => setDays(r.v)} style={{
              background: days === r.v ? "rgba(124,108,255,0.3)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${days === r.v ? "rgba(124,108,255,0.5)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 10, padding: "8px 16px", color: days === r.v ? "#c4b5fd" : C.sub,
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>{r.label}</button>
          ))}
        </div>

        {err && (
          <div style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 12, padding: 16, color: C.red, marginBottom: 16 }}>
            خطأ: {err}
          </div>
        )}

        {loading && !data && (
          <div style={{ textAlign: "center", padding: 60, color: C.sub }}>⟳ جاري التحميل…</div>
        )}

        {ov && (
          <>
            {/* علم أمان التسويق */}
            <div style={{
              background: safe ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)",
              border: `1px solid ${safe ? "rgba(52,211,153,0.4)" : "rgba(251,191,36,0.4)"}`,
              borderRadius: 14, padding: "14px 18px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 24 }}>{safe ? "✅" : "⛔"}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: safe ? C.green : C.amber }}>
                  {safe ? "آمن للنشر التسويقي" : "غير آمن للتسويق بعد"}
                </div>
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>
                  {safe
                    ? "عيّنة كافية + نجاح ≥٥٠٪ + عائد موجب. يمكنك النشر بثقة."
                    : `يشترط: ٣٠+ صفقة محسومة، نجاح ≥٥٠٪، عائد موجب. الحالي: ${ov.decided} محسومة · نجاح ${fmtNum(ov.winRate)}% · عائد ${fmtPct(ov.avgReturnPct)}.`}
                </div>
              </div>
            </div>

            {/* المقاييس الرئيسية */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <Stat label="نسبة النجاح" value={ov.winRate == null ? "—" : ov.winRate + "%"}
                color={ov.winRate >= 55 ? C.green : ov.winRate >= 45 ? C.amber : C.red}
                sub={`${ov.decided} صفقة محسومة`} />
              <Stat label="Profit Factor" value={ov.profitFactor == null ? "—" : ov.profitFactor}
                color={ov.profitFactor >= 1.5 ? C.green : ov.profitFactor >= 1 ? C.amber : C.red}
                sub="ربح ÷ خسارة" />
              <Stat label="متوسط العائد" value={fmtPct(ov.avgReturnPct)}
                color={(ov.avgReturnPct ?? 0) > 0 ? C.green : C.red} sub="لكل صفقة" />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
              <Stat label="رابحة" value={ov.wins} color={C.green} />
              <Stat label="خاسرة" value={ov.losses} color={C.red} />
              <Stat label="ملتبسة" value={ov.ambiguous} color={C.amber} sub="هدف + وقف" />
              <Stat label="معلّقة" value={ov.pending} color={C.faint} sub="لم تنضج بعد" />
            </div>

            {/* توزيع الأهداف */}
            {ov.targets && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>🎯 توزيع الأهداف</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Stat label="الهدف ١" value={ov.targets.t1} color={C.green} />
                  <Stat label="الهدف ٢" value={ov.targets.t2} color={C.green} />
                  <Stat label="الهدف ٣" value={ov.targets.t3} color={C.green} />
                  <Stat label="الوقف" value={ov.targets.stops} color={C.red} />
                </div>
              </div>
            )}

            {/* التقسيمات */}
            <BreakdownTable title="🔀 حسب نوع الإشارة" data={data.byType}
              subtitle="اختراق / رصد مبكر / ارتداد — مرتّبة بالأفضل" />
            <BreakdownTable title="⭐ حسب الدرجة" data={data.byScore}
              subtitle="شرائح ep/score" />
            <BreakdownTable title="💰 حسب فئة السعر" data={data.byPrice}
              subtitle="سنتي / ١-١٠$ / ١٠-٥٠$ / ٥٠+$" />
            <BreakdownTable title="🕐 حسب الساعة (نيويورك)" data={data.byHour}
              subtitle="أي ساعات التداول أنجح" />

            {/* meta */}
            {data.meta && (
              <div style={{ fontSize: 10.5, color: C.faint, marginTop: 8, lineHeight: 1.7 }}>
                المصدر: {data.meta.source} · صفقات فريدة: {data.meta.uniqueTrades} · النطاق: {data.meta.range?.from} → {data.meta.range?.to} · {data.meta.duration}
                <br />التعريف: {data.meta.definition}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
