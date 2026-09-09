// §95d — `npm run i18n:baseline`: regenerate tests/i18n-literal-baseline.json
// from the live scan (the per-file count of player-facing prose literals not
// yet routed through t()). `--list` prints every literal with file:line
// instead — the worklist for a surface's extraction pass.
//
// The ratchet test (tests/i18n-literal-pin.test.ts) holds every file to its
// baseline EXACTLY: a new literal fails; an extracted one fails until the
// baseline is lowered (run this). The round's exit is an empty baseline.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASELINE_PATH, baselineOf, formatBaseline, scanRepo } from '../src/i18n/literalBaseline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const literals = scanRepo(ROOT);

if (process.argv.includes('--list')) {
  for (const l of literals) console.log(`${l.file}:${l.line}  ${JSON.stringify(l.text)}`);
  console.log(`\n${literals.length} literals in ${new Set(literals.map((l) => l.file)).size} files`);
} else {
  const baseline = baselineOf(literals);
  writeFileSync(join(ROOT, BASELINE_PATH), formatBaseline(baseline), 'utf8');
  for (const [file, n] of Object.entries(baseline)) console.log(`${String(n).padStart(4)}  ${file}`);
  console.log(`${BASELINE_PATH}: ${literals.length} literals in ${Object.keys(baseline).length} files`);
}
