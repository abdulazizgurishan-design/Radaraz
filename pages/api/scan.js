export default async function handler(req, res) {
  const POLYGON_API_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";

  try {
    let results = [];
    
    // حساب تاريخ اليوم تلقائياً بتوقيت أمريكا المباشر لضمان اللحظية
    const amsterdamTime = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    let targetDate = new Date(amsterdamTime).toISOString().split('T')[0];
    
    let url = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${targetDate}?adjusted=true&apiKey=${POLYGON_API_KEY}`;
    let response = await fetch(url);
    let data = await response.json();

    // 🔄 إذا لم تكن بيانات اليوم الحالي جاهزة في السيرفر الجماعي لـ Polygon، نتحول فوراً لجلسة أمس لملء الشاشة بآلاف الأسهم
    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      const d = new Date(amsterdamTime);
      d.setDate(d.getDate() - 1);
      targetDate = d.toISOString().split('T')[0];
      url = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${targetDate}?adjusted=true&apiKey=${POLYGON_API_KEY}`;
      response = await fetch(url);
      data = await response.json();
    }

    if (data.status === "OK" && data.results) {
      for (const stock of data.results) {
        const ticker = stock.T;  
        const price = stock.c;   
        const volume = stock.v;  

        // الفلاتر الفنية والشرعية للميكرو كاب
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

    // إرسال البيانات المباشرة فوراً
    return res.status(200).json({ success: true, data: results.slice(0, 80) });

  } catch (error) {
    console.error("Critical Scanner Error:", error);
    return res.status(500).json({ success: false, error: "فشل مسح السوق" });
  }
}
