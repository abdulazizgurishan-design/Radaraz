import { useState } from 'react';

// ── 1. Header ────────────────────────────────────────────────────
const Header = () => (
  <header style={styles.header}>
    <h1 style={styles.title}>🎯 RADAR AZ PRO v2</h1>
    <p style={styles.subtitle}>رادار مسح وتصفية السوق الأمريكي الفوري</p>
  </header>
);

// ── 2. ScanButton ────────────────────────────────────────────────
const ScanButton = ({ onScan, loading }) => (
  <div style={styles.btnContainer}>
    <button
      onClick={onScan}
      disabled={loading}
      style={loading ? styles.btnDisabled : styles.btnEnabled}
    >
      {loading ? '⏳ جاري مسح السوق وتصفية الفرص...' : '🚀 ابدأ مسح السوق الفوري'}
    </button>
  </div>
);

// ── 3. ErrorBanner ───────────────────────────────────────────────
const ErrorBanner = ({ message }) => {
  if (!message) return null;
  return (
    <div style={styles.errorBanner}>
      <p style={styles.errorText}>⚠️ {message}</p>
    </div>
  );
};

// ── 4. EmptyState ────────────────────────────────────────────────
const EmptyState = ({ searched }) => (
  <div style={styles.emptyState}>
    {searched ? (
      <>
        <div style={styles.emptyIcon}>📭</div>
        <p style={styles.emptyTitle}>لا توجد فرص تطابق فلاتر الأمان والسيولة حالياً.</p>
        <p style={styles.emptySubtitle}>يرجى المحاولة مرة أخرى لاحقاً أو مع تغير حركة السوق.</p>
      </>
    ) : (
      <>
        <div style={styles.emptyIcon}>📡</div>
        <p style={styles.placeholderText}>اضغط على الزر في الأعلى لبدء الفحص واقتناص الفرص الفورية.</p>
      </>
    )}
  </div>
);

// ── 5. StockRow ──────────────────────────────────────────────────
const StockRow = ({ stock, idx }) => {
  const isAltRow = idx % 2 !== 0;
  const isHot = stock.confidence?.includes('💥') || stock.confidence?.includes('🔥');

  return (
    <tr style={{ ...styles.row, backgroundColor: isAltRow ? '#161e2e' : 'transparent' }}>
      <td style={styles.tdBold}>
        <div style={styles.symbolText}>{stock.symbol}</div>
        <div style={styles.scoreText}>{stock.score}/100 📊</div>
      </td>
      <td style={styles.tdPrice}>${stock.price?.toFixed(2)}</td>
      <td style={styles.tdVolume}>{stock.volume?.toLocaleString()}</td>
      <td style={{ ...styles.tdBold, color: isHot ? '#ff4d4d' : '#38bdf8' }}>
        {stock.confidence}
      </td>
      <td style={styles.tdTarget1}>${stock.levels?.t1?.toFixed(2)}</td>
      <td style={styles.tdTarget2}>${stock.levels?.t2?.toFixed(2)}</td>
      <td style={styles.tdStopLoss}>${stock.levels?.sl?.toFixed(2)}</td>
    </tr>
  );
};

// ── 6. StockTable ────────────────────────────────────────────────
const StockTable = ({ stocks }) => (
  <div style={styles.tableWrapper}>
    <table style={styles.table}>
      <thead>
        <tr style={styles.thRow}>
          <th style={{ ...styles.th, width: '110px' }}>الرمز / السكور</th>
          <th style={{ ...styles.th, width: '95px' }}>السعر الحالي</th>
          <th style={{ ...styles.th, width: '100px' }}>حجم التداول</th>
          <th style={{ ...styles.th, width: '95px' }}>الحالة الفنية</th>
          <th style={{ ...styles.th, width: '100px' }}>الهدف 1</th>
          <th style={{ ...styles.th, width: '100px' }}>الهدف 2</th>
          <th style={{ ...styles.th, width: '100px' }}>وقف الخسارة</th>
        </tr>
      </thead>
      <tbody style={styles.tbody}>
        {stocks.map((stock, idx) => (
          <StockRow key={stock.symbol || idx} stock={stock} idx={idx} />
        ))}
      </tbody>
    </table>
  </div>
);

// ── 7. Footer ────────────────────────────────────────────────────
const Footer = () => (
  <footer style={styles.footer}>
    <p style={styles.footerHalal}>🛡️ تم تطبيق الفلتر الشرعي المدمج تلقائياً لحفظ تعاملاتك.</p>
    <p style={styles.footerWarning}>
      ⚠️ تنبيه: هذه الأسهم المستخرجة هي أسهم مضاربية لحظية عالية المخاطر وليست للاستثمار طويل الأجل.
    </p>
  </footer>
);

