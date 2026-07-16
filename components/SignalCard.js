// components/SignalCard.js — بطاقة محسّنة مع عرض التوقيت والثقة
import { useState } from 'react';
import { getGradeConfig, getTimingConfig } from '../lib/radar/core/config';

export default function SignalCard({ signal, onExpand }) {
  const [expanded, setExpanded] = useState(false);

  const {
    symbol,
    price,
    change_pct,
    predictionScore,
    predictionGrade,
    timing,
    confidence,
    explanation = {},
    levels = {},
  } = signal;

  const gradeInfo = getGradeConfig(predictionGrade);
  const timingInfo = getTimingConfig(timing?.timing);

  const isUp = change_pct >= 0;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(15,20,35,0.95), rgba(20,28,48,0.95))',
        border: `1px solid ${gradeInfo?.color || 'rgba(255,255,255,0.06)'}44`,
        borderRadius: '16px',
        padding: '16px 18px',
        marginBottom: '10px',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* السطر الأول: الرمز + التصنيف + السعر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
            {symbol}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 12px',
              borderRadius: '20px',
              background: gradeInfo?.bg || 'rgba(255,255,255,0.05)',
              color: gradeInfo?.color || 'rgba(255,255,255,0.6)',
              border: `1px solid ${gradeInfo?.color || 'rgba(255,255,255,0.1)'}55`,
            }}
          >
            {gradeInfo?.label || predictionGrade || 'مراقبة'}
          </span>
          {timingInfo && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 10px',
                borderRadius: '12px',
                background: timingInfo.bg || 'rgba(255,255,255,0.05)',
                color: timingInfo.color || 'rgba(255,255,255,0.5)',
                border: `1px solid ${timingInfo.color || 'rgba(255,255,255,0.1)'}33`,
              }}
            >
              {timingInfo.icon} {timingInfo.label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
            ${price?.toFixed(2)}
          </span>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: isUp ? '#22c55e' : '#ef4444',
            }}
          >
            {isUp ? '▲' : '▼'} {Math.abs(change_pct)}%
          </span>
        </div>
      </div>

      {/* السطر الثاني: الثقة + النقاط */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '100px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            <span>الثقة</span>
            <span>{Math.round(confidence || predictionScore || 0)}%</span>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginTop: '2px' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.round(confidence || predictionScore || 0)}%`,
                background: (confidence || predictionScore || 0) >= 80 ? '#34d399' : (confidence || predictionScore || 0) >= 60 ? '#fbbf24' : '#ef4444',
                borderRadius: '4px',
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
          النقاط: {Math.round(predictionScore || 0)}
        </span>
      </div>

      {/* السطر الثالث: ملخص القرار */}
      {explanation?.summary && (
        <div
          style={{
            marginTop: '10px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: '1.5',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          📋 {explanation.summary}
        </div>
      )}

      {/* السطر الرابع: الأهداف (تظهر عند التوسيع) */}
      {expanded && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', flexWrap: 'wrap' }}>
            <span>🎯 T1: ${levels.t1?.toFixed(2) || '—'}</span>
            <span>🎯 T2: ${levels.t2?.toFixed(2) || '—'}</span>
            <span>🎯 T3: ${levels.t3?.toFixed(2) || '—'}</span>
            <span>🛑 وقف: ${levels.stop?.toFixed(2) || '—'}</span>
            <span>📊 RR: {levels.rr?.toFixed(1) || '—'}</span>
          </div>
          {signal.breakdown && signal.breakdown.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginBottom: '4px' }}>
                تفاصيل التقييم:
              </div>
              {signal.breakdown.slice(0, 4).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.3)', padding: '2px 0' }}>
                  <span>{item.factor || item.name}</span>
                  <span>{Math.round(item.score || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* زر التوسيع */}
      <div
        style={{
          marginTop: '10px',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.15)',
          textAlign: 'center',
        }}
      >
        {expanded ? '▲ إخفاء التفاصيل' : '▼ اضغط لعرض التفاصيل'}
      </div>
    </div>
  );
}

// دوال مساعدة (يمكن نقلها إلى config.js)
function getGradeConfig(grade) {
  const map = {
    ELITE: { label: '🏆 نخبة', color: '#00d4aa', bg: 'rgba(0,212,170,0.15)' },
    PRIME: { label: '⭐ ممتاز', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
    STRONG: { label: '💪 قوي', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
    GOOD: { label: '📊 جيد', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
    WATCH: { label: '👀 مراقبة', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
    AVOID: { label: '❌ تجنب', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  };
  return map[grade] || map.WATCH;
}

function getTimingConfig(timing) {
  const map = {
    PRE_BREAKOUT: { label: 'قبل الاختراق', icon: '⚡', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
    BREAKOUT: { label: 'اختراق', icon: '🚀', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
    EARLY_MOMENTUM: { label: 'زخم مبكر', icon: '📈', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
    WAIT: { label: 'مراقبة', icon: '⏳', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
    LATE: { label: 'متأخر', icon: '⚠️', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  };
  return map[timing] || null;
}
