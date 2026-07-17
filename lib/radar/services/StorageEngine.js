// lib/radar/services/StorageEngine.js
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export class StorageEngine {
  /**
   * ✅ Bulk Insert مع إرجاع id فقط (الترتيب مضمون)
   */
  static async saveSnapshotsBulk(snapshotsArray) {
    if (!snapshotsArray || snapshotsArray.length === 0) return [];

    try {
      const cleanData = snapshotsArray.map(item => ({
        symbol: item.symbol,
        price: item.price,
        feature_vector: item.feature_vector,
        context: item.context,
        label: 'PENDING'
      }));

      const { data, error } = await supabase
        .from('feature_store')
        .insert(cleanData)
        .select('id');

      if (error) throw error;

      // ✅ نعيد مصفوفة تحتوي على { id } فقط، بنفس الترتيب
      return data.map(row => ({ id: row.id }));
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
