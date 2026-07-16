// components/Radar.js — النسخة العربية مع التعديلات الجديدة
import { useState, useEffect, useCallback } from 'react';

export default function Radar() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scan');
      const data = await res.json();
      if (data.success) {
        setSignals(data.results || []);
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
  }, [fetchSignals]);

  // دالة لترجمة التصنيف
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

  if (loading) {
    return <div style={{ padding: 40, color: '#fff', textAlign: 'center' }}>جاري تحميل الإشارات...</div>;
  }

  if (error) {
    return <div style={{ padding: 40, color: '#ff6b6b', textAlign: 'center' }}>❌ {error}</div>;
  }

  return (
    <div style={{ padding: 20, color: '#fff', maxWidth: 920, margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center' }}>📡 RADAR <span style={{ color: '#8b5cf6' }}>AZ</span></h1>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>محرك القرار الذكي · تحليل متعدد الأبعاد</p>
      
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <button onClick={fetchSignals} style={{
          padding: '8px 20px',
          background: 'rgba(99,102,241,0.15)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 10,
          color: '#a5b4fc',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          🔄 تحديث
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 80, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#6366f1' }}>{signals.length}</div>
          <div style={{ fontSize: 9, color: '#6366f1', opacity: 0.7 }}>الإجمالي</div>
        </div>
        {[
          { key: 'ELITE', label: '🏆 نخبة', color: '#00d4aa' },
          { key: 'PRIME', label: '⭐ ممتاز', color: '#34d399' },
          { key: 'STRONG', label: '💪 قوي', color: '#60a5fa' },
          { key: 'GOOD', label: '📊 جيد', color: '#fbbf24' },
        ].map(stat => {
          const count = signals.filter(s => s.decision?.grade === stat.key).length;
          return (
            <div key={stat.key} style={{ flex: 1, minWidth: 80, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: stat.color }}>{count}</div>
              <div style={{ fontSize: 9, color: stat.color, opacity: 0.7 }}>{stat.label}</div>
            </div>
          );
        })}
      </div>

      {signals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
          لا توجد إشارات حالياً
        </div>
      ) : (
        signals.map(s => (
          <div key={s.symbol} style={{
            background: 'linear-gradient(135deg, rgba(15,20,35,0.95), rgba(20,28,48,0.95))',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '16px 18px',
            marginBottom: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{s.symbol}</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 12px',
                  borderRadius: '20px',
                  background: 'rgba(99,102,241,0.15)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}>
                  {getGradeLabel(s.decision?.grade)}
                </span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                  {s.decision?.regime === 'strong' ? '📈 سوق قوي' : '📉 سوق ضعيف'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>${s.price?.toFixed(2)}</span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: s.change_pct >= 0 ? '#22c55e' : '#ef4444',
                }}>
                  {s.change_pct >= 0 ? '▲' : '▼'} {Math.abs(s.change_pct)}%
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                  <span>الثقة</span>
                  <span>{Math.round(s.decision?.confidence || 0)}%</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginTop: '2px' }}>
                  <div style={{
                    height: '100%',
                    width: `${s.decision?.confidence || 0}%`,
                    background: (s.decision?.confidence || 0) >= 80 ? '#34d399' : (s.decision?.confidence || 0) >= 60 ? '#fbbf24' : '#ef4444',
                    borderRadius: '4px',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>النقاط: {s.decision?.score || 0}</span>
            </div>

            {s.explanation?.summary && (
              <div style={{
                marginTop: '10px',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.6)',
                lineHeight: '1.5',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                📋 {s.explanation.summary}
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', flexWrap: 'wrap' }}>
              <span>🎯 الهدف 1: ${s.targets?.t1?.toFixed(2) || '—'}</span>
              <span>🎯 الهدف 2: ${s.targets?.t2?.toFixed(2) || '—'}</span>
              <span>🎯 الهدف 3: ${s.targets?.t3?.toFixed(2) || '—'}</span>
              <span>🛑 وقف: ${s.targets?.stop?.toFixed(2) || '—'}</span>
              <span>📊 RR: {s.targets?.rr?.toFixed(1) || '—'}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
