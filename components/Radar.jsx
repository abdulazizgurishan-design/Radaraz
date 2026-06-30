import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// حقن حركة نبض اللمبة مرة واحدة (آمن مع SSR)
if (typeof document !== "undefined" && !document.getElementById("az-kf")) {
  const _el = document.createElement("style");
  _el.id = "az-kf";
  _el.textContent = "@keyframes azpulse{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.5),0 0 8px rgba(52,211,153,.9)}50%{box-shadow:0 0 0 6px rgba(52,211,153,0),0 0 14px rgba(52,211,153,1)}}";
  document.head.appendChild(_el);
}

// 🔒 عتبة العرض = عتبة الحفظ في scan.js (SAVE_MIN_EP). كل إشارة معروضة تُحفظ وتُقيّم.
const DISPLAY_MIN_SCORE = 60;

const T = {
  ar: {
    title: "رادار",
    subtitle: "الالتزام بوقف الخسارة يخفف المخاطرة",
    trial: "🕐 تجربة مجانية",
    subscribed: "✅ مشترك",
    logout: "خروج",
    scanRange: "إشارات اليوم",
    explosive: "💥 انفجاري",
    high: "🔥 عالي",
    all: "✅ الكل",
    scanBtn: "📡  مسح السوق الفوري",
    scanning: "⟳  جاري المسح...",
    autoRefresh: "تحديث تلقائي كل دقيقة",
    filterAll: "الكل",
    filterLeaders: "📈 استثمار",
    filterSpec: "⚡ مضاربة",
    filterRebound: "🔄 ارتداد",
    filterSniper: "🎯 القناص",
    sectionRebound: "🔄 ارتداد الأسهم القوية",
    sectionReboundSub: "أسهم قوية ترتد من تصحيح مؤقت · صفقة أيام",
    reboundExplain: "🔄 استراتيجية الارتداد: نقتنص الأسهم القوية (عائد +20% خلال 3 شهور) في لحظة تصحيحها المؤقت، عند تأكيد بدء الارتداد بتقاطع المتوسطات على شمعة الساعة. تحليل البنية على شمعة اليوم. تبقى الصفقة أياماً حتى تحقق الهدف +3%.",
    reboundDay: "يوم",
    reboundOf: "من",
    reboundTarget3: "الهدف +3%",
    reboundStrong: "💪 سهم قوي",
    reboundReturn: "عائد 3 شهور",
    marketMovers: "📊 حركة السوق",
    marketMoversSub: "أعلى الأسهم حركة في السوق · اضغط أي سهم لتحليل بنيته",
    opportunities: "فرصة",
    noOpps: "لا توجد فرص حالياً",
    marketClosed: "سيتم تحديث الإشارات بعد مسح الأدمن",
    stopLoss: "🛑 وقف الخسارة",
    risk: "مخاطرة",
    volume: "حجم",
    footer1: "RADAR AZ PRO",
    footer2: "ليست نصيحة استثمارية · مسح أكثر من 10,000 سهم · تحليل فني عميق · أهداف ووقف ذكية حسب تصنيف السهم · زخم الكميات + أخبار لحظية 🚀",
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
    bannerErrorSub: "تعذر جلب الإشارات",
    bannerClosed: "لا توجد إشارات حالياً",
    bannerClosedSub: "سيتم تحديث الإشارات بعد مسح الأدمن",
    bannerPre: "Pre-Market نشط",
    bannerPreSub: "أفضل النتائج بعد 4:30م",
    bannerOk: "متصل — أسعار حية",
    bannerOkSub: "Polygon API يعمل بشكل طبيعي",
    lastUpdate: "آخر تحديث",
    largeCap: "🐋 Large Cap",
    midCap: "🦈 Mid Cap",
    smallCap: "🐟 Small Cap",
    microCap: "🦐 Micro Cap",
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
    weekQuiet: "هدوء أسبوعي",
    rsi: "RSI",
    rsiOverbought: "إشباع شرائي",
    rsiHealthy: "زخم صحي",
    rsiNeutral: "محايد",
    earlyTooltip: "كل المؤشرات الفنية مطابقة + بداية ارتفاع + هدوء أسبوعي = فرصة قبل الانفجار",
    favorites: "⭐ المفضلة",
    addFav: "أضف للمفضلة",
    removeFav: "إزالة من المفضلة",
    noFavs: "لا توجد أسهم في المفضلة",
    noFavsSub: "اضغط ⭐ على أي سهم لحفظه في مفضلتك الخاصة",
    favPrivate: "مفضلتك خاصة بك — محفوظة في جهازك فقط",
    sniperBadge: "🎯 قناص",
    sniperExplain: "🎯 استراتيجية القناص: نقتنص الأسهم ذات الزخم القوي (RSI 50-65 + RVOL ≥ 4x) مع تقاطع MA9/MA21 على شمعة الساعة. صفقات سريعة بأهداف +3.5% إلى +6% ووقف صارم 4%.",
  },
  en: {
    title: "Radar",
    subtitle: "Stop loss reduces risk",
    trial: "🕐 Free Trial",
    subscribed: "✅ Subscribed",
    logout: "Logout",
    scanRange: "Today's Signals",
    explosive: "💥 Explosive",
    high: "🔥 High",
    all: "✅ All",
    scanBtn: "📡  Start Live Market Scan",
    scanning: "⟳  Scanning...",
    autoRefresh: "Auto refresh every minute",
    filterAll: "All",
    filterLeaders: "📈 Invest",
    filterSpec: "⚡ Day Trade",
    filterRebound: "🔄 Rebound",
    filterSniper: "🎯 Sniper",
    sectionRebound: "🔄 Strong Stock Rebound",
    sectionReboundSub: "Strong stocks bouncing from a dip · multi-day trade",
    reboundExplain: "🔄 Rebound strategy: we catch strong stocks (+20% over 3 months) during a temporary dip, confirmed by an MA crossover on the hourly candle. Structure analyzed on the daily candle. The trade holds for days until the +3% target.",
    reboundDay: "Day",
    reboundOf: "of",
    reboundTarget3: "Target +3%",
    reboundStrong: "💪 Strong",
    reboundReturn: "3M return",
    marketMovers: "📊 Market Movers",
    marketMoversSub: "Most active stocks · tap any to analyze its structure",
    opportunities: "opportunities",
    noOpps: "No opportunities found",
    marketClosed: "Signals will appear after admin scan",
    stopLoss: "🛑 Stop Loss",
    risk: "Risk",
    volume: "Volume",
    footer1: "RADAR AZ PRO",
    footer2: "Not investment advice · Scans 10,000+ stocks · Deep technical analysis · Smart targets & stops by stock profile · Volume momentum + live news 🚀",
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
    bannerErrorSub: "Failed to load signals",
    bannerClosed: "No signals yet",
    bannerClosedSub: "Signals will appear after admin scan",
    bannerPre: "Pre-Market Active",
    bannerPreSub: "Best results after 9:30 AM ET",
    bannerOk: "Connected — Live Prices",
    bannerOkSub: "Polygon API working normally",
    lastUpdate: "Last update",
    largeCap: "🐋 Large Cap",
    midCap: "🦈 Mid Cap",
    smallCap: "🐟 Small Cap",
    microCap: "🦐 Micro Cap",
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
    weekQuiet: "Weekly Quiet",
    rsi: "RSI",
    rsiOverbought: "Overbought",
    rsiHealthy: "Healthy Momentum",
    rsiNeutral: "Neutral",
    earlyTooltip: "All technicals aligned + early move + weekly quiet = opportunity before breakout",
    favorites: "⭐ Favorites",
    addFav: "Add to favorites",
    removeFav: "Remove from favorites",
    noFavs: "No favorite stocks yet",
    noFavsSub: "Tap ⭐ on any stock to save it to your private list",
    favPrivate: "Your favorites are private — saved on your device only",
    sniperBadge: "🎯 Sniper",
    sniperExplain: "🎯 Sniper strategy: catch strong momentum stocks (RSI 50-65 + RVOL ≥ 4x) with MA9/MA21 crossover on hourly. Quick trades with +3.5% to +6% targets and strict 4% stop loss.",
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
  sectionHeader: (bg, border, color, open) => ({ background: bg, border: `1px solid ${border}`, borderRadius: open ? "14px 14px 0 0" : 14, padding: "14px 18px", marginBottom: 0, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none", transition: "border-radius 0.2s" }),
  sectionTitle: (color) => ({ fontSize: 14, fontWeight: 800, color, letterSpacing: 1 }),
  sectionCount: (color, bg) => ({ fontSize: 13, fontWeight: 800, color, background: bg, borderRadius: 20, padding: "2px 10px", fontFamily: "monospace" }),
  sectionChevron: (open) => ({ fontSize: 10, color: "rgba(255,255,255,0.4)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block", marginRight: 8 }),
  sectionBody: (open) => ({ overflow: "hidden", maxHeight: open ? "9999px" : 0, transition: "max-height 0.3s ease", border: open ? "1px solid rgba(255,255,255,0.07)" : "none", borderTop: "none", borderRadius: "0 0 14px 14px", padding: open ? "10px 0 0 0" : 0, marginBottom: open ? 12 : 0 }),
  emptyBox: { textAlign: "center", padding: "64px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 20 },
  footer: { marginTop: 32, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" },
  cardWrap: (open, glowColor) => ({ background: "linear-gradient(135deg,rgba(15,20,35,0.95),rgba(20,28,48,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, marginBottom: 10, overflow: "hidden", transition: "box-shadow 0.3s", boxShadow: open ? `0 8px 32px ${glowColor}` : "0 2px 8px rgba(0,0,0,0.3)" }),
  cardHeader: { padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  cardIdx: { fontSize: 10, color: "rgba(255,255,255,0.2)", minWidth: 22, fontFamily: "monospace" },
  cardSymbol: { fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: 1, fontFamily: "monospace" },
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

function fmtPct(n) {
  if (n == null) return "";
  return (n >= 0 ? "+" : "") + Math.round(+n) + "%";
}

// 🎯 شارة القناص
function SniperBadge({ t }) {
  return (
    <span style={{
      fontSize: 9, padding: "3px 9px", borderRadius: 20,
      background: "linear-gradient(135deg,rgba(251,191,36,0.3),rgba(245,158,11,0.2))",
      color: "#fbbf24", fontWeight: 800, border: "1px solid rgba(251,191,36,0.5)",
      letterSpacing: 0.5,
    }}>{t.sniperBadge}</span>
  );
}

// 🔄 شارة الارتداد + عدّاد المدة
function ReboundBadge({ t }) {
  return (
    <span style={{
      fontSize: 9, padding: "3px 9px", borderRadius: 20,
      background: "linear-gradient(135deg,rgba(56,189,248,0.25),rgba(14,165,233,0.18))",
      color: "#38bdf8", fontWeight: 800, border: "1px solid rgba(56,189,248,0.5)",
      letterSpacing: 0.5,
    }}>🔄 ارتداد</span>
  );
}

// 🔍 شارة الرصد المبكر
function EarlyBadge({ t }) {
  return (
    <span style={{
      fontSize: 9, padding: "3px 9px", borderRadius: 20,
      background: "linear-gradient(135deg,rgba(16,185,129,0.25),rgba(5,150,105,0.18))",
      color: "#34d399", fontWeight: 800, border: "1px solid rgba(52,211,153,0.5)",
      letterSpacing: 0.5, animation: "earlyglow 2s ease-in-out infinite",
    }}>{t.earlyBadge}</span>
  );
}

// 📈 شارة المتوسطات
function MABadge({ signal, lang }) {
  if (!signal) return null;
  const map = {
    "تقاطع ذهبي 🌟": { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)" },
    "صاعد قوي ⚡":   { color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)" },
    "EMA صاعد":      { color: "#60a5fa", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.3)" },
    "صاعد":          { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)" },
  };
  const enMap = { "تقاطع ذهبي 🌟": "Golden cross 🌟", "صاعد قوي ⚡": "Strong up ⚡", "EMA صاعد": "EMA rising", "صاعد": "Up" };
  const c = map[signal] || map["صاعد"];
  const label = lang === "en" ? (enMap[signal] || signal) : signal;
  return (
    <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 20, background: c.bg, color: c.color, fontWeight: 700, border: `1px solid ${c.border}` }}>
      📈 {label}
    </span>
  );
}

function rsiInfo(rsi, t) {
  if (rsi == null) return null;
  if (rsi >= 72) return { color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", label: t.rsiOverbought };
  if (rsi >= 50 && rsi <= 65) return { color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)", label: t.rsiHealthy };
  return { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)", label: t.rsiNeutral };
}

function RSIBadge({ rsi, t }) {
  const info = rsiInfo(rsi, t);
  if (!info) return null;
  return (
    <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 20, background: info.bg, color: info.color, fontWeight: 700, border: `1px solid ${info.border}` }}>
      📊 RSI {rsi}
    </span>
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

// 🔄 عدّاد مدة الارتداد (كم يوم مضى من 10)
function reboundDayInfo(createdAt) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (isNaN(d)) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000) + 1;
  return { day: Math.min(days, 10), total: 10 };
}

function Card({ r, idx, t, lang, isEarly, isFav, onToggleFav }) {
  const en = lang === "en";
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const isRebound = r.type === "ارتداد" || r.is_rebound;
  const isSniper = r.is_sniper || r.sniper_type || false;
  
  const formatPrice = useCallback((n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);
  const formatPct   = useCallback((n) => (n >= 0 ? "+" : "") + Math.round(+n) + "%", []);
  const scoreColor  = r.score >= 80 ? "#ff6b35" : r.score >= 60 ? "#ffd700" : "#00d4aa";
  const glowColor   = isSniper ? "rgba(251,191,36,0.25)" : isRebound ? "rgba(56,189,248,0.2)" : isEarly ? "rgba(52,211,153,0.2)" : r.score >= 80 ? "rgba(255,107,53,0.15)" : r.score >= 60 ? "rgba(255,215,0,0.1)" : "rgba(0,212,170,0.1)";

  const typeTag = isSniper
    ? { label: en ? "🎯 Sniper" : "🎯 قناص", color: "#fbbf24", bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.4)" }
    : isRebound
    ? { label: en ? "🔄 Rebound" : "🔄 ارتداد", color: "#38bdf8", bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.3)" }
    : r.type === "استثمار"
    ? { label: en ? "📈 Investment" : "📈 استثمار", color: "#818cf8", bg: "rgba(129,140,248,0.12)", border: "rgba(129,140,248,0.25)" }
    : { label: en ? "⚡ Speculation" : "⚡ مضاربة", color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.25)" };

  const dayInfo = useMemo(() => isRebound ? reboundDayInfo(r.created_at) : null, [isRebound, r.created_at]);

  const timeInfo = useMemo(() => {
    if (!r.created_at) return null;
    const d = new Date(r.created_at);
    if (isNaN(d)) return null;
    const clock = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Riyadh" });
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    let ago;
    if (mins < 1) ago = "الآن";
    else if (mins < 60) ago = `قبل ${mins} د`;
    else { const h = Math.floor(mins / 60); ago = `قبل ${h} س`; }
    const isNew = mins < 60;
    return { clock, ago, isNew };
  }, [r.created_at]);

  const wrapStyle = isSniper
    ? { ...S.cardWrap(open, glowColor), border: "1px solid rgba(251,191,36,0.5)", background: "linear-gradient(135deg,rgba(30,24,12,0.95),rgba(40,30,15,0.95))" }
    : isRebound
    ? { ...S.cardWrap(open, glowColor), border: "1px solid rgba(56,189,248,0.4)", background: "linear-gradient(135deg,rgba(8,22,34,0.95),rgba(10,26,42,0.95))" }
    : isEarly
    ? { ...S.cardWrap(open, glowColor), border: "1px solid rgba(52,211,153,0.4)", background: "linear-gradient(135deg,rgba(12,28,22,0.95),rgba(15,32,26,0.95))" }
    : S.cardWrap(open, glowColor);

  const ready = !isRebound && entryReady(r);
  const finalWrap = ready ? { ...wrapStyle, border: "1px solid rgba(52,211,153,0.5)", boxShadow: "0 0 22px rgba(52,211,153,0.22)" } : wrapStyle;

  const metrics = useMemo(() => {
    const base = [
      { label: "EP",     value: r.score ? r.score + "%" : "—",           color: "#a78bfa" },
      { label: "RVOL",   value: r.rvol  ? r.rvol.toFixed(1) + "x" : "—", color: "#fb923c" },
      { label: t.volume, value: ((r.volume || 0) / 1e6).toFixed(1) + "M", color: "#34d399" },
      { label: "تغيّر",  value: formatPct(r.change_pct),                  color: r.change_pct >= 0 ? "#00d4aa" : "#ff4757" },
    ];
    if (isSniper && r.sniper_desc) base.push({ label: "🎯", value: r.sniper_desc, color: "#fbbf24" });
    if (isRebound && r.ret3m != null) base.push({ label: t.reboundReturn, value: "+" + r.ret3m + "%", color: "#38bdf8" });
    if (r.atr14) base.push({ label: t.atr, value: "$" + (+r.atr14).toFixed(2), color: "#c084fc" });
    if (r.rsi != null) {
      const ri = rsiInfo(r.rsi, t);
      base.push({ label: t.rsi, value: String(r.rsi), color: ri ? ri.color : "#94a3b8" });
    }
    if (r.week_max_jump != null && isEarly) base.push({ label: t.weekQuiet, value: "▲" + (+r.week_max_jump).toFixed(1) + "%", color: "#34d399" });
    return base;
  }, [r, formatPct, t, isEarly, isRebound, isSniper]);

  const tpLevels = useMemo(() => {
    const L = r.levels || {};
    return [
      { n: 1, value: L.t1, pct: L.t1Pct, label: "TP1", color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
      { n: 2, value: L.t2, pct: L.t2Pct, label: "TP2", color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
      { n: 3, value: L.t3, pct: L.t3Pct, label: "TP3", color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
    ];
  }, [r]);

  return (
    <div style={finalWrap}>
      <div style={S.cardHeader} onClick={() => setOpen((o) => !o)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}>
        <span style={S.cardIdx}>{String(idx + 1).padStart(2, "0")}</span>
        <div style={{ minWidth: 64 }}>
          <div style={S.cardSymbol}>{r.symbol}</div>
          {isSniper && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: 9, fontWeight: 800, color: "#fbbf24" }}>
              🎯 {en ? "Sniper" : "قناص"}
            </span>
          )}
          {isRebound && dayInfo && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: 9, fontWeight: 800, color: "#38bdf8" }}>
              🔄 {t.reboundDay} {dayInfo.day} {t.reboundOf} {dayInfo.total}
            </span>
          )}
          {ready && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: 9, fontWeight: 800, color: "#34d399" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#34d399", animation: "azpulse 1.4s infinite", display: "inline-block" }} />
              {en ? "Good entry" : "دخول مناسب"}
            </span>
          )}
          {!ready && !isRebound && !isSniper && r.is_hot && <div style={{ fontSize: 9, color: "#fca5a5", marginTop: 2 }}>🚨 HOT</div>}
        </div>
        <div style={S.cardTags}>
          {timeInfo?.isNew && <span style={S.tag("rgba(0,212,170,0.15)", "#00d4aa", "rgba(0,212,170,0.3)")}>🆕</span>}
          {isSniper && <SniperBadge t={t} />}
          {isRebound && <ReboundBadge t={t} />}
          {isEarly && !isRebound && !isSniper && <EarlyBadge t={t} />}
          <span style={S.tag("rgba(255,107,53,0.15)", "#ff6b35", "rgba(255,107,53,0.2)")}>{r.signal}</span>
          {r.ma_signal && <MABadge signal={r.ma_signal} lang={lang} />}
          {r.rsi != null && <RSIBadge rsi={r.rsi} t={t} />}
          <span style={S.tag(typeTag.bg, typeTag.color, typeTag.border)}>{typeTag.label}</span>
          {r.is_target && <span style={S.tag("rgba(251,191,36,0.13)", "#fbbf24", "rgba(251,191,36,0.4)")}>🎯 الهدف</span>}
          {!isRebound && !isSniper && r.structure && typeof r.structure.flag === "string" && r.structure.flag.indexOf("صحيح") >= 0 && (
            <span style={S.tag("rgba(45,212,191,0.13)", "#2dd4bf", "rgba(45,212,191,0.4)")}>{azTr(r.structure.flag, lang)}</span>
          )}
          {r.rvol && r.rvol > 3 && <span style={S.tag("rgba(255,215,0,0.1)", "#ffd700", "rgba(255,215,0,0.2)")}>⚡ {r.rvol.toFixed(1)}x</span>}
          {!isRebound && !isSniper && r.is_hot && <span style={S.tag("rgba(248,113,113,0.15)", "#fca5a5", "rgba(248,113,113,0.3)")}>🚨 HOT</span>}
        </div>
        <div style={{ textAlign: "right", minWidth: 80 }}>
          {r.isFavSnapshot && r.favEntry ? (
            <>
              <div style={S.cardPrice}>{formatPrice(r.favEntry)}</div>
              <div style={{ ...S.cardChange(r.favPL >= 0), fontSize: 12, fontWeight: 700 }}>
                {r.favPL != null ? (r.favPL >= 0 ? "+" : "") + r.favPL.toFixed(1) + "%" : "—"}
              </div>
            </>
          ) : (
            <>
              <div style={S.cardPrice}>{formatPrice(r.price)}</div>
              <div style={S.cardChange(r.change_pct >= 0)}>{formatPct(r.change_pct)}</div>
            </>
          )}
          {timeInfo && (
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 3, direction: "ltr", textAlign: "right" }}>
              🕐 {timeInfo.clock} · {timeInfo.ago}
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", minWidth: 44 }}>
          <div style={S.cardScore(scoreColor)}>{r.score}</div>
          <ScoreBar score={r.score} />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav && onToggleFav(r); }}
          title={isFav ? t.removeFav : t.addFav}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 18, padding: "2px 4px", lineHeight: 1,
            color: isFav ? "#ffd700" : "rgba(255,255,255,0.25)",
            transition: "color 0.2s, transform 0.15s",
            filter: isFav ? "drop-shadow(0 0 6px rgba(255,215,0,0.5))" : "none",
          }}
        >{isFav ? "⭐" : "☆"}</button>
        <span style={S.chevron(open)}>▼</span>
      </div>
      {open && (
        <div style={S.detailWrap}>
          {isSniper && (
            <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 10, padding: "11px 14px", marginBottom: 14, fontSize: 11.5, color: "#fbbf24", lineHeight: 1.7 }}>
              <strong>🎯 {en ? "Sniper Opportunity" : "فرصة قناص"}:</strong> {t.sniperExplain}
              {r.sniper_desc && <span style={{ marginLeft: 8, fontSize: 10, color: "rgba(251,191,36,0.6)" }}>({r.sniper_desc})</span>}
            </div>
          )}
          {isRebound && (
            <div style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 10, padding: "11px 14px", marginBottom: 14, fontSize: 11.5, color: "#7dd3fc", lineHeight: 1.7 }}>
              {t.reboundExplain}
              {dayInfo && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(dayInfo.day / dayInfo.total) * 100}%`, background: "linear-gradient(90deg,#38bdf8,#0ea5e9)", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#38bdf8", fontFamily: "monospace" }}>{t.reboundDay} {dayInfo.day}/{dayInfo.total}</span>
                </div>
              )}
            </div>
          )}
          {r.isFavSnapshot && r.favEntry && (
            <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.25)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#ffd700", fontWeight: 700 }}>⭐ صفقتك المحفوظة</span>
                {r.favPL != null && (
                  <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", direction: "ltr",
                    color: r.favPL >= 0 ? "#00d4aa" : "#ff4757" }}>
                    {(r.favPL >= 0 ? "+" : "") + r.favPL.toFixed(1)}%
                  </span>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.6)", direction: "ltr" }}>
                <span>دخول: <strong style={{ color: "#60a5fa" }}>${(+r.favEntry).toFixed(2)}</strong></span>
                <span>الآن: <strong style={{ color: "#e8edf6" }}>${(+(r.livePrice ?? r.favEntry)).toFixed(2)}</strong></span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {r.favT1 && <span style={{ fontSize: 9.5, padding: "3px 8px", borderRadius: 7, background: r.livePrice >= r.favT1 ? "rgba(0,212,170,0.2)" : "rgba(255,255,255,0.05)", color: r.livePrice >= r.favT1 ? "#00d4aa" : "#94a3b8", direction: "ltr" }}>T1 ${(+r.favT1).toFixed(2)}{r.livePrice >= r.favT1 ? " ✓" : ""}</span>}
                {r.favT2 && <span style={{ fontSize: 9.5, padding: "3px 8px", borderRadius: 7, background: r.livePrice >= r.favT2 ? "rgba(0,212,170,0.2)" : "rgba(255,255,255,0.05)", color: r.livePrice >= r.favT2 ? "#00d4aa" : "#94a3b8", direction: "ltr" }}>T2 ${(+r.favT2).toFixed(2)}{r.livePrice >= r.favT2 ? " ✓" : ""}</span>}
                {r.favT3 && <span style={{ fontSize: 9.5, padding: "3px 8px", borderRadius: 7, background: r.livePrice >= r.favT3 ? "rgba(0,212,170,0.2)" : "rgba(255,255,255,0.05)", color: r.livePrice >= r.favT3 ? "#00d4aa" : "#94a3b8", direction: "ltr" }}>T3 ${(+r.favT3).toFixed(2)}{r.livePrice >= r.favT3 ? " ✓" : ""}</span>}
                {r.favSL && <span style={{ fontSize: 9.5, padding: "3px 8px", borderRadius: 7, background: r.livePrice <= r.favSL ? "rgba(255,71,87,0.2)" : "rgba(255,255,255,0.05)", color: r.livePrice <= r.favSL ? "#ff4757" : "#94a3b8", direction: "ltr" }}>وقف ${(+r.favSL).toFixed(2)}{r.livePrice <= r.favSL ? " ⚠" : ""}</span>}
              </div>
            </div>
          )}
          {isEarly && !isRebound && !isSniper && (
            <div style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: "#34d399", lineHeight: 1.6 }}>
              💡 {t.earlyTooltip}
            </div>
          )}
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
              <span style={{ fontSize: 22, fontWeight: 700, color: "#ff4757", fontFamily: "monospace" }}>{formatPrice((r.levels || {}).sl)}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, color: "#ff6b81", fontWeight: 600 }}>{fmtPct((r.levels || {}).slPct)}</div>
                <div style={{ fontSize: 9, color: "rgba(255,107,129,0.5)" }}>{t.risk}: {formatPrice((r.levels || {}).risk)}</div>
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

          <div style={{ marginTop: 14 }}>
            <button onClick={(e) => { e.stopPropagation(); setAiOpen((o) => !o); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(90deg,rgba(124,140,255,0.16),rgba(45,212,191,0.14))", border: "1px solid rgba(124,140,255,0.32)", borderRadius: 12, padding: 11, color: "#dbe2ff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {en ? "🤖 AI-Az Technical Analysis" : "🤖 تحليل فني AI-Az"}
              {isRebound && <span style={{ fontSize: 9, color: "#38bdf8" }}>({en ? "daily structure" : "بنية يومية"})</span>}
              <span style={{ marginInlineStart: "auto", fontSize: 11, color: "rgba(255,255,255,0.4)", transform: aiOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
            </button>
            {aiOpen && (
              <div style={{ marginTop: 11, background: "rgba(6,10,20,0.6)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}>{en ? "🗺️ Market Map — full details" : "🗺️ خريطة السوق — تفاصيل شاملة"}</div>
                <StructureMap r={r} lang={lang} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ title, subtitle, count, color, bg, border, children, t, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={S.sectionHeader(bg, border, color, open)} onClick={() => setOpen(o => !o)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(o => !o)}>
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

function StatusBanner({ status, lastUpdate, scanError, t }) {
  if (!status) return null;
  const configs = {
    error:     { bg: "rgba(255,71,87,0.1)",    border: "rgba(255,71,87,0.3)",   icon: "🔴", titleColor: "#ff4757", subColor: "rgba(255,71,87,0.7)",   title: t.bannerError,  sub: t.bannerErrorSub  },
    closed:    { bg: "rgba(255,215,0,0.08)",   border: "rgba(255,215,0,0.2)",   icon: "🟡", titleColor: "#ffd700", subColor: "rgba(255,215,0,0.7)",   title: t.bannerClosed, sub: t.bannerClosedSub },
    premarket: { bg: "rgba(100,200,255,0.08)", border: "rgba(100,200,255,0.2)", icon: "🔵", titleColor: "#64c8ff", subColor: "rgba(100,200,255,0.7)", title: t.bannerPre,    sub: t.bannerPreSub    },
    ok:        { bg: "rgba(0,212,170,0.08)",   border: "rgba(0,212,170,0.2)",   icon: "🟢", titleColor: "#00d4aa", subColor: "rgba(0,212,170,0.7)",  title: t.bannerOk,     sub: t.bannerOkSub     },
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
  const [key, setKey]         = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [expired, setExpired] = useState(false);

  const handleLogin = async () => {
    if (!key.trim()) return;
    setLoading(true); setError(null); setExpired(false);
    try {
      const res  = await fetch(`/api/verify-key?key=${key.trim()}`);
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem("radar_key",     key.trim());
        localStorage.setItem("radar_plan",    data.plan);
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
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32, lineHeight: 1.6 }}>{t.loginTitle}</div>
        {error   && <div style={S.loginError}>{error}</div>}
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

// 📊 حركة السوق (Top Movers) — 4 قوائم + بنية AI عند الضغط
function MarketMovers({ movers, t, lang }) {
  const en = lang === "en";
  const [tab, setTab] = useState("gainers");
  const [openSym, setOpenSym] = useState(null);
  const [structData, setStructData] = useState({});

  const tabs = [
    { id: "gainers", label: en ? "📈 Top Gainers" : "📈 أعلى ارتفاع", color: "#00d4aa" },
    { id: "losers",  label: en ? "📉 Top Losers"  : "📉 أعلى انخفاض", color: "#ff4757" },
    { id: "volume",  label: en ? "📊 Most Active"  : "📊 أعلى كمية",   color: "#fbbf24" },
    { id: "value",   label: en ? "💰 Top Value"    : "💰 أعلى قيمة",   color: "#818cf8" },
  ];
  const list = (movers && movers[tab]) || [];
  const activeColor = tabs.find(x => x.id === tab)?.color || "#6366f1";

  const fmtVol = (v) => v >= 1e9 ? (v/1e9).toFixed(1)+"B" : v >= 1e6 ? (v/1e6).toFixed(1)+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : String(v);

  const toggleStruct = async (sym) => {
    if (openSym === sym) { setOpenSym(null); return; }
    setOpenSym(sym);
    if (structData[sym]) return;
    setStructData(p => ({ ...p, [sym]: { loading: true } }));
    try {
      const res = await fetch(`/api/structure?symbol=${encodeURIComponent(sym)}`);
      const data = await res.json();
      setStructData(p => ({ ...p, [sym]: { loading: false, ...data } }));
    } catch {
      setStructData(p => ({ ...p, [sym]: { loading: false, structure: null } }));
    }
  };

  return (
    <div style={{ marginTop: 8, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {tabs.map(x => (
          <button key={x.id} onClick={() => { setTab(x.id); setOpenSym(null); }}
            style={{
              flex: 1, minWidth: 70, background: tab === x.id ? `${x.color}22` : "rgba(255,255,255,0.04)",
              border: `1px solid ${tab === x.id ? x.color + "88" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 10, padding: "9px 6px", color: tab === x.id ? x.color : "rgba(255,255,255,0.45)",
              fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit",
            }}>{x.label}</button>
        ))}
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
        {list.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            {en ? "No data yet — scan first" : "لا توجد بيانات — امسح أولاً"}
          </div>
        )}
        {list.map((m, i) => {
          const up = m.change_pct >= 0;
          const isOpen = openSym === m.symbol;
          const sd = structData[m.symbol];
          return (
            <div key={m.symbol} style={{ borderBottom: i < list.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div onClick={() => toggleStruct(m.symbol)} role="button" tabIndex={0}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", minWidth: 20, fontFamily: "monospace" }}>{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "monospace", minWidth: 56 }}>{m.symbol}</span>
                <span style={{ fontSize: 13, color: "#e8edf6", fontFamily: "monospace", flex: 1 }}>${m.price.toFixed(2)}</span>
                {(tab === "volume" || tab === "value") && (
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
                    {tab === "volume" ? fmtVol(m.volume) : "$" + fmtVol(m.dollar_vol)}
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: up ? "#00d4aa" : "#ff4757", fontFamily: "monospace", minWidth: 64, textAlign: "right", direction: "ltr" }}>
                  {up ? "+" : ""}{m.change_pct.toFixed(2)}%
                </span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
              </div>
              {isOpen && (
                <div style={{ padding: "4px 14px 14px", background: "rgba(6,10,20,0.5)" }}>
                  {sd?.loading && (
                    <div style={{ padding: "16px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                      ⟳ {en ? "Loading structure..." : "جاري تحليل البنية..."}
                    </div>
                  )}
                  {sd && !sd.loading && sd.structure && (
                    <div style={{ background: "rgba(6,10,20,0.6)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, display: "flex", alignItems: "center", gap: 7, color: "#dbe2ff" }}>
                        🤖 {en ? "AI-Az Structure" : "تحليل بنية AI-Az"}
                        {sd.ret3m != null && <span style={{ fontSize: 10, color: sd.ret3m >= 0 ? "#00d4aa" : "#ff4757" }}>({en ? "3M" : "3 شهور"} {sd.ret3m >= 0 ? "+" : ""}{sd.ret3m}%)</span>}
                      </div>
                      <StructureMap r={{ price: sd.price || m.price, structure: sd.structure }} lang={lang} />
                    </div>
                  )}
                  {sd && !sd.loading && !sd.structure && (
                    <div style={{ padding: "12px", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                      {en ? "Not enough data for structure analysis." : "لا تتوفر بيانات كافية لتحليل البنية."}
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

export default function Radar() {
  const [lang, setLang]               = useState("ar");
  const t = T[lang];
  const isRtl = lang === "ar";

  const [auth, setAuth]               = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [results, setResults]         = useState([]);
  const [leaders, setLeaders]         = useState([]);
  const [speculation, setSpeculation] = useState([]);
  const [rebound, setRebound]         = useState([]);
  const [sniper, setSniper]           = useState([]);
  const [movers, setMovers]           = useState(null);
  const [earlyWatch, setEarlyWatch]   = useState([]);
  const [favorites, setFavorites]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [total, setTotal]             = useState(0);
  const [done, setDone]               = useState(false);
  const [filter, setFilter]           = useState("all");
  const [status, setStatus]           = useState(null);
  const [lastUpdate, setLastUpdate]   = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [scanError, setScanError]     = useState(null);
  const [refreshing, setRefreshing]   = useState(false);

  const lastScanRef  = useRef(0);
  const autoTimerRef = useRef(null);
  const COOLDOWN_MS  = 10_000;

  useEffect(() => {
    const savedKey     = localStorage.getItem("radar_key");
    const savedExpires = localStorage.getItem("radar_expires");
    const savedPlan    = localStorage.getItem("radar_plan");
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
          typeof f === "string"
            ? { symbol: f, entry: null, t1: null, t2: null, t3: null, sl: null, type: null, addedAt: null }
            : f
        );
        setFavorites(migrated);
      }
    } catch { /* ignore */ }
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
      try { localStorage.setItem("radar_favorites", JSON.stringify(next)); } catch { /* ignore */ }
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
      const raw  = (data.results ?? []).filter(s => (s.score || 0) >= MIN);
      const isReb = s => s.type === "ارتداد" || s.is_rebound;
      const isSniper = s => s.is_sniper || false;
      
      const reb  = raw.filter(isReb);
      const sniperRaw = raw.filter(isSniper);
      const regular = raw.filter(s => !isReb(s) && !isSniper(s));
      
      const lead = (data.leaders ?? regular.filter(s => s.type === "استثمار")).filter(s => (s.score || 0) >= MIN);
      const spec = (data.speculation ?? regular.filter(s => s.type !== "استثمار")).filter(s => (s.score || 0) >= MIN);
      const early = (data.earlyWatch ?? raw.filter(s => s.early_watch)).filter(s => (s.score || 0) >= MIN);

      const toCard = s => ({
        symbol:     s.symbol,
        price:      s.price || 0,
        change_pct: s.change_pct || 0,
        score:      s.score || 0,
        signal:     s.signal || ((s.score||0) >= 80 ? "💥 انفجاري" : "🔥 عالي"),
        type:       s.type || "مضاربة",
        volume:     s.volume || 0,
        rvol:       s.rvol || null,
        marketCap:  s.marketCap || null,
        ema9:       s.ema9  || null,
        ema20:      s.ema20 || null,
        vwap:       s.vwap  || null,
        is_hot:     s.is_hot || false,
        is_rebound: s.is_rebound || s.type === "ارتداد" || false,
        is_sniper:  s.is_sniper || false,
        sniper_type: s.sniper_type || null,
        sniper_desc: s.sniper_desc || null,
        ret3m:      s.ret3m ?? s._ret3m ?? null,
        ma_signal:  s.ma_signal || null,
        atr14:      s.atr14 || null,
        rsi:        s.rsi ?? null,
        early_watch: s.early_watch || false,
        week_max_jump: s.week_max_jump ?? null,
        created_at: s.created_at || null,
        levels: s.levels || {
          t1: 0, t1Pct: 0, t2: 0, t2Pct: 0,
          t3: 0, t3Pct: 0, sl: 0, slPct: 0, risk: 0,
        },
        structure:  s.structure || null,
        is_target:  s.is_target || false,
        news_age_h: s.news_age_h ?? null,
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
      const isPreMarket  = !isWeekend && h >= 4 && (h < 9 || (h === 9 && m < 30));
      if      (isMarketOpen)                        setStatus(allCards.length > 0 ? "ok" : "closed");
      else if (isPreMarket)                         setStatus("premarket");
      else                                          setStatus("closed");
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
        symbol:     s.symbol,
        price:      s.entry_price || 0,
        change_pct: s.change_pct || 0,
        score:      s.score || s.ep || 0,
        signal:     (s.score || 0) >= 80 ? "💥 انفجاري" : "🔥 عالي",
        type:       s.type || "مضاربة",
        volume:     s.volume || 0,
        rvol:       s.rvol || null,
        marketCap:  null, ema9: null, ema20: null, vwap: null, week_max_jump: null,
        is_hot:     s.is_hot || false,
        is_rebound: s.is_rebound || s.type === "ارتداد" || false,
        is_sniper:  s.is_sniper || false,
        sniper_type: s.sniper_type || null,
        sniper_desc: s.sniper_desc || null,
        ret3m:      s.ret3m ?? null,
        ma_signal:  s.ma_signal || null,
        atr14:      s.atr14 || null,
        rsi:        s.rsi ?? null,
        early_watch: s.early_watch || false,
        created_at: s.created_at || null,
        levels: {
          t1: s.target1 || 0, t1Pct: s.entry_price ? (s.target1 - s.entry_price) / s.entry_price * 100 : 0,
          t2: s.target2 || 0, t2Pct: s.entry_price ? (s.target2 - s.entry_price) / s.entry_price * 100 : 0,
          t3: s.target3 || 0, t3Pct: s.entry_price ? (s.target3 - s.entry_price) / s.entry_price * 100 : 0,
          sl: s.stop_loss || 0, slPct: s.entry_price ? (s.stop_loss - s.entry_price) / s.entry_price * 100 : 0,
          risk: 0,
        },
        structure:  s.structure || null,
        is_target:  s.is_target || false,
        news_age_h: s.news_age_h ?? null,
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
    } catch { /* تجاهل */ }
  }, []);

  useEffect(() => {
    if (!auth) return;
    loadCached().finally(() => scan({ background: true }));
  }, [auth]);

  useEffect(() => {
    if (autoRefresh) { autoTimerRef.current = setInterval(() => scan({ background: true }), 60_000); }
    else             { clearInterval(autoTimerRef.current); }
    return () => clearInterval(autoTimerRef.current);
  }, [autoRefresh, scan]);

  const filtered = useMemo(() => {
    if (filter === "favorites") {
      return favorites.map((fav) => {
        const live = results.find((r) => r.symbol === fav.symbol);
        const currentPrice = live?.price ?? fav.entry ?? 0;
        const pl = (fav.entry && currentPrice) ? ((currentPrice - fav.entry) / fav.entry) * 100 : null;
        const safeLevels = live?.levels || {
          t1: fav.t1 ?? 0, t1Pct: 0, t2: fav.t2 ?? 0, t2Pct: 0,
          t3: fav.t3 ?? 0, t3Pct: 0, sl: fav.sl ?? 0, slPct: 0, risk: 0,
        };
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
          sniper_type: live?.sniper_type || fav.sniper_type || null,
        };
      });
    }
    if (filter === "sniper")      return sniper;
    if (filter === "rebound")     return rebound;
    if (filter === "early")       return earlyWatch;
    if (filter === "leaders")     return leaders;
    if (filter === "speculation") return speculation;
    if (filter === "explosive")   return results.filter((r) => r.score >= 80);
    if (filter === "high")        return results.filter((r) => r.score >= 60 && r.score < 80);
    if (filter === "hot")         return results.filter((r) => r.is_hot);
    return results;
  }, [results, leaders, speculation, rebound, earlyWatch, sniper, favorites, filter]);

  const favSet      = useMemo(() => new Set(favorites.map((f) => f.symbol)), [favorites]);
  const favCount    = useMemo(() => favorites.length, [favorites]);

  const explosive   = useMemo(() => results.filter((r) => r.score >= 80).length, [results]);
  const hotCount    = useMemo(() => results.filter((r) => r.is_hot).length,      [results]);
  const earlyCount  = useMemo(() => earlyWatch.length, [earlyWatch]);
  const reboundCount = useMemo(() => rebound.length, [rebound]);
  const sniperCount  = useMemo(() => sniper.length, [sniper]);
  const dotColor    = (loading || refreshing) ? "#ffd700" : status === "ok" ? "#00d4aa" : status === "error" ? "#ff4757" : "#6366f1";
  const showSections = filter === "all" && (leaders.length > 0 || speculation.length > 0 || rebound.length > 0 || sniper.length > 0);
  const earlySymbols = useMemo(() => new Set(earlyWatch.map(s => s.symbol)), [earlyWatch]);

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
            { label: t.scanRange,    value: total || "—",  color: "#6366f1", bg: "rgba(99,102,241,0.1)",  border: "rgba(99,102,241,0.2)"  },
            { label: t.filterSniper, value: sniperCount,    color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)" },
            { label: t.filterRebound, value: reboundCount, color: "#38bdf8", bg: "rgba(56,189,248,0.1)",  border: "rgba(56,189,248,0.25)" },
            { label: "🚨 HOT",       value: hotCount,       color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)" },
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
                { id: "all",         label: t.filterAll     },
                ...(favorites.length > 0 ? [{ id: "favorites", label: `${t.favorites} (${favCount})` }] : []),
                ...(sniperCount > 0 ? [{ id: "sniper", label: t.filterSniper }] : []),
                ...(reboundCount > 0 ? [{ id: "rebound", label: t.filterRebound }] : []),
                ...(earlyCount > 0 ? [{ id: "early", label: t.earlyBadge }] : []),
                { id: "leaders",     label: t.filterLeaders },
                { id: "speculation", label: t.filterSpec    },
                { id: "hot",         label: "🚨 HOT"        },
                { id: "explosive",   label: "💥"            },
                { id: "high",        label: "🔥"            },
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
          <CollapsibleSection title={t.marketMovers} subtitle={t.marketMoversSub} count={60} color="#22d3ee" bg="rgba(34,211,238,0.08)" border="rgba(34,211,238,0.3)" t={t} defaultOpen={false}>
            <MarketMovers movers={movers} t={t} lang={lang} />
          </CollapsibleSection>
        )}

        {/* 🎯 قسم القناص — يظهر في الأعلى */}
        {!loading && done && filter === "all" && sniper.length > 0 && (
          <CollapsibleSection title={t.sectionSniper} subtitle={t.sectionSniperSub} count={sniper.length} color="#fbbf24" bg="rgba(251,191,36,0.08)" border="rgba(251,191,36,0.3)" t={t}>
            {sniper.map((r, i) => <Card key={"sniper-" + r.symbol} r={r} idx={i} t={t} lang={lang} isEarly={false} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
          </CollapsibleSection>
        )}

        {/* 🔄 قسم ارتداد الأسهم القوية */}
        {!loading && done && filter === "all" && rebound.length > 0 && (
          <CollapsibleSection title={t.sectionRebound} subtitle={t.sectionReboundSub} count={rebound.length} color="#38bdf8" bg="rgba(56,189,248,0.08)" border="rgba(56,189,248,0.3)" t={t}>
            {rebound.map((r, i) => <Card key={"reb-" + r.symbol} r={r} idx={i} t={t} lang={lang} isEarly={false} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
          </CollapsibleSection>
        )}

        {/* 🔍 قسم الرصد المبكر */}
        {!loading && done && filter === "all" && earlyWatch.length > 0 && (
          <CollapsibleSection title={t.sectionEarly} subtitle={t.sectionEarlySub} count={earlyWatch.length} color="#34d399" bg="rgba(52,211,153,0.08)" border="rgba(52,211,153,0.3)" t={t}>
            {earlyWatch.map((r, i) => <Card key={"early-" + r.symbol} r={r} idx={i} t={t} lang={lang} isEarly={true} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
          </CollapsibleSection>
        )}

        {!loading && done && showSections && (
          <>
            {leaders.length > 0 && (
              <CollapsibleSection title={t.sectionLeaders} count={leaders.length} color="#818cf8" bg="rgba(129,140,248,0.08)" border="rgba(129,140,248,0.2)" t={t}>
                {leaders.map((r, i) => <Card key={r.symbol} r={r} idx={i} t={t} lang={lang} isEarly={earlySymbols.has(r.symbol)} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
              </CollapsibleSection>
            )}
            {speculation.length > 0 && (
              <CollapsibleSection title={t.sectionSpec} count={speculation.length} color="#fbbf24" bg="rgba(251,191,36,0.08)" border="rgba(251,191,36,0.2)" t={t}>
                {speculation.map((r, i) => <Card key={r.symbol} r={r} idx={i} t={t} lang={lang} isEarly={earlySymbols.has(r.symbol)} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
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
            {filtered.map((r, i) => <Card key={r.symbol} r={r} idx={i} t={t} lang={lang} isEarly={filter === "early" || earlySymbols.has(r.symbol)} isFav={favSet.has(r.symbol)} onToggleFav={toggleFav} />)}
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
        @keyframes earlyglow { 0%,100% { box-shadow: 0 0 0 rgba(52,211,153,0); } 50% { box-shadow: 0 0 12px rgba(52,211,153,0.4); } }
      `}</style>
    </div>
  );
}
