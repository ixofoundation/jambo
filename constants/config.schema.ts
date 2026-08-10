import { z } from 'zod';

import { STEP_CATALOGUE, TERMINAL_KINDS, TERMINAL_STEP_IDS } from '@constants/stepCatalogue';
import { STEPS } from 'types/steps';

/**
 * The schema for `constants/config.json` — the dApp manifest.
 *
 * This is the single source of truth for the config's shape. TypeScript types are
 * derived from it with `z.infer`, and `config.schema.json` is generated from it by
 * `scripts/gen-schema.ts`, so neither can drift.
 *
 * Kept free of Node built-ins (no `fs`) so it is safe to import from a page module.
 * Checks that need the filesystem — e.g. that an action's image actually exists —
 * live in `scripts/validate-config.ts`.
 */

const stepSchema = z
  .object({
    id: z.nativeEnum(STEPS),
    name: z.string().min(1, 'Step name cannot be empty'),
    config: z.unknown().optional(),
  })
  .superRefine((step, ctx) => {
    const definition = STEP_CATALOGUE[step.id];
    if (!definition) return;

    if (!definition.implemented) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id'],
        message:
          `Step "${step.id}" is declared in the STEPS enum but has no component wired into ` +
          `pages/[actionId].tsx, so it would render an indefinite loading spinner. ` +
          `Remove it, or implement it and set implemented: true in constants/stepCatalogue.ts.`,
      });
      return;
    }

    // A step that accepts no config should reject one rather than silently ignore it —
    // otherwise a misplaced or misspelled config block looks like it is doing something.
    const result = definition.configSchema.safeParse(step.config);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['config', ...issue.path],
          message:
            step.config !== undefined && definition.configSchema instanceof z.ZodUndefined
              ? `Step "${step.id}" accepts no config, but one was supplied.`
              : issue.message,
        });
      }
    }
  });

const actionSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        'Action id is used as a URL path segment, so it may only contain letters, digits, hyphens and underscores',
      ),
    name: z.string().min(1, 'Action name cannot be empty'),
    description: z.string(),
    image: z.string().regex(/\.(png|jpe?g|svg|webp)$/i, 'Action image must be a filename in public/images/actions/'),
    steps: z.array(stepSchema).min(1, 'An action needs at least one step'),
  })
  .superRefine((action, ctx) => {
    const ids = action.steps.map((step) => step.id);

    // An action must end in something that completes the flow — a review step that
    // broadcasts, or an external hand-off. Ending on an input step means the flow
    // collects data and then silently returns the user to the home screen.
    const last = ids[ids.length - 1];
    if (last && !TERMINAL_KINDS.includes(STEP_CATALOGUE[last]?.kind)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['steps', ids.length - 1],
        message:
          `Action "${action.name}" ends with "${last}" (kind: ${STEP_CATALOGUE[last]?.kind}), ` +
          `which only captures data. An action must end with a step that completes the flow.\n` +
          `    Available: ${TERMINAL_STEP_IDS.join(', ')}`,
      });
    }

    // A step that reads another step's data must come after it.
    action.steps.forEach((step, index) => {
      const required = STEP_CATALOGUE[step.id]?.requires ?? [];
      for (const dependency of required) {
        if (!ids.slice(0, index).includes(dependency)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['steps', index, 'id'],
            message: `Step "${step.id}" reads data captured by "${dependency}", which must appear earlier in this action.`,
          });
        }
      }
    });
  });

export const configSchema = z
  .object({
    siteName: z.string().min(1),
    siteUrl: z.string().url('siteUrl must be an absolute URL, e.g. https://example.org'),
    siteTitleMeta: z.string().min(1),
    siteDescriptionMeta: z.string().min(1),
    fontUrl: z.string().url(),
    fontName: z.string().min(1),
    headerShowName: z.boolean(),
    headerShowLogo: z.boolean(),
    about: z.string(),
    termsAndConditions: z.string(),
    actions: z.array(actionSchema).min(1, 'A dApp needs at least one action'),
  })
  // `$schema` is an editor affordance, not data.
  .extend({ $schema: z.string().optional() })
  .superRefine((config, ctx) => {
    const seen = new Map<string, number>();
    config.actions.forEach((action, index) => {
      const previous = seen.get(action.id);
      if (previous !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['actions', index, 'id'],
          message: `Duplicate action id "${action.id}" (also used by actions[${previous}]). Action ids become URL paths and must be unique.`,
        });
      }
      seen.set(action.id, index);
    });
  });

export type ConfigData = z.infer<typeof configSchema>;
export type ActionData = ConfigData['actions'][number];
export type StepData = ActionData['steps'][number];
