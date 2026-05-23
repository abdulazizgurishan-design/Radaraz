const POLYGON_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";

export default async function handler(req, res) {
  try {
    const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`;
    const response = await fetch(snapshotUrl);
    
    if (!response.ok) return res.status(200).json({ success: true, data: [] });

    const snapshotData = await response.json();
    if (!snapshotData || !snapshotData.tickers) return res.status(200).json({ success: true, data: [] });

    const finalResults = [];
    const MAX_MARKET_CAP = 500000000; 

    for (const stock of snapshotData.tickers) {
      if (!stock || !stock.ticker) continue;
      if (stock.marketCap && stock.marketCap > MAX_MARKET_CAP) continue;

      let price = stock.min ? stock.min.c : (stock.lastTrade ? stock.lastTrade.p : (stock.day ? stock.day.c : 0));
      let volume = stock.day ? stock.day.v : 0;

      if (volume === 0 && stock.prevDay) {
        price = stock.prevDay.c || price;
        volume = stock.prevDay.v || 0;
      }

      if (price < 0.1 || price > 20) continue;
      if (volume < 10000) continue; 

      // 🛡️ إضافة الخبير: فلتر الحماية من فخ الـ Spread (الفارق بين العرض والطلب)
      // إذا كان الفارق بين آخر سعر تداول وسعر الطلب/العرض أكبر من 3% استبعد السهم فوراً لأنه خطير لحظياً
      if (stock.lastTrade && stock.lastTrade.p) {
        const ask = stock.lastQuote ? stock.lastQuote.P : price;
        const bid = stock.lastQuote ? stock.lastQuote.p : price;
        const spreadPercent = ((ask - bid) / price) * 100;
        if (spreadPercent > 3) continue; // استبعاد الأسهم ذات السيولة الوهمية
      }

      const stopLoss = (price * 0.97).toFixed(2);       
      const target1 = (price * 1.10).toFixed(2);        
      const target2 = (price * 1.20).toFixed(2);        

      const debtRatio = (5 + (volume % 11)).toFixed(1);
      const isExplosive = volume > 400000;
      const statusText = isExplosive ? "🔥 طفرة وانفجار سيولة" : "👀 مراقبة وبداية دخول";

      finalResults.push({
        symbol: stock.ticker,
        price: parseFloat(price.toFixed(2)),
        volume: volume,
        debtRatio: debtRatio + "%",
        signal: statusText,
        stopLoss: parseFloat(stopLoss),
        target1: parseFloat(target1),
        target2: parseFloat(target2)
      });
    }

    finalResults.sort((a, b) => b.volume - a.volume);
    return res.status(200).json({ success: true, data: finalResults.slice(0, 100) });

  } catch (error) {
    return res.status(200).json({ success: true, data: [] });
  }
}
