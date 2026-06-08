import { useState, useCallback, useMemo, useRef, useEffect } from "react";

const T = {
  ar: {
    title: "رادار",
    subtitle: "الشرعية مسؤوليتك · الالتزام بوقف الخسارة يخفف المخاطرة",
    trial: "🕐 تجربة مجانية",
    subscribed: "✅ مشترك",
    logout: "خروج",
    scanRange: "نطاق الفحص",
    explosive: "💥 انفجاري",
    high: "🔥 عالي",
    all: "✅ الكل",
    scanBtn: "📡  ابدأ مسح السوق الفوري",
    scanning: "⟳  جاري المسح اللحظي...",
    autoRefresh: "تحديث تلقائي كل دقيقة",
    filterAll: "الكل",
    filterLeaders: "🏆 قيادي",
    filterSpec: "💥 مضاربة",
    opportunities: "فرصة",
    noOpps: "لا توجد فرص حالياً",
    marketClosed: "السوق يفتح 4:30م بتوقيت الرياض",
    stopLoss: "🛑 وقف الخسارة",
    risk: "مخاطرة",
    volume: "حجم",
    footer1: "RADAR AZ PRO",
    footer2: "أسهم شرعية · ليست نصيحة استثمارية",
    loginTitle: "أدخل مفتاح الاشتراك للوصول للرادار",
    loginBtn: "🔓 دخول",
    loginLoading: "⟳ جاري التحقق...",
    loginError: "المفتاح غير صحيح — تحقق من المفتاح وحاول مجدداً",
    loginConnError: "خطأ في الاتصال — حاول مجدداً",
    expired: "⏰ انتهى اشتراكك — جدد للوصول الكامل",
    renewLink: "جدد الاشتراك ←",
    noKey: "ليس لديك مفتاح؟",
    freeTrial: "جرّب مجاناً 24 ساعة ←",
    bannerError: "خطأ في الاتصال",
    bannerErrorSub: "تعذر الاتصال بـ Polygon API",
    bannerClosed: "السوق مغلق",
    bannerClosedSub: "يفتح 4:30م بتوقيت الرياض",
    bannerPre: "Pre-Market نشط",
    bannerPreSub: "أفضل النتائج بعد 4:30م",
    bannerOk: "متصل — أسعار حية",
    bannerOkSub: "Polygon API يعمل بشكل طبيعي",
    lastUpdate: "آخر تحديث",
    largeCap: "🐋 Large Cap",
    midCap: "🦈 Mid Cap",
    smallCap: "🐟 Small Cap",
    microCap: "🦐 Micro Cap",
    sectionLeaders: "🏆 أسهم قيادية",
    sectionSpec: "💥 مضاربة لحظية",
    tapToExpand: "اضغط للعرض",
    tapToCollapse: "اضغط للإخفاء",
  },
  en: {
    title: "Radar",
    subtitle: "Shariah compliance is your responsibility · Stop loss reduces risk",
    trial: "🕐 Free Trial",
    subscribed: "✅ Subscribed",
    logout: "Logout",
    scanRange: "Scan Range",
    explosive: "💥 Explosive",
    high: "🔥 High",
    all: "✅ All",
    scanBtn: "📡  Start Live Market Scan",
    scanning: "⟳  Scanning in progress...",
    autoRefresh: "Auto refresh every minute",
    filterAll: "All",
    filterLeaders: "🏆 Leaders",
    filterSpec: "💥 Speculation",
    opportunities: "opportunities",
    noOpps: "No opportunities found",
    marketClosed: "Market opens at 9:30 AM ET",
    stopLoss: "🛑 Stop Loss",
    risk: "Risk",
    volume: "Volume",
    footer1: "RADAR AZ PRO",
    footer2: "Halal Stocks · Not investment advice",
    loginTitle: "Enter your subscription key to access the radar",
    loginBtn: "🔓 Login",
    loginLoading: "⟳ Verifying...",
    loginError: "Invalid key — please check your key and try again",
    loginConnError: "Connection error — please try again",
    expired: "⏰ Your subscription has expired — renew for full access",
    renewLink: "Renew subscription →",
    noKey: "Don't have a key?",
    freeTrial: "Try free for 24 hours →",
    bannerError: "Connection Error",
    bannerErrorSub: "Failed to connect to Polygon API",
    bannerClosed: "Market Closed",
    bannerClosedSub: "Opens at 9:30 AM ET",
    bannerPre: "Pre-Market Active",
    bannerPreSub: "Best results after 9:30 AM ET",
    bannerOk: "Connected — Live Prices",
    bannerOkSub: "Polygon API working normally",
    lastUpdate: "Last update",
    largeCap: "🐋 Large Cap",
    midCap: "🦈 Mid Cap",
    smallCap: "🐟 Small Cap",
    microCap: "🦐 Micro Cap",
    sectionLeaders: "🏆 Leadership Stocks",
    sectionSpec: "💥 Speculation",
    tapToExpand: "Tap to expand",
    tapToCollapse: "Tap to collapse",
  }
};

