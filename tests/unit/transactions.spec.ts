import { describe, expect, it } from 'vitest';

import {
  defaultTrxFee,
  generateBankMultiSendTrx,
  generateBankSendTrx,
  generateDelegateTrx,
  generateRedelegateTrx,
  generateSubmitProposalTrx,
  generateTextProposalTrx,
  generateUndelegateTrx,
  generateVoteTrx,
  generateWithdrawRewardTrx,
} from '@utils/transactions';
import type { TRX_MSG } from 'types/transactions';

/**
 * Golden tests for every message builder.
 *
 * These assert the exact `{ typeUrl, value }` each builder produces. They are the
 * safety net for any future refactor of the review/sign path: message construction
 * is the one place in this app where a bug moves the wrong amount to the wrong
 * address, and it is pure, so it is cheap to pin down completely.
 */

/**
 * `TRX_MSG` is a union of the amino shape (`{ type, value }`) and the proto shape
 * (`{ typeUrl, value }`). Every builder returns proto, but the union means callers
 * must narrow before reading `typeUrl` — so narrow explicitly, and fail loudly if a
 * builder ever starts returning amino.
 */
const proto = (msg: TRX_MSG) => {
  if (!('typeUrl' in msg)) throw new Error(`expected a proto message, got amino type "${msg.type}"`);
  return msg;
};

const DELEGATOR = 'ixo1hz9ffvzs4qtjm5hcvhy4rjnxs97ct2rda2yqnh';
const RECIPIENT = 'ixo1yh8kx4rf9r8yqcz2ynj2vqmzwexcfwvj0tzhqu';
const VALIDATOR = 'ixovaloper1hz9ffvzs4qtjm5hcvhy4rjnxs97ct2rd3xf8wv';
const VALIDATOR_2 = 'ixovaloper1yh8kx4rf9r8yqcz2ynj2vqmzwexcfwvjlzx3ae';

describe('generateBankSendTrx', () => {
  it('builds a MsgSend with a single coin', () => {
    const msg = generateBankSendTrx({
      fromAddress: DELEGATOR,
      toAddress: RECIPIENT,
      denom: 'uixo',
      amount: '1500000',
    });

    expect(proto(msg).typeUrl).toBe('/cosmos.bank.v1beta1.MsgSend');
    expect(msg.value).toMatchObject({
      fromAddress: DELEGATOR,
      toAddress: RECIPIENT,
      amount: [{ denom: 'uixo', amount: '1500000' }],
    });
  });
});

describe('generateBankMultiSendTrx', () => {
  it('emits one output per recipient and a single input', () => {
    const msg = generateBankMultiSendTrx({
      fromAddress: DELEGATOR,
      toAddresses: [RECIPIENT, VALIDATOR],
      denoms: ['uixo', 'uixo'],
      amounts: ['100', '250'],
    });

    expect(proto(msg).typeUrl).toBe('/cosmos.bank.v1beta1.MsgMultiSend');
    expect(msg.value).toMatchObject({
      outputs: [
        { address: RECIPIENT, coins: [{ denom: 'uixo', amount: '100' }] },
        { address: VALIDATOR, coins: [{ denom: 'uixo', amount: '250' }] },
      ],
    });
  });

  it('aggregates the input coins per denom so inputs balance outputs', () => {
    // Cosmos requires total input to equal total output. Two sends of the same
    // denom must therefore collapse into one input coin of 350, not two of 100/250.
    const msg = generateBankMultiSendTrx({
      fromAddress: DELEGATOR,
      toAddresses: [RECIPIENT, VALIDATOR],
      denoms: ['uixo', 'uixo'],
      amounts: ['100', '250'],
    });

    expect(msg.value).toMatchObject({
      inputs: [{ address: DELEGATOR, coins: [{ denom: 'uixo', amount: '350' }] }],
    });
  });

  it('keeps distinct denoms as separate input coins', () => {
    const msg = generateBankMultiSendTrx({
      fromAddress: DELEGATOR,
      toAddresses: [RECIPIENT, VALIDATOR],
      denoms: ['uixo', 'uatom'],
      amounts: ['100', '250'],
    });

    expect((msg.value as any).inputs[0].coins).toHaveLength(2);
  });
});

