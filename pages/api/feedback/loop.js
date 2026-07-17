// pages/api/feedback/loop.js
import { createClient } from '@supabase/supabase-js';
import { DataProvider } from '../../../lib/radar/core/DataProvider';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is missing.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_CONCURRENT = 5;

export default async function handler(req, res) {
  // ✅ 1. تعريف startTime هنا (أصلح الخطأ السابق)
  const startTime = Date.now();
  console.log('🔄 بدء دورة التغذية الراجعة (النسخة النظيفة)...');

  try {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

    const { data: pendingRecords, error } = await supabase
      .from('feature_store')
      .select('id, symbol, price, created_at, feature_vector, context')
      .eq('label', 'PENDING')
      .lt('created_at', fourHoursAgo.toISOString())
      .limit(200);

    if (error) {
      console.error('❌ خطأ في جلب البيانات:', error);
      return res.status(500).json({ error: 'Database fetch error', details: error.message });
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      return res.status(200).json({
        message: '✅ لا توجد إشارات بحاجة للتصنيف حالياً.',
        processed: 0,
      });
    }

    console.log(`📊 جاري تصنيف ${pendingRecords.length} إشارة...`);

    const updates = [];
    let successCount = 0, failureCount = 0, ignoreCount = 0;

    // معالجة كل سجل
    const processRecord = async (record) => {
      try {
        const { id, symbol, price: entryPrice, feature_vector, created_at } = record;

        // استخراج الأهداف (بقيم افتراضية آمنة)
        const entry = feature_vector?.entry ?? entryPrice;
        const stop = feature_vector?.stop ?? entryPrice * 0.95;
        const target1 = feature_vector?.target1 ?? entryPrice * 1.04;

        let currentPrice = null;
        let label = 'IGNORE';
        let evaluation_reason = 'NO_DATA';
        let returnPct = 0;

        // محاولة جلب السعر (فقط إذا كانت الدوال موجودة)
        try {
          if (typeof DataProvider.getBars === 'function') {
            const start = new Date(created_at);
            const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
            const bars = await DataProvider.getBars(symbol, '5min', 1, {
              start: start.toISOString(),
              end: end.toISOString(),
            });
            if (bars?.length) currentPrice = parseFloat(bars[bars.length - 1].close);
          }

          if (currentPrice === null && typeof DataProvider.getQuote === 'function') {
            const quote = await DataProvider.getQuote(symbol);
            if (quote?.close) currentPrice = parseFloat(quote.close);
          }
        } catch (priceErr) {
          console.warn(`⚠️ فشل في جلب سعر ${symbol}:`, priceErr.message);
        }

        // ✅ التصنيف الواقعي (بدون Random)
        if (currentPrice === null) {
          // لا توجد بيانات -> تجاهل آمن (لا نلوث التعلم)
          ignoreCount++;
        } else {
          returnPct = ((currentPrice - entry) / entry) * 100;

          if (currentPrice >= target1) {
            label = 'SUCCESS';
            evaluation_reason = 'TARGET1_HIT';
            successCount++;
          } else if (currentPrice <= stop) {
            label = 'FAILURE';
            evaluation_reason = 'STOP_HIT';
            failureCount++;
          } else if (returnPct >= 0.5) {
            label = 'IGNORE';
            evaluation_reason = 'POSITIVE_BUT_NO_TARGET';
            ignoreCount++;
          } else if (returnPct <= -0.5) {
            label = 'IGNORE';
            evaluation_reason = 'NEGATIVE_BUT_NO_STOP';
            ignoreCount++;
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
        console.error(`❌ خطأ في تصنيف ${record.symbol}:`, err.message);
        updates.push({
          id: record.id,
          label: 'IGNORE',
          forward_return_4h: 0,
          evaluation_reason: 'ERROR',
        });
        ignoreCount++;
      }
    };

    // معالجة متزامنة محدودة
    for (let i = 0; i < pendingRecords.length; i += MAX_CONCURRENT) {
      const chunk = pendingRecords.slice(i, i + MAX_CONCURRENT);
      await Promise.all(chunk.map(processRecord));
    }

    // تحديث قاعدة البيانات (دفعات)
    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += 10) {
        const chunk = updates.slice(i, i + 10);
        await Promise.all(
          chunk.map(async (item) => {
            try {
              // ✅ محاولة التحديث مع evaluation_reason
              await supabase
                .from('feature_store')
                .update({
                  label: item.label,
                  forward_return_4h: item.forward_return_4h,
                  evaluation_reason: item.evaluation_reason,
                })
                .eq('id', item.id);
            } catch (updateErr) {
              // ✅ إذا كان الخطأ بسبب عدم وجود العمود، نحدّث بدونه
              if (updateErr.message?.includes('evaluation_reason')) {
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

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ انتهت الدورة خلال ${duration} ثانية.`);

    res.status(200).json({
      message: '✅ تم التصنيف بنجاح.',
      processed: pendingRecords.length,
      success: successCount,
      failure: failureCount,
      ignore: ignoreCount,
      duration: `${duration}s`,
    });

  } catch (error) {
    console.error('❌ خطأ عام:', error);
    // ✅ إرجاع تفاصيل الخطأ للمطور (لتراها في المتصفح)
    res.status(500).json({
      error: 'فشل في تشغيل دورة التغذية الراجعة',
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    });
  }
}
