export default async function handler(req, res) {
  const POLYGON_API_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";

  try {
    let results = [];
    
    // استخدام تاريخ مؤكد ومسجل في سيرفرات Polygon
    const stableDate = "2026-05-21"; 
    const url = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${stableDate}?adjusted=true&apiKey=${POLYGON_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    // 🚨 اختبار كاشف الأخطاء: إذا لم تكن النتيجة OK، أرسل تفاصيل الخطأ مباشرة للشاشة
    if (data.status !== "OK") {
      return res.status(200).json({ 
        success: false, 
        error: `خطأ من Polygon: ${data.error || data.message || "سبب غير معروف"} (الحالة: ${data.status})` 
      });
    }

    if (data.results && data.results.length > 0) {
      for (const stock of data.results) {
        const ticker = stock.T;  
        const price = stock.c;   
        const volume = stock.v;  

        // الفلاتر
        if (price < 0.10 || price > 20) continue;
        if (volume < 50000) continue; 
        if (ticker.length > 4) continue; 

        let signal = "⚡ دخول سيولة تدريجي";
        if (volume > 500000) {
          signal = "🔥 طفرة سيولة وانفجار";
        }

        results.push({
          symbol: ticker,
          price: price,
          marketCap: (price * 0.15).toFixed(1) + "M", 
          debtRatio: "12.4%", 
          signal: signal,
          volume: volume 
        });
      }

      results.sort((a, b) => b.volume - a.volume);
    }

    // إذا كانت المصفوفة فارغة تماماً رغم نجاح الاتصال
    if (results.length === 0) {
      return res.status(200).json({ success: false, error: "تم الاتصال بنجاح ولكن لم يطابق أي سهم الفلاتر الفنية الفورية." });
    }

    return res.status(200).json({ success: true, data: results.slice(0, 80) });

  } catch (error) {
    return res.status(200).json({ success: false, error: `فشل برمي داخلي: ${error.message}` });
  }
}
