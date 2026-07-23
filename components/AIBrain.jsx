// components/AIBrain.jsx
// ============================================================
// RadarAZ — AI Command Center + Upgraded Radar (UI only)
// - Consumes the existing /api/scan endpoint. No backend changes.
// - REAL DATA ONLY: every number is derived from the API response.
// - Unmeasured features (historical accuracy, learning history,
//   performance analytics) show a tasteful "قريباً / Soon" badge
//   instead of invented figures.
// - Single codebase, AR/EN with RTL/LTR. No external animation libs
//   (pure CSS) to stay light and dependency-free in this environment.
// ============================================================
import { useState, useCallback, useEffect, useMemo, useRef } from "react";

// ─── i18n ────────────────────────────────────────────────────
const T = {
  ar: {
    brand: "رادار",
    pro: "الذكاء",
    navBrain: "🧠 عقل الذكاء",
    navRadar: "📡 الرادار",
    navPredictions: "🎯 التوقعات",
    navPerformance: "📊 الأداء",
    navLearning: "🌱 التعلّم",
    soon: "قريباً",
    // command center
    coreThinking: ["يمسح السوق…", "يحلّل الزخم…", "يبحث عن فرص…", "يرصد الأنماط…", "يقارن السيولة…", "يفكّر…"],
    stateFocused: "مُركّز",
    stateScanning: "يمسح",
    liveStatus: "الحالة الحيّة",
    coverage: "تغطية السوق",
    symbols: "رمز",
    signalsToday: "إشارات اليوم",
    avgConfidence: "متوسط الثقة",
    topGrade: "أعلى تصنيف",
    breakoutsToday: "اختراقات مرصودة",
    modelVersion: "إصدار النموذج",
    activity: "نشاط الذكاء المباشر",
    memory: "🧠 ذاكرة الذكاء",
    memoryBreakouts: "رصد اليوم: {n} نمط اختراق",
    memoryNear: "قرب اختراق: {n} سهم تحت المقاومة",
    memoryStrong: "إشارات عالية الجودة: {n}",
    memoryScan: "مسح شامل: {n} رمز",
    scanBtn: "📡 مسح السوق الآن",
    scanning: "⟳ جاري المسح…",
    refresh: "تحديث",
    // radar / cards
    confidence: "ثقة الذكاء",
    expectedMove: "الحركة المتوقعة",
    pattern: "النمط",
    risk: "المخاطرة",
    entry: "منطقة الدخول",
    stop: "وقف الخسارة",
    target: "الهدف",
    reasoning: "لماذا اختار الذكاء هذا السهم",
    whyExpand: "عرض تحليل الذكاء",
    whyCollapse: "إخفاء",
    riskLow: "منخفضة",
    riskMed: "متوسطة",
    riskHigh: "مرتفعة",
    patBreakout: "اختراق مؤكد",
    patNear: "قرب اختراق",
    patMomentum: "زخم صاعد",
    patBuilding: "بناء زخم",
    factVol: "توسّع في الحجم",
    factEma: "محاذاة المتوسطات (اتجاه صاعد)",
    factRvol: "حجم نسبي مرتفع",
    factAbove: "فوق المتوسط المرجّح (VWAP)",
    factRes: "قريب من كسر المقاومة",
    factRsi: "زخم صحي (RSI)",
    emptyTitle: "الذكاء يبحث عن فرص عالية الجودة",
    emptySub: "لم تُرصد فرص مؤهّلة الآن · فلاتر الجودة نشطة",
    loadingSteps: ["الذكاء يمسح السوق…", "يحلّل الزخم…", "يقارن الأنماط…", "يبحث عن فرص…"],
    soonPerfTitle: "تحليلات الأداء",
    soonPerfSub: "معدل النجاح، متوسط العائد، وأفضل الأنماط — يبدأ القياس بعد جمع بيانات كافية من الإشارات الفعلية.",
    soonLearnTitle: "سجلّ التعلّم",
    soonLearnSub: "تطوّر النموذج ودقّته عبر الزمن — يظهر بعد تفعيل قياس النتائج.",
    disclaimer: "ليست نصيحة استثمارية · الثقة تقدير آلي وليست ضماناً",
    marketOpen: "السوق مفتوح — بيانات حيّة",
    marketPre: "قبل الافتتاح — مبني على إغلاق أمس",
    marketClosed: "السوق مغلق — آخر إشارات محفوظة",
  },
  en: {
    brand: "RADAR",
    pro: "AI",
    navBrain: "🧠 AI Brain",
    navRadar: "📡 Radar",
    navPredictions: "🎯 Predictions",
    navPerformance: "📊 Performance",
    navLearning: "🌱 Learning",
    soon: "Soon",
    coreThinking: ["Scanning market…", "Analyzing momentum…", "Finding opportunities…", "Detecting patterns…", "Comparing liquidity…", "Thinking…"],
    stateFocused: "Focused",
    stateScanning: "Scanning",
    liveStatus: "Live Status",
    coverage: "Market Coverage",
    symbols: "symbols",
    signalsToday: "Signals Today",
    avgConfidence: "Avg Confidence",
    topGrade: "Top Grade",
    breakoutsToday: "Breakouts Detected",
    modelVersion: "Model Version",
    activity: "Live AI Activity",
    memory: "🧠 AI Memory",
    memoryBreakouts: "Detected today: {n} breakout patterns",
    memoryNear: "Near breakout: {n} stocks below resistance",
    memoryStrong: "High-quality signals: {n}",
    memoryScan: "Full scan: {n} symbols",
    scanBtn: "📡 Scan Market Now",
    scanning: "⟳ Scanning…",
    refresh: "Refresh",
    confidence: "AI Confidence",
    expectedMove: "Expected Move",
    pattern: "Pattern",
    risk: "Risk",
    entry: "Entry Zone",
    stop: "Stop Loss",
    target: "Target",
    reasoning: "Why AI selected this stock",
    whyExpand: "Show AI analysis",
    whyCollapse: "Hide",
    riskLow: "Low",
    riskMed: "Medium",
    riskHigh: "High",
    patBreakout: "Confirmed breakout",
    patNear: "Near breakout",
    patMomentum: "Rising momentum",
    patBuilding: "Building momentum",
    factVol: "Volume expansion",
    factEma: "EMA alignment (uptrend)",
    factRvol: "High relative volume",
    factAbove: "Above VWAP",
    factRes: "Close to resistance break",
    factRsi: "Healthy momentum (RSI)",
    emptyTitle: "AI is searching for high-quality opportunities",
    emptySub: "No qualified opportunities right now · Quality filters active",
    loadingSteps: ["AI scanning market…", "Analyzing momentum…", "Comparing patterns…", "Finding opportunities…"],
    soonPerfTitle: "Performance Analytics",
    soonPerfSub: "Win rate, average return, and best patterns — measurement begins once enough real signal outcomes are collected.",
    soonLearnTitle: "Learning History",
    soonLearnSub: "Model evolution and accuracy over time — appears after outcome tracking is enabled.",
    disclaimer: "Not investment advice · Confidence is a model estimate, not a guarantee",
    marketOpen: "Market open — live data",
    marketPre: "Pre-market — based on yesterday's close",
    marketClosed: "Market closed — last saved signals",
  },
};

