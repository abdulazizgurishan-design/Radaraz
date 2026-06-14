import { useState } from 'react';

const C = {
  bg: '#070b14', panel: 'rgba(17,24,39,0.7)', ink: '#e8edf6', mute: '#8a94a6',
  iris: '#6366f1', violet: '#8b5cf6', mint: '#00d4aa', gold: '#fbbf24',
  line: 'rgba(148,163,184,0.12)',
};
const F = { display: '-apple-system, system-ui, sans-serif', mono: '"SF Mono","Roboto Mono",monospace' };

export default function Dashboard() {
  const [authed, setAuthed] = useState(false);
  const [creds, setCreds] = useState({ email: '', secret_key: '' });
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('stats');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async () => {
    if (!creds.email.includes('@') || !creds.secret_key) {
      setError('اكتب إيميلك ومفتاحك');
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/affiliate-dashboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const d = await res.json();
      if (d.success) { setData(d); setAuthed(true); }
      else setError(d.message || 'تعذّر الدخول');
    } catch { setError('خطأ في الاتصال'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: F.display, direction: 'rtl' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.4,
        backgroundImage: `linear-gradient(${C.line} 1px,transparent 1px),linear-gradient(90deg,${C.line} 1px,transparent 1px)`,
        backgroundSize: '48px 48px' }} />
      <div style={{ position: 'relative', maxWidth: 540, margin: '0 auto', padding: '0 20px 80px' }}>
        {!authed ? (
          <Login creds={creds} setCreds={setCreds} loading={loading} error={error} onLogin={login} />
        ) : (
          <Panel data={data} tab={tab} setTab={setTab} creds={creds} setData={setData} />
        )}
      </div>
      <style>{`* { box-sizing: border-box; } input::placeholder { color: rgba(138,148,166,0.5); }`}</style>
    </div>
  );
}

function Login({ creds, setCreds, loading, error, onLogin }) {
  return (
    <div style={{ paddingTop: 80, maxWidth: 400, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px' }}>لوحة الشريك</h1>
        <p style={{ fontSize: 13, color: C.mute, margin: 0 }}>ادخل بإيميلك ومفتاحك</p>
      </div>
      {error && <div style={errBox}>{error}</div>}
      <Field label="الإيميل" value={creds.email} onChange={v => setCreds(c => ({ ...c, email: v }))} placeholder="you@email.com" dir="ltr" />
      <Field label="مفتاح الدخول (5 أرقام)" value={creds.secret_key} onChange={v => setCreds(c => ({ ...c, secret_key: v }))} placeholder="12345" dir="ltr" mono />
      <button onClick={onLogin} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}>
        {loading ? '⟳ جاري الدخول...' : 'دخول'}
      </button>
      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <a href="/partner" style={{ color: C.mute, fontSize: 12, textDecoration: 'none' }}>← لست شريكاً بعد؟ سجّل</a>
      </div>
    </div>
  );
}

function Panel({ data, tab, setTab, creds, setData }) {
  const { affiliate, stats, subscribers } = data;
  return (
    <div style={{ paddingTop: 40 }}>
      <div style={{ marginBottom: 4, fontSize: 13, color: C.mute }}>أهلاً</div>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>{affiliate.name}</h1>
      <div style={{ fontFamily: F.mono, fontSize: 14, color: C.mint, marginBottom: 22 }}>{affiliate.code}</div>

      {/* تبويبات */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {[['stats', '📊 إنجازاتي'], ['payout', '💳 طريقة الدفع']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: 11, borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: F.display, border: 'none',
            background: tab === id ? `linear-gradient(135deg,${C.iris},${C.violet})` : 'rgba(255,255,255,0.04)',
            color: tab === id ? '#fff' : C.mute,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'stats' && <Stats stats={stats} subscribers={subscribers} />}
      {tab === 'payout' && <Payout affiliate={affiliate} creds={creds} data={data} setData={setData} />}
    </div>
  );
}

function Stats({ stats, subscribers }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          [stats.activeCount, 'مشترك نشط', C.mint],
          [`$${stats.commission}`, 'عمولة الشهر', C.violet],
          [stats.newThisMonth, 'جدد الشهر', C.gold],
        ].map(([v, l, col]) => (
          <div key={l} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 6px', textAlign: 'center' }}>
            <div style={{ fontFamily: F.mono, fontSize: 22, fontWeight: 900, color: col }}>{v}</div>
            <div style={{ fontSize: 9.5, color: C.mute, marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)',
        borderRadius: 12, padding: '13px 16px', fontSize: 12, color: C.mute, marginBottom: 20, lineHeight: 1.6 }}>
        عمولتك = المشتركون النشطون × $4 شهرياً · تُدفع نهاية كل شهر بـ USDT
      </div>

      <div style={{ fontSize: 12, color: C.mute, marginBottom: 10 }}>
        المشتركون عبر كودك {subscribers.length > 0 && `(${subscribers.length})`}
      </div>
      {subscribers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.mute, fontSize: 13,
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14 }}>
          لا مشتركين بعد — ابدأ التسويق بكودك واملأ لوحتك 🚀
        </div>
      ) : (
        subscribers.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 14px', marginBottom: 6, fontSize: 12.5 }}>
            <span>مشترك #{s.idx}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.mute }}>
              <span style={{ fontFamily: F.mono, fontSize: 11 }} dir="ltr">{s.date ? new Date(s.date).toLocaleDateString('ar-SA') : ''}</span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8,
                background: s.active ? 'rgba(0,212,170,0.15)' : 'rgba(138,148,166,0.12)',
                color: s.active ? C.mint : C.mute }}>{s.active ? 'نشط' : 'منتهٍ'}</span>
            </span>
          </div>
        ))
      )}
    </>
  );
}

