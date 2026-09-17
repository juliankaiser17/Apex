import type { VercelRequest, VercelResponse } from '@vercel/node';
import { apexEngine } from '../../src/ai-engine/engine';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed: Must be POST.' });
  }

  const { scanId, userId, predictedVehicleId, correctMake, correctModel, correctGeneration, correctTrim, feedbackNotes } = req.body || {};

  if (!scanId || !correctMake || !correctModel) {
    return res.status(400).json({ error: 'Missing required correction fields.' });
  }

  apexEngine.submitCorrection({
    scanId,
    userId: userId || 'anon',
    predictedVehicleId,
    correctMake,
    correctModel,
    correctGeneration,
    correctTrim,
    feedbackNotes
  });

  return res.status(200).json({
    success: true,
    message: 'Correction recorded. Thank you for training Apex.'
  });
}
