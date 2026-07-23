// components/Radar.js — التصميم الأصلي مع إضافة الحقول الجديدة فقط
import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// حقن حركة نبض اللمبة مرة واحدة (آمن مع SSR)
if (typeof document !== "undefined" && !document.getElementById("az-kf")) {
  const _el = document.createElement("style");
  _el.id = "az-kf";
  _el.textContent = "@keyframes azpulse{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.5),0 0 8px rgba(52,211,153,.9)}50%{box-shadow:0 0 0 6px rgba(52,211,153,0),0 0 14px rgba(52,211,153,1)}}";
  document.head.appendChild(_el);
}

const DISPLAY_MIN_SCORE = 45;

// ─── دوال تنسيق الأرقام (للعرض) ──────────────────────────────────
function formatMarketCapDisplay(value) {
  if (!value) return null;
  if (value >= 1e12) return { value: (value / 1e12).toFixed(2), suffix: 'T' };
  if (value >= 1e9) return { value: (value / 1e9).toFixed(2), suffix: 'B' };
  if (value >= 1e6) return { value: (value / 1e6).toFixed(2), suffix: 'M' };
  return { value: value.toFixed(2), suffix: '' };
}

function formatSharesDisplay(value) {
  if (!value) return null;
  if (value >= 1e9) return { value: (value / 1e9).toFixed(2), suffix: 'B' };
  if (value >= 1e6) return { value: (value / 1e6).toFixed(2), suffix: 'M' };
  return { value: value.toFixed(2), suffix: '' };
}

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
    ready: "🔥 فرص جاهزة",
    readySub: "استوفت كل الشروط · جودة عالية",
    watch: "🔵 مناطق مراقبة",
    watchSub: "قريبة من الدخول · تنتظر التأكيد",
    late: "🚀 زخم متأخر",
    lateSub: "ارتفعت كثيراً · لمخاطرة عالية",
    hidden: "💎 فرص خفية",
    hiddenSub: "سيولة منخفضة · مؤشرات ممتازة",
    companyDetails: "📊 تفاصيل الشركة",
    hideDetails: "🔽 إخفاء",
    marketCap: "القيمة السوقية",
    sharesOutstanding: "الأسهم المتاحة",
    shortable: "البيع على المكشوف",
    shortInterest: "حجم الأقراض",
    shortableYes: "✅ مسموح",
    shortableNo: "❌ غير مسموح",
    loadingCompany: "⟳ جاري تحميل بيانات الشركة...",
    companyError: "❌ تعذر تحميل البيانات",
    notAvailable: "—",
    sector: "القطاع",
    industry: "الصناعة",
    employees: "الموظفين",
    ceo: "الرئيس التنفيذي",
    website: "الموقع الإلكتروني",
    companyInfo: "📋 نبذة عن الشركة",
    noDescription: "لا توجد نبذة متاحة",
    multiSourceAnalysis: "🧠 تحليل متعدد المصادر",
    technicalAnalysis: "التحليل الفني",
    fundamentalAnalysis: "التحليل الأساسي",
    macroAnalysis: "التحليل الماكروي",
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
    ready: "🔥 Ready",
    readySub: "All conditions met · High quality",
    watch: "🔵 Watch Zones",
    watchSub: "Close to entry · Awaiting confirmation",
    late: "🚀 Late Momentum",
    lateSub: "High rise · High risk",
    hidden: "💎 Hidden Gems",
    hiddenSub: "Low liquidity · Excellent indicators",
    companyDetails: "📊 Company Details",
    hideDetails: "🔽 Hide",
    marketCap: "Market Cap",
    sharesOutstanding: "Shares Outstanding",
    shortable: "Shortable",
    shortInterest: "Short Interest",
    shortableYes: "✅ Allowed",
    shortableNo: "❌ Not Allowed",
    loadingCompany: "⟳ Loading company data...",
    companyError: "❌ Failed to load data",
    notAvailable: "—",
    sector: "Sector",
    industry: "Industry",
    employees: "Employees",
    ceo: "CEO",
    website: "Website",
    companyInfo: "📋 About the company",
    noDescription: "No description available",
    multiSourceAnalysis: "🧠 Multi-Source Analysis",
    technicalAnalysis: "Technical",
    fundamentalAnalysis: "Fundamental",
    macroAnalysis: "Macro",
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

