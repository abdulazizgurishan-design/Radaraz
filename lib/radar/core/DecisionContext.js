// lib/radar/core/DecisionContext.js
export class DecisionContext {
  constructor(symbol, price, data = {}) {
    // البيانات الأساسية (تحدد مرة واحدة فقط)
    this._data = {
      symbol,
      price,
      timestamp: new Date().toISOString(),
      symbolData: data.symbolData || {},
      bars: data.bars || [],
      marketData: data.marketData || {},
      sectorData: data.sectorData || {},
      features: data.features || {},
      historicalData: data.historicalData || [],
      stockDNA: data.stockDNA || null,
      portfolio: data.portfolio || null,
      executionContext: data.executionContext || {},
    };

    // النتائج (تضاف تدريجياً)
    this._brainResults = {};
    
    // القرار النهائي
    this._finalDecision = null;
    this._finalScore = 0;
    this._finalGrade = null;
  }

  // Getters (قراءة فقط)
  get symbol() { return this._data.symbol; }
  get price() { return this._data.price; }
  get timestamp() { return this._data.timestamp; }
  get symbolData() { return this._data.symbolData; }
  get bars() { return this._data.bars; }
  get marketData() { return this._data.marketData; }
  get sectorData() { return this._data.sectorData; }
  get features() { return this._data.features; }
  get historicalData() { return this._data.historicalData; }
  get stockDNA() { return this._data.stockDNA; }
  get portfolio() { return this._data.portfolio; }
  get executionContext() { return this._data.executionContext; }

  // إضافة نتيجة Brain (تُرجع نسخة جديدة)
  setBrainResult(brainName, result) {
    const newContext = this.clone();
    newContext._brainResults[brainName] = result;
    return newContext;
  }

  // إضافة نتائج متعددة
  setBrainResults(results) {
    const newContext = this.clone();
    for (const [name, result] of Object.entries(results)) {
      newContext._brainResults[name] = result;
    }
    return newContext;
  }

  getBrainResult(brainName) {
    return this._brainResults[brainName] || null;
  }

  getAllBrainResults() {
    return { ...this._brainResults };
  }

  // القرار النهائي (تُرجع نسخة جديدة)
  setDecision(decision) {
    const newContext = this.clone();
    newContext._finalDecision = decision;
    newContext._finalScore = decision?.score || 0;
    newContext._finalGrade = decision?.grade || null;
    return newContext;
  }

  getFinalDecision() {
    return this._finalDecision;
  }

  getFinalScore() {
    return this._finalScore;
  }

  getFinalGrade() {
    return this._finalGrade;
  }

  // حساب النقاط المرجحة
  getWeightedScore() {
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const [name, result] of Object.entries(this._brainResults)) {
      if (result?.score !== undefined) {
        const weight = result.weight || 1.0;
        totalScore += result.score * weight;
        totalWeight += weight;
      }
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  getConfidence() {
    let totalConfidence = 0;
    let count = 0;
    
    for (const [name, result] of Object.entries(this._brainResults)) {
      if (result?.confidence !== undefined) {
        totalConfidence += result.confidence;
        count++;
      }
    }
    
    return count > 0 ? totalConfidence / count : 0;
  }

  // Clone (للحفاظ على الـ Immutability)
  clone() {
    const newContext = new DecisionContext(this.symbol, this.price, this._data);
    newContext._brainResults = { ...this._brainResults };
    newContext._finalDecision = this._finalDecision;
    newContext._finalScore = this._finalScore;
    newContext._finalGrade = this._finalGrade;
    return newContext;
  }

  toJSON() {
    return {
      symbol: this.symbol,
      price: this.price,
      timestamp: this.timestamp,
      finalScore: this._finalScore,
      finalGrade: this._finalGrade,
      finalDecision: this._finalDecision,
      brainResults: this._brainResults,
      features: this._data.features,
    };
  }
}
