import { z } from 'zod';

import { STEPS } from 'types/steps';

/**
 * The step catalogue: one entry per member of the STEPS enum.
 *
 * This is the declarative half of a step definition — what a step is called, what
 * config it accepts from `constants/config.json`, what data it captures, and which
 * chain message (if any) it contributes. It deliberately holds no React components
 * and no behaviour, so it is safe to import from build scripts and from
 * `getStaticPaths` without pulling the UI into scope.
 *
 * Two things consume it:
 *   - `constants/config.schema.ts`, to validate `config.json` at build time
 *   - `scripts/gen-capabilities.ts`, to generate `docs/CAPABILITIES.md`
 *
 * Because the docs are generated from here, the catalogue cannot drift from what
 * the validator enforces. Keep it in step with `types/steps.ts`; `tests/unit/
 * stepCatalogue.spec.ts` fails if a STEPS member has no entry.
 */

/**
 * - `input`    captures data for a later step; cannot end an action
 * - `review`   assembles and broadcasts a chain transaction; ends an action
 * - `external` hands off to a third party (e.g. a fiat on-ramp) and produces no
 *              chain message, but still legitimately ends an action
 */
export type StepKind = 'input' | 'review' | 'external';

/** Kinds that may legally be the last step of an action. */
export const TERMINAL_KINDS: StepKind[] = ['review', 'external'];

export type StepDefinition = {
  /** One line, used verbatim in the generated capability docs. */
  summary: string;
  kind: StepKind;
  /**
   * False for step ids that exist in the STEPS enum but have no component wired
   * into `pages/[actionId].tsx`. Referencing one from config.json used to render
   * an indefinite loading spinner; the config validator now rejects it instead.
   */
  implemented: boolean;
  /**
   * Config the step accepts from `config.json`. `z.undefined()` means the step
   * takes no config at all — supplying one is a config error, not a no-op, which
   * is what makes a typo'd or misplaced config block visible.
   */
  configSchema: z.ZodTypeAny;
  /** Shape of the data the step writes back into `action.steps[i].data`. */
  dataSchema: z.ZodTypeAny;
  /** Step ids that must appear earlier in the same action. */
  requires: STEPS[];
  /** Chain messages a review step emits. Empty for input steps. */
  msgTypeUrls: string[];
};

// Runtime objects that come from the chain/SDK rather than from config. They are
// modelled loosely on purpose: they are never present in config.json, so precise
// shapes would buy no validation, only maintenance.
const currencyToken = z.object({ denom: z.string(), amount: z.string() }).passthrough();
const validator = z.object({ address: z.string() }).passthrough();

const noConfig = z.undefined();
const noData = z.object({}).passthrough();

/** A list-with-cursor, used by the steps that can capture several entries (multi-send). */
const collection = <T extends z.ZodTypeAny>(entry: T) =>
  z.object({ data: z.array(entry), currentIndex: z.number().int().min(0) });

const selectTokenAndAmountConfig = z
  .object({
    optional: z.boolean().optional().describe('Allow the user to continue without choosing an amount'),
    amountLabel: z.string().optional().describe('Overrides the amount field label'),
    denomLabel: z.string().optional().describe('Overrides the token field label'),
  })
  .strict()
  .optional();