// ── Main Component ───────────────────────────────────────────────
export default function Radar() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);

  const scanMarket = async () => {
    setLoading(true);
    setSearched(true);
    setError(null);
    setStocks([]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/scan', { signal: controller.signal });

      if (!response.ok) {
        throw new Error('فشل السيرفر في جلب البيانات الحية، يرجى تحديث الصفحة.');
      }

      const result = await response.json();
      setStocks(result?.results ?? []);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('انتهت مهلة الاتصال (15 ثانية) دون رد من مزود البيانات، أعد المحاولة.');
      } else {
        setError(err.message || 'حدث خطأ غير متوقع في الشبكة، تحقق من اتصالك.');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const showEmpty = !error && stocks.length === 0 && !loading;

  return (
    <div style={styles.container}>
      <Header />
      <ScanButton onScan={scanMarket} loading={loading} />

      <div style={styles.mainCard}>
        <ErrorBanner message={error} />
        {showEmpty && <EmptyState searched={searched} />}
        {!error && stocks.length > 0 && <StockTable stocks={stocks} />}
      </div>

      <Footer />
    </div>
  );
}

// ── Styles Object ────────────────────────────────────────────────
const styles = {
  container: {
    backgroundColor: '#0b0f19',
    color: '#ffffff',
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '15px',
    direction: 'rtl',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
    paddingTop: '15px',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: '800',
    background: 'linear-gradient(to left, #00ffcc, #0077ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0 0 8px 0',
  },
  subtitle: {
    color: '#8892b0',
    fontSize: '0.85rem',
    margin: '0',
    padding: '0 10px',
    lineHeight: '1.4',
  },
  btnContainer: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  btnEnabled: {
    background: 'linear-gradient(135deg, #00ffcc 0%, #0077ff 100%)',
    color: '#0b0f19',
    border: 'none',
    padding: '12px 30px',
    fontSize: '1rem',
    fontWeight: 'bold',
    borderRadius: '50px',
    cursor: 'pointer',
    boxShadow: '0 0 15px rgba(0, 255, 204, 0.25)',
    transition: 'all 0.3s ease',
  },
  btnDisabled: {
    background: '#1e293b',
    color: '#64748b',
    border: 'none',
    padding: '12px 30px',
    fontSize: '1rem',
    fontWeight: 'bold',
    borderRadius: '50px',
    cursor: 'not-allowed',
  },
  mainCard: {
    maxWidth: '1200px',
    margin: '0 auto',
    background: '#111827',
    borderRadius: '14px',
    padding: '15px',
    boxShadow: '0 8px 25px rgba(0,0,0,0.45)',
    border: '1px solid #1f2937',
    minHeight: '120px',
  },
  errorBanner: {
    textAlign: 'center',
    padding: '15px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    borderRadius: '8px',
    margin: '10px 0',
  },
  errorText: {
    color: '#ef4444',
    fontWeight: 'bold',
    margin: '0',
    fontSize: '0.9rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 10px',
  },
  emptyIcon: {
    fontSize: '2.5rem',
    marginBottom: '12px',
  },
  emptyTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#ff4d4d',
    margin: '0 0 6px 0',
  },
  emptySubtitle: {
    fontSize: '0.8rem',
    color: '#64748b',
    margin: '0',
  },
  placeholderText: {
    fontSize: '0.9rem',
    color: '#8892b0',
    margin: '0',
  },
  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    textAlign: 'right',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '700px',
    tableLayout: 'fixed',
  },
  thRow: {
    borderBottom: '2px solid #1f2937',
    color: '#00ffcc',
    fontSize: '0.85rem',
  },
  th: {
    padding: '12px 8px',
    textAlign: 'right',
  },
  tbody: {
    fontSize: '0.82rem',
  },
  row: {
    borderBottom: '1px solid #1f2937',
  },
  tdBold: {
    padding: '12px 8px',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  symbolText: {
    color: '#fff',
  },
  scoreText: {
    fontSize: '0.72rem',
    color: '#00ffcc',
    marginTop: '2px',
  },
  tdPrice: {
    padding: '12px 8px',
    color: '#38bdf8',
    fontWeight: '600',
    textAlign: 'right',
  },
  tdVolume: {
    padding: '12px 8px',
    color: '#e5e7eb',
    textAlign: 'right',
  },
  tdTarget1: {
    padding: '12px 8px',
    color: '#4ade80',
    backgroundColor: 'rgba(74, 222, 128, 0.06)',
    fontWeight: '500',
    textAlign: 'right',
  },
  tdTarget2: {
    padding: '12px 8px',
    color: '#00ffcc',
    backgroundColor: 'rgba(0, 255, 204, 0.06)',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  tdStopLoss: {
    padding: '12px 8px',
    color: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  footer: {
    textAlign: 'center',
    marginTop: '35px',
    paddingBottom: '15px',
    paddingLeft: '10px',
    paddingRight: '10px',
  },
  footerHalal: {
    color: '#64748b',
    fontSize: '0.75rem',
    margin: '0 0 6px 0',
    lineHeight: '1.5',
  },
  footerWarning: {
    color: '#94a3b8',
    fontSize: '0.75rem',
    margin: '0',
    fontWeight: '500',
    lineHeight: '1.5',
  },
};
