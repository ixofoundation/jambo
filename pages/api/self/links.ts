import type { NextApiRequest, NextApiResponse } from 'next';

import { clientIpOf, handleCreateLink } from 'lib/self/server';
import type { SelfLinkCreateResult } from 'types/kyc';

// Two delegations of at most 8,192 characters each and a nonce: anything larger is not for this route.
export const config = {
  api: { bodyParser: { sizeLimit: '24kb' } },
};

/**
 * `POST /api/self/links`: a single-use Self identity-check link for the person
 * who signed the delegations in the body. See lib/self/server.ts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<SelfLinkCreateResult>) {
  // The answer carries a bearer link: never cached.
  res.setHeader('Cache-Control', 'no-store');
  // The clock probe (utils/self/serverTime.ts): the browser reads this answer's
  // `Date` header to learn how far its own clock is off. Nothing else happens.
  if (req.method === 'HEAD') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ outcome: 'error', code: 'bad_request', message: 'Method not allowed' });
  }
  try {
    const answer = await handleCreateLink({
      body: req.body,
      ip: clientIpOf(req.headers, req.socket?.remoteAddress),
    });
    if (answer.retryAfterSeconds !== undefined) res.setHeader('Retry-After', String(answer.retryAfterSeconds));
    return res.status(answer.status).json(answer.body);
  } catch {
    // No detail to the client or the log: an error here could carry a token.
    console.error('[self-link] create failed');
    return res
      .status(500)
      .json({ outcome: 'error', code: 'unknown', message: 'Something went wrong. Please try again.' });
  }
}
