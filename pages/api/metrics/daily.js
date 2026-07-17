// pages/api/metrics/daily.js
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is missing.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    let modelVersion = 'v20';
    try {
      const { data: modelData } = await supabase
        .from('model_registry')
        .select('version')
        .eq('status', 'CHAMPION')
        .single();
      if (modelData?.version) modelVersion = modelData.version;
    } catch {
      // تجاهل
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: dailyStats, error: statsError } = await supabase
      .from('feature_store')
      .select('success, evaluation_reason, forward_return_4h, full_snapshot, evaluation_status')
      .gte('snapshot_timestamp', today.toISOString())
      .lt('snapshot_timestamp', tomorrow.toISOString());

    if (statsError) throw statsError;

    const total = dailyStats?.length || 0;
    const successCount = dailyStats?.filter(r => r.success === true).length || 0;
    const failureCount = dailyStats?.filter(r => r.success === false).length || 0;
    const pendingCount = dailyStats?.filter(r => r.success === null).length || 0;

    const reasons = {};
    dailyStats?.forEach(r => {
      const reason = r.evaluation_reason || 'UNKNOWN';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });

    const returns = dailyStats
      ?.map(r => r.forward_return_4h)
      .filter(r => r !== null && r !== undefined) || [];
    const avgReturn = returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;

    const classified = successCount + failureCount;
    const winRate = classified > 0 ? (successCount / classified) * 100 : 0;

    const targetSourceBreakdown = {};
    dailyStats?.forEach(r => {
      const source = r.full_snapshot?.feature_vector?.target_source || 'unknown';
      targetSourceBreakdown[source] = (targetSourceBreakdown[source] || 0) + 1;
    });

    const statusBreakdown = {};
    dailyStats?.forEach(r => {
      const status = r.evaluation_status || 'PENDING';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    res.status(200).json({
      date: today.toISOString().split('T')[0],
      modelVersion,
      total,
      classified,
      pending: pendingCount,
      success: successCount,
      failure: failureCount,
      winRate: Number(winRate.toFixed(2)),
      avgReturn: Number(avgReturn.toFixed(2)),
      reasons,
      targetSourceBreakdown,
      evaluationStatus: statusBreakdown,
    });
  } catch (error) {
    console.error('❌ خطأ في جلب المقاييس:', error);
    res.status(500).json({ error: error.message });
  }
}
