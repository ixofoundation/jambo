import { AccountData, DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { utils } from '@ixo/impactxclient-sdk';
import { sha256, Secp256k1, Slip10, Slip10Curve, Bip39, EnglishMnemonic, stringToPath } from '@cosmjs/crypto';

export type SecpClient = Awaited<ReturnType<typeof getSecpClient>>;
export const getSecpClient = async (mnemonic: string) => {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'ixo',
  });
  const account = (await wallet.getAccounts())[0];

  // Debug: Derive and verify keys manually for comparison
  const seed = await Bip39.mnemonicToSeed(new EnglishMnemonic(mnemonic));
  const hdPath = stringToPath("m/44'/118'/0'/0/0");
  const slip10Result = Slip10.derivePath(Slip10Curve.Secp256k1, seed, hdPath);
  const privkey = slip10Result.privkey;
  // Derive the compressed public key from the private key
  const keypair = await Secp256k1.makeKeypair(privkey);
  const compressedPubkey = Secp256k1.compressPubkey(keypair.pubkey);
  // Log keys and addresses for comparison
  // console.log({
  //   walletPubkey: account!.pubkey ? Buffer.from(account!.pubkey).toString('hex') : 'not available',
  //   derivedPubkey: Buffer.from(compressedPubkey).toString('hex'),
  // });

  const secpClient = {
    mnemonic,
    did: utils.did.generateSecpDid(account!.address),
    baseAccount: account!,

    async getAccounts() {
      return (await wallet.getAccounts()) as AccountData[];
    },

    async signDirect(signerAddress: any, signDoc: any) {
      return await wallet.signDirect(signerAddress, signDoc);
    },

    /**
     * Sign a message with the secp256k1 private key derived from the mnemonic
     * @param message - The message to sign (usually a challenge string - base64 encoded)
     * @returns The signature as a Uint8Array
     */
    async sign(message: string): Promise<Uint8Array> {
      // Use the wallet's signDirect method to ensure consistent signing
      try {
        // Derive keypair from mnemonic directly
        const seed = await Bip39.mnemonicToSeed(new EnglishMnemonic(mnemonic));

        // NOTE: need to do checking here if it produces matched address to signed in one, maybe user is using a different derivation path
        // Use the standard Cosmos HD path (m/44'/118'/0'/0/0)
        const hdPath = stringToPath("m/44'/118'/0'/0/0");

        // Derive the private key using SLIP-10
        const { privkey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, hdPath);

        // For the challenge (base64 encoded string), decode to get the original bytes
        const challengeBytes = new Uint8Array(Buffer.from(message, 'base64'));

        // Hash the challenge bytes using SHA-256
        const messageHash = sha256(challengeBytes);

        // Sign the hash with the derived private key
        const signature = await Secp256k1.createSignature(messageHash, privkey);

        // Get the fixed-length signature, which is r (32 bytes) | s (32 bytes) | recovery param (1 byte)
        const fixedLengthSignature = signature.toFixedLength();

        // Remove the recovery parameter byte (last byte) to get only r and s
        // This gives us exactly 64 bytes which is what the verification expects
        return fixedLengthSignature.slice(0, 64);
      } catch (error) {
        console.error('Error during signature creation:', error);
        throw error;
      }
    },
  };

  return secpClient;
};