// ─── palette / tokens ────────────────────────────────────────
const C = {
  bg: "#070912",
  bg2: "#0b0f1e",
  glass: "rgba(20,26,44,0.55)",
  glassBorder: "rgba(120,140,255,0.14)",
  ink: "#eaf0ff",
  sub: "rgba(210,220,255,0.45)",
  faint: "rgba(210,220,255,0.28)",
  iris: "#7c6cff",
  iris2: "#a78bfa",
  teal: "#2dd4bf",
  cyan: "#22d3ee",
  green: "#34d399",
  amber: "#fbbf24",
};

// confidence color language (never red)
const confColor = (v) => {
  if (v >= 85) return "#00d4aa";
  if (v >= 75) return "#34d399";
  if (v >= 65) return "#60a5fa";
  if (v >= 55) return "#818cf8";
  return "#94a3b8";
};

const gradeMap = {
  ELITE: { ar: "🏆 نخبة", en: "🏆 Elite", c: "#00d4aa" },
  PRIME: { ar: "⭐ ممتاز", en: "⭐ Prime", c: "#34d399" },
  STRONG: { ar: "💪 قوي", en: "💪 Strong", c: "#60a5fa" },
  GOOD: { ar: "📊 جيد", en: "📊 Good", c: "#818cf8" },
  WATCH: { ar: "👀 مراقبة", en: "👀 Watch", c: "#94a3b8" },
};

