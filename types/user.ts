export type USER = {
	name: string;
	pubKey: Uint8Array | string;
	address: string;
	algo?: string;
	did?: string;
	ledgered: boolean;
	accountNumber?: string;
	sequence?: string;
};
