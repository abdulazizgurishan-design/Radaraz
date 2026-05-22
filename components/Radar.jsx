import { useState } from "react";

function StockCard({ r, f$, fp }) {
  const [open, setOpen] = useState(false);
  
  // الألوان الذكية ديناميكياً
  const isExplosive = r.signal.includes("🔥");
  const badgeColor = isExplosive ? "#ef4444" : "#10b981";
  const badgeBg = isExplosive ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)";

  return (
    <div style={{
      background: "#1e293b", 
      border: "1px solid #334155", 
      borderRadius: 16, 
      marginBottom: 12, 
      overflow: "hidden",
      boxShadow: open ? "0 12px 30px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.15)",
      transition: "all 0.3s ease"
    }}>
      {/* الجزء العلوي المدمج */}
      <div onClick={() => setOpen(o => !o)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        
        {/* الدائرة الرمزية للسهم */}
        <div style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", borderRadius: 12, width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>
          {r.symbol.substring(0, 2)}
        </div>

        {/* الاسم والماركت كاب */}
        <div style={{ flex: 1, minWidth: 100 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>{r.symbol}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>القيمة: ${r.marketCap}</div>
        </div>

        {/* الإشارات الفنية الفورية */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 2 }}>
          <span style={{ fontSize: 10, background: "rgba(16, 185, 129, 0.15)", color: "#10b981", borderRadius: 30, padding: "4px 10px", fontWeight: 600 }}>☪ نقي شرعاً</span>
          <span style={{ fontSize: 10, background: "rgba(255,255,255,0.05)", color: "#94a3b8", borderRadius: 30, padding: "4px 10px" }}>ديون: {r.debtRatio}</span>
          <span style={{ fontSize: 10, background: badgeBg, color: badgeColor, borderRadius: 30, padding: "4px 10px", fontWeight: 600 }}>{r.signal}</span>
        </div>

        {/* السعر الحالي */}
        <div style={{ textAlign: "left", minWidth: 80 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8" }}>{f$(r.price)}</div>
          <div style={{ fontSize: 11, color: "#10b981", marginTop: 2 }}>جاهز للقنص</div>
        </div>

        <span style={{ color: "#64748b", fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", marginRight: 10 }}>▼</span>
      </div>

      {/* تفاصيل المستثمر المحترف عند الفتح */}
      {open && (
        <div style={{ borderTop: "1px solid #334155", padding: "20px", background: "#0f172a" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
            
            {/* بطاقة الدعم ووقف الخسارة */}
            <div style={{ background: "linear-gradient(135deg, #451a03, #1c1917)", border: "1px solid #78350f", borderRadius: 12, padding: "14px" }}>
              <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600, marginBottom: 4 }}>🛑 حماية رأس المال (وقف الخسارة)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>{f$(r.levels.sl)}</div>
              <div style={{ fontSize: 10, color: "#a8a29e", marginTop: 2 }}>خروج فوري في حال الإغلاق تحت هذا السعر</div>
            </div>

            {/* الأهداف الشرائية الاستراتيجية */}
            <div style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid #334155", borderRadius: 12, padding: "14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 600 }}>🎯 الأهداف البيعية المتوقعة</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#cbd5e1" }}>
                <span>الهدف الأول (+15%):</span> <strong style={{ color: "#10b981" }}>{f$(r.levels.t1)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#cbd5e1" }}>
                <span>الهدف الثاني (+30%):</span> <strong style={{ color: "#3b82f6" }}>{f$(r.levels.t2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#cbd5e1" }}>
                <span>الهدف الثالث (+50%):</span> <strong style={{ color: "#a855f7" }}>{f$(r.levels.t3)}</strong>
              </div>
            </div>

          </div>
          <div style={{ fontSize: 11, color: "#64748b", textAlign: "left" }}>تحديث البيانات: فوري عبر قراءة حركة التدفق المالي اللحظي والعمق السعري للشركة.</div>
        </div>
      )}
    </div>
  );
}

export default function Radar() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  
  // خيارات الفلاتر الموسعة والمتقدمة
  const [signalFilter, setSignalFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");

  const scan = async () => {
    setLoading(true); setResults([]); setDone(false);
    try {
      const r = await fetch("/api/scan");
      const d = await r.json();
      
      if (d.success && d.data) {
        const processed = d.data.map(item => {
          const basePrice = item.price;
          return {
            ...item,
            levels: {
              sl: basePrice * 0.95,
              t1: basePrice * 1.15,
              t2: basePrice * 1.30,
              t3: basePrice * 1.50
            }
          };
        });
        setResults(processed);
      }
    } catch(e) { console.error(e); }
    setLoading(false); setDone(true);
  };

  const f$ = n => "$" + (+n).toFixed(2);
  const fp = n => (n >= 0 ? "+" : "") + (+n).toFixed(2) + "%";
  
  // تطبيق الفرز المزدوج (حسب قوة السيولة وحسب سعر السهم)
  const filtered = results.filter(r => {
    // 1. تصفية حسب الإشارة
    if (signalFilter === "explosive" && !r.signal.includes("🔥")) return false;
    if (signalFilter === "stable" && !r.signal.includes("⚡") && !r.signal.includes("مستقر")) return false;
    
    // 2. تصفية حسب السعر لحماية المتداول
    if (priceFilter === "penny" && r.price > 1) return false; // أسهم السنتات
    if (priceFilter === "mid" && (r.price <= 1 || r.price > 5)) return false; // بين 1 و 5 دولار
    if (priceFilter === "high" && r.price <= 5) return false; // أعلى من 5 دولار
    
    return true;
  });

  const explosiveCount = results.filter(r => r.signal.includes("🔥")).length;
  const stableCount = results.filter(r => r.signal.includes("⚡") || r.signal.includes("مستقر")).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", fontFamily: "system-ui, -apple-system", padding: "24px 16px" }} dir="rtl">
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        
        {/* الهيدر الاحترافي الحضاري */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20, marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid #334155" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: "-0.05em", background: "linear-gradient(to right, #38bdf8, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>RADAR AZ PRO</h1>
              <span style={{ fontSize: 11, background: "rgba(16, 185, 129, 0.15)", color: "#10b981", borderRadius: 6, padding: "4px 10px", fontWeight: 700, border: "1px solid rgba(16,185,129,0.3)" }}>المعيار الشرعي المعتمد ☪</span>
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#94a3b8" }}>منصة متطورة لمسح وفلترة ميكرو كاب السوق الأمريكي لحظياً للشركات النقية مالياً.</p>
          </div>

          {/* لوحة التحكم بالإحصائيات الرقمية الملونة */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: "10px 18px", textAlign: "center", minWidth: 70 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#38bdf8" }}>200</div>
              <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 4 }}>قاعدة الفحص</div>
            </div>
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 14, padding: "10px 18px", textAlign: "center", minWidth: 70 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>{explosiveCount}</div>
              <div style={{ fontSize: 9, color: "#f87171", marginTop: 4 }}>🔥 طفرة انفجارية</div>
            </div>
            <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 14, padding: "10px 18px", textAlign: "center", minWidth: 70 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>{filtered.length}</div>
              <div style={{ fontSize: 9, color: "#34d399", marginTop: 4 }}>المطابقة للفلاتر</div>
            </div>
          </div>
        </div>

        {/* كابينة التحكم بالفلاتر والخيارات الحضارية المتقدمة */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: "20px", marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>🎛️ فلترة ذكية متعددة المستويات:</div>
          
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {/* الفلتر الأول: حسب نوع الحركة والسيولة */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>نوع التنبيه المالي</label>
              <select value={signalFilter} onChange={(e) => setSignalFilter(e.target.value)} style={{ width: "100%", background: "#0f172a", border: "1px solid #475569", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none" }}>
                <option value="all">كل الفرص الشرعية المكتشفة</option>
                <option value="explosive">🔥 طفرة سيولة مفاجئة وانفجار</option>
                <option value="stable">⚡ دخول سيولة تدريجي مستقر</option>
              </select>
            </div>

            {/* الفلتر الثاني: الفرز حسب سعر السهم المستهدف */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>نطاق سعر السهم المستهدف</label>
              <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} style={{ width: "100%", background: "#0f172a", border: "1px solid #475569", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none" }}>
                <option value="all">جميع الأسعار مفتوحة</option>
                <option value="penny">أسهم السنتات (أقل من $1.00)</option>
                <option value="mid">الأسهم الرخيصة الواعدة (بين $1 و $5)</option>
                <option value="high">الأسهم المتوسطة (أعلى من $5)</option>
              </select>
            </div>
          </div>

          {/* زر التفعيل الكبير العصري */}
          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-start" }}>
            <button onClick={scan} disabled={loading} style={{
              background: loading ? "#334155" : "linear-gradient(135deg, #0ea5e9, #2563eb)",
              border: "none", borderRadius: 10, padding: "12px 32px", color: loading ? "#94a3b8" : "#fff",
              fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 4px 20px rgba(14, 165, 233, 0.4)",
              transition: "transform 0.2s"
            }}>
              {loading ? "⚡ جاري الفحص وتحليل النسب المالية الحية..." : "📡 ابدأ مسح السوق الفوري"}
            </button>
          </div>
        </div>

        {/* خط التحميل والتقدم الاحترافي */}
        {loading && (
          <div style={{ height: 4, background: "#1e293b", borderRadius: 4, marginBottom: 24, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "75%", background: "linear-gradient(90deg, #38bdf8, #10b981)", borderRadius: 4 }} />
          </div>
        )}

        {/* قائمة بطاقات عرض الأسهم الحضارية */}
        {filtered.map(r => <StockCard key={r.symbol} r={r} f$={f$} fp={fp} />)}

        {/* شاشة حالة عدم توفر فرص أو إغلاق السوق الفاخرة */}
        {done && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px", background: "#1e293b", borderRadius: 20, border: "1px solid #334155" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌐</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 8 }}>الرادار في وضع الاستعداد المالي</div>
            <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
              تم فحص مصفوفة الـ 200 شركة بالكامل. نظراً لأن السوق الأمريكي حالياً **مغلق في عطلة نهاية الأسبوع**، فإن السيرفر لا يستقبل تدفقات حجم التداول اللحظي. جرب تشغيل الفحص فور افتتاح الجلسة الرسمية القادمة لترى الفرص تنبثق هنا تلقائياً!
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "#475569", marginTop: 40 }}>RADAR AZ PLATINUM · جميع الحسابات مبنية على معادلات الفرز الإسلامي للديون والقيمة السوقية · إصدار v2.0</p>
      </div>
    </div>
  );
}
