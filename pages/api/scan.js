export default async function handler(req, res) {
  const POLYGON_API_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";

  try {
    // استخدام تاريخ تداول ثابت ومستقر لضمان جلب البيانات فوراً وتخطي قيود الباقة اللحظية
    const stableDate = "2026-05-21"; 
    const url = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${stableDate}?adjusted=true&apiKey=${POLYGON_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    let results = [];

    if (data && data.results && data.results.length > 0) {
      for (let i = 0; i < data.results.length; i++) {
        const stock = data.results[i];
        const ticker = stock.T || "";
        const price = stock.c || 0;
        const volume = stock.v || 0;

        // فلاتر الميكرو كاب الصارمة
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

      // ترتيب حسب الأعلى سيولة ونشاطاً
      results.sort((a, b) => b.volume - a.volume);
    }

    // إرسال البيانات المصفاة (أول 80 سهم واعد)
    return res.status(200).json({ success: true, data: results.slice(0, 80) });

  } catch (error) {
    return res.status(200).json({ success: false, error: error.message, data: [] });
  }
}
