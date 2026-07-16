// components/RadarFilters.js
export default function RadarFilters({ filters, setFilters, counts }) {
  const filterOptions = [
    { id: 'all', label: `الكل (${counts.total || 0})` },
    { id: 'elite', label: `🏆 ELITE (${counts.elite || 0})` },
    { id: 'prime', label: `⭐ PRIME (${counts.prime || 0})` },
    { id: 'strong', label: `💪 STRONG (${counts.strong || 0})` },
    { id: 'good', label: `📊 GOOD (${counts.good || 0})` },
  ];

  const confidenceOptions = [
    { id: 'all', label: 'الكل' },
    { id: 'high', label: 'ثقة عالية (80%+)' },
    { id: 'medium', label: 'ثقة متوسطة (60-80%)' },
  ];

  const regimeOptions = [
    { id: 'all', label: 'الكل' },
    { id: 'strong', label: '📈 سوق قوي' },
    { id: 'neutral', label: '📊 سوق محايد' },
    { id: 'weak', label: '📉 سوق ضعيف' },
  ];

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* فلاتر التصنيف */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {filterOptions.map(opt => (
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

      {/* فلاتر الثقة والسوق */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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

        <select
          value={filters.regime || 'all'}
          onChange={e => setFilters({ ...filters, regime: e.target.value })}
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
          {regimeOptions.map(opt => (
            <option key={opt.id} value={opt.id} style={{ background: '#141c30' }}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
