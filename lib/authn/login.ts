import { createSigningClient, ixo, utils } from '@ixo/impactxclient-sdk';
import cbor from 'cbor';
import { OfflineSigner } from '@cosmjs/proto-signing';
import { createMatrixApiClient } from '@ixo/matrixclient-sdk';
import { ExpectedAttestationResult } from 'fido2-lib';

import { decrypt } from '@utils/encryption';

interface LoginPasskeyParams {
  address: string;
  password: string;
  authnResult: any;
}

export async function loginPasskey({ address, password, authnResult }: LoginPasskeyParams) {
  if (!address) {
    throw new Error('No address provided.');
  }

  // Verify and get encrypted mnemonic
  const response = await fetch(`/api/auth/get-secret`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // roomAlias: `did-ixo-${address}`,
      authnResult: authnResult,
      address,
    }),
  });
  console.log('response', response);
  if (!response.ok) {
    response.json().then(console.log).catch(console.error);
    throw new Error('Failed to fetch encrypted mnemonic');
  }

  const { encryptedMnemonic, roomId } = await response.json();
  console.log('encryptedMnemonic', encryptedMnemonic);
  // Decrypt mnemonic and create wallet
  const mnemonic = decrypt(encryptedMnemonic, password);
  console.log({ mnemonic });
  // const wallet = await getSecpClient(mnemonic);

  return {
    mnemonic,
    roomId,
  };
}
