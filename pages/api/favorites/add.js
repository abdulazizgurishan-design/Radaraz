// pages/api/favorites/add.js
// ─────────────────────────────────────────────
//  إضافة سهم للمفضلة مع تثبيت السعر والأهداف
// ─────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

// إعدادات Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // 1️⃣ نسمح فقط بـ POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'الطريقة غير مسموحة' });
  }

  try {
    // 2️⃣ جلب بيانات المستخدم من التوكن
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
    }

    // 3️⃣ فك تشفير التوكن (نفترض أنك تستخدم JWT)
    // ملاحظة: إذا كنت تستخدم Supabase Auth، استخدم getUser()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return res.status(401).json({ error: 'جلسة غير صالحة' });
    }

    // 4️⃣ جلب البيانات من الطلب
    const { symbol, price, targets, stopLoss, notes } = req.body;

    if (!symbol || !price) {
      return res.status(400).json({ error: 'الرمز والسعر مطلوبان' });
    }

    // 5️⃣ التحقق من عدم التكرار
    const { data: existing, error: checkError } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('symbol', symbol)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ 
        error: 'هذا السهم موجود بالفعل في مفضلتك',
        exists: true 
      });
    }

    // 6️⃣ حفظ في قاعدة البيانات
    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        entry_price: parseFloat(price),
        current_price: parseFloat(price),
        target1: targets?.t1 || null,
        target2: targets?.t2 || null,
        target3: targets?.t3 || null,
        stop_loss: parseFloat(stopLoss) || null,
        notes: notes || null,
        status: 'مراقبة',
      })
      .select()
      .single();

    if (error) {
      console.error('❌ خطأ في الحفظ:', error);
      return res.status(500).json({ error: 'فشل الحفظ في قاعدة البيانات' });
    }

    // 7️⃣ رد النجاح
    console.log(`✅ تم إضافة ${symbol} لمفضلة المستخدم ${user.email}`);
    return res.status(200).json({
      success: true,
      message: `تم إضافة ${symbol} للمفضلة`,
      data: data
    });

  } catch (error) {
    console.error('❌ خطأ عام:', error);
    return res.status(500).json({ error: 'حدث خطأ غير متوقع' });
  }
}
