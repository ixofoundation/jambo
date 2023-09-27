import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';

export enum ChainNetwork {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  DEVNET = 'devnet',
}

export const FEEGRANT_URLS = {
  [ChainNetwork.MAINNET]: 'https://feegrant.ixo.world',
  [ChainNetwork.TESTNET]: 'https://feegrant.testnet.ixo.earth',
  [ChainNetwork.DEVNET]: 'https://feegrant.devnet.ixo.earth/',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Method not allowed
  }

  const { address, chainNetwork } = req.body;

  const feegrantAPI = axios.create({
    baseURL: FEEGRANT_URLS[chainNetwork],
    headers: { Authorization: process.env.AUTH_TOKEN_FEEGRANT }, // will generate token for you shortly
  });

  try {
    const resp = await feegrantAPI.post(`feegrant/${address}`, {});

    if ((resp.data as any).code !== 0) {
      throw new Error('Feegrant message unsuccessful');
    }

    res.status(200).json(resp.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