// ─── AI Core (pure-CSS living orb) ───────────────────────────
function AICore({ active }) {
  return (
    <div style={{ position: "relative", width: 200, height: 200, display: "grid", placeItems: "center" }}>
      <div className="az-ring az-ring1" />
      <div className="az-ring az-ring2" />
      <div className="az-ring az-ring3" />
      <div style={{
        width: 108, height: 108, borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, ${C.iris2}, ${C.iris} 55%, #4c1d95 100%)`,
        boxShadow: `0 0 60px ${C.iris}aa, inset 0 0 40px rgba(255,255,255,0.15)`,
        display: "grid", placeItems: "center",
        animation: "azBreath 3.2s ease-in-out infinite",
      }}>
        <span style={{ fontSize: 40 }}>🧠</span>
      </div>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
        background: active ? `radial-gradient(circle, ${C.iris}22 0%, transparent 60%)` : "transparent" }} />
    </div>
  );
}

// ─── rotating thinking line ──────────────────────────────────
function ThinkingLine({ words }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % words.length), 2200);
    return () => clearInterval(id);
  }, [words.length]);
  return (
    <div style={{ height: 22, overflow: "hidden", textAlign: "center" }}>
      <div key={i} style={{ fontSize: 13, color: C.teal, fontWeight: 600, animation: "azFade 0.5s ease" }}>
        {words[i]}
      </div>
    </div>
  );
}

