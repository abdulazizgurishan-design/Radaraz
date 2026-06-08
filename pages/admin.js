import { useState, useEffect } from "react";

const ADMIN_KEY = "radaraz_admin_2025";

export default function Admin() {
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState("");
  const [summary, setSummary] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [activeTab, setActiveTab] = useState("signals");
  const [date, setDate] = useState("");

  const login = () => {
    if (pass === ADMIN_KEY) setAuth(true);
  };

  useEffect(() => {
    if (auth) {
      const today = new Date();
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const formatted = today.toLocaleDateString('en-US', options);
      setDate(formatted);
      
      fetchSummary();
      fetchSignals();
    }
  }, [auth]);

  const fetchSignals = async () => {
    try {
      const res = await fetch("/api/scan");
      const data = await res.json();
      setSignals(data.results || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/summary");
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const getResult = (s) => {
    if (s.status === "OPEN") return null;
    if (s.target3_hit) return { icon: "🏆", label: "وصل T3", pct: s.max_gain_pct, price: s.levels?.t3 };
    if (s.target2_hit) return { icon: "🎯", label: "وصل T2", pct: s.max_gain_pct, price: s.levels?.t2 };
    if (s.target1_hit) return { icon: "✅", label: "وصل T1", pct: s.max_gain_pct, price: s.levels?.t1 };
    if (s.stop_hit) return { icon: "❌", label: "ضرب الوقف", pct: s.close_gain_pct, price: s.stop_loss };
    return { icon: "⏳", label: "لم يصل هدف", pct: s.close_gain_pct, price: s.close_price };
  };

  const buildTweet = () => {
    if (!summary) return "";
    const lines = [`📊 ملخص رادار الأسهم — ${date}\n`];
    (summary.signals || []).forEach(s => {
      const r = getResult(s);
      const icon = r ? r.icon : "📡";
      const result = r
        ? `${r.label} ${r.pct != null ? (r.pct >= 0 ? `+${r.pct}%` : `${r.pct}%`) : ""}`
        : `دخل $${s.entry_price}`;
      lines.push(`${icon} ${s.symbol} (${s.score}) — دخل $${s.entry_price} | ${result}`);
    });
    lines.push(`\n🔗 radaraz.com`);
    return lines.join("\n");
  };

  const copyText = (text, id) => {
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
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const buildSignalText = (s) => {
    const r = getResult(s);
    const targets = `T1: $${s.target1} | T2: $${s.target2} | T3: $${s.target3} | وقف: $${s.stop_loss}`;
    const result = r ? `${r.icon} ${r.label} ${r.pct != null ? (r.pct >= 0 ? `+${r.pct}%` : `${r.pct}%`) : ""}` : "⏳ مفتوحة";
    return `📡 ${s.symbol} (${s.score})\nدخل: $${s.entry_price}\n${targets}\nالنتيجة: ${result}\n\nradaraz.com`;
  };

  const formatPrice = (n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const S = {
    root: { minHeight: "100vh", background: "#080c18", color: "#fff", fontFamily: "system-ui", padding: 24 },
    box: { maxWidth: 600, margin: "0 auto" },
    title: { fontSize: 22, fontWeight: 900, marginBottom: 24, color: "#6366f1" },
    input: { width: "100%", padding: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 15, marginBottom: 12, boxSizing: "border-box" },
    btn: (color) => ({ padding: "12px 24px", background: color || "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }),
    card: (color) => ({ background: "rgba(255,255,255,0.04)", border: `1px solid ${color || "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }),
    tabs: { display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.1)" },
    tabActive: { padding: "12px 24px", background: "transparent", border: "none", borderBottom: "3px solid #6366f1", color: "#6366f1", fontWeight: 700, cursor: "pointer", fontSize: 14 },
    tabInactive: { padding: "12px 24px", background: "transparent", border: "none", borderBottom: "3px solid transparent", color: "rgba(255,255,255,0.5)", fontWeight: 700, cursor: "pointer", fontSize: 14 },
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
          <div style={S.title}>📊 لوحة التحكم</div>
          <button style={S.btn()} onClick={() => { fetchSummary(); fetchSignals(); }}>🔄 تحديث</button>
        </div>

        {/* TABS */}
        <div style={S.tabs}>
          <button 
            style={activeTab === "signals" ? S.tabActive : S.tabInactive}
            onClick={() => setActiveTab("signals")}
          >
            📡 الإشارات
          </button>
          <button 
            style={activeTab === "results" ? S.tabActive : S.tabInactive}
            onClick={() => setActiveTab("results")}
          >
            📊 النتائج
          </button>
        </div>

        {/* TAB 1: SIGNALS */}
        {activeTab === "signals" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: "إشارات", value: signals.length, color: "#6366f1" },
                { label: "قيادي", value: signals.filter(s => s.type === "قيادي").length, color: "#818cf8" },
                { label: "مضاربة", value: signals.filter(s => s.type === "مضاربة").length, color: "#f87171" },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, minWidth: 70, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {signals.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>
                لا توجد إشارات اليوم بعد — انتظر المسح الأوتوماتيكي
              </div>
            ) : (
              signals.map((s, idx) => (
                <div key={s.symbol} style={S.card("rgba(255,255,255,0.08)")}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>📡</span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 16 }}>{s.symbol}</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>({s.score})</span>
                    </div>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>دخل <span style={{ color: "#fff", fontFamily: "monospace" }}>${s.entry_price}</span></span>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {[
                      { label: "T1", price: s.levels.t1, pct: s.levels.t1Pct, color: "#60a5fa" },
                      { label: "T2", price: s.levels.t2, pct: s.levels.t2Pct, color: "#34d399" },
                      { label: "T3", price: s.levels.t3, pct: s.levels.t3Pct, color: "#fbbf24" },
                      { label: "وقف", price: s.stop_loss, pct: s.levels.slPct, color: "#ff4757" },
                    ].map(t => (
                      <div key={t.label} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${t.color}40`, borderRadius: 8, padding: "4px 10px", fontSize: 11 }}>
                        <span style={{ color: t.color, fontWeight: 600 }}>{t.label}</span>
                        <span style={{ color: "#fff", fontFamily: "monospace", marginRight: 4 }}> ${t.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* TAB 2: RESULTS */}
        {activeTab === "results" && (
          <>
            {loading && <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)" }}>جاري التحميل...</div>}

            {summary && (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  {[
                    { label: "T1", value: summary.t1 || 0, color: "#60a5fa" },
                    { label: "T2", value: summary.t2 || 0, color: "#34d399" },
                    { label: "T3", value: summary.t3 || 0, color: "#fbbf24" },
                    { label: "وقف", value: summary.stops || 0, color: "#ff4757" },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, minWidth: 70, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {(summary.signals || []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>
                    انتظر التقييم...
                  </div>
                ) : (
                  (summary.signals || []).map(s => {
                    const r = getResult(s);
                    return (
                      <div key={s.id} style={S.card(r?.icon === "🏆" ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.08)")}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{r ? r.icon : "📡"}</span>
                            <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 16 }}>{s.symbol}</span>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>({s.score})</span>
                          </div>
                          <button
                            onClick={() => copyText(buildSignalText(s), s.id)}
                            style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6, padding: "4px 10px", color: "#a5b4fc", fontSize: 11, cursor: "pointer" }}
                          >
                            {copiedId === s.id ? "✅ تم" : "نسخ 📋"}
                          </button>
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
                          {r ? `${r.label} ${r.pct != null ? (r.pct >= 0 ? `+${r.pct}%` : `${r.pct}%`) : ""}` : "⏳ مفتوحة"}
                        </div>
                      </div>
                    );
                  })
                )}

                {(summary.signals || []).length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <button style={S.btn("linear-gradient(135deg,#1da1f2,#0d8ecf)")} onClick={() => copyText(buildTweet(), null)}>
                      {copied ? "✅ تم النسخ!" : "🐦 نسخ الكل للتغريد"}
                    </button>
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 16, marginTop: 16, whiteSpace: "pre-wrap", fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.8 }}>
                      {buildTweet()}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
