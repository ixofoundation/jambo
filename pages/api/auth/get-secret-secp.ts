import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { secpResult, address } = req.body;

  try {
    // Get encrypted mnemonic from Matrix room
    const response = await fetch(`${process.env.NEXT_PUBLIC_MATRIX_ROOM_BOT_URL}/room/mnemonic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomAlias: `did-ixo-${address}`,
        secpResult,
        address,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch encrypted mnemonic');
    }

    const { encryptedMnemonic, roomId } = await response.json();
    res.json({ encryptedMnemonic, roomId, address });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
