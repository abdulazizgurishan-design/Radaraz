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
      if (result.success && result.data) {
        // حساب السكور ديناميكياً بناءً على حجم السيولة لكل سهم
        const enrichedData = result.data.map(stock => {
          let score = 50; // نقطة البداية
          if (stock.volume > 1000000) score = 95;
          else if (stock.volume > 500000) score = 85;
          else if (stock.volume > 200000) score = 75;
          else if (stock.volume > 100000) score = 65;
          
          return { ...stock, score };
        });
        setStocks(enrichedData);
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
      padding: '20px',
      direction: 'rtl'
    }}>
      {/* الهيدر الفخم */}
      <header style={{ textAlign: 'center', marginBottom: '40px', paddingTop: '20px' }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '800',
          background: 'linear-gradient(to left, #00ffcc, #0077ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 10px 0'
        }}>
          🎯 RADAR AZ PRO v2
        </h1>
        <p style={{ color: '#8892b0', fontSize: '1.1rem', margin: '0' }}>
          رادار مسح السوق الأمريكي الفوري (تحت 500 مليون$ )
        </p>
      </header>

      {/* زر الفحص المطور */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <button 
          onClick={scanMarket}
          disabled={loading}
          style={{
            background: loading ? '#1e293b' : 'linear-gradient(135deg, #00ffcc 0%, #0077ff 100%)',
            color: loading ? '#64748b' : '#0b0f19',
            border: 'none',
            padding: '16px 40px',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            borderRadius: '50px',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 0 20px rgba(0, 255, 204, 0.4)',
            transition: 'all 0.3s ease'
          }}
        >
          {loading ? '⏳ جاري فحص آلاف الأسهم وتصفيتها...' : '🚀 ابدأ مسح السوق الفوري'}
        </button>
      </div>

      {/* لوحة النتائج والجدول */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: '#111827',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        border: '1px solid #1f2937'
      }}>
        {searched && stocks.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#ff4d4d' }}>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0 0 10px 0' }}>
              ⚠️ لا توجد فرص تطابق الفلاتر حالياً
            </p>
            <p style={{ color: '#8892b0', fontSize: '0.95rem', margin: '0' }}>
              تأكد أن وقت السوق مفتوح (يفتح الاثنين الساعة 4:30 م بتوقيت الرياض)
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #1f2937', color: '#00ffcc' }}>
                  <th style={{ padding: '15px 10px' }}>الرمز</th>
                  <th style={{ padding: '15px 10px' }}>السكور 📊</th>
                  <th style={{ padding: '15px 10px' }}>السعر الحالي</th>
                  <th style={{ padding: '15px 10px' }}>حجم السيولة</th>
                  <th style={{ padding: '15px 10px' }}>الهدف 1 (10%)</th>
                  <th style={{ padding: '15px 10px' }}>الهدف 2 (20%)</th>
                  <th style={{ padding: '15px 10px' }}>وقف الخسارة (3%-)</th>
                  <th style={{ padding: '15px 10px' }}>الإشارة</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock, idx) => (
                  <tr key={idx} style={{ 
                    borderBottom: '1px solid #1f2937',
                    backgroundColor: idx % 2 === 0 ? 'transparent' : '#161e2e',
                    transition: 'background-color 0.2s'
                  }}>
                    <td style={{ padding: '15px 10px', fontWeight: 'bold', color: '#fff' }}>{stock.symbol}</td>
                    <td style={{ padding: '15px 10px' }}>
                      <span style={{
                        background: stock.score >= 85 ? 'rgba(0, 255, 204, 0.15)' : 'rgba(0, 119, 255, 0.15)',
                        color: stock.score >= 85 ? '#00ffcc' : '#38bdf8',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        fontSize: '0.9rem'
                      }}>
                        {stock.score} / 100
                      </span>
                    </td>
                    <td style={{ padding: '15px 10px', color: '#38bdf8', fontWeight: '600' }}>${stock.price}</td>
                    <td style={{ padding: '15px 10px', color: '#e5e7eb' }}>{stock.volume.toLocaleString()}</td>
                    <td style={{ padding: '15px 10px', color: '#4ade80' }}>${stock.target1}</td>
                    <td style={{ padding: '15px 10px', color: '#22c55e', fontWeight: 'bold' }}>${stock.target2}</td>
                    <td style={{ padding: '15px 10px', color: '#ef4444' }}>${stock.stopLoss}</td>
                    <td style={{ padding: '15px 10px' }}>
                      <span style={{
                        color: stock.signal.includes('🔥') ? '#ff4d4d' : '#ffb703',
                        fontWeight: '500'
                      }}>
                        {stock.signal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* التنبيه القانوني والشرعي بخط صغير أسفل الصفحة */}
      <footer style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '20px' }}>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0', letterSpacing: '0.5px' }}>
          💡 يرجى البحث عن شرعية الأسهم في التطبيقات المعتمدة (مثل الفلتر الشرعي أو يقين) قبل اتخاذ أي قرار استثماري.
        </p>
      </footer>
    </div>
  );
}
