import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../fuzz/commands/args';
import { runRunCli } from '../../fuzz/commands/run';
import { fuzzDiffShapes } from '../reach';

// THE FUZZ DIFF'S SHAPES, RUN IN THIS PROCESS. scripts/perf-oracle.sh runs
// them as command lines in two trees and compares the CSVs they write. A
// command line under tsx leaves nothing the coverage tool reads, so this
// sends the same flags through the same entry inside Vitest, and
// `npm run oracle -- reach-record fuzz-diff` reads which lines that proof
// executes. It compares nothing: the proof is the script.

describe('the fuzz diff’s shapes, for a reading of what they reach', () => {
  const shapes = fuzzDiffShapes(readFileSync('scripts/perf-oracle.sh', 'utf8'));

  it.each(shapes)('$name writes its summary', ({ flags }) => {
    const out = mkdtempSync(join(tmpdir(), 'fuzz-diff-'));
    try {
      runRunCli(parseArgs([...flags, `--out=${out}`]));
      expect(statSync(join(out, 'summary.csv')).size).toBeGreaterThan(0);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
