import type { VercelRequest, VercelResponse } from '@vercel/node';
import { apexEngine } from '../../src/ai-engine/engine';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const scanId = (req.query?.scanId as string) || req.body?.scanId;

  if (!scanId) {
    return res.status(400).json({ error: 'Missing scanId parameter.' });
  }

  const statusObj = apexEngine.getScanStatus(scanId);

  return res.status(200).json({
    scan_id: scanId,
    status: statusObj.status,
    queue_position: statusObj.queuePosition,
    result: statusObj.result,
    error: statusObj.error
  });
}
