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
        const enrichedData = result.data.map(stock => {
          let score = 50; 
          let liquidityStatus = "عادي";
          
          if (stock.volume > 1000000) {
            score = 98;
            liquidityStatus = "انفجاري 🔥";
          } else if (stock.volume > 500000) {
            score = 88;
            liquidityStatus = "انفجاري 🔥";
          } else if (stock.volume > 200000) {
            score = 78;
            liquidityStatus = "عالي ⚡";
          } else if (stock.volume > 100000) {
            score = 68;
            liquidityStatus = "عالي ⚡";
          } else {
            liquidityStatus = "مراقبة ⏱️";
          }
          
          return { ...stock, score, liquidityStatus };
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
      {/* الهيدر */}
      <header style={{ textAlign: 'center', marginBottom: '40px', paddingTop: '20px' }}>
        <h1 style={{
          fontSize: '2.3rem',
          fontWeight: '800',
          background: 'linear-gradient(to left, #00ffcc, #0077ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 10px 0'
        }}>
          🎯 RADAR AZ PRO v2
        </h1>
        <p style={{ color: '#8892b0', fontSize: '1rem', margin: '0' }}>
          رادار مسح السوق الأمريكي الفوري الآمن (تحت 500 مليون$ )
        </p>
      </header>

      {/* زر الفحص */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <button 
          onClick={scanMarket}
          disabled={loading}
          style={{
            background: loading ? '#1e293b' : 'linear-gradient(135deg, #00ffcc 0%, #0077ff 100%)',
            color: loading ? '#64748b' : '#0b0f19',
            border: 'none',
            padding: '14px 35px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            borderRadius: '50px',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 0 20px rgba(0, 255, 204, 0.3)',
            transition: 'all 0.3s ease'
          }}
        >
          {loading ? '⏳ جاري تصفية وتأمين الفرص...' : '🚀 ابدأ مسح السوق الفوري'}
        </button>
      </div>

      {/* الجدول المطور مع لمسات الخبير */}
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
            <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0' }}>
              ⚠️ لا توجد فرص تطابق فلاتر الأمان حالياً (يفتح الاثنين 4:30 م بتوقيت الرياض)
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
                  <th style={{ padding: '15px 10px' }}>حالة السيولة</th>
                  <th style={{ padding: '15px 10px' }}>الهدف 1</th>
                  <th style={{ padding: '15px 10px' }}>الهدف 2</th>
                  <th style={{ padding: '15px 10px' }}>وقف الخسارة</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock, idx) => (
                  <tr key={idx} style={{ 
                    borderBottom: '1px solid #1f2937',
                    backgroundColor: idx % 2 === 0 ? 'transparent' : '#161e2e'
                  }}>
                    <td style={{ padding: '15px 10px', fontWeight: 'bold', color: '#fff' }}>{stock.symbol}</td>
                    <td style={{ padding: '15px 10px' }}>
                      <span style={{
                        background: stock.score >= 85 ? 'rgba(0, 255, 204, 0.15)' : 'rgba(0, 119, 255, 0.15)',
                        color: stock.score >= 85 ? '#00ffcc' : '#38bdf8',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        fontSize: '0.85rem'
                      }}>
                        {stock.score}/100
                      </span>
                    </td>
                    <td style={{ padding: '15px 10px', color: '#38bdf8', fontWeight: '600' }}>${stock.price}</td>
                    <td style={{ padding: '15px 10px', color: '#e5e7eb' }}>{stock.volume.toLocaleString()}</td>
                    <td style={{ padding: '15px 10px' }}>
                      <span style={{
                        color: stock.liquidityStatus.includes('🔥') ? '#ff4d4d' : (stock.liquidityStatus.includes('⚡') ? '#38bdf8' : '#8892b0'),
                        fontWeight: 'bold'
                      }}>
                        {stock.liquidityStatus}
                      </span>
                    </td>
                    {/* تلوين الأهداف بالبصريات الاحترافية الأخضر والوقف بالأحمر */}
                    <td style={{ padding: '15px 10px', color: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.05)', fontWeight: '500' }}>${stock.target1}</td>
                    <td style={{ padding: '15px 10px', color: '#00ffcc', backgroundColor: 'rgba(0, 255, 204, 0.05)', fontWeight: 'bold' }}>${stock.target2}</td>
                    <td style={{ padding: '15px 10px', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)', fontWeight: 'bold' }}>${stock.stopLoss}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* الملاحظات في الأسفل */}
      <footer style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '20px', paddingHorizontal: '15px' }}>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 8px 0', lineHeight: '1.6' }}>
          💡 يرجى البحث عن شرعية الأسهم في التطبيقات المعتمدة (مثل الفلتر الشرعي أو يقين) قبل اتخاذ أي قرار استثماري.
        </p>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0', fontWeight: '500' }}>
          ⚠️ تنبيه: هذه الأسهم المستخرجة هي <b>أسهم مضاربية لحظية عالية المخاطر وليست للاستثمار طويل الأجل</b>. بناءً عليه، جرى التنويه.
        </p>
      </footer>
    </div>
  );
}
