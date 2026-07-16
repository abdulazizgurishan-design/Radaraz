// components/RadarFilters.js
import { useState } from 'react';

export default function RadarFilters({ filters, setFilters, counts }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const gradeOptions = [
    { id: 'all', label: `الكل (${counts.total || 0})` },
    { id: 'ELITE', label: `🏆 نخبة (${counts.elite || 0})` },
    { id: 'PRIME', label: `⭐ ممتاز (${counts.prime || 0})` },
    { id: 'STRONG', label: `💪 قوي (${counts.strong || 0})` },
    { id: 'GOOD', label: `📊 جيد (${counts.good || 0})` },
    { id: 'WATCH', label: `👀 مراقبة (${counts.watch || 0})` },
  ];

  const confidenceOptions = [
    { id: 'all', label: 'الكل' },
    { id: 'high', label: 'ثقة عالية (80%+)' },
    { id: 'medium', label: 'ثقة متوسطة (60-80%)' },
    { id: 'low', label: 'ثقة منخفضة (<60%)' },
  ];

  const timingOptions = [
    { id: 'all', label: 'الكل' },
    { id: 'PRE_BREAKOUT', label: '⚡ قبل الاختراق' },
    { id: 'BREAKOUT', label: '🚀 اختراق' },
    { id: 'EARLY_MOMENTUM', label: '📈 زخم مبكر' },
    { id: 'WAIT', label: '⏳ مراقبة' },
    { id: 'LATE', label: '⚠️ متأخر' },
  ];

  const changeOptions = [
    { id: 'all', label: 'الكل' },
    { id: 'positive', label: '📈 صاعد' },
    { id: 'negative', label: '📉 هابط' },
  ];

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* الفلاتر الأساسية */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {gradeOptions.map(opt => (
          <button
            key={opt.id}
            onClick={() => setFilters({ ...filters, grade: opt.id })}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: filters.grade === opt.id ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
              background: filters.grade === opt.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              color: filters.grade === opt.id ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* فلاتر متقدمة (قابلة للطي) */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '11px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: showAdvanced ? '8px' : 0,
        }}
      >
        {showAdvanced ? '▲ إخفاء الفلاتر المتقدمة' : '▼ فلاتر متقدمة'}
      </button>

      {showAdvanced && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
          {/* فلتر الثقة */}
          <select
            value={filters.confidence || 'all'}
            onChange={e => setFilters({ ...filters, confidence: e.target.value })}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '12px',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {confidenceOptions.map(opt => (
              <option key={opt.id} value={opt.id} style={{ background: '#141c30' }}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* فلتر التوقيت */}
          <select
            value={filters.timing || 'all'}
            onChange={e => setFilters({ ...filters, timing: e.target.value })}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '12px',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {timingOptions.map(opt => (
              <option key={opt.id} value={opt.id} style={{ background: '#141c30' }}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* فلتر التغير */}
          <select
            value={filters.change || 'all'}
            onChange={e => setFilters({ ...filters, change: e.target.value })}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '12px',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {changeOptions.map(opt => (
              <option key={opt.id} value={opt.id} style={{ background: '#141c30' }}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* حد أدنى للثقة (شريط تمرير) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '120px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>حد الثقة:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={filters.minConfidence || 0}
              onChange={e => setFilters({ ...filters, minConfidence: parseInt(e.target.value) })}
              style={{
                flex: 1,
                height: '3px',
                background: 'rgba(99,102,241,0.3)',
                borderRadius: '2px',
                accentColor: '#6366f1',
              }}
            />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', minWidth: '30px' }}>
              {filters.minConfidence || 0}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
