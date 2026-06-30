// components/StockCard.js
// ─────────────────────────────────────────────
//  بطاقة السهم مع زر إضافة للمفضلة
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';

export default function StockCard({ stock }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔍 التحقق من وجود السهم في المفضلة عند تحميل البطاقة
  useEffect(() => {
    checkIfFavorite();
  }, [stock.symbol]);

  const checkIfFavorite = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/favorites/get', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        const exists = data.data.some(f => f.symbol === stock.symbol);
        setIsFavorite(exists);
      }
    } catch (error) {
      console.error('❌ خطأ في التحقق من المفضلة:', error);
    }
  };

  // ➕ إضافة للمفضلة
  const addToFavorites = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('⚠️ يرجى تسجيل الدخول أولاً');
        return;
      }

      const response = await fetch('/api/favorites/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol: stock.symbol,
          price: stock.price,
          targets: {
            t1: stock.levels?.t1,
            t2: stock.levels?.t2,
            t3: stock.levels?.t3,
          },
          stopLoss: stock.levels?.sl,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setIsFavorite(true);
        alert(`✅ تم إضافة ${stock.symbol} للمفضلة`);
      } else {
        if (data.exists) {
          alert(`⚠️ ${stock.symbol} موجود بالفعل في مفضلتك`);
        } else {
          alert(`❌ ${data.error || 'فشل الإضافة'}`);
        }
      }
    } catch (error) {
      console.error('❌ خطأ:', error);
      alert('❌ حدث خطأ، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  // ➖ حذف من المفضلة
  const removeFromFavorites = async () => {
    if (!confirm(`هل تريد حذف ${stock.symbol} من المفضلة؟`)) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('⚠️ يرجى تسجيل الدخول أولاً');
        return;
      }

      const response = await fetch('/api/favorites/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ symbol: stock.symbol }),
      });

      const data = await response.json();
      if (data.success) {
        setIsFavorite(false);
        alert(`✅ تم حذف ${stock.symbol} من المفضلة`);
      } else {
        alert(`❌ ${data.error || 'فشل الحذف'}`);
      }
    } catch (error) {
      console.error('❌ خطأ:', error);
      alert('❌ حدث خطأ، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  // 🎯 حدث الضغط على زر المفضلة
  const handleFavoriteClick = () => {
    if (isFavorite) {
      removeFromFavorites();
    } else {
      addToFavorites();
    }
  };

  // ─── واجهة البطاقة ───
  return (
    <div className="stock-card">
      {/* رأس البطاقة: رمز السهم + السعر + التغيير */}
      <div className="stock-header">
        <span className="symbol">{stock.symbol}</span>
        <span className="price">${stock.price}</span>
        <span className={`change ${stock.change_pct >= 0 ? 'positive' : 'negative'}`}>
          {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct}%
        </span>
      </div>

      {/* معلومات إضافية: EP, RSI, RVOL */}
      <div className="stock-info">
        <div className="info-item">
          <span className="label">EP</span>
          <span className="value">{stock.score || stock.ep || '—'}</span>
        </div>
        <div className="info-item">
          <span className="label">RSI</span>
          <span className="value">{stock.rsi || '—'}</span>
        </div>
        <div className="info-item">
          <span className="label">RVOL</span>
          <span className="value">{stock.rvol || '—'}</span>
        </div>
      </div>

      {/* الأهداف والوقف */}
      {stock.levels && (
        <div className="stock-levels">
          {stock.levels.t1 && (
            <div className="level target1">
              <span>🎯 TP1</span>
              <span>${stock.levels.t1}</span>
            </div>
          )}
          {stock.levels.t2 && (
            <div className="level target2">
              <span>🎯 TP2</span>
              <span>${stock.levels.t2}</span>
            </div>
          )}
          {stock.levels.t3 && (
            <div className="level target3">
              <span>🎯 TP3</span>
              <span>${stock.levels.t3}</span>
            </div>
          )}
          {stock.levels.sl && (
            <div className="level stop-loss">
              <span>🛑 وقف</span>
              <span>${stock.levels.sl}</span>
            </div>
          )}
        </div>
      )}

      {/* 🔴⭐ زر المفضلة */}
      <button
        onClick={handleFavoriteClick}
        disabled={loading}
        className={`favorite-btn ${isFavorite ? 'active' : ''}`}
      >
        {loading ? '⏳ جاري...' : (isFavorite ? '⭐ في المفضلة' : '⭐ أضف للمفضلة')}
      </button>
    </div>
  );
}
