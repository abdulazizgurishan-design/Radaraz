import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// حقن حركة نبض اللمبة مرة واحدة (آمن مع SSR)
if (typeof document !== "undefined" && !document.getElementById("az-kf")) {
  const _el = document.createElement("style");
  _el.id = "az-kf";
  _el.textContent = "@keyframes azpulse{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.5),0 0 8px rgba(52,211,153,.9)}50%{box-shadow:0 0 0 6px rgba(52,211,153,0),0 0 14px rgba(52,211,153,1)}}";
  document.head.appendChild(_el);
}

const DISPLAY_MIN_SCORE = 60;

const T = {
  ar: {
    title: "رادار",
    subtitle: "الالتزام بوقف الخسارة يخفف المخاطرة",
    trial: "🕐 تجربة مجانية",
    subscribed: "✅ مشترك",
    logout: "خروج",
    scanRange: "إشارات اليوم",
    all: "✅ الكل",
    scanBtn: "📡 مسح السوق الفوري",
    scanning: "⟳ جاري المسح...",
    autoRefresh: "تحديث تلقائي كل دقيقة",
    filterAll: "الكل",
    filterLeaders: "📈 استثمار",
    filterSpec: "⚡ مضاربة",
    filterRebound: "🔄 ارتداد",
    filterSniper: "🎯 القناص",
    sectionRebound: "🔄 ارتداد الأسهم القوية",
    sectionReboundSub: "أسهم قوية ترتد من تصحيح مؤقت · صفقة أيام",
    marketMovers: "📊 حركة السوق",
    marketMoversSub: "أعلى الأسهم حركة في السوق · اضغط أي سهم لتحليل بنيته",
    opportunities: "فرصة",
    noOpps: "لا توجد فرص حالياً",
    marketClosed: "سيتم تحديث الإشارات بعد مسح الأدمن",
    stopLoss: "🛑 وقف الخسارة",
    risk: "مخاطرة",
    volume: "حجم",
    footer1: "RADAR AZ PRO",
    footer2: "ليست نصيحة استثمارية · مسح أكثر من 10,000 سهم · تحليل فني عميق",
    loginTitle: "أدخل مفتاح الاشتراك للوصول للرادار",
    loginBtn: "🔓 دخول",
    loginLoading: "⟳ جاري التحقق...",
    loginError: "المفتاح غير صحيح",
    loginConnError: "خطأ في الاتصال",
    expired: "⏰ انتهى اشتراكك",
    renewLink: "جدد الاشتراك ←",
    noKey: "ليس لديك مفتاح؟",
    freeTrial: "جرّب مجاناً 24 ساعة ←",
    bannerError: "خطأ في الاتصال",
    bannerErrorSub: "تعذر جلب الإشارات",
    bannerClosed: "لا توجد إشارات حالياً",
    bannerOk: "متصل — أسعار حية",
    lastUpdate: "آخر تحديث",
    sectionEarly: "🔍 رصد مبكر",
    sectionEarlySub: "أسهم جاهزة قبل الانفجار",
    sectionLeaders: "📈 إشارات استثمارية",
    sectionSpec: "⚡ مضاربة يومية",
    sectionSniper: "🎯 القناص — فرص سريعة وقوية",
    sectionSniperSub: "أسهم ذات زخم قوي + جودة عالية · صفقات سريعة",
    tapToExpand: "اضغط للعرض",
    tapToCollapse: "اضغط للإخفاء",
    earlyBadge: "🔍 رصد مبكر",
    atr: "ATR",
    rsi: "RSI",
    favorites: "⭐ المفضلة",
    addFav: "أضف للمفضلة",
    removeFav: "إزالة من المفضلة",
    noFavs: "لا توجد أسهم في المفضلة",
    noFavsSub: "اضغط ⭐ على أي سهم لحفظه في مفضلتك الخاصة",
    sniperBadge: "🎯 قناص",
    simpleView: "📖 شرح بسيط",
    structureView: "📊 خريطة السوق",
    indicatorsView: "📈 المؤشرات",
    note: "📝 ملاحظة",
    saveNote: "💾 حفظ",
    cancel: "إلغاء",
    support: "دعم",
    resistance: "مقاومة",
    entry: "منطقة الدخول",
    stop: "وقف الخسارة",
    target: "هدف",
    pivot: "ارتكاز",
    rsiOverbought: "إشباع شرائي",
    rsiHealthy: "زخم صحي",
    rsiWeak: "ضعيف",
    volume: "حجم",
    news: "أخبار",
    fresh: "حديث",
    contraction: "انكماش",
    strong: "قوي",
    neutral: "محايد",
    weak: "ضعيف",
  },
  en: {
    title: "Radar",
    subtitle: "Stop loss reduces risk",
    trial: "🕐 Free Trial",
    subscribed: "✅ Subscribed",
    logout: "Logout",
    scanRange: "Today's Signals",
    all: "✅ All",
    scanBtn: "📡 Start Live Market Scan",
    scanning: "⟳ Scanning...",
    autoRefresh: "Auto refresh every minute",
    filterAll: "All",
    filterLeaders: "📈 Invest",
    filterSpec: "⚡ Day Trade",
    filterRebound: "🔄 Rebound",
    filterSniper: "🎯 Sniper",
    sectionRebound: "🔄 Strong Stock Rebound",
    sectionReboundSub: "Strong stocks bouncing from a dip · multi-day trade",
    marketMovers: "📊 Market Movers",
    marketMoversSub: "Most active stocks · tap any to analyze its structure",
    opportunities: "opportunities",
    noOpps: "No opportunities found",
    marketClosed: "Signals will appear after admin scan",
    stopLoss: "🛑 Stop Loss",
    risk: "Risk",
    volume: "Volume",
    footer1: "RADAR AZ PRO",
    footer2: "Not investment advice · Scans 10,000+ stocks · Deep technical analysis",
    loginTitle: "Enter your subscription key to access the radar",
    loginBtn: "🔓 Login",
    loginLoading: "⟳ Verifying...",
    loginError: "Invalid key",
    loginConnError: "Connection error",
    expired: "⏰ Your subscription has expired",
    renewLink: "Renew subscription →",
    noKey: "Don't have a key?",
    freeTrial: "Try free for 24 hours →",
    bannerError: "Connection Error",
    bannerErrorSub: "Failed to load signals",
    bannerClosed: "No signals yet",
    bannerOk: "Connected — Live Prices",
    lastUpdate: "Last update",
    sectionEarly: "🔍 Early Watch",
    sectionEarlySub: "Stocks ready before the breakout",
    sectionLeaders: "📈 Investment Signals",
    sectionSpec: "⚡ Day Trading",
    sectionSniper: "🎯 Sniper — Fast & Strong Opportunities",
    sectionSniperSub: "High momentum + high quality stocks · quick trades",
    tapToExpand: "Tap to expand",
    tapToCollapse: "Tap to collapse",
    earlyBadge: "🔍 Early",
    atr: "ATR",
    rsi: "RSI",
    favorites: "⭐ Favorites",
    addFav: "Add to favorites",
    removeFav: "Remove from favorites",
    noFavs: "No favorite stocks yet",
    noFavsSub: "Tap ⭐ on any stock to save it to your private list",
    sniperBadge: "🎯 Sniper",
    simpleView: "📖 Simple",
    structureView: "📊 Structure",
    indicatorsView: "📈 Indicators",
    note: "📝 Note",
    saveNote: "💾 Save",
    cancel: "Cancel",
    support: "Support",
    resistance: "Resistance",
    entry: "Entry Zone",
    stop: "Stop Loss",
    target: "Target",
    pivot: "Pivot",
    rsiOverbought: "Overbought",
    rsiHealthy: "Healthy",
    rsiWeak: "Weak",
    volume: "Volume",
    news: "News",
    fresh: "Fresh",
    contraction: "Contraction",
    strong: "Strong",
    neutral: "Neutral",
    weak: "Weak",
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
  dot: (color) => ({ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 16px ${color}` }),
  title: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: 2, color: "#fff" },
  titleAccent: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  badge: { fontSize: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 4, padding: "3px 8px", color: "#fff", fontWeight: 700 },
  subtitle: { margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)" },
  langBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "5px 12px", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer" },
  statsRow: { display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" },
  statBox: (bg, border) => ({ flex: 1, minWidth: 80, background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "14px 16px", textAlign: "center" }),
  statNum: (color) => ({ fontSize: 26, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1 }),
  statLabel: (color) => ({ fontSize: 9, color, opacity: 0.7, marginTop: 4 }),
  actionRow: { display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap", alignItems: "center" },
  scanBtn: (loading) => ({ flex: 1, background: loading ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 14, padding: "14px 28px", color: loading ? "rgba(255,255,255,0.3)" : "#fff", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 8px 32px rgba(99,102,241,0.4)" }),
  filterBtn: (active) => ({ background: active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)", border: `1px solid ${active ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "10px 14px", color: active ? "#a5b4fc" : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }),
  autoRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12, justifyContent: "flex-end" },
  autoLabel: { fontSize: 10, color: "rgba(255,255,255,0.3)" },
  toggleBtn: (active) => ({ width: 36, height: 20, borderRadius: 10, background: active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative" }),
  toggleThumb: (active) => ({ position: "absolute", top: 2, left: active ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.3s" }),
  progressBar: { height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 2, marginBottom: 16, overflow: "hidden" },
  progressFill: { height: "100%", width: "65%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 2 },
  banner: (bg, border) => ({ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }),
  bannerTitle: (color) => ({ fontSize: 12, color, fontWeight: 700 }),
  bannerSub: (color) => ({ fontSize: 10, color }),
  dividerRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  dividerLine: (flip) => ({ height: 1, flex: 1, background: flip ? "linear-gradient(90deg,rgba(255,255,255,0.08),transparent)" : "linear-gradient(90deg,transparent,rgba(255,255,255,0.08))" }),
  dividerText: { fontSize: 11, color: "rgba(255,255,255,0.25)" },
  sectionHeader: (bg, border, color, open) => ({ background: bg, border: `1px solid ${border}`, borderRadius: open ? "14px 14px 0 0" : 14, padding: "14px 18px", marginBottom: 0, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }),
  sectionTitle: (color) => ({ fontSize: 14, fontWeight: 800, color }),
  sectionCount: (color, bg) => ({ fontSize: 13, fontWeight: 800, color, background: bg, borderRadius: 20, padding: "2px 10px", fontFamily: "monospace" }),
  sectionChevron: (open) => ({ fontSize: 10, color: "rgba(255,255,255,0.4)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block", marginRight: 8 }),
  sectionBody: (open) => ({ overflow: "hidden", maxHeight: open ? "9999px" : 0, transition: "max-height 0.3s ease", border: open ? "1px solid rgba(255,255,255,0.07)" : "none", borderTop: "none", borderRadius: "0 0 14px 14px", padding: open ? "10px 0 0 0" : 0, marginBottom: open ? 12 : 0 }),
  emptyBox: { textAlign: "center", padding: "64px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 20 },
  footer: { marginTop: 32, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" },
  skeletonCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, marginBottom: 10, padding: 18, display: "flex", gap: 12, alignItems: "center" },
  skeletonBlock: (w, h) => ({ background: "rgba(255,255,255,0.08)", borderRadius: 6, width: w, height: h, flexShrink: 0, animation: "pulse 1.5s ease-in-out infinite" }),
  loginWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", zIndex: 1 },
  loginBox: { background: "linear-gradient(135deg,rgba(15,20,35,0.98),rgba(20,28,48,0.98))", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 24, padding: "40px 32px", maxWidth: 420, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.6)", textAlign: "center" },
  loginInput: { width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "monospace", letterSpacing: 2, textAlign: "center", outline: "none", boxSizing: "border-box" },
  loginBtn: (loading) => ({ width: "100%", padding: "14px", background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 8px 24px rgba(99,102,241,0.4)" }),
  loginError: { background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ff4757", marginBottom: 12 },
  loginExpired: { background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ffd700", marginBottom: 12 },
  logoutBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", color: "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer" },
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

function StatusBanner({ status, lastUpdate, scanError, t }) {
  if (!status) return null;
  const configs = {
    error: { bg: "rgba(255,71,87,0.1)", border: "rgba(255,71,87,0.3)", icon: "🔴", titleColor: "#ff4757", subColor: "rgba(255,71,87,0.7)", title: t.bannerError, sub: t.bannerErrorSub },
    closed: { bg: "rgba(255,215,0,0.08)", border: "rgba(255,215,0,0.2)", icon: "🟡", titleColor: "#ffd700", subColor: "rgba(255,215,0,0.7)", title: t.bannerClosed, sub: t.bannerClosedSub },
    ok: { bg: "rgba(0,212,170,0.08)", border: "rgba(0,212,170,0.2)", icon: "🟢", titleColor: "#00d4aa", subColor: "rgba(0,212,170,0.7)", title: t.bannerOk, sub: t.bannerOkSub },
  };
  const cfg = configs[status];
  if (!cfg) return null;
  return (
    <div style={S.banner(cfg.bg, cfg.border)}>
      <span>{cfg.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={S.bannerTitle(cfg.titleColor)}>{cfg.title}</div>
        <div style={S.bannerSub(cfg.subColor)}>{cfg.sub}</div>
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
    setLoading(true); setError(null); setExpired(false);
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
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>{t.loginTitle}</div>
        {error && <div style={S.loginError}>{error}</div>}
        {expired && (
          <div style={S.loginExpired}>
            {t.expired}
            <div style={{ marginTop: 8 }}><a href="https://radaraz.com" style={{ color: "#ffd700", fontSize: 12 }}>{t.renewLink}</a></div>
          </div>
        )}
        <input style={S.loginInput} placeholder="XXXX-XXXX-XXXX-XXXX" value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()} maxLength={19} dir="ltr" />
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

function CollapsibleSection({ title, subtitle, count, color, bg, border, children, t, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={S.sectionHeader(bg, border, color, open)} onClick={() => setOpen(o => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={S.sectionChevron(open)}>▼</span>
          <div>
            <span style={S.sectionTitle(color)}>{title}</span>
            {subtitle && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{open ? t.tapToCollapse : t.tapToExpand}</span>
          <span style={S.sectionCount(color, bg + "aa")}>{count}</span>
        </div>
      </div>
      <div style={S.sectionBody(open)}>{children}</div>
    </div>
  );
}

// ─── 📊 حركة السوق (Market Movers) ───
function MarketMovers({ movers, t, lang }) {
  const en = lang === "en";
  const [tab, setTab] = useState("gainers");

  const tabs = [
    { id: "gainers", label: en ? "📈 Top Gainers" : "📈 أعلى ارتفاع", color: "#00d4aa" },
    { id: "losers", label: en ? "📉 Top Losers" : "📉 أعلى انخفاض", color: "#ff4757" },
    { id: "volume", label: en ? "📊 Most Active" : "📊 أعلى كمية", color: "#fbbf24" },
    { id: "value", label: en ? "💰 Top Value" : "💰 أعلى قيمة", color: "#818cf8" },
  ];

  const list = (movers && movers[tab]) || [];

  const fmtVol = (v) => {
    if (v >= 1e9) return (v/1e9).toFixed(1) + "B";
    if (v >= 1e6) return (v/1e6).toFixed(1) + "M";
    if (v >= 1e3) return (v/1e3).toFixed(0) + "K";
    return String(v);
  };

  return (
    <div style={{ marginTop: 8, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            style={{
              flex: 1,
              minWidth: 70,
              background: tab === x.id ? `${x.color}22` : "rgba(255,255,255,0.04)",
              border: `1px solid ${tab === x.id ? x.color + "88" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 10,
              padding: "9px 6px",
              color: tab === x.id ? x.color : "rgba(255,255,255,0.45)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              fontFamily: "inherit",
            }}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        overflow: "hidden",
      }}>
        {list.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            {en ? "No data yet — scan first" : "لا توجد بيانات — امسح أولاً"}
          </div>
        )}
        {list.map((m, i) => {
          const up = m.change_pct >= 0;
          return (
            <div
              key={m.symbol}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 14px",
                borderBottom: i < list.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
            >
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", minWidth: 20, fontFamily: "monospace" }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "monospace", minWidth: 56 }}>
                {m.symbol}
              </span>
              <span style={{ fontSize: 13, color: "#e8edf6", fontFamily: "monospace", flex: 1 }}>
                ${m.price.toFixed(2)}
              </span>
              {(tab === "volume" || tab === "value") && (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
                  {tab === "volume" ? fmtVol(m.volume) : "$" + fmtVol(m.dollar_vol)}
                </span>
              )}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: up ? "#00d4aa" : "#ff4757",
                  fontFamily: "monospace",
                  minWidth: 64,
                  textAlign: "right",
                  direction: "ltr",
                }}
              >
                {up ? "+" : ""}{m.change_pct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════ بنية السوق (AI-Az) ════
function entryReady(r) {
  const st = r && r.structure;
  if (!st || !r.price) return false;
  const aboveSupport = r.price > st.support;
  const notRunYet    = r.price <= st.confirm * 1.01;
  const goodRR       = st.rr != null && st.rr >= 1.2;
  return aboveSupport && notRunYet && goodRR;
}

const AZ_TR = {
  "صاعد مؤكد ✅": "Confirmed uptrend ✅",
  "ينتظر تأكيد ⏳": "Awaiting confirmation ⏳",
  "دخول صحيح ✅": "Valid entry ✅",
  "مقبول": "Acceptable",
  "ملاحقة/غير مؤكد ⚠️": "Chasing / unconfirmed ⚠️",
  "هابط بلا تأكيد ⛔": "Downtrend — unconfirmed ⛔",
};
