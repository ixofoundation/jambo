import { TokenDropdownType } from '@utils/currency';
import { VALIDATOR } from './validators';

export enum STEPS {
	check_user_balance = 'check_user_balance',
	get_receiver_address = 'get_receiver_address',
	get_validator_delegate = 'get_validator_delegate',
	get_delegated_validator_undelegate = 'get_delegated_validator_undelegate',
	get_delegated_validator_redelegate = 'get_delegated_validator_redelegate',
	get_validator_redelegate = 'get_validator_redelegate',
	select_token_and_amount = 'select_token_and_amount',
	select_delegate_amount = 'select_delegate_amount',
	select_undelegate_amount = 'select_undelegate_amount',
	select_redelegate_amount = 'select_redelegate_amount',
	define_amount = 'define_amount',
	send_token_to_receiver = 'send_token_to_receiver',
	review_and_sign = 'review_and_sign',
	bank_MsgSend = 'bank_MsgSend',
	staking_MsgDelegate = 'staking_MsgDelegate',
	staking_MsgUndelegate = 'staking_MsgUndelegate',
	staking_MsgRedelegate = 'staking_MsgRedelegate',
	distribution_MsgWithdrawDelegatorReward = 'distribution_MsgWithdrawDelegatorReward',
	claim = 'claim',
}

export type STEP = {
	id: STEPS;
	name: string;
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
	[STEPS.select_delegate_amount]: { id: STEPS.select_delegate_amount, name: 'Define amount to delegate' },
	[STEPS.select_undelegate_amount]: { id: STEPS.select_undelegate_amount, name: 'Define amount to undelegate' },
	[STEPS.select_redelegate_amount]: { id: STEPS.select_redelegate_amount, name: 'Define amount to redelegate' },
	[STEPS.define_amount]: { id: STEPS.define_amount, name: 'Define amount' },
	[STEPS.send_token_to_receiver]: { id: STEPS.send_token_to_receiver, name: 'Send token to receiver' },
	[STEPS.review_and_sign]: { id: STEPS.review_and_sign, name: 'Review and sign' },
	[STEPS.bank_MsgSend]: { id: STEPS.bank_MsgSend, name: 'Review and sign' },
	[STEPS.staking_MsgDelegate]: { id: STEPS.staking_MsgDelegate, name: 'Review and sign' },
	[STEPS.staking_MsgUndelegate]: { id: STEPS.staking_MsgUndelegate, name: 'Review and sign' },
	[STEPS.staking_MsgRedelegate]: { id: STEPS.staking_MsgRedelegate, name: 'Review and sign' },
	[STEPS.distribution_MsgWithdrawDelegatorReward]: {
		id: STEPS.distribution_MsgWithdrawDelegatorReward,
		name: 'Review and sign',
	},
	[STEPS.claim]: { id: STEPS.claim, name: 'Claim' },
};

export type ReviewStepsTypes =
	| STEPS.bank_MsgSend
	| STEPS.staking_MsgDelegate
	| STEPS.staking_MsgUndelegate
	| STEPS.staking_MsgRedelegate
	| STEPS.distribution_MsgWithdrawDelegatorReward;

interface Check_user_balance {
	balance: number;
}
interface Get_receiver_address {
	address: string;
}
interface Get_validator_address {
	validator: VALIDATOR;
}
interface Select_token_and_amount {
	token: TokenDropdownType;
	amount: number;
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
interface Claim {
	done: boolean;
}

export type AllStepDataTypes =
	| Get_receiver_address
	| Get_validator_address
	| Select_token_and_amount
	| Check_user_balance
	| Define_amount
	| Send_token_to_receiver
	| Review_and_sign
	| Claim;

export type StepDataType<T> = T extends STEPS.check_user_balance
	? Check_user_balance
	: T extends STEPS.get_receiver_address
	? Get_receiver_address
	: T extends STEPS.get_validator_delegate
	? Get_validator_address
	: T extends STEPS.get_delegated_validator_undelegate
	? Get_validator_address
	: T extends STEPS.get_delegated_validator_redelegate
	? Get_validator_address
	: T extends STEPS.get_validator_redelegate
	? Get_validator_address
	: T extends STEPS.select_token_and_amount
	? Select_token_and_amount
	: T extends STEPS.select_delegate_amount
	? Select_token_and_amount
	: T extends STEPS.select_undelegate_amount
	? Select_token_and_amount
	: T extends STEPS.select_redelegate_amount
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
	? Claim
	: never;
