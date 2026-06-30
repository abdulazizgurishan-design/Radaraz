// pages/api/favorites/delete.js
// ─────────────────────────────────────────────
//  حذف سهم من المفضلة
// ─────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // 1️⃣ نسمح فقط بـ DELETE
  if (req.method !== 'DELETE') {
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

    // 3️⃣ جلب البيانات من الطلب
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'الرمز مطلوب' });
    }

    // 4️⃣ الحذف من قاعدة البيانات (مع التأكد من user_id)
    const { data, error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('symbol', symbol.toUpperCase())
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'السهم غير موجود في مفضلتك' });
      }
      console.error('❌ خطأ في الحذف:', error);
      return res.status(500).json({ error: 'فشل الحذف' });
    }

    // 5️⃣ رد النجاح
    console.log(`✅ تم حذف ${symbol} من مفضلة المستخدم ${user.email}`);
    return res.status(200).json({
      success: true,
      message: `تم حذف ${symbol} من المفضلة`,
      data: data
    });

  } catch (error) {
    console.error('❌ خطأ عام:', error);
    return res.status(500).json({ error: 'حدث خطأ غير متوقع' });
  }
}
