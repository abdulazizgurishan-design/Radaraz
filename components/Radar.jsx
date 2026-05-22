import { useState } from 'react';

export default function Radar() {
  const [loading, setLoading] = useState(false);
  const [stocks, setStocks] = useState([]);
  const [stats, setStats] = useState({ total: 8000, filtered: 0, explosions: 0 });

  const handleScan = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/scan');
      const result = await response.json();
      
      if (result.success && result.data) {
        setStocks(result.data);
        // حساب الإحصائيات الحية
        const explosionsCount = result.data.filter(s => s.volume > 500000).length;
        setStats({
          total: 8000,
          filtered: result.data.length,
          explosions: explosionsCount
        });
      } else {
        alert(result.error || "لم يتم العثور على أسهم");
      }
    } catch (error) {
      console.error("Scan Error:", error);
    }
    setLoading(false);
  };

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif', direction: 'rtl' }}>
      
      {/* الهيدر العلوى */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#38bdf8', fontSize: '28px', fontWeight: 'bold' }}>📡 RADAR AZ PRO</h1>
        <p style={{ color: '#94a3b8' }}>منصة متطورة لمسح وفلترة ميكرو كاب السوق الأمريكي بالكامل لحظياً</p>
      </div>

      {/* العدادات الرقمية الفخمة */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '30px' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{stats.filtered}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>المطابقة للفلاتر</div>
        </div>
        <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{stats.explosions}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>🔥 طفرة انفجارية</div>
        </div>
        <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8' }}>+{stats.total}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>نطاق الفحص الشامل</div>
        </div>
      </div>

      {/* زر الفحص الاحترافي */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button 
          onClick={handleScan}
          disabled={loading}
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: 'white',
            padding: '15px 40px',
            borderRadius: '50px',
            border: 'none',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
            width: '100%',
            maxWidth: '350px'
          }}
        >
          {loading ? "⏳ جاري فحص الـ 8,000 شركة..." : "📡 ابدأ مسح السوق الفوري"}
        </button>
      </div>

      {/* جدول عرض نتائج الأسهم الفورية */}
      <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '15px', border: '1px solid #334155' }}>
        {stocks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            اضغط على الزر في الأعلى لتشغيل الرادار وسحب صفقات السوق الفورية الآن.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '10px' }}>الرمز</th>
                  <th style={{ padding: '10px' }}>السعر</th>
                  <th style={{ padding: '10px' }}>السيولة (الحجم)</th>
                  <th style={{ padding: '10px' }}>الإشارة</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #334155', height: '50px' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#38bdf8' }}>{stock.symbol}</td>
                    <td style={{ padding: '10px', color: '#f59e0b' }}>${stock.price}</td>
                    <td style={{ padding: '10px' }}>{stock.volume.toLocaleString()}</td>
                    <td style={{ padding: '10px', color: stock.volume > 500000 ? '#ef4444' : '#10b981' }}>{stock.signal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
