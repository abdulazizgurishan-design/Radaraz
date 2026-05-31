import { useState } from 'react';

const S = {
  root: { minHeight: '100vh', background: '#080c18', fontFamily: 'system-ui', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' },
  bgCircle: { position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, background: 'radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)', borderRadius: '50%', pointerEvents: 'none' },
  bgGrid: { position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)', backgroundSize: '50px 50px', pointerEvents: 'none' },
  box: { background: 'linear-gradient(135deg,rgba(15,20,35,0.98),rgba(20,28,48,0.98))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 24, padding: '40px 32px', maxWidth: 440, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', textAlign: 'center', position: 'relative', zIndex: 1 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 900, letterSpacing: 2, marginBottom: 4 },
  titleEn: { fontSize: 13, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, marginBottom: 8, fontStyle: 'italic' },
  accent: { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 32, lineHeight: 1.7 },
  input: { width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'system-ui' },
  btn: (loading) => ({ width: '100%', padding: 14, background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 1, transition: 'all 0.2s', boxShadow: loading ? 'none' : '0 8px 24px rgba(99,102,241,0.4)', fontFamily: 'system-ui' }),
  keyBtn: { width: '100%', padding: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', letterSpacing: 1, transition: 'all 0.2s', boxShadow: '0 8px 24px rgba(99,102,241,0.4)', fontFamily: 'system-ui', marginTop: 10 },
  divider: { display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0', color: 'rgba(255,255,255,0.15)', fontSize: 11 },
  dividerLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' },
  error: { background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ff4757', marginBottom: 12 },
  success: { background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 14, padding: '24px 20px', marginTop: 8 },
  keyBox: { background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '14px', margin: '16px 0', fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 3, color: '#a5b4fc', wordBreak: 'break-all' },
  copyBtn: { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, padding: '8px 16px', color: '#a5b4fc', fontSize: 12, cursor: 'pointer', fontFamily: 'system-ui', marginBottom: 16 },
  goBtn: { width: '100%', padding: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', letterSpacing: 1, fontFamily: 'system-ui', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' },
  backLink: { marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.3)' },
};

export default function Trial() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('أدخل إيميل صحيح · Enter a valid email');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.error === 'used') {
        setError('هذا الإيميل استخدم التجربة مسبقاً · Email already used');
      } else if (data.success) {
        setStep(2);
      } else {
        setError('حدث خطأ — حاول مجدداً · Error, please retry');
      }
    } catch {
      setError('خطأ في الاتصال · Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim() || code.length < 4) {
      setError('أدخل الكود الصحيح · Enter the correct code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (data.error === 'invalid_code') {
        setError('الكود غير صحيح · Invalid code');
      } else if (data.error === 'expired') {
        setError('انتهت صلاحية الكود · Code expired');
        setStep(1);
      } else if (data.success) {
        setResult(data);
      } else {
        setError('حدث خطأ — حاول مجدداً · Error, please retry');
      }
    } catch {
      setError('خطأ في الاتصال · Connection error');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(result.access_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={S.root}>
      <div style={S.bgCircle} />
      <div style={S.bgGrid} />
      <div style={S.box}>
        {!result ? (
          <>
            <div style={S.icon}>{step === 1 ? '🎁' : '📧'}</div>
            <div style={S.title}>
              {step === 1 ? <>جرّب <span style={S.accent}>مجاناً</span></> : <>تحقق من <span style={S.accent}>إيميلك</span></>}
            </div>
            <div style={S.titleEn}>
              {step === 1 ? 'Try for Free · 24 Hours' : 'Verify Your Email'}
            </div>
            <p style={S.subtitle}>
              {step === 1 ? (
                <>
                  أدخل إيميلك واحصل على كود تحقق
                  <br />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Enter your email to get a verification code</span>
                  <br />
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>بدون بطاقة ائتمان · No Credit Card Required</span>
                </>
              ) : (
                <>
                  أرسلنا كود مكون من 6 أرقام إلى
                  <br />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>We sent a 6-digit code to</span>
                  <br />
                  <span style={{ color: '#a5b4fc', fontSize: 13 }}>{email}</span>
                </>
              )}
            </p>

            {error && <div style={S.error}>{error}</div>}

            {step === 1 ? (
              <>
                <input
                  style={S.input}
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                  dir="ltr"
                />
                <button style={S.btn(loading)} onClick={handleSendCode} disabled={loading}>
                  {loading ? '⟳ جاري الإرسال... · Sending...' : '📨 أرسل كود التحقق · Send Code'}
                </button>

                {/* زر المشتركين */}
                <div style={S.divider}>
                  <span style={S.dividerLine} />
                  <span>مشترك؟ · Subscriber?</span>
                  <span style={S.dividerLine} />
                </div>
                <button style={S.keyBtn} onClick={() => window.location.href = 'https://radaraz.com/app'}>
                  🔑 عندك مفتاح؟ ادخل الرادار · Have a Key? Enter Radar
                </button>
              </>
            ) : (
              <>
                <input
                  style={S.input}
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                  maxLength={6}
                  dir="ltr"
                />
                <button style={S.btn(loading)} onClick={handleVerifyCode} disabled={loading}>
                  {loading ? '⟳ جاري التحقق... · Verifying...' : '🔓 تحقق واحصل على مفتاحك · Verify & Get Key'}
                </button>
                <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }} onClick={() => { setStep(1); setError(null); }}>
                  ← تغيير الإيميل · Change Email
                </div>
              </>
            )}

            <div style={S.backLink}>
              <a href="/" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>← العودة للرئيسية · Back to Home</a>
            </div>
          </>
        ) : (
          <div style={S.success}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#00d4aa' }}>مفتاحك جاهز!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Your key is ready!</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
              صالح لمدة 24 ساعة · Valid for 24 hours
            </div>
            <div style={S.keyBox}>{result.access_key}</div>
            <button style={S.copyBtn} onClick={copyKey}>
              {copied ? '✓ تم النسخ! · Copied!' : '📋 انسخ المفتاح · Copy Key'}
            </button>
            <button style={S.goBtn} onClick={() => window.location.href = '/app'}>
              🔓 ادخل الرادار الآن · Enter Radar Now
            </button>
            <div style={{ marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
              احفظ المفتاح — لن يُرسل مجدداً · Save your key — it won't be sent again
            </div>
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.25); }
        button:hover:not(:disabled) { filter: brightness(1.1); }
      `}</style>
    </div>
  );
}
