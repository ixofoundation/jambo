import { createQueryClient, customMessages, ixo, utils } from '@ixo/impactxclient-sdk';
import { AccountData, OfflineSigner } from '@cosmjs/proto-signing';
import base58 from 'bs58';

import { CHAIN_RPC_URL } from '../constants/common';
import { decodeGrants, isAllowanceExpired, isAllowanceLimitReached, queryAddressAllowances } from './feegrant';
import { signAndBroadcastWithMnemonic } from './transaction';

/**
 * Checks if an iid document (did) exists
 * @param did - The did to check for
 * @returns True if the iid document exists, false otherwise
 */
export async function checkIidDocumentExists(did: string) {
  try {
    const queryClient = await createQueryClient(CHAIN_RPC_URL);
    const iidDocumentResponse = await queryClient.ixo.iid.v1beta1.iidDocument({ id: did });
    if (!iidDocumentResponse?.iidDocument?.id) {
      return false;
    }
    return true;
  } catch (error) {
    console.error(error);
    if ((error as Error).message?.includes('did document not found') || (error as Error).message?.includes('(22)')) {
      return false;
    }
    throw error;
  }
}

/**
 * Creates an iid document (did)
 * Must be signed by base account mnemonic (not passkey signer)
 * @param did - The did to create iid document for
 * @param offlineSigner - The offline signer to use to create iid document
 */
export async function createIidDocument(did: string, offlineSigner: OfflineSigner) {
  try {
    const accounts = await offlineSigner.getAccounts();
    const { address, pubkey } = (accounts[0] ?? {}) as AccountData;
    const allowances = await queryAddressAllowances(address);
    const feegrantGranter = allowances?.length
      ? decodeGrants(allowances)?.find(
          (allowance) =>
            !!allowance &&
            !isAllowanceExpired(allowance.expiration as number) &&
            !isAllowanceLimitReached(allowance.limit),
        )?.granter
      : undefined;
    const trx = {
      typeUrl: '/ixo.iid.v1beta1.MsgCreateIidDocument',
      value: ixo.iid.v1beta1.MsgCreateIidDocument.fromPartial({
        id: did,
        verifications: customMessages.iid.createIidVerificationMethods({
          did: did,
          pubkey: pubkey,
          address: address,
          controller: did,
          type: 'secp',
        }),
        signer: address,
        controllers: [did],
      }),
    };
    await signAndBroadcastWithMnemonic({
      offlineSigner: offlineSigner,
      messages: [trx],
      feegrantGranter: feegrantGranter,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * Creates an iid document if it does not exist
 * Must be signed by base account mnemonic (not passkey signer)
 * @param address - The address to generate DID and query or create iid document
 * @param offlineSigner - The offline signer to use to create iid document
 * @returns The did of the iid document
 */
export async function createIidDocumentIfNotExists({
  address,
  offlineSigner,
}: {
  address: string;
  offlineSigner?: OfflineSigner;
}) {
  if (!address) {
    throw new Error('Address is required to generate DID and query or create iid document');
  }
  const did = utils.did.generateSecpDid(address);
  const didExists = await checkIidDocumentExists(did);
  if (!didExists) {
    if (!offlineSigner?.getAccounts) {
      throw new Error('Cannot create iid document without offline signer.');
    }
    await createIidDocument(did, offlineSigner);
  }
  return did;
}

export async function hasEd25519VerificationMethod(did: string, publicKeyBase58: string): Promise<boolean> {
  try {
    const queryClient = await createQueryClient(CHAIN_RPC_URL);
    const iidDocumentResponse = await queryClient.ixo.iid.v1beta1.iidDocument({ id: did });
    const doc = iidDocumentResponse?.iidDocument;
    if (!doc) return false;
    return (doc.verificationMethod ?? []).some(
      (vm: any) => vm.type === 'Ed25519VerificationKey2018' && vm.publicKeyBase58 === publicKeyBase58,
    );
  } catch {
    return false;
  }
}

export function buildAddEd25519VerificationMsg(did: string, publicKey: Uint8Array, address: string) {
  const pubKeyBase58 = base58.encode(publicKey);
  return {
    typeUrl: '/ixo.iid.v1beta1.MsgAddVerification',
    value: ixo.iid.v1beta1.MsgAddVerification.fromPartial({
      id: did,
      verification: ixo.iid.v1beta1.Verification.fromPartial({
        relationships: ['authentication', 'assertionMethod'],
        method: ixo.iid.v1beta1.VerificationMethod.fromPartial({
          id: did + '#' + pubKeyBase58,
          type: 'Ed25519VerificationKey2018',
          publicKeyBase58: pubKeyBase58,
          controller: did,
        }),
      }),
      signer: address,
    }),
  };
}
