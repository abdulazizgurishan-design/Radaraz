// lib/radar/core/FeatureBuilder.js

export class FeatureBuilder {
  /**
   * يبني Feature Vector موحد من بيانات السهم وسياق السوق
   * @param {Object} stock - بيانات السهم من DataProvider
   * @param {Object} marketContext - سياق السوق الكامل (SPY, VIX, القطاعات)
   * @returns {Object} featureVector جاهز للتخزين في قاعدة البيانات
   */
  static build(stock, marketContext) {
    // حساب GAP إذا كانت البيانات متوفرة (سعر الافتتاح - سعر الإغلاق السابق)
    const gap = stock.open && stock.previousClose 
      ? ((stock.open - stock.previousClose) / stock.previousClose) * 100 
      : 0;

    // حساب الـ RSI التقريبي إذا لم يكن موجوداً (يمكنك استبداله بالقيمة الحقيقية من الـ API)
    const rsi = stock.rsi || 50;

    return {
      // === الأساسيات ===
      price: parseFloat(stock.close || stock.price || 0),
      volume: parseInt(stock.volume || 0),
      
      // === المؤشرات الفنية (Technicals) ===
      rvol: parseFloat(stock.rvol || 0),
      atr: parseFloat(stock.atr || 0),
      rsi: parseFloat(rsi),
      ema9: parseFloat(stock.ema9 || 0),
      ema21: parseFloat(stock.ema21 || 0),
      ema50: parseFloat(stock.ema50 || 0),
      vwap: parseFloat(stock.vwap || 0),
      macd: parseFloat(stock.macd || 0),
      
      // === بيانات السيولة والهيكل ===
      gap: parseFloat(gap),
      float: parseFloat(stock.float || 0),
      short_interest: parseFloat(stock.shortInterest || 0),
      
      // === السياق الخارجي (Context) ===
      sector_rank: parseInt(stock.sectorRank || 5), // 1 = أقوى قطاع
      spy: parseFloat(marketContext.spy_change || 0),
      vix: parseFloat(marketContext.vix || 18),
      hour: parseInt(marketContext.hour || 9),
      day_of_week: parseInt(marketContext.day_of_week_index || 0), // 0=Monday
      
      // === إضافات متقدمة (للمرحلة 6) ===
      news_score: parseFloat(stock.newsScore || 0),
      earnings_soon: stock.earningsSoon || false,
      
      // علامة إضافية لتحديد جودة البيانات
      data_completeness: this.calculateCompleteness(stock)
    };
  }

  /**
   * حساب مدى اكتمال البيانات (لحساب الثقة لاحقاً)
   */
  static calculateCompleteness(stock) {
    const fields = ['close', 'volume', 'rvol', 'atr', 'ema9', 'ema21', 'vwap'];
    let present = 0;
    fields.forEach(f => {
      if (stock[f] !== undefined && stock[f] !== null && stock[f] !== 0) present++;
    });
    return parseFloat((present / fields.length).toFixed(2));
  }

  /**
   * بناء كائن الـ Context الخاص بـ World Model
   */
  static buildContext(marketContext) {
    return {
      market_regime: marketContext.regime || 'Neutral',
      volatility_regime: marketContext.volatility_regime || 'Normal',
      liquidity_regime: marketContext.liquidity_regime || 'Normal',
      fed_regime: marketContext.fed_regime || 'Neutral',
      risk_appetite: marketContext.risk_appetite || 'Neutral',
      top_sector: marketContext.top_sector || 'Unknown'
    };
  }
}
