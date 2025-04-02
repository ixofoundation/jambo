import type { NextApiRequest, NextApiResponse } from 'next';
import { createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { collectionId, claim, botUrl, accessToken } = req.body;
  console.log('saveClaim', {
    collectionId,
    claim,
  });
  try {
    const client = createMatrixClaimBotClient({
      botUrl,
      accessToken,
    });

    const response = await client.claim.v1beta1.saveClaim(collectionId, claim);
    console.log('response', response);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: (error as Error).message });
  }
}
