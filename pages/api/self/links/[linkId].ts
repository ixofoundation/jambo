import type { NextApiRequest, NextApiResponse } from 'next';

import { clientIpOf, handleLinkStatus } from 'lib/self/server';
import type { SelfLinkStatusResult } from 'types/kyc';

// One delegation of at most 8,192 characters.
export const config = {
  api: { bodyParser: { sizeLimit: '12kb' } },
};

/**
 * `POST /api/self/links/:linkId`: the status of a Self identity-check link. A
 * POST, so the person's delegation travels in the body and not in a URL or a
 * header that gets logged. See lib/self/server.ts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<SelfLinkStatusResult>) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ outcome: 'error', code: 'bad_request', message: 'Method not allowed' });
  }
  try {
    const answer = await handleLinkStatus({
      linkId: req.query.linkId,
      body: req.body,
      ip: clientIpOf(req.headers, req.socket?.remoteAddress),
    });
    if (answer.retryAfterSeconds !== undefined) res.setHeader('Retry-After', String(answer.retryAfterSeconds));
    return res.status(answer.status).json(answer.body);
  } catch {
    console.error('[self-link] status failed');
    return res
      .status(500)
      .json({ outcome: 'error', code: 'unknown', message: 'Something went wrong. Please try again.' });
  }
}
