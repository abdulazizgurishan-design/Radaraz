import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════
//  صفحة الشراكة /partner
//  تسويق المنصة + برنامج الإحالة + تسجيل المسوّق
// ═══════════════════════════════════════════════════════════════════

const C = {
  bg: '#070b14',
  panel: 'rgba(17,24,39,0.7)',
  ink: '#e8edf6',
  mute: '#8a94a6',
  iris: '#6366f1',
  violet: '#8b5cf6',
  mint: '#00d4aa',
  gold: '#fbbf24',
  line: 'rgba(148,163,184,0.12)',
};

const F = {
  display: '-apple-system, "SF Pro Display", system-ui, sans-serif',
  mono: '"SF Mono", "Roboto Mono", monospace',
};

export default function Partner() {
  // step: landing → apply (questions) → form → done
  const [step, setStep] = useState('landing');
  const [answers, setAnswers] = useState({ exp_market: '', exp_marketing: '', audience: '' });
  const [form, setForm] = useState({ name: '', email: '', telegram: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState('');

  const submit = async () => {
    if (!form.name.trim() || !form.email.includes('@')) {
      setError('اكتب اسمك وإيميلك الصحيح');
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/affiliate-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...answers }),
      });
      const d = await res.json();
      if (d.success) {
        setResult(d);
        setStep('done');
      } else if (d.no_codes) {
        setError('نفدت الأكواد حالياً — سنتواصل معك قريباً عبر تليجرام');
      } else {
        setError(d.message || 'حدث خطأ، حاول مجدداً');
      }
    } catch {
      setError('خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const copy = (txt, which) => {
    navigator.clipboard?.writeText(txt).catch(() => {});
    setCopied(which);
    setTimeout(() => setCopied(''), 1800);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: F.display, direction: 'rtl' }}>
      {/* خلفية رادار */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.5,
        background: `radial-gradient(circle at 50% 0%, rgba(99,102,241,0.10), transparent 55%)` }} />
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
        backgroundSize: '48px 48px', opacity: 0.4 }} />

      <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto', padding: '0 20px 80px' }}>

        {step === 'landing' && <Landing onApply={() => setStep('apply')} />}

        {step === 'apply' && (
          <Screening
            answers={answers}
            setAnswers={setAnswers}
            onNext={() => setStep('form')}
            onBack={() => setStep('landing')}
          />
        )}

        {step === 'form' && (
          <RegForm
            form={form} setForm={setForm}
            loading={loading} error={error}
            onSubmit={submit} onBack={() => setStep('apply')}
          />
        )}

        {step === 'done' && result && (
          <Done result={result} copied={copied} onCopy={copy} />
        )}
      </div>

      <style>{`
        @keyframes sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blip { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(138,148,166,0.5); }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>
    </div>
  );
}

// ─── الهيرو + التسويق + برنامج الإحالة ───
function Landing({ onApply }) {
  return (
    <>
      {/* شريط علوي: دخول الشريك */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: 20 }}>
        <a href="/partner/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'rgba(99,102,241,0.1)', border: `1px solid rgba(99,102,241,0.25)`,
          borderRadius: 22, padding: '8px 16px', textDecoration: 'none',
          color: '#a5b4fc', fontSize: 12.5, fontWeight: 600,
        }}>
          🔑 دخول الشريك
        </a>
      </div>

      {/* الهيرو */}
      <header style={{ paddingTop: 28, textAlign: 'center' }}>
        <RadarMark />
        <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.5, margin: '20px 0 8px' }}>
          رادار <span style={{ color: C.iris }}>Radaraz</span>
        </h1>
        <p style={{ fontSize: 15, color: C.mute, lineHeight: 1.7, margin: 0 }}>
          منصة رصد الأسهم الأمريكية — تضاهي المنصات العالمية<br />بجزء بسيط من تكلفتها
        </p>
      </header>

      {/* المميزات */}
      <section style={{ marginTop: 40 }}>
        <Eyebrow>لماذا Radaraz</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          {[
            ['⚡', 'مسح لحظي', 'يرصد حركة السوق الحي لحظة بلحظة'],
            ['🎯', 'إشارات بأهداف', 'دخول وأهداف ووقف واضح لكل سهم'],
            ['📊', 'مؤشرات احترافية', 'RSI · ATR · تقاطعات بمعايير عالمية'],
            ['🔍', 'رصد مبكر', 'يكشف السهم قبل انفجاره'],
          ].map(([ic, t, d]) => (
            <div key={t} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{ic}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{t}</div>
              <div style={{ fontSize: 11.5, color: C.mute, lineHeight: 1.6 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* الباقة */}
      <section style={{ marginTop: 32 }}>
        <div style={{ background: `linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.06))`,
          border: `1px solid rgba(99,102,241,0.25)`, borderRadius: 18, padding: '22px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: C.mute }}>الباقة الشهرية</div>
            <div style={{ fontSize: 12, color: C.mint, marginTop: 4 }}>وصول كامل للرادار</div>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 30, fontWeight: 800, color: C.mint }}>$18</div>
        </div>
        <div style={{ marginTop: 10, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)',
          fontSize: 12.5, color: C.gold, textAlign: 'center' }}>
          🚀 التداول الإلكتروني الآلي — قريباً
        </div>
      </section>

      {/* ───── برنامج الإحالة ───── */}
      <section style={{ marginTop: 52 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: C.violet, fontWeight: 700 }}>برنامج الشركاء</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: '8px 0 6px' }}>
            كن شريك معنا
          </h2>
          <p style={{ fontSize: 14, color: C.mute, margin: 0 }}>
            اكسب دخلاً أسبوعياً بلا سقف — <span style={{ color: C.mint, fontWeight: 700 }}>$4</span> شهرياً عن كل مشترك
          </p>
        </div>

        {/* مثال أحمد */}
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 12.5, color: C.mute, marginBottom: 14, textAlign: 'center' }}>
            💡 أحمد سوّق للمنصة وجلب <span style={{ color: C.ink, fontWeight: 700 }}>200 مشترك</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[['$185', 'أسبوعياً'], ['$800', 'شهرياً'], ['$9,600', 'سنوياً']].map(([v, l]) => (
              <div key={l} style={{ background: 'rgba(0,212,170,0.07)', borderRadius: 12, padding: '14px 6px', textAlign: 'center' }}>
                <div style={{ fontFamily: F.mono, fontSize: 19, fontWeight: 800, color: C.mint }}>{v}</div>
                <div style={{ fontSize: 9.5, color: C.mute, marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 11.5, color: C.mute, textAlign: 'center', lineHeight: 1.6 }}>
            عمولة متكرّرة شهرياً طالما المشترك نشط · تُدفع بـ USDT
          </div>
        </div>

        {/* كيف يعمل */}
        <div style={{ marginTop: 18 }}>
          {[
            ['تسجّل وتجاوب أسئلة بسيطة', 'دقيقة واحدة'],
            ['تستلم كودك ومفتاحك فوراً', 'بلا انتظار'],
            ['تعلن لجمهورك بكودك', 'بأسلوبك'],
            ['تتابع أرباحك في لوحتك', 'محدّثة دائماً'],
          ].map(([t, d], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0',
              borderBottom: i < 3 ? `1px solid ${C.line}` : 'none' }}>
              <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 9,
                background: `linear-gradient(135deg, ${C.iris}, ${C.violet})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F.mono, fontWeight: 800, fontSize: 13 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t}</div>
              </div>
              <div style={{ fontSize: 11, color: C.mute }}>{d}</div>
            </div>
          ))}
        </div>

        <button onClick={onApply} style={btnPrimary}>سجّل معنا كشريك ←</button>
      </section>

      <footer style={{ marginTop: 40, textAlign: 'center', fontSize: 11, color: 'rgba(138,148,166,0.5)' }}>
        Radaraz · رادار الأسهم الأمريكية
      </footer>
    </>
  );
}

