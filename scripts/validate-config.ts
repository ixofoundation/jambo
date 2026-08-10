/* eslint-disable no-console */
import { existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

import { configSchema } from '../constants/config.schema';
import { IMPLEMENTED_STEP_IDS } from '../constants/stepCatalogue';
import config from '../constants/config.json';

/**
 * Validates `constants/config.json` and prints errors an agent (or a person) can act
 * on without reading the schema: the exact path, what is wrong, and what to do.
 *
 * Run directly with `yarn validate:config`. The same schema also runs inside
 * `getStaticPaths`, so `next build` fails on an invalid config too — this script
 * exists because it is a far faster loop than a full build.
 */

const CONFIG_PATH = 'constants/config.json';
const ACTION_IMAGE_DIR = join(process.cwd(), 'public', 'images', 'actions');

type Problem = { path: string; message: string };

/** Levenshtein distance, used only to suggest a near-miss step or field name. */
const distance = (a: string, b: string): number => {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + substitution);
    }
  }
  return rows[a.length][b.length];
};

const suggest = (value: string, candidates: readonly string[]): string | undefined => {
  const ranked = candidates
    .map((candidate) => ({ candidate, score: distance(value.toLowerCase(), candidate.toLowerCase()) }))
    .sort((a, b) => a.score - b.score);
  // Only suggest a genuine near-miss, otherwise the hint is noise.
  return ranked[0] && ranked[0].score <= Math.max(3, Math.floor(value.length / 2)) ? ranked[0].candidate : undefined;
};

const formatIssue = (issue: z.ZodIssue): Problem => {
  const path = issue.path.length ? issue.path.join('.') : '(root)';

  if (issue.code === z.ZodIssueCode.invalid_enum_value) {
    const received = String(issue.received);
    const hint = suggest(received, IMPLEMENTED_STEP_IDS);
    return {
      path,
      message:
        `"${received}" is not a known step id.` +
        (hint ? `\n    Did you mean "${hint}"?` : '') +
        `\n    Full catalogue: docs/CAPABILITIES.md`,
    };
  }

  if (issue.code === z.ZodIssueCode.unrecognized_keys) {
    return { path, message: `Unrecognized config key(s): ${issue.keys.join(', ')}` };
  }

  return { path, message: issue.message };
};

/** Filesystem checks the schema deliberately cannot make. */
const checkAssets = (parsed: z.infer<typeof configSchema>): Problem[] =>
  parsed.actions.flatMap((action, index) =>
    existsSync(join(ACTION_IMAGE_DIR, action.image))
      ? []
      : [
          {
            path: `actions.${index}.image`,
            message:
              `"${action.image}" was not found in public/images/actions/.\n` +
              `    The dApp will fall back to fallback.png, which is probably not what you want.`,
          },
        ],
  );

const report = (problems: Problem[]) => {
  console.error(`\n${CONFIG_PATH} is invalid (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n`);
  for (const problem of problems) {
    console.error(`  ${problem.path}`);
    console.error(`    ${problem.message}\n`);
  }
};

const main = () => {
  const result = configSchema.safeParse(config);

  if (!result.success) {
    report(result.error.issues.map(formatIssue));
    process.exit(1);
  }

  const assetProblems = checkAssets(result.data);
  if (assetProblems.length) {
    report(assetProblems);
    process.exit(1);
  }

  const actionCount = result.data.actions.length;
  const stepCount = result.data.actions.reduce((total, action) => total + action.steps.length, 0);
  console.log(`${CONFIG_PATH} is valid — ${actionCount} actions, ${stepCount} steps.`);
};

main();
