# JetBrains Mono — vendored source + licence

Third-party font, kept in its own directory **with its own licence** so the
project's licensing can't appear to absorb it (OFL 1.1 clause 5: the font stays
under the OFL and must not be redistributed under another licence).

## What's here

| File | Role |
|---|---|
| `JetBrainsMono-Regular.ttf` | Upstream source, vendored so the build is hermetic (no network at build time) |
| `jetbrains-mono-subset-400.woff2` | **Generated** — what actually ships. Rebuild with `npm run gen:font` |
| `OFL.txt` | Upstream licence, verbatim |
| `AUTHORS.txt` | Upstream authors, verbatim |

## Provenance

- Upstream: <https://github.com/JetBrains/JetBrainsMono>, release **v2.304**
  (`JetBrainsMono-2.304.zip`, sha256
  `6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf`).
- `OFL.txt` and `AUTHORS.txt` are copied unmodified from that release.

## Why we self-host instead of using `@fontsource`

We previously loaded `@fontsource/jetbrains-mono/latin-400.css`. Fontsource
publishes only `latin`, `latin-ext`, `greek`, `cyrillic(-ext)` and `vietnamese`
subsets for this family, and **box-drawing and block-elements are in none of
them**. So `╥` (U+2565) and `▄` (U+2584) — every wall, half-cover and rubble
entity in the game — were rendering from whatever font the operating system
substituted. Measured at §79f: 45 of the 47 atlas glyphs came from JetBrains
Mono; those two did not.

That is a correctness bug rather than a cosmetic one. §79d2's glyph stand-line
rule branches on an exact `ink.y0 === 0`, measured from the rasterized cell, so
a fallback font whose block glyph leaves one transparent pixel row at the cell
bottom flips those entities from "flush on the tile" to "standing on the text
baseline" — a regression that reproduces only on someone else's machine.

The upstream font carries both codepoints (box-drawing 128/128 and block
elements 32/32 complete, verified at build time), so subsetting it ourselves
makes the render deterministic everywhere.

## Regenerating

```bash
npm run gen:font
```

Rewrites the `.woff2` **and** `src/fonts.css`. The generator fails loudly if the
source font is missing any glyph the live unit catalog declares, so a future
font upgrade that drops one is caught at build rather than reaching a player as
a silent fallback. `FontAtlas`'s DEV boot assert is the second net.

To add a weight or style, add an entry to `FACES` in
[`scripts/build-font.mjs`](../../../scripts/build-font.mjs) and re-run — the
`@font-face` CSS is generated from that list. (§79f decided *not* to build the
font/style axis yet; this only keeps it a drop-in.)

## Licence obligations — don't quietly break these

SIL Open Font License 1.1. The load-bearing points for a distributed game:

1. **The font may never be sold on its own.** Bundled inside the game is fine.
2. **Every distributed copy must carry the copyright notice and the licence.**
   This is why [`public/THIRD-PARTY-LICENSES.txt`](../../../public/THIRD-PARTY-LICENSES.txt)
   exists — `public/` is copied verbatim into `dist/`, so the notice travels
   with the build. **A licence file that lives only in this repo satisfies
   nothing**, since players receive `dist/`, not the repository.
3. **No Reserved Font Name is declared** for JetBrains Mono (the OFL defines an
   RFN as names specified *after* the copyright statement, and its copyright
   line names none), so this subset — a "Modified Version", because the OFL
   counts format changes as modification — may keep the family name
   `JetBrains Mono`. If a future upstream release adds an RFN, the subset must
   be renamed and `FONT_FAMILY` in `src/render/FontAtlas.ts` with it.
4. **Don't use JetBrains' or the authors' names to promote the game.**
   Attribution belongs in credits, not in store or marketing copy.
5. **The font stays OFL** and cannot be relicensed under the project's terms.

Failing any of these voids the licence outright (the OFL's TERMINATION clause),
so treat the `dist/` notice as a release blocker rather than a nicety.
