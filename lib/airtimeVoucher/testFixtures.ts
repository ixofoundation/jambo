import type { Swap, SwapBurnMessage, SwapDetail, SwapPin, SwapResponse } from './types';

/** Shared by the airtime swap tests. Not imported by the app. */

export const ADDRESS = 'ixo1qqqsyqcyq5rqwzqfpg9scrgwpugpzysn3w7apx';
export const SERVICE_DID = 'did:web:airtime.example.org';
export const SWAP_ID = '0f6f3c9e-6c2b-4f0e-9d53-5d9a3f0c7a11';
export const REFERENCE = 'ref-7b1f2c';
export const TX_HASH = 'AB'.repeat(32);
/** 2026-11-19T10:00:00Z */
export const NOW = Date.UTC(2026, 10, 19, 10, 0, 0);

export function swapOf(over: Partial<Swap> = {}): Swap {
  return {
    id: SWAP_ID,
    reference: REFERENCE,
    address: ADDRESS,
    amount: 20,
    contractAddress: 'ixo1contract',
    status: 'awaiting_burn',
    expiresAt: new Date(NOW + 15 * 60_000).toISOString(),
    burnTxHash: null,
    burnedTokens: null,
    flagReason: null,
    order: null,
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    ...over,
  };
}

export function burnOf(over: Partial<SwapBurnMessage['value']> = {}): SwapBurnMessage {
  return {
    typeUrl: '/ixo.token.v1beta1.MsgTransferCredit',
    value: {
      owner: ADDRESS,
      tokens: [
        { id: 'batch-a', amount: '15' },
        { id: 'batch-b', amount: '5' },
      ],
      jurisdiction: 'ZA',
      reason: 'airtime-swap',
      authorizationId: REFERENCE,
      ...over,
    },
  };
}

export function responseOf(): SwapResponse {
  return {
    swap: swapOf(),
    burn: burnOf(),
    holdings: [
      { id: 'batch-a', amount: 15 },
      { id: 'batch-b', amount: 30 },
    ],
  };
}

export const PIN: SwapPin = {
  pin: '1234567890123456',
  valueZar: 20,
  ussd: '*130*410*01*1234567890123456#',
  url: 'https://allnetairtime.co.za/public_redeem.php',
  steps: ['Dial *130*410*01*1234567890123456# on the phone that should get the airtime, then press call.'],
  test: false,
};

export function detailOf(
  swap: Partial<Swap> = {},
  pin: SwapPin | null = null,
  message: string | null = null,
): SwapDetail {
  return { swap: swapOf(swap), pin, message };
}
