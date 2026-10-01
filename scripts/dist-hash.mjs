// One hash for a whole build, so two builds compare byte for byte:
//
//   node scripts/dist-hash.mjs [dir]        dir defaults to dist
//   node scripts/dist-hash.mjs dist --files   also print each file's line
//
// SHA-256 of every file under the directory; one `path hash` line per file
// (the path relative to the directory, with forward slashes); the lines
// sorted and joined by newlines; SHA-256 of that text. It prints the total,
// the file count and the bytes, e.g. `4e969d27… over 32 files, 1,234,567 bytes`.
//
// A build's ID is part of its bytes, so pin it for a comparison across
// commits or tree states: ASCIIBATTLER_BUILD_ID=<any> npm run build
// (scripts/build-id.mjs). The recipe is the one the worklogs' `dist/` oracles
// used since §110, so their totals are known answers for this script.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** The total, the per-file lines and the byte count for the build at `dir`. */
export function distHash(dir) {
  let bytes = 0;
  const lines = filesUnder(dir)
    .map((path) => {
      const data = readFileSync(path);
      bytes += data.length;
      return `${relative(dir, path).split('\\').join('/')} ${sha256(data)}`;
    })
    .sort();
  return { total: sha256(lines.join('\n')), lines, bytes };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const args = process.argv.slice(2);
  const dir = resolve(args.find((a) => !a.startsWith('--')) ?? 'dist');
  const { total, lines, bytes } = distHash(dir);
  if (args.includes('--files')) for (const line of lines) console.log(line);
  console.log(`${total} over ${lines.length} files, ${bytes.toLocaleString('en-US')} bytes`);
}
