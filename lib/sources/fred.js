// lib/sources/fred.js
// جلب البيانات الاقتصادية من FRED (مجاني)

const FRED_API_KEY = process.env.FRED_API_KEY || 'YOUR_API_KEY';

export async function fetchFREDData() {
  try {
    const series = {
      GDP: 'الناتج المحلي',
      CPIAUCSL: 'التضخم',
      FEDFUNDS: 'سعر الفائدة',
      UNRATE: 'البطالة',
      M2SL: 'المعروض النقدي',
      DGS10: 'عوائد السندات 10 سنوات',
      SP500: 'مؤشر S&P 500',
    };
    
    const results = {};
    
    for (const [id, name] of Object.entries(series)) {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`;
      
      try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.observations && data.observations.length > 0) {
          const value = parseFloat(data.observations[0].value);
          if (!isNaN(value)) {
            results[id] = {
              name,
              value,
              date: data.observations[0].date,
            };
          }
        }
      } catch (e) {
        // تخطي الأخطاء
      }
    }
    
    return results;
  } catch (error) {
    console.error('❌ FRED error:', error);
    return {};
  }
}
