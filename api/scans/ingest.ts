import type { VercelRequest, VercelResponse } from '@vercel/node';
import { apexEngine } from '../../src/ai-engine/engine';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed: Must be POST.' });
  }

  const { imageDataUrl, userId, idempotencyKey, priority, fileName, multiFrames } = req.body || {};

  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid imageDataUrl.' });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  try {
    const response = await apexEngine.ingestScan({
      imageDataUrl,
      userId: userId || 'anon_user',
      idempotencyKey,
      priority: priority || 'HIGH',
      fileName,
      clientIp,
      multiFrames
    });

    return res.status(202).json({
      success: true,
      scan_id: response.scanId,
      status: response.status,
      queue_position: response.queuePosition,
      estimated_wait_ms: response.estimatedWaitMs,
      is_cached_hit: response.isCachedHit,
      result: response.result,
      trace_id: response.traceId
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Scan ingestion failed.',
      message: err?.message
    });
  }
}
