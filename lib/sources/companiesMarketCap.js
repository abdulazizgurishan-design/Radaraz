// lib/sources/companiesMarketCap.js
// جلب القيمة السوقية العالمية

export async function fetchCompaniesMarketCap(symbols = []) {
  try {
    const results = [];
    
    for (const symbol of symbols.slice(0, 10)) {
      try {
        const url = `https://companiesmarketcap.com/${symbol.toLowerCase()}/marketcap/`;
        
        // ملاحظة: هذا الموقع يتطلب scraping
        // نقوم بتجربة طريقة بديلة باستخدام API
        const response = await fetch(`https://companiesmarketcap.com/api/v1/company/${symbol}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        
        if (!response.ok) continue;
        const data = await response.json();
        
        results.push({
          symbol,
          marketCap: data.marketCap || null,
          revenue: data.revenue || null,
          profit: data.profit || null,
          pe: data.pe || null,
          rank: data.rank || null,
        });
      } catch (e) {
        // تخطي الأخطاء
      }
    }
    
    return results;
  } catch (error) {
    console.error('❌ CompaniesMarketCap error:', error);
    return [];
  }
}
