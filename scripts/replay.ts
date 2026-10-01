// `npm run replay -- <file> [--force]`: replay a run journal headless and say
// whether the replay reached what the journal recorded (Round 8 spec D4).
//
//   npm run replay -- run.json            a journal the game exported
//   npm run replay -- report.json         a probe report carrying one (drive-run.js)
//   npm run replay -- run.json --force    past the build refusals
//
// A journal replays on the build that recorded it: the tool refuses one from
// another commit, from a `-dirty` build, or with no commit in its build ID,
// unless forced, and always refuses another config hash. The rules, the
// output and the exit codes (0 replayed, 1 diverged, 2 refused) are
// src/journal/replayTool.ts, which is tested; this file reads the file and
// asks git where the tree is.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayText } from '../src/journal/replayTool';
import { commitStamp } from './build-id.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const unknown = args.filter((a) => a.startsWith('--') && a !== '--force');

if (file === undefined || unknown.length > 0) {
  console.error('usage: npm run replay -- <journal.json> [--force]');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`replay: no such file: ${file}`);
  process.exit(1);
}

let tree: string;
try {
  tree = commitStamp(ROOT);
} catch {
  // No repository: nothing to hold a build ID against, so every one is refused.
  tree = 'nogit';
}

// A file a Windows shell redirected into can start with a byte-order mark.
const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
const { code, lines } = replayText(text, tree, { force: args.includes('--force') });
for (const line of lines) console.log(`replay: ${line}`);
process.exit(code);
