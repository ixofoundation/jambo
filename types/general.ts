export interface IObjectKeys {
	[key: string]: string | number | undefined | boolean | Array<any>;
}

// Makes certain fields on Type optional eg: type OptionalNameAgeDeveloper = MakeOptional<Developer, 'name' | 'age>
export type MakeOptional<Type, Key extends keyof Type> = Omit<Type, Key> & Partial<Pick<Type, Key>>;

// Get type in array type
export type ArrayElement<ArrayType> = ArrayType extends readonly (infer ElementType)[] ? ElementType : never;
// export type ArrayElement<A> = A extends readonly (infer T)[] ? T : never
