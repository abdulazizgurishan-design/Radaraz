// lib/radar/core/PositionSizingEngine.js
export class PositionSizingEngine {
  constructor(config = {}) {
    this.config = {
      riskPerTrade: config.riskPerTrade || 0.02, // 2% من المحفظة
      maxPositionPct: config.maxPositionPct || 0.25,
      minPositionPct: config.minPositionPct || 0.03,
      maxLossPct: config.maxLossPct || 0.08,
      ...config,
    };
  }

  calculate(price, stop, equity, score, confidence) {
    const riskPerShare = Math.abs(price - stop);
    if (riskPerShare <= 0) {
      return this._emptyResult(price);
    }

    // حجم المركز الأساسي (2% من المحفظة)
    let riskAmount = equity * this.config.riskPerTrade;

    // تعديل حسب الثقة
    const confidenceFactor = 0.7 + (confidence / 100) * 0.3;
    riskAmount *= confidenceFactor;

    // تعديل حسب السكور
    const scoreFactor = 0.6 + (score / 100) * 0.4;
    riskAmount *= scoreFactor;

    // عدد الأسهم
    let shares = Math.floor(riskAmount / riskPerShare);
    const positionValue = shares * price;

    // التأكد من الحد الأدنى والحد الأقصى
    const maxValue = equity * this.config.maxPositionPct;
    const minValue = equity * this.config.minPositionPct;

    let finalShares = shares;
    let finalValue = positionValue;

    if (finalValue > maxValue) {
      finalShares = Math.floor(maxValue / price);
      finalValue = finalShares * price;
    } else if (finalValue < minValue && finalValue > 0) {
      return this._emptyResult(price, 'Position size below minimum');
    }

    if (finalShares < 1) {
      return this._emptyResult(price, 'Not enough capital');
    }

    const maxLoss = finalShares * riskPerShare;
    const maxLossPct = (maxLoss / equity) * 100;

    return {
      shares: finalShares,
      positionValue: Math.round(finalValue * 100) / 100,
      riskAmount: Math.round(riskAmount * 100) / 100,
      riskPerShare: Math.round(riskPerShare * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      maxLossPct: Math.round(maxLossPct * 100) / 100,
      equity,
      price,
      stop,
      confidence: Math.round(confidence),
      score: Math.round(score),
      valid: true,
    };
  }

  _emptyResult(price, reason = '') {
    return {
      shares: 0,
      positionValue: 0,
      riskAmount: 0,
      riskPerShare: 0,
      maxLoss: 0,
      maxLossPct: 0,
      price,
      valid: false,
      reason,
    };
  }
}
