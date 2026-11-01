import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLYPHS } from '../src/render/glyphs';
import {
  subsetCovers,
  faceShips,
  FACES,
  FONT_STACK,
  PRIMARY_EXCLUDES,
} from '../src/render/fontSubset';
import { ttfCmapLookup } from '../tools/font/ttfCmap';
import { ttfVerticalMetrics } from '../tools/font/ttfMetrics';
import { parseGlyphTable, PUA_FIRST, PUA_LAST } from '../tools/font/glyphTable';
import { drawnFaceSources, shippedDrawnFace } from './glyphFaceFiles';

// §79-post — structural guards for the self-hosted font pipeline (§79g).
//
// gen:font carries its own hard gates, but they only run when someone runs
// gen:font — precisely the moment nobody forgets the font. The dangerous path
// is the reverse: a NEW catalog glyph lands (units.json is editor-authored —
// no code edit, no font thought), the committed woff2 predates it, and the
// only guard left was the DEV boot console.warn — the same "loud in dev" tier
// that let the original §79f fallback run silently for weeks. These make the
// contract fail `npm test` instead:
//
//   1. Every registered glyph is inside SUBSET_RANGES — else the generated
//      subsets would drop it even though a source font has it.
//   2. A vendored source TTF actually maps every registered glyph — the
//      ranges deliberately include PARTIAL upstream blocks, so "in range"
//      alone doesn't prove a face can supply it. Since §101a the faces are a
//      UNION (the primary + the one fallback, src/render/fontSubset.ts FACES).
//
// The drawn face, our own, is read from its shipped woff2, decompressed: it
// ships whole, so a code point it maps is shipped, and none of its code
// points may be mapped by a vendored face, which would paint it first. That
// the woff2 is the face its sources build is tests/glyph-face.test.ts's pin.
//
// §101a — THE UI GLYPH INVENTORY. The §79 pins guard the canvas atlas's
// GLYPHS only; the DOM UI had meanwhile come to carry 20 codepoints outside
// the shipped font (six absent from the TTF itself — `▤ ★ ☆ ☠ ⏸ ⌖`), each
// painting from an unknown OS face whose taller ascent grew the line it sat
// on: the 46 / 45 px chrome chip, the §101 layout class. The third pin walks
// every string the DOM can render (src/**, locales/**, config/**; comments
// stripped) and requires each non-ASCII codepoint to be SHIPPED — inside
// SUBSET_RANGES and in some face's cmap. A new glyph choice fails here with
// its file:line, on the forgetful path (`npm test`), instead of at a
// player's line height.
//
// Residual gap, accepted: a stale committed woff2 (ranges widened or a TTF
// upgraded without re-running gen:font) is caught only by the DEV boot assert
// — reading the woff2's cmap here would mean a brotli dependency for a case
// that requires deliberately touching the font pipeline while skipping its
// one documented command.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// The generator's rule, shared through faceShips: the primary reads as
// LACKING its PRIMARY_EXCLUDES (glyphs it carries but draws wrong —
// 101a-post), so "shipped" here means what gen:font would actually put in a
// subset, and the drawn face ships whole.
const drawnBytes = await shippedDrawnFace();
const faces = FACES.map((face) => {
  const cmapHas = ttfCmapLookup(
    face.role === 'drawn'
      ? drawnBytes
      : readFileSync(join(repoRoot, 'assets', 'fonts', face.dir, face.source)),
  );
  const has =
    face.role === 'primary'
      ? (cp: number): boolean => cmapHas(cp) && !PRIMARY_EXCLUDES.includes(cp)
      : cmapHas;
  return { face, cmapHas, has };
});
const someFaceHas = (cp: number): boolean => faces.some((f) => f.has(cp));
const shipped = (cp: number): boolean => faces.some((f) => faceShips(f.face, f.cmapHas, cp));
const drawn = faces.find((f) => f.face.role === 'drawn')!;
const vendored = faces.filter((f) => f.face.role !== 'drawn');

