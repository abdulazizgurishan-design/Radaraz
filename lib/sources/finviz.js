// lib/sources/finviz.js
// جلب بيانات Finviz

export async function fetchFinvizData() {
  try {
    // 🔹 Finviz Export API (بيانات CSV)
    const url = 'https://finviz.com/api/export.ashx?v=111&p=w&e=1';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.warn('⚠️ Finviz API failed, using fallback');
      return getFallbackData();
    }
    
    const text = await response.text();
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < Math.min(lines.length, 100); i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 5) continue;
      
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });
      
      data.push({
        symbol: obj.Ticker || obj.Symbol || '',
        price: parseFloat(obj.Price) || 0,
        change: parseFloat(obj.Change) || 0,
        volume: parseInt(obj.Volume) || 0,
        marketCap: parseFloat(obj.MarketCap) || 0,
        pe: parseFloat(obj.PE) || 0,
        eps: parseFloat(obj.EPS) || 0,
        revenue: parseFloat(obj.Revenue) || 0,
        sector: obj.Sector || '',
        industry: obj.Industry || '',
        rsi: parseFloat(obj.RSI) || 0,
        atr: parseFloat(obj.ATR) || 0,
      });
    }
    
    return data;
  } catch (error) {
    console.error('❌ Finviz error:', error);
    return [];
  }
}

function getFallbackData() {
  // بيانات افتراضية في حال تعذر الاتصال
  return [
    { symbol: 'SPY', price: 550, change: 0.5, volume: 80000000 },
    { symbol: 'AAPL', price: 200, change: 1.2, volume: 50000000 },
    { symbol: 'MSFT', price: 420, change: 0.8, volume: 30000000 },
    { symbol: 'NVDA', price: 130, change: 2.5, volume: 40000000 },
    { symbol: 'AMD', price: 165, change: -0.5, volume: 35000000 },
  ];
}
