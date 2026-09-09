/**
 * §95d — THE LITERAL PIN (Round 7 spec §5: "a coverage pin that fails on a
 * new hardcoded user-facing literal"), riding `npm test` on the forgetful
 * path. The scan (src/i18n/literalScan.ts) finds prose-shaped string
 * literals in the presentation layer; this test holds every scanned file to
 * its count in tests/i18n-literal-baseline.json EXACTLY — a ratchet:
 *
 *   - a file OVER its baseline has a NEW hardcoded literal → route it
 *     through `t()` (locales/en/ui.json), or mark a non-prose false positive
 *     `// i18n-ok` on its line;
 *   - a file UNDER its baseline has been extracted → lower the baseline
 *     (`npm run i18n:baseline`) in the same commit, so it can never creep
 *     back up;
 *   - a file ABSENT from the baseline must have zero.
 *
 * §96–§100 drive the baseline to empty; §103 signs it there.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASELINE_PATH, baselineOf, scanRepo, type LiteralBaseline } from '../src/i18n/literalBaseline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOWER = 'lower the baseline with `npm run i18n:baseline` in the same commit';

describe('the literal pin (per-file ratchet against tests/i18n-literal-baseline.json)', () => {
  const literals = scanRepo(ROOT);
  const live = baselineOf(literals);
  const baseline = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), 'utf8')) as LiteralBaseline;
  const files = new Set([...Object.keys(live), ...Object.keys(baseline)]);

  for (const file of [...files].sort()) {
    it(`${file}: ${live[file] ?? 0} prose literal(s) (baseline ${baseline[file] ?? 0})`, () => {
      const n = live[file] ?? 0;
      const b = baseline[file] ?? 0;
      if (n > b) {
        const offenders = literals
          .filter((l) => l.file === file)
          .map((l) => `${file}:${l.line} ${JSON.stringify(l.text)}`);
        expect.fail(
          `${file} has ${n} hardcoded prose literal(s), baseline ${b} — route the new one(s) through t() (locales/en/ui.json), or mark a non-prose false positive \`// ${'i18n-ok'}\`. Literals now:\n  ${offenders.join('\n  ')}`,
        );
      }
      if (n < b) {
        expect.fail(`${file} is DOWN to ${n} literal(s) from a baseline of ${b} — good; ${LOWER}.`);
      }
    });
  }

  it('the baseline file lists no file that is not scanned', () => {
    const stale = Object.keys(baseline).filter((f) => !(f in live) && baseline[f] !== 0);
    expect(stale, `baseline entries with no live literals (deleted or fully extracted) — ${LOWER}: ${stale.join(', ')}`).toEqual([]);
  });
});
