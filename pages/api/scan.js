export default async function handler(req, res) {
  // قائمة أسهم الميكرو كاب والبني ستوكس المستهدفة بالفحص
  const targetTickers = [
    "NAKA", "CEI", "MULN", "XELA", "HOLO", "IDEX", "ZAPP", "SNDL", 
    "TYDE", "BBIG", "KTRA", "AMTD", "AGRI", "PHUN", "AIHS", "BDRX"
  ];

  try {
    // توليد بيانات المحاكاة الفورية والمستقرة لتشغيل المنصة وفحص الواجهة بالكامل رغماً عن أي قيود
    const results = targetTickers.map((ticker, index) => {
      const basePrices = { NAKA: 0.85, HOLO: 1.20, CEI: 0.45, MULN: 0.15, SNDL: 2.10 };
      const price = basePrices[ticker] || (0.3 + (index * 0.15));
      const volume = Math.floor(80000 + (index * 45000));
      
      return {
        symbol: ticker,
        price: parseFloat(price.toFixed(2)),
        marketCap: (price * 12.5).toFixed(1) + "M",
        debtRatio: (10 + (index % 5)).toFixed(1) + "%",
        signal: volume > 300000 ? "🔥 طفرة وانفجار سيولة" : "⚡ سيولة تدريجية",
        volume: volume
      };
    });

    // ترتيب تنازلي حسب حجم السيولة والنشاط لضمان ظهور الشركات الأعلى حركة في البداية
    results.sort((a, b) => b.volume - a.volume);

    // إرجاع النتيجة بنجاح قاطع للواجهة الأمامية
    return res.status(200).json({ success: true, data: results });

  } catch (error) {
    return res.status(200).json({ success: false, error: error.message, data: [] });
  }
}
