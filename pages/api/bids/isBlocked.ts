import type { NextApiRequest, NextApiResponse } from 'next';
import { createMatrixBidBotClient } from '@ixo/matrixclient-sdk';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { collectionId, did, botUrl, accessToken } = req.body;

  try {
    const client = createMatrixBidBotClient({
      botUrl,
      accessToken,
    });

    const response = await client.bid.v1beta1.queryDidIsBlocked(collectionId, did);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
}
