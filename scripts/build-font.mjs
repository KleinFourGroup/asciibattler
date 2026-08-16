/**
 * §79g — build the vendored JetBrains Mono web subset(s) + the @font-face CSS.
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
 * MULTI-FACE BY DESIGN. `FACES` is a list with one entry today. §79f decided
 * NOT to build the font/style axis (its trigger hasn't fired — see WORKLOG
 * §79f), but the pipeline is shaped so a second face is a data edit plus a
 * re-run, never a re-architecture. Add an entry, run `npm run gen:font`.
 *
 * OFL 1.1. JetBrains Mono declares NO Reserved Font Name, so a subset — which
 * IS a "Modified Version" (the OFL's definition names format changes
 * explicitly) — may keep the family name. Clause 2 requires the copyright
 * notice + licence to travel with EVERY distributed copy, which is why
 * `public/THIRD-PARTY-LICENSES.txt` exists and lands in `dist/`; a repo-root
 * licence file never reaches a player. See assets/fonts/jetbrains-mono/README.md.
 *
 * Usage: `npm run gen:font` (regenerate after changing FACES or SUBSET_RANGES).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import subsetFont from 'subset-font';
// §79-post — this script runs under tsx (see package.json gen:font), so it can
// import the REAL registered glyph set + the shared range/cmap modules instead
// of mirroring them: the renderer, this generator, and the guard test
// (tests/font-coverage.test.ts) now consume one source of truth each way.
import { GLYPHS } from '../src/render/glyphs.ts';
import { SUBSET_RANGES } from '../src/render/fontSubset.ts';
import { ttfCmapLookup } from '../tools/font/ttfCmap.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = join(ROOT, 'assets', 'fonts', 'jetbrains-mono');
const CSS_OUT = join(ROOT, 'src', 'fonts.css');

/** The faces we ship. ONE today — see "MULTI-FACE BY DESIGN" above. */
const FACES = [
  {
    source: 'JetBrainsMono-Regular.ttf',
    out: 'jetbrains-mono-subset-400.woff2',
    weight: 400,
    style: 'normal',
  },
];

// What to keep: SUBSET_RANGES (src/render/fontSubset.ts — moved there at
// §79-post so the guard test shares it; deliberate-headroom rationale in its
// docblock). Whatever the source lacks is simply not kept; the guard test +
// the FontAtlas boot assert catch a glyph that isn't really there.
const subsetText = SUBSET_RANGES.flatMap(([lo, hi]) => {
  const out = [];
  for (let cp = lo; cp <= hi; cp++) out.push(String.fromCodePoint(cp));
  return out;
}).join('');

// The glyphs the renderer will actually ask the atlas for — the LITERAL
// registered set (static non-unit glyphs + the catalog-derived unit glyphs),
// imported from the renderer's own module now that tsx runs this script. The
// §79g mirrored-list duplication is gone.
const required = [...GLYPHS];
let cssBlocks = '';

for (const face of FACES) {
  const srcPath = join(FONT_DIR, face.source);
  const src = readFileSync(srcPath);
  const has = ttfCmapLookup(src);

  // Fail the BUILD, loudly, if the source can't supply a live glyph — a font
  // upgrade that drops one must not reach a player as a silent OS fallback.
  const missing = required.filter((ch) => !has(ch.codePointAt(0)));
  if (missing.length > 0) {
    throw new Error(
      `build-font: ${face.source} is missing ${missing.length} glyph(s) the catalog needs: ` +
        `${missing.map((c) => `${c} (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}`,
    );
  }
  const uncovered = required.filter((ch) => !subsetText.includes(ch));
  if (uncovered.length > 0) {
    throw new Error(
      `build-font: SUBSET_RANGES excludes ${uncovered.length} live glyph(s): ${uncovered.join(' ')} — widen the ranges (src/render/fontSubset.ts).`,
    );
  }

  const kept = [...subsetText].filter((ch) => has(ch.codePointAt(0)));
  const woff2 = await subsetFont(src, subsetText, { targetFormat: 'woff2' });
  writeFileSync(join(FONT_DIR, face.out), woff2);

  const url = relative(dirname(CSS_OUT), join(FONT_DIR, face.out)).replace(/\\/g, '/');
  cssBlocks +=
    `\n@font-face {\n` +
    `  font-family: 'JetBrains Mono';\n` +
    `  font-style: ${face.style};\n` +
    `  font-weight: ${face.weight};\n` +
    `  font-display: block;\n` +
    `  src: url('${url}') format('woff2');\n` +
    `}\n`;

  console.log(
    `${face.source} -> ${face.out}  ${(src.length / 1024).toFixed(0)}KB -> ` +
      `${(woff2.length / 1024).toFixed(1)}KB  (${kept.length} glyphs kept of ${[...subsetText].length} requested; ` +
      `all ${required.length} live glyphs present)`,
  );
}

writeFileSync(
  CSS_OUT,
  `/* GENERATED by scripts/build-font.mjs (npm run gen:font) — do not edit by hand.\n` +
    ` *\n` +
    ` * Self-hosted JetBrains Mono subset. Replaces the @fontsource latin-400\n` +
    ` * import, whose subsets omit box-drawing/block-elements and left \`╥\`/\`▄\`\n` +
    ` * rendering from an unspecified OS fallback (§79f finding, §79g fix).\n` +
    ` *\n` +
    ` * font-display: block, NOT swap — FontAtlas rasterizes the glyph cells once\n` +
    ` * at boot, so a swap-in after the atlas is built would leave the whole game\n` +
    ` * showing fallback shapes for the rest of the session. FontAtlas also awaits\n` +
    ` * document.fonts.load() before rasterizing; this is the second belt.\n` +
    ` *\n` +
    ` * Licence: SIL OFL 1.1 — see assets/fonts/jetbrains-mono/OFL.txt, shipped to\n` +
    ` * players via public/THIRD-PARTY-LICENSES.txt (OFL clause 2).\n` +
    ` */\n` +
    cssBlocks,
);
console.log(`wrote ${relative(ROOT, CSS_OUT).replace(/\\/g, '/')}`);
