import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import type { AccountData, DirectSignResponse, OfflineDirectSigner } from '@cosmjs/proto-signing';

/**
 * Wraps a session wallet so CosmJS sees the user's address (for sequence/accountNumber lookup)
 * while the actual signing is done by the session key. Empty pubkey signals smart account auth
 * — the chain verifies via the selected authenticator instead of standard sig verification.
 */
export class SessionKeySigner implements OfflineDirectSigner {
  #wallet: DirectSecp256k1HdWallet;
  #userAddress: string;

  constructor(wallet: DirectSecp256k1HdWallet, userAddress: string) {
    this.#wallet = wallet;
    this.#userAddress = userAddress;
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    return [
      {
        address: this.#userAddress,
        algo: 'secp256k1' as const,
        pubkey: new Uint8Array(),
      },
    ];
  }

  async signDirect(_signerAddress: string, signDoc: any): Promise<DirectSignResponse> {
    const [account] = await this.#wallet.getAccounts();
    return this.#wallet.signDirect(account.address, signDoc);
  }
}
