// lib/analyzer.js
// التحليل المتقدم باستخدام جميع المصادر

export function advancedAnalysis(polygonData, externalData) {
  if (!polygonData || polygonData.length === 0) return [];
  
  const results = [];
  
  for (const stock of polygonData) {
    const scores = {
      technical: 0,
      fundamental: 0,
      sentiment: 0,
      macro: 0,
      total: 0,
    };
    
    // 1. التحليل الفني (من Polygon)
    scores.technical = calculateTechnicalScore(stock);
    
    // 2. التحليل الأساسي (من StockAnalysis)
    const fundamental = externalData?.fundamentals?.find(f => f.symbol === stock.symbol);
    if (fundamental) {
      scores.fundamental = calculateFundamentalScore(fundamental);
    }
    
    // 3. تحليل المشاعر (من Reddit)
    if (externalData?.reddit) {
      scores.sentiment = calculateSentimentScore(stock.symbol, externalData.reddit);
    }
    
    // 4. التحليل الماكروي (من FRED)
    if (externalData?.fred) {
      scores.macro = calculateMacroScore(externalData.fred);
    }
    
    // 5. المجموع الكلي (وزن لكل عامل)
    scores.total = (
      scores.technical * 0.40 +
      scores.fundamental * 0.25 +
      scores.sentiment * 0.20 +
      scores.macro * 0.15
    );
    
    // 6. التوصية
    let recommendation = 'AVOID';
    if (scores.total >= 75) recommendation = 'STRONG BUY 🔥';
    else if (scores.total >= 65) recommendation = 'BUY ✅';
    else if (scores.total >= 55) recommendation = 'WATCH 👀';
    else if (scores.total >= 45) recommendation = 'CAUTION ⚠️';
    
    results.push({
      ...stock,
      scores,
      recommendation,
      recommendationScore: Math.round(scores.total),
    });
  }
  
  // ترتيب حسب النتيجة
  return results.sort((a, b) => b.scores.total - a.scores.total);
}

// ─── دوال المساعدة ──────────────────────────────────────────────

function calculateTechnicalScore(stock) {
  let score = 0;
  
  // RVOL (حجم التداول النسبي)
  if (stock.rvol > 5) score += 20;
  else if (stock.rvol > 3) score += 15;
  else if (stock.rvol > 1.5) score += 8;
  
  // التغير
  if (stock.changePct > 5) score += 20;
  else if (stock.changePct > 3) score += 15;
  else if (stock.changePct > 2) score += 8;
  
  // RSI (زخم صحي)
  if (stock.rsi >= 50 && stock.rsi <= 68) score += 20;
  else if (stock.rsi >= 45 && stock.rsi < 50) score += 10;
  else if (stock.rsi > 68 && stock.rsi <= 72) score += 5;
  
  // EP (درجة القوة)
  if (stock.ep >= 80) score += 20;
  else if (stock.ep >= 70) score += 15;
  else if (stock.ep >= 60) score += 8;
  
  // نسبة المخاطرة/العائد
  if (stock.structure?.rr >= 2) score += 20;
  else if (stock.structure?.rr >= 1.5) score += 15;
  else if (stock.structure?.rr >= 1.2) score += 8;
  
  return Math.min(score, 100);
}

function calculateFundamentalScore(data) {
  let score = 0;
  
  // PE Ratio (مقيم بأقل من قيمته)
  if (data.pe && data.pe > 0 && data.pe < 15) score += 25;
  else if (data.pe && data.pe >= 15 && data.pe < 25) score += 15;
  else if (data.pe && data.pe >= 25 && data.pe < 35) score += 5;
  
  // نمو الإيرادات
  if (data.revenueGrowth && data.revenueGrowth > 25) score += 25;
  else if (data.revenueGrowth && data.revenueGrowth > 15) score += 15;
  else if (data.revenueGrowth && data.revenueGrowth > 5) score += 8;
  
  // توصية المحللين
  if (data.analystRating === 'strong_buy') score += 25;
  else if (data.analystRating === 'buy') score += 18;
  else if (data.analystRating === 'hold') score += 8;
  
  // ربحية السهم (EPS)
  if (data.eps && data.eps > 0) score += 25;
  else if (data.eps && data.eps > 0) score += 15;
  
  return Math.min(score, 100);
}

function calculateSentimentScore(symbol, sentimentData) {
  let totalScore = 0;
  let count = 0;
  
  for (const [subreddit, mentions] of Object.entries(sentimentData)) {
    if (!Array.isArray(mentions)) continue;
    const found = mentions.find(m => m.symbol === symbol);
    if (found) {
      const maxScore = 100;
      const normalized = Math.min((found.score / 50) * 100, 100);
      totalScore += normalized;
      count++; عن
    }
  }
  
  return count > 0 ? Math.round(totalScore / count) : 0;
}

function calculateMacroScore(fredData) {
  let score = 0;
  
  // التضخم (مثالي أقل من 3%)
  if (fredData.CPIAUCSL && fredData.CPIAUCSL.value < 3) score += 25;
  else if (fredData.CPIAUCSL && fredData.CPIAUCSL.value < 4) score += 15;
  
  // البطالة (مثالي أقل من 4%)
  if (fredData.UNRATE && fredData.UNRATE.value < 4) score += 25;
  else if (fredData.UNRATE && fredData.UNRATE.value < 5) score += 15;
  
  // أسعار الفائدة (منخفضة = جيد للأسهم)
  if (fredData.FEDFUNDS && fredData.FEDFUNDS.value < 3) score += 25;
  else if (fredData.FEDFUNDS && fredData.FEDFUNDS.value < 5) score += 15;
  
  // النمو الاقتصادي
  if (fredData.GDP && fredData.GDP.value > 0) score += 25;
  
  return Math.min(score, 100);
}
