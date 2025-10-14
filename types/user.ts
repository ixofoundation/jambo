export type USER = {
  name?: string;
  pubKey: Uint8Array;
  address: string;
  algo?: string;
  ledgered?: boolean;
  did?: string;
  network?: 'mainnet' | 'testnet' | 'devnet';
  matrix?: {
    accessToken: string;
    userId: string;
    roomId: string;
    address: string;
  };
};
