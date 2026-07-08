// components/BotControls.js
// أزرار التحكم بالبوت

import { useState, useEffect } from 'react';

export default function BotControls({ t }) {
  const [status, setStatus] = useState({
    isActive: false,
    enabled: false,
    positions: 0,
    maxPositions: 10,
    dailyPL: 0,
    trades: 0,
  });
  
  const [loading, setLoading] = useState(false);
  
  // جلب حالة البوت
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/bot-status');
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching bot status:', error);
    }
  };
  
  // تحديث الحالة كل 10 ثوانٍ
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);
  
  // تشغيل البوت
  const startBot = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      if (data.status === 'active') {
        await fetchStatus();
      }
    } catch (error) {
      console.error('Error starting bot:', error);
    }
    setLoading(false);
  };
  
  // إيقاف البوت
  const stopBot = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const data = await res.json();
      if (data.status === 'inactive') {
        await fetchStatus();
      }
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
    setLoading(false);
  };
  
  // إعادة تعيين
  const resetPL = async () => {
    try {
      await fetch('/api/bot-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      await fetchStatus();
    } catch (error) {
      console.error('Error resetting:', error);
    }
  };
  
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.icon}>🤖</span>
        <span style={styles.title}>{t.botTitle || 'البوت الآلي'}</span>
        <span style={{
          ...styles.status,
          color: status.isActive ? '#34d399' : '#f87171',
        }}>
          {status.isActive ? '🟢 يعمل' : '🔴 متوقف'}
        </span>
      </div>
      
      <div style={styles.stats}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>الصفقات المفتوحة</span>
          <span style={styles.statValue}>{status.positions}/{status.maxPositions}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>إجمالي الصفقات</span>
          <span style={styles.statValue}>{status.trades}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>الربح/الخسارة اليومي</span>
          <span style={{
            ...styles.statValue,
            color: status.dailyPL >= 0 ? '#34d399' : '#f87171',
          }}>
            ${status.dailyPL.toFixed(2)}
          </span>
        </div>
      </div>
      
      <div style={styles.actions}>
        {!status.isActive ? (
          <button
            onClick={startBot}
            disabled={loading}
            style={styles.startBtn}
          >
            {loading ? '⟳ جاري التشغيل...' : '▶️ تشغيل البوت'}
          </button>
        ) : (
          <button
            onClick={stopBot}
            disabled={loading}
            style={styles.stopBtn}
          >
            {loading ? '⟳ جاري الإيقاف...' : '⏹️ إيقاف البوت'}
          </button>
        )}
        <button onClick={resetPL} style={styles.resetBtn}>
          🔄 إعادة تعيين
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'rgba(15,20,35,0.95)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 16,
    padding: '16px 20px',
    marginBottom: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  icon: { fontSize: 24 },
  title: { fontSize: 16, fontWeight: 700, color: '#e2e8f0' },
  status: { fontSize: 13, fontWeight: 600, marginLeft: 'auto' },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 12,
  },
  stat: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: '8px 12px',
    textAlign: 'center',
  },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  statValue: { fontSize: 16, fontWeight: 700, color: '#e2e8f0', display: 'block' },
  actions: {
    display: 'flex',
    gap: 8,
  },
  startBtn: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: 8,
    background: 'linear-gradient(135deg, #34d399, #059669)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  stopBtn: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: 8,
    background: 'linear-gradient(135deg, #f87171, #dc2626)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  resetBtn: {
    padding: '10px 16px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
  },
};
