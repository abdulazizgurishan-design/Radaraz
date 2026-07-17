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

const MAX_CONCURRENT = 10; // معالجة 10 سجلات بالتوازي

export default async function handler(req, res) {
  const startTime = Date.now();
  console.log('🔄 بدء دورة التغذية الراجعة (Feedback Loop)...');

  try {
    // 1. جلب الإشارات التي مضى عليها > 4 ساعات
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

    const { data: pendingRecords, error } = await supabase
      .from('feature_store')
      .select('id, symbol, price, created_at, feature_vector, context')
      .eq('label', 'PENDING')
      .lt('created_at', fourHoursAgo.toISOString())
      .limit(200);

    if (error) throw error;
    if (!pendingRecords?.length) {
      return res.status(200).json({
        message: '✅ لا توجد إشارات بحاجة للتصنيف حالياً.',
        processed: 0,
      });
    }

    console.log(`📊 جاري تصنيف ${pendingRecords.length} إشارة...`);

    const updates = [];
    let successCount = 0,
      failureCount = 0,
      ignoreCount = 0;

    // 2. معالجة كل سجل
    const processRecord = async (record) => {
      try {
        const { id, symbol, price: entryPrice, feature_vector, created_at } = record;

        // استخراج الأهداف من feature_vector
        const entry = feature_vector?.entry ?? entryPrice;
        const stop = feature_vector?.stop ?? entryPrice * 0.95;
        const target1 = feature_vector?.target1 ?? entryPrice * 1.04;

        // جلب السعر بعد 4 ساعات
        const currentPrice = await getPriceAfterTimestamp(symbol, created_at);

        let label = 'IGNORE';
        let evaluation_reason = 'NO_DATA';

        if (currentPrice === null) {
          evaluation_reason = 'NO_DATA';
        } else {
          const returnPct = ((currentPrice - entry) / entry) * 100;

          if (currentPrice >= target1) {
            label = 'SUCCESS';
            evaluation_reason = 'TARGET1_HIT';
            successCount++;
          } else if (currentPrice <= stop) {
            label = 'FAILURE';
            evaluation_reason = 'STOP_HIT';
            failureCount++;
          } else if (returnPct >= 0.5) {
            // تحرك إيجابي لكن لم يصل للهدف
            label = 'IGNORE';
            evaluation_reason = 'POSITIVE_BUT_NO_TARGET';
            ignoreCount++;
          } else if (returnPct <= -0.5) {
            // تحرك سلبي لكن لم يصل للوقف
            label = 'IGNORE';
            evaluation_reason = 'NEGATIVE_BUT_NO_STOP';
            ignoreCount++;
          } else {
            label = 'IGNORE';
            evaluation_reason = 'NO_MOVE';
            ignoreCount++;
          }

          // تحديث forward_return_4h
          updates.push({
            id,
            label,
            forward_return_4h: parseFloat(returnPct.toFixed(2)),
            evaluation_reason,
          });
        }

        // إذا كان currentPrice === null
        if (currentPrice === null) {
          updates.push({
            id,
            label: 'IGNORE',
            forward_return_4h: 0,
            evaluation_reason: 'NO_DATA',
          });
          ignoreCount++;
        }
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

    // 3. تحديث قاعدة البيانات (دفعات)
    if (updates.length > 0) {
      // نقسم التحديثات إلى قطع صغيرة (10 لكل قطعة) لتجنب الضغط
      const updateChunks = [];
      for (let i = 0; i < updates.length; i += 10) {
        updateChunks.push(updates.slice(i, i + 10));
      }

      for (const chunk of updateChunks) {
        await Promise.all(
          chunk.map(async (item) => {
            await supabase
              .from('feature_store')
              .update({
                label: item.label,
                forward_return_4h: item.forward_return_4h,
                evaluation_reason: item.evaluation_reason,
              })
              .eq('id', item.id);
          })
        );
      }
    }

    // 4. الإخراج
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
    console.error('❌ خطأ عام في Feedback Loop:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// دالة مساعدة لجلب السعر بعد 4 ساعات
// ============================================================
async function getPriceAfterTimestamp(symbol, timestamp) {
  try {
    if (typeof DataProvider.getBars !== 'function') {
      console.warn('⚠️ DataProvider.getBars غير موجود.');
      return null;
    }

    const startTime = new Date(timestamp);
    const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);

    const bars = await DataProvider.getBars(symbol, '5min', 1, {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    });

    if (bars?.length) {
      return parseFloat(bars[bars.length - 1].close);
    }

    if (typeof DataProvider.getQuote === 'function') {
      const quote = await DataProvider.getQuote(symbol);
      if (quote?.close) return parseFloat(quote.close);
    }

    return null;
  } catch (error) {
    console.warn(`⚠️ تعذر جلب السعر لـ ${symbol}:`, error.message);
    return null;
  }
}
