import { ixo } from '@ixo/impactxclient-sdk';
import cbor from 'cbor';
import { ExpectedAttestationResult } from 'fido2-lib';

import { fido2 } from './client';
import { SecpClient } from '@utils/secp';
import { base64urlEncode } from '@utils/encoding';
import { extractDataFromAuthData } from './utils';
import { decodeGrants, isAllowanceExpired, isAllowanceLimitReached, queryAddressAllowances } from '@utils/feegrant';
import { signAndBroadcastWithMnemonic } from '@utils/transaction';

interface RegisterPasskeyParams {
  wallet: SecpClient;
}

export async function registerPasskey({ wallet }: RegisterPasskeyParams) {
  const accountAddress = wallet?.baseAccount?.address;
  if (!accountAddress) {
    throw new Error('No account found');
  }

  // Generate registration options
  const registrationOptions = await fido2.attestationOptions();
  console.log('registrationOptions');
  console.log(registrationOptions);

  // Create registration options
  const publicKeyCredentialCreationOptions = {
    ...registrationOptions,
    user: {
      // @ts-ignore
      id: Uint8Array.from(accountAddress, (c) => c.charCodeAt(0)),
      name: accountAddress,
      displayName: accountAddress,
    },
  };

  // Register the credential
  const credential: any = await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions as any,
  });
  if (!credential) {
    throw new Error('Credential creation failed');
  }
  console.log('credential');
  console.log(credential);
  const rawPublicKey = new Uint8Array(credential.response?.getPublicKey());
  // @ts-ignore
  const publicKeyEncoded = base64urlEncode(rawPublicKey);
  console.log({ publicKeyEncoded });

  // Prepare expected parameters for attestation result verification
  const expectedAttestationResult: ExpectedAttestationResult = {
    challenge: base64urlEncode(registrationOptions.challenge),
    origin: process.env.NEXT_PUBLIC_AUTHN_ORIGIN!,
    rpId: process.env.NEXT_PUBLIC_AUTHN_RP_ID,
    factor: 'either',
  };

  // Extract public key from attestation object
  const attestationObject = credential.response.attestationObject;
  const decodedAttestationObject = cbor.decodeAllSync(attestationObject)[0];
  const authData = decodedAttestationObject.authData;
  const { algorithm, rpIdHash } = extractDataFromAuthData(authData);

  // Verify attestation response
  await fido2.attestationResult(credential, expectedAttestationResult);

  // Create AuthnPubKey object
  const authnPubKey = ixo.smartaccount.crypto.AuthnPubKey.encode(
    ixo.smartaccount.crypto.AuthnPubKey.fromPartial({
      keyId: credential.id,
      key: rawPublicKey,
      coseAlgorithm: algorithm,
    }),
  ).finish();

  // MsgAddAuthenticator
  const allowances = await queryAddressAllowances(wallet.baseAccount.address);
  const feegrantGranter = allowances?.length
    ? decodeGrants(allowances)?.find(
        (allowance) =>
          !!allowance &&
          !isAllowanceExpired(allowance.expiration as number) &&
          !isAllowanceLimitReached(allowance.limit),
      )?.granter
    : undefined;
  const result = await signAndBroadcastWithMnemonic({
    offlineSigner: wallet,
    messages: [
      {
        typeUrl: '/ixo.smartaccount.v1beta1.MsgAddAuthenticator',
        value: ixo.smartaccount.v1beta1.MsgAddAuthenticator.fromPartial({
          sender: accountAddress,
          authenticatorType: 'AuthnVerification',
          data: authnPubKey,
        }),
      },
    ],
    memo: 'Register passkey as authenticator',
    feegrantGranter,
  });

  console.log('result', result);

  return { result, credentialId: credential.id };
}
