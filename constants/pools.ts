import { Dictionary, Pool, Token, TokenType } from 'types/swap';

export const tokens = new Map<string, Token>();
tokens.set('USDT', { address: 'ixo1r4azksxfmfn3wx6tlazcu5acreymnvyacnu3q33532zdt6ypwmxqnystvl', type: TokenType.Cw20 });
tokens.set('CARBON', {
  address: 'ixo1aakfpghcanxtc45gpqlx8j3rq0zcpyf49qmhm9mdjrfx036h4z5skn3d4n',
  type: TokenType.Cw1155,
});
tokens.set('uixo', { type: TokenType.Native });

export const pools = new Dictionary((keyObject: Pool) => JSON.stringify(keyObject));
pools.set({ token1155: 'CARBON', token2: 'USDT' }, 'ixo123321');
pools.set({ token1155: 'CARBON', token2: 'uixo' }, 'ixo1sjfach0vqaz5dyqum9e5wk7jesltpdugewzhz94xvs5ayt28dnyqhlxzs8');
