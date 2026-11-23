import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for pure modules (auth-hub PKCE / state / callback, return paths).
// Mirrors the tsconfig `paths` aliases the tested modules import.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@constants': r('./constants'),
      '@utils': r('./utils'),
      '@hooks': r('./hooks'),
      '@store': r('./store'),
      lib: r('./lib'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '.claude/**'],
  },
});
