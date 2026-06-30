// pages/api/favorites/get.js
// ─────────────────────────────────────────────
//  جلب مفضلة المستخدم مع الأسعار الحالية
// ─────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const POLYGON_KEY = process.env.POLYGON_API_KEY;

export default async function handler(req, res) {
  // 1️⃣ نسمح فقط بـ GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'الطريقة غير مسموحة' });
  }

  try {
    // 2️⃣ التحقق من المستخدم
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'جلسة غير صالحة' });
    }

    // 3️⃣ جلب المفضلة من قاعدة البيانات
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false });

    if (error) {
      console.error('❌ خطأ في جلب المفضلة:', error);
      return res.status(500).json({ error: 'فشل جلب المفضلة' });
    }

    // 4️⃣ إذا كانت المفضلة فارغة
    if (!favorites || favorites.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'لا توجد أسهم في المفضلة'
      });
    }

    // 5️⃣ جلب الأسعار الحالية من Polygon
    const symbols = favorites.map(f => f.symbol).join(',');
    const prices = await getCurrentPrices(symbols);

    // 6️⃣ دمج البيانات
    const result = favorites.map(fav => {
      const currentPrice = prices[fav.symbol] || fav.entry_price;
      const change = currentPrice - fav.entry_price;
      const changePercent = fav.entry_price > 0 
        ? (change / fav.entry_price) * 100 
        : 0;

      // تحديد الحالة تلقائياً
      let status = fav.status;
      if (fav.target1 && currentPrice >= fav.target1) {
        status = 'تم الوصول للهدف الأول ✅';
      } else if (fav.stop_loss && currentPrice <= fav.stop_loss) {
        status = 'تم كسر الوقف ❌';
      }

      return {
        ...fav,
        current_price: currentPrice,
        change: +change.toFixed(2),
        change_percent: +changePercent.toFixed(2),
        is_profit: change > 0,
        status: status,
        updated_at: new Date().toISOString(),
      };
    });

    // 7️⃣ رد النجاح
    return res.status(200).json({
      success: true,
      data: result,
      total: result.length,
    });

  } catch (error) {
    console.error('❌ خطأ عام:', error);
    return res.status(500).json({ error: 'حدث خطأ غير متوقع' });
  }
}

// ─── مساعد: جلب الأسعار الحالية من Polygon ───
async function getCurrentPrices(symbols) {
  try {
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${symbols}&apiKey=${POLYGON_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = await res.json();
    
    const prices = {};
    for (const ticker of data.tickers || []) {
      const price = ticker.day?.c || ticker.min?.c || ticker.lastTrade?.p || 0;
      if (price > 0) {
        prices[ticker.ticker] = price;
      }
    }
    return prices;
  } catch (error) {
    console.error('❌ خطأ في جلب الأسعار:', error);
    return {};
  }
}
