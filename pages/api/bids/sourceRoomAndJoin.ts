import type { NextApiRequest, NextApiResponse } from 'next';
import { createMatrixRoomBotClient } from '@ixo/matrixclient-sdk';
import { createQueryClient } from '@ixo/impactxclient-sdk';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { roomId, collectionId, did, address, bidId, botUrl, accessToken, homeServerUrl } = req.body;
  console.log('sourceRoomAndJoin', {
    did,
    homeServerUrl,
    botUrl,
    accessToken,
  });
  try {
    const client = await createQueryClient('http://localhost:26657');
    const collection = await client.ixo.claims.v1beta1.collection({ id: '1' });
    console.log('collection', collection);
    const entity = await client.ixo.entity.v1beta1.entity({ id: did });
    console.log('entity', entity);
    const roomBotClient = createMatrixRoomBotClient({
      homeServerUrl,
      botUrl,
      accessToken,
    });

    const response = await roomBotClient.room.v1beta1.sourceRoomAndJoin(did);
    console.log('response', response);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: (error as Error).message });
  }
}
