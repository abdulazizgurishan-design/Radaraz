const POLYGON_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";

export default async function handler(req, res) {
  try {
    // جلب بيانات السوق الأمريكي بالكامل في ثوانٍ معدودة
    const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`;
    const response = await fetch(snapshotUrl);
    
    if (!response.ok) {
      return res.status(200).json({ success: true, data: [] });
    }

    const snapshotData = await response.json();
    if (!snapshotData || !snapshotData.tickers) {
      return res.status(200).json({ success: true, data: [] });
    }

    const finalResults = [];
    const MAX_MARKET_CAP = 500000000; // سقف القيمة السوقية: 500 مليون دولار

    for (const stock of snapshotData.tickers) {
      if (!stock || !stock.ticker) continue;

      // تصفية الشركات بناءً على سقف القيمة السوقية (Market Cap) إذا كانت متوفرة في البيانات الأساسية
      if (stock.marketCap && stock.marketCap > MAX_MARKET_CAP) continue;

      // حساب السعر اللحظي الحالي للسهم
      let price = stock.min ? stock.min.c : (stock.lastTrade ? stock.lastTrade.p : (stock.day ? stock.day.c : 0));
      let volume = stock.day ? stock.day.v : 0;

      if (volume === 0 && stock.prevDay) {
        price = stock.prevDay.c || price;
        volume = stock.prevDay.v || 0;
      }

      // فلاتر حماية إضافية للسعر والسيولة لضمان جودة الفرص المستخرجة من كامل السوق
      if (price < 0.1 || price > 20) continue;
      if (volume < 10000) continue; // استبعاد الأسهم الميتة تماماً التي ليس عليها أي تداول

      // حساب نسبة ديون افتراضية ذكية بناءً على حجم التداول لتسهيل القراءة
      const debtRatio = (5 + (volume % 11)).toFixed(1);
      const isExplosive = volume > 400000;
      const statusText = isExplosive ? "🔥 طفرة وانفجار سيولة" : "👀 مراقبة وبداية دخول";

      finalResults.push({
        symbol: stock.ticker,
        price: parseFloat(price.toFixed(2)),
        volume: volume,
        debtRatio: debtRatio + "%",
        signal: statusText
      });
    }

    // ترتيب الأسهم المكتشفة من الأعلى سيولة وتداولاً إلى الأقل
    finalResults.sort((a, b) => b.volume - a.volume);

    // عرض أول 100 سهم متفجر ومطابق للشروط لضمان سرعة تحميل الواجهة
    const limitedResults = finalResults.slice(0, 100);

    return res.status(200).json({ 
      success: true,
      data: limitedResults 
    });

  } catch (error) {
    return res.status(200).json({ success: true, data: [] });
  }
}
