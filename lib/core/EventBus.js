// lib/radar/core/EventBus.js
export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.history = [];
  }

  // تسجيل مستمع
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.unsubscribe(event, callback);
  }

  // إلغاء تسجيل مستمع
  unsubscribe(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, callbacks);
  }

  // إصدار حدث
  emit(event, data) {
    const eventData = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    // تسجيل الحدث
    this.history.push(eventData);
    if (this.history.length > 1000) this.history.shift();

    // تنبيه المستمعين
    if (!this.listeners.has(event)) return;
    for (const callback of this.listeners.get(event)) {
      try {
        callback(eventData);
      } catch (error) {
        console.error(`EventBus: Error in listener for ${event}:`, error.message);
      }
    }
  }

  // استرجاع الأحداث
  getHistory(event) {
    if (event) {
      return this.history.filter(h => h.event === event);
    }
    return this.history;
  }

  // تنظيف
  clear() {
    this.history = [];
  }
}
