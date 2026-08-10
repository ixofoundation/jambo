# Recipes

Worked examples for the four things people actually do with a JAMBO fork. Each ends
with the same check: `yarn verify`.

See [AGENTS.md](../AGENTS.md) for the architecture and
[CAPABILITIES.md](./CAPABILITIES.md) for the full step catalogue.

---

## 1. Rebrand only

No code changes. The dApp keeps every shipped action and just looks like yours.

```jsonc
// constants/config.json
{
  "$schema": "./config.schema.json",
  "siteName": "Acme Impact",
  "siteUrl": "https://impact.acme.org",
  "siteTitleMeta": "Acme Impact — stake and vote",
  "siteDescriptionMeta": "Stake ACME and vote on proposals.",
  "fontUrl": "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap",
  "fontName": "Inter",
  "headerShowName": true,
  "headerShowLogo": true,
  "about": "Acme Impact is …",
  "termsAndConditions": "https://impact.acme.org/terms",
  "actions": [
    /* unchanged */
  ]
}
```

Then:

- `styles/variables.scss` — the brand colours are `--primary-color`,
  `--secondary-color` and `--tertiary-color`. Set them in **both** the `:root` block
  and the nested `.dark` block.
- Replace `public/images/logo.png`, `public/favicon.ico` and
  `public/images/social/social.png`.
- `components/Header/Header.tsx:24` still links to `https://my.jambo.earth/`. Change
  or remove it.

```bash
yarn verify
```

---

## 2. A new action from existing steps

Config only. This example is a "Donate" action: pick an amount, pick a recipient,
sign.

```jsonc
{
  "id": "donate",
  "name": "Donate",
  "description": "Support the project with a one-off donation",
  "image": "donate.png",
  "steps": [
    { "id": "select_token_and_amount", "name": "How much?", "config": { "amountLabel": "Donation amount" } },
    { "id": "get_receiver_address", "name": "Recipient" },
    { "id": "bank_MsgSend", "name": "Review and sign" }
  ]
}
```

Rules the validator enforces, so you do not have to remember them:

- `id` must be unique and URL-safe — it becomes `/donate`.
- `image` must exist in `public/images/actions/`.
- The last step must be a `review` or `external` step.
- `bank_MsgSend` requires both `get_receiver_address` and `select_token_and_amount`
  earlier in the action.
- Only `select_token_and_amount` accepts a `config`. Supplying one anywhere else is
  an error rather than a silent no-op.

```bash
yarn validate:config && yarn verify
```

---

## 3. A new step with a new message type

The largest of the four. Five files — and `tests/unit/stepCatalogue.spec.ts`
cross-checks three of them, so a half-finished step fails a named test rather than
rendering a spinner.

**1. `types/steps.ts`** — add the enum member, an entry in the `steps` defaults map,
and arms in `StepDataType` / `StepConfigType`.

**2. `steps/YourStep.tsx`** — the screen. The prop contract is
`{ onSuccess, onBack, data, config, header }`; `onSuccess(data)` advances and stores.
Copy `steps/ShortTextInput.tsx` for a simple one.

**3. `utils/transactions.ts`** — the builder:

```ts
export const generateYourTrx = ({ sender, value }: { sender: string; value: string }): TRX_MSG => ({
  typeUrl: '/cosmos.your.v1beta1.MsgYour',
  value: cosmos.your.v1beta1.MsgYour.fromPartial({ sender, value }),
});
```

**4. `constants/stepCatalogue.ts`** — the entry. Keep `implemented: false` until the
switch case in step 5 exists:

```ts
[STEPS.your_step]: {
  summary: 'One line, shown verbatim in CAPABILITIES.md.',
  kind: 'review',
  implemented: true,
  configSchema: z.undefined(),
  dataSchema: z.object({ done: z.boolean() }),
  requires: [STEPS.some_earlier_step],
  msgTypeUrls: ['/cosmos.your.v1beta1.MsgYour'],
},
```

**5. `pages/[actionId].tsx`** — a `case` in `getStepComponent`. For a review step,
also extend the collector `useEffect` and the `signTX` switch in
`steps/ReviewAndSign.tsx`.

Then add a golden test in `tests/unit/transactions.spec.ts` asserting the exact
`{ typeUrl, value }`, and regenerate the docs:

```bash
yarn gen && yarn verify
```

---

## 4. Target a different chain

JAMBO is ixo-first, so this needs code changes as well as config. Chain info itself
is resolved at runtime from the Cosmos chain registry, so start with env:

```bash
NEXT_PUBLIC_CHAIN_NAMES=osmosis
NEXT_PUBLIC_DEFAULT_CHAIN_NAME=osmosis
NEXT_PUBLIC_USE_LOCAL_BLOCKCHAIN_PORT=0
```

Then work through the "Deliberate ixo assumptions" table in
[AGENTS.md](../AGENTS.md). The three that will actually break a transaction:

- `utils/transactions.ts:11` — `defaultTrxFee` is denominated in `uixo`.
- `utils/client.ts:42` — gas simulation is skipped for `uixo` and replaced with a
  fixed 500000.
- `contexts/chain.tsx:64` — chain id `ixo-5` gets a hardcoded RPC override.

SignX and ImpactsX are ixo-only and will throw; remove them from
`components/Wallets/Wallets.tsx`. Kado accepts only `ixo` and `noble` prefixes, so
drop the `kado_buy_crypto` step too.

```bash
yarn verify
```
