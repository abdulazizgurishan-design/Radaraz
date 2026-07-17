// pages/api/feedback/loop.js
import { createClient } from '@supabase/supabase-js';

// ✅ استخدام SERVICE_ROLE_KEY
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is missing.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  console.log('🔄 بدء Feedback Loop (نسخة مبسطة)...');

  try {
    // 1. جلب الإشارات التي مضى عليها > 4 ساعات
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

    const { data: pendingRecords, error } = await supabase
      .from('feature_store')
      .select('id, symbol, price, created_at, feature_vector')
      .eq('label', 'PENDING')
      .lt('created_at', fourHoursAgo.toISOString())
      .limit(50); // حد أقصى 50 لتسريع الاختبار

    if (error) {
      console.error('❌ خطأ في جلب البيانات:', error);
      return res.status(500).json({
        error: 'Database fetch error',
        details: error.message,
      });
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      return res.status(200).json({
        message: '✅ لا توجد إشارات بحاجة للتصنيف حالياً.',
        processed: 0,
      });
    }

    console.log(`📊 جاري معالجة ${pendingRecords.length} إشارة...`);

    // 2. معالجة كل سجل (بدون الاعتماد على DataProvider)
    const updates = [];
    let successCount = 0,
      failureCount = 0,
      ignoreCount = 0;

    for (const record of pendingRecords) {
      try {
        const { id, symbol, price: entryPrice, feature_vector } = record;

        // قراءة الأهداف من feature_vector (مع قيم افتراضية)
        const entry = feature_vector?.entry ?? entryPrice;
        const stop = feature_vector?.stop ?? entryPrice * 0.95;
        const target1 = feature_vector?.target1 ?? entryPrice * 1.04;

        // 🔴 مؤقتاً: لا نجلب السعر الحقيقي، نصنف الكل كـ IGNORE
        // سنقوم بتصنيف عشوائي لأغراض الاختبار (يمكنك تعديله لاحقاً)
        const currentPrice = null; // سنفترض أننا لا نستطيع جلب السعر

        let label = 'IGNORE';
        let evaluation_reason = 'NO_DATA';
        let returnPct = 0;

        if (currentPrice === null) {
          // ⚠️ هنا نصنف عشوائياً 20% SUCCESS، 20% FAILURE، 60% IGNORE
          // فقط لتجربة الدورة (يمكنك إزالة هذا لاحقاً)
          const random = Math.random();
          if (random < 0.2) {
            label = 'SUCCESS';
            evaluation_reason = 'TEST_SUCCESS';
            successCount++;
          } else if (random < 0.4) {
            label = 'FAILURE';
            evaluation_reason = 'TEST_FAILURE';
            failureCount++;
          } else {
            label = 'IGNORE';
            evaluation_reason = 'TEST_IGNORE';
            ignoreCount++;
          }
        } else {
          // إذا كان لدينا سعر حقيقي، نصنف بناءً عليه
          returnPct = ((currentPrice - entry) / entry) * 100;
          if (currentPrice >= target1) {
            label = 'SUCCESS';
            evaluation_reason = 'TARGET1_HIT';
            successCount++;
          } else if (currentPrice <= stop) {
            label = 'FAILURE';
            evaluation_reason = 'STOP_HIT';
            failureCount++;
          } else {
            label = 'IGNORE';
            evaluation_reason = 'NO_MOVE';
            ignoreCount++;
          }
        }

        updates.push({
          id,
          label,
          forward_return_4h: parseFloat(returnPct.toFixed(2)),
          evaluation_reason,
        });
      } catch (err) {
        console.error(`❌ خطأ في معالجة ${record.symbol}:`, err.message);
        updates.push({
          id: record.id,
          label: 'IGNORE',
          forward_return_4h: 0,
          evaluation_reason: 'ERROR',
        });
        ignoreCount++;
      }
    }

    // 3. تحديث قاعدة البيانات
    if (updates.length > 0) {
      // نقسم إلى قطع صغيرة
      const chunkSize = 10;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (item) => {
            try {
              // محاولة التحديث مع evaluation_reason
              await supabase
                .from('feature_store')
                .update({
                  label: item.label,
                  forward_return_4h: item.forward_return_4h,
                  evaluation_reason: item.evaluation_reason,
                })
                .eq('id', item.id);
            } catch (updateErr) {
              // إذا فشل بسبب عدم وجود العمود، نحاول بدونه
              if (updateErr.message && updateErr.message.includes('evaluation_reason')) {
                console.warn('⚠️ عمود evaluation_reason غير موجود، يتم التحديث بدونه.');
                await supabase
                  .from('feature_store')
                  .update({
                    label: item.label,
                    forward_return_4h: item.forward_return_4h,
                  })
                  .eq('id', item.id);
              } else {
                throw updateErr;
              }
            }
          })
        );
      }
    }

    // 4. الإخراج
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ انتهت الدورة خلال ${duration} ثانية.`);

    res.status(200).json({
      message: '✅ تم التصنيف بنجاح (باستخدام بيانات عشوائية للاختبار).',
      processed: pendingRecords.length,
      success: successCount,
      failure: failureCount,
      ignore: ignoreCount,
      duration: `${duration}s`,
      note: 'هذه النسخة تستخدم تصنيفاً عشوائياً مؤقتاً لأن DataProvider غير متاح.',
    });
  } catch (error) {
    console.error('❌ خطأ عام:', error);
    res.status(500).json({
      error: 'فشل في تشغيل دورة التغذية الراجعة',
      details: error.message,
      stack: error.stack,
    });
  }
}
