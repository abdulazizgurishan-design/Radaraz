// pages/api/feedback/loop.js
import { createClient } from '@supabase/supabase-js';
import { DataProvider } from '../../../lib/radar/core/DataProvider';
import { SCAN_CONFIG } from '../../../lib/radar/core/config.js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is missing.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_CONCURRENT = 5;

export default async function handler(req, res) {
  const startTime = Date.now();
  console.log('🔄 [Feedback v20] بدء دورة التغذية الراجعة...');

  try {
    const holdingPeriodHours = SCAN_CONFIG.DEFAULT_HOLDING_PERIOD_HOURS || 4;
    const evaluationCutoff = new Date(Date.now() - holdingPeriodHours * 60 * 60 * 1000);

    const { data: pendingRecords, error } = await supabase
      .from('feature_store')
      .select('id, symbol, price, snapshot_timestamp, full_snapshot, evaluation_status')
      .is('success', null)
      .lt('snapshot_timestamp', evaluationCutoff.toISOString())
      .in('evaluation_status', ['PENDING', null])
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
    let successCount = 0,
      failureCount = 0,
      expiredCount = 0,
      noDataCount = 0;

    const processRecord = async (record) => {
      try {
        const { id, symbol, price: entryPrice, full_snapshot } = record;
        const fv = full_snapshot?.feature_vector || {};
        const entry = fv.entry ?? entryPrice;
        const stop = fv.stop ?? entryPrice * 0.95;
        const target1 = fv.target1 ?? entryPrice * 1.04;

        let high = null,
          low = null,
          lastClose = null;

        try {
          if (typeof DataProvider.getBars === 'function') {
            const start = new Date(record.snapshot_timestamp);
            const end = new Date(start.getTime() + holdingPeriodHours * 60 * 60 * 1000);
            const bars = await DataProvider.getBars(symbol, '5min', 50, {
              start: start.toISOString(),
              end: end.toISOString(),
            });

            if (bars && bars.length > 0) {
              high = Math.max(...bars.map(b => parseFloat(b.high)));
              low = Math.min(...bars.map(b => parseFloat(b.low)));
              // ✅ آخر سعر من نفس البيانات (بدون طلب إضافي)
              lastClose = parseFloat(bars[bars.length - 1].close);
            }
          }
        } catch (priceErr) {
          console.warn(`⚠️ فشل في جلب بيانات ${symbol}:`, priceErr.message);
        }

        let success = null;
        let evaluation_reason = 'NO_DATA';
        let returnPct = 0;
        let evaluation_status = 'EVALUATED';

        if (high !== null && low !== null && lastClose !== null) {
          returnPct = ((lastClose - entry) / entry) * 100;

          if (high >= target1) {
            success = true;
            evaluation_reason = 'TARGET1_HIT';
            successCount++;
          } else if (low <= stop) {
            success = false;
            evaluation_reason = 'STOP_HIT';
            failureCount++;
          } else {
            success = false;
            evaluation_reason = 'EXPIRED';
            expiredCount++;
          }
        } else {
          success = null;
          evaluation_reason = 'NO_DATA';
          evaluation_status = 'NO_DATA';
          noDataCount++;
        }

        updates.push({
          id,
          success,
          forward_return_4h: parseFloat(returnPct.toFixed(2)),
          evaluation_reason,
          evaluation_status,
          evaluated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`❌ خطأ في تصنيف ${record.symbol}:`, err.message);
        updates.push({
          id: record.id,
          success: null,
          forward_return_4h: 0,
          evaluation_reason: 'ERROR',
          evaluation_status: 'ERROR',
          evaluated_at: new Date().toISOString(),
        });
      }
    };

    for (let i = 0; i < pendingRecords.length; i += MAX_CONCURRENT) {
      const chunk = pendingRecords.slice(i, i + MAX_CONCURRENT);
      await Promise.all(chunk.map(processRecord));
    }

    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += 10) {
        const chunk = updates.slice(i, i + 10);
        await Promise.all(
          chunk.map(async (item) => {
            const updateData = {
              forward_return_4h: item.forward_return_4h,
              evaluation_reason: item.evaluation_reason,
              evaluation_status: item.evaluation_status,
              evaluated_at: item.evaluated_at,
            };
            if (item.success !== null) {
              updateData.success = item.success;
            }
            await supabase
              .from('feature_store')
              .update(updateData)
              .eq('id', item.id);
          })
        );
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ انتهت الدورة خلال ${duration} ثانية.`);

    res.status(200).json({
      message: '✅ تم التصنيف بنجاح.',
      processed: pendingRecords.length,
      updated: updates.length,
      success: successCount,
      failure: failureCount,
      expired: expiredCount,
      noData: noDataCount,
      duration: `${duration}s`,
    });
  } catch (error) {
    console.error('❌ خطأ عام:', error);
    res.status(500).json({
      error: 'فشل في تشغيل دورة التغذية الراجعة',
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    });
  }
}
