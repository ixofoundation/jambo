/**
 * Config types are derived from the zod schema in `constants/config.schema.ts`,
 * which is the single source of truth for the shape of `constants/config.json`.
 *
 * This file used to read `type Config = typeof config` — inferring the type from
 * the very artefact it was meant to constrain, which made any config definitionally
 * valid and left the type system unable to object to anything.
 */
export type { ConfigData, ActionData, StepData } from '@constants/config.schema';

export type { ConfigData as Config } from '@constants/config.schema';
