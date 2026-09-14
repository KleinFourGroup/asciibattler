/**
 * 97f — THE TITLE TRIPWIRE (Round 7 §97, the exit criterion on the forgetful
 * path): zero native `title=` in the presentation layer. The native tooltip
 * is hover-only, delayed, unstyled, and dead on touch and keyboard; §97
 * replaced its 20 sites with `attachTooltip` (src/ui/tooltip.ts — hover /
 * focus / tap or long-press / the `showTooltip` key). A new `el.title = …`
 * would quietly re-open the hole for one site, so the scan rides `npm test`
 * (AGENTS "put the guard where the MISTAKE happens") rather than a review.
 *
 * What counts: an assignment to a `.title` property (`el.title = x`,
 * `el.title += x`) or `setAttribute('title', …)`. What does not: an object
 * key named `title` (a modal's heading, a card-list button's option) and a
 * `.title` READ — those are headings, not hover text.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_ROOTS = ['src/ui', 'src/render'];

const TITLE_ASSIGN = /\.title\s*[+]?=(?!=)/;
const TITLE_ATTR = /setAttribute\(\s*['"]title['"]/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('97f — zero native title= in src/ui + src/render', () => {
  it('no file assigns an element title or sets the title attribute', () => {
    const hits: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walk(join(ROOT, root))) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          const code = line.replace(/\/\/.*$/, '');
          if (TITLE_ASSIGN.test(code) || TITLE_ATTR.test(code)) {
            hits.push(`${relative(ROOT, file).replace(/\\/g, '/')}:${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(
      hits,
      `native title= found — route it through attachTooltip (src/ui/tooltip.ts):\n${hits.join('\n')}`,
    ).toEqual([]);
  });
});
