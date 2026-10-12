/**
 * `npm run oracle`: the two path-by-path proofs from the command line.
 *
 *   npm run oracle -- config-dump <out.json>     every config loader's exports (configDump.ts)
 *   npm run oracle -- json-diff <before> <after>  two JSON files, or two folders of them, path by path (jsonDiff.ts)
 *
 * `json-diff` prints the differences counted by kind and path shape, then the
 * first of them in full, and exits 1 when there is any. For a change that is
 * meant to differ somewhere (a field dropped from the save), read the shapes:
 * the proof is that nothing else is in the list.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dumpConfig } from './configDump';
import { describeDifference, jsonDiff, summarize, type JsonDifference } from './jsonDiff';

const [command, a, b] = process.argv.slice(2);
const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));

async function main(): Promise<number> {
  if (command === 'config-dump' && a !== undefined) {
    const dump = await dumpConfig();
    writeFileSync(a, `${JSON.stringify(dump, null, 1)}\n`);
    console.log(`oracle: ${Object.keys(dump).length} exports from the modules under src/config → ${a}`);
    return 0;
  }
  if (command === 'json-diff' && a !== undefined && b !== undefined) {
    // Paths are kept relative to each file, so one field dropped from thirty
    // snapshots is one shape; `file` says where each difference was found.
    const found: { file: string; d: JsonDifference }[] = [];
    if (statSync(a).isDirectory()) {
      const names = new Set([...readdirSync(a), ...readdirSync(b)].filter((name) => name.endsWith('.json')));
      for (const name of [...names].sort()) {
        const [inA, inB] = [existsSync(join(a, name)), existsSync(join(b, name))];
        if (!inA) found.push({ file: name, d: { kind: 'added', path: '', after: '(the file)' } });
        else if (!inB) found.push({ file: name, d: { kind: 'removed', path: '', before: '(the file)' } });
        else for (const d of jsonDiff(read(join(a, name)), read(join(b, name)))) found.push({ file: name, d });
      }
      const differing = new Set(found.map((f) => f.file)).size;
      console.log(`oracle: ${names.size} files compared, ${differing} of them differ`);
    } else {
      for (const d of jsonDiff(read(a), read(b))) found.push({ file: '', d });
    }
    if (found.length === 0) {
      console.log('oracle: no difference');
      return 0;
    }
    console.log(`oracle: ${found.length} differences, by kind and path shape:`);
    for (const line of summarize(found.map((f) => f.d))) console.log(`  ${line}`);
    console.log('oracle: the first of them:');
    for (const { file, d } of found.slice(0, 12)) console.log(`  ${file === '' ? '' : `${file}: `}${describeDifference(d)}`);
    return 1;
  }
  console.error('usage: npm run oracle -- config-dump <out.json> | json-diff <before> <after>');
  return 2;
}

void main().then((code) => process.exit(code));
