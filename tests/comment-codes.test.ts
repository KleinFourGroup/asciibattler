/**
 * The step-code ceiling: the count of step codes in the comments under
 * `src`, held by file to tests/comment-codes-baseline.json, so that it can
 * only fall.
 *
 *   - a file OVER its ceiling has a new step code in a comment. Say what the
 *     code stood for instead (AGENTS "Voice"): a reader of the source cannot
 *     resolve "74b". What counts as a code is the header of
 *     tests/oracle/stepCodes.ts.
 *   - a file UNDER its ceiling has had codes rewritten out, or is gone.
 *     Lower the ceiling in the same commit (`npm run oracle -- comment-codes
 *     --record`), so the count cannot creep back.
 *   - a file absent from the baseline must hold none.
 */

import { describe, expect, it } from 'vitest';
import { COUNTED_ROOTS, REPO_ROOT, ceilingDrift, ceilingOf, listSources, readCeiling, scanStepCodes, total } from './oracle/stepCodes';

const LOWER = 'lower the ceiling with `npm run oracle -- comment-codes --record` in the same commit';

describe('the step-code ceiling (tests/comment-codes-baseline.json)', () => {
  const codes = scanStepCodes();
  const live = ceilingOf(codes);
  const ceiling = readCeiling();
  const drift = ceilingDrift(live, ceiling);

  it('no file holds more step codes in its comments than its ceiling', () => {
    const report = drift.over.map((f) => {
      const held = codes.filter((c) => c.file === f.file).map((c) => `    ${f.file}:${c.line}  ${c.code}`);
      return `  ${f.file}: ${f.now}, ceiling ${f.ceiling}. Its codes now:\n${held.join('\n')}`;
    });
    expect(report, `a new step code in a comment; say what it stood for instead (AGENTS "Voice"):\n${report.join('\n')}`).toEqual([]);
  });

  it('no file holds fewer without the ceiling coming down', () => {
    const report = drift.under.map((f) => `${f.file}: ${f.now}, ceiling ${f.ceiling}`);
    expect(report, `fewer step codes than the ceiling, which is the aim; ${LOWER}:\n  ${report.join('\n  ')}`).toEqual([]);
  });

  it('the scan walks the tree it is named for', () => {
    // Once every code is rewritten out, an empty scan agrees with an empty
    // baseline. This is what still says the scan looked.
    const files = listSources(REPO_ROOT, COUNTED_ROOTS);
    expect(files.length).toBeGreaterThan(300);
    expect(files).toEqual(expect.arrayContaining(['src/main.ts', 'src/sim/World.ts', 'src/ui/ui.css', 'src/render/shaders/sprite.frag.glsl']));
    expect(total(live)).toBe(codes.length);
  });
});