export const STEP_CATALOGUE: Record<STEPS, StepDefinition> = {
  // -- On-ramp ---------------------------------------------------------------
  [STEPS.kado_buy_crypto]: {
    summary: 'Open the Kado on-ramp so the user can buy crypto with fiat. Ends the action; emits no chain message.',
    kind: 'external',
    implemented: true,
    configSchema: noConfig,
    dataSchema: noData,
    requires: [],
    msgTypeUrls: [],
  },

  // -- Address and amount capture -------------------------------------------
  [STEPS.get_receiver_address]: {
    summary: 'Capture one or more recipient addresses, by typing or QR scan.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: collection(z.object({ address: z.string() })),
    requires: [],
    msgTypeUrls: [],
  },
  [STEPS.select_token_and_amount]: {
    summary: 'Choose a token from the wallet balance and enter an amount.',
    kind: 'input',
    implemented: true,
    configSchema: selectTokenAndAmountConfig,
    dataSchema: collection(z.object({ token: currencyToken, amount: z.number() })),
    requires: [],
    msgTypeUrls: [],
  },

  // -- Validator selection ---------------------------------------------------
  [STEPS.get_validator_delegate]: {
    summary: 'Pick any validator to delegate to.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ validator }),
    requires: [],
    msgTypeUrls: [],
  },
  [STEPS.get_delegated_validator_undelegate]: {
    summary: 'Pick a validator the user has an existing delegation with, to undelegate from.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ validator }),
    requires: [],
    msgTypeUrls: [],
  },
  [STEPS.get_delegated_validator_redelegate]: {
    summary: 'Pick the source validator to redelegate away from.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ validator }),
    requires: [],
    msgTypeUrls: [],
  },
  [STEPS.get_validator_redelegate]: {
    summary: 'Pick the destination validator to redelegate to. Excludes the source validator.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ validator }),
    requires: [STEPS.get_delegated_validator_redelegate],
    msgTypeUrls: [],
  },

  // -- Staking amounts -------------------------------------------------------
  [STEPS.select_amount_delegate]: {
    summary: 'Enter the amount to delegate, bounded by the available balance.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ token: currencyToken, amount: z.number() }),
    requires: [STEPS.get_validator_delegate],
    msgTypeUrls: [],
  },
  [STEPS.select_amount_undelegate]: {
    summary: 'Enter the amount to undelegate, bounded by the existing delegation.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ token: currencyToken, amount: z.number() }),
    requires: [STEPS.get_delegated_validator_undelegate],
    msgTypeUrls: [],
  },
  [STEPS.select_amount_redelegate]: {
    summary: 'Enter the amount to redelegate, bounded by the existing delegation.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ token: currencyToken, amount: z.number() }),
    requires: [STEPS.get_delegated_validator_redelegate],
    msgTypeUrls: [],
  },

  // -- Governance ------------------------------------------------------------
  [STEPS.select_proposal]: {
    summary: 'Choose an open governance proposal and a vote option.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ proposalId: z.number().int() }),
    requires: [],
    msgTypeUrls: [],
  },
  [STEPS.define_proposal_title]: {
    summary: 'Enter a title for a new text proposal.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ title: z.string().optional() }),
    requires: [],
    msgTypeUrls: [],
  },
  [STEPS.define_proposal_description]: {
    summary: 'Enter a description for a new text proposal.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ description: z.string().optional() }),
    requires: [],
    msgTypeUrls: [],
  },
  [STEPS.define_proposal_deposit]: {
    summary: 'Choose the initial deposit token and amount for a new proposal.',
    kind: 'input',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ token: currencyToken }),
    requires: [],
    msgTypeUrls: [],
  },

  // -- Review and sign -------------------------------------------------------
  [STEPS.bank_MsgSend]: {
    summary: 'Review and sign a token transfer to a single recipient.',
    kind: 'review',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ done: z.boolean() }),
    requires: [STEPS.get_receiver_address, STEPS.select_token_and_amount],
    msgTypeUrls: ['/cosmos.bank.v1beta1.MsgSend'],
  },
  [STEPS.bank_MsgMultiSend]: {
    summary: 'Review and sign a token transfer to several recipients in one transaction.',
    kind: 'review',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ done: z.boolean() }),
    requires: [STEPS.get_receiver_address, STEPS.select_token_and_amount],
    msgTypeUrls: ['/cosmos.bank.v1beta1.MsgMultiSend'],
  },
  [STEPS.staking_MsgDelegate]: {
    summary: 'Review and sign a delegation to a validator.',
    kind: 'review',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ done: z.boolean() }),
    requires: [STEPS.get_validator_delegate, STEPS.select_amount_delegate],
    msgTypeUrls: ['/cosmos.staking.v1beta1.MsgDelegate'],
  },
  [STEPS.staking_MsgUndelegate]: {
    summary: 'Review and sign an undelegation from a validator.',
    kind: 'review',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ done: z.boolean() }),
    requires: [STEPS.get_delegated_validator_undelegate, STEPS.select_amount_undelegate],
    msgTypeUrls: ['/cosmos.staking.v1beta1.MsgUndelegate'],
  },
  [STEPS.staking_MsgRedelegate]: {
    summary: 'Review and sign a redelegation from one validator to another.',
    kind: 'review',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ done: z.boolean() }),
    requires: [
      STEPS.get_delegated_validator_redelegate,
      STEPS.select_amount_redelegate,
      STEPS.get_validator_redelegate,
    ],
    msgTypeUrls: ['/cosmos.staking.v1beta1.MsgBeginRedelegate'],
  },
  [STEPS.distribution_MsgWithdrawDelegatorReward]: {
    summary: 'Review and sign a claim of all outstanding staking rewards. Needs no preceding step.',
    kind: 'review',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ done: z.boolean() }),
    requires: [],
    msgTypeUrls: ['/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward'],
  },
  [STEPS.gov_MsgVote]: {
    summary: 'Review and sign a vote on a governance proposal.',
    kind: 'review',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ done: z.boolean() }),
    requires: [STEPS.select_proposal],
    msgTypeUrls: ['/cosmos.gov.v1beta1.MsgVote'],
  },
  [STEPS.gov_MsgSubmitProposal]: {
    summary: 'Review and sign the submission of a new text proposal.',
    kind: 'review',
    implemented: true,
    configSchema: noConfig,
    dataSchema: z.object({ done: z.boolean() }),
    requires: [STEPS.define_proposal_title, STEPS.define_proposal_description, STEPS.define_proposal_deposit],
    msgTypeUrls: ['/cosmos.gov.v1beta1.MsgSubmitProposal'],
  },

  // -- Declared but not wired up --------------------------------------------
  // These ids exist in the STEPS enum but have no case in `getStepComponent`.
  // Before the config validator existed, putting one in config.json rendered an
  // indefinite spinner with no error. They are kept in the enum because
  // `review_and_sign` is still used as a type parameter, but the validator now
  // rejects any action that references them.
  [STEPS.check_user_balance]: {
    summary: 'Not implemented — no component is wired up for this step id.',
    kind: 'input',
    implemented: false,
    configSchema: noConfig,
    dataSchema: z.object({ balance: z.number() }),
    requires: [],
    msgTypeUrls: [],
  },
  [STEPS.define_amount]: {
    summary: 'Not implemented — no component is wired up for this step id.',
    kind: 'input',
    implemented: false,
    configSchema: noConfig,
    dataSchema: z.object({ amount: z.number() }),
    requires: [],
    msgTypeUrls: [],
  },
  [STEPS.send_token_to_receiver]: {
    summary: 'Not implemented — no component is wired up for this step id.',
    kind: 'input',
    implemented: false,
    configSchema: noConfig,
    dataSchema: z.object({ done: z.boolean() }),
    requires: [],
    msgTypeUrls: [],
  },
  [STEPS.review_and_sign]: {
    summary: 'Not implemented as a routable step — use a specific `*_Msg*` review step instead.',
    kind: 'review',
    implemented: false,
    configSchema: noConfig,
    dataSchema: z.object({ done: z.boolean() }),
    requires: [],
    msgTypeUrls: [],
  },
};

/** Step ids that can legally terminate an action. */
export const TERMINAL_STEP_IDS = (Object.keys(STEP_CATALOGUE) as STEPS[]).filter(
  (id) => TERMINAL_KINDS.includes(STEP_CATALOGUE[id].kind) && STEP_CATALOGUE[id].implemented,
);

/** Every step id a fork may reference from config.json. */
export const IMPLEMENTED_STEP_IDS = (Object.keys(STEP_CATALOGUE) as STEPS[]).filter(
  (id) => STEP_CATALOGUE[id].implemented,
);
