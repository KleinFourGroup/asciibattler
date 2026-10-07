import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { repoRead, runtimeGraph } from './importGraph';

// 116j — EVERY LIBRARY THE GAME BUNDLES HAS ITS NOTICE IN THE SHIPPED FILE.
//
// `public/THIRD-PARTY-LICENSES.txt` lands in `dist/` beside the build, since
// a licence's notice is owed with each copy of the software. Which libraries
// that means is read from the source's run-time import graph (importGraph.ts,
// what the bundler follows), not from package.json: a package imported from a
// new place, or a devDependency that starts to ship, fails here by name. Each
// library's own LICENSE file must be in the shipped file whole, so a
// copyright line that changes with an upgrade fails too, until the section
// is copied again.

const FILE = 'public/THIRD-PARTY-LICENSES.txt';
const text = (path: string): string => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

/** The package a specifier names: `three/examples/jsm/x.js` is `three`, and
 *  `@scope/name/sub` is `@scope/name`. */
const packageOf = (specifier: string): string =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');

/** The packages whose LICENSE file `file` does not hold whole. */
const missing = (packages: readonly string[], file: string): string[] =>
  packages.filter((pkg) => !file.includes(text(`node_modules/${pkg}/LICENSE`).trim()));

describe('116j — the shipped licence file', () => {
  const packages = [...new Set(runtimeGraph('src/main.ts', repoRead).packages.map(packageOf))].sort();

  it('the game bundles these libraries and no other', () => {
    // A new name here needs its section in the file, and its line in the
    // credits (locales/en/ui.json, `credits.libraries.*`).
    expect(packages).toEqual(['simplex-noise', 'three', 'zod']);
  });

  it("holds each bundled library's LICENSE file whole", () => {
    expect(missing(packages, text(FILE))).toEqual([]);
  });

  it('the control: a file that lacks a notice, or holds an older one, names the library', () => {
    const file = text(FILE);
    const three = text('node_modules/three/LICENSE').trim();
    expect(file).toContain(three);
    expect(missing(packages, file.replace(three, ''))).toEqual(['three']);
    expect(missing(packages, file.replace('three.js authors', 'three.js author'))).toEqual(['three']);
    expect(missing(packages, '')).toEqual(packages);
  });

  it('still holds the two fonts, each with its licence', () => {
    const file = text(FILE);
    expect(file).toContain('JetBrains Mono (font)');
    expect(file).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(file).toContain('DejaVu Sans Mono (font)');
    expect(file).toContain('Bitstream Vera Fonts Copyright');
  });
});
