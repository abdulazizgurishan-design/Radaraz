import React, { useState } from 'react';

export default function Radar() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const scanMarket = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const response = await fetch('/api/scan');
      const result = await response.json();
      
      // التوافق مع مسمى كلاوي الجديد (results بدلاً من data)
      if (result && result.results) {
        setStocks(result.results);
      } else {
        setStocks([]);
      }
    } catch (error) {
      console.error("Error scanning market:", error);
      setStocks([]);
    }
    setLoading(false);
  };

  return (
    <div style={{
      backgroundColor: '#0b0f19',
      color: '#ffffff',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '15px',
      direction: 'rtl'
    }}>
      {/* الهيدر */}
      <header style={{ textAlign: 'center', marginBottom: '30px', paddingTop: '15px' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '800',
          background: 'linear-gradient(to left, #00ffcc, #0077ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 8px 0'
        }}>
          🎯 RADAR AZ PRO v2
        </h1>
        <p style={{ color: '#8892b0', fontSize: '0.9rem', margin: '0' }}>
          رادار التصفية الشرعية والتحليل الحقيقي (VWAP + EMA)
        </p>
      </header>

      {/* زر الفحص */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button 
          onClick={scanMarket}
          disabled={loading}
          style={{
            background: loading ? '#1e293b' : 'linear-gradient(135deg, #00ffcc 0%, #0077ff 100%)',
            color: loading ? '#64748b' : '#0b0f19',
            border: 'none',
            padding: '12px 30px',
            fontSize: '1rem',
            fontWeight: 'bold',
            borderRadius: '50px',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 0 15px rgba(0, 255, 204, 0.25)',
            transition: 'all 0.3s ease'
          }}
        >
          {loading ? '⏳ جاري الحساب الفني الحقيقي (EMA + VWAP)...' : '🚀 ابدأ مسح السوق الفوري'}
        </button>
      </div>

      {/* لوحة الجدول المدمجة المتوافقة مع شاشة الجوال */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: '#111827',
        borderRadius: '14px',
        padding: '15px',
        boxShadow: '0 8px 25px rgba(0,0,0,0.45)',
        border: '1px solid #1f2937'
      }}>
        {searched && stocks.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: '#ff4d4d' }}>
            <p style={{ fontSize: '1rem', fontWeight: 'bold', margin: '0' }}>
              ⚠️ لا توجد فرص تطابق شروط الانفجار السعري والسيولة حالياً.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #1f2937', color: '#00ffcc', fontSize: '0.9rem' }}>
                  <th style={{ padding: '12px 8px' }}>الرمز / السكور</th>
                  <th style={{ padding: '12px 8px' }}>السعر الحالي</th>
                  <th style={{ padding: '12px 8px' }}>حجم التداول</th>
                  <th style={{ padding: '12px 8px' }}>الحالة الفنية</th>
                  <th style={{ padding: '12px 8px' }}>الهدف 1 (15%)</th>
                  <th style={{ padding: '12px 8px' }}>الهدف 2 (30%)</th>
                  <th style={{ padding: '12px 8px' }}>وقف الخسارة</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '0.85rem' }}>
                {stocks.map((stock, idx) => (
                  <tr key={idx} style={{ 
                    borderBottom: '1px solid #1f2937',
                    backgroundColor: idx % 2 === 0 ? 'transparent' : '#161e2e'
                  }}>
                    {/* دمج الرمز والسكور الفني الفعلي المحسوب من كود كلاوي */}
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>
                      <div style={{ color: '#fff' }}>{stock.symbol}</div>
                      <div style={{ fontSize: '0.75rem', color: '#00ffcc', marginTop: '2px' }}>{stock.score}/100 📊</div>
                    </td>
                    <td style={{ padding: '12px 8px', color: '#38bdf8', fontWeight: '600' }}>${stock.price?.toFixed(2)}</td>
                    <td style={{ padding: '12px 8px', color: '#e5e7eb' }}>{stock.volume?.toLocaleString()}</td>
                    {/* التوافق مع متغير كلاوي الجديد confidence */}
                    <td style={{ padding: '12px 8px', fontWeight: 'bold', color: stock.confidence?.includes('💥') || stock.confidence?.includes('🔥') ? '#ff4d4d' : '#38bdf8' }}>
                      {stock.confidence}
                    </td>
                    {/* قراءة الأرقام من كائن levels الجديد الخاص بكلاوي مع الحفاظ على الألوان المضيئة */}
                    <td style={{ padding: '12px 8px', color: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.06)', fontWeight: '500' }}>
                      ${stock.levels?.t1?.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 8px', color: '#00ffcc', backgroundColor: 'rgba(0, 255, 204, 0.06)', fontWeight: 'bold' }}>
                      ${stock.levels?.t2?.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 8px', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.06)', fontWeight: 'bold' }}>
                      ${stock.levels?.sl?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* الملاحظات أسفل الصفحة */}
      <footer style={{ textAlign: 'center', marginTop: '35px', paddingBottom: '15px', paddingHorizontal: '10px' }}>
        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0 0 6px 0', lineHeight: '1.5' }}>
          🛡️ تم تطبيق الفلتر الشرعي المدمج تلقائياً لحفظ تعاملاتك.
        </p>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0', fontWeight: '500' }}>
          ⚠️ تنبيه: هذه المؤشرات مبنية على تحليل شموع 15 دقيقة حية، والأسهم مضاربية عالية المخاطر.
        </p>
      </footer>
    </div>
  );
}
