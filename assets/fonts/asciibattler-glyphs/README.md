# ASCIIbattler Glyphs — our drawn face, its sources and licence

The game's own face: drawn glyphs at Private Use Area code points (U+E000
to U+F8FF), which Unicode assigns to no character, so a glyph there means
only what we draw. It sits third in the font stack, after JetBrains Mono and
DejaVu Sans Mono, and maps no code point either of them has, so it changes
no glyph they draw.

A glyph is JetBrains Mono's own letter with **radicals** added to it, marks
that name a family (the beasts' ears), or radicals alone for a glyph with no
letter. The letter is copied from the vendored
[`../jetbrains-mono/JetBrainsMono-Regular.ttf`](../jetbrains-mono/README.md)
and centred in the glyph's width.

## What's here

| File | Role |
|---|---|
| `glyphs.json` | The composition table: one row per glyph, its `codePoint` (`U+E000`), `name`, `letter`, `radicals` and `width` (the advance in font units; JetBrains Mono's is 600) |
| `radicals/<name>.svg` | One radical each, drawn in place in the glyph box |
| `template.svg` | The glyph box at a 900 width, with its guides: copy it to start a radical |
| `asciibattler-glyphs-400.woff2` | **Generated**: what ships. Rebuild with `npm run gen:font` |
| `OFL.txt` | The licence, with JetBrains Mono's copyright line and ours |

## Drawing a radical

The box is the SVG's viewBox, `0 0 <width> 1320`: the glyph's width across,
JetBrains Mono's line down, with the baseline 1020 from the top. One unit is
one font unit. The guides in `<g id="guide">` (the box, the letter's slot,
the ascender at 730, the x-height at 550, the baseline, the descender at
−180) are ignored by the build. The reader,
[`tools/font/radicalSvg.ts`](../../../tools/font/radicalSvg.ts), takes
`<path>` and `<polygon>` in straight segments only and refuses a curve, a
stroke, `fill="none"`, an even-odd fill, a transform, crossing contours and
ink outside the box, each by name. Contours may nest: one inside another is a
hole.

A radical is drawn for one width, and a glyph that carries it must have that
width. See each radical and each composed glyph at
`/tools/glyph-sheet/` on the dev server, and on the board with the glyph
sampler (`?bp=board-open15_pose-sampler&glyphs=r,U+E000,R`).

## Regenerating

```bash
npm run gen:font
```

Composes the face from `glyphs.json`, `radicals/` and JetBrains Mono's
letters ([`tools/font/glyphFace.ts`](../../../tools/font/glyphFace.ts)),
writes the woff2, and rewrites `src/fonts.css`. A rebuild from the same
sources is byte-identical. `tests/glyph-face.test.ts` rebuilds the face and
fails while the committed woff2 differs from it, so a source edited without
a regeneration fails `npm test`; `tests/font-coverage.test.ts` reads the
woff2's own character map for the coverage guard.

## Licence

The face copies JetBrains Mono's outlines, so it is a Modified Version of
JetBrains Mono under the SIL Open Font License 1.1 and is distributed under
that licence only. JetBrains Mono declares no Reserved Font Name; the face
carries a family name of its own all the same. The obligations in
[`../jetbrains-mono/README.md`](../jetbrains-mono/README.md) apply to it
whole: the copyright lines and the licence travel with every copy, through
[`public/THIRD-PARTY-LICENSES.txt`](../../../public/THIRD-PARTY-LICENSES.txt),
and the face is never sold on its own. The same lines are in the font's name
table.
