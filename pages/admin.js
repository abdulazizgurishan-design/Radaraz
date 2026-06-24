// pages/admin.js — RadarAZ Admin Panel v4 (results: Saudi-time + win/loss filter + copyable report)
import { useState, useEffect } from "react";

const ADMIN_KEY = "123451";

// ─── EP helpers ──────────────────────────────────────────────────
function epColor(ep) {
  if (ep >= 85) return { fg: "#f87171", bg: "rgba(248,113,113,.12)", ring: "rgba(248,113,113,.35)" };
  if (ep >= 70) return { fg: "#fb923c", bg: "rgba(251,146,60,.10)",  ring: "rgba(251,146,60,.28)"  };
  if (ep >= 55) return { fg: "#fbbf24", bg: "rgba(251,191,36,.10)",  ring: "rgba(251,191,36,.28)"  };
  if (ep >= 40) return { fg: "#34d399", bg: "rgba(52,211,153,.10)",  ring: "rgba(52,211,153,.28)"  };
  return          { fg: "#475569", bg: "rgba(71,85,105,.08)",         ring: "rgba(71,85,105,.20)"   };
}

function EPGauge({ ep }) {
  if (!ep) return null;
  const { fg, ring } = epColor(ep);
  const r = 22, dash = 2 * Math.PI * r, fill = dash * (1 - ep / 100);
  return (
    <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
      <svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={fg} strokeWidth="5"
          strokeDasharray={dash} strokeDashoffset={fill} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${ring})` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: fg, lineHeight: 1 }}>{ep}%</div>
        <div style={{ fontSize: 8, color: "#334155", marginTop: 1 }}>EP</div>
      </div>
    </div>
  );
}

function HotBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
      background: "rgba(248,113,113,.18)", color: "#fca5a5",
      border: "1px solid rgba(248,113,113,.35)", letterSpacing: "1px",
      animation: "hotpulse 1.5s ease-in-out infinite",
    }}>🚨 HOT</span>
  );
}

function EPBadge({ ep }) {
  if (!ep) return null;
  const { fg, bg, ring } = epColor(ep);
  const label = ep >= 85 ? "EXTREME" : ep >= 70 ? "HIGH" : ep >= 55 ? "MED" : ep >= 40 ? "LOW" : "WATCH";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: bg, color: fg, border: `1px solid ${ring}`, letterSpacing: "0.7px" }}>
      {label}
    </span>
  );
}

// ─── الوقت بتوقيت السعودية (UTC+3) ───────────────────────────────
function astStr(iso) {
  if (!iso) return null;
  const d = new Date(new Date(iso).getTime() + 3 * 3600 * 1000);
  if (isNaN(d)) return null;
  const p = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// ─── Tweet builder ────────────────────────────────────────────────
function buildTweet(signals, date, mode = "signals") {
  const lines = [`📡 رادار الأسهم — ${date}\n`];
  if (mode === "results") {
    const t1 = signals.filter(s => s.target1_hit).length;
    const t2 = signals.filter(s => s.target2_hit).length;
    const t3 = signals.filter(s => s.target3_hit).length;
    const st = signals.filter(s => s.stop_hit).length;
    const hit = signals.filter(s => s.target1_hit || s.target2_hit || s.target3_hit).length;
    const decided = hit + st;                                   // المحسوم = رابح + خاسر (نستبعد المحايد)
    const rate = decided ? Math.round((hit / decided) * 100) : 0;

    // 🏆 أبرز الارتفاعات (أعلى max_gain) — الأقوى تسويقياً
    const topGainers = [...signals]
      .filter(s => (s.max_gain_pct || 0) > 0)
      .sort((a, b) => (b.max_gain_pct || 0) - (a.max_gain_pct || 0))
      .slice(0, 4);

    lines.push(`🎯 أبرز ارتفاعات اليوم:\n`);
    topGainers.forEach(s => {
      const icon = s.type === "استثمار" ? "📈" : "⚡";
      const g = (s.max_gain_pct || 0).toFixed(1);
      const caught = astStr(s.created_at);
      const hitAt = astStr(s.target1_hit_at);
      lines.push(`${icon} $${s.symbol} +${g}%`);
      if (caught) lines.push(`   رُصد: ${caught}`);
      if (hitAt)  lines.push(`   أصاب الهدف: ${hitAt}`);
    });
    lines.push(`\n✅ ${hit} رابح من ${decided} محسوم · نسبة نجاح ${rate}% 🔥`);
  } else {
    signals.slice(0, 8).forEach(s => {
      const hot = s.is_hot ? " 🚨" : "";
      const early = s.early_watch ? " 🔍" : "";
      const chg = s.change_pct != null ? ` ${s.change_pct >= 0 ? "+" : ""}${Math.round(parseFloat(s.change_pct))}%${s.change_pct >= 0 ? "▲" : "▼"}` : "";
      const ma = s.ma_signal ? ` · ${s.ma_signal}` : "";
      lines.push(`📡 $${s.symbol}${hot}${early} (EP: ${s.ep || s.score}%)${chg}${ma}`);
      lines.push(`  دخل: $${(s.entry_price || 0).toFixed(2)}`);
      lines.push(`  🎯 T1: $${(s.target1 || 0).toFixed(2)} | T2: $${(s.target2 || 0).toFixed(2)} | T3: $${(s.target3 || 0).toFixed(2)}`);
      lines.push(`  🛑 وقف: $${(s.stop_loss || 0).toFixed(2)}\n`);
    });
  }
  lines.push(`\n🔗 radaraz.com`);
  return lines.join("\n");
}

function getResult(s) {
  if (s?.status === "OPEN") return null;
  if (s?.target3_hit) return { icon: "🏆", label: "وصل T3", pct: s?.max_gain_pct };
  if (s?.target2_hit) return { icon: "🎯", label: "وصل T2", pct: s?.max_gain_pct };
  if (s?.target1_hit) return { icon: "✅", label: "وصل T1", pct: s?.max_gain_pct };
  if (s?.stop_hit)    return { icon: "❌", label: "ضرب الوقف", pct: s?.close_gain_pct };
  return { icon: "⏳", label: "لم يصل هدف", pct: s?.close_gain_pct };
}

// ─── Tweet Modal ──────────────────────────────────────────────────
function TweetModal({ text, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "#0f172a", border: "1px solid rgba(99,102,241,.35)", borderRadius: 18, padding: 24, maxWidth: 500, width: "100%" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#818cf8" }}>🐦 معاينة التغريدة</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <textarea readOnly value={text} style={{ width: "100%", minHeight: 240, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#e2e8f0", fontSize: 13, lineHeight: 1.7, padding: "12px 14px", resize: "vertical", fontFamily: "monospace", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={copy} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "rgba(99,102,241,.18)", color: "#818cf8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {copied ? "✅ تم النسخ!" : "📋 نسخ"}
          </button>
          <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank")} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "rgba(29,161,242,.18)", color: "#60a5fa", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🐦 فتح Twitter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Scan Status Toast ────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const ok = type === "ok";
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 999,
      padding: "10px 22px", borderRadius: 12, fontWeight: 700, fontSize: 13,
      background: ok ? "rgba(52,211,153,.15)" : "rgba(248,113,113,.15)",
      border: `1px solid ${ok ? "rgba(52,211,153,.35)" : "rgba(248,113,113,.35)"}`,
      color: ok ? "#34d399" : "#f87171",
      boxShadow: "0 8px 32px rgba(0,0,0,.5)",
      animation: "fadeup .3s ease",
      whiteSpace: "nowrap",
    }}>{msg}</div>
  );
}

// ─── Signal Card ──────────────────────────────────────────────────
function SignalCard({ s, copiedId, onCopy, selectMode, selected, onToggle }) {
  const ep  = s.ep || s.score || 0;
  const hot = s.is_hot;
  const epc = epColor(ep);

  const text = `📡 $${s.symbol} — EP ${ep}%\nدخل: $${(s.entry_price||0).toFixed(2)}\nT1: $${(s.target1||0).toFixed(2)} | T2: $${(s.target2||0).toFixed(2)} | T3: $${(s.target3||0).toFixed(2)}\n🛑 وقف: $${(s.stop_loss||0).toFixed(2)}\n\nradaraz.com`;

  return (
    <div
      onClick={selectMode ? onToggle : undefined}
      style={{
        background: hot ? "linear-gradient(135deg,rgba(11,14,31,1),rgba(20,8,8,1))" : "rgba(255,255,255,.03)",
        border: `1px solid ${selectMode && selected ? "#6366f1" : hot ? "rgba(248,113,113,.45)" : "rgba(255,255,255,.08)"}`,
        borderRadius: 14, padding: "14px 16px", marginBottom: 10, position: "relative",
        boxShadow: selectMode && selected ? "0 0 0 2px rgba(99,102,241,.4)" : hot ? "0 0 20px rgba(248,113,113,.12)" : "none",
        cursor: selectMode ? "pointer" : "default",
        transition: "border .15s, box-shadow .15s",
      }}>
      {/* top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "14px 14px 0 0", background: `linear-gradient(90deg,${epc.fg}88,transparent)` }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        {/* Left: checkbox + ticker + badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {selectMode && (
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              border: `2px solid ${selected ? "#6366f1" : "rgba(255,255,255,.2)"}`,
              background: selected ? "#6366f1" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, color: "#fff", fontWeight: 800,
            }}>{selected ? "✓" : ""}</div>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: "#f1f5f9", fontFamily: "monospace" }}>${s.symbol}</span>
              {s.early_watch && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
                  background: "linear-gradient(135deg,rgba(16,185,129,0.25),rgba(5,150,105,0.18))",
                  color: "#34d399", border: "1px solid rgba(52,211,153,0.5)", letterSpacing: "0.5px" }}>
                  🔍 رصد مبكر
                </span>
              )}
              {hot && <HotBadge />}
              <EPBadge ep={ep} />
              {s.type && (
                <span style={{ fontSize: 11, color: "#475569" }}>{s.type}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                دخل: <strong style={{ color: "#60a5fa", fontFamily: "monospace", direction: "ltr", unicodeBidi: "isolate", display: "inline-block" }}>${(s.entry_price || 0).toFixed(2)}</strong>
              </span>
              {s.change_pct != null && (
                <span style={{ fontSize: 11, fontWeight: 700, color: (s.change_pct || 0) >= 0 ? "#34d399" : "#f87171", fontFamily: "monospace", direction: "ltr", unicodeBidi: "isolate", display: "inline-block" }}>
                  {((s.change_pct || 0) >= 0 ? "+" : "") + Math.round(parseFloat(s.change_pct)) + "% " + ((s.change_pct || 0) >= 0 ? "▲" : "▼")}
                </span>
              )}
              {s.rvol != null && (
                <span style={{ fontSize: 11, color: (s.rvol || 0) >= 3 ? "#fbbf24" : "#475569", direction: "ltr", unicodeBidi: "isolate", display: "inline-block" }}>
                  {`RVOL: ${parseFloat(s.rvol).toFixed(1)}x`}
                </span>
              )}
              {s.ma_signal && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 12,
                  background: s.ma_signal.includes("ذهبي") ? "rgba(251,191,36,0.12)" : "rgba(52,211,153,0.12)",
                  color: s.ma_signal.includes("ذهبي") ? "#fbbf24" : "#34d399",
                  border: `1px solid ${s.ma_signal.includes("ذهبي") ? "rgba(251,191,36,0.3)" : "rgba(52,211,153,0.3)"}` }}>
                  📈 {s.ma_signal}
                </span>
              )}
              {s.rsi != null && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 12, direction: "ltr", unicodeBidi: "isolate", display: "inline-block",
                  background: s.rsi >= 72 ? "rgba(248,113,113,0.12)" : (s.rsi >= 50 && s.rsi <= 65) ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.1)",
                  color: s.rsi >= 72 ? "#f87171" : (s.rsi >= 50 && s.rsi <= 65) ? "#34d399" : "#94a3b8",
                  border: `1px solid ${s.rsi >= 72 ? "rgba(248,113,113,0.3)" : (s.rsi >= 50 && s.rsi <= 65) ? "rgba(52,211,153,0.3)" : "rgba(148,163,184,0.25)"}` }}>
                  {`📊 RSI ${s.rsi}`}
                </span>
              )}
              {s.news_age_hours != null && (
                <span style={{ fontSize: 11, color: "#fbbf24" }}>
                  📰 {Math.round(s.news_age_hours)}h
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <EPGauge ep={ep} />
          {!selectMode && (
            <button onClick={() => onCopy(text, s.id)} style={{
              background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.25)",
              borderRadius: 8, padding: "5px 11px", color: "#a5b4fc", fontSize: 11, cursor: "pointer", fontWeight: 600,
            }}>
              {copiedId === s.id ? "✅" : "📋"}
            </button>
          )}
        </div>
      </div>

      {/* Targets row */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {[
          { label: "T1", price: s.target1, color: "#34d399" },
          { label: "T2", price: s.target2, color: "#fbbf24" },
          { label: "T3", price: s.target3, color: "#c084fc" },
          { label: "وقف", price: s.stop_loss, color: "#f87171" },
        ].map(t => (
          <div key={t.label} style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${t.color}30`, borderRadius: 8, padding: "4px 10px", fontSize: 11 }}>
            <span style={{ color: t.color, fontWeight: 700 }}>{t.label}</span>
            <span style={{ color: "#e2e8f0", fontFamily: "monospace", marginRight: 5 }}> ${(t.price || 0).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Result Card (مع أوقات السعودية + تقرير مفصّل قابل للنسخ) ──────
function ResultCard({ s, copiedId, onCopy }) {
  const r   = getResult(s);
  const ep  = s.ep || s.score || 0;
  const won = s.target1_hit || s.target2_hit || s.target3_hit;
  const caught = astStr(s.created_at);
  const hitAt  = astStr(s.target1_hit_at);
  const entry  = (s.entry_price || 0).toFixed(2);
  const tgt    = (s.target1 || 0).toFixed(2);
  const gain   = s.max_gain_pct != null ? `+${s.max_gain_pct}%` : (r?.pct != null ? `${r.pct}%` : "");

  // 📋 تقرير مفصّل قابل للنسخ (بتوقيت السعودية)
  let text;
  if (won) {
    text =
      `🎯 $${s.symbol}  ${gain}\n` +
      (caught ? `📅 التُقط: ${caught} (السعودية) @ $${entry}\n` : `📅 سعر الالتقاط: $${entry}\n`) +
      (hitAt ? `✅ الهدف: ${hitAt} @ $${tgt}\n` : `✅ أصاب الهدف @ $${tgt}\n`) +
      `— RadarAZ`;
  } else if (s.stop_hit) {
    text =
      `🛑 $${s.symbol}  ${r?.pct != null ? (r.pct >= 0 ? `+${r.pct}%` : `${r.pct}%`) : ""}\n` +
      (caught ? `📅 التُقط: ${caught} (السعودية) @ $${entry}\n` : "") +
      `🛑 ضرب وقف الخسارة\n— RadarAZ`;
  } else {
    text = `➖ $${s.symbol} — أغلق دون هدف/وقف ${r?.pct != null ? `(${r.pct}%)` : ""}\n— RadarAZ`;
  }

  return (
    <div style={{
      background: "rgba(255,255,255,.03)",
      border: `1px solid ${s.target3_hit ? "rgba(251,191,36,.3)" : won ? "rgba(52,211,153,.2)" : s.stop_hit ? "rgba(248,113,113,.2)" : "rgba(255,255,255,.08)"}`,
      borderRadius: 14, padding: "12px 16px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{r ? r.icon : "📡"}</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontWeight: 800, fontFamily: "monospace", fontSize: 16, color: "#f1f5f9" }}>${s.symbol}</span>
              <EPBadge ep={ep} />
            </div>
            <div style={{ fontSize: 12, color: won ? "#34d399" : s.stop_hit ? "#f87171" : "#475569", marginTop: 3, fontWeight: 600 }}>
              {r ? `${r.label} ${r.pct != null ? (r.pct >= 0 ? `+${r.pct}%` : `${r.pct}%`) : ""}` : "⏳ مفتوحة"}
            </div>
          </div>
        </div>
        <button onClick={() => onCopy(text, s.id)} style={{ background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.25)", borderRadius: 8, padding: "5px 11px", color: "#a5b4fc", fontSize: 11, cursor: "pointer" }}>
          {copiedId === s.id ? "✅" : "📋"}
        </button>
      </div>

      {/* أوقات بتوقيت السعودية */}
      {(caught || hitAt) && (
        <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,.06)", fontSize: 11, color: "#94a3b8", lineHeight: 1.9 }}>
          {caught && <div>📅 التُقط: <span style={{ color: "#cbd5e1", direction: "ltr", unicodeBidi: "isolate", display: "inline-block" }}>{caught}</span> <span style={{ color: "#475569" }}>(السعودية)</span> @ <span style={{ color: "#60a5fa", fontFamily: "monospace" }}>${entry}</span></div>}
          {won && hitAt && <div>✅ الهدف: <span style={{ color: "#cbd5e1", direction: "ltr", unicodeBidi: "isolate", display: "inline-block" }}>{hitAt}</span> @ <span style={{ color: "#34d399", fontFamily: "monospace" }}>${tgt}</span></div>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════
export default function Admin() {
  const [auth,      setAuth]      = useState(false);
  const [pass,      setPass]      = useState("");
  const [summary,   setSummary]   = useState(null);
  const [signals,   setSignals]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [scanning,  setScanning]  = useState(false);
  const [copiedId,  setCopiedId]  = useState(null);
  const [activeTab, setActiveTab] = useState("signals");
  const [date,      setDate]      = useState("");
  const [toast,     setToast]     = useState({ msg: "", type: "" });
  const [tweetText, setTweetText] = useState(null);
  const [scanStats, setScanStats] = useState(null);
  const [resultView, setResultView] = useState("all");   // all | wins | losses

  // ── select-to-tweet state ──
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // 📱 حالة نقل الجهاز
  const [resetKey,    setResetKey]    = useState("");
  const [resetBusy,   setResetBusy]   = useState(false);
  const [resetResult, setResetResult] = useState(null);

  // 🤝 حالة الشركاء
  const [affiliates,  setAffiliates]  = useState([]);
  const [affTotals,   setAffTotals]   = useState({});
  const [affLoading,  setAffLoading]  = useState(false);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 4000);
  };

  const login = () => { if (pass === ADMIN_KEY) setAuth(true); };

  useEffect(() => {
    if (auth) {
      const today = new Date();
      // ── التاريخ ميلادي ──
      setDate(today.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
      fetchSummary();
      fetchSignals();
    }
  }, [auth]);

  // حمّل الشركاء عند فتح تبويبهم
  useEffect(() => {
    if (auth && activeTab === "affiliates" && affiliates.length === 0) {
      loadAffiliates();
    }
  }, [auth, activeTab]);

  const fetchSignals = async () => {
    try {
      const res  = await fetch("/api/summary");
      const data = await res.json();
      setSignals(data?.signals || []);
    } catch (err) { console.error(err); }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/summary");
      const data = await res.json();
      setSummary(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const runScan = async () => {
    setScanning(true);
    setScanStats(null);
    try {
      const res  = await fetch("/api/scan", {
        method: "GET",
        headers: { "x-admin-scan": "true" },
      });
      const data = await res.json();
      if (data.success) {
        setScanStats({ total: data.total, hot: data.hot, saved: data.saved });
        showToast(`✅ مسح اكتمل — ${data.total} إشارة · ${data.hot} HOT · ${data.saved} محفوظ`, "ok");
        await fetchSummary();
        await fetchSignals();
      } else {
        showToast(`❌ خطأ: ${data.error}`, "err");
      }
    } catch (err) {
      showToast(`❌ ${err.message}`, "err");
    }
    setScanning(false);
  };

  // 📱 نقل المفتاح لجهاز جديد
  const resetDevice = async () => {
    if (!resetKey.trim()) { setToast({ msg: "أدخل المفتاح", type: "error" }); return; }
    setResetBusy(true); setResetResult(null);
    try {
      const res = await fetch(`/api/reset-device?key=${encodeURIComponent(resetKey.trim())}&pass=${encodeURIComponent(pass)}`);
      const d = await res.json();
      if (d.success) {
        setResetResult(d);
        setResetKey("");
        setToast({ msg: "تم تحرير المفتاح ✅", type: "success" });
      } else if (d.reason === "not_found") {
        setToast({ msg: "المفتاح غير موجود", type: "error" });
      } else if (d.reason === "unauthorized") {
        setToast({ msg: "غير مصرّح", type: "error" });
      } else {
        setToast({ msg: "خطأ: " + (d.reason || "غير معروف"), type: "error" });
      }
    } catch {
      setToast({ msg: "خطأ في الاتصال", type: "error" });
    } finally {
      setResetBusy(false);
    }
  };

  // 🤝 تحميل الشركاء
  const loadAffiliates = async () => {
    setAffLoading(true);
    try {
      const res = await fetch(`/api/admin-affiliates?pass=${encodeURIComponent(pass)}`);
      const d = await res.json();
      if (d.success) {
        setAffiliates(d.affiliates || []);
        setAffTotals(d.totals || {});
      }
    } catch {
      setToast({ msg: "تعذّر تحميل الشركاء", type: "error" });
    } finally {
      setAffLoading(false);
    }
  };

  const copyText = (text, id) => {
    navigator.clipboard?.writeText(text).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    });
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── select helpers ──
  const sigKey = (s, i) => s.id || s.symbol || i;

  const toggleSelect = (key) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(signals.map((s, i) => sigKey(s, i))));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const tweetSelected = () => {
    const chosen = signals.filter((s, i) => selectedIds.has(sigKey(s, i)));
    if (chosen.length === 0) {
      showToast("⚠️ اختر شركة واحدة على الأقل", "err");
      return;
    }
    setTweetText(buildTweet(chosen, date, "signals"));
  };

  // 📋 نسخ تقرير الرابحين كامل (تسويق)
  const copyAllWins = (winsList) => {
    if (!winsList.length) { showToast("لا يوجد رابحون بعد", "err"); return; }
    const blocks = winsList.map(s => {
      const caught = astStr(s.created_at);
      const hitAt = astStr(s.target1_hit_at);
      const entry = (s.entry_price || 0).toFixed(2);
      const tgt = (s.target1 || 0).toFixed(2);
      const gain = s.max_gain_pct != null ? `+${s.max_gain_pct}%` : "";
      return `🎯 $${s.symbol}  ${gain}\n` +
        (caught ? `📅 التُقط: ${caught} (السعودية) @ $${entry}\n` : `📅 @ $${entry}\n`) +
        (hitAt ? `✅ الهدف: ${hitAt} @ $${tgt}` : `✅ أصاب الهدف @ $${tgt}`);
    });
    copyText(`📡 سجل إنجازات RadarAZ\n\n${blocks.join("\n\n")}\n\n🔗 radaraz.com`, "all-wins");
    showToast("✅ نُسخ تقرير الإنجازات", "ok");
  };

  const hotCount  = signals.filter(s => s.is_hot).length;
  const newsCount = signals.filter(s => s.news_age_hours != null && s.news_age_hours <= 24).length;

  // ── Styles ──────────────────────────────────────────────────────
  const S = {
    root:  { minHeight: "100vh", background: "#07091a", color: "#e2e8f0", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", padding: 24 },
    box:   { maxWidth: 640, margin: "0 auto" },
    input: { width: "100%", padding: "11px 14px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", fontSize: 15, marginBottom: 12, boxSizing: "border-box", outline: "none" },
    btn:   (bg) => ({ padding: "10px 22px", background: bg || "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }),
  };

  // ── Login screen ────────────────────────────────────────────────
  if (!auth) return (
    <div style={S.root}>
      <div style={{ ...S.box, maxWidth: 360, paddingTop: 90, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>📡</div>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 24, color: "#818cf8" }}>Radaraz Admin</div>
        <input style={S.input} type="password" placeholder="كلمة المرور" value={pass}
          onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        <button style={S.btn()} onClick={login}>دخول</button>
      </div>
    </div>
  );

  const closedSignals = (summary?.signals || []).filter(s => s.status !== "OPEN");
  const t1  = closedSignals.filter(s => s.target1_hit).length;
  const t2  = closedSignals.filter(s => s.target2_hit).length;
  const t3  = closedSignals.filter(s => s.target3_hit).length;
  const stp = closedSignals.filter(s => s.stop_hit).length;
  const hit = closedSignals.filter(s => s.target1_hit || s.target2_hit || s.target3_hit).length;
  const decided = hit + stp;                                   // المحسوم = رابح + خاسر
  const successRate = decided ? Math.round((hit / decided) * 100) : 0;

  // فلترة عرض النتائج (الكل/رابح/خاسر)
  const winsList = closedSignals.filter(s => s.target1_hit || s.target2_hit || s.target3_hit);
  const lossList = closedSignals.filter(s => s.stop_hit && !s.target1_hit);
  const resultsToShow = closedSignals.filter(s => {
    if (resultView === "wins")   return s.target1_hit || s.target2_hit || s.target3_hit;
    if (resultView === "losses") return s.stop_hit && !s.target1_hit;
    return true;
  });

  // 🔬 تحليل نمط الخسائر تلقائياً — وين يتركّز الخلل بالأرقام
  const lossPattern = (() => {
    const n = lossList.length;
    if (!n) return null;
    const pctG = c => Math.round((c / n) * 100);
    const num = v => (v == null ? null : parseFloat(v));
    const penny    = lossList.filter(s => num(s.entry_price) != null && num(s.entry_price) < 1).length;
    const chased   = lossList.filter(s => num(s.change_pct) != null && num(s.change_pct) > 40).length;
    const hiRsi    = lossList.filter(s => num(s.rsi) != null && num(s.rsi) >= 72).length;
    const noNews   = lossList.filter(s => s.news_age_hours == null).length;
    const spec     = lossList.filter(s => s.type === "مضاربة").length;
    const invest   = lossList.filter(s => s.type === "استثمار").length;
    const hot      = lossList.filter(s => s.is_hot).length;
    const early    = lossList.filter(s => s.early_watch).length;
    const lowEp    = lossList.filter(s => (num(s.ep) || num(s.score) || 0) < 70).length;
    const avgEp    = Math.round(lossList.reduce((a, s) => a + (num(s.ep) || num(s.score) || 0), 0) / n);
    return [
      { k: "بنسات < $1",     v: penny,  p: pctG(penny),  warn: pctG(penny)  >= 40 },
      { k: "قفزت > 40% قبل الرصد", v: chased, p: pctG(chased), warn: pctG(chased) >= 30 },
      { k: "RSI ≥ 72 (مُتشبّع)", v: hiRsi,  p: pctG(hiRsi),  warn: pctG(hiRsi)  >= 35 },
      { k: "بلا أخبار",       v: noNews, p: pctG(noNews), warn: false },
      { k: "EP < 70",         v: lowEp,  p: pctG(lowEp),  warn: pctG(lowEp)  >= 50 },
      { k: "مضاربة / استثمار", v: `${spec} / ${invest}`, p: null, warn: false },
      { k: "HOT / رصد مبكر",  v: `${hot} / ${early}`, p: null, warn: false },
      { k: "متوسط EP للخاسر", v: avgEp, p: null, warn: false },
    ];
  })();

  return (
    <div style={S.root} dir="rtl">
      <div style={S.box}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#818cf8", display: "flex", alignItems: "center", gap: 10 }}>
              📡 لوحة التحكم
              {hotCount > 0 && (
                <span style={{ fontSize: 12, fontWeight: 800, color: "#fca5a5", background: "rgba(248,113,113,.15)", padding: "2px 10px", borderRadius: 8, border: "1px solid rgba(248,113,113,.3)", animation: "hotpulse 1.5s infinite" }}>🚨 {hotCount} HOT</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>{date}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={S.btn("linear-gradient(135deg,#10b981,#059669)")} onClick={runScan} disabled={scanning}>
              {scanning ? "⏳ جاري المسح..." : "📡 تشغيل المسح"}
            </button>
            <button style={S.btn("rgba(255,255,255,.08)")} onClick={() => { fetchSummary(); fetchSignals(); }}>
              🔄 تحديث
            </button>
          </div>
        </div>

        {/* ── Scan stats strip ── */}
        {scanStats && (
          <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 10, background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.2)", display: "flex", gap: 20, fontSize: 12, color: "#34d399", flexWrap: "wrap" }}>
            <span>✅ <strong>{scanStats.total}</strong> إشارة</span>
            <span>🚨 <strong>{scanStats.hot}</strong> HOT</span>
            <span>💾 <strong>{scanStats.saved}</strong> محفوظ في Supabase</span>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          {[
            { id: "signals", label: `📡 الإشارات${signals.length ? ` (${signals.length})` : ""}` },
            { id: "results", label: "📊 النتائج" },
            { id: "subscribers", label: "👥 المشتركين" },
            { id: "affiliates", label: "🤝 الشركاء" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "12px 22px", background: "transparent", border: "none",
              borderBottom: `3px solid ${activeTab === t.id ? "#6366f1" : "transparent"}`,
              color: activeTab === t.id ? "#818cf8" : "rgba(255,255,255,.4)",
              fontWeight: 700, cursor: "pointer", fontSize: 14, transition: "color .15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ════════ TAB: SIGNALS ════════ */}
        {activeTab === "signals" && (
          <>
            {/* Stats row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: "إجمالي",   value: signals.length,                                color: "#818cf8" },
                { label: "🚨 HOT",   value: hotCount,                                      color: "#f87171" },
                { label: "قيادي",    value: signals.filter(s => s.type === "قيادي").length, color: "#34d399" },
                { label: "مضاربة",   value: signals.filter(s => s.type === "مضاربة").length,color: "#fbbf24" },
                { label: "خبر <24h", value: newsCount,                                      color: "#c084fc" },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, minWidth: 70, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#334155", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tweet controls */}
            {signals.length > 0 && (
              <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {!selectMode ? (
                  <>
                    <button style={S.btn("linear-gradient(135deg,#1da1f2,#0d8ecf)")} onClick={() => setTweetText(buildTweet(signals, date, "signals"))}>
                      🐦 تغريد الكل
                    </button>
                    <button style={S.btn("rgba(99,102,241,.18)")} onClick={() => { setSelectMode(true); clearSelection(); }}>
                      ☑️ اختيار شركات
                    </button>
                  </>
                ) : (
                  <>
                    <button style={S.btn("linear-gradient(135deg,#1da1f2,#0d8ecf)")} onClick={tweetSelected}>
                      🐦 تغريد المختار ({selectedIds.size})
                    </button>
                    <button style={S.btn("rgba(99,102,241,.18)")} onClick={selectAll}>
                      تحديد الكل
                    </button>
                    <button style={S.btn("rgba(255,255,255,.08)")} onClick={clearSelection}>
                      مسح التحديد
                    </button>
                    <button style={S.btn("rgba(248,113,113,.18)")} onClick={() => { setSelectMode(false); clearSelection(); }}>
                      ✕ إلغاء
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Select hint */}
            {selectMode && (
              <div style={{ marginBottom: 12, fontSize: 12, color: "#818cf8", textAlign: "center" }}>
                👆 اضغط على الشركات اللي تبي تغرّدها
              </div>
            )}

            {/* Signal cards */}
            {signals.length === 0 ? (
              <div style={{ textAlign: "center", padding: 50, color: "#334155" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
                لا توجد إشارات — اضغط «تشغيل المسح»
              </div>
            ) : (
              signals.map((s, i) => {
                const key = sigKey(s, i);
                return (
                  <SignalCard
                    key={key}
                    s={s}
                    copiedId={copiedId}
                    onCopy={copyText}
                    selectMode={selectMode}
                    selected={selectedIds.has(key)}
                    onToggle={() => toggleSelect(key)}
                  />
                );
              })
            )}
          </>
        )}

        {/* ════════ TAB: RESULTS ════════ */}
        {activeTab === "results" && (
          <>
            {loading && <div style={{ textAlign: "center", color: "#334155", padding: 30 }}>جاري التحميل...</div>}

            {/* Stats row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: "T1 ✅", value: t1,  color: "#34d399" },
                { label: "T2 🎯", value: t2,  color: "#fbbf24" },
                { label: "T3 🏆", value: t3,  color: "#c084fc" },
                { label: "وقف ❌", value: stp, color: "#f87171" },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, minWidth: 70, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#334155", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Success rate bar */}
            {decided > 0 && (
              <div style={{ marginBottom: 20, padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>نسبة النجاح <span style={{ fontSize: 11, color: "#475569" }}>(رابح ÷ المحسوم)</span></span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: successRate >= 60 ? "#34d399" : successRate >= 40 ? "#fbbf24" : "#f87171" }}>
                    {successRate}%
                  </span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${successRate}%`, height: "100%", borderRadius: 3, background: successRate >= 60 ? "linear-gradient(90deg,#34d399,#059669)" : successRate >= 40 ? "linear-gradient(90deg,#fbbf24,#d97706)" : "linear-gradient(90deg,#f87171,#dc2626)", transition: "width 1s ease" }} />
                </div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>{hit} رابح · {stp} خاسر · {hit}/{decided} محسوم · ({closedSignals.length} مُقيّمة)</div>
              </div>
            )}

            {/* Filter + copy/tweet */}
            {closedSignals.length > 0 && (
              <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {[
                  { id: "all",    label: `الكل (${closedSignals.length})` },
                  { id: "wins",   label: `🎯 الرابحون (${winsList.length})` },
                  { id: "losses", label: `🛑 الخاسرون (${stp})` },
                ].map(v => (
                  <button key={v.id} onClick={() => setResultView(v.id)}
                    style={S.btn(resultView === v.id ? "rgba(99,102,241,.3)" : "rgba(255,255,255,.06)")}>
                    {v.label}
                  </button>
                ))}
                <button style={S.btn("rgba(52,211,153,.18)")} onClick={() => copyAllWins(winsList)}>
                  📋 نسخ الإنجازات
                </button>
                <button style={S.btn("linear-gradient(135deg,#1da1f2,#0d8ecf)")} onClick={() => setTweetText(buildTweet(winsList, date, "results"))}>
                  🐦 تغريد النتائج
                </button>
              </div>
            )}

            {/* 🔬 لوحة تشخيص الخسائر — تظهر في عرض الخاسرين */}
            {resultView === "losses" && lossPattern && (
              <div style={{ marginBottom: 18, padding: "16px 18px", borderRadius: 14, background: "rgba(248,113,113,.05)", border: "1px solid rgba(248,113,113,.18)" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#f87171", marginBottom: 12 }}>🔬 تشخيص الخاسرين ({lossList.length})</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {lossPattern.map(row => (
                    <div key={row.k} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "9px 12px", borderRadius: 10,
                      background: row.warn ? "rgba(248,113,113,.12)" : "rgba(255,255,255,.03)",
                      border: `1px solid ${row.warn ? "rgba(248,113,113,.3)" : "rgba(255,255,255,.06)"}`,
                    }}>
                      <span style={{ fontSize: 11, color: row.warn ? "#fca5a5" : "#94a3b8" }}>{row.warn ? "⚠️ " : ""}{row.k}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: row.warn ? "#f87171" : "#cbd5e1", fontFamily: "monospace" }}>
                        {row.v}{row.p != null ? ` (${row.p}%)` : ""}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 10, lineHeight: 1.7 }}>
                  ⚠️ = نسبة عالية بين الخاسرين، مرشّح قوي لتشديد الفلتر. انسخ هذي الأرقام وأرسلها للمطوّر.
                </div>
              </div>
            )}

            {/* Result cards */}
            {closedSignals.length === 0 ? (
              <div style={{ textAlign: "center", padding: 50, color: "#334155" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                انتظر التقييم الأوتوماتيكي
              </div>
            ) : resultsToShow.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#334155" }}>لا نتائج في هذا العرض</div>
            ) : (
              resultsToShow
                .sort((a, b) => {
                  const rank = s => s.target3_hit ? 3 : s.target2_hit ? 2 : s.target1_hit ? 1 : s.stop_hit ? -1 : 0;
                  return rank(b) - rank(a);
                })
                .map((s, i) => (
                  <ResultCard key={s.id || s.symbol || i} s={s} copiedId={copiedId} onCopy={copyText} />
                ))
            )}
          </>
        )}

        {/* ════════ TAB: SUBSCRIBERS ════════ */}
        {activeTab === "subscribers" && (
          <>
            <div style={{ maxWidth: 460, margin: "0 auto" }}>
              {/* أداة نقل الجهاز */}
              <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 18, padding: "24px 20px", marginBottom: 20 }}>
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div style={{ fontSize: 38, marginBottom: 8 }}>📱</div>
                  <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>نقل المفتاح لجهاز جديد</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                    لو المشترك بدّل جواله، حرّر مفتاحه ليدخل من جهازه الجديد
                  </div>
                </div>

                <input
                  style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, textAlign: "center", marginBottom: 12, outline: "none", boxSizing: "border-box", fontFamily: "monospace", letterSpacing: 1, direction: "ltr" }}
                  type="text"
                  placeholder="XXXX-XXXX-XXXX"
                  value={resetKey}
                  onChange={(e) => setResetKey(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && resetDevice()}
                />
                <button
                  onClick={resetDevice}
                  disabled={resetBusy}
                  style={{ width: "100%", padding: 14, background: resetBusy ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 15, cursor: resetBusy ? "not-allowed" : "pointer", fontFamily: "system-ui" }}
                >
                  {resetBusy ? "⟳ جاري التحرير..." : "🔓 حرّر المفتاح"}
                </button>

                {resetResult && (
                  <div style={{ background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.3)", borderRadius: 12, padding: "16px", fontSize: 14, color: "#00d4aa", marginTop: 16, textAlign: "center" }}>
                    ✓ تم التحرير بنجاح
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6, direction: "ltr" }}>
                      {resetResult.email}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                      مرات النقل: {resetResult.device_resets}
                      {resetResult.device_resets >= 5 && " 🚩 (مرتفع — راقب)"}
                    </div>
                  </div>
                )}
              </div>

              {/* تنبيه أمني */}
              <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 14, padding: "14px 16px", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>🛡️ حماية المشاركة مفعّلة</div>
                كل مفتاح مربوط بجهاز واحد. لو حاول أحد يستخدمه على جهاز ثاني، يُرفض تلقائياً.
                <br /><br />
                عداد "مرات النقل" يكشف المشاركة: نقل كثير = مشترك يشارك مفتاحه 🚩
              </div>
            </div>
          </>
        )}

        {/* ════════ TAB: AFFILIATES ════════ */}
        {activeTab === "affiliates" && (
          <>
            {affLoading && <div style={{ textAlign: "center", color: "#334155", padding: 30 }}>جاري التحميل...</div>}

            {!affLoading && (
              <>
                {/* ملخّص الإجماليات */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div style={{ background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#818cf8" }}>{affTotals.affiliateCount || 0}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>شريك مسجّل</div>
                  </div>
                  <div style={{ background: "rgba(0,212,170,.08)", border: "1px solid rgba(0,212,170,.2)", borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#00d4aa" }}>{affTotals.totalActive || 0}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>مشترك عبر الإحالة</div>
                  </div>
                  <div style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#fbbf24", fontFamily: "monospace" }}>${affTotals.totalCommission || 0}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>إجمالي العمولات</div>
                  </div>
                  <div style={{ background: "rgba(0,212,170,.08)", border: "1px solid rgba(0,212,170,.2)", borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#00d4aa", fontFamily: "monospace" }}>${affTotals.netProfit || 0}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>صافي ربحك (تقديري)</div>
                  </div>
                </div>

                <button onClick={loadAffiliates} style={{ ...S.btn("rgba(255,255,255,.06)"), marginBottom: 16, fontSize: 13 }}>
                  🔄 تحديث
                </button>

                {/* قائمة الشركاء */}
                {affiliates.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 50, color: "#334155" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
                    لا شركاء مسجّلون بعد
                  </div>
                ) : (
                  affiliates.map((a, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: 16, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: "#e2e8f0" }}>{a.name || "—"}</div>
                          <div style={{ fontSize: 11, color: "#64748b", direction: "ltr", textAlign: "right" }}>{a.email}</div>
                        </div>
                        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#00d4aa", background: "rgba(0,212,170,.1)", padding: "4px 10px", borderRadius: 8 }}>{a.code}</span>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <div style={{ flex: 1, background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#00d4aa" }}>{a.activeCount}</div>
                          <div style={{ fontSize: 9, color: "#64748b" }}>نشط</div>
                        </div>
                        <div style={{ flex: 1, background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24", fontFamily: "monospace" }}>${a.commission}</div>
                          <div style={{ fontSize: 9, color: "#64748b" }}>مستحق</div>
                        </div>
                        <div style={{ flex: 1, background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#94a3b8" }}>{a.totalCount}</div>
                          <div style={{ fontSize: 9, color: "#64748b" }}>إجمالي</div>
                        </div>
                      </div>

                      {/* طريقة الدفع */}
                      <div style={{ fontSize: 11, color: "#64748b", borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 10 }}>
                        {a.payout_method ? (
                          <div style={{ direction: "ltr", textAlign: "right" }}>
                            <span style={{ color: "#a5b4fc", fontWeight: 700 }}>{a.payout_method}:</span> {a.payout_address || "—"}
                          </div>
                        ) : (
                          <span style={{ color: "#64748b" }}>لم يحدّد طريقة دفع بعد</span>
                        )}
                        {a.telegram && <div style={{ direction: "ltr", textAlign: "right", marginTop: 4 }}>📱 {a.telegram}</div>}
                      </div>
                    </div>
                  ))
                )}

                <div style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.15)", borderRadius: 12, padding: "13px 15px", fontSize: 11.5, color: "#94a3b8", marginTop: 12, lineHeight: 1.7 }}>
                  💡 نهاية كل شهر: راجع العمولة المستحقة لكل شريك وحوّلها بطريقة دفعه (USDT/PayPal).
                </div>
              </>
            )}
          </>
        )}

      </div>

      {tweetText && <TweetModal text={tweetText} onClose={() => setTweetText(null)} />}
      <Toast msg={toast.msg} type={toast.type} />

      <style>{`
        @keyframes hotpulse { 0%,100%{opacity:1} 50%{opacity:.55} }
        @keyframes fadeup { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        * { box-sizing: border-box }
        input:focus { border-color: rgba(99,102,241,.5) !important; }
        button:disabled { opacity: .55; cursor: not-allowed !important; }
        ::-webkit-scrollbar { width: 5px }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,.3); border-radius: 3px }
      `}</style>
    </div>
  );
}
