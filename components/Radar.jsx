import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// ─── Styles خارج الكومبوننت لتجنب re-render ──────────────────────────────
const S = {
  root: {
    minHeight: "100vh",
    background: "#080c18",
    fontFamily: "system-ui",
    color: "#fff",
    position: "relative",
    overflow: "hidden",
  },
  bgWrap: { position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" },
  bgCircle: {
    position: "absolute", top: "10%", left: "50%",
    transform: "translateX(-50%)", width: 600, height: 600,
    background: "radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)",
    borderRadius: "50%",
  },
  bgGrid: {
    position: "absolute", inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px)," +
      "linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)",
    backgroundSize: "50px 50px",
  },
  container: {
    position: "relative", zIndex: 1,
    maxWidth: 920, margin: "0 auto", padding: "24px 16px",
  },
  header: {
    textAlign: "center", marginBottom: 32,
    paddingBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  headerRow: {
    display: "flex", alignItems: "center",
    justifyContent: "center", gap: 12, marginBottom: 10,
  },
  dot: (color) => ({
    width: 10, height: 10, borderRadius: "50%",
    background: color, boxShadow: `0 0 16px ${color}`,
    transition: "background 0.3s, box-shadow 0.3s",
  }),
  title: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: 2, color: "#fff" },
  titleAccent: {
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  badge: {
    fontSize: 10,
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    borderRadius: 4, padding: "3px 8px",
    color: "#fff", fontWeight: 700, letterSpacing: 1,
  },
  subtitle: { margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 1 },
  statsRow: { display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" },
  statBox: (bg, border) => ({
    flex: 1, minWidth: 80, background: bg,
    border: `1px solid ${border}`, borderRadius: 14,
    padding: "14px 16px", textAlign: "center",
  }),
  statNum: (color) => ({
    fontSize: 26, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1,
  }),
  statLabel: (color) => ({ fontSize: 9, color, opacity: 0.7, marginTop: 4 }),
  actionRow: {
    display: "flex", gap: 10, marginBottom: 8,
    flexWrap: "wrap", alignItems: "center",
  },
  scanBtn: (loading) => ({
    flex: 1,
    background: loading ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
    border: loading ? "1px solid rgba(255,255,255,0.1)" : "none",
    borderRadius: 14, padding: "14px 28px",
    color: loading ? "rgba(255,255,255,0.3)" : "#fff",
    fontWeight: 800, fontSize: 14,
    cursor: loading ? "not-allowed" : "pointer",
    letterSpacing: 1, transition: "all 0.2s",
    boxShadow: loading ? "none" : "0 8px 32px rgba(99,102,241,0.4)",
  }),
  filterBtn: (active) => ({
    background: active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)",
    border: `1px solid ${active ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 10, padding: "10px 14px",
    color: active ? "#a5b4fc" : "rgba(255,255,255,0.4)",
    fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
  }),
  autoRow: {
    display: "flex", alignItems: "center", gap: 8,
    marginBottom: 12, justifyContent: "flex-end",
  },
  autoLabel: { fontSize: 10, color: "rgba(255,255,255,0.3)" },
  toggleBtn: (active) => ({
    width: 36, height: 20, borderRadius: 10,
    background: active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.1)",
    border: "none", cursor: "pointer",
    position: "relative", transition: "background 0.3s", flexShrink: 0,
  }),
  toggleThumb: (active) => ({
    position: "absolute", top: 2,
    left: active ? 18 : 2, width: 16, height: 16,
    borderRadius: "50%", background: "#fff", transition: "left 0.3s",
  }),
  progressBar: {
    height: 2, background: "rgba(255,255,255,0.05)",
    borderRadius: 2, marginBottom: 16, overflow: "hidden",
  },
  progressFill: {
    height: "100%", width: "65%",
    background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 2,
  },
  banner: (bg, border) => ({
    background: bg, border: `1px solid ${border}`,
    borderRadius: 10, padding: "10px 16px", marginBottom: 16,
    display: "flex", alignItems: "center", gap: 8,
  }),
  bannerTitle: (color) => ({ fontSize: 12, color, fontWeight: 700 }),
  bannerSub: (color) => ({ fontSize: 10, color }),
  dividerRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  dividerLine: (flip) => ({
    height: 1, flex: 1,
    background: flip
      ? "linear-gradient(90deg,rgba(255,255,255,0.08),transparent)"
      : "linear-gradient(90deg,transparent,rgba(255,255,255,0.08))",
  }),
  dividerText: { fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: 1 },
  emptyBox: {
    textAlign: "center", padding: "64px 20px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)", borderRadius: 20,
  },
  footer: {
    marginTop: 32, paddingTop: 16,
    borderTop: "1px solid rgba(255,255,255,0.04)",
    display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
  },
  // ── Card ──
  cardWrap: (open, glowColor) => ({
    background: "linear-gradient(135deg,rgba(15,20,35,0.95),rgba(20,28,48,0.95))",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16, marginBottom: 10, overflow: "hidden",
    transition: "box-shadow 0.3s",
    boxShadow: open ? `0 8px 32px ${glowColor}` : "0 2px 8px rgba(0,0,0,0.3)",
  }),
  cardHeader: {
    padding: "16px 18px", cursor: "pointer",
    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
  },
  cardIdx: { fontSize: 10, color: "rgba(255,255,255,0.2)", minWidth: 22, fontFamily: "monospace" },
  cardSymbol: { fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: 1, fontFamily: "monospace" },
  cardMcap: { fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 },
  cardTags: { display: "flex", gap: 5, flexWrap: "wrap", flex: 1 },
  tag: (bg, color, border) => ({
    fontSize: 9, padding: "3px 8px", borderRadius: 20,
    background: bg, color, fontWeight: 600, border: `1px solid ${border}`,
  }),
  cardPrice: { fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "monospace" },
  cardChange: (up) => ({ fontSize: 12, color: up ? "#00d4aa" : "#ff4757", fontWeight: 600 }),
  cardScore: (color) => ({ fontSize: 20, fontWeight: 800, color, fontFamily: "monospace", lineHeight: 1 }),
  chevron: (open) => ({
    color: "rgba(255,255,255,0.2)", fontSize: 10,
    transform: open ? "rotate(180deg)" : "none",
    transition: "transform 0.2s", display: "inline-block",
  }),
  detailWrap: { borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 18px" },
  metricsRow: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  metricBox: {
    flex: 1, minWidth: 60,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10, padding: "8px 10px",
  },
  metricLabel: { fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 3 },
  metricValue: (color) => ({ fontSize: 13, color, fontWeight: 700, fontFamily: "monospace" }),
  slBox: {
    background: "linear-gradient(135deg,rgba(255,71,87,0.1),rgba(255,71,87,0.05))",
    border: "1px solid rgba(255,71,87,0.2)", borderRadius: 12, padding: "14px 16px", marginBottom: 10,
  },
  tpGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  tpBox: (bg, border) => ({ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 12 }),
  tpLabel: (color) => ({ fontSize: 9, color, fontWeight: 600, marginBottom: 4 }),
  tpValue: (color) => ({ fontSize: 16, fontWeight: 700, color, fontFamily: "monospace" }),
  // ── Skeleton ──
  skeletonCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16, marginBottom: 10, padding: 18,
    display: "flex", gap: 12, alignItems: "center",
  },
  skeletonBlock: (w, h) => ({
    background: "rgba(255,255,255,0.08)", borderRadius: 6,
    width: w, height: h, flexShrink: 0,
    animation: "pulse 1.5s ease-in-out infinite",
  }),
};

// ─── ScoreBar ─────────────────────────────────────────────────────────────
const ScoreBar = ({ score }) => {
  const color = score >= 80 ? "#ff6b35" : score >= 60 ? "#ffd700" : "#00d4aa";
  return (
    <div style={{ position: "relative", height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${score}%`, background: color, borderRadius: 3, boxShadow: `0 0 8px ${color}`, transition: "width 0.6s ease" }} />
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────
const SkeletonCards = () => (
  <>
    {[1, 2, 3].map((k) => (
      <div key={k} style={S.skeletonCard}>
        <div style={S.skeletonBlock(22, 14)} />
        <div style={S.skeletonBlock(64, 36)} />
        <div style={{ flex: 1, display: "flex", gap: 6 }}>
          <div style={S.skeletonBlock(60, 20)} />
          <div style={S.skeletonBlock(50, 20)} />
        </div>
        <div style={S.skeletonBlock(80, 36)} />
        <div style={S.skeletonBlock(44, 36)} />
      </div>
    ))}
  </>
);

// ─── Card ─────────────────────────────────────────────────────────────────
function Card({ r, idx }) {
  const [open, setOpen] = useState(false);

  const formatPrice = useCallback(
    (n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );
  const formatPct = useCallback(
    (n) => (n >= 0 ? "+" : "") + (+n).toFixed(2) + "%",
    []
  );

  const scoreColor = r.score >= 80 ? "#ff6b35" : r.score >= 60 ? "#ffd700" : "#00d4aa";
  const glowColor  = r.score >= 80 ? "rgba(255,107,53,0.15)" : r.score >= 60 ? "rgba(255,215,0,0.1)" : "rgba(0,212,170,0.1)";

  const metrics = useMemo(() => [
    { label: "EMA 9",  value: r.ema9  ? formatPrice(r.ema9)  : "—", color: "#a78bfa" },
    { label: "EMA 20", value: r.ema20 ? formatPrice(r.ema20) : "—", color: "#fbbf24" },
    { label: "VWAP",   value: r.vwap  ? formatPrice(r.vwap)  : "—", color: "#60a5fa" },
    { label: "RVOL",   value: r.rvol.toFixed(1) + "x",               color: "#fb923c" },
    { label: "حجم",    value: ((r.volume || 0) / 1e6).toFixed(1) + "M", color: "#34d399" },
  ], [r, formatPrice]);

  const tpLevels = useMemo(() => [
    { n: 1, value: r.levels.t1, pct: 15, label: "TP1", color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
    { n: 2, value: r.levels.t2, pct: 30, label: "TP2", color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
    { n: 3, value: r.levels.t3, pct: 50, label: "TP3", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)" },
  ], [r]);

  return (
    <div style={S.cardWrap(open, glowColor)}>
      <div
        style={S.cardHeader}
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
      >
        <span style={S.cardIdx}>{String(idx + 1).padStart(2, "0")}</span>
        <div style={{ minWidth: 64 }}>
          <div style={S.cardSymbol}>{r.symbol}</div>
          <div style={S.cardMcap}>{r.marketCap ? `$${r.marketCap.toFixed(0)}M · ` : ""}☪</div>
        </div>
        <div style={S.cardTags}>
          <span style={S.tag("rgba(255,107,53,0.15)", "#ff6b35", "rgba(255,107,53,0.2)")}>{r.confidence}</span>
          {r.rvol > 3 && <span style={S.tag("rgba(255,215,0,0.1)", "#ffd700", "rgba(255,215,0,0.2)")}>⚡ {r.rvol.toFixed(1)}x</span>}
          {r.aboveVWAP && <span style={S.tag("rgba(0,212,170,0.1)", "#00d4aa", "rgba(0,212,170,0.2)")}>VWAP ↑</span>}
          {r.preGap > 5 && <span style={S.tag("rgba(100,200,255,0.1)", "#64c8ff", "rgba(100,200,255,0.2)")}>Gap +{r.preGap.toFixed(0)}%</span>}
        </div>
        <div style={{ textAlign: "right", minWidth: 80 }}>
          <div style={S.cardPrice}>{formatPrice(r.price)}</div>
          <div style={S.cardChange(r.change_pct >= 0)}>{formatPct(r.change_pct)}</div>
        </div>
        <div style={{ textAlign: "center", minWidth: 44 }}>
          <div style={S.cardScore(scoreColor)}>{r.score}</div>
          <ScoreBar score={r.score} />
        </div>
        <span style={S.chevron(open)}>▼</span>
      </div>

      {open && (
        <div style={S.detailWrap}>
          <div style={S.metricsRow}>
            {metrics.map((m) => (
              <div key={m.label} style={S.metricBox}>
                <div style={S.metricLabel}>{m.label}</div>
                <div style={S.metricValue(m.color)}>{m.value}</div>
              </div>
            ))}
          </div>
          <div style={S.slBox}>
            <div style={{ fontSize: 10, color: "#ff6b81", fontWeight: 600, marginBottom: 8 }}>🛑 وقف الخسارة</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#ff4757", fontFamily: "monospace" }}>{formatPrice(r.levels.sl)}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, color: "#ff6b81", fontWeight: 600 }}>{r.levels.slPct.toFixed(2)}%</div>
                <div style={{ fontSize: 9, color: "rgba(255,107,129,0.5)" }}>مخاطرة: {formatPrice(r.levels.risk)}</div>
              </div>
            </div>
          </div>
          <div style={S.tpGrid}>
            {tpLevels.map((t) => (
              <div key={t.n} style={S.tpBox(t.bg, t.border)}>
                <div style={S.tpLabel(t.color)}>{t.label} <span style={{ opacity: 0.6 }}>+{t.pct}%</span></div>
                <div style={S.tpValue(t.color)}>{formatPrice(t.value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── StatusBanner ─────────────────────────────────────────────────────────
const BANNER_CONFIG = {
  error:     { bg: "rgba(255,71,87,0.1)",    border: "rgba(255,71,87,0.3)",    icon: "🔴", titleColor: "#ff4757", subColor: "rgba(255,71,87,0.7)",    title: "خطأ في الاتصال",    sub: "تعذر الاتصال بـ Polygon API — تحقق من الـ Key" },
  closed:    { bg: "rgba(255,215,0,0.08)",   border: "rgba(255,215,0,0.2)",    icon: "🟡", titleColor: "#ffd700", subColor: "rgba(255,215,0,0.7)",    title: "السوق مغلق",        sub: "يفتح 4:30م بتوقيت الرياض — البيانات من آخر جلسة" },
  premarket: { bg: "rgba(100,200,255,0.08)", border: "rgba(100,200,255,0.2)",  icon: "🔵", titleColor: "#64c8ff", subColor: "rgba(100,200,255,0.7)", title: "Pre-Market نشط",    sub: "بيانات محدودة — أفضل النتائج بعد 4:30م" },
  ok:        { bg: "rgba(0,212,170,0.08)",   border: "rgba(0,212,170,0.2)",    icon: "🟢", titleColor: "#00d4aa", subColor: "rgba(0,212,170,0.7)",   title: "متصل — أسعار حية", sub: "Polygon API يعمل بشكل طبيعي" },
};

function StatusBanner({ status, lastUpdate, scanError }) {
  if (!status) return null;
  const cfg = BANNER_CONFIG[status];
  if (!cfg) return null;
  return (
    <div style={S.banner(cfg.bg, cfg.border)}>
      <span style={{ fontSize: 16 }}>{cfg.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={S.bannerTitle(cfg.titleColor)}>{cfg.title}</div>
        <div style={S.bannerSub(cfg.subColor)}>
          {status === "error" && scanError ? scanError : cfg.sub}
        </div>
      </div>
      {status === "ok" && lastUpdate && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
          آخر تحديث: {lastUpdate.toLocaleTimeString("ar")}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function Radar() {
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [total,       setTotal]       = useState(0);
  const [done,        setDone]        = useState(false);
  const [filter,      setFilter]      = useState("all");
  const [status,      setStatus]      = useState(null);
  const [lastUpdate,  setLastUpdate]  = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [scanError,   setScanError]   = useState(null);

  const lastScanRef  = useRef(0);
  const autoTimerRef = useRef(null);
  const COOLDOWN_MS  = 10_000; // منع الضغط المتكرر — 10 ثواني

  const scan = useCallback(async () => {
    const now = Date.now();
    if (now - lastScanRef.current < COOLDOWN_MS) return;
    lastScanRef.current = now;

    setLoading(true);
    setResults([]);
    setDone(false);
    setStatus(null);
    setScanError(null);

    try {
      const res = await fetch("/api/scan");

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        setScanError(`HTTP ${res.status}${errText ? ": " + errText : ""}`);
        setStatus("error");
        return;
      }

      const data = await res.json();

      if (data.error) {
        setScanError(data.error);
        setStatus("error");
        return;
      }

      setResults(data.results ?? []);
      setTotal(data.total ?? 0);
      setLastUpdate(new Date());

      // تحديد حالة السوق
      const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      const h   = etNow.getHours();
      const m   = etNow.getMinutes();
      const day = etNow.getDay();
      const isWeekend    = day === 0 || day === 6;
      const isMarketOpen = !isWeekend && (h > 9 || (h === 9 && m >= 30)) && h < 16;
      const isPreMarket  = !isWeekend && h >= 4 && (h < 9 || (h === 9 && m < 30));

      if      (isWeekend || h >= 16 || h < 4) setStatus("closed");
      else if (isPreMarket)                    setStatus("premarket");
      else if (isMarketOpen)                   setStatus("ok");
      else                                     setStatus("closed");

    } catch (err) {
      setScanError(err.message ?? "Network error");
      setStatus("error");
    } finally {
      setLoading(false);
      setDone(true);
    }
  }, []);

  // Auto-refresh كل 60 ثانية
  useEffect(() => {
    if (autoRefresh) {
      autoTimerRef.current = setInterval(scan, 60_000);
    } else {
      clearInterval(autoTimerRef.current);
    }
    return () => clearInterval(autoTimerRef.current);
  }, [autoRefresh, scan]);

  const filtered = useMemo(() => {
    if (filter === "explosive") return results.filter((r) => r.score >= 80);
    if (filter === "high")      return results.filter((r) => r.score >= 60 && r.score < 80);
    if (filter === "watch")     return results.filter((r) => r.score < 60);
    return results;
  }, [results, filter]);

  const explosive = useMemo(() => results.filter((r) => r.score >= 80).length, [results]);
  const high      = useMemo(() => results.filter((r) => r.score >= 60 && r.score < 80).length, [results]);

  const dotColor = loading ? "#ffd700" : status === "ok" ? "#00d4aa" : status === "error" ? "#ff4757" : "#6366f1";

  return (
    <div style={S.root}>
      <div style={S.bgWrap}>
        <div style={S.bgCircle} />
        <div style={S.bgGrid} />
      </div>

      <div style={S.container}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.headerRow}>
            <div style={S.dot(dotColor)} />
            <h1 style={S.title}>
              RADAR <span style={S.titleAccent}>AZ</span>
            </h1>
            <span style={S.badge}>PRO</span>
          </div>
          <p style={S.subtitle}>أسهم أمريكية شرعية · ماركت كاب &lt; $500M · تحليل لحظي</p>
        </div>

        {/* Stats */}
        <div style={S.statsRow}>
          {[
            { label: "نطاق الفحص", value: total || 100, color: "#6366f1", bg: "rgba(99,102,241,0.1)",  border: "rgba(99,102,241,0.2)"  },
            { label: "💥 انفجاري", value: explosive,     color: "#ff6b35", bg: "rgba(255,107,53,0.1)", border: "rgba(255,107,53,0.2)"  },
            { label: "🔥 عالي",    value: high,           color: "#ffd700", bg: "rgba(255,215,0,0.1)",  border: "rgba(255,215,0,0.2)"   },
            { label: "✅ الكل",    value: results.length, color: "#00d4aa", bg: "rgba(0,212,170,0.1)", border: "rgba(0,212,170,0.2)"   },
          ].map((s) => (
            <div key={s.label} style={S.statBox(s.bg, s.border)}>
              <div style={S.statNum(s.color)}>{s.value}</div>
              <div style={S.statLabel(s.color)}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={S.actionRow}>
          <button onClick={scan} disabled={loading} style={S.scanBtn(loading)}>
            {loading ? "⟳  جاري المسح اللحظي..." : "📡  ابدأ مسح السوق الفوري"}
          </button>
          {results.length > 0 && (
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { id: "all",       label: "الكل" },
                { id: "explosive", label: "💥"   },
                { id: "high",      label: "🔥"   },
                { id: "watch",     label: "👀"   },
              ].map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={S.filterBtn(filter === f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auto-refresh toggle */}
        <div style={S.autoRow}>
          <span style={S.autoLabel}>تحديث تلقائي كل دقيقة</span>
          <button style={S.toggleBtn(autoRefresh)} onClick={() => setAutoRefresh((v) => !v)}>
            <div style={S.toggleThumb(autoRefresh)} />
          </button>
        </div>

        {/* Progress bar */}
        {loading && (
          <div style={S.progressBar}>
            <div style={S.progressFill} />
          </div>
        )}

        {/* Skeleton */}
        {loading && <SkeletonCards />}

        {/* Status Banner */}
        {(done || loading) && (
          <StatusBanner status={status} lastUpdate={lastUpdate} scanError={scanError} />
        )}

        {/* Results */}
        {!loading && filtered.length > 0 && (
          <>
            <div style={S.dividerRow}>
              <div style={S.dividerLine(false)} />
              <span style={S.dividerText}>{filtered.length} فرصة</span>
              <div style={S.dividerLine(true)} />
            </div>
            {filtered.map((r, i) => (
              <Card key={r.symbol} r={r} idx={i} />
            ))}
          </>
        )}

        {/* Empty state */}
        {done && !loading && results.length === 0 && (
          <div style={S.emptyBox}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>لا توجد فرص حالياً</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>السوق يفتح 4:30م بتوقيت الرياض</div>
          </div>
        )}

        {/* Footer */}
        <div style={S.footer}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: 2, fontFamily: "monospace" }}>RADAR AZ PRO</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", fontStyle: "italic" }}>أسهم شرعية · ليست نصيحة استثمارية</span>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #080c18; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        button:hover:not(:disabled) { filter: brightness(1.1); }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </div>
  );
}
