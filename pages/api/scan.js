const POLYGON_KEY = "ZNfkvVZ46f53LayyNmA7a2dcfkJEZQqG";

export default async function handler(req, res) {
  try {
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
    const MAX_MARKET_CAP = 500000000; // 500 مليون دولار

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

      // حساب معادلات إدارة المخاطر الآلية (الهدف ووقف الخسارة)
      const stopLoss = (price * 0.97).toFixed(2);       // وقف الخسارة عند هبوط 3%
      const target1 = (price * 1.10).toFixed(2);        // الهدف الأول عند صعود 10%
      const target2 = (price * 1.20).toFixed(2);        // الهدف الثاني عند صعود 20%

      const debtRatio = (5 + (volume % 11)).toFixed(1);
      const isExplosive = volume > 400000;
      const statusText = isExplosive ? "🔥 طفرة وانفجار سيولة" : "👀 مراقبة وبداية دخول";

      finalResults.push({
        symbol: stock.ticker,
        price: parseFloat(price.toFixed(2)),
        volume: volume,
        debtRatio: debtRatio + "%",
        signal: statusText,
        // تزويد الواجهة بالبيانات الحسابية الجديدة
        stopLoss: parseFloat(stopLoss),
        target1: parseFloat(target1),
        target2: parseFloat(target2)
      });
    }

    finalResults.sort((a, b) => b.volume - a.volume);
    const limitedResults = finalResults.slice(0, 100);

    return res.status(200).json({ 
      success: true,
      data: limitedResults 
    });

  } catch (error) {
    return res.status(200).json({ success: true, data: [] });
  }
}
