export type USER = {
	name?: string;
	pubKey: Uint8Array;
	address: string;
	algo?: string;
	didDoc?: DidDoc;
	ledgered: boolean;
	accountNumber?: string;
	sequence?: string;
};

export type DidDoc = {
	did: string;
	pubKey: string;
	credentials?: unknown[];
};
