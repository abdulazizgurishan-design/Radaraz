import { useState, useEffect } from 'react';
import Radar from '../components/Radar';

const S = {
  root: { minHeight: '100vh', background: '#080c18', fontFamily: 'system-ui', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { background: 'linear-gradient(135deg,rgba(15,20,35,0.98),rgba(20,28,48,0.98))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 24, padding: '40px 32px', maxWidth: 440, width: '100%', textAlign: 'center' },
  title: { fontSize: 24, fontWeight: 900, marginBottom: 4, letterSpacing: 2 },
  titleEn: { fontSize: 13, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, marginBottom: 8, fontStyle: 'italic' },
  accent: { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  subtitleEn: { fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 28 },
  input: { width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: 2 },
  btn: (loading) => ({ width: '100%', padding: 14, background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 1, fontFamily: 'system-ui' }),
  error: { background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ff4757', marginBottom: 12 },
};

// 🔐 بصمة الجهاز — مبنية على خصائص الجهاز الفعلية
async function getDeviceId() {
  try {
    const parts = [
      screen.width + "x" + screen.height,
      screen.colorDepth,
      navigator.hardwareConcurrency || "",
      navigator.platform || "",
      navigator.maxTouchPoints || "",
      new Date().getTimezoneOffset(),
      navigator.language || "",
    ];
    const raw = parts.join("|");
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
    return "dev_" + hash;
  } catch {
    try {
      let id = localStorage.getItem("radar_device_id");
      if (!id) {
        id = "dev_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
        localStorage.setItem("radar_device_id", id);
      }
      return id;
    } catch {
      return "dev_fallback";
    }
  }
}

// شريط الترحيب — يتكيّف حسب نوع الباقة (trial / monthly)
function WelcomeBar({ plan, expiresAt }) {
  const [show, setShow] = useState(true);
  if (!show) return null;

  const isTrial = plan === 'trial';
  // حساب المتبقّي
  let remain = '';
  if (expiresAt) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms > 0) {
      const hrs = Math.floor(ms / 3600000);
      const days = Math.floor(hrs / 24);
      remain = isTrial
        ? (hrs >= 1 ? `متبقّي ${hrs} ساعة` : `متبقّي أقل من ساعة`)
        : (days >= 1 ? `${days} يوم متبقّي` : `ينتهي اليوم`);
    } else {
      remain = 'منتهٍ';
    }
  }

  const bg = isTrial
    ? 'linear-gradient(90deg,rgba(99,102,241,0.18),rgba(139,92,246,0.18))'
    : 'linear-gradient(90deg,rgba(0,212,170,0.14),rgba(52,211,153,0.14))';
  const border = isTrial ? 'rgba(139,92,246,0.35)' : 'rgba(52,211,153,0.35)';
  const accent = isTrial ? '#a5b4fc' : '#34d399';

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 9999,
      background: bg, borderBottom: `1px solid ${border}`,
      backdropFilter: 'blur(10px)',
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      fontFamily: 'system-ui', fontSize: 13, flexWrap: 'wrap',
    }}>
      {isTrial ? (
        <>
          <span style={{ color: '#fff', fontWeight: 700 }}>⏳ تجربة مجانية</span>
          {remain && <span style={{ color: accent, fontSize: 12 }}>· {remain}</span>}
          <a href="/#pricing" style={{
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
            textDecoration: 'none', padding: '5px 14px', borderRadius: 8,
            fontSize: 12, fontWeight: 800, marginRight: 4,
          }}>اشترك الآن 💳</a>
        </>
      ) : (
        <>
          <span style={{ color: accent, fontWeight: 800 }}>⭐ مشترك RadarAZ</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>· اشتراك نشط</span>
          {remain && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>· {remain}</span>}
        </>
      )}
      <button onClick={() => setShow(false)} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
        fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
      }}>×</button>
    </div>
  );
}

export default function App() {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [verified, setVerified] = useState(false);
  const [plan, setPlan] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('radar_key');
    if (saved) verifyKey(saved, true);
  }, []);

  const verifyKey = async (k, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const device = await getDeviceId();
      const res = await fetch(`/api/verify-key?key=${encodeURIComponent(k)}&device=${encodeURIComponent(device)}`);
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem('radar_key', k);
        setPlan(data.plan || null);
        setExpiresAt(data.expires_at || null);
        setVerified(true);
      } else {
        if (!silent) {
          localStorage.removeItem('radar_key');
          if (data.reason === 'expired') {
            setError('انتهت صلاحية المفتاح · Key has expired');
          } else if (data.reason === 'device_mismatch') {
            setError('هذا المفتاح مستخدم على جهاز آخر · This key is active on another device');
          } else {
            setError('المفتاح غير صحيح · Invalid key');
          }
        } else if (data.reason === 'device_mismatch') {
          localStorage.removeItem('radar_key');
          setError('هذا المفتاح مستخدم على جهاز آخر · This key is active on another device');
        }
      }
    } catch {
      if (!silent) setError('خطأ في الاتصال · Connection error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  if (verified) return (
    <>
      <WelcomeBar plan={plan} expiresAt={expiresAt} />
      <Radar />
    </>
  );

  return (
    <div style={S.root}>
      <div style={S.box}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
        <div style={S.title}>أدخل <span style={S.accent}>مفتاحك</span></div>
        <div style={S.titleEn}>Enter Your Access Key</div>
        <p style={S.subtitle}>أدخل مفتاح الوصول الخاص بك للدخول</p>
        <p style={S.subtitleEn}>Enter your access key to continue</p>
        {error && <div style={S.error}>{error}</div>}
        <input
          style={S.input}
          type="text"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && verifyKey(key)}
          dir="ltr"
        />
        <button style={S.btn(loading)} onClick={() => verifyKey(key)} disabled={loading}>
          {loading ? '⟳ جاري التحقق... · Verifying...' : '🔓 دخول · Enter'}
        </button>
        <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          <a href="/trial" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>← جرّب مجاناً · Try for Free</a>
        </div>
      </div>
    </div>
  );
}