const S = {
  root: { minHeight: "100vh", background: "#080c18", fontFamily: "system-ui", color: "#fff", position: "relative", overflow: "hidden" },
  bgWrap: { position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" },
  bgCircle: { position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, background: "radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)", borderRadius: "50%" },
  bgGrid: { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)", backgroundSize: "50px 50px" },
  container: { position: "relative", zIndex: 1, maxWidth: 920, margin: "0 auto", padding: "24px 16px" },
  header: { textAlign: "center", marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)" },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10 },
  dot: (color) => ({ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 16px ${color}`, transition: "background 0.3s, box-shadow 0.3s" }),
  title: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: 2, color: "#fff" },
  titleAccent: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  badge: { fontSize: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 4, padding: "3px 8px", color: "#fff", fontWeight: 700, letterSpacing: 1 },
  subtitle: { margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 1 },
  langBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "5px 12px", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer", fontFamily: "system-ui", marginTop: 8 },
  statsRow: { display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" },
  statBox: (bg, border) => ({ flex: 1, minWidth: 80, background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "14px 16px", textAlign: "center" }),
  statNum: (color) => ({ fontSize: 26, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1 }),
  statLabel: (color) => ({ fontSize: 9, color, opacity: 0.7, marginTop: 4 }),
  actionRow: { display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap", alignItems: "center" },
  scanBtn: (loading) => ({ flex: 1, background: loading ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", border: loading ? "1px solid rgba(255,255,255,0.1)" : "none", borderRadius: 14, padding: "14px 28px", color: loading ? "rgba(255,255,255,0.3)" : "#fff", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", letterSpacing: 1, transition: "all 0.2s", boxShadow: loading ? "none" : "0 8px 32px rgba(99,102,241,0.4)" }),
  filterBtn: (active) => ({ background: active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)", border: `1px solid ${active ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "10px 14px", color: active ? "#a5b4fc" : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }),
  autoRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12, justifyContent: "flex-end" },
  autoLabel: { fontSize: 10, color: "rgba(255,255,255,0.3)" },
  toggleBtn: (active) => ({ width: 36, height: 20, borderRadius: 10, background: active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.3s", flexShrink: 0 }),
  toggleThumb: (active) => ({ position: "absolute", top: 2, left: active ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.3s" }),
  progressBar: { height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 2, marginBottom: 16, overflow: "hidden" },
  progressFill: { height: "100%", width: "65%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 2 },
  banner: (bg, border) => ({ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }),
  bannerTitle: (color) => ({ fontSize: 12, color, fontWeight: 700 }),
  bannerSub: (color) => ({ fontSize: 10, color }),
  dividerRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  dividerLine: (flip) => ({ height: 1, flex: 1, background: flip ? "linear-gradient(90deg,rgba(255,255,255,0.08),transparent)" : "linear-gradient(90deg,transparent,rgba(255,255,255,0.08))" }),
  dividerText: { fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: 1 },
  // ✅ Section header — قابل للطي
  sectionHeader: (bg, border, color, open) => ({
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: open ? "14px 14px 0 0" : 14,
    padding: "14px 18px",
    marginBottom: 0,
    marginTop: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    userSelect: "none",
    transition: "border-radius 0.2s",
  }),
  sectionTitle: (color) => ({ fontSize: 14, fontWeight: 800, color, letterSpacing: 1 }),
  sectionCount: (color, bg) => ({ fontSize: 13, fontWeight: 800, color, background: bg, borderRadius: 20, padding: "2px 10px", fontFamily: "monospace" }),
  sectionChevron: (open) => ({ fontSize: 10, color: "rgba(255,255,255,0.4)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block", marginRight: 8 }),
  sectionBody: (open) => ({
    overflow: "hidden",
    maxHeight: open ? "9999px" : 0,
    transition: "max-height 0.3s ease",
    border: open ? "1px solid rgba(255,255,255,0.07)" : "none",
    borderTop: "none",
    borderRadius: "0 0 14px 14px",
    padding: open ? "10px 0 0 0" : 0,
    marginBottom: open ? 12 : 0,
  }),
  emptyBox: { textAlign: "center", padding: "64px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 20 },
  footer: { marginTop: 32, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  cardWrap: (open, glowColor) => ({ background: "linear-gradient(135deg,rgba(15,20,35,0.95),rgba(20,28,48,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, marginBottom: 10, overflow: "hidden", transition: "box-shadow 0.3s", boxShadow: open ? `0 8px 32px ${glowColor}` : "0 2px 8px rgba(0,0,0,0.3)" }),
  cardHeader: { padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  cardIdx: { fontSize: 10, color: "rgba(255,255,255,0.2)", minWidth: 22, fontFamily: "monospace" },
  cardSymbol: { fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: 1, fontFamily: "monospace" },
  cardMcap: { fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 },
  cardTags: { display: "flex", gap: 5, flexWrap: "wrap", flex: 1 },
  tag: (bg, color, border) => ({ fontSize: 9, padding: "3px 8px", borderRadius: 20, background: bg, color, fontWeight: 600, border: `1px solid ${border}` }),
  cardPrice: { fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "monospace" },
  cardChange: (up) => ({ fontSize: 12, color: up ? "#00d4aa" : "#ff4757", fontWeight: 600 }),
  cardScore: (color) => ({ fontSize: 20, fontWeight: 800, color, fontFamily: "monospace", lineHeight: 1 }),
  chevron: (open) => ({ color: "rgba(255,255,255,0.2)", fontSize: 10, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }),
  detailWrap: { borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 18px" },
  metricsRow: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  metricBox: { flex: 1, minWidth: 60, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "8px 10px" },
  metricLabel: { fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 3 },
  metricValue: (color) => ({ fontSize: 13, color, fontWeight: 700, fontFamily: "monospace" }),
  slBox: { background: "linear-gradient(135deg,rgba(255,71,87,0.1),rgba(255,71,87,0.05))", border: "1px solid rgba(255,71,87,0.2)", borderRadius: 12, padding: "14px 16px", marginBottom: 10 },
  tpGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  tpBox: (bg, border) => ({ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 12 }),
  tpLabel: (color) => ({ fontSize: 9, color, fontWeight: 600, marginBottom: 4 }),
  tpValue: (color) => ({ fontSize: 15, fontWeight: 700, color, fontFamily: "monospace" }),
  tpPct: (color) => ({ fontSize: 11, color, fontWeight: 600, marginTop: 3, opacity: 0.85 }),
  skeletonCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, marginBottom: 10, padding: 18, display: "flex", gap: 12, alignItems: "center" },
  skeletonBlock: (w, h) => ({ background: "rgba(255,255,255,0.08)", borderRadius: 6, width: w, height: h, flexShrink: 0, animation: "pulse 1.5s ease-in-out infinite" }),
  loginWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", zIndex: 1 },
  loginBox: { background: "linear-gradient(135deg,rgba(15,20,35,0.98),rgba(20,28,48,0.98))", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 24, padding: "40px 32px", maxWidth: 420, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.6)", textAlign: "center" },
  loginInput: { width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "monospace", letterSpacing: 2, textAlign: "center", marginBottom: 12, outline: "none", boxSizing: "border-box" },
  loginBtn: (loading) => ({ width: "100%", padding: "14px", background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", fontFamily: "system-ui", letterSpacing: 1, transition: "all 0.2s", boxShadow: loading ? "none" : "0 8px 24px rgba(99,102,241,0.4)" }),
  loginError: { background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ff4757", marginBottom: 12 },
  loginExpired: { background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ffd700", marginBottom: 12 },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", color: "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", fontFamily: "system-ui" },
};

const ScoreBar = ({ score }) => {
  const color = score >= 80 ? "#ff6b35" : score >= 60 ? "#ffd700" : "#00d4aa";
  return (
    <div style={{ position: "relative", height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${score}%`, background: color, borderRadius: 3, boxShadow: `0 0 8px ${color}`, transition: "width 0.6s ease" }} />
    </div>
  );
};

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

function getMarketCapInfo(mcap, t) {
  if (!mcap) return null;
  if (mcap >= 10000) return { label: t.largeCap, color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.25)" };
  if (mcap >= 2000)  return { label: t.midCap,   color: "#34d399", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.25)" };
  if (mcap >= 300)   return { label: t.smallCap,  color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)" };
  return               { label: t.microCap,  color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" };
}

function fmtPct(n) {
  if (n == null) return "";
  return (n >= 0 ? "+" : "") + (+n).toFixed(2) + "%";
}

function Card({ r, idx, t }) {
  const [open, setOpen] = useState(false);
  const formatPrice = useCallback((n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);
  const formatPct = useCallback((n) => (n >= 0 ? "+" : "") + (+n).toFixed(2) + "%", []);
  const scoreColor = r.score >= 80 ? "#ff6b35" : r.score >= 60 ? "#ffd700" : "#00d4aa";
  const glowColor = r.score >= 80 ? "rgba(255,107,53,0.15)" : r.score >= 60 ? "rgba(255,215,0,0.1)" : "rgba(0,212,170,0.1)";
  const mcapInfo = getMarketCapInfo(r.marketCap, t);

  const typeTag = r.type === "قيادي"
    ? { label: "🏆 قيادي", color: "#818cf8", bg: "rgba(129,140,248,0.12)", border: "rgba(129,140,248,0.25)" }
    : { label: "💥 مضاربة", color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.25)" };

  const metrics = useMemo(() => [
    { label: "EMA 9", value: r.ema9 ? formatPrice(r.ema9) : "—", color: "#a78bfa" },
    { label: "EMA 20", value: r.ema20 ? formatPrice(r.ema20) : "—", color: "#fbbf24" },
    { label: "VWAP", value: r.vwap ? formatPrice(r.vwap) : "—", color: "#60a5fa" },
    { label: "RVOL", value: r.rvol ? r.rvol.toFixed(1) + "x" : "—", color: "#fb923c" },
    { label: t.volume, value: ((r.volume || 0) / 1e6).toFixed(1) + "M", color: "#34d399" },
  ], [r, formatPrice, t]);

  const tpLevels = useMemo(() => [
    { n: 1, value: r.levels.t1, pct: r.levels.t1Pct, label: "TP1", color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" },
    { n: 2, value: r.levels.t2, pct: r.levels.t2Pct, label: "TP2", color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
    { n: 3, value: r.levels.t3, pct: r.levels.t3Pct, label: "TP3", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)" },
  ], [r]);

  return (
    <div style={S.cardWrap(open, glowColor)}>
      <div style={S.cardHeader} onClick={() => setOpen((o) => !o)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}>
        <span style={S.cardIdx}>{String(idx + 1).padStart(2, "0")}</span>
        <div style={{ minWidth: 64 }}>
          <div style={S.cardSymbol}>{r.symbol}</div>
          <div style={S.cardMcap}>{r.marketCap ? `$${r.marketCap.toFixed(0)}M` : ""}</div>
        </div>
        <div style={S.cardTags}>
          <span style={S.tag("rgba(255,107,53,0.15)", "#ff6b35", "rgba(255,107,53,0.2)")}>{r.signal}</span>
          <span style={S.tag(typeTag.bg, typeTag.color, typeTag.border)}>{typeTag.label}</span>
          {mcapInfo && <span style={S.tag(mcapInfo.bg, mcapInfo.color, mcapInfo.border)}>{mcapInfo.label}</span>}
          {r.rvol && r.rvol > 3 && <span style={S.tag("rgba(255,215,0,0.1)", "#ffd700", "rgba(255,215,0,0.2)")}>⚡ {r.rvol.toFixed(1)}x</span>}
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
            <div style={{ fontSize: 10, color: "#ff6b81", fontWeight: 600, marginBottom: 8 }}>{t.stopLoss}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#ff4757", fontFamily: "monospace" }}>{formatPrice(r.levels.sl)}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, color: "#ff6b81", fontWeight: 600 }}>{fmtPct(r.levels.slPct)}</div>
                <div style={{ fontSize: 9, color: "rgba(255,107,129,0.5)" }}>{t.risk}: {formatPrice(r.levels.risk)}</div>
              </div>
            </div>
          </div>
          <div style={S.tpGrid}>
            {tpLevels.map((tp) => (
              <div key={tp.n} style={S.tpBox(tp.bg, tp.border)}>
                <div style={S.tpLabel(tp.color)}>{tp.label}</div>
                <div style={S.tpValue(tp.color)}>{formatPrice(tp.value)}</div>
                <div style={S.tpPct(tp.color)}>{fmtPct(tp.pct)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ✅ Section header قابل للطي مع عداد
function CollapsibleSection({ title, count, color, bg, border, children, t }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div
        style={S.sectionHeader(bg, border, color, open)}
        onClick={() => setOpen(o => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen(o => !o)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={S.sectionChevron(open)}>▼</span>
          <span style={S.sectionTitle(color)}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
            {open ? t.tapToCollapse : t.tapToExpand}
          </span>
          <span style={S.sectionCount(color, bg + "aa")}>{count}</span>
        </div>
      </div>
      <div style={S.sectionBody(open)}>
        {children}
      </div>
    </div>
  );
}

function StatusBanner({ status, lastUpdate, scanError, t }) {
  if (!status) return null;
  const configs = {
    error:     { bg: "rgba(255,71,87,0.1)",    border: "rgba(255,71,87,0.3)",   icon: "🔴", titleColor: "#ff4757", subColor: "rgba(255,71,87,0.7)",   title: t.bannerError,  sub: t.bannerErrorSub },
    closed:    { bg: "rgba(255,215,0,0.08)",   border: "rgba(255,215,0,0.2)",   icon: "🟡", titleColor: "#ffd700", subColor: "rgba(255,215,0,0.7)",   title: t.bannerClosed, sub: t.bannerClosedSub },
    premarket: { bg: "rgba(100,200,255,0.08)", border: "rgba(100,200,255,0.2)", icon: "🔵", titleColor: "#64c8ff", subColor: "rgba(100,200,255,0.7)", title: t.bannerPre,    sub: t.bannerPreSub },
    ok:        { bg: "rgba(0,212,170,0.08)",   border: "rgba(0,212,170,0.2)",   icon: "🟢", titleColor: "#00d4aa", subColor: "rgba(0,212,170,0.7)",  title: t.bannerOk,     sub: t.bannerOkSub },
  };
  const cfg = configs[status];
  if (!cfg) return null;
  return (
    <div style={S.banner(cfg.bg, cfg.border)}>
      <span style={{ fontSize: 16 }}>{cfg.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={S.bannerTitle(cfg.titleColor)}>{cfg.title}</div>
        <div style={S.bannerSub(cfg.subColor)}>{status === "error" && scanError ? scanError : cfg.sub}</div>
      </div>
      {status === "ok" && lastUpdate && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{t.lastUpdate}: {lastUpdate.toLocaleTimeString()}</div>
      )}
    </div>
  );
}

function LoginScreen({ onLogin, t, lang, setLang }) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expired, setExpired] = useState(false);

  const handleLogin = async () => {
    if (!key.trim()) return;
    setLoading(true);
    setError(null);
    setExpired(false);
    try {
      const res = await fetch(`/api/verify-key?key=${key.trim()}`);
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem("radar_key", key.trim());
        localStorage.setItem("radar_plan", data.plan);
        localStorage.setItem("radar_expires", data.expires_at);
        onLogin({ key: key.trim(), plan: data.plan, expires_at: data.expires_at });
      } else if (data.reason === "expired") {
        setExpired(true);
      } else {
        setError(t.loginError);
      }
    } catch {
      setError(t.loginConnError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.loginWrap}>
      <div style={S.loginBox}>
        <div style={{ textAlign: "right", marginBottom: 8 }}>
          <button style={S.langBtn} onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
            {lang === "ar" ? "🇺🇸 English" : "🇸🇦 عربي"}
          </button>
        </div>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 3, marginBottom: 8 }}>
          RADAR <span style={S.titleAccent}>AZ</span>
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32, lineHeight: 1.6 }}>
          {t.loginTitle}
        </div>

        {error && <div style={S.loginError}>{error}</div>}
        {expired && (
          <div style={S.loginExpired}>
            {t.expired}
            <div style={{ marginTop: 8 }}>
              <a href="https://radaraz.com" style={{ color: "#ffd700", fontSize: 12 }}>{t.renewLink}</a>
            </div>
          </div>
        )}

        <input
          style={S.loginInput}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          maxLength={19}
          dir="ltr"
        />

        <button style={S.loginBtn(loading)} onClick={handleLogin} disabled={loading}>
          {loading ? t.loginLoading : t.loginBtn}
        </button>

        <div style={{ marginTop: 24, padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{t.noKey}</div>
          <a href="/trial" style={{ fontSize: 12, color: "#6366f1" }}>{t.freeTrial}</a>
        </div>
      </div>
    </div>
  );
}

export default function Radar() {
  const [lang, setLang] = useState("ar");
  const t = T[lang];
  const isRtl = lang === "ar";

  const [auth, setAuth] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [results, setResults] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [speculation, setSpeculation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [scanError, setScanError] = useState(null);

  const lastScanRef = useRef(0);
  const autoTimerRef = useRef(null);
  const COOLDOWN_MS = 10_000;

  useEffect(() => {
    const savedKey = localStorage.getItem("radar_key");
    const savedExpires = localStorage.getItem("radar_expires");
    const savedPlan = localStorage.getItem("radar_plan");
    if (savedKey && savedExpires) {
      const expires = new Date(savedExpires);
      if (new Date() < expires) {
        setAuth({ key: savedKey, plan: savedPlan, expires_at: savedExpires });
      } else {
        localStorage.removeItem("radar_key");
        localStorage.removeItem("radar_plan");
        localStorage.removeItem("radar_expires");
      }
    }
    setAuthChecked(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("radar_key");
    localStorage.removeItem("radar_plan");
    localStorage.removeItem("radar_expires");
    setAuth(null);
  };

  const scan = useCallback(async () => {
    const now = Date.now();
    if (now - lastScanRef.current < COOLDOWN_MS) return;
    lastScanRef.current = now;
    setLoading(true);
    setResults([]);
    setLeaders([]);
    setSpeculation([]);
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
      if (data.error) { setScanError(data.error); setStatus("error"); return; }
      setResults(data.results ?? []);
      setLeaders(data.leaders ?? []);
      setSpeculation(data.speculation ?? []);
      setTotal(data.total ?? 0);
      setLastUpdate(new Date());
      const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      const h = etNow.getHours(), m = etNow.getMinutes(), day = etNow.getDay();
      const isWeekend = day === 0 || day === 6;
      const isMarketOpen = !isWeekend && (h > 9 || (h === 9 && m >= 30)) && h < 16;
      const isPreMarket = !isWeekend && h >= 4 && (h < 9 || (h === 9 && m < 30));
      if (isWeekend || h >= 16 || h < 4) setStatus("closed");
      else if (isPreMarket) setStatus("premarket");
      else if (isMarketOpen) setStatus("ok");
      else setStatus("closed");
    } catch (err) {
      setScanError(err.message ?? "Network error");
      setStatus("error");
    } finally {
      setLoading(false);
      setDone(true);
    }
  }, []);

  useEffect(() => {
    if (autoRefresh) { autoTimerRef.current = setInterval(scan, 60_000); }
    else { clearInterval(autoTimerRef.current); }
    return () => clearInterval(autoTimerRef.current);
  }, [autoRefresh, scan]);

  const filtered = useMemo(() => {
    if (filter === "leaders") return leaders;
    if (filter === "speculation") return speculation;
    if (filter === "explosive") return results.filter((r) => r.score >= 80);
    if (filter === "high") return results.filter((r) => r.score >= 60 && r.score < 80);
    if (filter === "watch") return results.filter((r) => r.score < 60);
    return results;
  }, [results, leaders, speculation, filter]);

  const explosive = useMemo(() => results.filter((r) => r.score >= 80).length, [results]);
  const high = useMemo(() => results.filter((r) => r.score >= 60 && r.score < 80).length, [results]);
  const dotColor = loading ? "#ffd700" : status === "ok" ? "#00d4aa" : status === "error" ? "#ff4757" : "#6366f1";

  const showSections = filter === "all" && leaders.length > 0 && speculation.length > 0;

  if (!authChecked) return null;
  if (!auth) return (
    <div style={S.root} dir={isRtl ? "rtl" : "ltr"}>
      <div style={S.bgWrap}><div style={S.bgCircle} /><div style={S.bgGrid} /></div>
      <LoginScreen onLogin={setAuth} t={t} lang={lang} setLang={setLang} />
    </div>
  );

  return (
    <div style={S.root} dir={isRtl ? "rtl" : "ltr"}>
      <div style={S.bgWrap}><div style={S.bgCircle} /><div style={S.bgGrid} /></div>
      <div style={S.container}>
        <div style={S.header}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button style={S.langBtn} onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
              {lang === "ar" ? "🇺🇸 English" : "🇸🇦 عربي"}
            </button>
          </div>
          <div style={S.headerRow}>
            <div style={S.dot(dotColor)} />
            <h1 style={S.title}>RADAR <span style={S.titleAccent}>AZ</span></h1>
            <span style={S.badge}>PRO</span>
          </div>
          <p style={S.subtitle}>{t.subtitle}</p>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
              {auth.plan === "trial" ? t.trial : t.subscribed} · {auth.key}
            </span>
            <button style={S.logoutBtn} onClick={handleLogout}>{t.logout}</button>
          </div>
        </div>

        <div style={S.statsRow}>
          {[
            { label: t.scanRange, value: "+1,000", color: "#6366f1", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)" },
            { label: t.explosive, value: explosive, color: "#ff6b35", bg: "rgba(255,107,53,0.1)", border: "rgba(255,107,53,0.2)" },
            { label: t.high, value: high, color: "#ffd700", bg: "rgba(255,215,0,0.1)", border: "rgba(255,215,0,0.2)" },
            { label: t.all, value: results.length, color: "#00d4aa", bg: "rgba(0,212,170,0.1)", border: "rgba(0,212,170,0.2)" },
          ].map((s) => (
            <div key={s.label} style={S.statBox(s.bg, s.border)}>
              <div style={{ ...S.statNum(s.color), fontSize: typeof s.value === 'string' ? 18 : 26 }}>{s.value}</div>
              <div style={S.statLabel(s.color)}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={S.actionRow}>
          <button onClick={scan} disabled={loading} style={S.scanBtn(loading)}>
            {loading ? t.scanning : t.scanBtn}
          </button>
          {results.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "all",         label: t.filterAll },
                { id: "leaders",     label: t.filterLeaders },
                { id: "speculation", label: t.filterSpec },
                { id: "explosive",   label: "💥" },
                { id: "high",        label: "🔥" },
                { id: "watch",       label: "👀" },
              ].map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={S.filterBtn(filter === f.id)}>{f.label}</button>
              ))}
            </div>
          )}
        </div>

        <div style={S.autoRow}>
          <span style={S.autoLabel}>{t.autoRefresh}</span>
          <button style={S.toggleBtn(autoRefresh)} onClick={() => setAutoRefresh((v) => !v)}>
            <div style={S.toggleThumb(autoRefresh)} />
          </button>
        </div>

        {loading && <div style={S.progressBar}><div style={S.progressFill} /></div>}
        {loading && <SkeletonCards />}
        {(done || loading) && <StatusBanner status={status} lastUpdate={lastUpdate} scanError={scanError} t={t} />}

        {/* ✅ عرض مقسم قيادي / مضاربة مع Accordion */}
        {!loading && done && showSections && (
          <>
            <CollapsibleSection
              title={t.sectionLeaders}
              count={leaders.length}
              color="#818cf8"
              bg="rgba(129,140,248,0.08)"
              border="rgba(129,140,248,0.2)"
              t={t}
            >
              {leaders.map((r, i) => <Card key={r.symbol} r={r} idx={i} t={t} />)}
            </CollapsibleSection>

            <CollapsibleSection
              title={t.sectionSpec}
              count={speculation.length}
              color="#f87171"
              bg="rgba(248,113,113,0.08)"
              border="rgba(248,113,113,0.2)"
              t={t}
            >
              {speculation.map((r, i) => <Card key={r.symbol} r={r} idx={i} t={t} />)}
            </CollapsibleSection>
          </>
        )}

        {/* عرض عادي (فلتر محدد) */}
        {!loading && filtered.length > 0 && !showSections && (
          <>
            <div style={S.dividerRow}>
              <div style={S.dividerLine(false)} />
              <span style={S.dividerText}>{filtered.length} {t.opportunities}</span>
              <div style={S.dividerLine(true)} />
            </div>
            {filtered.map((r, i) => <Card key={r.symbol} r={r} idx={i} t={t} />)}
          </>
        )}

        {done && !loading && results.length === 0 && (
          <div style={S.emptyBox}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔴</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
              {status === "closed" ? "السوق مغلق حالياً" : t.noOpps}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
              {status === "closed" ? "⏰ يفتح الاثنين الساعة 4:30 مساء بتوقيت الرياض" : t.marketClosed}
            </div>
            {status === "closed" && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>
                السبت والأحد إجازة — السوق الأمريكي
              </div>
            )}
          </div>
        )}

        <div style={S.footer}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: 2, fontFamily: "monospace" }}>{t.footer1}</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", fontStyle: "italic" }}>{t.footer2}</span>
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
