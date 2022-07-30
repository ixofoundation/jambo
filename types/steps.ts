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
	name: string;
	// TBD
};

export const steps: { [key in STEPS]: STEP } = {
	[STEPS.check_user_balance]: { name: 'Check user balance' },
	[STEPS.get_receiver_address]: { name: 'Get receiver address' },
	[STEPS.select_token_and_amount]: { name: 'Select token and amount' },
	[STEPS.define_amount]: { name: 'Define amount' },
	[STEPS.send_token_to_receiver]: { name: 'Send token to receiver' },
	[STEPS.review_and_sign]: { name: 'Review and sign' },
	[STEPS.claim]: { name: 'Claim' },
};
