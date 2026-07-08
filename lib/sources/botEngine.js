// lib/botEngine.js
// محرك البوت الآلي

export class BotEngine {
  constructor() {
    this.config = {
      maxPositions: 10,
      riskPerTrade: 2,
      maxDailyLoss: 5,
      minScore: 65,
      minRR: 1.5,
      enabled: false,
    };
    
    this.positions = [];
    this.dailyPL = 0;
    this.trades = [];
    this.isActive = false;
  }
  
  // ─── تشغيل البوت ──────────────────────────────────────────────
  start() {
    this.isActive = true;
    this.config.enabled = true;
    console.log('🤖 Bot started');
    return { status: 'active', message: 'Bot is now running' };
  }
  
  // ─── إيقاف البوت ──────────────────────────────────────────────
  stop() {
    this.isActive = false;
    this.config.enabled = false;
    console.log('🛑 Bot stopped');
    return { status: 'inactive', message: 'Bot is stopped' };
  }
  
  // ─── تنفيذ صفقة ──────────────────────────────────────────────
  async executeTrade(signal) {
    if (!this.isActive) {
      return { error: 'Bot is inactive', trade: null };
    }
    
    // التحقق من الشروط
    const check = this.checkConditions(signal);
    if (!check.passed) {
      return { error: check.reason, trade: null };
    }
    
    // حساب حجم الصفقة
    const size = this.calculatePositionSize(signal);
    
    // إنشاء الصفقة
    const trade = {
      id: `T${Date.now()}`,
      symbol: signal.symbol,
      entry: signal.price,
      stop: signal.levels?.sl || signal.price * 0.92,
      target1: signal.levels?.t1 || signal.price * 1.03,
      target2: signal.levels?.t2 || signal.price * 1.06,
      target3: signal.levels?.t3 || signal.price * 1.10,
      size: size,
      timestamp: new Date().toISOString(),
      status: 'open',
      entryPrice: signal.price,
      currentPrice: signal.price,
      pl: 0,
      plPercent: 0,
      score: signal.ep || 0,
      recommendation: signal.recommendation || 'BUY',
    };
    
    this.positions.push(trade);
    this.trades.push(trade);
    
    // إرسال إشعار
    await this.sendNotification(trade);
    
    return { success: true, trade };
  }
  
  // ─── التحقق من شروط الدخول ──────────────────────────────────
  checkConditions(signal) {
    // 1. البوت مفعل؟
    if (!this.config.enabled) {
      return { passed: false, reason: 'Bot is disabled' };
    }
    
    // 2. عدد الصفقات المفتوحة
    if (this.positions.length >= this.config.maxPositions) {
      return { passed: false, reason: 'Max positions reached' };
    }
    
    // 3. الحد الأقصى للخسارة اليومية
    if (this.dailyPL < -this.config.maxDailyLoss) {
      return { passed: false, reason: 'Daily loss limit reached' };
    }
    
    // 4. درجة الإشارة
    const score = signal.ep || signal.scores?.total || 0;
    if (score < this.config.minScore) {
      return { passed: false, reason: `Score ${score} < ${this.config.minScore}` };
    }
    
    // 5. نسبة المخاطرة/العائد
    const rr = signal.levels?.rr || signal.structure?.rr || 0;
    if (rr < this.config.minRR) {
      return { passed: false, reason: `RR ${rr} < ${this.config.minRR}` };
    }
    
    return { passed: true };
  }
  
  // ─── حساب حجم الصفقة ─────────────────────────────────────────
  calculatePositionSize(signal) {
    // رأس المال الافتراضي (سيتم ربطه بالحساب الحقيقي لاحقاً)
    const capital = 100000;
    const riskAmount = capital * (this.config.riskPerTrade / 100);
    const riskPerShare = signal.price - (signal.levels?.sl || signal.price * 0.92);
    const shares = riskAmount / riskPerShare;
    return Math.floor(shares);
  }
  
  // ─── إرسال إشعار ─────────────────────────────────────────────
  async sendNotification(trade) {
    const message = `
🤖 **Trade Executed**
📊 ${trade.symbol}
💰 Entry: $${trade.entry}
🎯 Target: $${trade.target1}
🛑 Stop: $${trade.stop}
📈 Score: ${trade.score}
📦 Size: ${trade.size} shares
    `;
    
    console.log('📩 Notification:', message);
    
    // يمكن إضافة Telegram/Webhook هنا
    // await sendTelegram(message);
  }
  
  // ─── تحديث الصفقات ────────────────────────────────────────────
  updatePositions(prices) {
    let totalPL = 0;
    
    for (const pos of this.positions) {
      if (pos.status !== 'open') continue;
      
      const currentPrice = prices[pos.symbol] || pos.entryPrice;
      pos.currentPrice = currentPrice;
      pos.pl = (currentPrice - pos.entryPrice) * pos.size;
      pos.plPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
      
      totalPL += pos.pl;
      
      // التحقق من الأهداف
      if (currentPrice >= pos.target1 && pos.status === 'open') {
        // هدف أول محقق
        console.log(`🎯 Target 1 reached for ${pos.symbol}`);
      }
      
      if (currentPrice >= pos.target2) {
        console.log(`🎯 Target 2 reached for ${pos.symbol}`);
      }
      
      if (currentPrice >= pos.target3) {
        // هدف ثالث محقق → إغلاق الصفقة
        this.closeTrade(pos.id, currentPrice, 'Target 3 reached');
      }
      
      // التحقق من وقف الخسارة
      if (currentPrice <= pos.stop && pos.status === 'open') {
        this.closeTrade(pos.id, currentPrice, 'Stop loss hit');
      }
    }
    
    this.dailyPL = totalPL;
    return this.positions;
  }
  
  // ─── إغلاق صفقة ──────────────────────────────────────────────
  closeTrade(tradeId, exitPrice, reason) {
    const index = this.positions.findIndex(p => p.id === tradeId);
    if (index === -1) return null;
    
    const trade = this.positions[index];
    trade.status = 'closed';
    trade.exitPrice = exitPrice;
    trade.closeReason = reason;
    trade.pl = (exitPrice - trade.entryPrice) * trade.size;
    trade.plPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
    
    console.log(`🔒 Closed ${trade.symbol}: ${reason} | PL: $${trade.pl.toFixed(2)}`);
    
    // إزالة من الصفقات المفتوحة
    this.positions.splice(index, 1);
    
    return trade;
  }
  
  // ─── الحصول على حالة البوت ──────────────────────────────────
  getStatus() {
    return {
      isActive: this.isActive,
      enabled: this.config.enabled,
      positions: this.positions.length,
      maxPositions: this.config.maxPositions,
      dailyPL: this.dailyPL,
      maxDailyLoss: this.config.maxDailyLoss,
      trades: this.trades.length,
    };
  }
  
  // ─── إعادة تعيين الخسارة اليومية ────────────────────────────
  resetDailyPL() {
    this.dailyPL = 0;
    console.log('🔄 Daily P&L reset');
  }
}

// تصدير نسخة واحدة (Singleton)
let botInstance = null;

export function getBot() {
  if (!botInstance) {
    botInstance = new BotEngine();
  }
  return botInstance;
}
