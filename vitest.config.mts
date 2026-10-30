import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for pure modules (USDC registry/policy/balances, chain-address mapping,
// denom amounts). Mirrors the tsconfig `paths` aliases the tested modules import.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@constants': r('./constants'),
      '@utils': r('./utils'),
      '@hooks': r('./hooks'),
      lib: r('./lib'),
    },
  },
  test: {
    environment: 'node',
    // The USDC registry is per network; the tests exercise the mainnet one.
    env: { NEXT_PUBLIC_CHAIN_NETWORK: 'mainnet' },
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '.claude/**'],
  },
});
