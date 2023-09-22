import axios from 'axios';

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

export default async (req, res) => {
    try {
        const { address, network } = req.body;
        const AUTH_TOKEN_FEEGRANT = process.env.AUTH_TOKEN_FEEGRANT;
        if (!AUTH_TOKEN_FEEGRANT) {
            return res.status(500).json({ error: 'AUTH_TOKEN_FEEGRANT is not defined' });
        }
        const feegrantAPI = axios.create({
            baseURL: FEEGRANT_URLS[network],
            headers: { Authorization: `Bearer ${AUTH_TOKEN_FEEGRANT}` },
        });
        const resp = await feegrantAPI.post(`feegrant/${address}`, {});
        if (resp.data.code !== 0) {
            return res.status(500).json({ error: 'Feegrant message unsuccessful' });
        }
        return res.status(200).json(resp.data);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};