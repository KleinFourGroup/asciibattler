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
 * branches on an exact `ink.y0 === 0` measured off the rasterized cell, so a
 * fallback with one transparent pixel row at the cell bottom flips those
 * entities from "flush on the tile" to "on the text baseline" — a regression
 * reproducible only on someone else's machine. Subsetting the UPSTREAM font
 * (which does carry both, verified below) makes the render deterministic.
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

/**
 * What to keep. Deliberate HEADROOM (user-signed at the 79g shape-lock): the
 * atlas needs 47 glyphs today, but regenerating on every new glyph is exactly
 * the chore that gets forgotten until it breaks a boss. Upstream coverage
 * measured at 79g: ASCII 95/95, Latin-1 96/96, box-drawing 128/128, blocks
 * 32/32 — all COMPLETE; geometric shapes 43/96 and arrows 35/112 are PARTIAL,
 * so don't assume an arbitrary shape exists there. Whatever the source lacks is
 * simply not kept, and the boot assert in FontAtlas is what catches a glyph
 * that isn't really there.
 */
const SUBSET_RANGES = [
  [0x0020, 0x007e, 'ASCII printable'],
  [0x00a0, 0x00ff, 'Latin-1 supplement'],
  [0x2190, 0x21ff, 'Arrows (partial upstream)'],
  [0x2500, 0x257f, 'Box drawing'],
  [0x2580, 0x259f, 'Block elements'],
  [0x25a0, 0x25ff, 'Geometric shapes (partial upstream)'],
];

// ---------------------------------------------------------------------------
// Minimal TTF cmap reader (formats 4 and 12), so the build can PROVE the source
// carries every glyph the live catalog asks for instead of discovering it at
// runtime. No dependency worth taking for ~50 lines.
// ---------------------------------------------------------------------------
function cmapLookup(buf) {
  const numTables = buf.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('latin1', rec, rec + 4) === 'cmap') cmap = buf.readUInt32BE(rec + 8);
  }
  if (cmap < 0) throw new Error('build-font: source font has no cmap table');

  let best = -1;
  let bestScore = -1;
  const n = buf.readUInt16BE(cmap + 2);
  for (let i = 0; i < n; i++) {
    const rec = cmap + 4 + i * 8;
    const plat = buf.readUInt16BE(rec);
    const enc = buf.readUInt16BE(rec + 2);
    const score = plat === 3 && enc === 10 ? 3 : plat === 3 && enc === 1 ? 2 : plat === 0 ? 1 : 0;
    if (score > bestScore) {
      bestScore = score;
      best = cmap + buf.readUInt32BE(rec + 4);
    }
  }
  const format = buf.readUInt16BE(best);

  return (cp) => {
    if (format === 12) {
      const groups = buf.readUInt32BE(best + 12);
      for (let i = 0; i < groups; i++) {
        const g = best + 16 + i * 12;
        if (cp >= buf.readUInt32BE(g) && cp <= buf.readUInt32BE(g + 4)) return true;
      }
      return false;
    }
    if (cp > 0xffff) return false;
    const segX2 = buf.readUInt16BE(best + 6);
    const ends = best + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (let s = 0; s < segX2; s += 2) {
      if (buf.readUInt16BE(ends + s) < cp) continue;
      if (buf.readUInt16BE(starts + s) > cp) return false;
      const ro = buf.readUInt16BE(ranges + s);
      if (ro === 0) return ((cp + buf.readInt16BE(deltas + s)) & 0xffff) !== 0;
      const gi = buf.readUInt16BE(ranges + s + ro + (cp - buf.readUInt16BE(starts + s)) * 2);
      return gi !== 0;
    }
    return false;
  };
}

/**
 * The glyphs the renderer will actually ask the atlas for, read from the SAME
 * sources `src/render/glyphs.ts` derives them from — the static non-unit list
 * mirrored here, plus every glyph the unit catalog declares. Mirroring the
 * non-unit list is a small duplication, accepted because this script must run
 * outside the TS build; the boot assert is the backstop that catches drift.
 */
function requiredGlyphs() {
  const NON_UNIT = [...'@0123456789.:/-+%!?*X'];
  const units = JSON.parse(readFileSync(join(ROOT, 'config', 'units.json'), 'utf8'));
  const fromCatalog = Object.values(units).map((d) => d.glyph);
  return [...new Set([...NON_UNIT, ...fromCatalog])];
}

const subsetText = SUBSET_RANGES.flatMap(([lo, hi]) => {
  const out = [];
  for (let cp = lo; cp <= hi; cp++) out.push(String.fromCodePoint(cp));
  return out;
}).join('');

const required = requiredGlyphs();
let cssBlocks = '';

for (const face of FACES) {
  const srcPath = join(FONT_DIR, face.source);
  const src = readFileSync(srcPath);
  const has = cmapLookup(src);

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
      `build-font: SUBSET_RANGES excludes ${uncovered.length} live glyph(s): ${uncovered.join(' ')} — widen the ranges.`,
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