// ─── أسئلة الفرز ───
function Screening({ answers, setAnswers, onNext, onBack }) {
  const questions = [
    { key: 'exp_market', q: 'خبرتك في سوق الأسهم الأمريكي؟', opts: ['عالية', 'متوسطة', 'منخفضة', 'لا يوجد'] },
    { key: 'exp_marketing', q: 'خبرتك في التسويق بالعمولة؟', opts: ['خبير', 'بعض الخبرة', 'مبتدئ'] },
    { key: 'audience', q: 'عندك جمهور أو صفحات بمتابعين؟', opts: ['نعم، كبير', 'متوسط', 'صغير / لا'] },
  ];
  const allAnswered = questions.every(q => answers[q.key]);

  return (
    <div style={{ paddingTop: 48 }}>
      <Back onClick={onBack} />
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '18px 0 6px' }}>أسئلة سريعة</h2>
      <p style={{ fontSize: 13, color: C.mute, marginBottom: 24 }}>نتعرّف عليك قبل التسجيل</p>

      {questions.map((item, qi) => (
        <div key={item.key} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            <span style={{ color: C.violet, fontFamily: F.mono, marginLeft: 6 }}>{qi + 1}.</span>{item.q}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {item.opts.map(opt => {
              const active = answers[item.key] === opt;
              return (
                <button key={opt} onClick={() => setAnswers(a => ({ ...a, [item.key]: opt }))}
                  style={{
                    background: active ? `linear-gradient(135deg, ${C.iris}, ${C.violet})` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'transparent' : C.line}`,
                    borderRadius: 22, padding: '9px 16px', color: active ? '#fff' : C.mute,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F.display,
                    transition: 'all 0.15s',
                  }}>{opt}</button>
              );
            })}
          </div>
        </div>
      ))}

      <button onClick={onNext} disabled={!allAnswered}
        style={{ ...btnPrimary, opacity: allAnswered ? 1 : 0.4, cursor: allAnswered ? 'pointer' : 'not-allowed' }}>
        متابعة ←
      </button>
    </div>
  );
}

// ─── نموذج التسجيل ───
function RegForm({ form, setForm, loading, error, onSubmit, onBack }) {
  return (
    <div style={{ paddingTop: 48 }}>
      <Back onClick={onBack} />
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '18px 0 6px' }}>بياناتك</h2>
      <p style={{ fontSize: 13, color: C.mute, marginBottom: 24 }}>تستلم كودك ومفتاحك فوراً</p>

      {error && <div style={errBox}>{error}</div>}

      <Field label="الاسم الكامل" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="اسمك" />
      <Field label="الإيميل" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="you@email.com" dir="ltr" type="email" />
      <Field label="حساب تليجرام (اختياري)" value={form.telegram} onChange={v => setForm(f => ({ ...f, telegram: v }))} placeholder="@username" dir="ltr" />

      <button onClick={onSubmit} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}>
        {loading ? '⟳ جاري التسجيل...' : '🎟️ احصل على كودي'}
      </button>
    </div>
  );
}

// ─── شاشة النجاح (الكود + المفتاح) ───
function Done({ result, copied, onCopy }) {
  return (
    <div style={{ paddingTop: 64, textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>🎉</div>
      <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px', color: C.mint }}>
        {result.already ? 'أهلاً من جديد!' : 'تم تسجيلك كشريك!'}
      </h2>
      <p style={{ fontSize: 13, color: C.mute, marginBottom: 28 }}>
        {result.already ? 'هذا كودك ومفتاحك المسجّلان' : 'احفظ كودك ومفتاحك — تحتاجهما للدخول'}
      </p>

      {/* الكود */}
      <RevealCard label="كود الخصم (شاركه مع جمهورك)"
        value={result.code} copied={copied === 'code'} onCopy={() => onCopy(result.code, 'code')} accent={C.mint} />

      {/* المفتاح */}
      <RevealCard label="مفتاح الدخول (للوحتك)"
        value={result.secret_key} copied={copied === 'key'} onCopy={() => onCopy(result.secret_key, 'key')} accent={C.iris} />

      <a href="/partner/dashboard" style={{ ...btnPrimary, display: 'block', textDecoration: 'none', marginTop: 24 }}>
        ادخل لوحتي ←
      </a>
      <div style={{ marginTop: 16, fontSize: 11.5, color: C.mute, lineHeight: 1.7 }}>
        عمولتك $4 شهرياً عن كل مشترك يستخدم كودك<br />تُدفع بـ USDT (شبكة TRC20) نهاية كل شهر
      </div>
    </div>
  );
}

// ─── مكوّنات مساعدة ───
function RadarMark() {
  return (
    <div style={{ width: 72, height: 72, margin: '0 auto', position: 'relative',
      borderRadius: '50%', border: `1px solid rgba(99,102,241,0.3)` }}>
      <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: `1px solid rgba(99,102,241,0.2)` }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '50%', height: '50%',
          transformOrigin: '0 0', animation: 'sweep 4s linear infinite',
          background: `conic-gradient(from 0deg, rgba(99,102,241,0.5), transparent 60deg)` }} />
      </div>
      <div style={{ position: 'absolute', top: '28%', left: '62%', width: 7, height: 7, borderRadius: '50%',
        background: C.mint, animation: 'blip 2s ease-in-out infinite' }} />
    </div>
  );
}

function Eyebrow({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: 3, color: C.iris, fontWeight: 700, textAlign: 'center' }}>{children}</div>;
}

function Back({ onClick }) {
  return <button onClick={onClick} style={{ background: 'none', border: 'none', color: C.mute, fontSize: 13, cursor: 'pointer', fontFamily: F.display, padding: 0 }}>→ رجوع</button>;
}

function Field({ label, value, onChange, placeholder, dir = 'rtl', type = 'text' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, color: C.mute, display: 'block', marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} dir={dir}
        style={{ width: '100%', padding: '13px 15px', background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${C.line}`, borderRadius: 12, color: C.ink, fontSize: 14.5,
          outline: 'none', fontFamily: dir === 'ltr' ? F.mono : F.display }} />
    </div>
  );
}

function RevealCard({ label, value, copied, onCopy, accent }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px dashed ${accent}55`,
      borderRadius: 14, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.mute, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: F.mono, fontSize: 24, fontWeight: 800, color: accent, letterSpacing: 3, marginBottom: 10 }}>{value}</div>
      <button onClick={onCopy} style={{ background: `${accent}22`, border: `1px solid ${accent}44`,
        borderRadius: 9, padding: '7px 16px', color: accent, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: F.display }}>
        {copied ? '✓ نُسخ' : '📋 نسخ'}
      </button>
    </div>
  );
}

const btnPrimary = {
  width: '100%', marginTop: 28, padding: 15,
  background: `linear-gradient(135deg, #6366f1, #8b5cf6)`,
  border: 'none', borderRadius: 13, color: '#fff', fontSize: 15, fontWeight: 800,
  cursor: 'pointer', fontFamily: F.display, boxShadow: '0 10px 30px rgba(99,102,241,0.35)',
};

const errBox = {
  background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)',
  borderRadius: 11, padding: '11px 14px', fontSize: 13, color: '#ff6b7a', marginBottom: 16,
};
