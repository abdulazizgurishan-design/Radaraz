// pages/favorites.js
// ─────────────────────────────────────────────
//  صفحة عرض المفضلة
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // جلب المفضلة عند تحميل الصفحة
  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('يرجى تسجيل الدخول أولاً');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/favorites/get', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setFavorites(data.data || []);
      } else {
        setError(data.error || 'فشل جلب المفضلة');
      }
    } catch (error) {
      console.error('❌ خطأ:', error);
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  // تحديث الأسعار كل دقيقة
  useEffect(() => {
    const interval = setInterval(fetchFavorites, 60000);
    return () => clearInterval(interval);
  }, []);

  // حذف من المفضلة
  const handleDelete = async (symbol) => {
    if (!confirm(`هل تريد حذف ${symbol} من المفضلة؟`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/favorites/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ symbol }),
      });

      const data = await response.json();
      if (data.success) {
        setFavorites(favorites.filter(f => f.symbol !== symbol));
        alert(`✅ تم حذف ${symbol} من المفضلة`);
      } else {
        alert(data.error || 'فشل الحذف');
      }
    } catch (error) {
      console.error('❌ خطأ:', error);
      alert('حدث خطأ في الحذف');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">⏳ جاري تحميل المفضلة...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">❌ {error}</div>
        <button onClick={fetchFavorites} className="refresh-btn">🔄 إعادة المحاولة</button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>⭐ المفضلة - RadarAZ</title>
      </Head>

      <div className="favorites-container">
        <div className="favorites-header">
          <h1>⭐ مفضلتي</h1>
          <span className="count">{favorites.length} سهم</span>
          <button onClick={fetchFavorites} className="refresh-btn">
            🔄 تحديث
          </button>
        </div>

        {favorites.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h2>لا توجد أسهم في المفضلة</h2>
            <p>أضف أسهمك المفضلة من صفحة المسح</p>
            <a href="/" className="go-back">🔍 اذهب للمسح</a>
          </div>
        ) : (
          <div className="favorites-grid">
            {favorites.map((fav) => (
              <FavoriteCard
                key={fav.id}
                favorite={fav}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── بطاقة السهم في المفضلة ───
function FavoriteCard({ favorite, onDelete }) {
  const isProfit = favorite.is_profit;
  const changeColor = isProfit ? '#22c55e' : '#ef4444';
  const changeSign = isProfit ? '+' : '';

  const getStatusEmoji = (status) => {
    if (status.includes('تم الوصول')) return '✅';
    if (status.includes('كسر الوقف')) return '⚠️';
    return '⏳';
  };

  return (
    <div className="favorite-card">
      <div className="card-header">
        <span className="symbol">{favorite.symbol}</span>
        <span className={`status ${favorite.status.includes('تم') ? 'achieved' : 'active'}`}>
          {getStatusEmoji(favorite.status)} {favorite.status}
        </span>
      </div>

      <div className="card-body">
        <div className="price-row">
          <div className="price-item">
            <span className="label">📌 سعر الإضافة</span>
            <span className="value">${favorite.entry_price}</span>
          </div>
          <div className="price-item">
            <span className="label">💰 السعر الحالي</span>
            <span className="value" style={{ color: changeColor }}>
              ${favorite.current_price}
            </span>
          </div>
          <div className="price-item change">
            <span className="label">التغيير</span>
            <span className={`change-value ${isProfit ? 'green' : 'red'}`}>
              {changeSign}{favorite.change_percent}%
            </span>
          </div>
        </div>

        <div className="targets-row">
          {favorite.target1 && (
            <div className="target">
              <span>🎯 TP1</span>
              <span>${favorite.target1}</span>
              {favorite.current_price >= favorite.target1 && ' ✅'}
            </div>
          )}
          {favorite.target2 && (
            <div className="target">
              <span>🎯 TP2</span>
              <span>${favorite.target2}</span>
              {favorite.current_price >= favorite.target2 && ' ✅'}
            </div>
          )}
          {favorite.target3 && (
            <div className="target">
              <span>🎯 TP3</span>
              <span>${favorite.target3}</span>
              {favorite.current_price >= favorite.target3 && ' ✅'}
            </div>
          )}
          {favorite.stop_loss && (
            <div className="target stop-loss">
              <span>🛑 وقف</span>
              <span>${favorite.stop_loss}</span>
              {favorite.current_price <= favorite.stop_loss && ' ⚠️'}
            </div>
          )}
        </div>

        <div className="card-footer">
          <span className="date">
            📅 أضيف: {new Date(favorite.added_at).toLocaleDateString('ar-SA')}
          </span>
          <button 
            onClick={() => onDelete(favorite.symbol)}
            className="delete-btn"
          >
            🗑️ حذف
          </button>
        </div>
      </div>
    </div>
  );
}
