/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { STEP_CATALOGUE, StepKind } from '../constants/stepCatalogue';
import { STEPS } from '../types/steps';
import config from '../constants/config.json';

/**
 * Generates docs/CAPABILITIES.md and docs/capabilities.json from the step
 * catalogue, so an agent can answer "can JAMBO express this use-case?" without
 * reading source.
 *
 * Generated, never hand-edited: CI runs `yarn gen` and fails if the result differs
 * from what is committed. That is the whole point — DEVELOPER.md's hand-written
 * worked example has already drifted from types/steps.ts, and this cannot.
 */

const DOCS_DIR = join(process.cwd(), 'docs');

type FieldDoc = { name: string; type: string; required: boolean; description?: string };

/** Flattens a zod object schema into a documentable field list. */
const describeFields = (schema: z.ZodTypeAny): FieldDoc[] => {
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: 'none' }) as {
    type?: string;
    properties?: Record<string, { type?: string; description?: string; enum?: unknown[] }>;
    required?: string[];
  };

  if (!jsonSchema.properties) return [];

  const required = new Set(jsonSchema.required ?? []);
  return Object.entries(jsonSchema.properties).map(([name, property]) => ({
    name,
    type: property.enum ? property.enum.map((v) => JSON.stringify(v)).join(' | ') : property.type ?? 'unknown',
    required: required.has(name),
    description: property.description,
  }));
};

const acceptsConfig = (schema: z.ZodTypeAny) => !(schema instanceof z.ZodUndefined);

/** Which shipped actions use each step, so the docs show real usage. */
const usedBy = (stepId: STEPS): string[] =>
  config.actions.filter((action) => action.steps.some((step) => step.id === stepId)).map((action) => action.name);

const stepIds = Object.values(STEPS);

const model = stepIds.map((id) => {
  const definition = STEP_CATALOGUE[id];
  // `.unwrap()` where the config schema is optional, so the fields are visible.
  const configSchema =
    definition.configSchema instanceof z.ZodOptional ? definition.configSchema.unwrap() : definition.configSchema;

  return {
    id,
    summary: definition.summary,
    kind: definition.kind,
    implemented: definition.implemented,
    requires: definition.requires,
    msgTypeUrls: definition.msgTypeUrls,
    configFields: acceptsConfig(definition.configSchema) ? describeFields(configSchema) : [],
    acceptsConfig: acceptsConfig(definition.configSchema),
    dataFields: describeFields(definition.dataSchema),
    usedBy: usedBy(id),
  };
});

const byKind = (kind: StepKind) => model.filter((step) => step.implemented && step.kind === kind);

const table = (rows: string[][], headers: string[]) =>
  [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');

const stepSection = (step: (typeof model)[number]) => {
  const lines = [`#### \`${step.id}\``, '', step.summary, ''];

  if (step.requires.length) {
    lines.push(`**Requires earlier in the action:** ${step.requires.map((r) => `\`${r}\``).join(', ')}`, '');
  }
  if (step.msgTypeUrls.length) {
    lines.push(`**Emits:** ${step.msgTypeUrls.map((m) => `\`${m}\``).join(', ')}`, '');
  }

  if (step.acceptsConfig && step.configFields.length) {
    lines.push('**Config:**', '');
    lines.push(
      table(
        step.configFields.map((field) => [
          `\`${field.name}\``,
          field.type,
          field.required ? 'yes' : 'no',
          field.description ?? '',
        ]),
        ['Field', 'Type', 'Required', 'Description'],
      ),
      '',
    );
  } else {
    lines.push('**Config:** none — supplying one is a config error, not a no-op.', '');
  }

  if (step.usedBy.length) {
    lines.push(`**Used by:** ${step.usedBy.join(', ')}`, '');
  }

  return lines.join('\n');
};

const messageMatrix = table(
  model
    .filter((step) => step.msgTypeUrls.length)
    .flatMap((step) => step.msgTypeUrls.map((url) => [`\`${url}\``, `\`${step.id}\``])),
  ['Message', 'Step'],
);

const markdown = `<!--
  GENERATED FILE — DO NOT EDIT.
  Produced by scripts/gen-capabilities.ts from constants/stepCatalogue.ts.
  Run \`yarn gen\` after changing the catalogue; CI fails if this file is stale.
-->

# JAMBO capabilities

Every step a JAMBO action can be composed from, what it captures, and which chain
message it produces. Use this to decide whether a use-case can be expressed with
the steps that exist, or whether it needs a new one.

An **action** is a named sequence of steps, declared in \`constants/config.json\`
and routed at \`/<action.id>\`. Steps run in order; each captures data that later
steps read. Every action must end with a \`review\` or \`external\` step.

Step kinds:

- **input** — captures data. Cannot end an action.
- **review** — assembles and broadcasts a transaction. Ends an action.
- **external** — hands off to a third party and emits no chain message. Ends an action.

## Message support

JAMBO currently emits ${model.filter((s) => s.msgTypeUrls.length).length} message types, all \`cosmos-sdk\`.
There is no IBC transfer, no CosmWasm, no \`gov/v1\`, and no ixo-specific module
(entity, iid, claims, bonds, tokens) — so a use-case needing those needs a new
step and message builder first. See \`docs/RECIPES.md\`.

${messageMatrix}

## Review steps

${byKind('review').map(stepSection).join('\n')}

## Input steps

${byKind('input').map(stepSection).join('\n')}

## External steps

${byKind('external').map(stepSection).join('\n')}

## Declared but not implemented

These ids exist in the \`STEPS\` enum but have no component wired into
\`pages/[actionId].tsx\`. \`yarn validate:config\` rejects any action referencing
them.

${model
  .filter((step) => !step.implemented)
  .map((step) => `- \`${step.id}\` — ${step.summary}`)
  .join('\n')}

## Shipped actions

${table(
  config.actions.map((action) => [
    `\`${action.id}\``,
    action.name,
    action.steps.map((step) => `\`${step.id}\``).join(' → '),
  ]),
  ['Id', 'Name', 'Steps'],
)}
`;

mkdirSync(DOCS_DIR, { recursive: true });
writeFileSync(join(DOCS_DIR, 'CAPABILITIES.md'), markdown);
writeFileSync(join(DOCS_DIR, 'capabilities.json'), `${JSON.stringify(model, null, 2)}\n`);
console.log(`Wrote docs/CAPABILITIES.md and docs/capabilities.json (${model.length} steps)`);
