/* eslint-disable no-console */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { configSchema } from '../constants/config.schema';

/**
 * Generates `config.schema.json` from the zod schema so editors can validate
 * `constants/config.json` as you type (it references this file via `$schema`).
 *
 * Never edit the output by hand — CI runs `yarn gen` and fails if the result
 * differs from what is committed.
 *
 * Note that zod refinements (unique action ids, step ordering, terminal step) have
 * no JSON Schema equivalent and are therefore absent here. The editor catches
 * shape errors; `yarn validate:config` catches the rest.
 */

const OUTPUT = join(process.cwd(), 'config.schema.json');

const schema = zodToJsonSchema(configSchema, {
  name: 'JamboConfig',
  $refStrategy: 'none',
});

writeFileSync(OUTPUT, `${JSON.stringify(schema, null, 2)}\n`);
console.log('Wrote config.schema.json');
