import type { NextApiRequest, NextApiResponse } from 'next';
import { createMatrixBidBotClient } from '@ixo/matrixclient-sdk';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { collectionId, did, bidId, botUrl, accessToken } = req.body;
  console.log('rejectBid', {
    collectionId,
    did,
    bidId,
  });
  try {
    const client = createMatrixBidBotClient({
      botUrl,
      accessToken,
    });

    const response = await client.bid.v1beta1.rejectBid(bidId, collectionId, did, 'Testing rejection');
    console.log('response', response);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: (error as Error).message });
  }
}