const codepointsOf = (glyph: string): number[] => [...glyph].map((ch) => ch.codePointAt(0)!);
/** A glyph with its code points, since a drawn glyph prints as nothing. */
const named = (glyph: string): string =>
  `${glyph} ${codepointsOf(glyph).map((cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`).join(' ')}`;

describe('font subset coverage (§79-post)', () => {
  it('every registered glyph falls inside the kept SUBSET_RANGES, or is drawn in our face', () => {
    const outsideRanges = GLYPHS.filter(
      (g) => !codepointsOf(g).every((cp) => subsetCovers(cp) || drawn.cmapHas(cp)),
    ).map(named);
    expect(
      outsideRanges,
      'widen SUBSET_RANGES (src/render/fontSubset.ts) + `npm run gen:font`, or draw it in assets/fonts/asciibattler-glyphs/',
    ).toEqual([]);
  });

  it('a vendored source TTF or the drawn face supplies every registered glyph', () => {
    const missingFromFont = GLYPHS.filter((g) => !codepointsOf(g).every(someFaceHas)).map(named);
    expect(
      missingFromFont,
      'no shipped face can supply these — pick different glyphs or add a face that has them',
    ).toEqual([]);
  });

  it('the control: a unit glyph the drawn face lacks fails both pins, one it draws passes', () => {
    const planted = [...GLYPHS, '\uE0FF', '\uE000'];
    expect(drawn.cmapHas(0xe000)).toBe(true);
    expect(planted.filter((g) => !codepointsOf(g).every((cp) => subsetCovers(cp) || drawn.cmapHas(cp)))).toEqual(['\uE0FF']);
    expect(planted.filter((g) => !codepointsOf(g).every(someFaceHas))).toEqual(['\uE0FF']);
    expect(planted.filter((g) => !codepointsOf(g).every(shipped))).toEqual(['\uE0FF']);
  });

  it('lists exactly one primary face, first, and the drawn face last', () => {
    expect(FACES.filter((f) => f.role === 'primary')).toHaveLength(1);
    expect(FACES[0]?.role).toBe('primary');
    expect(FACES.filter((f) => f.role === 'drawn')).toHaveLength(1);
    expect(FACES.at(-1)?.role).toBe('drawn');
  });

  it('a fallback face supplies every PRIMARY_EXCLUDES codepoint, inside the ranges', () => {
    // An exclusion with no fallback behind it would UNSHIP the glyph — back
    // to the OS face, the exact class the exclusion exists to avoid.
    const fallbacks = faces.filter((f) => f.face.role === 'fallback');
    const orphaned = PRIMARY_EXCLUDES.filter(
      (cp) => !subsetCovers(cp) || !fallbacks.some((f) => f.has(cp)),
    ).map((cp) => `U+${cp.toString(16).toUpperCase()}`);
    expect(orphaned, 'excluded from the primary but no fallback carries it').toEqual([]);
  });
});

// §101b — THE LINE-BOX PIN. Under `line-height: normal` a line is as tall as
// the TALLEST face painting a glyph on it, so a fallback whose ascent or
// descent exceeds the primary's grows every line it touches (the §101 class:
// an OS face made the cache chip 46px to the bits chip's 45). An explicit
// `line-height` on #ui was probed and rejected — it moved 19 of 65 text
// leaves by up to 1.5px (tools/font/ttfMetrics.ts has the story) — so the
// guard sits here, where a face gets added or upgraded. All three tables,
// because browsers disagree on which one they read.
describe('the fallback line box (§101b)', () => {
  const metricsOf = (face: (typeof FACES)[number]) =>
    ttfVerticalMetrics(
      face.role === 'drawn'
        ? drawnBytes
        : readFileSync(join(repoRoot, 'assets', 'fonts', face.dir, face.source)),
    );
  const primary = metricsOf(FACES.find((f) => f.role === 'primary')!);
  const fallbacks = FACES.filter((f) => f.role !== 'primary');

  it('read real metrics off the primary (the parser or the font drifted otherwise)', () => {
    // JetBrains Mono 2.304: 1.02 / 0.30 in all three tables, a 1.32 line.
    expect(primary.unitsPerEm).toBeGreaterThan(0);
    expect(primary.hhea[0]).toBeGreaterThan(0.5);
    expect(primary.hhea[1]).toBeGreaterThan(0.05);
    expect(primary.hheaLine).toBeGreaterThan(1);
  });

  it.each(fallbacks.map((f) => [f.family, f] as const))(
    '%s fits inside the primary line in hhea, OS/2 typo and OS/2 win',
    (_family, face) => {
      const m = metricsOf(face);
      const over: string[] = [];
      for (const table of ['hhea', 'typo', 'win'] as const) {
        if (m[table][0] > primary[table][0])
          over.push(`${table} ascent ${m[table][0].toFixed(3)} > ${primary[table][0].toFixed(3)}`);
        if (m[table][1] > primary[table][1])
          over.push(`${table} descent ${m[table][1].toFixed(3)} > ${primary[table][1].toFixed(3)}`);
      }
      if (m.hheaLine > primary.hheaLine)
        over.push(`hhea line ${m.hheaLine.toFixed(3)} > ${primary.hheaLine.toFixed(3)}`);
      if (m.typoLine > primary.typoLine)
        over.push(`typo line ${m.typoLine.toFixed(3)} > ${primary.typoLine.toFixed(3)}`);
      expect(over, 'this face would grow every line one of its glyphs lands on').toEqual([]);
    },
  );
});

describe('the drawn face', () => {
  // Every code point its shipped woff2 maps, read by a walk of the BMP.
  const mapped: number[] = [];
  for (let cp = 0; cp <= 0xffff; cp++) if (drawn.cmapHas(cp)) mapped.push(cp);

  it('maps the Private Use Area alone, and exactly the composition table', () => {
    // The walk's known answer: the table's first glyph, U+E000.
    expect(mapped).toContain(0xe000);
    expect(mapped.filter((cp) => cp < PUA_FIRST || cp > PUA_LAST)).toEqual([]);
    const table = parseGlyphTable(drawnFaceSources().table).map((r) => r.codePoint);
    expect(mapped).toEqual([...table].sort((a, b) => a - b));
  });

  it('draws no code point a vendored face maps, which would paint it first', () => {
    const shadowed = mapped
      .filter((cp) => vendored.some((f) => f.cmapHas(cp)))
      .map((cp) => `U+${cp.toString(16).toUpperCase()}`);
    expect(shadowed, 'pick a code point no vendored face has').toEqual([]);
    // The control: JetBrains Mono maps the Powerline glyphs at U+E0A0.
    expect(vendored.some((f) => f.cmapHas(0xe0a0))).toBe(true);
  });
});

// The roots a DOM string can come from. `src/` wholesale (sim / core carry no
// prose by design — a glyph there is still a glyph a screen might print), the
// locale table, and the config JSON (event pages, encounter names, unit
// glyphs). Tests are excluded: a test's own literals never render.
const SCAN_ROOTS = ['src', 'locales', 'config'];
const SCAN_EXT = /\.(ts|json|css)$/;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (SCAN_EXT.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
}

/** Comments out: `/* … *​/` blocks, whole-line `//` and ` * ` continuation
 *  lines, and a trailing ` // …` (whitespace on both sides, so a `://` URL
 *  inside a string survives). A glyph in a comment never renders. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => {
      const t = line.trimStart();
      if (t.startsWith('//') || t.startsWith('*')) return '';
      return line.replace(/\s+\/\/\s.*$/, '');
    })
    .join('\n');
}

interface Inventory {
  readonly codepoints: number;
  readonly offenders: string[];
}

function inventory(): Inventory {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) walk(join(repoRoot, root), files);
  const sites = new Map<number, string>();
  for (const f of files) {
    const lines = stripComments(readFileSync(f, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      for (const ch of line) {
        const cp = ch.codePointAt(0)!;
        if (cp < 0x80 || sites.has(cp)) continue;
        sites.set(cp, `${relative(repoRoot, f).replace(/\\/g, '/')}:${i + 1}`);
      }
    });
  }
  const offenders = [...sites.entries()]
    .filter(([cp]) => !shipped(cp))
    .map(
      ([cp, site]) =>
        `${String.fromCodePoint(cp)} U+${cp.toString(16).toUpperCase().padStart(4, '0')} (${site}) — ` +
        `${subsetCovers(cp) ? 'in range but no shipped face has it' : 'outside SUBSET_RANGES'}`,
    );
  return { codepoints: sites.size, offenders };
}

describe('the UI glyph inventory (§101a)', () => {
  const inv = inventory();

  it('found the inventory (the walk or the roots drifted otherwise)', () => {
    // 32 distinct non-ASCII codepoints at 101a; a walk that finds a handful
    // is reading the wrong tree, not a cleaner one.
    expect(inv.codepoints).toBeGreaterThanOrEqual(24);
  });

  it('every non-ASCII codepoint a DOM string can carry is shipped (in SUBSET_RANGES + a face cmap)', () => {
    expect(
      inv.offenders,
      'a glyph would paint from an unknown OS face — widen SUBSET_RANGES / add it to a shipped face + `npm run gen:font`, or pick a shipped glyph',
    ).toEqual([]);
  });
});

// The stylesheet's chain is a hand copy of FONT_STACK, the chain the tests
// above check: if the two part, the page paints from faces nobody checked.
const fontMono = (css: string): string | undefined => /--font-mono:\s*([^;]+);/.exec(css)?.[1];

describe("the sheet's font chain", () => {
  it("ui.css's --font-mono is FONT_STACK, then the generic tail", () => {
    const value = fontMono(readFileSync(join(repoRoot, 'src', 'ui', 'ui.css'), 'utf8'));
    expect(value?.startsWith(`${FONT_STACK}, `), `--font-mono (${value}) must begin with FONT_STACK (${FONT_STACK})`).toBe(true);
  });

  it('self-check: a chain with its faces swapped fails the pin', () => {
    const swapped = fontMono(":root { --font-mono: 'DejaVu Sans Mono', 'JetBrains Mono', monospace; }");
    expect(swapped).toBeDefined();
    expect(swapped!.startsWith(`${FONT_STACK}, `)).toBe(false);
  });
});
