/**
 * 96a — THE CSS TOKEN PINS (Round 7 §96, the derived-artifact tripwire shape
 * of prior-table-coverage.test.ts applied to the stylesheet). `ui.css` holds a
 * `:root` block of `--color-*` tokens; the palette thirteen MIRROR `COLORS` in
 * src/render/palette.ts (kebab of the key), and palette.ts stays the source of
 * truth — so a retune there that forgets the sheet fails here, on the
 * forgetful path. The alternative (inject the block from palette.ts at boot)
 * was rejected at the §96 kickoff: it makes the sheet unrenderable without the
 * game's JS for nothing this pin doesn't give.
 *
 * Contract (config-derived — the token names are computed from the keys):
 *   1. every COLORS entry has its `--color-<kebab>` token at the same hex;
 *   2. zero raw hexes outside `:root` (comments stripped) — a new color is a
 *      token first;
 *   3. zero palette-triplet `rgba()` outside `:root` — tints go through
 *      relative color syntax `rgb(from var(--color-x) r g b / a)` so ONE token
 *      serves every alpha (black / white plate alphas are not palette and
 *      stay literal);
 *   4. every ROLE token (a non-palette `--color-*`) is referenced at least
 *      once — the palette tokens are exempt (they exist for the Round 8 swap's
 *      completeness, used or not).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS } from '../src/render/palette';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = 'src/ui/ui.css';

const raw = readFileSync(join(ROOT, SHEET), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

const rootMatch = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
if (rootMatch === null) throw new Error(`${SHEET}: no :root block`);
const rootBlock = rootMatch[1]!;
const body = css.slice(rootMatch.index + rootMatch[0].length);

const tokens = new Map<string, string>();
for (const m of rootBlock.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
  tokens.set(m[1]!, m[2]!.trim().toLowerCase());
}

const expand = (h: string): string =>
  h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h;
const tokenName = (key: string): string => `--color-${key.toLowerCase().replace(/_/g, '-')}`;

describe('96a — the CSS color tokens', () => {
  it('mirrors every COLORS entry at the same hex', () => {
    const misses: string[] = [];
    for (const [key, hex] of Object.entries(COLORS)) {
      const name = tokenName(key);
      const got = tokens.get(name);
      if (got === undefined) misses.push(`${name} MISSING (palette.ts ${key} = ${hex})`);
      else if (expand(got) !== hex.toLowerCase()) misses.push(`${name} = ${got}, palette.ts ${key} = ${hex}`);
    }
    expect(misses, `ui.css :root disagrees with palette.ts:\n${misses.join('\n')}`).toEqual([]);
  });

  it('has zero raw hexes outside :root', () => {
    const hits = body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hits, `raw hexes in ${SHEET} outside :root — add a token: ${hits.join(' ')}`).toEqual([]);
  });

  it('routes every palette tint through relative color syntax', () => {
    const palette = new Map<string, string>();
    for (const [name, hex] of tokens) {
      const h = expand(hex).slice(1);
      const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
      palette.set(rgb, name);
    }
    palette.delete('0,0,0');
    palette.delete('255,255,255');
    const hits: string[] = [];
    for (const m of body.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,|\/)/g)) {
      const key = `${m[1]},${m[2]},${m[3]}`;
      const tok = palette.get(key);
      if (tok !== undefined) hits.push(`${m[0]}… → rgb(from var(${tok}) r g b / a)`);
    }
    expect(hits, `palette-triplet rgba() in ${SHEET}:\n${hits.join('\n')}`).toEqual([]);
    for (const m of body.matchAll(/rgb\(from var\((--color-[a-z0-9-]+)\)/g)) {
      expect(tokens.has(m[1]!), `tint references an undefined token ${m[1]}`).toBe(true);
    }
  });

  it('references every role token at least once', () => {
    const paletteNames = new Set(Object.keys(COLORS).map(tokenName));
    const orphans = [...tokens.keys()].filter(
      (name) => !paletteNames.has(name) && !body.includes(`var(${name})`),
    );
    expect(orphans, `unreferenced role tokens in ${SHEET} :root: ${orphans.join(' ')}`).toEqual([]);
  });
});
