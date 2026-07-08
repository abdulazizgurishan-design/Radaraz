// lib/analyzer.js
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
    
    scores.technical = calculateTechnicalScore(stock);
    
    const fundamental = externalData?.fundamentals?.find(f => f.symbol === stock.symbol);
    if (fundamental) {
      scores.fundamental = calculateFundamentalScore(fundamental);
    }
    
    if (externalData?.reddit) {
      scores.sentiment = calculateSentimentScore(stock.symbol, externalData.reddit);
    }
    
    if (externalData?.fred) {
      scores.macro = calculateMacroScore(externalData.fred);
    }
    
    scores.total = (
      scores.technical * 0.40 +
      scores.fundamental * 0.25 +
      scores.sentiment * 0.20 +
      scores.macro * 0.15
    );
    
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
  
  return results.sort((a, b) => b.scores.total - a.scores.total);
}

function calculateTechnicalScore(stock) {
  let score = 0;
  if (stock.rvol > 5) score += 20;
  else if (stock.rvol > 3) score += 15;
  else if (stock.rvol > 1.5) score += 8;
  
  if (stock.changePct > 5) score += 20;
  else if (stock.changePct > 3) score += 15;
  else if (stock.changePct > 2) score += 8;
  
  if (stock.rsi >= 50 && stock.rsi <= 68) score += 20;
  else if (stock.rsi >= 45 && stock.rsi < 50) score += 10;
  else if (stock.rsi > 68 && stock.rsi <= 72) score += 5;
  
  if (stock.ep >= 80) score += 20;
  else if (stock.ep >= 70) score += 15;
  else if (stock.ep >= 60) score += 8;
  
  if (stock.structure?.rr >= 2) score += 20;
  else if (stock.structure?.rr >= 1.5) score += 15;
  else if (stock.structure?.rr >= 1.2) score += 8;
  
  return Math.min(score, 100);
}

function calculateFundamentalScore(data) {
  let score = 0;
  if (data.pe && data.pe > 0 && data.pe < 15) score += 25;
  else if (data.pe && data.pe >= 15 && data.pe < 25) score += 15;
  else if (data.pe && data.pe >= 25 && data.pe < 35) score += 5;
  
  if (data.revenueGrowth && data.revenueGrowth > 25) score += 25;
  else if (data.revenueGrowth && data.revenueGrowth > 15) score += 15;
  else if (data.revenueGrowth && data.revenueGrowth > 5) score += 8;
  
  if (data.analystRating === 'strong_buy') score += 25;
  else if (data.analystRating === 'buy') score += 18;
  else if (data.analystRating === 'hold') score += 8;
  
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
      const normalized = Math.min((found.score / 50) * 100, 100);
      totalScore += normalized;
      count++;
    }
  }
  
  return count > 0 ? Math.round(totalScore / count) : 0;
}

function calculateMacroScore(fredData) {
  let score = 0;
  if (fredData.CPIAUCSL && fredData.CPIAUCSL.value < 3) score += 25;
  else if (fredData.CPIAUCSL && fredData.CPIAUCSL.value < 4) score += 15;
  
  if (fredData.UNRATE && fredData.UNRATE.value < 4) score += 25;
  else if (fredData.UNRATE && fredData.UNRATE.value < 5) score += 15;
  
  if (fredData.FEDFUNDS && fredData.FEDFUNDS.value < 3) score += 25;
  else if (fredData.FEDFUNDS && fredData.FEDFUNDS.value < 5) score += 15;
  
  if (fredData.GDP && fredData.GDP.value > 0) score += 25;
  
  return Math.min(score, 100);
}
