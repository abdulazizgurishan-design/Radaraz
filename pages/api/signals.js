// pages/api/signals.js
// ============================================================
// نقطة قراءة خفيفة — يستدعيها المشترك (الواجهة) بدل /api/scan.
// لا تُشغّل مسحاً ولا تلمس Polygon: تقرأ أحدث دفعة من latest_signals فقط.
//   /api/signals            → القسم الرئيسي (main)
//   /api/signals?type=lowprice → قسم الأسهم منخفضة السعر
//
// مستدام: عند أي خطأ يرجّع 200 بقوائم فارغة (لا يكسر الواجهة).
// ============================================================

import { StorageEngine } from '../../lib/radar/services/StorageEngine';

export default async function handler(req, res) {
  try {
    const scanType = req.query.type === 'lowprice' ? 'lowprice' : 'main';
    const { batchId, ready, breakouts } = await StorageEngine.getLatestSignals(scanType);

    res.status(200).json({
      signals: ready,        // التوصيات الجاهزة (استباقية)
      breakouts,             // الاختراقات الجارية (تنبيه)
      meta: {
        scan_type: scanType,
        batch: batchId,
        totalSignals: ready.length,
        totalBreakouts: breakouts.length,
        source: 'latest_signals',
        served_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ /api/signals:', error);
    // نرجّع 200 فارغاً حتى لا تنكسر الواجهة عند أي خلل مؤقت.
    res.status(200).json({
      signals: [],
      breakouts: [],
      meta: { error: error.message, source: 'latest_signals' },
    });
  }
}