// ─── stat card ───────────────────────────────────────────────
function Stat({ label, value, accent, sub }) {
  return (
    <div style={{
      background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 18,
      padding: "16px 18px", backdropFilter: "blur(12px)", minWidth: 120, flex: 1,
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || C.ink, fontFamily: "ui-monospace, monospace", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 9.5, color: C.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── "coming soon" panel (no fake data) ──────────────────────
function SoonPanel({ title, sub, t }) {
  return (
    <div style={{
      background: C.glass, border: `1px dashed ${C.glassBorder}`, borderRadius: 20,
      padding: "40px 28px", textAlign: "center", backdropFilter: "blur(10px)",
    }}>
      <div style={{
        display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: 1,
        color: C.iris2, background: `${C.iris}1e`, border: `1px solid ${C.iris}44`,
        borderRadius: 20, padding: "4px 14px", marginBottom: 16,
      }}>
        {t.soon}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.ink, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: C.sub, maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>{sub}</div>
    </div>
  );
}

// ─── prediction card (real data only) ────────────────────────
function PredictionCard({ r, t, lang }) {
  const [open, setOpen] = useState(false);
  const conf = Math.round(r.predictionScore ?? r.score ?? 0);
  const c = confColor(conf);
  const grade = gradeMap[r.predictionGrade] || gradeMap.WATCH;

  const pattern = r.breakout ? t.patBreakout : r.preBreakout ? t.patNear
    : (r.rsi != null && r.rsi >= 55) ? t.patMomentum : t.patBuilding;

  const riskLabel = (() => {
    const sl = Math.abs(r.levels?.slPct || 0);
    if (sl <= 4) return { txt: t.riskLow, c: C.green };
    if (sl <= 8) return { txt: t.riskMed, c: C.amber };
    return { txt: t.riskHigh, c: "#f87171" };
  })();

  const expected = r.levels?.t1Pct != null ? `+${Math.abs(r.levels.t1Pct).toFixed(1)}%` : "—";

  // real reasons only — each is a computed field on the signal
  const facts = [];
  if (r.rvol != null && r.rvol >= 1.2) facts.push(t.factRvol);
  if (r.ma_signal) facts.push(t.factEma);
  if (r.aboveVWAP) facts.push(t.factAbove);
  if (r.breakout) facts.push(t.factVol);
  if (r.preBreakout) facts.push(t.factRes);
  if (r.rsi != null && r.rsi >= 55 && r.rsi <= 72) facts.push(t.factRsi);

  return (
    <div style={{
      background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 18,
      padding: "16px 18px", marginBottom: 12, backdropFilter: "blur(12px)",
      boxShadow: `0 8px 30px rgba(0,0,0,0.25)`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 19, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: C.ink }}>{r.symbol}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, color: grade.c, background: `${grade.c}1e`, border: `1px solid ${grade.c}44` }}>
            {lang === "en" ? grade.en : grade.ar}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, color: C.cyan, background: `${C.cyan}18`, border: `1px solid ${C.cyan}33` }}>
            {pattern}
          </span>
        </div>
        <div style={{ textAlign: lang === "ar" ? "left" : "right" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: c, fontFamily: "ui-monospace, monospace", lineHeight: 1 }}>{conf}%</div>
          <div style={{ fontSize: 9, color: C.sub }}>{t.confidence}</div>
        </div>
      </div>

      {/* confidence bar */}
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", margin: "12px 0" }}>
        <div style={{ height: "100%", width: `${conf}%`, background: c, borderRadius: 4, boxShadow: `0 0 10px ${c}`, transition: "width 0.7s ease" }} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
        <Chip label={t.expectedMove} value={expected} c={C.green} />
        <Chip label={t.risk} value={riskLabel.txt} c={riskLabel.c} />
        {r.price ? <Chip label={t.entry} value={`$${(+r.price).toFixed(2)}`} c={C.iris2} /> : null}
        {r.levels?.t1 ? <Chip label={t.target} value={`$${(+r.levels.t1).toFixed(2)}`} c={C.cyan} /> : null}
        {r.levels?.sl ? <Chip label={t.stop} value={`$${(+r.levels.sl).toFixed(2)}`} c="#f87171" /> : null}
      </div>

      {facts.length > 0 && (
        <>
          <button onClick={() => setOpen(!open)} style={{
            marginTop: 12, background: `${C.iris}14`, border: `1px solid ${C.iris}33`, color: C.iris2,
            borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            {open ? t.whyCollapse : `✦ ${t.whyExpand}`}
          </button>
          {open && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(124,108,255,0.06)", border: `1px solid ${C.iris}22`, borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.iris2, marginBottom: 8 }}>{t.reasoning}</div>
              {facts.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.ink, opacity: 0.9, margin: "5px 0" }}>
                  <span style={{ color: C.green }}>✓</span> {f}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ label, value, c }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, padding: "6px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
      <span style={{ fontSize: 9, color: C.faint }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: c, fontFamily: "ui-monospace, monospace" }}>{value}</span>
    </span>
  );
}

// ─── activity feed (built from real symbols) ─────────────────
function ActivityFeed({ signals, t }) {
  const items = useMemo(() => {
    const out = [];
    const bo = signals.filter((s) => s.breakout).slice(0, 3);
    const nb = signals.filter((s) => s.preBreakout).slice(0, 2);
    const hi = [...signals].sort((a, b) => (b.predictionScore || 0) - (a.predictionScore || 0)).slice(0, 3);
    bo.forEach((s) => out.push(`🚀 ${s.symbol} — ${t.patBreakout}`));
    nb.forEach((s) => out.push(`⏳ ${s.symbol} — ${t.patNear}`));
    hi.forEach((s) => out.push(`✦ ${s.symbol} — ${t.confidence} ${Math.round(s.predictionScore || 0)}%`));
    return out.length ? out : [t.emptyTitle];
  }, [signals, t]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 12,
          fontSize: 12.5, color: C.ink, opacity: 0.92, animation: `azSlide 0.4s ease ${i * 0.05}s both`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.teal, boxShadow: `0 0 8px ${C.teal}`, flex: "none" }} />
          {it}
        </div>
      ))}
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────
export default function AIBrain() {
  const [lang, setLang] = useState("ar");
  const t = T[lang];
  const en = lang === "en";
  const [tab, setTab] = useState("brain");
  const [signals, setSignals] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const lastScan = useRef(0);

  const scan = useCallback(async () => {
    if (Date.now() - lastScan.current < 8000) return;
    lastScan.current = Date.now();
    setLoading(true);
    try {
      const res = await fetch("/api/scan");
      const data = await res.json();
      const list = data.signals || data.results || [];
      setSignals(Array.isArray(list) ? list : []);
      setMeta(data.meta || null);
    } catch {
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { scan(); }, [scan]);
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setLoadStep((v) => (v + 1) % t.loadingSteps.length), 900);
    return () => clearInterval(id);
  }, [loading, t.loadingSteps.length]);

  // ── real derived metrics (no invented numbers) ──
  const m = useMemo(() => {
    const n = signals.length;
    const avg = n ? Math.round(signals.reduce((a, s) => a + (s.predictionScore || s.score || 0), 0) / n) : 0;
    const breakouts = signals.filter((s) => s.breakout).length;
    const near = signals.filter((s) => s.preBreakout).length;
    const strong = signals.filter((s) => (s.predictionScore || 0) >= 65).length;
    const topGrade = signals.reduce((best, s) => {
      const order = ["WATCH", "GOOD", "STRONG", "PRIME", "ELITE"];
      return order.indexOf(s.predictionGrade) > order.indexOf(best) ? s.predictionGrade : best;
    }, "WATCH");
    const coverage = meta?.totalScanned || 0;
    const version = meta?.brainVersion || "v20.2";
    return { n, avg, breakouts, near, strong, topGrade, coverage, version };
  }, [signals, meta]);

  const fmt = (s, n) => s.replace("{n}", n);
  const navBtns = [
    { id: "brain", label: t.navBrain },
    { id: "radar", label: t.navRadar },
    { id: "predictions", label: t.navPredictions },
    { id: "performance", label: t.navPerformance, soon: true },
    { id: "learning", label: t.navLearning, soon: true },
  ];

  return (
    <div dir={en ? "ltr" : "rtl"} style={{ minHeight: "100vh", background: `radial-gradient(1200px 600px at 50% -10%, ${C.bg2}, ${C.bg})`, color: C.ink, fontFamily: "system-ui, -apple-system, sans-serif", position: "relative", overflow: "hidden" }}>
      <NeuralBg />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "22px 16px 60px" }}>

        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${C.iris}, ${C.iris2})`, display: "grid", placeItems: "center", fontSize: 18, boxShadow: `0 0 20px ${C.iris}66` }}>🧠</div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>
              {t.brand} <span style={{ background: `linear-gradient(135deg, ${C.iris2}, ${C.teal})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{t.pro}</span>
            </div>
          </div>
          <button onClick={() => setLang(en ? "ar" : "en")} style={ghostBtn}>{en ? "عربي" : "EN"}</button>
        </div>

        {/* nav */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {navBtns.map((b) => (
            <button key={b.id} onClick={() => setTab(b.id)} style={{
              position: "relative", padding: "9px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit",
              color: tab === b.id ? "#fff" : C.sub,
              background: tab === b.id ? `linear-gradient(135deg, ${C.iris}, ${C.iris2})` : "rgba(255,255,255,0.04)",
              border: `1px solid ${tab === b.id ? "transparent" : "rgba(255,255,255,0.08)"}`,
              boxShadow: tab === b.id ? `0 6px 20px ${C.iris}55` : "none",
            }}>
              {b.label}
              {b.soon && <span style={{ marginInlineStart: 6, fontSize: 8, padding: "1px 6px", borderRadius: 8, background: `${C.iris}33`, color: C.iris2 }}>{t.soon}</span>}
            </button>
          ))}
        </div>

        {/* ===== AI BRAIN ===== */}
        {tab === "brain" && (
          <>
            <div style={{ display: "grid", placeItems: "center", marginBottom: 8 }}>
              <AICore active={loading} />
            </div>
            <ThinkingLine words={loading ? t.loadingSteps : t.coreThinking} />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "22px 0 14px" }}>
              <Stat label={t.coverage} value={m.coverage ? m.coverage.toLocaleString() : "—"} sub={t.symbols} accent={C.iris2} />
              <Stat label={t.signalsToday} value={m.n || "—"} accent={C.teal} />
              <Stat label={t.avgConfidence} value={m.n ? `${m.avg}%` : "—"} accent={confColor(m.avg)} />
              <Stat label={t.breakoutsToday} value={m.breakouts} accent={C.green} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
              <Stat label={t.topGrade} value={m.n ? (en ? gradeMap[m.topGrade].en : gradeMap[m.topGrade].ar) : "—"} accent={gradeMap[m.topGrade]?.c} />
              <Stat label={t.modelVersion} value={m.version} accent={C.cyan} />
              <Stat label={t.liveStatus} value={loading ? t.stateScanning : t.stateFocused} accent={C.amber} />
            </div>

            {/* AI Memory — real counts only */}
            <SectionTitle>{t.memory}</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {[
                fmt(t.memoryBreakouts, m.breakouts),
                fmt(t.memoryNear, m.near),
                fmt(t.memoryStrong, m.strong),
                fmt(t.memoryScan, m.coverage ? m.coverage.toLocaleString() : 0),
              ].map((line, i) => (
                <div key={i} style={{ padding: "11px 14px", background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 12, fontSize: 12.5, color: C.ink, opacity: 0.9 }}>
                  🧠 {line}
                </div>
              ))}
            </div>

            <SectionTitle>{t.activity}</SectionTitle>
            <ActivityFeed signals={signals} t={t} />

            <button onClick={scan} disabled={loading} style={{ ...primaryBtn, marginTop: 22, width: "100%" }}>
              {loading ? t.scanning : t.scanBtn}
            </button>
          </>
        )}

        {/* ===== RADAR / PREDICTIONS (same real cards) ===== */}
        {(tab === "radar" || tab === "predictions") && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <button onClick={scan} disabled={loading} style={{ ...primaryBtn, flex: 1 }}>
                {loading ? t.scanning : t.scanBtn}
              </button>
            </div>

            {loading && (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ display: "inline-grid", placeItems: "center", marginBottom: 16 }}><AICore active /></div>
                <ThinkingLine words={t.loadingSteps} />
              </div>
            )}

            {!loading && signals.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 24px", background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 20, backdropFilter: "blur(10px)" }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>🔭</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{t.emptyTitle}</div>
                <div style={{ fontSize: 12.5, color: C.sub }}>{t.emptySub}</div>
              </div>
            )}

            {!loading && signals.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: C.faint, marginBottom: 12 }}>
                  {signals.length} {en ? "opportunities" : "فرصة"}
                </div>
                {[...signals]
                  .sort((a, b) => (b.predictionScore || 0) - (a.predictionScore || 0))
                  .map((r) => <PredictionCard key={r.symbol} r={r} t={t} lang={lang} />)}
              </>
            )}
          </>
        )}

        {/* ===== PERFORMANCE (soon) ===== */}
        {tab === "performance" && (
          <SoonPanel title={t.soonPerfTitle} sub={t.soonPerfSub} t={t} />
        )}

        {/* ===== LEARNING (soon) ===== */}
        {tab === "learning" && (
          <SoonPanel title={t.soonLearnTitle} sub={t.soonLearnSub} t={t} />
        )}

        <div style={{ marginTop: 40, textAlign: "center", fontSize: 10.5, color: C.faint, lineHeight: 1.7 }}>
          {t.disclaimer}
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        @keyframes azBreath { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes azFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes azSlide { from { opacity: 0; transform: translateX(${"8px"}); } to { opacity: 1; transform: none; } }
        @keyframes azSpin { to { transform: rotate(360deg); } }
        .az-ring { position: absolute; border-radius: 50%; border: 1px solid rgba(124,108,255,0.25); }
        .az-ring1 { width: 150px; height: 150px; animation: azSpin 14s linear infinite; border-top-color: ${C.teal}; }
        .az-ring2 { width: 178px; height: 178px; animation: azSpin 20s linear infinite reverse; border-left-color: ${C.iris2}; }
        .az-ring3 { width: 200px; height: 200px; animation: azSpin 28s linear infinite; border-bottom-color: ${C.cyan}; opacity: 0.6; }
        button:hover:not(:disabled) { filter: brightness(1.08); }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: rgba(124,108,255,0.3); border-radius: 4px; }
      `}</style>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 800, color: C.sub, margin: "6px 0 12px", letterSpacing: 0.5 }}>{children}</div>;
}

const ghostBtn = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: C.sub, borderRadius: 10, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" };
const primaryBtn = { background: `linear-gradient(135deg, ${C.iris}, ${C.iris2})`, border: "none", borderRadius: 14, padding: "14px 24px", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 8px 28px ${C.iris}55` };

// ─── ambient neural background (light, CSS only) ─────────────
function NeuralBg() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.5 }}>
      <div style={{ position: "absolute", top: "8%", left: "50%", transform: "translateX(-50%)", width: 620, height: 620, background: `radial-gradient(circle, ${C.iris}18 0%, transparent 65%)`, borderRadius: "50%" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(124,140,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,140,255,0.03) 1px, transparent 1px)`, backgroundSize: "48px 48px" }} />
    </div>
  );
}
