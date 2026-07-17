// lib/radar/services/StorageEngine.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export class StorageEngine {
  static async saveSnapshot(symbol, price, featureVector, context) {
    try {
      const { data, error } = await supabase
        .from('feature_store')
        .insert({
          symbol,
          price,
          feature_vector: featureVector,
          context,
          label: 'PENDING'
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error saving snapshot:', error);
      return null;
    }
  }

  static async savePrediction(featureId, modelVersion, score, confidenceDist) {
    try {
      const { error } = await supabase
        .from('prediction_results')
        .insert({
          feature_id: featureId,
          model_version: modelVersion,
          predicted_score: score,
          confidence_dist: confidenceDist
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving prediction:', error);
      return false;
    }
  }
}
