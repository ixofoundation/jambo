import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { STEP_CATALOGUE, TERMINAL_KINDS, TERMINAL_STEP_IDS, IMPLEMENTED_STEP_IDS } from '@constants/stepCatalogue';
import { STEPS } from 'types/steps';

/**
 * Parity between the STEPS enum, the catalogue, and the component switch.
 *
 * Adding a step means touching several files, and forgetting one of them used to
 * fail silently — a step id with no case in `getStepComponent` rendered an
 * indefinite spinner. These tests turn each of those omissions into a failure with
 * a name.
 */

const actionPageSource = readFileSync(join(process.cwd(), 'pages', '[actionId].tsx'), 'utf8');

describe('STEP_CATALOGUE', () => {
  it('has an entry for every member of the STEPS enum', () => {
    const missing = Object.values(STEPS).filter((id) => !STEP_CATALOGUE[id]);
    expect(missing, `STEPS members with no catalogue entry: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no entry for an id that is not in the STEPS enum', () => {
    const known = new Set<string>(Object.values(STEPS));
    const extra = Object.keys(STEP_CATALOGUE).filter((id) => !known.has(id));
    expect(extra).toEqual([]);
  });

  it('gives every implemented review step at least one message type url', () => {
    const offenders = IMPLEMENTED_STEP_IDS.filter(
      (id) => STEP_CATALOGUE[id].kind === 'review' && STEP_CATALOGUE[id].msgTypeUrls.length === 0,
    );
    expect(offenders, `review steps that emit no message: ${offenders.join(', ')}`).toEqual([]);
  });

  it('gives input steps no message type urls', () => {
    const offenders = Object.values(STEPS).filter(
      (id) => STEP_CATALOGUE[id].kind === 'input' && STEP_CATALOGUE[id].msgTypeUrls.length > 0,
    );
    expect(offenders).toEqual([]);
  });

  it('only lists prerequisites that are themselves implemented step ids', () => {
    for (const id of IMPLEMENTED_STEP_IDS) {
      for (const dependency of STEP_CATALOGUE[id].requires) {
        expect(IMPLEMENTED_STEP_IDS, `${id} requires ${dependency}`).toContain(dependency);
      }
    }
  });

  it('has no step requiring itself', () => {
    const offenders = Object.values(STEPS).filter((id) => STEP_CATALOGUE[id].requires.includes(id));
    expect(offenders).toEqual([]);
  });

  it('marks at least one step as terminal, otherwise no action could ever validate', () => {
    expect(TERMINAL_STEP_IDS.length).toBeGreaterThan(0);
    for (const id of TERMINAL_STEP_IDS) {
      expect(TERMINAL_KINDS).toContain(STEP_CATALOGUE[id].kind);
    }
  });
});

describe('catalogue matches the component switch', () => {
  /**
   * The failure this catches: marking a step `implemented: true` without adding a
   * `case` to `getStepComponent`. The config validator would then happily accept
   * the step id and the user would land on the UnknownStep screen.
   */
  it('has a case in pages/[actionId].tsx for every implemented step', () => {
    const missing = IMPLEMENTED_STEP_IDS.filter((id) => !actionPageSource.includes(`case STEPS.${id}:`));
    expect(missing, `Steps marked implemented but with no case in getStepComponent: ${missing.join(', ')}`).toEqual([]);
  });

  it('does not have a case for any step marked unimplemented', () => {
    const unexpected = Object.values(STEPS)
      .filter((id) => !STEP_CATALOGUE[id].implemented)
      .filter((id) => actionPageSource.includes(`case STEPS.${id}:`));
    expect(
      unexpected,
      `Steps wired into getStepComponent but marked implemented: false: ${unexpected.join(', ')}`,
    ).toEqual([]);
  });
});
