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
    sectionSniper: "🎯 القناص",
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
    advancedView: "📊 تحليل متقدم",
    note: "📝 ملاحظة",
    saveNote: "💾 حفظ",
    cancel: "إلغاء",
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
    sectionSniper: "🎯 Sniper",
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
    simpleView: "📖 Simple View",
    advancedView: "📊 Advanced",
    note: "📝 Note",
    saveNote: "💾 Save",
    cancel: "Cancel",
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

// ─── 🃏 بطاقة مبسطة ───
function SimpleCard({ r, idx, t, lang, isFav, onToggleFav }) {
  const en = lang === "en";
  const [open, setOpen] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savedNote, setSavedNote] = useState('');

  useEffect(() => {
    try {
      const notes = JSON.parse(localStorage.getItem('favorite_notes') || '{}');
      setSavedNote(notes[r.symbol] || '');
      setNoteText(notes[r.symbol] || '');
    } catch {}
  }, [r.symbol]);

  const formatPrice = (n) => "$" + (+n).toFixed(2);
  const formatPct = (n) => (n >= 0 ? "+" : "") + Math.round(n) + "%";

  const getRisk = () => {
    const slPct = Math.abs(r.levels?.slPct || 0);
    if (slPct <= 4) return { label: en ? "🟢 Low" : "🟢 منخفضة", color: "#22c55e" };
    if (slPct <= 8) return { label: en ? "🟡 Medium" : "🟡 متوسطة", color: "#eab308" };
    return { label: en ? "🔴 High" : "🔴 مرتفعة", color: "#ef4444" };
  };

  const getStrength = () => {
    const score = r.score || 0;
    if (score >= 80) return { label: en ? "🔥 Very Strong" : "🔥 قوي جداً", color: "#ff6b35" };
    if (score >= 60) return { label: en ? "💪 Strong" : "💪 قوي", color: "#fbbf24" };
    if (score >= 40) return { label: en ? "📊 Neutral" : "📊 محايد", color: "#60a5fa" };
    return { label: en ? "📉 Weak" : "📉 ضعيف", color: "#94a3b8" };
  };

  const risk = getRisk();
  const strength = getStrength();

  const saveNote = () => {
    try {
      const notes = JSON.parse(localStorage.getItem('favorite_notes') || '{}');
      if (noteText.trim() === '') {
        delete notes[r.symbol];
      } else {
        notes[r.symbol] = noteText.trim();
      }
      localStorage.setItem('favorite_notes', JSON.stringify(notes));
      setSavedNote(noteText.trim());
      setShowNote(false);
    } catch {}
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(15,20,35,0.95), rgba(20,28,48,0.95))",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "16px",
      padding: "16px 18px",
      marginBottom: "10px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>{r.symbol}</span>
          {r.is_sniper && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>🎯</span>}
          {r.is_rebound && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: "rgba(56,189,248,0.2)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)" }}>🔄</span>}
          {r.early_watch && !r.is_rebound && !r.is_sniper && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: "rgba(52,211,153,0.2)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>🔍</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>${r.price}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: r.change_pct >= 0 ? "#22c55e" : "#ef4444" }}>
            {r.change_pct >= 0 ? "▲" : "▼"} {Math.abs(r.change_pct)}%
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFav && onToggleFav(r); }}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: isFav ? "#ffd700" : "rgba(255,255,255,0.25)",
              padding: "4px 8px",
            }}
          >
            {isFav ? "⭐" : "☆"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
        <span style={{ color: strength.color, background: "rgba(255,255,255,0.05)", padding: "2px 12px", borderRadius: 20 }}>
          {strength.label}
        </span>
        <span style={{ color: risk.color, background: "rgba(255,255,255,0.05)", padding: "2px 12px", borderRadius: 20 }}>
          {risk.label}
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        {r.levels?.t1 && (
          <span style={{ fontSize: 13, padding: "4px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(96,165,250,0.3)" }}>
            🎯 {formatPrice(r.levels.t1)} <span style={{ fontSize: 11, opacity: 0.7 }}>{formatPct(r.levels.t1Pct)}</span>
          </span>
        )}
        {r.levels?.sl && (
          <span style={{ fontSize: 13, padding: "4px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(239,68,68,0.3)" }}>
            🛑 {formatPrice(r.levels.sl)} <span style={{ fontSize: 11, opacity: 0.7 }}>{formatPct(r.levels.slPct)}</span>
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setOpen(!open)} style={{ padding: "6px 14px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
          {en ? "📖 Simple" : "📖 شرح بسيط"}
        </button>
        <button onClick={() => setShowNote(!showNote)} style={{ padding: "6px 14px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
          {savedNote ? "📝" : "📝+"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 16px" }}>
            <p style={{ margin: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
              📈 {r.symbol} في اتجاه صاعد. السهم {strength.label} مع مخاطرة {risk.label}.
            </p>
            {r.levels?.t1 && (
              <p style={{ margin: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                🎯 الهدف الأول عند {formatPrice(r.levels.t1)} ({formatPct(r.levels.t1Pct)})
              </p>
            )}
            {r.levels?.sl && (
              <p style={{ margin: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                🛑 وقف الخسارة عند {formatPrice(r.levels.sl)} ({formatPct(r.levels.slPct)})
              </p>
            )}
          </div>
        </div>
      )}

      {showNote && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={en ? "Write your notes here..." : "اكتب ملاحظتك هنا..."}
            rows={2}
            style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, fontFamily: "inherit", resize: "vertical", minHeight: 50 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowNote(false)} style={{ padding: "4px 14px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 12 }}>
              {en ? "Cancel" : "إلغاء"}
            </button>
            <button onClick={saveNote} style={{ padding: "4px 14px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", cursor: "pointer", fontSize: 12 }}>
              {en ? "💾 Save" : "💾 حفظ"}
            </button>
          </div>
          {savedNote && (
            <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(251,191,36,0.08)", borderRadius: 6, color: "#fbbf24", fontSize: 13 }}>
              📝 {savedNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Radar() {
  const [lang, setLang] = useState("ar");
  const t = T[lang];
  const [auth, setAuth] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [results, setResults] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [speculation, setSpeculation] = useState([]);
  const [rebound, setRebound] = useState([]);
  const [sniper, setSniper] = useState([]);
  const [movers, setMovers] = useState(null);
  const [earlyWatch, setEarlyWatch] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const lastScanRef = useRef(0);
  const autoTimerRef = useRef(null);
  const COOLDOWN_MS = 10000;

  useEffect(() => {
    const savedKey = localStorage.getItem("radar_key");
    const savedExpires = localStorage.getItem("radar_expires");
    const savedPlan = localStorage.getItem("radar_plan");
    if (savedKey && savedExpires) {
      if (new Date() < new Date(savedExpires)) {
        setAuth({ key: savedKey, plan: savedPlan, expires_at: savedExpires });
      } else {
        localStorage.removeItem("radar_key");
        localStorage.removeItem("radar_plan");
        localStorage.removeItem("radar_expires");
      }
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("radar_favorites");
      if (saved) {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((f) =>
          typeof f === "string" ? { symbol: f, entry: null, t1: null, t2: null, t3: null, sl: null, type: null, addedAt: null } : f
        );
        setFavorites(migrated);
      }
    } catch {}
  }, []);

  const toggleFav = useCallback((row) => {
    const symbol = typeof row === "string" ? row : row.symbol;
    setFavorites((prev) => {
      const exists = prev.some((f) => f.symbol === symbol);
      let next;
      if (exists) {
        next = prev.filter((f) => f.symbol !== symbol);
      } else {
        const snap = {
          symbol,
          entry: row.price ?? null,
          t1: row.levels?.t1 ?? null,
          t2: row.levels?.t2 ?? null,
          t3: row.levels?.t3 ?? null,
          sl: row.levels?.sl ?? null,
          type: row.type ?? null,
          structure: row.structure ?? null,
          is_sniper: row.is_sniper || false,
          sniper_type: row.sniper_type || null,
          addedAt: new Date().toISOString(),
        };
        next = [...prev, snap];
      }
      try { localStorage.setItem("radar_favorites", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("radar_key");
    localStorage.removeItem("radar_plan");
    localStorage.removeItem("radar_expires");
    setAuth(null);
  };

  const scan = useCallback(async (opts = {}) => {
    const background = opts && opts.background === true;
    const now = Date.now();
    if (now - lastScanRef.current < COOLDOWN_MS) return;
    lastScanRef.current = now;
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setResults([]); setLeaders([]); setSpeculation([]); setRebound([]); setEarlyWatch([]); setSniper([]);
      setDone(false); setStatus(null);
    }
    setScanError(null);
    try {
      const res = await fetch("/api/scan");
      if (!res.ok) { setScanError(`HTTP ${res.status}`); setStatus("error"); return; }
      const data = await res.json();
      if (data.error) { setScanError(data.error); setStatus("error"); return; }

      const MIN = DISPLAY_MIN_SCORE;
      const raw = (data.results ?? []).filter(s => (s.score || 0) >= MIN);
      const isReb = s => s.type === "ارتداد" || s.is_rebound;
      const isSniper = s => s.is_sniper || false;

      const reb = raw.filter(isReb);
      const sniperRaw = raw.filter(isSniper);
      const regular = raw.filter(s => !isReb(s) && !isSniper(s));

      const lead = (data.leaders ?? regular.filter(s => s.type === "استثمار")).filter(s => (s.score || 0) >= MIN);
      const spec = (data.speculation ?? regular.filter(s => s.type !== "استثمار")).filter(s => (s.score || 0) >= MIN);
      const early = (data.earlyWatch ?? raw.filter(s => s.early_watch)).filter(s => (s.score || 0) >= MIN);

      const toCard = s => ({
        symbol: s.symbol,
        price: s.price || 0,
        change_pct: s.change_pct || 0,
        score: s.score || 0,
        signal: s.signal || (s.score >= 80 ? "💥 انفجاري" : "🔥 عالي"),
        type: s.type || "مضاربة",
        volume: s.volume || 0,
        rvol: s.rvol || null,
        is_hot: s.is_hot || false,
        is_rebound: s.is_rebound || s.type === "ارتداد" || false,
        is_sniper: s.is_sniper || false,
        sniper_type: s.sniper_type || null,
        ret3m: s.ret3m ?? null,
        ma_signal: s.ma_signal || null,
        atr14: s.atr14 || null,
        rsi: s.rsi ?? null,
        early_watch: s.early_watch || false,
        created_at: s.created_at || null,
        levels: s.levels || { t1: 0, t1Pct: 0, t2: 0, t2Pct: 0, t3: 0, t3Pct: 0, sl: 0, slPct: 0, risk: 0 },
        structure: s.structure || null,
        is_target: s.is_target || false,
      });

      const allCards = raw.map(toCard);
      setResults(allCards);
      setRebound(reb.map(toCard));
      setSniper(sniperRaw.map(toCard));
      setLeaders(lead.map(toCard));
      setSpeculation(spec.map(toCard));
      setEarlyWatch(early.map(toCard));
      if (data.movers) setMovers(data.movers);
      setTotal(allCards.length);
      setLastUpdate(new Date());

      const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      const h = etNow.getHours(), m = etNow.getMinutes(), day = etNow.getDay();
      const isWeekend = day === 0 || day === 6;
      const isMarketOpen = !isWeekend && (h > 9 || (h === 9 && m >= 30)) && h < 16;
      if (isMarketOpen) setStatus(allCards.length > 0 ? "ok" : "closed");
      else setStatus("closed");
    } catch (err) {
      setScanError(err.message ?? "Network error");
      setStatus("error");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setDone(true);
    }
  }, []);

  const loadCached = useCallback(async () => {
    try {
      const res = await fetch("/api/latest");
      if (!res.ok) return;
      const data = await res.json();
      const rows = (data.results ?? []).filter(s => (s.score || s.ep || 0) >= DISPLAY_MIN_SCORE);
      if (!rows.length) return;
      const cardFromRow = (s) => ({
        symbol: s.symbol,
        price: s.entry_price || 0,
        change_pct: s.change_pct || 0,
        score: s.score || s.ep || 0,
        signal: (s.score || 0) >= 80 ? "💥 انفجاري" : "🔥 عالي",
        type: s.type || "مضاربة",
        volume: s.volume || 0,
        rvol: s.rvol || null,
        is_hot: s.is_hot || false,
        is_rebound: s.is_rebound || s.type === "ارتداد" || false,
        is_sniper: s.is_sniper || false,
        ret3m: s.ret3m ?? null,
        ma_signal: s.ma_signal || null,
        atr14: s.atr14 || null,
        rsi: s.rsi ?? null,
        early_watch: s.early_watch || false,
        created_at: s.created_at || null,
        levels: { t1: s.target1 || 0, t1Pct: s.entry_price ? (s.target1 - s.entry_price) / s.entry_price * 100 : 0, t2: s.target2 || 0, t2Pct: s.entry_price ? (s.target2 - s.entry_price) / s.entry_price * 100 : 0, t3: s.target3 || 0, t3Pct: s.entry_price ? (s.target3 - s.entry_price) / s.entry_price * 100 : 0, sl: s.stop_loss || 0, slPct: s.entry_price ? (s.stop_loss - s.entry_price) / s.entry_price * 100 : 0, risk: 0 },
        structure: s.structure || null,
        is_target: s.is_target || false,
      });
      const cards = rows.map(cardFromRow);
      const isReb = s => s.is_rebound;
      const isSniper = s => s.is_sniper || false;
      setResults(cards);
      setRebound(cards.filter(isReb));
      setSniper(cards.filter(isSniper));
      setLeaders(cards.filter(s => s.type === "استثمار" && !isReb(s) && !isSniper(s)));
      setSpeculation(cards.filter(s => s.type !== "استثمار" && !isReb(s) && !isSniper(s)));
      setEarlyWatch(cards.filter(s => s.early_watch));
      setTotal(cards.length);
      setDone(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!auth) return;
    loadCached().finally(() => scan({ background: true }));
  }, [auth]);

  useEffect(() => {
    if (autoRefresh) { autoTimerRef.current = setInterval(() => scan({ background: true }), 60000); }
    else { clearInterval(autoTimerRef.current); }
    return () => clearInterval(autoTimerRef.current);
  }, [autoRefresh, scan]);

  const filtered = useMemo(() => {
    if (filter === "favorites") {
      return favorites.map((fav) => {
        const live = results.find((r) => r.symbol === fav.symbol);
        const currentPrice = live?.price ?? fav.entry ?? 0;
        const pl = (fav.entry && currentPrice) ? ((currentPrice - fav.entry) / fav.entry) * 100 : null;
        const safeLevels = live?.levels || { t1: fav.t1 ?? 0, t1Pct: 0, t2: fav.t2 ?? 0, t2Pct: 0, t3: fav.t3 ?? 0, t3Pct: 0, sl: fav.sl ?? 0, slPct: 0, risk: 0 };
        return {
          ...(live || {}),
          symbol: fav.symbol,
          price: live?.price ?? fav.entry ?? 0,
          change_pct: live?.change_pct ?? 0,
          score: live?.score ?? 0,
          levels: safeLevels,
          structure: live?.structure ?? fav.structure ?? null,
          isFavSnapshot: true,
          favEntry: fav.entry,
          favT1: fav.t1, favT2: fav.t2, favT3: fav.t3, favSL: fav.sl,
          favAddedAt: fav.addedAt,
          favType: fav.type,
          livePrice: currentPrice,
          favPL: pl,
          is_sniper: live?.is_sniper || fav.is_sniper || false,
        };
      });
    }
    if (filter === "sniper") return sniper;
    if (filter === "rebound") return rebound;
    if (filter === "early") return earlyWatch;
    if (filter === "leaders") return leaders;
    if (filter === "speculation") return speculation;
    if (filter === "hot") return results.filter((r) => r.is_hot);
    return results;
  }, [results, leaders, speculation, rebound, earlyWatch, sniper, favorites, filter]);

  const favSet = useMemo(() => new Set(favorites.map((f) => f.symbol)), [favorites]);
  const favCount = useMemo(() => favorites.length, [favorites]);

  const hotCount = useMemo(() => results.filter((r) => r.is_hot).length, [results]);
  const earlyCount = useMemo(() => earlyWatch.length, [earlyWatch]);
  const reboundCount = useMemo(() => rebound.length, [rebound]);
  const sniperCount = useMemo(() => sniper.length, [sniper]);
  const dotColor = (loading || refreshing) ? "#ffd700" : status === "ok" ? "#00d4aa" : status === "error" ? "#ff4757" : "#6366f1";
  const showSections = filter === "all" && (leaders.length > 0 || speculation.length > 0 || rebound.length > 0 || sniper.length > 0);
  const earlySymbols = useMemo(() => new Set(earlyWatch.map(s => s.symbol)), [earlyWatch]);

  if (!authChecked) return null;
  if (!auth) return (
    <div style={S.root} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div style={S.bgWrap}><div style={S.bgCircle} /><div style={S.bgGrid} /></div>
      <LoginScreen onLogin={setAuth} t={t} lang={lang} setLang={setLang} />
    </div>
  );

  return (
    <div style={S.root} dir={lang === "ar" ? "rtl" : "ltr"}>
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
            { label: t.scanRange, value: total || "—", color: "#6366f1", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)" },
            { label: t.filterSniper, value: sniperCount, color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)" },
            { label: t.filterRebound, value: reboundCount, color: "#38bdf8", bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.25)" },
            { label: "🚨 HOT", value: hotCount, color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)" },
          ].map((s) => (
            <div key={s.label} style={S.statBox(s.bg, s.border)}>
              <div style={{ ...S.statNum(s.color), fontSize: typeof s.value === "string" ? 18 : 26 }}>{s.value}</div>
              <div style={S.statLabel(s.color)}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={S.actionRow}>
          <button onClick={() => scan({ background: true })} disabled={loading || refreshing} style={S.scanBtn(loading || refreshing)}>
            {(loading || refreshing) ? t.scanning : t.scanBtn}
          </button>
          {results.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "all", label: t.filterAll },
                ...(favorites.length > 0 ? [{ id: "favorites", label: `${t.favorites} (${favCount})` }] : []),
                ...(sniperCount > 0 ? [{ id: "sniper", label: t.filterSniper }] : []),
                ...(reboundCount > 0 ? [{ id: "rebound", label: t.filterRebound }] : []),
                ...(earlyCount > 0 ? [{ id: "early", label: t.earlyBadge }] : []),
                { id: "leaders", label: t.filterLeaders },
                { id: "speculation", label: t.filterSpec },
                { id: "hot", label: "🚨 HOT" },
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

        {/* 📊 حركة السوق */}
        {!loading && done && filter === "all" && movers && (
          <CollapsibleSection
            title={t.marketMovers}
            subtitle={t.marketMoversSub}
            count={60}
            color="#22d3ee"
            bg="rgba(34,211,238,0.08)"
            border="rgba(34,211,238,0.3)"
            t={t}
            defaultOpen={false}
          >
            <MarketMovers movers={movers} t={t} lang={lang} />
          </CollapsibleSection>
        )}

        {!loading && done && filter === "all" && sniper.length > 0 && (
          <CollapsibleSection title={t.sectionSniper} subtitle={t.sectionSniperSub} count={sniper.length} color="#fbbf24" bg="rgba(251,191,36,0.08)" border="rgba(251,191,36,0.3)" t={t}>
            {sniper.map((r, i) => <SimpleCard key={"sniper-" + r.symbol} r={r} idx={i} t={t} lang={lang} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
          </CollapsibleSection>
        )}

        {!loading && done && filter === "all" && rebound.length > 0 && (
          <CollapsibleSection title={t.sectionRebound} subtitle={t.sectionReboundSub} count={rebound.length} color="#38bdf8" bg="rgba(56,189,248,0.08)" border="rgba(56,189,248,0.3)" t={t}>
            {rebound.map((r, i) => <SimpleCard key={"reb-" + r.symbol} r={r} idx={i} t={t} lang={lang} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
          </CollapsibleSection>
        )}

        {!loading && done && filter === "all" && earlyWatch.length > 0 && (
          <CollapsibleSection title={t.sectionEarly} subtitle={t.sectionEarlySub} count={earlyWatch.length} color="#34d399" bg="rgba(52,211,153,0.08)" border="rgba(52,211,153,0.3)" t={t}>
            {earlyWatch.map((r, i) => <SimpleCard key={"early-" + r.symbol} r={r} idx={i} t={t} lang={lang} isEarly={true} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
          </CollapsibleSection>
        )}

        {!loading && done && showSections && (
          <>
            {leaders.length > 0 && (
              <CollapsibleSection title={t.sectionLeaders} count={leaders.length} color="#818cf8" bg="rgba(129,140,248,0.08)" border="rgba(129,140,248,0.2)" t={t}>
                {leaders.map((r, i) => <SimpleCard key={r.symbol} r={r} idx={i} t={t} lang={lang} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
              </CollapsibleSection>
            )}
            {speculation.length > 0 && (
              <CollapsibleSection title={t.sectionSpec} count={speculation.length} color="#fbbf24" bg="rgba(251,191,36,0.08)" border="rgba(251,191,36,0.2)" t={t}>
                {speculation.map((r, i) => <SimpleCard key={r.symbol} r={r} idx={i} t={t} lang={lang} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
              </CollapsibleSection>
            )}
          </>
        )}

        {!loading && filtered.length > 0 && !showSections && (
          <>
            <div style={S.dividerRow}>
              <div style={S.dividerLine(false)} />
              <span style={S.dividerText}>{filtered.length} {t.opportunities}</span>
              <div style={S.dividerLine(true)} />
            </div>
            {filtered.map((r, i) => <SimpleCard key={r.symbol} r={r} idx={i} t={t} lang={lang} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
          </>
        )}

        {!loading && done && filter === "favorites" && filtered.length === 0 && (
          <div style={S.emptyBox}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⭐</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>{t.noFavs}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{t.noFavsSub}</div>
          </div>
        )}

        {done && !loading && results.length === 0 && (
          <div style={S.emptyBox}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔴</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>{t.noOpps}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{t.marketClosed}</div>
          </div>
        )}

        <div style={S.footer}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: 2, fontFamily: "monospace" }}>{t.footer1}</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", lineHeight: 1.6 }}>{t.footer2}</span>
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
