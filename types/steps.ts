import { ArrayElement } from './general';

export enum STEPS {
	check_user_balance = 'check_user_balance',
	get_receiver_address = 'get_receiver_address',
	select_token_and_amount = 'select_token_and_amount',
	define_amount = 'define_amount',
	send_token_to_receiver = 'send_token_to_receiver',
	review_and_sign = 'review_and_sign',
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
	[STEPS.select_token_and_amount]: { id: STEPS.select_token_and_amount, name: 'Select token and amount' },
	[STEPS.define_amount]: { id: STEPS.define_amount, name: 'Define amount' },
	[STEPS.send_token_to_receiver]: { id: STEPS.send_token_to_receiver, name: 'Send token to receiver' },
	[STEPS.review_and_sign]: { id: STEPS.review_and_sign, name: 'Review and sign' },
	[STEPS.claim]: { id: STEPS.claim, name: 'Claim' },
};

interface Check_user_balance {
	balance: number;
}
interface Get_receiver_address {
	address: string;
}
interface Select_token_and_amount {
	token: TokenOptionType;
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

export type AllStepDataTypes = Get_receiver_address | Select_token_and_amount | Check_user_balance | Define_amount | Send_token_to_receiver | Review_and_sign | Claim;

export type StepDataType<T> = T extends STEPS.check_user_balance
	? Check_user_balance
	: T extends STEPS.get_receiver_address
	? Get_receiver_address
	: T extends STEPS.select_token_and_amount
	? Select_token_and_amount
	: T extends STEPS.define_amount
	? Define_amount
	: T extends STEPS.send_token_to_receiver
	? Send_token_to_receiver
	: T extends STEPS.review_and_sign
	? Review_and_sign
	: T extends STEPS.claim
	? Claim
	: never;

export const TokenOptions = [{ value: 'ixo', label: 'IXO' }];
export type TokenOptionType = ArrayElement<typeof TokenOptions> | null;
