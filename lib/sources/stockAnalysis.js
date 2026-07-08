// lib/sources/stockAnalysis.js
// جلب البيانات الأساسية من StockAnalysis

export async function fetchStockAnalysis(symbols = []) {
  try {
    const results = [];
    const limit = Math.min(symbols.length || 10, 20);
    
    for (const symbol of symbols.slice(0, limit)) {
      try {
        // ✅ StockAnalysis API (مجاني)
        const url = `https://stockanalysis.com/api/quotes/${symbol}`;
        
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        
        if (!response.ok) continue;
        const data = await response.json();
        
        results.push({
          symbol,
          pe: data.pe || null,
          eps: data.eps || null,
          revenue: data.revenue || null,
          revenueGrowth: data.revenueGrowth || null,
          marketCap: data.marketCap || null,
          dividendYield: data.dividendYield || null,
          analystRating: data.analystRating || null,
          targetPrice: data.targetPrice || null,
          recommendation: data.recommendation || null,
        });
      } catch (e) {
        // تخطي الأخطاء
      }
    }
    
    return results;
  } catch (error) {
    console.error('❌ StockAnalysis error:', error);
    return [];
  }
}
