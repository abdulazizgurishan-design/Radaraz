// components/DetailModal.js
import { useState } from 'react';

export default function DetailModal({ signal, onClose }) {
  if (!signal) return null;

  const { symbol, price, decision = {}, brains = {}, features = {}, explanation = {} } = signal;

  // ترتيب الـ Brains حسب الأهمية
  const brainOrder = [
    'Market Brain',
    'Liquidity Brain',
    'Momentum Brain',
    'Trend Brain',
    'Structure Brain',
    'DNA Brain',
    'Sector Brain',
    'RelativeStrength Brain',
    'Risk Brain',
    'Portfolio Brain',
    'Contradiction Brain',
    'Consensus Brain',
  ];

  const sortedBrains = brainOrder
    .filter(name => brains[name])
    .map(name => ({ name, ...brains[name] }));

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0f1e, #141c30)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '20px',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '24px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* رأس النافذة */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', margin: 0 }}>
              {symbol}
            </h2>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
              ${price?.toFixed(2)} · تغير {decision.change_pct?.toFixed(2)}%
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '24px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* القرار النهائي */}
        <div
          style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>التصنيف</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#a5b4fc' }}>
                {decision.grade || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>الثقة</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#34d399' }}>
                {Math.round(decision.confidence || 0)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>السكور</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24' }}>
                {decision.score || 0}
              </div>
            </div>
          </div>
        </div>

        {/* شرح القرار (Explain) */}
        {explanation?.summary && (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
              📋 ملخص القرار
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6' }}>
              {explanation.summary}
            </div>
            {explanation.positives?.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#34d399' }}>✅ الإيجابيات</div>
                {explanation.positives.slice(0, 4).map((p, i) => (
                  <div key={i} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', padding: '2px 0' }}>
                    • {p.title}
                  </div>
                ))}
              </div>
            )}
            {explanation.warnings?.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444' }}>⚠️ التحذيرات</div>
                {explanation.warnings.slice(0, 2).map((w, i) => (
                  <div key={i} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', padding: '2px 0' }}>
                    • {w.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* نتائج الـ Brains */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
            🧠 نتائج Brains
          </div>
          {sortedBrains.map((brain, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderBottom: i < sortedBrains.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                {brain.name.replace(' Brain', '')}
              </span>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: brain.verdict === 'bullish' ? '#34d399' : brain.verdict === 'bearish' ? '#ef4444' : '#fbbf24',
                  }}
                >
                  {brain.verdict === 'bullish' ? '📈' : brain.verdict === 'bearish' ? '📉' : '➖'}
                </span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                  {Math.round(brain.score || 0)}
                </span>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                  {Math.round(brain.confidence || 0)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* زر الإغلاق */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 24px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
