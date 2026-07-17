// lib/radar/services/StorageEngine.js
import { createClient } from '@supabase/supabase-js';

// ✅ استخدام SERVICE_ROLE_KEY إلزامي (بدون Fallback)
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export class StorageEngine {
  /**
   * ✅ Bulk Insert للـ Snapshots مع إرجاع temp_id -> id
   */
  static async saveSnapshotsBulk(snapshotsArray) {
    if (!snapshotsArray || snapshotsArray.length === 0) return [];

    try {
      // استخراج البيانات النظيفة (بدون temp_id)
      const cleanData = snapshotsArray.map(({ temp_id, ...rest }) => ({
        ...rest,
        label: 'PENDING'
      }));

      const { data, error } = await supabase
        .from('feature_store')
        .insert(cleanData)
        .select('id');

      if (error) throw error;

      // ربط النتائج بالـ temp_id الأصلي (الترتيب مضمون)
      return snapshotsArray.map((item, index) => ({
        temp_id: item.temp_id,
        id: data[index]?.id
      })).filter(item => item.id !== undefined);

    } catch (error) {
      console.error('❌ Bulk Insert فشل:', error);
      return [];
    }
  }

  /**
   * ✅ Bulk Insert للـ Predictions
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
