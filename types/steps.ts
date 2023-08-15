import { VALIDATOR } from './validators';
import { CURRENCY_TOKEN } from './wallet';

export enum STEPS {
  check_user_balance = 'check_user_balance',
  get_receiver_address = 'get_receiver_address',
  get_validator_delegate = 'get_validator_delegate',
  get_validator_redelegate = 'get_validator_redelegate',
  get_delegated_validator_undelegate = 'get_delegated_validator_undelegate',
  get_delegated_validator_redelegate = 'get_delegated_validator_redelegate',
  select_token_and_amount = 'select_token_and_amount',
  select_amount_delegate = 'select_amount_delegate',
  select_amount_undelegate = 'select_amount_undelegate',
  select_amount_redelegate = 'select_amount_redelegate',
  define_amount = 'define_amount',
  send_token_to_receiver = 'send_token_to_receiver',
  review_and_sign = 'review_and_sign',
  bank_MsgSend = 'bank_MsgSend',
  bank_MsgMultiSend = 'bank_MsgMultiSend',
  staking_MsgDelegate = 'staking_MsgDelegate',
  staking_MsgUndelegate = 'staking_MsgUndelegate',
  staking_MsgRedelegate = 'staking_MsgRedelegate',
  distribution_MsgWithdrawDelegatorReward = 'distribution_MsgWithdrawDelegatorReward',
  claim = 'claim',
  swap_tokens = "swap_tokens",
}

export type STEP = {
  id: STEPS;
  name: string;
  config?: AllStepConfigTypes;
  data?: AllStepDataTypes;
};

export const steps: { [key in STEPS]: STEP } = {
  [STEPS.check_user_balance]: { id: STEPS.check_user_balance, name: 'Check user balance' },
  [STEPS.get_receiver_address]: { id: STEPS.get_receiver_address, name: 'Get receiver address' },
  [STEPS.get_validator_delegate]: { id: STEPS.get_validator_delegate, name: 'Get validator address' },
  [STEPS.get_delegated_validator_undelegate]: {
    id: STEPS.get_delegated_validator_undelegate,
    name: 'Get delegated validator address',
  },
  [STEPS.get_delegated_validator_redelegate]: {
    id: STEPS.get_delegated_validator_redelegate,
    name: 'Get delegated validator address',
  },
  [STEPS.get_validator_redelegate]: {
    id: STEPS.get_validator_redelegate,
    name: 'Get validator address',
  },
  [STEPS.select_token_and_amount]: { id: STEPS.select_token_and_amount, name: 'Select token and amount' },
  [STEPS.select_amount_delegate]: { id: STEPS.select_amount_delegate, name: 'Define amount to delegate' },
  [STEPS.select_amount_undelegate]: { id: STEPS.select_amount_undelegate, name: 'Define amount to undelegate' },
  [STEPS.select_amount_redelegate]: { id: STEPS.select_amount_redelegate, name: 'Define amount to redelegate' },
  [STEPS.define_amount]: { id: STEPS.define_amount, name: 'Define amount' },
  [STEPS.send_token_to_receiver]: { id: STEPS.send_token_to_receiver, name: 'Send token to receiver' },
  [STEPS.review_and_sign]: { id: STEPS.review_and_sign, name: 'Review and sign' },
  [STEPS.bank_MsgSend]: { id: STEPS.bank_MsgSend, name: 'Review and sign' },
  [STEPS.bank_MsgMultiSend]: { id: STEPS.bank_MsgMultiSend, name: 'Review and sign' },
  [STEPS.staking_MsgDelegate]: { id: STEPS.staking_MsgDelegate, name: 'Review and sign' },
  [STEPS.staking_MsgUndelegate]: { id: STEPS.staking_MsgUndelegate, name: 'Review and sign' },
  [STEPS.staking_MsgRedelegate]: { id: STEPS.staking_MsgRedelegate, name: 'Review and sign' },
  [STEPS.distribution_MsgWithdrawDelegatorReward]: {
    id: STEPS.distribution_MsgWithdrawDelegatorReward,
    name: 'Review and sign',
  },
  [STEPS.claim]: { id: STEPS.claim, name: 'Claim' },
  [STEPS.swap_tokens]: { id: STEPS.swap_tokens, name: 'Swap tokens' },
};

export type ReviewStepsTypes =
  | STEPS.bank_MsgSend
  | STEPS.bank_MsgMultiSend
  | STEPS.staking_MsgDelegate
  | STEPS.staking_MsgUndelegate
  | STEPS.staking_MsgRedelegate
  | STEPS.distribution_MsgWithdrawDelegatorReward
  | STEPS.swap_tokens;

export type AllStepConfigTypes = never;

export type StepConfigType<T> = never;

interface Check_user_balance {
  balance: number;
}
interface Get_receiver_address {
  address: string;
}
interface Get_receiver_addresses {
  data: Get_receiver_address[];
  currentIndex: number;
}
interface Get_validator_address {
  validator: VALIDATOR;
}
interface Select_token_and_amount {
  token: CURRENCY_TOKEN;
  amount: number;
}
interface Select_tokens_and_amounts {
  data: Select_token_and_amount[];
  currentIndex: number;
}
interface Define_amount {
  amount: number;
}
interface Send_token_to_receiver {
  done: boolean;
}
interface Review_and_sign {
  done: boolean;
}
interface swap_tokens {
  data: Select_token_and_amount[];
  token: CURRENCY_TOKEN;
  amount: number;
}

export type AllStepDataTypes =
  | Get_receiver_address
  | Get_receiver_addresses
  | Get_validator_address
  | Select_token_and_amount
  | Select_tokens_and_amounts
  | Check_user_balance
  | Define_amount
  | Send_token_to_receiver
  | swap_tokens
  | Review_and_sign;

export type StepDataType<T> = T extends STEPS.check_user_balance
  ? Check_user_balance
  : T extends STEPS.get_receiver_address
  ? Get_receiver_addresses
  : T extends STEPS.get_validator_delegate
  ? Get_validator_address
  : T extends STEPS.get_delegated_validator_undelegate
  ? Get_validator_address
  : T extends STEPS.get_delegated_validator_redelegate
  ? Get_validator_address
  : T extends STEPS.get_validator_redelegate
  ? Get_validator_address
  : T extends STEPS.select_token_and_amount
  ? Select_tokens_and_amounts
  : T extends STEPS.select_amount_delegate
  ? Select_token_and_amount
  : T extends STEPS.select_amount_undelegate
  ? Select_token_and_amount
  : T extends STEPS.select_amount_redelegate
  ? Select_token_and_amount
  : T extends STEPS.define_amount
  ? Define_amount
  : T extends STEPS.send_token_to_receiver
  ? Send_token_to_receiver
  : T extends STEPS.review_and_sign
  ? Review_and_sign
  : T extends STEPS.distribution_MsgWithdrawDelegatorReward
  ? Review_and_sign
  : T extends STEPS.claim
  ? swap_tokens
  : T extends STEPS.swap_tokens
  ? Review_and_sign
  : T extends STEPS.claim
  ? Review_and_sign
  : never;
