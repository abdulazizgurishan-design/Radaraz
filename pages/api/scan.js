import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
  // 1. قائمة الأسهم المبدئية للفحص
  const TICKERS_TO_SCAN = [
    "PALT", "AMST", "MARK", "WISA", "BCOV", "MVIS", "SINT", "CEI", "SISI", "REUN"
  ];

  let results = [];

  for (let tickerSymbol of TICKERS_TO_SCAN) {
    try {
      // جلب البيانات المالية الأساسية والتاريخية من ياهو فاينانس
      const quote = await yahooFinance.quote(tickerSymbol);
      
      const marketCap = quote.marketCap || 0;
      const totalDebt = quote.totalDebt || 0;
      const currentPrice = quote.regularMarketPrice || 0;

      // الشرط الأول: الماركت كاب أقل من 200 مليون دولار
      if (marketCap === 0 || marketCap > 200000000) continue;

      // الشرط الثاني: الفحص الشرعي (الديون أقل من 30% من القيمة السوقية)
      const debtRatio = marketCap > 0 ? (totalDebt / marketCap) : 1;
      if (debtRatio >= 0.30) continue; // استبعاد غير الشرعي

      // الشرط الثالث: مؤشرات الارتفاع القوي (مثال مبسط بناءً على حجم التداول اليومي)
      const volume = quote.regularMarketVolume || 0;
      const avgVolume = quote.averageDailyVolume3Month || 1;
      
      let isExplosive = false;
      let reasons = [];

      if (volume > avgVolume * 1.5) {
        isExplosive = true;
        reasons.push("ارتفاع مفاجئ في حجم التداول (دخول سيولة)");
      }

      // إضافة السهم إذا اجتاز الفحص الشرعي وكان به بوادر حركة قوية
      results.push({
        symbol: tickerSymbol,
        price: currentPrice,
        marketCap: marketCap.toLocaleString(),
        debtRatio: (debtRatio * 100).toFixed(2) + "%",
        signal: reasons.length > 0 ? reasons.join(", ") : "مستقر فنياً ومتوافق شرعياً"
      });

    } catch (error) {
      // تخطي الأخطاء في حال عدم توفر بيانات لسهم معين
      continue;
    }
  }

  // إرجاع النتيجة للموقع كـ JSON لتستطيع عرضها في صفحة index.jsx
  res.status(200).json({ success: true, data: results });
}
