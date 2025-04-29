import { base64url } from 'jose';
import { NextApiRequest, NextApiResponse } from 'next';
import { fido2 } from '../../../lib/authn/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Generate a new login challenge
    const loginOptions = await fido2.assertionOptions();

    // Get this from api so that datetime is always correct, device time can be off
    // Encode challenge for transmission and add Large Blob extension
    const encodedLoginOptions = {
      ...loginOptions,
      // Include address in challenge and ensure date is in UTC timezone
      challenge: base64url.encode(`${new Date().toISOString()}`),
      // challenge: base64url.encode(loginOptions.challenge as Buffer),
    };

    res.json(encodedLoginOptions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
}
