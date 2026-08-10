# AGENTS.md

Guidance for coding agents working in this repository. Humans are welcome too.

JAMBO is a template for building Cosmos dApps, meant to be forked. The dApp's
entire structure — its branding and its user flows — is declared in one JSON file.
Most work here is editing that file, not writing React.

## The one command that matters

```bash
yarn verify
```

Runs, in order: `typecheck` → `lint` → `format:check` → `validate:config` → `test`
→ `build`. If it exits 0, your change is sound. Run it before you claim to be done.

`yarn test:e2e` is separate because it builds and serves the app. Run it when you
change routing, config, or anything a user walks through. If your environment ships
a Chromium that Playwright did not install itself, point at it:
`CHROMIUM_PATH=/path/to/chrome yarn test:e2e`.

When a rung fails:

| Rung              | What it means                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `typecheck`       | A real type error. `ignoreBuildErrors` is deliberately off; do not turn it back on.                                 |
| `lint`            | ESLint over all source dirs. Pre-existing `react-hooks/exhaustive-deps` warnings are expected and do not fail.      |
| `format:check`    | Run `yarn format`.                                                                                                  |
| `validate:config` | `constants/config.json` is wrong. The output names the exact path and usually suggests a fix.                       |
| `test`            | `yarn test` for detail, `yarn test:watch` while iterating.                                                          |
| `build`           | Config validation also runs inside `getStaticPaths`, so a bad config fails here even if you skipped the rung above. |

## How the app is put together

```
constants/config.json   the dApp manifest: branding + actions
  └── actions[]         one per user flow, routed at /<action.id>
       └── steps[]      ordered screens; each captures data the next ones read
            └── last step assembles a chain message and broadcasts it
```

- `pages/[actionId].tsx` is the engine. `getStaticPaths` generates one static route
  per action; a `count` cursor walks the steps; `getStepComponent` maps a step id to
  its component.
- `steps/ReviewAndSign.tsx` is the transaction hub. It flattens every prior step's
  data into local state, switches on the step id to call a builder from
  `utils/transactions.ts`, then broadcasts via `broadCastMessages` in
  `utils/wallets.ts`, which dispatches on the connected wallet type.
- `constants/stepCatalogue.ts` declares what every step is, what config it accepts,
  what it captures and what message it emits. `constants/config.schema.ts` (zod) is
  the contract for `config.json` and the source for both the TypeScript types and
  `config.schema.json`.

Read `docs/CAPABILITIES.md` to find out what JAMBO can currently express. It is
generated from the catalogue, so it is never out of date.

## Invariants

1. **`constants/config.json` is the manifest.** Prefer changing it over changing code.
2. **Never hand-edit generated files.** `config.schema.json`, `docs/CAPABILITIES.md`
   and `docs/capabilities.json` come from `yarn gen`. CI fails if they are stale.
3. **Action `id` is a URL path segment** and must be unique. It is also historically
   used as the action image filename, though the two are independent.
4. **Every action must end** in a `review` step (broadcasts a transaction) or an
   `external` step (hands off, like the Kado on-ramp). Ending on an `input` step
   collects data and then silently drops the user back at the home screen.
5. **A step that reads another step's data must come after it.** The catalogue's
   `requires` field encodes this and the validator enforces it.
6. **`getStaticPaths` has `fallback: false`.** Actions are baked at build time, so a
   config change needs a rebuild — editing `config.json` while `yarn dev` is running
   is not always enough.

## Common tasks

### Rebrand a fork

1. `constants/config.json` — `siteName`, `siteUrl`, `siteTitleMeta`,
   `siteDescriptionMeta`, `about`, `termsAndConditions`.
2. `styles/variables.scss` — 25 CSS custom properties, defined twice (`:root` for
   light and a nested `.dark` block). The `.dark` block is nested inside `:root` and
   works because `contexts/theme.tsx` puts the class on a descendant div. That is
   intentional; do not "fix" it.
3. `public/images/logo.png`, `public/favicon.ico`, `public/images/social/social.png`,
   and one image per action in `public/images/actions/`.
4. `components/Header/Header.tsx` links to `https://my.jambo.earth/`. A fork almost
   certainly wants that changed or removed.

### Add an action from existing steps

Edit `constants/config.json` only. Pick steps from `docs/CAPABILITIES.md`, respect
the `requires` ordering, end on a terminal step, add the image, then
`yarn validate:config`.

### Add a new step

Five files, and forgetting any of them used to fail silently:

1. `types/steps.ts` — add to the `STEPS` enum, the `steps` defaults map, and the
   `StepDataType` / `StepConfigType` conditional types.
2. `steps/YourStep.tsx` — the component. Props are
   `{ onSuccess, onBack, data, config, header }`.
3. `constants/stepCatalogue.ts` — the catalogue entry. `implemented: true` only once
   step 4 is done.
4. `pages/[actionId].tsx` — a `case` in `getStepComponent`.
5. `steps/ReviewAndSign.tsx` and `utils/transactions.ts` — if the step contributes to
   the transaction.

