import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import svgr from 'vite-plugin-svgr';

/**
 * Vitest rather than Jest, deliberately.
 *
 * Jest on Next 12 means either `next/jest` (which pins an old SWC) or
 * `babel-jest` + `next/babel` — and the moment a `.babelrc` appears at the repo
 * root, Next silently abandons SWC for the *application* build too, changing
 * production output as a side effect of adding tests. This config never touches
 * the Next build.
 *
 * Versions are pinned to the TypeScript 4.7 ceiling: vitest 2/3 and
 * @testing-library/react 15+ require TS 5.
 */
export default defineConfig({
  // `tsconfigPaths` reads the 11 aliases from tsconfig.json directly, so they do
  // not have to be mirrored here. `svgr` matches the @svgr/webpack rule in
  // next.config.js so `import Icon from '@icons/x.svg'` resolves in tests.
  plugins: [tsconfigPaths(), svgr()],
  test: {
    globals: true,
    // Node for pure logic, jsdom for anything that renders.
    environment: 'node',
    environmentMatchGlobs: [['tests/component/**', 'jsdom']],
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['utils/**', 'constants/**'],
      // The money paths: message construction and amount conversion.
      thresholds: {
        'utils/transactions.ts': { statements: 90, branches: 75, functions: 90, lines: 90 },
        'utils/encoding.ts': { statements: 40, branches: 50, functions: 30, lines: 40 },
      },
    },
  },
  css: {
    modules: {
      // Tests can then assert on real class names rather than generated hashes.
      generateScopedName: '[local]',
    },
  },
});
