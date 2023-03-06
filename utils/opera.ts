import { AccountData, DirectSignResponse, makeSignBytes, OfflineDirectSigner } from '@cosmjs/proto-signing';
import { SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { ChainInfo } from '@keplr-wallet/types';
import * as crypto from '@cosmjs/crypto';
import * as amino from '@cosmjs/amino';

import * as Toast from '@components/Toast/Toast';
import { b58_to_uint8Arr, b64_to_uint8Arr, uint8Arr_to_b64 } from './encoding';
import { initStargateClient, sendTransaction } from './client';
import { USER } from 'types/user';
import { TRX_FEE_OPTION, TRX_MSG } from 'types/transactions';
// import blocksyncApi from './blocksync';

const pubKeyType = 'EcdsaSecp256k1VerificationKey2019';

export let address: string;
export let pubkeyByteArray: Uint8Array;

interface InterchainWallet {
  getDidDoc: (index: number) => Promise<string>;
  signMessage: (hexSignDoc: string, signMethod: string, addressIndex: number) => Promise<string>;
}

export interface OperaInterchain {
  interchain?: InterchainWallet;
}

export const getOpera = (): InterchainWallet | undefined => {
  if (typeof window !== 'undefined' && window.interchain) return window.interchain;
  return undefined;
};

export const getAccounts = async (): Promise<readonly AccountData[]> => {
  const user = await initializeOpera();
  if (!user) return [];
  else return [{ address: user.address, algo: 'secp256k1', pubkey: user.pubKey as Uint8Array }];
};

export const signDirect = async (signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> => {
  const opera = getOpera();
  const signBytes = makeSignBytes(signDoc);
  const sha256msg = crypto.sha256(signBytes);
  const hexValue = Buffer.from(sha256msg).toString('hex');
  const signature = await opera!.signMessage(hexValue, 'secp256k1', 0);
  const transformedSignature = transformSignature(signature ?? '');
  if (!signature || !transformedSignature) throw new Error('No signature, signing failed');

  return {
    signed: signDoc,
    signature: {
      pub_key: {
        type: amino.pubkeyType.secp256k1,
        value: uint8Arr_to_b64(pubkeyByteArray),
      },
      signature: transformedSignature,
    },
  };
};

export function transformSignature(signature: string): string | undefined {
  const rawArray = b64_to_uint8Arr(signature);

  let signatureCosmjsBase64 = '';
  if (rawArray.length < 64 || rawArray.length > 66) {
    console.log('operahelper.invalid length');
    return;
  } else if (rawArray.length == 64) {
    signatureCosmjsBase64 = signature;
  } else if (rawArray.length == 65) {
    if (rawArray[0] == 0x00) {
      signatureCosmjsBase64 = uint8Arr_to_b64(rawArray.slice(1, 65));
    } else if (rawArray[32] == 0x00) {
      signatureCosmjsBase64 = uint8Arr_to_b64(new Uint8Array([...rawArray.slice(0, 32), ...rawArray.slice(33, 65)]));
    } else {
      console.log('operahelper.invalid signature array, length 65');
    }
  } else if (rawArray.length == 66) {
    if (rawArray[0] == 0x00 && rawArray[33] == 0x00) {
      signatureCosmjsBase64 = uint8Arr_to_b64(new Uint8Array([...rawArray.slice(1, 33), ...rawArray.slice(34, 66)]));
    } else {
      console.log('operahelper.invalid signature array, length 66');
    }
  }
  console.log('operahelper.signatureCosmjsBase64', signatureCosmjsBase64);
  return signatureCosmjsBase64 || undefined;
}

export const getDIDDocJSON = async () => {
  try {
    const opera = getOpera();
    const didDoc = await opera?.getDidDoc(0);
    const didDocJSON = JSON.parse(didDoc ?? '{}');
    return didDocJSON;
  } catch (error) {
    console.error('getDIDDocJSON::', error);
    throw error;
  }
};

export const initializeOpera = async (): Promise<USER | undefined> => {
  try {
    let ledgered = false;
    const didDocJSON = await getDIDDocJSON();

    // const getDidDoc = await blocksyncApi.user.getDidDoc(didDocJSON.id);
    // console.log({ getDidDoc });
    // if (!(getDidDoc as any)?.error) ledgered = true;

    const verificationMethod = didDocJSON.verificationMethod.find((x: any) => x.type == pubKeyType);
    const pubkeyBase58 = verificationMethod.publicKeyBase58;
    pubkeyByteArray = b58_to_uint8Arr(pubkeyBase58);
    const pubkeyBase64 = uint8Arr_to_b64(pubkeyByteArray);

    const pubkey = {
      type: amino.pubkeyType.secp256k1,
      value: pubkeyBase64,
    };
    address = amino.pubkeyToAddress(pubkey, 'ixo');

    console.log({ didDocJSON, pubkeyBase64, address });
    return { pubKey: pubkeyByteArray, address, ledgered, algo: 'secp256k1', did: didDocJSON.id };
  } catch (error) {
    console.error('Initialize Opera::', error);
    throw error;
  }
};

export const getOfflineSigner = async (): Promise<OfflineDirectSigner | null> => {
  const opera = getOpera();
  if (!opera) return null;
  const offlineSigner: OfflineDirectSigner = { getAccounts, signDirect };
  return offlineSigner;
};

const trx_fail = () => {
  Toast.errorToast(`Transaction Failed`);
  return null;
};

export const operaBroadCastMessage = async (
  msgs: TRX_MSG[],
  memo = '',
  fee: TRX_FEE_OPTION,
  feeDenom: string,
  chainInfo: ChainInfo,
): Promise<string | null> => {
  const offlineSigner = await getOfflineSigner();
  if (!address || !offlineSigner) return trx_fail();
  const client = await initStargateClient(chainInfo.rpc, offlineSigner);

  const payload = {
    msgs,
    chain_id: chainInfo.chainId,
    fee,
    feeDenom,
    memo,
  };

  try {
    const result = await sendTransaction(client, address, payload);
    if (result) {
      return result.transactionHash;
    } else {
      throw 'transaction failed';
    }
  } catch (e) {
    return trx_fail();
  }
};
