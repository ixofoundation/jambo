import { AccountData, OfflineDirectSigner, DirectSignResponse } from '@cosmjs/proto-signing';
import { makeSignBytes } from '@cosmjs/proto-signing';
import { sha256 } from '@cosmjs/crypto';

import { base64urlDecode, base64urlEncode } from '../../utils/encoding';

export interface PasskeyOfflineDirectSignerOptions {
  address: string;
  credentialId: string;
  credentialRequestOptions: any;
}

/**
 * An implementation of OfflineDirectSigner that uses WebAuthn/passkeys for transaction signing
 * It can be used to sign transactions offline
 * It can only be used for one address at a time, which correlates to the PasskeyOfflineDirectSignerOptions on creation
 *
 * Parameters:
 * - address: The address to sign for, aka the address the smart account is registered to
 * - credentialId: The credential ID to use for signing
 * - credentialRequestOptions: The credential request options to use for signing through webauthn
 *   - challenge will be overridden by the generate challenge in offline signer
 *   - allowCredentials will be set to the credentialId
 *
 * NOTE: when used for singing (signingClient.sign or signingClient.signAndBroadcast) it requires:
 * - manual txBodyBytes with already added nonCriticalExtensionOptions for smart account
 * - message array can be empty since it won't be used, txBodyBytes will be used instead
 * - fee must be of type stdFee, meaning you need to manually calculate simulated fee
 *   either with signingClient.getUsedFee and use the stdFee returned or signingClient.simulate and
 *   use that to create a stdFee. When doing simulations, must pass messages and not txBodyBytes
 *   since chain throws error when simulating txBodyBytes with nonCriticalExtensionOptions
 */
export class PasskeyOfflineDirectSigner implements OfflineDirectSigner {
  private readonly options: PasskeyOfflineDirectSignerOptions;

  constructor(options: PasskeyOfflineDirectSignerOptions) {
    this.options = options;
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    return [
      {
        address: this.options.address,
        // Algo not used for passkey, will be ignored
        algo: 'secp256k1',
        // Empty pubkey since not used for passkey
        pubkey: new Uint8Array(),
      },
    ];
  }

  async signDirect(signerAddress: string, signDoc: any): Promise<DirectSignResponse> {
    console.log('signDirect', signerAddress, signDoc);
    if (signerAddress !== this.options.address) {
      throw new Error(`Address ${signerAddress} not found in wallet`);
    }

    // Convert the SignDoc to sign bytes
    const signBytes = makeSignBytes(signDoc);

    // Sign the transaction using the passkey
    // ------------------------------------------------
    // Compute the SHA-256 hash of the signBytes
    const challengeHash = sha256(signBytes); // (32 bytes)

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      ...this.options.credentialRequestOptions,
      challenge: challengeHash,
      allowCredentials: [
        {
          type: 'public-key',
          id: base64urlDecode(this.options.credentialId),
        },
      ],
    };
    console.log({ publicKeyCredentialRequestOptions });

    // Get assertion
    const assertion: any = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });
    console.log({ assertion });

    // Prepare signature data
    const signatureData = {
      authenticatorData: base64urlEncode(assertion.response.authenticatorData),
      clientDataJSON: base64urlEncode(assertion.response.clientDataJSON),
      signature: base64urlEncode(assertion.response.signature),
    };
    // ------------------------------------------------

    // Convert the signature data to a base64 string, which signing client expects
    const signature = Buffer.from(JSON.stringify(signatureData)).toString('base64');

    return {
      signed: signDoc,
      signature: {
        pub_key: {
          type: 'tendermint/PubKeySecp256k1',
          // Can leave this empty, since it's not used
          value: '',
        },
        signature,
      },
    };
  }
}
