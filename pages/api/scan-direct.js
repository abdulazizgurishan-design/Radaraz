// pages/api/scan-direct.js
// ============================================================
// RadarAZ - Scan Direct (يتجاوز FilterEngine للتشخيص)
// ============================================================
import { dataProvider } from '../../lib/radar/core/DataProvider';
import { SCAN_CONFIG } from '../../lib/radar/core/config.js';

export default async function handler(req, res) {
  console.log('🔍 [SCAN-DIRECT] بدء التشغيل...');

  try {
    // 1. جلب البيانات
    const universe = await dataProvider.getUniverse();
    console.log(`🔍 [SCAN-DIRECT] Universe length: ${universe.length}`);

    if (!universe || universe.length === 0) {
      return res.status(200).json({
        error: 'لا توجد بيانات',
        totalScanned: 0,
      });
    }

    // 2. عرض عينة من البيانات
    const sample = universe.slice(0, 5).map(s => ({
      symbol: s.symbol,
      price: s.price,
      volume: s.volume,
      dollar_vol: s.dollar_vol,
      change_pct: s.change_pct,
      avgVolume: s.avgVolume,
      open: s.open,
      prevClose: s.prevClose,
    }));
    console.log('🔍 [SCAN-DIRECT] Sample:', JSON.stringify(sample, null, 2));

    // 3. تطبيق الفلاتر مباشرة (بدون FilterEngine)
    // ✅ استخدام نفس القيم الافتراضية من SCAN_CONFIG
    const minPrice = SCAN_CONFIG.MIN_PRICE || 2;
    const minVolume = SCAN_CONFIG.MIN_VOLUME || 200000;
    const minDollarVol = SCAN_CONFIG.MIN_DOLLAR_VOL || 1000000; // ✅ متوافق مع الإعداد الافتراضي
    const maxChangePct = 15;

    // 3.1 فلتر السعر
    const priceFiltered = universe.filter(s => Number(s.price) >= minPrice);
    console.log(`🔍 [SCAN-DIRECT] After PRICE (>= ${minPrice}): ${priceFiltered.length}`);

    // 3.2 فلتر الحجم
    const volumeFiltered = priceFiltered.filter(s => Number(s.volume) >= minVolume);
    console.log(`🔍 [SCAN-DIRECT] After VOLUME (>= ${minVolume}): ${volumeFiltered.length}`);

    // 3.3 فلتر السيولة
    const dollarFiltered = volumeFiltered.filter(s => {
      const dollar = Number(s.dollar_vol ?? (s.price * s.volume));
      return dollar >= minDollarVol;
    });
    console.log(`🔍 [SCAN-DIRECT] After DOLLAR (>= ${minDollarVol}): ${dollarFiltered.length}`);

    // 3.4 فلتر التغير
    const changeFiltered = dollarFiltered.filter(s => Math.abs(Number(s.change_pct)) <= maxChangePct);
    console.log(`🔍 [SCAN-DIRECT] After CHANGE (<= ${maxChangePct}%): ${changeFiltered.length}`);

    // ✅ 3.5 عداد الأسهم التي تفتقر إلى avgVolume (قبل فلتر RVOL)
    const missingAvgVolume = changeFiltered.filter(s => !Number(s.avgVolume) || Number(s.avgVolume) <= 0).length;
    console.log(`🔍 [SCAN-DIRECT] Missing avgVolume: ${missingAvgVolume} out of ${changeFiltered.length}`);

    // 3.6 فلتر RVOL (تجاوز إذا لم تكن البيانات متوفرة)
    const rvolFiltered = changeFiltered.filter(s => {
      const avgVol = Number(s.avgVolume ?? 0);
      if (avgVol <= 0) return true;
      return (s.volume / avgVol) >= 1.5;
    });
    console.log(`🔍 [SCAN-DIRECT] After RVOL: ${rvolFiltered.length}`);

    // 3.7 فلتر Gap
    const gapFiltered = rvolFiltered.filter(s => {
      const open = Number(s.open ?? 0);
      const prev = Number(s.prevClose ?? 0);
      if (prev <= 0) return true;
      const gap = ((open - prev) / prev) * 100;
      return Math.abs(gap) <= 5;
    });
    console.log(`🔍 [SCAN-DIRECT] After GAP: ${gapFiltered.length}`);

    // 3.8 النتيجة النهائية
    const finalResults = gapFiltered.slice(0, 100);
    console.log(`🔍 [SCAN-DIRECT] FINAL: ${finalResults.length} سهم`);

    // 4. عرض النتائج
    const resultSymbols = finalResults.map(s => ({
      symbol: s.symbol,
      price: s.price,
      volume: s.volume,
      dollar_vol: s.dollar_vol,
      change_pct: s.change_pct,
    }));

    res.status(200).json({
      totalScanned: universe.length,
      priceFiltered: priceFiltered.length,
      volumeFiltered: volumeFiltered.length,
      dollarFiltered: dollarFiltered.length,
      changeFiltered: changeFiltered.length,
      missingAvgVolume: missingAvgVolume,
      rvolFiltered: rvolFiltered.length,
      gapFiltered: gapFiltered.length,
      finalCount: finalResults.length,
      sample: resultSymbols.slice(0, 10),
    });
  } catch (error) {
    console.error('❌ [SCAN-DIRECT] Error:', error);
    res.status(500).json({ error: error.message });
  }
}
