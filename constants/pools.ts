type Denom = string;
type Pool = {
  token1155: Denom;
  token2: Denom;
};
type ObjectMap = {
  [key: string]: string;
};

class Dictionary {
  private map: ObjectMap = {};
  private hashFunction: (key: Pool) => string;

  constructor(hashFunction: (key: Pool) => string) {
    this.hashFunction = hashFunction;
  }

  set(key: Pool, item: string) {
    this.map[this.hashFunction(key)] = item;
  }

  get(key: Pool) {
    return this.map[this.hashFunction(key)];
  }
}

export type Token = {
  type: TokenType;
  address?: string;
};
export enum TokenType {
  Cw1155,
  Cw20,
  Native,
}
export type TokenAmount = {
  [key in AmountType]?: string | { [key: string]: string };
};
export enum AmountType {
  Single = 'single',
  Multiple = 'multiple',
}
export enum TokenSelect {
  Token1155 = 'token1155',
  Token2 = 'token2',
}

export const tokens = new Map<Denom, Token>();
// Example
// tokens.set('USDT', { address: 'ixo15d2tyq2jzxmpg32y3am3w62dts32qgzmds9qnr6c87r0gwwr7ynq28958z', type: TokenType.Cw20 });
// tokens.set('CARBON', {
//   address: 'ixo15d2tyq2jzxmpg32y3am3w62dts32qgzmds9qnr6c87r0gwwr7ynq28958z',
//   type: TokenType.Cw1155,
// });
// tokens.set('uixo', { type: TokenType.Native });

export const pools = new Dictionary((keyObject: Pool) => JSON.stringify(keyObject));
// Example
// pools.set({ token1155: 'CARBON', token2: 'USDT' }, 'ixo15d2tyq2jzxmpg32y3am3w62dts32qgzmds9qnr6c87r0gwwr7ynq28958z');
// pools.set({ token1155: 'CARBON', token2: 'uixo' }, 'ixo15d2tyq2jzxmpg32y3am3w62dts32qgzmds9qnr6c87r0gwwr7ynq28958z');

// const getSupportedDenomsForDenom = (denom: Denom): Denom[] => {
//   const supportedDenoms: Denom[] = [];

//   for (const [pool, _] of pools) {
//     if (pool.token1155 == denom) {
//       supportedDenoms.push(pool.token2);
//     } else if (pool.token2 == denom) {
//       supportedDenoms.push(pool.token1155);
//     }
//   }

//   return supportedDenoms;
// };

// export const getIntermediateTokenForSwap = (firstDenom: Denom, secondDenom: Denom): Denom | undefined => {
//   const supportedDenomsForFirstDenom = getSupportedDenomsForDenom(firstDenom);
//   const supportedDenomsForSecondDenom = getSupportedDenomsForDenom(secondDenom);

//   return supportedDenomsForFirstDenom.filter((denom) => supportedDenomsForSecondDenom.indexOf(denom) !== -1)[0];
// };
