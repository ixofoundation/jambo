export type TRX_MSG =
	| {
			type: string;
			value: any;
	  }
	| {
			typeUrl: string;
			value: any;
	  };

export type TRX_FEE = {
	amount: { amount: string; denom: string }[];
	gas: string;
};
