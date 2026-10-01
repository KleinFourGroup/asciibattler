// 113e — `npm run save:fingerprint`: re-pin tests/run-snapshot-shape.txt, the
// copy of `RunSnapshot`'s structure that tests/save-fingerprint.test.ts holds
// the types against (Round 8 spec D2).
//
//   npm run save:fingerprint                            after a RUN_SCHEMA_VERSION bump
//   npm run save:fingerprint -- --compatible="<why>"    the shape changed and old saves still load
//
// It refuses to re-pin a changed shape at an unchanged version without a
// reason, because that is the mistake the pin exists to catch. The reason is
// written into the file, where a reviewer sees it; the next bump clears it.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIN_FILE, repin, runSnapshotShape } from '../tests/saveShape';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const flag = process.argv.find((a) => a.startsWith('--compatible='));
const reason = flag === undefined ? null : flag.slice('--compatible='.length);

const path = join(ROOT, PIN_FILE);
const current = runSnapshotShape(ROOT);
const result = repin(existsSync(path) ? readFileSync(path, 'utf8') : null, current, reason);

if (result.kind === 'unchanged') {
  console.log(`${PIN_FILE} is current (RUN_SCHEMA_VERSION ${current.version}).`);
} else if (result.kind === 'write') {
  writeFileSync(path, result.text, 'utf8');
  console.log(`${PIN_FILE} re-pinned at RUN_SCHEMA_VERSION ${current.version}.`);
} else {
  console.error(result.message);
  process.exit(1);
}
