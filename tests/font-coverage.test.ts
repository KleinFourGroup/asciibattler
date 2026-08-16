import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLYPHS } from '../src/render/glyphs';
import { subsetCovers } from '../src/render/fontSubset';
import { ttfCmapLookup } from '../tools/font/ttfCmap';

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
//      subset would drop it even though the source font has it.
//   2. The vendored source TTF actually maps every registered glyph — the
//      ranges deliberately include PARTIAL upstream blocks (arrows, geometric
//      shapes), so "in range" alone doesn't prove the font can supply it.
//
// Residual gap, accepted: a stale committed woff2 (ranges widened or the TTF
// upgraded without re-running gen:font) is caught only by the DEV boot assert
// — reading the woff2's cmap here would mean a brotli dependency for a case
// that requires deliberately touching the font pipeline while skipping its
// one documented command.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_TTF = join(repoRoot, 'assets', 'fonts', 'jetbrains-mono', 'JetBrainsMono-Regular.ttf');

const codepointsOf = (glyph: string): number[] => [...glyph].map((ch) => ch.codePointAt(0)!);

describe('font subset coverage (§79-post)', () => {
  it('every registered glyph falls inside the kept SUBSET_RANGES', () => {
    const outsideRanges = GLYPHS.filter((g) => !codepointsOf(g).every(subsetCovers));
    expect(outsideRanges, 'widen SUBSET_RANGES (src/render/fontSubset.ts) + `npm run gen:font`').toEqual([]);
  });

  it('the vendored source TTF supplies every registered glyph', () => {
    const has = ttfCmapLookup(readFileSync(SOURCE_TTF));
    const missingFromFont = GLYPHS.filter((g) => !codepointsOf(g).every(has));
    expect(missingFromFont, 'the source font cannot supply these — pick different glyphs or a font that has them').toEqual([]);
  });
});
