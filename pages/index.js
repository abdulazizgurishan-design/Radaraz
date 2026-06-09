import Head from "next/head";
import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [key, setKey] = useState("");
  const tickerRef = useRef(null);

  const tickers = [
    { sym: "AAPL", price: "$189.45", chg: "+1.2%", up: true },
    { sym: "NVDA", price: "$721.33", chg: "+3.4%", up: true },
    { sym: "TSLA", price: "$248.10", chg: "-0.8%", up: false },
    { sym: "MSFT", price: "$412.80", chg: "+0.9%", up: true },
    { sym: "META", price: "$519.20", chg: "+2.1%", up: true },
    { sym: "AMZN", price: "$185.60", chg: "+1.5%", up: true },
    { sym: "GOOGL", price: "$164.30", chg: "-0.3%", up: false },
    { sym: "AMD", price: "$152.40", chg: "+4.2%", up: true },
    { sym: "PLTR", price: "$21.80", chg: "+6.1%", up: true },
    { sym: "SOFI", price: "$8.45", chg: "+2.8%", up: true },
  ];

  const handleKey = () => {
    if (key.trim()) window.location.href = `/radar?key=${key.trim()}`;
  };

  return (
    <>
      <Head>
        <title>RadarAZ — AI Stock Intelligence</title>
        <meta name="description" content="AI-powered stock scanner. Scans 1000+ US stocks in seconds. Real signals, no noise." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #080c18; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
        
        .ticker-wrap { overflow: hidden; background: rgba(99,102,241,0.08); border-bottom: 1px solid rgba(99,102,241,0.2); padding: 10px 0; }
        .ticker-track { display: flex; gap: 40px; animation: ticker 30s linear infinite; white-space: nowrap; width: max-content; }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        
        .section { padding: 80px 24px; max-width: 700px; margin: 0 auto; }
        
        .vs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 32px; }
        @media (max-width: 600px) { .vs-grid { grid-template-columns: 1fr; } }
        
        .steps { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 32px; }
        @media (max-width: 500px) { .steps { grid-template-columns: 1fr; } }
        
        .features { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 32px; }
        @media (max-width: 500px) { .features { grid-template-columns: 1fr; } }
        
        .plans { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 32px; }
        @media (max-width: 500px) { .plans { grid-template-columns: 1fr; } }
        
        .reviews { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 32px; }
        
        a { color: inherit; text-decoration: none; }
        
        .btn-primary { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; color: #fff; font-weight: 700; font-size: 15px; cursor: pointer; border: none; transition: opacity 0.2s; }
        .btn-primary:hover { opacity: 0.85; }
        .btn-outline { display: inline-block; padding: 14px 32px; border: 1px solid rgba(99,102,241,0.5); border-radius: 12px; color: #a5b4fc; font-weight: 700; font-size: 15px; transition: border-color 0.2s; }
        .btn-outline:hover { border-color: #6366f1; }

        input:focus { outline: 2px solid #6366f1; }
      `}</style>

      {/* NAV */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: 1 }}>📡 RadarAZ</span>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 10, background: "rgba(99,102,241,0.15)", color: "#818cf8", padding: "4px 10px", borderRadius: 20, fontWeight: 700 }}>LIVE · مباشر</span>
          <a href="/trial" className="btn-primary" style={{ padding: "8px 18px", fontSize: 13 }}>ابدأ مجاناً</a>
        </div>
      </nav>

      {/* TICKER */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          {[...tickers, ...tickers].map((t, i) => (
            <span key={i} style={{ fontSize: 13, fontFamily: "monospace" }}>
              <span style={{ color: "rgba(255,255,255,0.6)" }}>{t.sym}</span>{" "}
              <span>{t.price}</span>{" "}
              <span style={{ color: t.up ? "#34d399" : "#f87171" }}>{t.chg}</span>
            </span>
          ))}
        </div>
      </div>

      {/* HERO */}
      <div className="section" style={{ textAlign: "center", paddingTop: 80, paddingBottom: 60 }}>
        <p style={{ fontSize: 12, letterSpacing: 3, color: "#818cf8", marginBottom: 20, textTransform: "uppercase" }}>AI Stock Intelligence · ذكاء الأسهم</p>
        <h1 style={{ fontSize: "clamp(28px, 6vw, 52px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 24 }}>
          امسح السوق<br />
          <span style={{ color: "#6366f1" }}>اكتشف الفرص</span><br />
          تداول بذكاء
        </h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 16, lineHeight: 1.7, maxWidth: 480, margin: "0 auto 36px" }}>
          رادار ذكي يمسح فوق 1000 سهم أمريكي في ثواني — فرص حقيقية مبنية على خوارزميات
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/trial" className="btn-primary">⚡ جرّب مجاناً 24 ساعة</a>
          <a href="#pricing" className="btn-outline">الأسعار</a>
        </div>

        {/* stats */}
        <div style={{ display: "flex", gap: 32, justifyContent: "center", marginTop: 56, flexWrap: "wrap" }}>
          {[["1000+", "سهم يفحص يومياً"], ["99", "أعلى سكور ممكن"], ["24H", "تجربة مجانية"]].map(([v, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#6366f1", fontFamily: "monospace" }}>{v}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* VS */}
      <div className="section" style={{ paddingTop: 20 }}>
        <p style={{ fontSize: 11, color: "#818cf8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>المقارنة</p>
        <h2 style={{ fontSize: 26, fontWeight: 900 }}>خوارزميات لا آراء</h2>
        <div className="vs-grid">
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
            <p style={{ fontSize: 12, color: "#f87171", marginBottom: 16, fontWeight: 700 }}>الطريقة القديمة ✕</p>
            {["توصيات عشوائية بلا بيانات", "مجموعات تيليغرام غير موثوقة", "بلا دخول أو وقف خسارة", "نتائج متذبذبة بلا منهجية"].map(t => (
              <p key={t} style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 10, paddingRight: 16, position: "relative" }}>
                <span style={{ position: "absolute", right: 0, color: "#f87171" }}>✕</span>{t}
              </p>
            ))}
          </div>
          <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 14, padding: 20 }}>
            <p style={{ fontSize: 12, color: "#34d399", marginBottom: 16, fontWeight: 700 }}>طريقة رادار ✓</p>
            {["خوارزميات مدربة على استراتيجيات حقيقية", "دخول + وقف خسارة + 3 أهداف تلقائية", "سكور ذكي لكل سهم", "مبني على خبرة +15 سنة"].map(t => (
              <p key={t} style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 10, paddingRight: 16, position: "relative" }}>
                <span style={{ position: "absolute", right: 0, color: "#34d399" }}>✓</span>{t}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="section">
        <p style={{ fontSize: 11, color: "#818cf8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>كيف يعمل</p>
        <h2 style={{ fontSize: 26, fontWeight: 900 }}>بسيط · ذكي · سريع</h2>
        <div className="steps">
          {[
            ["🔍", "فحص شامل", "يمسح 1000+ سهم أمريكي يومياً بحثاً عن أعلى الفرص"],
            ["⚡", "فلتر 20% الذكي", "يفلتر الأسهم ذات الزخم الحقيقي ويزيل الضوضاء فوراً"],
            ["🎯", "سكور 30–99", "كل سهم يحصل على تقييم دقيق يعكس قوة الفرصة"],
            ["💰", "قرار مدروس", "تداول بثقة بناءً على بيانات حقيقية لا تخمين"],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div className="section">
        <p style={{ fontSize: 11, color: "#818cf8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>المميزات</p>
        <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>كل ما تحتاجه في مكان واحد</h2>
        <div className="features">
          {[
            ["📡", "فحص 1000+ سهم", "تغطية كاملة للسوق الأمريكي في كل جلسة"],
            ["🎯", "سكور من 30 إلى 99", "نظام تقييم ذكي يحدد أقوى الفرص بدقة"],
            ["🔒", "وصول بمفتاح خاص", "حسابك، مفتاحك. آمن وخاص تماماً"],
            ["⚡", "فلتر 20% الذكي", "يبرز فقط الأسهم ذات الزخم الحقيقي"],
            ["📱", "يعمل من أي جهاز", "موبايل أو لابتوب — تداول من أي مكان"],
            ["🕐", "تجربة مجانية 24 ساعة", "وصول كامل بدون بطاقة ائتمان"],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING */}
      <div className="section" id="pricing">
        <p style={{ fontSize: 11, color: "#818cf8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>الأسعار</p>
        <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>اختر خطتك</h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>أسعار شفافة بلا مفاجآت</p>
        <div className="plans">
          {[
            { period: "شهري", old: "$27", price: "$18", link: "https://radaraz.gumroad.com/l/kbkpl", features: ["وصول كامل لكل الميزات", "فحص يومي 1000+ سهم", "سكور ذكي 30-99", "دعم فني"] },
            { period: "3 أشهر", old: "$59", price: "$40", link: "https://radaraz.gumroad.com/l/ereqyb", features: ["كل مميزات الشهري", "أعلى توفير", "أولوية الدعم", "ميزات جديدة أولاً"], highlight: true },
          ].map(p => (
            <div key={p.period} style={{ background: p.highlight ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${p.highlight ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, marginBottom: 8 }}>{p.period}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 32, fontWeight: 900 }}>{p.price}</span>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", textDecoration: "line-through" }}>{p.old}</span>
                </div>
                <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>⏳ عرض محدود</p>
              </div>
              <div style={{ flex: 1 }}>
                {p.features.map(f => (
                  <p key={f} style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8, paddingRight: 16, position: "relative" }}>
                    <span style={{ position: "absolute", right: 0, color: "#34d399" }}>✓</span>{f}
                  </p>
                ))}
              </div>
              <a href={p.link} className="btn-primary" style={{ textAlign: "center" }}>اشترك الآن</a>
            </div>
          ))}
        </div>

        {/* Free Trial */}
        <div style={{ marginTop: 24, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 14, padding: 28, textAlign: "center" }}>
          <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>جرّب مجاناً</h3>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 20 }}>وصول كامل · 24 ساعة · بدون بطاقة ائتمان</p>
          <a href="/trial" className="btn-primary">⚡ ابدأ التجربة المجانية</a>
        </div>
      </div>

      {/* ACCESS KEY */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔑</div>
          <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>عندك مفتاح؟</h3>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>أدخل مفتاحك للوصول المباشر للرادار</p>
          <div style={{ display: "flex", gap: 10, maxWidth: 360, margin: "0 auto", direction: "rtl" }}>
            <input
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleKey()}
              placeholder="أدخل المفتاح..."
              style={{ flex: 1, padding: "12px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff", fontSize: 14 }}
            />
            <button onClick={handleKey} className="btn-primary" style={{ padding: "12px 20px", whiteSpace: "nowrap" }}>دخول ←</button>
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 12 }}>المفتاح يُرسل لإيميلك بعد الاشتراك</p>
        </div>
      </div>

      {/* TIPS */}
      <div className="section" style={{ paddingTop: 0 }}>
        <p style={{ fontSize: 11, color: "#818cf8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>نصائح المتداولين</p>
        <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 24 }}>من خبرة السوق</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {[
            ["🕐", "TIMING", "أفضل وقت للرادار", "انتظر ساعة بعد الفتح لتهدأ الحركة — الساعة الأولى فوضى"],
            ["⚡", "DISCIPLINE", "لا تطمع بكل الأهداف", "الاكتفاء ببعض الأهداف يحميك من الانعكاس"],
            ["🛡️", "RISK MGMT", "وقف الخسارة ضرورة", "حماية رأس المال هي القاعدة الأولى في التداول"],
            ["🔐", "SECURITY", "دفعك آمن 100%", "نستخدم Gumroad — بوابة دفع عالمية موثوقة"],
          ].map(([icon, tag, title, desc]) => (
            <div key={title} style={{ display: "flex", gap: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 18, alignItems: "flex-start" }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
              <div>
                <p style={{ fontSize: 10, color: "#6366f1", letterSpacing: 2, marginBottom: 4, fontWeight: 700 }}>{tag}</p>
                <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>{title}</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* REVIEWS */}
      <div className="section" style={{ paddingTop: 0 }}>
        <p style={{ fontSize: 11, color: "#818cf8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>آراء المشتركين</p>
        <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>ماذا قال المتداولون</h2>
        <div className="reviews">
          {[
            ["Khalid Al-Otaibi", "🇸🇦 الرياض", "MONTHLY", "غيّر طريقة تداولي كليا. كنت أتابع قنوات تيليغرام عشوائية وأخسر أكثر مما أربح. رادار الأسهم يعطيك أرقاماً حقيقية وسكور واضح — بدون تخمين. الأسبوع الأول، 3 صفقات رابحة."],
            ["Mohammed Al-Shammari", "🇸🇦 جدة", "QUARTERLY", "اشتركت ربع سنوي ولم أندم. الفلتر الذكي يوفر ساعات بحث. أشغله ساعة بعد الفتح تماماً كما ينصحون — النتائج ممتازة."],
            ["Faisal Al-Mutairi", "🇰🇼 الكويت", "MONTHLY", "جربت التجربة المجانية ثم اشتركت فوراً. السكور الذكي دقيق جداً — الأسهم فوق 80 تحركت بشكل جميل. أنصح به كل متداول يومي."],
            ["Sultan Al-Mansouri", "🇦🇪 دبي", "MONTHLY", "واجهة بسيطة، يعمل بشكل مثالي على الموبايل. أشغله بعد 4:30 مساءً عند فتح السوق الأمريكي — أختار 2-3 صفقات. يستحق كل ريال."],
          ].map(([name, loc, plan, review]) => (
            <div key={name} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
              <div style={{ color: "#f59e0b", fontSize: 14, marginBottom: 12 }}>★★★★★</div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, marginBottom: 16 }}>"{review}"</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13 }}>{name}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{loc}</p>
                </div>
                <span style={{ fontSize: 10, background: "rgba(99,102,241,0.15)", color: "#818cf8", padding: "3px 8px", borderRadius: 6 }}>{plan}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DISCLAIMER */}
      <div style={{ padding: "0 24px 40px", maxWidth: 700, margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.7, textAlign: "center" }}>
          ⚠️ RadarAZ أداة تحليلية فقط وليست توصية مالية. التداول ينطوي على مخاطر. الأداء السابق لا يضمن النتائج المستقبلية. الشرعية مسؤوليتك الشخصية.
        </p>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px", textAlign: "center" }}>
        <p style={{ fontWeight: 900, marginBottom: 12 }}>📡 RadarAZ</p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 16 }}>
          <a href="https://x.com/radarazpro" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>𝕏 Twitter</a>
          <a href="https://t.me/radarazpro2" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>✈️ Telegram</a>
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>© 2026 RADARAZ · جميع الحقوق محفوظة</p>
      </footer>
    </>
  );
}
