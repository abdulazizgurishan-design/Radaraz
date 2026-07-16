// components/SignalCard.js
import { useState } from 'react';

const gradeConfig = {
  ELITE: { color: '#00d4aa', bg: 'rgba(0,212,170,0.15)', label: '🏆 ELITE' },
  PRIME: { color: '#34d399', bg: 'rgba(52,211,153,0.15)', label: '⭐ PRIME' },
  STRONG: { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', label: '💪 STRONG' },
  GOOD: { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', label: '📊 GOOD' },
  WATCH: { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', label: '👀 WATCH' },
  AVOID: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: '❌ AVOID' },
};

const riskConfig = {
  low: { color: '#22c55e', label: '🟢 منخفضة' },
  medium: { color: '#fbbf24', label: '🟡 متوسطة' },
  high: { color: '#ef4444', label: '🔴 مرتفعة' },
};

export default function SignalCard({ signal, onExpand }) {
  const [expanded, setExpanded] = useState(false);

  const {
    symbol,
    price,
    change_pct,
    decision = {},
    features = {},
    explanation = {},
    brains = {},
  } = signal;

  const grade = decision.grade || 'WATCH';
  const gradeInfo = gradeConfig[grade] || gradeConfig.WATCH;
  const confidence = decision.confidence || 0;
  const riskScore = decision.riskScore || 50;
  const riskLevel = riskScore >= 70 ? 'low' : riskScore >= 50 ? 'medium' : 'high';
  const riskInfo = riskConfig[riskLevel];

  const toggleExpand = () => {
    setExpanded(!expanded);
    if (onExpand) onExpand(signal);
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(15,20,35,0.95), rgba(20,28,48,0.95))',
        border: `1px solid ${gradeInfo.color}44`,
        borderRadius: '16px',
        padding: '16px 18px',
        marginBottom: '10px',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
      onClick={toggleExpand}
    >
      {/* السطر الأول: الرمز والسعر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
            {symbol}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 12px',
              borderRadius: '20px',
              background: gradeInfo.bg,
              color: gradeInfo.color,
              border: `1px solid ${gradeInfo.color}55`,
            }}
          >
            {gradeInfo.label}
          </span>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
            {decision.regime === 'strong' ? '📈 سوق قوي' : '📉 سوق ضعيف'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
            ${price?.toFixed(2)}
          </span>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: change_pct >= 0 ? '#22c55e' : '#ef4444',
            }}
          >
            {change_pct >= 0 ? '▲' : '▼'} {Math.abs(change_pct)}%
          </span>
        </div>
      </div>

      {/* السطر الثاني: Confidence + Risk */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          marginTop: '10px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* شريط Confidence */}
        <div style={{ flex: 1, minWidth: '120px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            <span>الثقة</span>
            <span>{Math.round(confidence)}%</span>
          </div>
          <div
            style={{
              height: '4px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginTop: '2px',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${confidence}%`,
                background: confidence >= 80 ? '#34d399' : confidence >= 60 ? '#fbbf24' : '#ef4444',
                borderRadius: '4px',
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>

        {/* Risk */}
        <span style={{ fontSize: '12px', color: riskInfo.color }}>
          {riskInfo.label}
        </span>

        {/* Score */}
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
          السكور: {decision.score || 0}
        </span>
      </div>

      {/* السطر الثالث: ملخص القرار (Explain) */}
      {explanation?.summary && (
        <div
          style={{
            marginTop: '10px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: '1.5',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {explanation.summary}
        </div>
      )}

      {/* السطر الرابع: أهداف سريعة (T1, T2, T3) */}
      {signal.targets && (
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginTop: '10px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          <span>🎯 T1: ${signal.targets.t1?.toFixed(2)}</span>
          <span>🎯 T2: ${signal.targets.t2?.toFixed(2)}</span>
          <span>🎯 T3: ${signal.targets.t3?.toFixed(2)}</span>
          <span>🛑 وقف: ${signal.targets.stop?.toFixed(2)}</span>
          <span>📊 RR: {signal.targets.rr?.toFixed(1)}</span>
        </div>
      )}

      {/* السطر الخامس: زر التوسيع */}
      <div
        style={{
          marginTop: '10px',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.25)',
          textAlign: 'center',
        }}
      >
        {expanded ? '▲ إخفاء التفاصيل' : '▼ اضغط لعرض التفاصيل'}
      </div>
    </div>
  );
}