// ═══════════════════════════════════════════════════════════
// 🧠 AI Command Center — إضافات الواجهة الجديدة (بيانات حقيقية فقط)
// ═══════════════════════════════════════════════════════════
const AIC = {
  glass: "rgba(20,26,44,0.55)", glassBorder: "rgba(120,140,255,0.14)",
  ink: "#eaf0ff", sub: "rgba(210,220,255,0.45)", faint: "rgba(210,220,255,0.28)",
  iris: "#7c6cff", iris2: "#a78bfa", teal: "#2dd4bf", cyan: "#22d3ee", green: "#34d399", amber: "#fbbf24",
};
const confColor = (v) => (v >= 85 ? "#00d4aa" : v >= 75 ? "#34d399" : v >= 65 ? "#60a5fa" : v >= 55 ? "#818cf8" : "#94a3b8");
const AI_GRADE = {
  ELITE: { ar: "🏆 نخبة", en: "🏆 Elite", c: "#00d4aa" },
  PRIME: { ar: "⭐ ممتاز", en: "⭐ Prime", c: "#34d399" },
  STRONG: { ar: "💪 قوي", en: "💪 Strong", c: "#60a5fa" },
  GOOD: { ar: "📊 جيد", en: "📊 Good", c: "#818cf8" },
  WATCH: { ar: "👀 مراقبة", en: "👀 Watch", c: "#94a3b8" },
};
function AICore({ active }) {
  return (
    <div style={{ position: "relative", width: 200, height: 200, display: "grid", placeItems: "center", margin: "0 auto" }}>
      <div className="aic-ring aic-ring1" />
      <div className="aic-ring aic-ring2" />
      <div className="aic-ring aic-ring3" />
      <div style={{ width: 108, height: 108, borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, ${AIC.iris2}, ${AIC.iris} 55%, #4c1d95 100%)`, boxShadow: `0 0 60px ${AIC.iris}aa, inset 0 0 40px rgba(255,255,255,0.15)`, display: "grid", placeItems: "center", animation: "aicBreath 3.2s ease-in-out infinite" }}>
        <span style={{ fontSize: 40 }}>🧠</span>
      </div>
    </div>
  );
}
function ThinkingLine({ words }) {
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((v) => (v + 1) % words.length), 2200); return () => clearInterval(id); }, [words.length]);
  return (<div style={{ height: 22, overflow: "hidden", textAlign: "center" }}><div key={i} style={{ fontSize: 13, color: AIC.teal, fontWeight: 600, animation: "aicFade 0.5s ease" }}>{words[i]}</div></div>);
}
function AIStat({ label, value, accent, sub }) {
  return (
    <div style={{ background: AIC.glass, border: `1px solid ${AIC.glassBorder}`, borderRadius: 18, padding: "16px 18px", backdropFilter: "blur(12px)", minWidth: 110, flex: 1 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent || AIC.ink, fontFamily: "ui-monospace, monospace", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: AIC.sub, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 9.5, color: AIC.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function SoonPanel({ title, sub, soonLabel }) {
  return (
    <div style={{ background: AIC.glass, border: `1px dashed ${AIC.glassBorder}`, borderRadius: 20, padding: "40px 28px", textAlign: "center", backdropFilter: "blur(10px)" }}>
      <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: AIC.iris2, background: `${AIC.iris}1e`, border: `1px solid ${AIC.iris}44`, borderRadius: 20, padding: "4px 14px", marginBottom: 16 }}>{soonLabel}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: AIC.ink, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: AIC.sub, maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>{sub}</div>
    </div>
  );
}
function AINeuralBg() {
  return (<div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.5 }}><div style={{ position: "absolute", top: "8%", left: "50%", transform: "translateX(-50%)", width: 620, height: 620, background: `radial-gradient(circle, ${AIC.iris}18 0%, transparent 65%)`, borderRadius: "50%" }} /></div>);
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
const azTr = (s, lang) => (lang === "en" ? (AZ_TR[s] || s) : s);

function azSummary(r, lang) {
  const st = r.structure;
  if (!st) return "";
  const parts = [];
  if (st.trend) parts.push(azTr(st.trend, lang));
  if (st.flag) parts.push(azTr(st.flag, lang));
  if (st.rr != null) parts.push("R:R " + st.rr);
  let action;
  if (entryReady(r)) action = lang === "en" ? "Price in entry zone now — ready ✅" : "السعر في منطقة الدخول الآن — جاهزة ✅";
  else if (r.price > st.entry) action = lang === "en" ? ("Wait for a pullback to the entry zone $" + (+st.entry).toFixed(2)) : ("انتظر ارتداداً لمنطقة الدخول $" + (+st.entry).toFixed(2));
  else action = lang === "en" ? ("Watch for confirmation above $" + (+st.confirm).toFixed(2)) : ("راقب التأكيد فوق $" + (+st.confirm).toFixed(2));
  return parts.join(" • ") + " — " + action;
}

const AZ_LEVELS = [
  { k: "peak",       n: "🟥 منطقة بيع محتمل (قصوى)", en: "🟥 Sell zone (max)",       c: "#f59e0b" },
  { k: "liquidity",  n: "🟧 منطقة بيع محتمل",        en: "🟧 Sell zone",             c: "#fb923c" },
  { k: "t3",         n: "🎯 هدف ثالث",               en: "🎯 Target 3",              c: "#4ade80" },
  { k: "t2",         n: "🎯 هدف ثانٍ",               en: "🎯 Target 2",              c: "#34d399" },
  { k: "t1",         n: "🌟 هدف مؤكد",              en: "🌟 Confirmed target",      c: "#2dd4bf" },
  { k: "resistance", n: "🚧 مقاومة",                 en: "🚧 Resistance",            c: "#eab308" },
  { k: "__now__" },
  { k: "confirm",    n: "✅ تأكيد الاتجاه",           en: "✅ Trend confirmation",    c: "#22d3ee" },
  { k: "entry",      n: "📥 منطقة الدخول",           en: "📥 Entry zone",            c: "#3b82f6" },
  { k: "support",    n: "⚖️ ارتكاز — ممنوع الكسر",   en: "⚖️ Pivot — do not break",  c: "#818cf8" },
  { k: "stop",       n: "🔴 إيقاف الخسارة",          en: "🔴 Stop loss",             c: "#f43f5e" },
];

function StructureMap({ r, lang }) {
  const en = lang === "en";
  const st = r.structure;
  if (!st) return (
    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "10px 0" }}>
      {en ? "Not enough structure data for this stock." : "لا تتوفر بيانات بنية كافية لهذا السهم."}
    </div>
  );
  const pc = (v) => { const x = ((v - r.price) / r.price) * 100; return (x >= 0 ? "+" : "") + x.toFixed(2) + "%"; };
  return (
    <div>
      <div style={{ fontSize: 12, lineHeight: 1.7, color: "#cdd6ea", background: "rgba(124,140,255,0.07)", borderRight: "3px solid #7c8cff", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
        <strong style={{ color: "#2dd4bf" }}>AI-Az:</strong> {azSummary(r, lang)}
      </div>
      <div>
        {AZ_LEVELS.map((L) => {
          if (L.k === "__now__") return (
            <div key="now" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 8, margin: "5px 0", borderRadius: 10, background: "linear-gradient(90deg,rgba(234,240,251,0.13),rgba(234,240,251,0.03))", border: "1px solid rgba(234,240,251,0.32)", boxShadow: "0 0 16px rgba(120,180,255,0.1)" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{en ? "▸ Current price" : "▸ السعر الحالي"}</span>
              <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 800, color: "#fff" }}>${(+r.price).toFixed(2)}</span>
            </div>
          );
          const v = st[L.k];
          if (v == null) return null;
          const isEntry = L.k === "entry";
          return (
            <div key={L.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", margin: "2px 0", borderRadius: 9, outline: isEntry ? "1px dashed rgba(59,130,246,0.5)" : "none", outlineOffset: -1 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: L.c, boxShadow: "0 0 7px " + L.c, flex: "none" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: L.c }}>{en ? L.en : L.n}</span>
              </span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#e8edf6" }}>${(+v).toFixed(2)}</span>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{pc(v)}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.42)", marginTop: 10, lineHeight: 1.65, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 9 }}>
        {en
          ? "The pivot must not break — below it the setup is void. Sell zones = take profits gradually."
          : "الارتكاز ممنوع كسره — تحته يُلغى السيناريو. مناطق البيع المحتمل = جنِّ الأرباح تدريجياً."}
      </div>
    </div>
  );
}

// ─── 📊 حركة السوق (Market Movers) مع خريطة البنية ───
function MarketMovers({ movers, signals, t, lang }) {
  const en = lang === "en";
  const [tab, setTab] = useState("gainers");
  const [openSym, setOpenSym] = useState(null);

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

  // ✅ بلا استدعاء /api/structure: نبحث في إشارات اليوم محلياً.
  const toggleStruct = (sym) => {
    setOpenSym((cur) => (cur === sym ? null : sym));
  };
  const findSignal = (sym) => (signals || []).find((s) => s.symbol === sym) || null;

  return (
    <div style={{ marginTop: 8, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => { setTab(x.id); setOpenSym(null); }}
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
          const isOpen = openSym === m.symbol;
          const sig = isOpen ? findSignal(m.symbol) : null;
          return (
            <div key={m.symbol} style={{ borderBottom: i < list.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div
                onClick={() => toggleStruct(m.symbol)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 14px",
                  cursor: "pointer",
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
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                  ▼
                </span>
              </div>
              {isOpen && (
                <div style={{ padding: "4px 14px 14px", background: "rgba(6,10,20,0.5)" }}>
                  {sig && sig.structure ? (
                    <div style={{ background: "rgba(6,10,20,0.6)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, display: "flex", alignItems: "center", gap: 7, color: "#dbe2ff" }}>
                        🗺️ {en ? "AI-Az Structure" : "خريطة بنية AI-Az"}
                      </div>
                      <StructureMap r={{ price: sig.price || m.price, structure: sig.structure, levels: sig.levels }} lang={lang} />
                    </div>
                  ) : (
                    <div style={{ padding: "12px 14px", background: "rgba(6,10,20,0.6)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.8 }}>
                      <div>💰 {en ? "Price" : "السعر"}: ${(+m.price).toFixed(2)}</div>
                      <div>📊 {en ? "Change" : "التغيّر"}: <span style={{ color: up ? "#00d4aa" : "#ff4757" }}>{up ? "+" : ""}{m.change_pct.toFixed(2)}%</span></div>
                      <div>📦 {en ? "Volume" : "الحجم"}: {fmtVol(m.volume)}</div>
                      <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                        ℹ️ {en ? "Not among analyzed signals — no structure map available." : "هذا السهم ليس ضمن الإشارات المحللة حالياً، لذلك لا توجد خريطة بنية متاحة."}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 🃏 بطاقة ذكية مع حقول v19 الجديدة ─────────────────────
function SmartCard({ r, idx, t, lang, isFav, onToggleFav }) {
  const en = lang === "en";
  const [showSimple, setShowSimple] = useState(false);
  const [showStructure, setShowStructure] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [showCompanyDetails, setShowCompanyDetails] = useState(false);
  const [companyData, setCompanyData] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(false);

  useEffect(() => {
    try {
      const notes = JSON.parse(localStorage.getItem('favorite_notes') || '{}');
      setSavedNote(notes[r.symbol] || '');
      setNoteText(notes[r.symbol] || '');
    } catch {}
  }, [r.symbol]);

  const fetchCompanyDetails = async (symbol) => {
    if (companyData) return;
    setLoadingCompany(true);
    try {
      const res = await fetch(`/api/company-details?symbol=${symbol}`);
      const data = await res.json();
      
      setCompanyData({
        ...data,
        marketCapFormatted: data.marketCapFormatted || formatMarketCapDisplay(Number(data.marketCap)),
        sharesFormatted: data.sharesFormatted || formatSharesDisplay(Number(data.sharesOutstanding)),
        shortInterestFormatted: data.shortInterestFormatted || formatSharesDisplay(Number(data.shortInterest)),
        scores: r.scores || null,
      });
    } catch {
      setCompanyData({ error: true });
    }
    setLoadingCompany(false);
  };

  const toggleCompanyDetails = (symbol) => {
    if (showCompanyDetails) {
      setShowCompanyDetails(false);
    } else {
      setShowCompanyDetails(true);
      fetchCompanyDetails(symbol);
    }
  };

  const formatPrice = (n) => "$" + (+n).toFixed(2);
  const formatPct = (n) => (n >= 0 ? "+" : "") + Math.round(n) + "%";

  // 🆕 v19: استخدام الحقول الجديدة
  const predictionGrade = r.predictionGrade || r.structure?.predictionGrade || 'WATCH';
  const predictionScore = r.predictionScore || r.score || 0;
  const timing = r.timing?.timing || r.structure?.timing || 'UNKNOWN';

  // دالة التصنيف بالعربي
  const getGradeLabel = (grade) => {
    const map = {
      'ELITE': '🏆 نخبة',
      'PRIME': '⭐ ممتاز',
      'STRONG': '💪 قوي',
      'GOOD': '📊 جيد',
      'WATCH': '👀 مراقبة',
      'AVOID': '❌ تجنب',
    };
    return map[grade] || grade || '—';
  };

  const getGradeColor = (grade) => {
    const map = {
      'ELITE': '#00d4aa',
      'PRIME': '#34d399',
      'STRONG': '#60a5fa',
      'GOOD': '#fbbf24',
      'WATCH': '#94a3b8',
      'AVOID': '#ef4444',
    };
    return map[grade] || '#94a3b8';
  };

  const getTimingLabel = (timing) => {
    const map = {
      'PRE_BREAKOUT': '⚡ قبل الاختراق',
      'BREAKOUT': '🚀 اختراق',
      'EARLY_MOMENTUM': '📈 زخم مبكر',
      'WAIT': '⏳ مراقبة',
      'LATE': '⚠️ متأخر',
      'UNKNOWN': '❓ غير معروف',
    };
    return map[timing] || timing || '—';
  };

  const getTimingColor = (timing) => {
    const map = {
      'PRE_BREAKOUT': '#34d399',
      'BREAKOUT': '#60a5fa',
      'EARLY_MOMENTUM': '#fbbf24',
      'WAIT': '#94a3b8',
      'LATE': '#ef4444',
      'UNKNOWN': '#6b7280',
    };
    return map[timing] || '#94a3b8';
  };

  const getRisk = () => {
    const slPct = Math.abs(r.levels?.slPct || 0);
    if (slPct <= 4) return { label: en ? "🟢 Low" : "🟢 منخفضة", color: "#22c55e" };
    if (slPct <= 8) return { label: en ? "🟡 Medium" : "🟡 متوسطة", color: "#eab308" };
    return { label: en ? "🔴 High" : "🔴 مرتفعة", color: "#ef4444" };
  };

  const getStrength = () => {
    const score = predictionScore || 0;
    if (score >= 80) return { label: en ? "🔥 Very Strong" : "🔥 قوي جداً", color: "#ff6b35" };
    if (score >= 60) return { label: en ? "💪 Strong" : "💪 قوي", color: "#fbbf24" };
    if (score >= 40) return { label: en ? "📊 Neutral" : "📊 محايد", color: "#60a5fa" };
    return { label: en ? "📉 Weak" : "📉 ضعيف", color: "#94a3b8" };
  };

  const risk = getRisk();
  const strength = getStrength();

  // 🆕 v12: شارة حالة الدخول (من scan v11)
  const entryBadge = (() => {
    if (!r.entry_state) return null;
    if (r.entry_state === "in_zone")
      return { txt: en ? "🟢 In entry zone now" : "🟢 داخل منطقة الدخول", c: "#22c55e", bg: "rgba(34,197,94,0.12)" };
    if (r.entry_state === "chasing")
      return { txt: en ? "🔴 Chasing — don't enter now" : "🔴 ملاحقة — لا تدخل الآن", c: "#ef4444", bg: "rgba(239,68,68,0.12)" };
    const wp = r.wait_price != null ? " $" + (+r.wait_price).toFixed(2) : "";
    return { txt: (en ? "🟡 Wait for pullback to" : "🟡 ممتد — انتظره عند") + wp, c: "#eab308", bg: "rgba(234,179,8,0.12)" };
  })();

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

  const indicators = useMemo(() => {
    const ind = [];
    if (r.rsi != null) {
      const rsiColor = r.rsi >= 72 ? "#ef4444" : r.rsi >= 50 ? "#22c55e" : "#94a3b8";
      const rsiLabel = r.rsi >= 72 ? (en ? "Overbought" : "إشباع شرائي") : r.rsi >= 50 ? (en ? "Healthy" : "زخم صحي") : (en ? "Weak" : "ضعيف");
      ind.push({ label: "RSI", value: r.rsi, color: rsiColor, status: rsiLabel });
    }
    if (r.ma_signal) {
      const maColor = r.ma_signal.includes("ذهبي") ? "#fbbf24" : "#34d399";
      ind.push({ label: "MA", value: r.ma_signal, color: maColor });
    }
    if (r.rvol != null) {
      const rvolColor = r.rvol >= 4 ? "#22c55e" : r.rvol >= 2 ? "#fbbf24" : "#94a3b8";
      ind.push({ label: "RVOL", value: r.rvol.toFixed(1) + "x", color: rvolColor });
    }
    if (r.atr14 != null) {
      ind.push({ label: "ATR", value: "$" + r.atr14.toFixed(2), color: "#c084fc" });
    }
    if (r.volume != null) {
      const vol = r.volume / 1e6;
      ind.push({ label: en ? "Volume" : "حجم", value: vol.toFixed(1) + "M", color: "#60a5fa" });
    }
    if (r.vcp) {
      ind.push({ label: "VCP", value: r.vcp_contraction + "%", color: "#34d399", status: en ? "Contraction" : "انكماش" });
    }
    if (r.rs20 != null) {
      const rsColor = r.rs20 >= 5 ? "#22c55e" : r.rs20 >= 0 ? "#fbbf24" : "#94a3b8";
      ind.push({ label: "RS vs SPY", value: (r.rs20 >= 0 ? "+" : "") + r.rs20.toFixed(1) + "%", color: rsColor, status: en ? "20 days" : "20 يوم" });
    }
    if (r.news_age_h != null && r.news_age_h < 24) {
      ind.push({ label: "📰 News", value: r.news_age_h + "h", color: "#fbbf24", status: en ? "Fresh" : "حديث" });
    }
    return ind;
  }, [r, en]);

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(15,20,35,0.95), rgba(20,28,48,0.95))",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "16px",
      padding: "16px 18px",
      marginBottom: "10px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>{r.symbol}</span>
          {/* 🆕 v19: التصنيف الجديد */}
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 12px",
            borderRadius: 20,
            background: `${getGradeColor(predictionGrade)}22`,
            color: getGradeColor(predictionGrade),
            border: `1px solid ${getGradeColor(predictionGrade)}55`,
          }}>
            {getGradeLabel(predictionGrade)}
          </span>
          {/* 🆕 v19: التوقيت */}
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            padding: "2px 10px",
            borderRadius: 12,
            background: `${getTimingColor(timing)}22`,
            color: getTimingColor(timing),
            border: `1px solid ${getTimingColor(timing)}44`,
          }}>
            {getTimingLabel(timing)}
          </span>
          {r.is_sniper && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>🎯</span>}
          {r.is_rebound && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: "rgba(56,189,248,0.2)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)" }}>🔄</span>}
          {r.early_watch && !r.is_rebound && !r.is_sniper && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: "rgba(52,211,153,0.2)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>🔍</span>}
          {r.breakout && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 12, background: "rgba(52,211,153,0.2)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>🚀 اختراق</span>
          )}
          {r.preBreakout && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 12, background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>⏳ قرب الاختراق</span>
          )}
          {r.is_smart_bounce && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 12, background: "rgba(56,189,248,0.2)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)" }}>🔄 ارتداد سريع</span>
          )}
          {r.riskScore > 7 && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 12, background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>🔴 خطر عالي</span>
          )}
          {r.riskScore <= 7 && r.riskScore >= 4 && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 12, background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>🟡 خطر متوسط</span>
          )}
          {r.riskScore < 4 && r.riskScore > 0 && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 12, background: "rgba(52,211,153,0.2)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>🟢 خطر منخفض</span>
          )}
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

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10, fontSize: 13, fontWeight: 600, alignItems: "center" }}>
        {/* شارة الدخول */}
        {entryBadge && (
          <span style={{ color: entryBadge.c, background: entryBadge.bg, padding: "2px 12px", borderRadius: 20, border: `1px solid ${entryBadge.c}55`, fontWeight: 700 }}>
            {entryBadge.txt}
          </span>
        )}
        {r.in_cooldown && (
          <span style={{ color: "#94a3b8", background: "rgba(148,163,184,0.1)", padding: "2px 12px", borderRadius: 20 }}>
            ❄️ {en ? "Stopped out recently" : "ضرب وقفه مؤخراً"}
          </span>
        )}
        {r.rs20 != null && r.rs20 >= 5 && (
          <span style={{ color: "#34d399", background: "rgba(52,211,153,0.1)", padding: "2px 12px", borderRadius: 20 }}>
            💪 {en ? "Stronger than market" : "أقوى من السوق"}
          </span>
        )}
        {/* 🆕 v19: عرض النقاط الجديدة */}
        <span style={{ color: "#a5b4fc", background: "rgba(99,102,241,0.1)", padding: "2px 12px", borderRadius: 20 }}>
          🎯 {predictionScore}
        </span>
        <span style={{ color: strength.color, background: "rgba(255,255,255,0.05)", padding: "2px 12px", borderRadius: 20 }}>
          {strength.label}
        </span>
        <span style={{ color: risk.color, background: "rgba(255,255,255,0.05)", padding: "2px 12px", borderRadius: 20 }}>
          {risk.label}
        </span>
        {r.levels?.t1 && (
          <span style={{ color: "#60a5fa", background: "rgba(96,165,250,0.1)", padding: "2px 12px", borderRadius: 20 }}>
            🎯 {formatPrice(r.levels.t1)} ({formatPct(r.levels.t1Pct)})
          </span>
        )}
        {r.levels?.sl && (
          <span style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "2px 12px", borderRadius: 20 }}>
            🛑 {formatPrice(r.levels.sl)} ({formatPct(r.levels.slPct)})
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setShowSimple(!showSimple)} style={{ padding: "6px 14px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: showSimple ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
          📖 {en ? "Simple" : "شرح بسيط"}
        </button>
        <button onClick={() => setShowStructure(!showStructure)} style={{ padding: "6px 14px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: showStructure ? "rgba(45,212,191,0.3)" : "rgba(45,212,191,0.15)", color: "#2dd4bf", border: "1px solid rgba(45,212,191,0.3)" }}>
          📊 {en ? "Structure" : "خريطة السوق"}
        </button>
        <button onClick={() => setShowIndicators(!showIndicators)} style={{ padding: "6px 14px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: showIndicators ? "rgba(251,191,36,0.3)" : "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
          📈 {en ? "Indicators" : "مؤشرات"}
        </button>
        <button onClick={() => setShowNote(!showNote)} style={{ padding: "6px 14px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
          {savedNote ? "📝" : "📝+"}
        </button>
        <button
          onClick={() => toggleCompanyDetails(r.symbol)}
          style={{
            padding: "6px 14px",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 8,
            background: showCompanyDetails ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.08)",
            color: "#a5b4fc",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {showCompanyDetails ? `🔽 ${t.hideDetails}` : `📊 ${t.companyDetails}`}
        </button>
      </div>

      {showSimple && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 10, padding: "12px 16px", border: "1px solid rgba(99,102,241,0.15)" }}>
            <p style={{ margin: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.9)", lineHeight: 1.6 }}>
              📈 <strong>{r.symbol}</strong> {en ? "is in an uptrend." : "في اتجاه صاعد."}
              {en ? " The stock is " : " السهم "}
              <span style={{ color: strength.color }}>{strength.label.toLowerCase()}</span>
              {en ? " with " : " مع "}
              <span style={{ color: risk.color }}>{risk.label.toLowerCase()}</span> {en ? "risk." : "مخاطرة."}
            </p>
            {entryBadge && (
              <p style={{ margin: "4px 0", fontSize: 13, color: entryBadge.c, fontWeight: 700 }}>
                {entryBadge.txt}
              </p>
            )}
            {/* 🆕 v19: عرض التصنيف والتوقيت في الشرح البسيط */}
            <p style={{ margin: "4px 0", fontSize: 13, color: getGradeColor(predictionGrade) }}>
              التصنيف: {getGradeLabel(predictionGrade)} · التوقيت: {getTimingLabel(timing)}
            </p>
            <p style={{ margin: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              النقاط: {predictionScore}
            </p>
            {r.levels?.t1 && (
              <p style={{ margin: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                🎯 {en ? "First target at" : "الهدف الأول عند"} <strong>{formatPrice(r.levels.t1)}</strong> ({formatPct(r.levels.t1Pct)})
              </p>
            )}
            {r.levels?.sl && (
              <p style={{ margin: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                🛑 {en ? "Stop loss at" : "وقف الخسارة عند"} <strong>{formatPrice(r.levels.sl)}</strong> ({formatPct(r.levels.slPct)})
              </p>
            )}
            {r.structure && r.structure.rr != null && (
              <p style={{ margin: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                📊 {en ? "Risk/Reward ratio" : "نسبة المخاطرة/العائد"}: <strong>{r.structure.rr}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {showStructure && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ background: "rgba(6,10,20,0.8)", borderRadius: 12, padding: "12px 16px", border: "1px solid rgba(45,212,191,0.2)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, display: "flex", alignItems: "center", gap: 7, color: "#2dd4bf" }}>
              🗺️ {en ? "Market Structure — Complete Map" : "خريطة السوق — تفاصيل شاملة"}
            </div>
            {r.structure ? (
              <StructureMap r={r} lang={lang} />
            ) : (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "20px 0" }}>
                {en ? "No structure data available for this stock." : "لا توجد بيانات بنية كافية لهذا السهم."}
              </div>
            )}
          </div>
        </div>
      )}

      {showIndicators && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ background: "rgba(251,191,36,0.06)", borderRadius: 12, padding: "12px 16px", border: "1px solid rgba(251,191,36,0.15)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: "#fbbf24" }}>
              📈 {en ? "Technical Indicators" : "المؤشرات الفنية"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {indicators.map((ind, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "6px 10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{ind.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ind.color }}>{ind.value}</div>
                  {ind.status && <div style={{ fontSize: 9, color: ind.color, opacity: 0.7 }}>{ind.status}</div>}
                </div>
              ))}
            </div>
            {indicators.length === 0 && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "10px 0" }}>
                {en ? "No indicator data available." : "لا توجد بيانات مؤشرات."}
              </div>
            )}
          </div>
        </div>
      )}

      {showNote && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
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

      {/* تفاصيل الشركة */}
      {showCompanyDetails && (
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            background: "rgba(99,102,241,0.06)",
            borderRadius: 10,
            padding: "12px 14px",
            border: "1px solid rgba(99,102,241,0.15)",
          }}>
            {loadingCompany ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 8 }}>
                {t.loadingCompany}
              </div>
            ) : companyData?.error ? (
              <div style={{ fontSize: 12, color: "#f87171", textAlign: "center", padding: 8 }}>
                {t.companyError}
              </div>
            ) : companyData ? (
              <div>
                {companyData.companyName && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                      {companyData.companyName}
                    </div>
                    {companyData.description && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginTop: 2 }}>
                        {companyData.description.length > 150
                          ? companyData.description.slice(0, 150) + "..."
                          : companyData.description}
                      </div>
                    )}
                  </div>
                )}

                {companyData.scores && (
                  <div style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    marginBottom: 12,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 8, letterSpacing: 0.5 }}>
                      {t.multiSourceAnalysis}
                    </div>
                    {[
                      { label: t.technicalAnalysis, value: companyData.scores.technical, color: '#34d399', icon: '📊' },
                      { label: t.fundamentalAnalysis, value: companyData.scores.fundamental, color: '#60a5fa', icon: '📈' },
                      { label: t.macroAnalysis, value: companyData.scores.macro, color: '#a78bfa', icon: '🌍' },
                    ].map((item) => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 24 }}>{item.icon}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', minWidth: 85 }}>{item.label}</span>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(item.value || 0, 100)}%`,
                            height: '100%',
                            background: item.color,
                            borderRadius: 2,
                            transition: 'width 0.8s ease',
                            boxShadow: `0 0 8px ${item.color}33`,
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: item.color, minWidth: 32, textAlign: 'right' }}>
                          {Math.round(item.value || 0)}%
                        </span>
                      </div>
                    ))}
                    <div style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>متوسط الدرجة</span>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: (() => {
                          const avg = (companyData.scores.technical + companyData.scores.fundamental + companyData.scores.macro) / 3;
                          if (avg >= 70) return '#34d399';
                          if (avg >= 50) return '#fbbf24';
                          return '#f87171';
                        })(),
                      }}>
                        {Math.round((companyData.scores.technical + companyData.scores.fundamental + companyData.scores.macro) / 3)}%
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {companyData.sector && (
                    <div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.sector}</div>
                      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{companyData.sector}</div>
                    </div>
                  )}
                  {companyData.industry && (
                    <div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.industry}</div>
                      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{companyData.industry}</div>
                    </div>
                  )}
                  {companyData.employees && (
                    <div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.employees}</div>
                      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{companyData.employees.toLocaleString()}</div>
                    </div>
                  )}
                  {companyData.ceo && (
                    <div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.ceo}</div>
                      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{companyData.ceo}</div>
                    </div>
                  )}
                  {companyData.website && (
                    <div style={{ gridColumn: "span 2" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.website}</div>
                      <a
                        href={companyData.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 13, color: "#60a5fa", textDecoration: "none" }}
                      >
                        {companyData.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                </div>

                <div style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.marketCap}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                      {companyData.marketCapFormatted || t.notAvailable}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.sharesOutstanding}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                      {companyData.sharesFormatted || t.notAvailable}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.shortable}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: companyData.shortable ? "#34d399" : "#f87171" }}>
                      {companyData.shortable ? t.shortableYes : t.shortableNo}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.shortInterest}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fbbf24" }}>
                      {companyData.shortInterestFormatted || t.notAvailable}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// المكوّن الرئيسي — حماية المشتركين + تبويبات + بطاقة كاملة