describe('staking builders', () => {
  it('builds MsgDelegate', () => {
    const msg = generateDelegateTrx({
      delegatorAddress: DELEGATOR,
      validatorAddress: VALIDATOR,
      denom: 'uixo',
      amount: '5000000',
    });

    expect(proto(msg).typeUrl).toBe('/cosmos.staking.v1beta1.MsgDelegate');
    expect(msg.value).toMatchObject({
      delegatorAddress: DELEGATOR,
      validatorAddress: VALIDATOR,
      amount: { denom: 'uixo', amount: '5000000' },
    });
  });

  it('builds MsgUndelegate', () => {
    const msg = generateUndelegateTrx({
      delegatorAddress: DELEGATOR,
      validatorAddress: VALIDATOR,
      denom: 'uixo',
      amount: '10',
    });

    expect(proto(msg).typeUrl).toBe('/cosmos.staking.v1beta1.MsgUndelegate');
    expect(msg.value).toMatchObject({ delegatorAddress: DELEGATOR, validatorAddress: VALIDATOR });
  });

  it('builds MsgBeginRedelegate with distinct source and destination', () => {
    const msg = generateRedelegateTrx({
      delegatorAddress: DELEGATOR,
      validatorSrcAddress: VALIDATOR,
      validatorDstAddress: VALIDATOR_2,
      denom: 'uixo',
      amount: '42',
    });

    // Note the typeUrl is MsgBeginRedelegate while the step id is
    // staking_MsgRedelegate — easy to get wrong when adding a message.
    expect(proto(msg).typeUrl).toBe('/cosmos.staking.v1beta1.MsgBeginRedelegate');
    expect(msg.value).toMatchObject({
      validatorSrcAddress: VALIDATOR,
      validatorDstAddress: VALIDATOR_2,
      amount: { denom: 'uixo', amount: '42' },
    });
  });
});

describe('generateWithdrawRewardTrx', () => {
  it('builds MsgWithdrawDelegatorReward', () => {
    const msg = generateWithdrawRewardTrx({ delegatorAddress: DELEGATOR, validatorAddress: VALIDATOR });

    expect(proto(msg).typeUrl).toBe('/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward');
    expect(msg.value).toMatchObject({ delegatorAddress: DELEGATOR, validatorAddress: VALIDATOR });
  });
});

describe('governance builders', () => {
  it('builds MsgVote and converts the proposal id to a Long', () => {
    const msg = generateVoteTrx({ proposalId: 7, voterAddress: DELEGATOR, option: 1 });

    expect(proto(msg).typeUrl).toBe('/cosmos.gov.v1beta1.MsgVote');
    expect(msg.value).toMatchObject({ voter: DELEGATOR, option: 1 });
    // proposalId goes through longify(), so it is not a plain number on the wire.
    expect(String((msg.value as any).proposalId)).toBe('7');
  });

  it('returns a TextProposal unencoded by default and bytes when asked', () => {
    const plain = generateTextProposalTrx({ title: 'Title', description: 'Body' });
    expect(plain.value).toMatchObject({ title: 'Title', description: 'Body' });

    const encoded = generateTextProposalTrx({ title: 'Title', description: 'Body' }, true);
    expect(encoded.value).toBeInstanceOf(Uint8Array);
  });

  it('builds MsgSubmitProposal with an initial deposit when a denom is given', () => {
    const msg = generateSubmitProposalTrx({
      proposer: DELEGATOR,
      title: 'Title',
      description: 'Body',
      depositDenom: 'uixo',
      depositAmount: '1000000',
    });

    expect(proto(msg).typeUrl).toBe('/cosmos.gov.v1beta1.MsgSubmitProposal');
    expect(msg.value).toMatchObject({
      proposer: DELEGATOR,
      initialDeposit: [{ denom: 'uixo', amount: '1000000' }],
    });
  });

  it('omits the initial deposit entirely when no denom is given', () => {
    const msg = generateSubmitProposalTrx({ proposer: DELEGATOR, title: 'T', description: 'B' });

    expect((msg.value as any).initialDeposit).toEqual([]);
  });
});

describe('defaultTrxFee', () => {
  it('is denominated in uixo', () => {
    // Documented as an intentional ixo-first assumption in AGENTS.md, not a bug.
    // A fork targeting another chain must override this.
    expect(defaultTrxFee.amount[0].denom).toBe('uixo');
  });
});
