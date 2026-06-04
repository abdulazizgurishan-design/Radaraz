import { useState, useEffect } from "react";

const ADMIN_KEY = "radaraz_admin_2025";

export default function Admin() {
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const login = () => {
    if (pass === ADMIN_KEY) setAuth(true);
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/summary");
      const data = await res.json();
      setSummary(data);
    } catch { }
    setLoading(false);
  };

  useEffect(() => {
    if (auth) fetchSummary();
  }, [auth]);

  const buildTweet = () => {
    if (!summary) return "";
    const date = new Date().toLocaleDateString("ar-SA");
    const lines = [`📊 ملخص رادار الأسهم — ${date}\n`];
    (summary.signals || []).forEach(s => {
      const icon = s.stop_hit ? "❌" : s.target2_hit ? "🎯" : s.target1_hit ? "✅" : "⏳";
      const result = s.stop_hit
        ? `ضرب الوقف (${s.close_gain_pct}%)`
        : s.target2_hit
        ? `وصل T2 (+${s.max_gain_pct}%)`
        : s.target1_hit
        ? `وصل T1 (+${s.max_gain_pct}%)`
        : `لم يصل هدف (${s.close_gain_pct ?? "—"}%)`;
      lines.push(`${icon} ${s.symbol} — ${result}`);
    });
    lines.push(`\n🔗 radaraz.com`);
    return lines.join("\n");
  };

  const copyTweet = () => {
    const text = buildTweet();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch { }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const S = {
    root: { minHeight: "100vh", background: "#080c18", color: "#fff", fontFamily: "system-ui", padding: 24 },
    box: { maxWidth: 600, margin: "0 auto" },
    title: { fontSize: 22, fontWeight: 900, marginBottom: 24, color: "#6366f1" },
    input: { width: "100%", padding: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 15, marginBottom: 12, boxSizing: "border-box" },
    btn: (color) => ({ padding: "12px 24px", background: color || "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }),
    card: (color) => ({ background: "rgba(255,255,255,0.04)", border: `1px solid ${color || "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }),
    tweetBox: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 16, marginTop: 16, whiteSpace: "pre-wrap", fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.8 },
  };

  if (!auth) return (
    <div style={S.root}>
      <div style={{ ...S.box, maxWidth: 360, paddingTop: 80, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
        <div style={S.title}>Admin Panel</div>
        <input style={S.input} type="password" placeholder="كلمة المرور" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        <button style={S.btn()} onClick={login}>دخول</button>
      </div>
    </div>
  );

  return (
    <div style={S.root} dir="rtl">
      <div style={S.box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={S.title}>📊 ملخص اليوم</div>
          <button style={S.btn()} onClick={fetchSummary}>🔄 تحديث</button>
        </div>

        {loading && <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)" }}>جاري التحميل...</div>}

        {summary && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: "إشارات", value: summary.total || 0, color: "#6366f1" },
                { label: "✅ T1", value: summary.t1 || 0, color: "#00d4aa" },
                { label: "🎯 T2", value: summary.t2 || 0, color: "#60a5fa" },
                { label: "❌ وقف", value: summary.stops || 0, color: "#ff4757" },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, minWidth: 80, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {(summary.signals || []).length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>
                لا توجد إشارات اليوم بعد — انتظر المسح الأوتوماتيكي
              </div>
            )}

            {(summary.signals || []).map(s => {
              const icon = s.stop_hit ? "❌" : s.target2_hit ? "🎯" : s.target1_hit ? "✅" : "⏳";
              const borderColor = s.stop_hit ? "rgba(255,71,87,0.3)" : s.target1_hit ? "rgba(0,212,170,0.3)" : "rgba(255,255,255,0.08)";
              return (
                <div key={s.id} style={S.card(borderColor)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontFamily: "monospace" }}>{s.symbol}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>دخل ${s.entry_price}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: (s.close_gain_pct || 0) >= 0 ? "#00d4aa" : "#ff4757", fontFamily: "monospace" }}>
                      {(s.close_gain_pct || 0) >= 0 ? "+" : ""}{s.close_gain_pct ?? "—"}%
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>max: +{s.max_gain_pct ?? "—"}%</div>
                  </div>
                </div>
              );
            })}

            <div style={{ marginTop: 20 }}>
              <button style={S.btn("linear-gradient(135deg,#1da1f2,#0d8ecf)")} onClick={copyTweet}>
                {copied ? "✅ تم النسخ!" : "🐦 نسخ للتغريد"}
              </button>
              <div style={S.tweetBox}>{buildTweet()}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