// ═══════════════════════════════════════════════════════════
export default function Radar() {
  const [lang, setLang] = useState("ar");
  const t = T[lang];
  const en = lang === "en";
  const [auth, setAuth] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState("brain");
  const [signals, setSignals] = useState([]);
  const [meta, setMeta] = useState(null);
  const [movers, setMovers] = useState(null);
  const [marketRegime, setMarketRegime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const lastScan = useRef(0);

  // ── حماية: استعادة الجلسة ──
  // البوابة (pages/index.js) تتحقّق من المفتاح وبصمة الجهاز أولاً، ثم تحفظ
  // radar_key في localStorage قبل عرض هذا المكوّن. لذا وجود radar_key وحده
  // كافٍ للدخول — لا نطلب المفتاح مرّة ثانية. (radar_expires اختياري: لو
  // كان محفوظاً واحترق نُخرج المستخدم؛ وإلا نعتمد تحقّق البوابة.)
  useEffect(() => {
    const savedKey = localStorage.getItem("radar_key");
    const savedExpires = localStorage.getItem("radar_expires");
    const savedPlan = localStorage.getItem("radar_plan");
    if (savedKey) {
      if (savedExpires && new Date() >= new Date(savedExpires)) {
        // منتهٍ فعلاً حسب تاريخ محفوظ
        localStorage.removeItem("radar_key");
        localStorage.removeItem("radar_plan");
        localStorage.removeItem("radar_expires");
      } else {
        setAuth({ key: savedKey, plan: savedPlan, expires_at: savedExpires || null });
      }
    }
    setAuthChecked(true);
  }, []);

  // ── المفضلة ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem("radar_favorites");
      if (saved) {
        const parsed = JSON.parse(saved);
        setFavorites(parsed.map((f) => (typeof f === "string" ? { symbol: f } : f)));
      }
    } catch {}
  }, []);

  const toggleFav = useCallback((row) => {
    const symbol = typeof row === "string" ? row : row.symbol;
    setFavorites((prev) => {
      const exists = prev.some((f) => f.symbol === symbol);
      const next = exists ? prev.filter((f) => f.symbol !== symbol)
        : [...prev, { symbol, entry: row.price ?? null, structure: row.structure ?? null, addedAt: new Date().toISOString() }];
      try { localStorage.setItem("radar_favorites", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const favSet = useMemo(() => new Set(favorites.map((f) => f.symbol)), [favorites]);

  const handleLogout = () => {
    localStorage.removeItem("radar_key");
    localStorage.removeItem("radar_plan");
    localStorage.removeItem("radar_expires");
    setAuth(null);
  };

  // ── جلب الإشارات ──
  const scan = useCallback(async () => {
    if (Date.now() - lastScan.current < 8000) return;
    lastScan.current = Date.now();
    setLoading(true);
    try {
      const res = await fetch("/api/scan");
      const data = await res.json();
      const list = data.signals || data.results || [];
      // خريطة الحقول لبطاقة SmartCard (score/predictionScore متوافقان)
      const mapped = (Array.isArray(list) ? list : []).map((s) => ({
        ...s,
        score: (s.score ?? s.predictionScore) || 0,
        predictionScore: (s.predictionScore ?? s.score) || 0,
        predictionGrade: s.predictionGrade || "WATCH",
        timing: s.timing || "UNKNOWN",
        levels: s.levels || { t1: 0, t1Pct: 0, t2: 0, t2Pct: 0, t3: 0, t3Pct: 0, sl: 0, slPct: 0, risk: 0 },
        structure: s.structure || null,
      }));
      setSignals(mapped);
      setMeta(data.meta || null);
      if (data.movers) setMovers(data.movers);
      if (data.market_regime) setMarketRegime(data.market_regime);
    } catch {
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (auth) scan(); }, [auth, scan]);

  // ── مقاييس حقيقية ──
  const M = useMemo(() => {
    const n = signals.length;
    const avg = n ? Math.round(signals.reduce((a, s) => a + (s.predictionScore || 0), 0) / n) : 0;
    const breakouts = signals.filter((s) => s.breakout).length;
    const near = signals.filter((s) => s.preBreakout).length;
    const strong = signals.filter((s) => (s.predictionScore || 0) >= 65).length;
    const topGrade = signals.reduce((best, s) => {
      const order = ["WATCH", "GOOD", "STRONG", "PRIME", "ELITE"];
      return order.indexOf(s.predictionGrade) > order.indexOf(best) ? s.predictionGrade : best;
    }, "WATCH");
    // أقوى إشارة اليوم (أعلى ثقة)
    const top = n ? [...signals].sort((a, b) => (b.predictionScore || 0) - (a.predictionScore || 0))[0] : null;
    return { n, avg, breakouts, near, strong, topGrade, top, coverage: meta?.totalScanned || 0, version: meta?.brainVersion || "v20.2" };
  }, [signals, meta]);

  // ── حالة السوق (من market_regime الحقيقي) ──
  const regime = useMemo(() => {
    const raw = String(marketRegime || "").toLowerCase();
    const hasStrong = raw.includes("قوي") || raw.includes("strong") || raw.includes("bull");
    const hasWeak = raw.includes("ضعيف") || raw.includes("weak") || raw.includes("bear");
    if (hasStrong) return { key: "strong", label: en ? "Strong market" : "سوق قوي", c: AIC.green, icon: "✅",
      note: en ? "Favorable conditions for signals." : "ظروف مواتية للإشارات — فرص أكثر جودة." };
    if (hasWeak) return { key: "weak", label: en ? "Weak market" : "سوق ضعيف", c: AIC.amber, icon: "🛡️",
      note: en ? "The radar is stricter to protect you. Fewer, higher-quality signals." : "الرادار متشدد لحمايتك — فرص أقل لكن أعلى جودة." };
    if (!marketRegime) return null;
    return { key: "neutral", label: en ? "Neutral market" : "سوق متوسط", c: AIC.cyan, icon: "〰️",
      note: en ? "Mixed conditions — trade selectively." : "ظروف متباينة — انتقِ الفرص بعناية." };
  }, [marketRegime, en]);

  // ── حالة الجلسة (بتوقيت نيويورك الحقيقي) ──
  const session = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t)?.value;
      const wd = get("weekday");
      let h = parseInt(get("hour"), 10); if (h === 24) h = 0;
      const mins = h * 60 + parseInt(get("minute"), 10);
      const weekend = wd === "Sat" || wd === "Sun";
      if (weekend) return { key: "closed", label: en ? "Market closed" : "السوق مغلق", c: AIC.faint, icon: "🌙", note: en ? "Weekend" : "عطلة نهاية الأسبوع" };
      if (mins >= 570 && mins < 960) return { key: "open", label: en ? "Market open" : "السوق مفتوح", c: AIC.green, icon: "🟢", note: en ? "Live data" : "بيانات حيّة" };
      if (mins >= 240 && mins < 570) return { key: "pre", label: en ? "Pre-market" : "قبل الافتتاح", c: AIC.cyan, icon: "🌅", note: en ? "Based on yesterday's close" : "مبني على إغلاق أمس" };
      return { key: "closed", label: en ? "Market closed" : "السوق مغلق", c: AIC.faint, icon: "🌙", note: en ? "Last saved signals" : "آخر إشارات محفوظة" };
    } catch { return null; }
  }, [en]);

  // ── تقسيم الفرص إلى أقسام حقيقية ──
  const tiers = useMemo(() => {
    const t2 = { ready: [], watch: [], late: [], breakout: [], elite: [] };
    for (const s of signals) {
      if (s.entry_state === "in_zone") t2.ready.push(s);
      else if (s.entry_state === "wait_pullback") t2.watch.push(s);
      else if (s.entry_state === "chasing") t2.late.push(s);
      if (s.breakout) t2.breakout.push(s);
      if (s.predictionGrade === "PRIME" || s.predictionGrade === "ELITE") t2.elite.push(s);
    }
    for (const k of Object.keys(t2)) t2[k].sort((a, b) => (b.predictionScore || 0) - (a.predictionScore || 0));
    return t2;
  }, [signals]);

  const thinkWords = en ? ["Scanning market…", "Analyzing momentum…", "Finding opportunities…", "Detecting patterns…", "Thinking…"]
    : ["يمسح السوق…", "يحلّل الزخم…", "يبحث عن فرص…", "يرصد الأنماط…", "يفكّر…"];
  const soonLabel = en ? "Soon" : "قريباً";

  const navBtns = [
    { id: "brain", label: en ? "🧠 AI Brain" : "🧠 عقل الذكاء" },
    { id: "radar", label: en ? "📡 Radar" : "📡 الرادار" },
    { id: "movers", label: en ? "📊 Movers" : "📊 حركة السوق" },
    { id: "favorites", label: en ? `⭐ Favorites${favorites.length ? " (" + favorites.length + ")" : ""}` : `⭐ المفضلة${favorites.length ? " (" + favorites.length + ")" : ""}` },
    { id: "performance", label: en ? "📊 Performance" : "📊 الأداء", soon: true },
    { id: "learning", label: en ? "🌱 Learning" : "🌱 التعلّم", soon: true },
  ];

  const ghostBtn = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: AIC.sub, borderRadius: 10, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" };
  const primaryBtn = { background: `linear-gradient(135deg, ${AIC.iris}, ${AIC.iris2})`, border: "none", borderRadius: 14, padding: "14px 24px", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 8px 28px ${AIC.iris}55` };

  const sortedSignals = useMemo(() => [...signals].sort((a, b) => (b.predictionScore || 0) - (a.predictionScore || 0)), [signals]);

  if (!authChecked) return null;

  // ── شاشة الدخول (حماية المشتركين) ──
  if (!auth) return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(1200px 600px at 50% -10%, #0b0f1e, #070912)` }} dir={en ? "ltr" : "rtl"}>
      <LoginScreen onLogin={setAuth} t={t} lang={lang} setLang={setLang} />
    </div>
  );

  return (
    <div dir={en ? "ltr" : "rtl"} style={{ minHeight: "100vh", background: `radial-gradient(1200px 600px at 50% -10%, #0b0f1e, #070912)`, color: AIC.ink, fontFamily: "system-ui, -apple-system, sans-serif", position: "relative", overflow: "hidden" }}>
      <AINeuralBg />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "22px 16px 60px" }}>

        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${AIC.iris}, ${AIC.iris2})`, display: "grid", placeItems: "center", fontSize: 18, boxShadow: `0 0 20px ${AIC.iris}66` }}>🧠</div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>
              RADARAZ<span style={{ background: `linear-gradient(135deg, ${AIC.iris2}, ${AIC.teal})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>-AI</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: AIC.faint }}>{auth.plan === "trial" ? (en ? "Trial" : "تجربة") : (en ? "Member" : "مشترك")}</span>
            <button onClick={() => setLang(en ? "ar" : "en")} style={ghostBtn}>{en ? "عربي" : "EN"}</button>
            <button onClick={handleLogout} style={ghostBtn}>{en ? "Logout" : "خروج"}</button>
          </div>
        </div>

        {/* nav tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {navBtns.map((b) => (
            <button key={b.id} onClick={() => setTab(b.id)} style={{
              position: "relative", padding: "9px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              color: tab === b.id ? "#fff" : AIC.sub,
              background: tab === b.id ? `linear-gradient(135deg, ${AIC.iris}, ${AIC.iris2})` : "rgba(255,255,255,0.04)",
              border: `1px solid ${tab === b.id ? "transparent" : "rgba(255,255,255,0.08)"}`,
              boxShadow: tab === b.id ? `0 6px 20px ${AIC.iris}55` : "none",
            }}>
              {b.label}
              {b.soon && <span style={{ marginInlineStart: 6, fontSize: 8, padding: "1px 6px", borderRadius: 8, background: `${AIC.iris}33`, color: AIC.iris2 }}>{soonLabel}</span>}
            </button>
          ))}
        </div>

        {/* ===== عقل الذكاء ===== */}
        {tab === "brain" && (
          <>
            <AICore active={loading} />
            <ThinkingLine words={thinkWords} />

            {/* حالة السوق + حالة الجلسة */}
            {(regime || session) && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "20px 0 4px" }}>
                {regime && (
                  <div style={{ flex: 1, minWidth: 200, background: `${regime.c}12`, border: `1px solid ${regime.c}40`, borderRadius: 16, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{regime.icon}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: regime.c }}>{regime.label}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: AIC.sub, marginTop: 6, lineHeight: 1.6 }}>{regime.note}</div>
                  </div>
                )}
                {session && (
                  <div style={{ flex: 1, minWidth: 200, background: `${session.c}12`, border: `1px solid ${session.c}40`, borderRadius: 16, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{session.icon}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: session.c }}>{session.label}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: AIC.sub, marginTop: 6, lineHeight: 1.6 }}>{session.note}</div>
                  </div>
                )}
              </div>
            )}

            {/* أقوى إشارة اليوم */}
            {M.top && (
              <div style={{ margin: "12px 0 4px", background: `linear-gradient(135deg, ${AIC.iris}18, ${AIC.iris2}10)`, border: `1px solid ${AIC.iris}44`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>⭐</span>
                  <div>
                    <div style={{ fontSize: 10.5, color: AIC.sub }}>{en ? "Top signal today" : "أقوى إشارة اليوم"}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: AIC.ink }}>
                      {M.top.symbol} <span style={{ fontSize: 12, color: AIC.sub }}>${(+M.top.price).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: en ? "right" : "left" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: confColor(M.top.predictionScore), fontFamily: "ui-monospace, monospace" }}>{Math.round(M.top.predictionScore)}%</div>
                  <div style={{ fontSize: 9, color: AIC.sub }}>{en ? "AI Confidence" : "ثقة الذكاء"}</div>
                </div>
              </div>
            )}

            {/* توزيع الفرص */}
            {M.n > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0 4px" }}>
                {[
                  { label: en ? "🟢 In Zone" : "🟢 جاهزة", v: tiers.ready.length, c: AIC.green },
                  { label: en ? "🔵 Watch" : "🔵 مراقبة", v: tiers.watch.length, c: "#60a5fa" },
                  { label: en ? "🚀 Breakout" : "🚀 اختراق", v: tiers.breakout.length, c: AIC.teal },
                  { label: en ? "💎 Elite" : "💎 نخبة", v: tiers.elite.length, c: "#00d4aa" },
                ].map((x) => (
                  <div key={x.label} style={{ flex: 1, minWidth: 78, background: AIC.glass, border: `1px solid ${AIC.glassBorder}`, borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: x.c, fontFamily: "ui-monospace, monospace" }}>{x.v}</div>
                    <div style={{ fontSize: 10, color: AIC.sub, marginTop: 3 }}>{x.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "22px 0 14px" }}>
              <AIStat label={en ? "Market Coverage" : "تغطية السوق"} value={M.coverage ? M.coverage.toLocaleString() : "—"} sub={en ? "symbols" : "رمز"} accent={AIC.iris2} />
              <AIStat label={en ? "Signals Today" : "إشارات اليوم"} value={M.n || "—"} accent={AIC.teal} />
              <AIStat label={en ? "Avg Confidence" : "متوسط الثقة"} value={M.n ? `${M.avg}%` : "—"} accent={confColor(M.avg)} />
              <AIStat label={en ? "Breakouts" : "اختراقات"} value={M.breakouts} accent={AIC.green} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
              <AIStat label={en ? "Top Grade" : "أعلى تصنيف"} value={M.n ? (en ? AI_GRADE[M.topGrade].en : AI_GRADE[M.topGrade].ar) : "—"} accent={AI_GRADE[M.topGrade]?.c} />
              <AIStat label={en ? "Model" : "إصدار النموذج"} value={M.version} accent={AIC.cyan} />
              <AIStat label={en ? "State" : "الحالة الحيّة"} value={loading ? (en ? "Scanning" : "يمسح") : (en ? "Focused" : "مُركّز")} accent={AIC.amber} />
            </div>

            <div style={{ fontSize: 13, fontWeight: 800, color: AIC.sub, margin: "6px 0 12px" }}>🧠 {en ? "AI Memory" : "ذاكرة الذكاء"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {[
                en ? `Detected today: ${M.breakouts} breakout patterns` : `رصد اليوم: ${M.breakouts} نمط اختراق`,
                en ? `Near breakout: ${M.near} stocks below resistance` : `قرب اختراق: ${M.near} سهم تحت المقاومة`,
                en ? `High-quality signals: ${M.strong}` : `إشارات عالية الجودة: ${M.strong}`,
                en ? `Full scan: ${M.coverage.toLocaleString()} symbols` : `مسح شامل: ${M.coverage.toLocaleString()} رمز`,
              ].map((line, i) => (
                <div key={i} style={{ padding: "11px 14px", background: AIC.glass, border: `1px solid ${AIC.glassBorder}`, borderRadius: 12, fontSize: 12.5, color: AIC.ink, opacity: 0.9 }}>🧠 {line}</div>
              ))}
            </div>

            <button onClick={scan} disabled={loading} style={{ ...primaryBtn, width: "100%" }}>
              {loading ? (en ? "⟳ Scanning…" : "⟳ جاري المسح…") : (en ? "📡 Scan Market Now" : "📡 مسح السوق الآن")}
            </button>
          </>
        )}

        {/* ===== الرادار / التوقعات — البطاقة الكاملة SmartCard ===== */}
        {tab === "radar" && (
          <>
            <button onClick={scan} disabled={loading} style={{ ...primaryBtn, width: "100%", marginBottom: 16 }}>
              {loading ? (en ? "⟳ Scanning…" : "⟳ جاري المسح…") : (en ? "📡 Scan Market Now" : "📡 مسح السوق الآن")}
            </button>

            {loading && (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <AICore active />
                <ThinkingLine words={thinkWords} />
              </div>
            )}

            {!loading && signals.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 24px", background: AIC.glass, border: `1px solid ${AIC.glassBorder}`, borderRadius: 20 }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>🔭</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{en ? "AI is searching for high-quality opportunities" : "الذكاء يبحث عن فرص عالية الجودة"}</div>
                <div style={{ fontSize: 12.5, color: AIC.sub }}>{en ? "No qualified opportunities right now · Quality filters active" : "لم تُرصد فرص مؤهّلة الآن · فلاتر الجودة نشطة"}</div>
              </div>
            )}

            {!loading && signals.length > 0 && (() => {
              // أقسام حقيقية — يظهر القسم فقط إن كان فيه إشارات
              const sections = [
                { key: "ready", list: tiers.ready, title: en ? "🔥 Ready to enter" : "🔥 جاهزة للدخول", sub: en ? "Price in entry zone now" : "السعر في منطقة الدخول الآن", color: "#ff6b35", bg: "rgba(255,107,53,0.08)", border: "rgba(255,107,53,0.3)", open: true },
                { key: "breakout", list: tiers.breakout, title: en ? "🚀 Breakouts" : "🚀 اختراقات", sub: en ? "Broke above resistance" : "تجاوزت المقاومة", color: "#2dd4bf", bg: "rgba(45,212,191,0.08)", border: "rgba(45,212,191,0.3)", open: true },
                { key: "elite", list: tiers.elite, title: en ? "💎 Elite" : "💎 نخبة", sub: en ? "Highest quality (Prime/Elite)" : "أعلى جودة (ممتاز/نخبة)", color: "#00d4aa", bg: "rgba(0,212,170,0.08)", border: "rgba(0,212,170,0.3)", open: true },
                { key: "watch", list: tiers.watch, title: en ? "🔵 Watch zones" : "🔵 مناطق مراقبة", sub: en ? "Wait for a pullback to entry" : "انتظر ارتداداً لمنطقة الدخول", color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.3)", open: false },
                { key: "late", list: tiers.late, title: en ? "🚀 Late momentum" : "🚀 زخم متأخر", sub: en ? "Extended — higher risk" : "ممتد — مخاطرة أعلى", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)", open: false },
              ].filter((s) => s.list.length > 0);

              if (sections.length === 0) {
                // إشارات موجودة لكن بلا حالة دخول — اعرضها كقائمة واحدة بدل إخفائها
                return (
                  <>
                    <div style={{ fontSize: 11, color: AIC.faint, marginBottom: 12 }}>{signals.length} {en ? "opportunities" : "فرصة"}</div>
                    {sortedSignals.map((r, i) => (
                      <SmartCard key={r.symbol} r={r} idx={i} t={t} lang={lang} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />
                    ))}
                  </>
                );
              }

              return sections.map((sec) => (
                <CollapsibleSection key={sec.key} title={sec.title} subtitle={sec.sub} count={sec.list.length}
                  color={sec.color} bg={sec.bg} border={sec.border} t={t} defaultOpen={sec.open}>
                  {sec.list.map((r, i) => (
                    <SmartCard key={sec.key + "-" + r.symbol} r={r} idx={i} t={t} lang={lang} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />
                  ))}
                </CollapsibleSection>
              ));
            })()}
          </>
        )}

        {/* ===== حركة السوق ===== */}
        {tab === "movers" && (
          <>
            <button onClick={scan} disabled={loading} style={{ ...primaryBtn, width: "100%", marginBottom: 16 }}>
              {loading ? (en ? "⟳ Scanning…" : "⟳ جاري المسح…") : (en ? "📡 Scan Market Now" : "📡 مسح السوق الآن")}
            </button>
            {movers ? (
              <MarketMovers movers={movers} signals={signals} t={t} lang={lang} />
            ) : (
              <div style={{ textAlign: "center", padding: "48px 24px", background: AIC.glass, border: `1px solid ${AIC.glassBorder}`, borderRadius: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{en ? "Market movers not available yet" : "بيانات حركة السوق غير متوفّرة بعد"}</div>
                <div style={{ fontSize: 12, color: AIC.sub, lineHeight: 1.7 }}>{en ? "Enable movers in the scan API to populate this section." : "تُفعّل حركة السوق بإضافة قائمة movers في واجهة المسح."}</div>
              </div>
            )}
          </>
        )}

        {/* ===== المفضلة ===== */}
        {tab === "favorites" && (
          <>
            {favorites.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 24px", background: AIC.glass, border: `1px solid ${AIC.glassBorder}`, borderRadius: 20 }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>⭐</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{en ? "No favorites yet" : "لا توجد أسهم في المفضلة"}</div>
                <div style={{ fontSize: 12.5, color: AIC.sub }}>{en ? "Tap ⭐ on any stock to save it here" : "اضغط ⭐ على أي سهم لحفظه هنا"}</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: AIC.faint, marginBottom: 12 }}>{favorites.length} {en ? "saved" : "محفوظة"}</div>
                {favorites.map((fav, i) => {
                  // ادمج البيانات الحيّة إن كان السهم ضمن إشارات اليوم
                  const live = signals.find((s) => s.symbol === fav.symbol);
                  const row = live || { symbol: fav.symbol, price: fav.entry || 0, change_pct: 0, predictionScore: 0, predictionGrade: "WATCH", structure: fav.structure || null, levels: { t1: 0, sl: 0 } };
                  return <SmartCard key={"fav-" + fav.symbol} r={row} idx={i} t={t} lang={lang} isFav={true} onToggleFav={toggleFav} />;
                })}
              </>
            )}
          </>
        )}

        {/* ===== الأداء (قريباً) ===== */}
        {tab === "performance" && (
          <SoonPanel soonLabel={soonLabel}
            title={en ? "Performance Analytics" : "تحليلات الأداء"}
            sub={en ? "Win rate, average return, and best patterns — measurement begins once enough real signal outcomes are collected." : "معدل النجاح، متوسط العائد، وأفضل الأنماط — يبدأ القياس بعد جمع بيانات كافية من الإشارات الفعلية."} />
        )}

        {/* ===== التعلّم (قريباً) ===== */}
        {tab === "learning" && (
          <SoonPanel soonLabel={soonLabel}
            title={en ? "Learning History" : "سجلّ التعلّم"}
            sub={en ? "Model evolution and accuracy over time — appears after outcome tracking is enabled." : "تطوّر النموذج ودقّته عبر الزمن — يظهر بعد تفعيل قياس النتائج."} />
        )}

        <div style={{ marginTop: 40, textAlign: "center", fontSize: 10.5, color: AIC.faint, lineHeight: 1.7 }}>
          {en ? "Not investment advice · Confidence is a model estimate, not a guarantee" : "ليست نصيحة استثمارية · الثقة تقدير آلي وليست ضماناً"}
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        @keyframes aicBreath { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes aicFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes aicSpin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        .aic-ring { position: absolute; border-radius: 50%; border: 1px solid rgba(124,108,255,0.25); }
        .aic-ring1 { width: 150px; height: 150px; animation: aicSpin 14s linear infinite; border-top-color: ${AIC.teal}; }
        .aic-ring2 { width: 178px; height: 178px; animation: aicSpin 20s linear infinite reverse; border-left-color: ${AIC.iris2}; }
        .aic-ring3 { width: 200px; height: 200px; animation: aicSpin 28s linear infinite; border-bottom-color: ${AIC.cyan}; opacity: 0.6; }
        button:hover:not(:disabled) { filter: brightness(1.08); }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: rgba(124,108,255,0.3); border-radius: 4px; }
      `}</style>
    </div>
  );
}
