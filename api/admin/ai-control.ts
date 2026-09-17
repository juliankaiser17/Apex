import type { VercelRequest, VercelResponse } from '@vercel/node';
import { apexEngine } from '../../src/ai-engine/engine';
import { aiProviderRouter } from '../../src/ai-engine/providers/providerRouter';
import { deadLetterQueue } from '../../src/ai-engine/queue/deadLetterQueue';
import { identificationCache } from '../../src/ai-engine/caching/identificationCache';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const adminSecret = process.env.ADMIN_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminSecret) {
    return res.status(500).json({ error: 'Server configuration error: ADMIN_API_KEY is not configured on server.' });
  }

  const authHeader = req.headers['x-admin-key'] || req.headers['authorization'];
  const reqKey = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

  if (!reqKey || reqKey !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized: Valid admin credentials required.' });
  }

  const action = (req.query?.action as string) || req.body?.action || 'get_telemetry';

  if (action === 'get_telemetry') {
    const telemetry = apexEngine.getTelemetry();
    const config = aiProviderRouter.getConfig();
    const dlq = deadLetterQueue.getEntries();
    return res.status(200).json({
      telemetry,
      config,
      dlq_count: dlq.length,
      dlq_entries: dlq.slice(0, 10)
    });
  }

  if (action === 'update_config' && req.method === 'POST') {
    const newConfig = req.body?.config || {};
    aiProviderRouter.updateConfig(newConfig);
    return res.status(200).json({
      success: true,
      updated_config: aiProviderRouter.getConfig()
    });
  }

  if (action === 'reset_circuit' && req.method === 'POST') {
    aiProviderRouter.resetCircuit();
    return res.status(200).json({
      success: true,
      circuit_state: aiProviderRouter.getCircuitState()
    });
  }

  if (action === 'clear_cache' && req.method === 'POST') {
    identificationCache.clear();
    return res.status(200).json({ success: true, message: 'Identification cache cleared.' });
  }

  if (action === 'run_benchmark') {
    const report = await apexEngine.runEvaluationBenchmark(100);
    return res.status(200).json({ success: true, benchmark_report: report });
  }

  if (action === 'capacity_simulation') {
    const users = Number(req.query?.users || req.body?.users || 1000000);
    const plan = apexEngine.getCapacityPlan(users);
    return res.status(200).json({ success: true, capacity_plan: plan });
  }

  return res.status(400).json({ error: 'Unknown admin action.' });
}
