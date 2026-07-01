// pages/admin.js — RadarAZ Admin Panel v4 (results: Saudi-time + win/loss filter + copyable report)
import { useState, useEffect, useMemo } from "react";

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
    const hit = signals.filter(s => s.target1_hit || s.target2_hit || s.target3_hit).length;
    const st  = signals.filter(s => s.stop_hit && !s.target1_hit).length;
    const decided = hit + st;
    const rate = decided ? Math.round((hit / decided) * 100) : 0;

    const topGainers = [...signals]
      .filter(s => (s.target1_hit || s.target2_hit || s.target3_hit) && (s.max_gain_pct || 0) > 0)
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

// ─── Dashboard KPI Components ──────────────────────────────────────
function KpiCard({ label, value, sub, good, target, color }) {
  return (
    <div style={{
      background: good ? `${color}14` : "rgba(255,255,255,.03)",
      border: `1px solid ${good ? color + "55" : "rgba(255,255,255,.08)"}`,
      borderRadius: 16, padding: 18, position: "relative",
    }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginBottom: 4 }}>{sub}</div>
      <div style={{ fontSize: 10, color: good ? color : "rgba(255,255,255,.3)", fontWeight: 700 }}>
        {good ? "✓ " : ""}{target}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || "#fff", marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.45)" }}>{label}</div>
    </div>
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
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "14px 14px 0 0", background: `linear-gradient(90deg,${epc.fg}88,transparent)` }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
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
              {s.news_age_h != null && s.news_age_h <= 48 && (
                <span style={{ fontSize: 11, color: "#fbbf24" }}>
                  📰 {Math.round(s.news_age_h)}h
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

// ─── Result Card ──────────────────────────────────────────────────
function ResultCard({ s, copiedId, onCopy }) {
  const r   = getResult(s);
  const ep  = s.ep || s.score || 0;
  const won = s.target1_hit || s.target2_hit || s.target3_hit;
  const caught = astStr(s.created_at);
  const hitAt  = astStr(s.target1_hit_at);
  const entry  = (s.entry_price || 0).toFixed(2);
  const tier   = s.target3_hit ? "T3 🏆" : s.target2_hit ? "T2 🎯" : "T1 ✅";
  const tgt    = (s.target1 || 0).toFixed(2);
  const gain   = s.max_gain_pct != null ? `+${s.max_gain_pct}%` : (r?.pct != null ? `${r.pct}%` : "");

  let text;
  if (won) {
    text =
      `🎯 $${s.symbol}  ${gain}  (وصل ${tier})\n` +
      (caught ? `📅 التُقط: ${caught} (السعودية) @ $${entry}\n` : `📅 سعر الالتقاط: $${entry}\n`) +
      (hitAt ? `✅ أصاب الهدف الأول: ${hitAt} @ $${tgt}\n` : `✅ أصاب الهدف @ $${tgt}\n`) +
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
  const [dash,      setDash]      = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [cacInput,  setCacInput]  = useState("");
  const [date,      setDate]      = useState("");
  const [toast,     setToast]     = useState({ msg: "", type: "" });
  const [tweetText, setTweetText] = useState(null);
  const [scanStats, setScanStats] = useState(null);
  const [resultView, setResultView] = useState("all");
  const [datePeriod, setDatePeriod] = useState("today");
  const [audit, setAudit] = useState(null);
  const [auditBusy, setAuditBusy] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [resetKey,    setResetKey]    = useState("");
  const [resetBusy,   setResetBusy]   = useState(false);
  const [resetResult, setResetResult] = useState(null);

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
      setDate(today.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
      fetchSummary();
      fetchSignals();
    }
  }, [auth]);

  useEffect(() => {
    if (auth && activeTab === "affiliates" && affiliates.length === 0) {
      loadAffiliates();
    }
    if (auth && activeTab === "dashboard" && !dash) {
      fetchDash();
    }
  }, [auth, activeTab]);

  const fetchSignals = async () => {
    try {
      const res  = await fetch("/api/summary");
      const data = await res.json();
      setSignals(data?.signals || []);
    } catch (err) { console.error(err); }
  };

  // 🔍 تدقيق المطابقة
  const runAudit = async () => {
    setAuditBusy(true); setAudit(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const all = summary?.signals || signals || [];
      const todaySignals = all.filter(s => {
        const d = s.created_at ? s.created_at.split('T')[0] : null;
        return d === today || s.signal_date === today;
      });
      const todaySymbols = [...new Set(todaySignals.map(s => s.symbol).filter(Boolean))];

      const scanRes = await fetch("/api/scan?light=1");
      const scanData = scanRes.ok ? await scanRes.json() : {};
      const shownSymbols = [];
      if (scanData.results) {
        shownSymbols.push(...scanData.results.map(r => r.symbol).filter(Boolean));
      }
      if (scanData.opportunities) {
        for (const key of ['ready', 'watch', 'late', 'hidden']) {
          if (scanData.opportunities[key]) {
            shownSymbols.push(...scanData.opportunities[key].map(r => r.symbol).filter(Boolean));
          }
        }
      }
      const uniqueShown = [...new Set(shownSymbols)];

      const displayed = todaySymbols.filter(sym => uniqueShown.includes(sym));
      const notDisplayed = todaySymbols.filter(sym => !uniqueShown.includes(sym));

      const closed = todaySignals.filter(s => s.status === "CLOSED");
      const hit = closed.filter(s => s.target1_hit || s.target2_hit || s.target3_hit);
      const stopHit = closed.filter(s => s.stop_hit && !s.target1_hit);
      const totalClosed = closed.length;
      const winRate = totalClosed > 0 ? Math.round((hit.length / totalClosed) * 100) : 0;

      const bestTrades = [...hit]
        .sort((a, b) => (b.max_gain_pct || 0) - (a.max_gain_pct || 0))
        .slice(0, 6)
        .map(s => ({
          symbol: s.symbol,
          gain: (s.max_gain_pct || 0).toFixed(2),
          target: s.target3_hit ? "T3 🏆" : s.target2_hit ? "T2 🎯" : "T1 ✅",
          entry: s.entry_price,
          targetPrice: s.target1,
          caughtAt: s.created_at,
          hitAt: s.target1_hit_at,
        }));

      const avgGain = hit.length > 0 ? (hit.reduce((a, s) => a + (s.max_gain_pct || 0), 0) / hit.length).toFixed(2) : 0;
      const avgLoss = stopHit.length > 0 ? (stopHit.reduce((a, s) => a + Math.abs(s.close_gain_pct || 0), 0) / stopHit.length).toFixed(2) : 0;
      const totalGain = hit.reduce((a, s) => a + (s.max_gain_pct || 0), 0);
      const totalLoss = stopHit.reduce((a, s) => a + Math.abs(s.close_gain_pct || 0), 0);
      const profitFactor = totalLoss > 0 ? (totalGain / totalLoss).toFixed(2) : "0.00";

      const byType = {};
      for (const s of closed) {
        const type = s.type || "مضاربة";
        if (!byType[type]) byType[type] = { total: 0, win: 0 };
        byType[type].total++;
        if (s.target1_hit || s.target2_hit || s.target3_hit) byType[type].win++;
      }
      for (const type in byType) {
        byType[type].rate = byType[type].total > 0 ? Math.round((byType[type].win / byType[type].total) * 100) : 0;
      }

      setAudit({
        today: {
          total: todaySymbols.length,
          displayed: displayed.length,
          notDisplayed: notDisplayed.length,
          displayRate: todaySymbols.length > 0 ? Math.round((displayed.length / todaySymbols.length) * 100) : 0,
          symbols: todaySymbols,
          displayedSymbols: displayed,
          notDisplayedSymbols: notDisplayed,
        },
        performance: {
          totalDisplayed: todaySymbols.length,
          hitT1: closed.filter(s => s.target1_hit).length,
          hitT2: closed.filter(s => s.target2_hit).length,
          hitT3: closed.filter(s => s.target3_hit).length,
          totalHits: hit.length,
          stopHit: stopHit.length,
          totalClosed,
          winRate,
          avgGain: parseFloat(avgGain),
          avgLoss: parseFloat(avgLoss),
          profitFactor: parseFloat(profitFactor),
          bestTrades,
          byType,
        },
        ts: new Date(),
      });
    } catch (e) {
      setAudit({ error: e.message });
    } finally {
      setAuditBusy(false);
    }
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

  const fetchDash = async () => {
    setDashLoading(true);
    try {
      const res  = await fetch("/api/dashboard?pw=123451");
      const data = await res.json();
      setDash(data);
    } catch (err) { console.error(err); }
    setDashLoading(false);
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

  // ─── 📱➕ تفعيل جهاز ثانٍ للمفتاح ──────────────────────────────
  const enableTwoDevices = async () => {
    if (!resetKey.trim()) { setToast({ msg: "أدخل المفتاح", type: "error" }); return; }
    setResetBusy(true); setResetResult(null);
    try {
      const res = await fetch(`/api/enable-two-devices?key=${encodeURIComponent(resetKey.trim())}&pass=${encodeURIComponent(pass)}`);
      const d = await res.json();
      if (d.success) {
        setResetResult(d);
        setToast({ msg: "✅ تم تفعيل جهازين لهذا المفتاح", type: "success" });
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

  const isPreMarket = (s) => {
    if (!s.created_at) return false;
    const et = new Date(new Date(s.created_at).toLocaleString("en-US", { timeZone: "America/New_York" }));
    const mins = et.getHours() * 60 + et.getMinutes();
    return mins < 8 * 60;
  };

  const copyAllWins = (winsList) => {
    const tradable = winsList.filter(s => !isPreMarket(s));
    if (!tradable.length) { showToast("لا يوجد رابحون (بعد استبعاد ما قبل السوق)", "err"); return; }
    const blocks = tradable.map(s => {
      const caught = astStr(s.created_at);
      const hitAt = astStr(s.target1_hit_at);
      const entry = (s.entry_price || 0).toFixed(2);
      const tier = s.target3_hit ? "T3 🏆" : s.target2_hit ? "T2 🎯" : "T1 ✅";
      const t1price = (s.target1 || 0).toFixed(2);
      const gain = s.max_gain_pct != null ? `+${s.max_gain_pct}%` : "";
      return `🎯 $${s.symbol}  ${gain}  (وصل ${tier})\n` +
        (caught ? `📅 التُقط: ${caught} (السعودية) @ $${entry}\n` : `📅 @ $${entry}\n`) +
        (hitAt ? `✅ أصاب الهدف الأول: ${hitAt} @ $${t1price}` : `✅ أصاب الهدف @ $${t1price}`);
    });
    copyText(`📡 سجل إنجازات RadarAZ\n\n${blocks.join("\n\n")}\n\n📊 ليست نصيحة استثمارية\n🔗 radaraz.com`, "all-wins");
    showToast(`✅ نُسخ (${tradable.length} إنجاز · استُبعد ${winsList.length - tradable.length} قبل السوق)`, "ok");
  };

  // 🐦 نسخ تقرير التغريدة مع الأسعار والأوقات
  const copyTweetReport = () => {
    const today = new Date().toLocaleDateString("ar-SA");
    const allSignals = summary?.signals || signals || [];
    const todaySignals = allSignals.filter(s => {
      const d = s.created_at ? s.created_at.split('T')[0] : null;
      const todayStr = new Date().toISOString().split('T')[0];
      return d === todayStr || s.signal_date === todayStr;
    });
    const closed = todaySignals.filter(s => s.status === "CLOSED");
    const hit = closed.filter(s => s.target1_hit || s.target2_hit || s.target3_hit);
    const stp = closed.filter(s => s.stop_hit && !s.target1_hit);
    const total = hit.length + stp.length;
    const rate = total > 0 ? Math.round((hit.length / total) * 100) : 0;
    const totalGain = hit.reduce((a, s) => a + (s.max_gain_pct || 0), 0);
    const totalLoss = stp.reduce((a, s) => a + Math.abs(s.close_gain_pct || 0), 0);
    const pf = totalLoss > 0 ? (totalGain / totalLoss).toFixed(2) : "0.00";

    const topGainers = [...hit]
      .sort((a, b) => (b.max_gain_pct || 0) - (a.max_gain_pct || 0))
      .slice(0, 6);

    let tweet = `📡 تقرير رادار الأسهم - ${today}\n`;
    tweet += `🕐 الفترة: 3م - 11م (السعودية)\n`;
    tweet += `─────────────────────\n`;
    tweet += `📈 الإشارات المعروضة: ${closed.length}\n`;
    tweet += `✅ وصلت هدف: ${hit.length} (${rate}%)\n`;
    tweet += `❌ ضربت وقف: ${stp.length}\n`;
    tweet += `💰 Profit Factor: ${pf}×\n`;
    tweet += `─────────────────────\n`;
    tweet += `🏆 أبرز الصفقات:\n\n`;

    topGainers.forEach(s => {
      const tier = s.target3_hit ? "T3 🏆" : s.target2_hit ? "T2 🎯" : "T1 ✅";
      const gain = (s.max_gain_pct || 0).toFixed(2);
      const entry = (s.entry_price || 0).toFixed(2);
      const target = (s.target1 || 0).toFixed(2);
      
      const caughtDate = s.created_at ? new Date(new Date(s.created_at).getTime() + 3 * 3600 * 1000) : null;
      const caughtTime = caughtDate ? `${String(caughtDate.getUTCHours()).padStart(2, "0")}:${String(caughtDate.getUTCMinutes()).padStart(2, "0")}` : "—";
      
      const hitDate = s.target1_hit_at ? new Date(new Date(s.target1_hit_at).getTime() + 3 * 3600 * 1000) : null;
      const hitTime = hitDate ? `${String(hitDate.getUTCHours()).padStart(2, "0")}:${String(hitDate.getUTCMinutes()).padStart(2, "0")}` : "—";

      tweet += `$${s.symbol}  +${gain}%  (${tier})\n`;
      tweet += `   📅 التقط: ${caughtTime} @ $${entry}\n`;
      if (hitTime !== "—") {
        tweet += `   ✅ الهدف: ${hitTime} @ $${target}\n`;
      }
      tweet += `\n`;
    });

    tweet += `─────────────────────\n`;
    tweet += `✅ جميع الأسهم المعروضة ظهرت للمشتركين\n`;
    tweet += `🔗 radaraz.com`;

    navigator.clipboard?.writeText(tweet).then(() => {
      showToast("✅ تم نسخ تقرير التغريدة!", "ok");
    }).catch(() => {
      setTweetText(tweet);
    });
  };

  const hotCount  = signals.filter(s => s.is_hot).length;
  const newsCount = signals.filter(s => s.news_age_h != null && s.news_age_h <= 24).length;

  const S = {
    root:  { minHeight: "100vh", background: "#07091a", color: "#e2e8f0", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", padding: 24 },
    box:   { maxWidth: 640, margin: "0 auto" },
    input: { width: "100%", padding: "11px 14px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", fontSize: 15, marginBottom: 12, boxSizing: "border-box", outline: "none" },
    btn:   (bg) => ({ padding: "10px 22px", background: bg || "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }),
  };

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

  const etDateStr = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const todayET = etDateStr(Date.now());
  const yestET  = etDateStr(Date.now() - 86400000);
  const weekAgo = etDateStr(Date.now() - 7 * 86400000);
  const inPeriod = (s) => {
    const d = (s.created_at ? etDateStr(s.created_at) : null) || s.signal_date;
    if (!d) return true;
    if (datePeriod === "today")     return d === todayET;
    if (datePeriod === "yesterday") return d === yestET;
    if (datePeriod === "week")      return d >= weekAgo;
    return true;
  };

  const closedSignals = (summary?.signals || []).filter(s => s.status !== "OPEN" && inPeriod(s) && !isPreMarket(s));
  const t1  = closedSignals.filter(s => s.target1_hit).length;
  const t2  = closedSignals.filter(s => s.target2_hit).length;
  const t3  = closedSignals.filter(s => s.target3_hit).length;
  const hit = closedSignals.filter(s => s.target1_hit || s.target2_hit || s.target3_hit).length;
  const stp = closedSignals.filter(s => s.stop_hit && !s.target1_hit).length;
  const decided = hit + stp;
  const successRate = decided ? Math.round((hit / decided) * 100) : 0;

  const winsList = closedSignals.filter(s => s.target1_hit || s.target2_hit || s.target3_hit);
  const lossList = closedSignals.filter(s => s.stop_hit && !s.target1_hit);
  const resultsToShow = closedSignals.filter(s => {
    if (resultView === "wins")   return s.target1_hit || s.target2_hit || s.target3_hit;
    if (resultView === "losses") return s.stop_hit && !s.target1_hit;
    return true;
  });

  const patternOf = (list) => {
    const n = list.length;
    if (!n) return null;
    const pctG = c => Math.round((c / n) * 100);
    const num = v => (v == null ? null : parseFloat(v));
    const penny  = list.filter(s => num(s.entry_price) != null && num(s.entry_price) < 1).length;
    const chased = list.filter(s => num(s.change_pct) != null && num(s.change_pct) > 40).length;
    const hiRsi  = list.filter(s => num(s.rsi) != null && num(s.rsi) >= 72).length;
    const noNews = list.filter(s => s.news_age_h == null || s.news_age_h > 48).length;
    const spec   = list.filter(s => s.type === "مضاربة").length;
    const invest = list.filter(s => s.type === "استثمار").length;
    const hot    = list.filter(s => s.is_hot).length;
    const early  = list.filter(s => s.early_watch).length;
    const lowEp  = list.filter(s => (num(s.ep) || num(s.score) || 0) < 70).length;
    const avgEp  = Math.round(list.reduce((a, s) => a + (num(s.ep) || num(s.score) || 0), 0) / n);
    return { penny: pctG(penny), chased: pctG(chased), hiRsi: pctG(hiRsi), noNews: pctG(noNews),
             spec, invest, hot, early, lowEp: pctG(lowEp), avgEp,
             pennyN: penny, chasedN: chased, hiRsiN: hiRsi, noNewsN: noNews, lowEpN: lowEp };
  };
  const lossPat = patternOf(lossList);
  const winPat  = patternOf(winsList);

  const diagRows = (lossPat && winPat) ? [
    { k: "بنسات < $1",          lv: `${lossPat.pennyN} (${lossPat.penny}%)`, wv: `${winPat.penny}%`, warn: lossPat.penny >= 40 && lossPat.penny > winPat.penny },
    { k: "قفزت > 40% قبل الرصد", lv: `${lossPat.chasedN} (${lossPat.chased}%)`, wv: `${winPat.chased}%`, warn: lossPat.chased >= 30 && lossPat.chased > winPat.chased },
    { k: "RSI ≥ 72 (مُتشبّع)",   lv: `${lossPat.hiRsiN} (${lossPat.hiRsi}%)`, wv: `${winPat.hiRsi}%`, warn: lossPat.hiRsi >= 35 && lossPat.hiRsi > winPat.hiRsi },
    { k: "بلا أخبار",            lv: `${lossPat.noNewsN} (${lossPat.noNews}%)`, wv: `${winPat.noNews}%`, warn: lossPat.noNews >= 60 && lossPat.noNews > winPat.noNews + 15 },
    { k: "EP < 70",             lv: `${lossPat.lowEpN} (${lossPat.lowEp}%)`, wv: `${winPat.lowEp}%`, warn: lossPat.lowEp >= 50 && lossPat.lowEp > winPat.lowEp + 15 },
    { k: "متوسط EP",            lv: `${lossPat.avgEp}`, wv: `${winPat.avgEp}`, warn: lossPat.avgEp + 3 < winPat.avgEp },
    { k: "مضاربة / استثمار",     lv: `${lossPat.spec}/${lossPat.invest}`, wv: `${winPat.spec}/${winPat.invest}`, warn: false },
    { k: "HOT / رصد مبكر",      lv: `${lossPat.hot}/${lossPat.early}`, wv: `${winPat.hot}/${winPat.early}`, warn: false },
  ] : null;

  return (
    <div style={S.root} dir="rtl">
      <div style={S.box}>

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

        {scanStats && (
          <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 10, background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.2)", display: "flex", gap: 20, fontSize: 12, color: "#34d399", flexWrap: "wrap" }}>
            <span>✅ <strong>{scanStats.total}</strong> إشارة</span>
            <span>🚨 <strong>{scanStats.hot}</strong> HOT</span>
            <span>💾 <strong>{scanStats.saved}</strong> محفوظ في Supabase</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          {[
            { id: "dashboard", label: "🎯 لوحة القيادة" },
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

        {activeTab === "dashboard" && (
          <>
            {dashLoading && <div style={{ textAlign: "center", color: "rgba(255,255,255,.4)", padding: 40 }}>⟳ جاري تحميل المؤشرات...</div>}
            {!dashLoading && dash && dash.error && (
              <div style={{ textAlign: "center", color: "#f87171", padding: 40 }}>تعذّر التحميل: {dash.error}</div>
            )}
            {!dashLoading && dash && dash.success && (
              <div style={{ maxWidth: 760, margin: "0 auto" }}>
                {dash.signals.evaluated < 10 && (
                  <div style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.25)", borderRadius: 14, padding: "14px 16px", fontSize: 13, color: "rgba(255,255,255,.6)", marginBottom: 20, lineHeight: 1.7 }}>
                    ⏳ <b style={{ color: "#fbbf24" }}>عيّنة صغيرة ({dash.signals.evaluated} إشارة مُقيّمة).</b> الأرقام تصير ذات دلالة بعد تجمّع بيانات أسبوع من التقييم التلقائي.
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <KpiCard label="نسبة نجاح الإشارات" value={`${dash.signals.win_rate}%`}
                    sub={`${dash.signals.hit}/${dash.signals.evaluated} أصابت الهدف`} good={dash.signals.win_rate >= 55}
                    target="الهدف ≥55%" color="#34d399" />
                  <KpiCard label="Profit Factor" value={dash.signals.profit_factor}
                    sub="مكاسب ÷ خسائر" good={dash.signals.profit_factor >= 1.5}
                    target="الهدف ≥1.5" color="#60a5fa" />
                  <KpiCard label="Retention (التجديد)" value={`${dash.retention_pct}%`}
                    sub={`${dash.subscribers.active_paid} نشط من ${dash.subscribers.active_paid + dash.subscribers.expired}`} good={dash.retention_pct >= 40}
                    target="الهدف ≥40%" color="#a78bfa" />
                  <KpiCard label="التحويل trial→مدفوع" value={`${dash.conversion_pct}%`}
                    sub="من جرّب ثم اشترك" good={dash.conversion_pct >= 25}
                    target="الهدف ≥25%" color="#f59e0b" />
                </div>
                <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, color: "#fff" }}>👥 المشتركون</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <MiniStat label="نشط مدفوع" value={dash.subscribers.active_paid} color="#34d399" />
                    <MiniStat label="تجربة نشطة" value={dash.subscribers.active_trial} color="#60a5fa" />
                    <MiniStat label="منتهي" value={dash.subscribers.expired} color="#f87171" />
                    <MiniStat label="جدد هذا الشهر" value={dash.subscribers.new_this_month} color="#a78bfa" />
                    <MiniStat label="جدد مدفوعين" value={dash.subscribers.new_paid_this_month} color="#34d399" />
                    <MiniStat label="النمو الشهري" value={`${dash.subscribers.growth_pct >= 0 ? "+" : ""}${dash.subscribers.growth_pct}%`} color={dash.subscribers.growth_pct >= 0 ? "#34d399" : "#f87171"} />
                  </div>
                </div>
                <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, color: "#fff" }}>💰 الإيراد</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <MiniStat label="إيراد شهري نشط" value={`$${dash.revenue.monthly_active}`} color="#34d399" />
                    <MiniStat label="متوسط لكل مشترك" value={`$${dash.revenue.arpu}`} color="#60a5fa" />
                  </div>
                </div>
                <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, color: "#fff" }}>📊 CAC مقابل LTV</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginBottom: 12, lineHeight: 1.6 }}>
                    أدخل مصاريف إعلاناتك هذا الشهر، نحسب لك تكلفة اكتساب العميل (CAC) ونقارنها بقيمته (LTV).
                  </div>
                  <input
                    style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", fontSize: 15, marginBottom: 12, outline: "none", boxSizing: "border-box", direction: "rtl" }}
                    type="number" placeholder="مصاريف الإعلانات هذا الشهر ($)"
                    value={cacInput} onChange={(e) => setCacInput(e.target.value)}
                  />
                  {(() => {
                    const spend = Number(cacInput) || 0;
                    const newPaid = dash.subscribers.new_paid_this_month || 0;
                    const cac = newPaid > 0 ? +(spend / newPaid).toFixed(1) : 0;
                    const estMonths = dash.retention_pct >= 40 ? 4 : 2.5;
                    const ltv = +(dash.revenue.arpu * estMonths).toFixed(1);
                    const ratio = cac > 0 ? +(ltv / cac).toFixed(1) : 0;
                    if (spend === 0) return <div style={{ fontSize: 12, color: "rgba(255,255,255,.3)" }}>أدخل المصاريف لرؤية الحساب</div>;
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <MiniStat label="CAC" value={`$${cac}`} color="#f59e0b" />
                        <MiniStat label="LTV تقديري" value={`$${ltv}`} color="#60a5fa" />
                        <MiniStat label="LTV/CAC" value={`${ratio}×`} color={ratio >= 3 ? "#34d399" : "#f87171"} />
                      </div>
                    );
                  })()}
                </div>
                <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, color: "#fff" }}>🎯 نسبة النجاح حسب النوع</div>
                  {["استثمار", "مضاربة", "ارتداد"].map((t) => {
                    const d = dash.signals.by_type[t] || { total: 0, win: 0, rate: 0 };
                    return (
                      <div key={t} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                        <span style={{ fontSize: 14, color: "rgba(255,255,255,.7)" }}>{t}</span>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,.4)" }}>{d.win}/{d.total}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: d.rate >= 55 ? "#34d399" : d.rate >= 40 ? "#fbbf24" : "#f87171" }}>{d.rate}%</span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={fetchDash} style={{ width: "100%", padding: 13, background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.3)", borderRadius: 12, color: "#a5b4fc", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "system-ui" }}>
                  ⟳ تحديث المؤشرات
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "signals" && (
          <>
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

            {selectMode && (
              <div style={{ marginBottom: 12, fontSize: 12, color: "#818cf8", textAlign: "center" }}>
                👆 اضغط على الشركات اللي تبي تغرّدها
              </div>
            )}

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

        {activeTab === "results" && (
          <>
            {loading && <div style={{ textAlign: "center", color: "#334155", padding: 30 }}>جاري التحميل...</div>}

            <div style={{ marginBottom: 18, padding: "14px 16px", borderRadius: 14, background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#a5b4fc" }}>🔍 تدقيق المطابقة</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>كم إشارة عُرضت فعلاً في الرادار؟</div>
                </div>
                <button onClick={runAudit} disabled={auditBusy} style={S.btn(auditBusy ? "rgba(255,255,255,.06)" : "rgba(99,102,241,.25)")}>
                  {auditBusy ? "⟳ جاري الفحص..." : "▶ افحص الآن"}
                </button>
              </div>
              {audit && !audit.error && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 80, textAlign: "center", padding: "10px 8px", borderRadius: 10, background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.2)" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#818cf8" }}>{audit.today.total}</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>📊 إشارات اليوم</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 80, textAlign: "center", padding: "10px 8px", borderRadius: 10, background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.2)" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#34d399" }}>{audit.today.displayed}</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>✅ عُرضت في الرادار</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 80, textAlign: "center", padding: "10px 8px", borderRadius: 10, background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#f87171" }}>{audit.today.notDisplayed}</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>❌ لم تُعرض</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 80, textAlign: "center", padding: "10px 8px", borderRadius: 10, background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.2)" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#fbbf24" }}>{audit.today.displayRate}%</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>نسبة العرض</div>
                    </div>
                  </div>
                  {audit.today.notDisplayed > 0 && (
                    <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(248,113,113,.06)", borderRadius: 8, border: "1px solid rgba(248,113,113,.15)" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#f87171", marginBottom: 4 }}>❌ الأسهم اللي ما عُرضت:</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
                        {audit.today.notDisplayedSymbols.join(" · ") || "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
                        💡 سبب عدم العرض: EP أقل من 60، أو لم تستوفِ شروط الفلترة وقت المسح
                      </div>
                    </div>
                  )}
                  {audit.today.displayRate >= 80 && (
                    <div style={{ fontSize: 12, color: "#34d399", marginTop: 10, fontWeight: 600 }}>
                      ✅ نسبة عرض ممتازة — أكثر من 80% من الإشارات ظهرت للمشتركين
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 8 }}>
                    ⏳ التقييم: {audit.ts ? new Date(audit.ts).toLocaleTimeString() : "—"}
                  </div>
                </div>
              )}
              {audit && audit.error && (
                <div style={{ fontSize: 12, color: "#f87171", marginTop: 10 }}>تعذّر الفحص: {audit.error}</div>
              )}
            </div>

            {audit && audit.performance && (
              <div style={{ 
                marginTop: 18, 
                padding: "16px 18px", 
                borderRadius: 14, 
                background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(52,211,153,0.06))",
                border: "1px solid rgba(99,102,241,0.25)" 
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#818cf8", marginBottom: 4 }}>
                  📊 تقرير أداء الرادار - اليوم
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
                  الفترة: 3 مساءً - 11 مساءً (بتوقيت السعودية)
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div style={{ textAlign: "center", padding: "10px", background: "rgba(255,255,255,.04)", borderRadius: 10 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#818cf8" }}>{audit.performance.totalDisplayed}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>إجمالي الإشارات</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "10px", background: "rgba(52,211,153,.08)", borderRadius: 10 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#34d399" }}>{audit.performance.winRate}%</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>نسبة النجاح</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "10px", background: "rgba(251,191,36,.08)", borderRadius: 10 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#fbbf24" }}>{audit.performance.profitFactor}×</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>Profit Factor</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <div style={{ textAlign: "center", padding: "8px", background: "rgba(52,211,153,.08)", borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>{audit.performance.hitT1}</div>
                    <div style={{ fontSize: 9, color: "#64748b" }}>T1 ✅</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "8px", background: "rgba(251,191,36,.08)", borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24" }}>{audit.performance.hitT2}</div>
                    <div style={{ fontSize: 9, color: "#64748b" }}>T2 🎯</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "8px", background: "rgba(192,132,252,.08)", borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#c084fc" }}>{audit.performance.hitT3}</div>
                    <div style={{ fontSize: 9, color: "#64748b" }}>T3 🏆</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "8px", background: "rgba(248,113,113,.08)", borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#f87171" }}>{audit.performance.stopHit}</div>
                    <div style={{ fontSize: 9, color: "#64748b" }}>وقف ❌</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1, padding: "8px 12px", background: "rgba(52,211,153,.08)", borderRadius: 8, textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>📈 متوسط الربح</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#34d399", display: "block" }}>+{audit.performance.avgGain}%</span>
                  </div>
                  <div style={{ flex: 1, padding: "8px 12px", background: "rgba(248,113,113,.08)", borderRadius: 8, textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>📉 متوسط الخسارة</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#f87171", display: "block" }}>{audit.performance.avgLoss}%</span>
                  </div>
                  <div style={{ flex: 1, padding: "8px 12px", background: "rgba(251,191,36,.08)", borderRadius: 8, textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>💰 Profit Factor</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24", display: "block" }}>{audit.performance.profitFactor}×</span>
                  </div>
                </div>

                {audit.performance.bestTrades && audit.performance.bestTrades.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", marginBottom: 4 }}>🏆 أفضل الصفقات اليوم</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.8 }}>
                      {audit.performance.bestTrades.map((t, i) => (
                        <span key={i}>
                          {t.symbol} +{t.gain}% ({t.target})
                          {i < audit.performance.bestTrades.length - 1 ? "  ·  " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {audit.performance.byType && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", marginBottom: 4 }}>📊 توزيع الصفقات حسب النوع</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.8 }}>
                      {Object.entries(audit.performance.byType).map(([type, data], i) => (
                        <span key={type}>
                          {type}: {data.rate}% نجاح ({data.win}/{data.total})
                          {i < Object.entries(audit.performance.byType).length - 1 ? "  ·  " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button 
                onClick={copyTweetReport}
                style={S.btn("linear-gradient(135deg,#1da1f2,#0d8ecf)")}
              >
                🐦 نسخ تقرير التغريدة
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", marginTop: 16 }}>
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

            <div style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>📅 الفترة:</span>
              {[
                { id: "today",     label: "اليوم" },
                { id: "yesterday", label: "أمس" },
                { id: "week",      label: "7 أيام" },
                { id: "all",       label: "الكل" },
              ].map(p => (
                <button key={p.id} onClick={() => setDatePeriod(p.id)}
                  style={S.btn(datePeriod === p.id ? "rgba(52,211,153,.3)" : "rgba(255,255,255,.06)")}>
                  {p.label}
                </button>
              ))}
            </div>

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
                <div style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>
                  <span style={{ color: "#34d399", fontWeight: 700 }}>
                    [{datePeriod === "today" ? "اليوم" : datePeriod === "yesterday" ? "أمس" : datePeriod === "week" ? "7 أيام" : "الكل"}]
                  </span>
                  {" "}{hit} رابح · {stp} خاسر · {hit}/{decided} محسوم · ({closedSignals.length} مُقيّمة)
                </div>
              </div>
            )}

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
                <button style={S.btn("linear-gradient(135deg,#1da1f2,#0d8ecf)")} onClick={() => setTweetText(buildTweet(closedSignals, date, "results"))}>
                  🐦 تغريد النتائج
                </button>
              </div>
            )}

            {resultView === "losses" && diagRows && (
              <div style={{ marginBottom: 18, padding: "16px 18px", borderRadius: 14, background: "rgba(248,113,113,.05)", border: "1px solid rgba(248,113,113,.18)" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#f87171", marginBottom: 4 }}>🔬 تشخيص مقارن: خاسر مقابل رابح</div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>{lossList.length} خاسر · {winsList.length} رابح — العبرة بالفرق بينهما، مو الرقم وحده</div>
                <div style={{ display: "flex", fontSize: 10, color: "#475569", fontWeight: 700, padding: "0 12px 6px" }}>
                  <span style={{ flex: 1 }}>المؤشر</span>
                  <span style={{ width: 90, textAlign: "center", color: "#f87171" }}>🛑 الخاسر</span>
                  <span style={{ width: 60, textAlign: "center", color: "#34d399" }}>🎯 الرابح</span>
                </div>
                {diagRows.map(row => (
                  <div key={row.k} style={{
                    display: "flex", alignItems: "center", padding: "9px 12px", borderRadius: 10, marginBottom: 5,
                    background: row.warn ? "rgba(248,113,113,.12)" : "rgba(255,255,255,.03)",
                    border: `1px solid ${row.warn ? "rgba(248,113,113,.3)" : "rgba(255,255,255,.06)"}`,
                  }}>
                    <span style={{ flex: 1, fontSize: 11.5, color: row.warn ? "#fca5a5" : "#94a3b8" }}>{row.warn ? "⚠️ " : ""}{row.k}</span>
                    <span style={{ width: 90, textAlign: "center", fontSize: 13, fontWeight: 800, color: row.warn ? "#f87171" : "#cbd5e1", fontFamily: "monospace" }}>{row.lv}</span>
                    <span style={{ width: 60, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#34d399", fontFamily: "monospace" }}>{row.wv}</span>
                  </div>
                ))}
                <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 10, lineHeight: 1.7 }}>
                  ⚠️ = المؤشر مرتفع لدى الخاسرين <b>وأعلى منه لدى الرابحين</b> = مرشّح حقيقي لتشديد الفلتر. انسخ الأرقام وأرسلها للمطوّر.
                </div>
              </div>
            )}

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

        {activeTab === "subscribers" && (
          <>
            <div style={{ maxWidth: 460, margin: "0 auto" }}>
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

                <button
                  onClick={enableTwoDevices}
                  disabled={resetBusy}
                  style={{ width: "100%", padding: 13, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.35)", borderRadius: 12, color: "#34d399", fontWeight: 700, fontSize: 14, cursor: resetBusy ? "not-allowed" : "pointer", fontFamily: "system-ui", marginTop: 10 }}
                >
                  📱➕ تفعيل جهاز ثانٍ (PC + جوال)
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

              <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 14, padding: "14px 16px", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>🛡️ حماية المشاركة مفعّلة</div>
                كل مفتاح مربوط بجهاز واحد. لو حاول أحد يستخدمه على جهاز ثاني، يُرفض تلقائياً.
                <br /><br />
                عداد "مرات النقل" يكشف المشاركة: نقل كثير = مشترك يشارك مفتاحه 🚩
              </div>
            </div>
          </>
        )}

        {activeTab === "affiliates" && (
          <>
            {affLoading && <div style={{ textAlign: "center", color: "#334155", padding: 30 }}>جاري التحميل...</div>}

            {!affLoading && (
              <>
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
    
