// components/Radar.js — النسخة المعدلة للواجهة الجديدة
import { useState, useEffect, useMemo, useCallback } from 'react';
import SignalCard from './SignalCard';
import DetailModal from './DetailModal';
import RadarFilters from './RadarFilters';

// ─── الأنماط (Styles) ──────────────────────────────────────────────
const S = {
  root: {
    minHeight: '100vh',
    background: '#080c18',
    fontFamily: 'system-ui',
    color: '#fff',
    position: 'relative',
    overflow: 'hidden',
  },
  bgWrap: {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
  },
  bgCircle: {
    position: 'absolute',
    top: '10%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 600,
    height: 600,
    background: 'radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)',
    borderRadius: '50%',
  },
  bgGrid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)',
    backgroundSize: '50px 50px',
  },
  container: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 920,
    margin: '0 auto',
    padding: '24px 16px',
  },
  header: {
    textAlign: 'center',
    marginBottom: 32,
    paddingBottom: 24,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  dot: (color) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: color,
    boxShadow: `0 0 16px ${color}`,
  }),
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: 2,
    color: '#fff',
  },
  titleAccent: {
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  badge: {
    fontSize: 10,
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    borderRadius: 4,
    padding: '3px 8px',
    color: '#fff',
    fontWeight: 700,
  },
  subtitle: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  statsRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  statBox: (bg, border) => ({
    flex: 1,
    minWidth: 80,
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 14,
    padding: '14px 16px',
    textAlign: 'center',
  }),
  statNum: (color) => ({
    fontSize: 26,
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
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255,255,255,0.3)',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255,255,255,0.3)',
  },
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTop: '1px solid rgba(255,255,255,0.04)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  footerSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    lineHeight: 1.6,
  },
  refreshBtn: {
    padding: '8px 20px',
    background: 'rgba(99,102,241,0.15)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 10,
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  langBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '5px 12px',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

// ─── المكون الرئيسي ──────────────────────────────────────────────
export default function Radar() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [filters, setFilters] = useState({ grade: 'all', confidence: 'all', regime: 'all' });
  const [counts, setCounts] = useState({ total: 0, elite: 0, prime: 0, strong: 0, good: 0, watch: 0, avoid: 0 });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lang, setLang] = useState('ar');

  // ─── جلب البيانات ──────────────────────────────────────────────
  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scan');
      const data = await res.json();

      if (data.success && data.results) {
        setSignals(data.results);
        updateCounts(data.results);
        setLastUpdate(new Date());
      } else {
        console.warn('No results from API:', data);
        setSignals([]);
        updateCounts([]);
      }
    } catch (error) {
      console.error('Error fetching signals:', error);
      setSignals([]);
      updateCounts([]);
    }
    setLoading(false);
  }, []);

  // ─── تحديث العدادات ────────────────────────────────────────────
  const updateCounts = (results) => {
    const counts = {
      total: results.length,
      elite: results.filter(s => s.decision?.grade === 'ELITE').length,
      prime: results.filter(s => s.decision?.grade === 'PRIME').length,
      strong: results.filter(s => s.decision?.grade === 'STRONG').length,
      good: results.filter(s => s.decision?.grade === 'GOOD').length,
      watch: results.filter(s => s.decision?.grade === 'WATCH').length,
      avoid: results.filter(s => s.decision?.grade === 'AVOID').length,
    };
    setCounts(counts);
  };

  // ─── فلترة النتائج ─────────────────────────────────────────────
  const filteredSignals = useMemo(() => {
    return signals.filter(s => {
      // فلتر التصنيف
      if (filters.grade !== 'all') {
        const grade = s.decision?.grade?.toLowerCase() || '';
        if (grade !== filters.grade) return false;
      }

      // فلتر الثقة
      const confidence = s.decision?.confidence || 0;
      if (filters.confidence === 'high' && confidence < 80) return false;
      if (filters.confidence === 'medium' && (confidence < 60 || confidence >= 80)) return false;

      // فلتر السوق
      if (filters.regime !== 'all' && s.decision?.regime !== filters.regime) return false;

      return true;
    });
  }, [signals, filters]);

  // ─── تحميل البيانات عند تشغيل المكون ──────────────────────────
  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 60000); // تحديث كل دقيقة
    return () => clearInterval(interval);
  }, [fetchSignals]);

  // ─── حالة التحميل ──────────────────────────────────────────────
  if (loading && signals.length === 0) {
    return (
      <div style={S.root} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div style={S.bgWrap}>
          <div style={S.bgCircle} />
          <div style={S.bgGrid} />
        </div>
        <div style={S.container}>
          <div style={S.header}>
            <div style={S.headerRow}>
              <div style={S.dot('#6366f1')} />
              <h1 style={S.title}>RADAR <span style={S.titleAccent}>AZ</span></h1>
              <span style={S.badge}>PRO</span>
            </div>
            <p style={S.subtitle}>محرك القرار الذكي · تحليل متعدد الأبعاد</p>
          </div>
          <div style={S.loading}>⟳ جاري تحميل الإشارات...</div>
        </div>
      </div>
    );
  }

  // ─── التصيير الرئيسي ────────────────────────────────────────────
  return (
    <div style={S.root} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div style={S.bgWrap}>
        <div style={S.bgCircle} />
        <div style={S.bgGrid} />
      </div>

      <div style={S.container}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button style={S.langBtn} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
              {lang === 'ar' ? '🇺🇸 English' : '🇸🇦 عربي'}
            </button>
          </div>

          <div style={S.headerRow}>
            <div style={S.dot('#00d4aa')} />
            <h1 style={S.title}>RADAR <span style={S.titleAccent}>AZ</span></h1>
            <span style={S.badge}>PRO</span>
          </div>
          <p style={S.subtitle}>محرك القرار الذكي · تحليل متعدد الأبعاد</p>

          {lastUpdate && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>
              آخر تحديث: {lastUpdate.toLocaleTimeString()}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button style={S.refreshBtn} onClick={fetchSignals} disabled={loading}>
              {loading ? '⟳ جاري التحديث...' : '🔄 تحديث'}
            </button>
          </div>
        </div>

        {/* الإحصائيات */}
        <div style={S.statsRow}>
          {[
            { label: 'الإجمالي', value: counts.total, color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
            { label: '🏆 ELITE', value: counts.elite, color: '#00d4aa', bg: 'rgba(0,212,170,0.1)', border: 'rgba(0,212,170,0.2)' },
            { label: '⭐ PRIME', value: counts.prime, color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
            { label: '💪 STRONG', value: counts.strong, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)' },
            { label: '📊 GOOD', value: counts.good, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
          ].map(stat => (
            <div key={stat.label} style={S.statBox(stat.bg, stat.border)}>
              <div style={S.statNum(stat.color)}>{stat.value}</div>
              <div style={S.statLabel(stat.color)}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* الفلاتر */}
        <RadarFilters filters={filters} setFilters={setFilters} counts={counts} />

        {/* قائمة الإشارات */}
        {filteredSignals.length === 0 ? (
          <div style={S.empty}>
            {signals.length === 0
              ? 'لا توجد إشارات حالياً'
              : 'لا توجد إشارات تطابق الفلاتر المحددة'}
          </div>
        ) : (
          filteredSignals.map((signal, index) => (
            <SignalCard
              key={signal.symbol + index}
              signal={signal}
              onExpand={setSelectedSignal}
            />
          ))
        )}

        {/* نافذة التفاصيل */}
        {selectedSignal && (
          <DetailModal
            signal={selectedSignal}
            onClose={() => setSelectedSignal(null)}
          />
        )}

        {/* Footer */}
        <div style={S.footer}>
          <span style={S.footerText}>RADAR AZ PRO</span>
          <span style={S.footerSub}>
            ليست نصيحة استثمارية · محرك قرار ذكي · تحليل متعدد الأبعاد
          </span>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #080c18; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        button:hover:not(:disabled) { filter: brightness(1.1); }
      `}</style>
    </div>
  );
}
