// lib/radar/services/StorageEngine.js
import { createClient } from '@supabase/supabase-js';

// ✅ استخدام SERVICE_ROLE_KEY لتجاوز سياسات RLS (أسرع وأكثر أماناً في API)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY // Fallback آمن
);

export class StorageEngine {
  /**
   * ✅ Bulk Insert للـ Snapshots (بدون full_snapshot)
   */
  static async saveSnapshotsBulk(snapshotsArray) {
    if (!snapshotsArray || snapshotsArray.length === 0) return [];
    try {
      // نقوم بتنظيف البيانات للتأكد من عدم وجود full_snapshot
      const cleanData = snapshotsArray.map(item => ({
        symbol: item.symbol,
        price: item.price,
        feature_vector: item.feature_vector, // فقط الـ Feature Vector المنظف
        context: item.context,
        label: 'PENDING'
      }));

      const { data, error } = await supabase
        .from('feature_store')
        .insert(cleanData)
        .select('id, symbol');

      if (error) throw error;
      return data; // يعيد [{ id, symbol }]
    } catch (error) {
      console.error('❌ Bulk Insert فشل:', error);
      return [];
    }
  }

  /**
   * ✅ Bulk Insert للـ Predictions (يرتبط بـ feature_id)
   */
  static async savePredictionsBulk(predictionsArray) {
    if (!predictionsArray || predictionsArray.length === 0) return false;
    try {
      const { error } = await supabase
        .from('prediction_results')
        .insert(predictionsArray);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Bulk Insert Predictions فشل:', error);
      return false;
    }
  }
}