function Payout({ affiliate, creds, data, setData }) {
  const [method, setMethod] = useState(affiliate.payout_method || 'USDT');
  const [address, setAddress] = useState(affiliate.payout_address || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!address.trim()) return;
    setSaving(true); setSaved(false);
    try {
      const res = await fetch('/api/affiliate-dashboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...creds, action: 'save_payout', payout_method: method, payout_address: address.trim() }),
      });
      const d = await res.json();
      if (d.success) {
        setSaved(true);
        setData({ ...data, affiliate: { ...affiliate, payout_method: method, payout_address: address.trim() } });
        setTimeout(() => setSaved(false), 2200);
      }
    } finally { setSaving(false); }
  };

  return (
    <>
      <div style={{ fontSize: 13, color: C.mute, marginBottom: 16 }}>كيف تستلم عمولتك؟</div>

      {/* USDT */}
      <button onClick={() => setMethod('USDT')} style={payOpt(method === 'USDT', C.mint)}>
        <span style={{ fontSize: 20 }}>🪙</span>
        <div style={{ textAlign: 'right', flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>USDT — مُفضّل</div>
          <div style={{ fontSize: 10.5, color: C.mute }}>شبكة TRC20 · سريع ورسوم منخفضة</div>
        </div>
        {method === 'USDT' && <span style={{ color: C.mint }}>✓</span>}
      </button>

      {/* PayPal */}
      <button onClick={() => setMethod('PayPal')} style={payOpt(method === 'PayPal', C.iris)}>
        <span style={{ fontSize: 20 }}>🌐</span>
        <div style={{ textAlign: 'right', flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>PayPal — بديل</div>
          <div style={{ fontSize: 10.5, color: C.mute }}>للمسوّقين خارج نطاق USDT</div>
        </div>
        {method === 'PayPal' && <span style={{ color: C.iris }}>✓</span>}
      </button>

      <div style={{ marginTop: 16 }}>
        <label style={{ fontSize: 12, color: C.mute, display: 'block', marginBottom: 6 }}>
          {method === 'USDT' ? 'عنوان محفظة USDT (TRC20)' : 'إيميل PayPal'}
        </label>
        <input value={address} onChange={e => setAddress(e.target.value)} dir="ltr"
          placeholder={method === 'USDT' ? 'TXxxxxxxxxxxxxxxxxxxxxxxx' : 'you@email.com'}
          style={{ width: '100%', padding: '13px 15px', background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${C.line}`, borderRadius: 12, color: C.ink, fontSize: 14,
            outline: 'none', fontFamily: F.mono }} />
      </div>

      <button onClick={save} disabled={saving || !address.trim()}
        style={{ ...btnPrimary, opacity: (saving || !address.trim()) ? 0.5 : 1 }}>
        {saving ? '⟳ جاري الحفظ...' : saved ? '✓ تم الحفظ' : 'حفظ طريقة الدفع'}
      </button>

      {method === 'USDT' && (
        <div style={{ marginTop: 14, fontSize: 11, color: C.mute, textAlign: 'center', lineHeight: 1.6 }}>
          ⚠️ تأكّد أن العنوان على شبكة TRC20 — إرسال على شبكة خاطئة يفقد المبلغ
        </div>
      )}
    </>
  );
}

// ─── مكوّنات ───
function Field({ label, value, onChange, placeholder, dir = 'rtl', mono }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, color: C.mute, display: 'block', marginBottom: 6 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} dir={dir}
        style={{ width: '100%', padding: '13px 15px', background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${C.line}`, borderRadius: 12, color: C.ink, fontSize: 14.5,
          outline: 'none', fontFamily: (dir === 'ltr' || mono) ? F.mono : F.display }} />
    </div>
  );
}

const payOpt = (active, col) => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
  background: active ? `${col}11` : 'rgba(255,255,255,0.03)',
  border: `1px solid ${active ? col + '55' : C.line}`,
  borderRadius: 12, padding: 14, marginBottom: 8, cursor: 'pointer',
  color: '#e8edf6', fontFamily: F.display,
});

const btnPrimary = {
  width: '100%', marginTop: 24, padding: 15,
  background: `linear-gradient(135deg,#6366f1,#8b5cf6)`,
  border: 'none', borderRadius: 13, color: '#fff', fontSize: 15, fontWeight: 800,
  cursor: 'pointer', fontFamily: F.display, boxShadow: '0 10px 30px rgba(99,102,241,0.35)',
};

const errBox = {
  background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)',
  borderRadius: 11, padding: '11px 14px', fontSize: 13, color: '#ff6b7a', marginBottom: 16,
};
