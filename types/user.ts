export type USER = {
	name?: string;
	pubKey: Uint8Array;
	address: string;
	algo?: string;
	ledgered: boolean;
	did?: string;
	balances?: Currency[];
};

export type Currency = {
	amount: number;
	denom: string;
};
