/**
 * 96a — THE CSS TOKEN PINS (Round 7 §96, the derived-artifact tripwire shape
 * of prior-table-coverage.test.ts applied to the stylesheet). `ui.css` holds a
 * `:root` block of `--color-*` tokens; the palette's names MIRROR `COLORS` in
 * src/render/palette.ts (kebab of the key) at the default palette's hexes, and
 * palette.ts stays the source of truth — so a retune there that forgets the
 * sheet fails here, on the forgetful path. (Thirteen names at 96a; 116f moved
 * the sheet's hue shades and the status hues onto the palette, thirty in all.) The alternative (inject the block from palette.ts at boot)
 * was rejected at the §96 kickoff: it makes the sheet unrenderable without the
 * game's JS for nothing this pin doesn't give. 116f's second palette keeps to
 * that: the sheet spells the default, and the boot sets only the tokens
 * another palette changes (`tokenOverrides`).
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

/**
 * 96b — the text tokens: every `font-size` below `:root` is a `--text-*`
 * token, every token is authored in rem (the Text size setting sets the root
 * element's font-size and the ladder follows), and every token is referenced.
 */
describe('96b — the CSS text tokens', () => {
  const textTokens = new Map<string, string>();
  for (const m of rootBlock.matchAll(/(--text-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    textTokens.set(m[1]!, m[2]!.trim());
  }

  it('authors every text token in rem', () => {
    const bad = [...textTokens].filter(([, v]) => !/^[0-9.]+rem$/.test(v)).map(([k, v]) => `${k}: ${v}`);
    expect(textTokens.size, 'no --text-* tokens in :root').toBeGreaterThan(0);
    expect(bad, `non-rem text tokens: ${bad.join(' ')}`).toEqual([]);
  });

  it('routes every font-size below :root through a token', () => {
    const hits = [...body.matchAll(/font-size\s*:\s*([^;]+);/g)]
      .map((m) => m[1]!.trim())
      .filter((v) => !/^var\(--text-[a-z0-9-]+\)$/.test(v));
    expect(hits, `literal font-size in ${SHEET} — add a --text-* token: ${hits.join(' ')}`).toEqual([]);
    for (const m of body.matchAll(/var\((--text-[a-z0-9-]+)\)/g)) {
      expect(textTokens.has(m[1]!), `font-size references an undefined token ${m[1]}`).toBe(true);
    }
  });

  it('references every text token at least once', () => {
    const orphans = [...textTokens.keys()].filter((name) => !body.includes(`var(${name})`));
    expect(orphans, `unreferenced text tokens in ${SHEET} :root: ${orphans.join(' ')}`).toEqual([]);
  });
});

/**
 * 116k — the boxes that hold text. The Text size setting grows every
 * `--text-*` token, so a box that holds text has to grow with it: its width
 * and height are in rem (or follow their content). A box sized in px keeps
 * its size while the text in it grows, and the text spills or is cut; the
 * survey that found the twenty-four such boxes swept at 116k is
 * shell/electron/probes/text-scale.js.
 *
 * The pin: a `width`, `height` (with their `min-` and `max-` forms), a
 * `flex` basis or a custom property that is 16px or more is on the list
 * below, with why it holds no text. Under 16px, one line at the default
 * size, a box can't hold text (a bar, a rule, a tick). A new box that holds
 * text is sized in rem; a new one that doesn't joins the list.
 */
const FIXED_BOXES: ReadonlyArray<readonly [rule: string, why: string]> = [
  ['.unit-overlay-stack { width: calc(56px * var(--fp-scale, 1)) }', "a unit's bars, as wide as its footprint on the board"],
  ['.map-node { width: 40px }', "the map's grid: a node keeps its place at every text size"],
  ['.map-node { height: 40px }', "the map's grid"],
  ['.hud-player-pane { max-width: min(94vw, 1800px) }', 'a ceiling for a very wide window, not a size'],
  ['.hud-enemy-pane { max-width: min(94vw, 1800px) }', 'a ceiling for a very wide window, not a size'],
];

/** Every size declaration of `minPx` or more in px, as `selector { prop: value }`. */
function fixedBoxes(sheet: string, minPx = 16): string[] {
  const sized = /^(--[a-z0-9-]+|(min-|max-)?(width|height)|flex(-basis)?)$/;
  const found: string[] = [];
  const open: string[] = [];
  let chunk = '';
  for (const ch of sheet) {
    if (ch === '{') {
      open.push(chunk.replace(/\s+/g, ' ').trim());
      chunk = '';
    } else if (ch === '}') {
      open.pop();
      chunk = '';
    } else if (ch === ';') {
      const colon = chunk.indexOf(':');
      const prop = chunk.slice(0, colon).trim();
      const value = chunk.slice(colon + 1).replace(/\s+/g, ' ').trim();
      chunk = '';
      if (colon < 0 || !sized.test(prop)) continue;
      const px = [...value.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
      if (px.some((n) => n >= minPx)) found.push(`${open.at(-1) ?? ''} { ${prop}: ${value} }`);
    } else {
      chunk += ch;
    }
  }
  return found;
}

describe('116k — the boxes that hold text are sized in rem', () => {
  it('reads a planted sheet: a px box is found, a bar and a rem box are not', () => {
    const planted = `
      .card { width: 184px; }
      .bar { height: 6px; width: 100%; }
      .panel { max-width: min(35rem, 90vw); }
      .row,
      .row--wide { flex: 1 1 320px; }
      :root { --plate-w: 200px; --gap: 12px; }
      @media (min-width: 900px) { .tall { min-height: 48px; } }
    `;
    expect(fixedBoxes(planted)).toEqual([
      '.card { width: 184px }',
      '.row, .row--wide { flex: 1 1 320px }',
      ':root { --plate-w: 200px }',
      '.tall { min-height: 48px }',
    ]);
  });

  it('sizes no box of 16px or more in px, but for the listed ones', () => {
    const found = fixedBoxes(css);
    const listed = FIXED_BOXES.map(([rule]) => rule);
    const unlisted = found.filter((rule) => !listed.includes(rule));
    expect(
      unlisted,
      `${SHEET} sizes a box in px. If it holds text, size it in rem; if not, add it to FIXED_BOXES with why:\n${unlisted.join('\n')}`,
    ).toEqual([]);
    const gone = listed.filter((rule) => !found.includes(rule));
    expect(gone, `FIXED_BOXES lists a rule the sheet no longer has:\n${gone.join('\n')}`).toEqual([]);
  });
});
