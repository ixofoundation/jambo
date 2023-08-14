type Denom = string;

type Pool = {
  token1155: Denom;
  token2: Denom;
};
export type Token = {
  type: TokenType;
  address?: string;
};

export enum TokenType {
  Cw1155,
  Cw20,
  Native,
}

export const tokens = new Map<Denom, Token>();
// Example
// tokens.set('USDT', { address: 'ixo1r4azksxfmfn3wx6tlazcu5acreymnvyacnu3q33532zdt6ypwmxqnystvl', type: TokenType.Cw20 });
// tokens.set('CARBON', {
//   address: 'ixo1aakfpghcanxtc45gpqlx8j3rq0zcpyf49qmhm9mdjrfx036h4z5skn3d4n',
//   type: TokenType.Cw1155,
// });
// tokens.set('uixo', { type: TokenType.Native });

export const pools = new Map<Pool, string>();
// Example
// pools.set({ token1155: 'CARBON', token2: 'USDT' }, 'ixo123321');
// pools.set({ token1155: 'CARBON', token2: 'uixo' }, 'ixo123123');

const getSupportedDenomsForDenom = (denom: Denom): Denom[] => {
  const supportedDenoms: Denom[] = [];

  for (const [pool, _] of pools) {
    if (pool.token1155 == denom) {
      supportedDenoms.push(pool.token2);
    } else if (pool.token2 == denom) {
      supportedDenoms.push(pool.token1155);
    }
  }

  return supportedDenoms;
};

export const getIntermediateTokenForSwap = (firstDenom: Denom, secondDenom: Denom): Denom | undefined => {
  const supportedDenomsForFirstDenom = getSupportedDenomsForDenom(firstDenom);
  const supportedDenomsForSecondDenom = getSupportedDenomsForDenom(secondDenom);

  return supportedDenomsForFirstDenom.filter((denom) => supportedDenomsForSecondDenom.indexOf(denom) !== -1)[0];
};
