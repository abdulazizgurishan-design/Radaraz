// components/Radar.js — الواجهة الاحترافية النهائية
import { useState, useEffect, useCallback } from 'react';

// ─── التصنيفات بالعربي ──────────────────────────────
const GRADE_CONFIG = {
  ELITE: { label: '🏆 نخبة', color: '#00d4aa', bg: 'rgba(0,212,170,0.15)' },
  PRIME: { label: '⭐ ممتاز', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  STRONG: { label: '💪 قوي', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  GOOD: { label: '📊 جيد', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  WATCH: { label: '👀 مراقبة', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  AVOID: { label: '❌ تجنب', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

const RISK_CONFIG = {
  low: { label: '🟢 منخفضة', color: '#22c55e' },
  medium: { label: '🟡 متوسطة', color: '#fbbf24' },
  high: { label: '🔴 مرتفعة', color: '#ef4444' },
};

// ─── الأنماط ──────────────────────────────────────────
const styles = {
  root: {
    minHeight: '100vh',
    background: '#080c18',
    fontFamily: 'system-ui',
    color: '#fff',
    padding: '20px 16px 40px',
  },
  container: {
    maxWidth: 920,
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: 2,
    margin: 0,
  },
  accent: {
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 4,
  },
  statsRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  statBox: (bg, border) => ({
    flex: 1,
    minWidth: 70,
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 14,
    padding: '12px 10px',
    textAlign: 'center',
  }),
  statNum: (color) => ({
    fontSize: 24,
    fontWeight: 900,
    color,
    fontFamily: 'monospace',
    lineHeight: 1,
  }),
  statLabel: (color) => ({
    fontSize: 9,
    color,
    opacity: 0.7,
    marginTop: 4,
  }),
  refreshBtn: {
    padding: '8px 24px',
    background: 'rgba(99,102,241,0.15)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 10,
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  card: {
    background: 'linear-gradient(135deg, rgba(15,20,35,0.95), rgba(20,28,48,0.95))',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: '16px 18px',
    marginBottom: 12,
    transition: 'all 0.2s ease',
  },
  cardSymbol: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
    fontFamily: 'monospace',
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
    fontFamily: 'monospace',
  },
  cardChange: (isUp) => ({
    fontSize: 14,
    fontWeight: 600,
    color: isUp ? '#22c55e' : '#ef4444',
  }),
  badge: (color, bg) => ({
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 12px',
    borderRadius: 20,
    background: bg,
    color: color,
    border: `1px solid ${color}55`,
  }),
  confidenceBar: {
    height: 4,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 2,
  },
  confidenceFill: (pct) => ({
    height: '100%',
    width: `${pct}%`,
    background: pct >= 80 ? '#34d399' : pct >= 60 ? '#fbbf24' : '#ef4444',
    borderRadius: 4,
    transition: 'width 0.6s ease',
  }),
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    color: 'rgba(255,255,255,0.25)',
    fontSize: 15,
  },
  footer: {
    marginTop: 40,
    paddingTop: 16,
    borderTop: '1px solid rgba(255,255,255,0.04)',
    textAlign: 'center',
    fontSize: 10,
    color: 'rgba(255,255,255,0.15)',
    letterSpacing: 2,
  },
};

// ─── المكون الرئيسي ──────────────────────────────────
export default function Radar() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scan');
      const data = await res.json();
      if (data.success) {
        setSignals(data.results || []);
        setLastUpdate(new Date());
      } else {
        setError(data.error || 'خطأ في جلب البيانات');
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 60000);
    return () => clearInterval(interval);
  }, [fetchSignals]);

  // ─── عدادات التصنيفات ─────────────────────────────
  const counts = {
    total: signals.length,
    elite: signals.filter(s => s.decision?.grade === 'ELITE').length,
    prime: signals.filter(s => s.decision?.grade === 'PRIME').length,
    strong: signals.filter(s => s.decision?.grade === 'STRONG').length,
    good: signals.filter(s => s.decision?.grade === 'GOOD').length,
  };

  // ─── دالة التصنيف بالعربي ──────────────────────────
  const getGrade = (grade) => {
    return GRADE_CONFIG[grade] || GRADE_CONFIG.WATCH;
  };

  // ─── دالة المخاطرة بالعربي ─────────────────────────
  const getRisk = (score) => {
    if (score >= 70) return RISK_CONFIG.low;
    if (score >= 50) return RISK_CONFIG.medium;
    return RISK_CONFIG.high;
  };

  // ─── التحميل ────────────────────────────────────────
  if (loading && signals.length === 0) {
    return (
      <div style={styles.root}>
        <div style={styles.container}>
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
            ⟳ جاري تحميل الإشارات...
          </div>
        </div>
      </div>
    );
  }

  // ─── الخطأ ──────────────────────────────────────────
  if (error) {
    return (
      <div style={styles.root}>
        <div style={styles.container}>
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#ff6b6b' }}>
            ❌ {error}
          </div>
        </div>
      </div>
    );
  }

  // ─── التصيير الرئيسي ──────────────────────────────
  return (
    <div style={styles.root}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>
            📡 RADAR <span style={styles.accent}>AZ</span>
          </h1>
          <p style={styles.subtitle}>محرك القرار الذكي · تحليل متعدد الأبعاد</p>
          {lastUpdate && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>
              آخر تحديث: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button style={styles.refreshBtn} onClick={fetchSignals} disabled={loading}>
              {loading ? '⟳ جاري التحديث...' : '🔄 تحديث'}
            </button>
          </div>
        </div>

        {/* الإحصائيات */}
        <div style={styles.statsRow}>
          {[
            { key: 'total', label: 'الإجمالي', value: counts.total, color: '#6366f1' },
            { key: 'elite', label: '🏆 نخبة', value: counts.elite, color: '#00d4aa' },
            { key: 'prime', label: '⭐ ممتاز', value: counts.prime, color: '#34d399' },
            { key: 'strong', label: '💪 قوي', value: counts.strong, color: '#60a5fa' },
            { key: 'good', label: '📊 جيد', value: counts.good, color: '#fbbf24' },
          ].map(stat => (
            <div key={stat.key} style={styles.statBox('rgba(255,255,255,0.02)', 'rgba(255,255,255,0.06)')}>
              <div style={styles.statNum(stat.color)}>{stat.value}</div>
              <div style={styles.statLabel(stat.color)}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* قائمة الإشارات */}
        {signals.length === 0 ? (
          <div style={styles.empty}>
            {loading ? '⟳ جاري التحميل...' : 'لا توجد إشارات حالياً'}
          </div>
        ) : (
          signals.map((s, idx) => {
            const grade = getGrade(s.decision?.grade);
            const risk = getRisk(s.decision?.riskScore || 50);
            const isUp = s.change_pct >= 0;
            const confidence = s.decision?.confidence || 0;

            return (
              <div key={s.symbol + idx} style={styles.card}>
                {/* السطر الأول: الرمز + التصنيف + السعر */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={styles.cardSymbol}>{s.symbol}</span>
                    <span style={styles.badge(grade.color, grade.bg)}>{grade.label}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                      {s.decision?.regime === 'strong' ? '📈 سوق قوي' : '📉 سوق ضعيف'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={styles.cardPrice}>${s.price?.toFixed(2)}</span>
                    <span style={styles.cardChange(isUp)}>
                      {isUp ? '▲' : '▼'} {Math.abs(s.change_pct)}%
                    </span>
                  </div>
                </div>

                {/* السطر الثاني: الثقة + المخاطرة */}
                <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      <span>الثقة</span>
                      <span>{Math.round(confidence)}%</span>
                    </div>
                    <div style={styles.confidenceBar}>
                      <div style={styles.confidenceFill(confidence)} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: risk.color }}>المخاطرة: {risk.label}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>النقاط: {s.decision?.score || 0}</span>
                </div>

                {/* السطر الثالث: شرح القرار */}
                {s.explanation?.summary && (
                  <div style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.5)',
                    lineHeight: 1.5,
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    📋 {s.explanation.summary}
                  </div>
                )}

                {/* السطر الرابع: الأهداف */}
                {s.targets && (
                  <div style={{
                    display: 'flex',
                    gap: 14,
                    marginTop: 10,
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.3)',
                    flexWrap: 'wrap',
                  }}>
                    <span>🎯 T1: ${s.targets.t1?.toFixed(2) || '—'}</span>
                    <span>🎯 T2: ${s.targets.t2?.toFixed(2) || '—'}</span>
                    <span>🎯 T3: ${s.targets.t3?.toFixed(2) || '—'}</span>
                    <span>🛑 وقف: ${s.targets.stop?.toFixed(2) || '—'}</span>
                    <span>📊 RR: {s.targets.rr?.toFixed(1) || '—'}</span>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Footer */}
        <div style={styles.footer}>RADAR AZ PRO · ليست نصيحة استثمارية</div>
      </div>
    </div>
  );
}
