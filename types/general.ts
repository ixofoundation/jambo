export interface IObjectKeys {
	[key: string]: string | number | undefined;
}

// Makes certain fields on Type optional eg: type OptionalNameAgeDeveloper = MakeOptional<Developer, 'name' | 'age>
export type MakeOptional<Type, Key extends keyof Type> = Omit<Type, Key> & Partial<Pick<Type, Key>>;