`tests/unit/stepCatalogue.spec.ts` cross-checks 1, 3 and 4 against each other, so a
missing switch case is a named test failure rather than an indefinite spinner.

## Traps

- **`.env.example`'s `NEXT_PUBLIC_USE_LOCAL_BLOCKCHAIN_PORT` must stay `0`.** Any
  non-zero value replaces the chain-registry lookup entirely with hardcoded
  ixo-on-localhost.
- **`NEXT_PUBLIC_KADO_API_KEY`** is required if your config keeps the `kado_buy_crypto`
  step, and **`NEXT_PUBLIC_WC_PROJECT_ID`** if you enable WalletConnect. Neither
  announces itself when missing; the feature just fails.
- **Node is pinned to 18** (`.nvmrc`). `@netlify/plugin-nextjs@4.7.1` predates Node 20+.
- **Next 12 is EOL.** Do not add a root `.babelrc` — Next would silently abandon SWC
  for the production build. This is why the test runner is Vitest and not Jest.
- **`pages/404.tsx` loads Lottie via `next/dynamic` with `ssr: false`** because
  `lottie-web` touches `document` at module scope and crashes the build otherwise.
- **Chain resolution depends on third-party infrastructure and its console output
  varies by network.** `@ixo/cosmos-chain-resolver` fetches
  `registry.ping.pub/<chain>/chain.json` from the browser, which returns no
  `Access-Control-Allow-Origin` header, so it is CORS-rejected on a clean network
  and fails as a plain resource error behind a proxy. The app degrades gracefully
  (`getChainOptions` uses `Promise.allSettled`), but do not treat these console
  errors as a regression — the e2e suite filters them deliberately.

## Deliberate ixo assumptions

JAMBO is ixo-first. These are choices, not bugs — a fork targeting another Cosmos
chain must change them, but do not "fix" them in this repo without being asked:

| Where                                 | What                                                              |
| ------------------------------------- | ----------------------------------------------------------------- |
| `utils/transactions.ts:11`            | `defaultTrxFee` is denominated in `uixo`.                         |
| `utils/client.ts:42`                  | Gas simulation is skipped for `uixo` in favour of a fixed 500000. |
| `contexts/chain.tsx:64`               | Chain id `ixo-5` gets a hardcoded RPC override.                   |
| `utils/signX.tsx:37,112`              | SignX throws on non-ixo chains.                                   |
| `utils/impactsX.ts:16`                | ImpactsX hardcodes `'testnet'` on enable.                         |
| `utils/kado.ts:77-98`                 | Kado accepts only `ixo` and `noble` address prefixes.             |
| `constants/chains.ts:21`              | Default chain name falls back to `impacthub`.                     |
| `constants/validatorConfigs.ts:40,46` | Unbonding copy hardcodes 21 days.                                 |
| `components/Header/Header.tsx:24`     | Header links to the ixo dApp store.                               |

## Known defects

Real bugs, deliberately not fixed as drive-by changes because each alters
user-visible transaction behaviour and deserves an explicit decision:

- **`utils/currency.ts:34` `calculateMaxTokenAmount`** subtracts its 0.3 gas reserve
  in micro units, so the reserve is 3e-7 tokens rather than 0.3. "Max" offers the
  whole balance and the transaction can then fail for want of gas. Pinned by a test.
- **`utils/encoding.ts:40` `getMicroAmount`** defaults to 6 decimals, and
  `steps/ReviewAndSign.tsx` never passes the token's real decimals despite holding
  the token object. Wrong by orders of magnitude for any non-6-decimal token.
- **No receiver-address validation anywhere** (`utils/wallets.ts:17`). A typo'd
  bech32 address goes straight into a `MsgSend`.
- **`steps/ReviewAndSign.tsx:247`** swallows transaction errors in
  `catch { console.error }`, so a failed transaction is indistinguishable from a
  slow one.
- **`utils/blockchain.ts` and `utils/blocksync.ts`** are dead files — `export {}`
  plus commented-out bodies.

## What is not here yet

- **No end-to-end coverage of a signed transaction.** `yarn test:e2e` runs a smoke
  suite over every action route, the home page and the account page, but every
  wallet needs a browser extension or a paired mobile device plus a human
  signature, so no capture-review-sign flow can be exercised without a person.
  IXO AuthHub is being integrated to close this: email + password + PIN means an
  agent can drive a real signing flow headlessly.
- **No step registry.** The step id → component → message mapping is still spread
  across three switches (`types/steps.ts`, `pages/[actionId].tsx`,
  `steps/ReviewAndSign.tsx`). `constants/stepCatalogue.ts` is the declarative half;
  collapsing the behavioural half is planned and wants E2E coverage first.
- **No ixo module messages.** Only 8 cosmos-sdk messages exist. The SDK is pinned at
  `@ixo/impactxclient-sdk@1.1.22` against a current 3.1.0.
