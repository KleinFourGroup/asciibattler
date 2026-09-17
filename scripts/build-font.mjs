/**
 * §79g / §101a — build the vendored web font subsets + the @font-face CSS.
 *
 * WHY THIS EXISTS. We used to load `@fontsource/jetbrains-mono/latin-400.css`.
 * Fontsource publishes only latin / latin-ext / greek / cyrillic(-ext) /
 * vietnamese for this family, and box-drawing + block-elements are in NONE of
 * them — so `╥` (U+2565) and `▄` (U+2584), i.e. every wall, half-cover and
 * rubble entity, silently rendered from whatever the OS substituted (measured
 * at §79f: 45 of 47 atlas glyphs came from JetBrains Mono, those two did not).
 * That is a correctness bug, not a cosmetic one: §79d2's stand-line rule
 * branches on the measured ink bottom of the rasterized cell, so a fallback
 * font's different letterform geometry silently moves those entities' stand
 * line — a regression reproducible only on someone else's machine. Subsetting
 * the UPSTREAM font (which does carry both, verified below) pins the font's
 * PROVENANCE. It does not pin rasterization — per-platform canvas rasterizers
 * can still shift a measured ink edge by a pixel row at the alpha threshold
 * (§79g measured exactly that between two builds of the same face); the
 * `INK_FLOOR_EPSILON` tolerance in glyphs.ts (§79-post) absorbs that class.
 *
 * TWO FACES (§101a). The §79f multi-face trigger fired: the DOM UI had come
 * to carry 20 codepoints outside JetBrains Mono's coverage (six absent from
 * the TTF itself), each painting from an unknown OS face whose taller ascent
 * grew the line it sat on — the §101 layout class. `FACES` (now in
 * src/render/fontSubset.ts, shared with the guard test and the renderer) lists
 * a PRIMARY that supplies everything it has and ONE FALLBACK whose subset
 * keeps only what the primary lacks inside SUBSET_RANGES. The gates are UNION
 * gates: a live glyph must be in SOME shipped face. Adding a third face is
 * still a data edit plus a re-run.
 *
 * LICENCES. JetBrains Mono: OFL 1.1, no Reserved Font Name, so a subset —
 * which IS a "Modified Version" (the OFL's definition names format changes
 * explicitly) — may keep the family name. DejaVu Sans Mono: the Bitstream
 * Vera licence (+ DejaVu's public-domain changes + the Arev terms), which
 * requires the notice to travel and forbids a MODIFIED font carrying the
 * names Bitstream / Vera / Arev / Tavmjong Bah — "DejaVu Sans Mono" contains
 * none, so the subset keeps its name. Both require the copyright notice +
 * licence with EVERY distributed copy, which is why
 * `public/THIRD-PARTY-LICENSES.txt` exists and lands in `dist/`; a repo-root
 * licence file never reaches a player. See each face's README under
 * assets/fonts/.
 *
 * Usage: `npm run gen:font` (regenerate after changing FACES or SUBSET_RANGES).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import subsetFont from 'subset-font';
// §79-post — this script runs under tsx (see package.json gen:font), so it can
// import the REAL registered glyph set + the shared range/face/cmap modules
// instead of mirroring them: the renderer, this generator, and the guard test
// (tests/font-coverage.test.ts) now consume one source of truth each way.
import { GLYPHS } from '../src/render/glyphs.ts';
import { SUBSET_RANGES, FACES } from '../src/render/fontSubset.ts';
import { ttfCmapLookup } from '../tools/font/ttfCmap.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS_DIR = join(ROOT, 'assets', 'fonts');
const CSS_OUT = join(ROOT, 'src', 'fonts.css');

// What to keep: SUBSET_RANGES (src/render/fontSubset.ts — moved there at
// §79-post so the guard test shares it; deliberate-headroom rationale in its
// docblock). Whatever no face has is simply not kept; the guard test + the
// FontAtlas boot assert catch a glyph that isn't really there.
const requested = SUBSET_RANGES.flatMap(([lo, hi]) => {
  const out = [];
  for (let cp = lo; cp <= hi; cp++) out.push(String.fromCodePoint(cp));
  return out;
});
const requestedText = requested.join('');

// The glyphs the renderer will actually ask the atlas for — the LITERAL
// registered set (static non-unit glyphs + the catalog-derived unit glyphs),
// imported from the renderer's own module now that tsx runs this script.
const required = [...GLYPHS];

// Every face's cmap first: the gates below are UNION gates, and the fallback's
// keep-set depends on the primary's coverage.
const loaded = FACES.map((face) => {
  const src = readFileSync(join(FONTS_DIR, face.dir, face.source));
  return { face, src, has: ttfCmapLookup(src) };
});
const primary = loaded.find((f) => f.face.role === 'primary');
if (!primary || loaded.filter((f) => f.face.role === 'primary').length !== 1) {
  throw new Error('build-font: FACES must list exactly one primary face');
}
const anyHas = (cp) => loaded.some((f) => f.has(cp));

// Fail the BUILD, loudly, if no shipped face can supply a live glyph — a font
// upgrade that drops one must not reach a player as a silent OS fallback.
const missing = required.filter((ch) => !anyHas(ch.codePointAt(0)));
if (missing.length > 0) {
  throw new Error(
    `build-font: no shipped face (${FACES.map((f) => f.family).join(', ')}) supplies ${missing.length} glyph(s) the catalog needs: ` +
      `${missing.map((c) => `${c} (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}`,
  );
}
const uncovered = required.filter((ch) => !requestedText.includes(ch));
if (uncovered.length > 0) {
  throw new Error(
    `build-font: SUBSET_RANGES excludes ${uncovered.length} live glyph(s): ${uncovered.join(' ')} — widen the ranges (src/render/fontSubset.ts).`,
  );
}

let cssBlocks = '';
for (const { face, src, has } of loaded) {
  // The primary keeps everything it has in the ranges; a fallback keeps only
  // what the primary lacks (so the two subsets never overlap and the fallback
  // stays small).
  const kept = requested.filter((ch) => {
    const cp = ch.codePointAt(0);
    return has(cp) && (face.role === 'primary' || !primary.has(cp));
  });
  const woff2 = await subsetFont(src, kept.join(''), { targetFormat: 'woff2' });
  const outPath = join(FONTS_DIR, face.dir, face.out);
  writeFileSync(outPath, woff2);

  const url = relative(dirname(CSS_OUT), outPath).replace(/\\/g, '/');
  cssBlocks +=
    `\n@font-face {\n` +
    `  font-family: '${face.family}';\n` +
    `  font-style: normal;\n` +
    `  font-weight: 400;\n` +
    `  font-display: block;\n` +
    `  src: url('${url}') format('woff2');\n` +
    `}\n`;

  console.log(
    `${face.family} (${face.role}): ${face.source} -> ${face.out}  ${(src.length / 1024).toFixed(0)}KB -> ` +
      `${(woff2.length / 1024).toFixed(1)}KB  (${kept.length} glyphs kept of ${requested.length} requested)`,
  );
}
console.log(`all ${required.length} live atlas glyphs present in a shipped face`);

writeFileSync(
  CSS_OUT,
  `/* GENERATED by scripts/build-font.mjs (npm run gen:font) — do not edit by hand.\n` +
    ` *\n` +
    ` * Self-hosted subsets of the shipped faces (src/render/fontSubset.ts FACES):\n` +
    ` * JetBrains Mono, the primary, and DejaVu Sans Mono, the one fallback, which\n` +
    ` * keeps only what the primary lacks — so no glyph the UI or the atlas draws\n` +
    ` * ever comes from an unspecified OS face (§79f/§79g on the canvas, §101a in\n` +
    ` * the DOM). Consumers name both through FONT_STACK / the sheet's --font-mono.\n` +
    ` *\n` +
    ` * font-display: block, NOT swap — FontAtlas rasterizes the glyph cells once\n` +
    ` * at boot, so a swap-in after the atlas is built would leave the whole game\n` +
    ` * showing fallback shapes for the rest of the session. FontAtlas also awaits\n` +
    ` * document.fonts.load() before rasterizing; this is the second belt.\n` +
    ` *\n` +
    ` * Licences: SIL OFL 1.1 (JetBrains Mono) and the Bitstream Vera licence\n` +
    ` * (DejaVu Sans Mono) — see each face's README under assets/fonts/, shipped\n` +
    ` * to players via public/THIRD-PARTY-LICENSES.txt.\n` +
    ` */\n` +
    cssBlocks,
);
console.log(`wrote ${relative(ROOT, CSS_OUT).replace(/\\/g, '/')}`);
