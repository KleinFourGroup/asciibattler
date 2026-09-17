# DejaVu Sans Mono — vendored source + licence

Third-party font, kept in its own directory **with its own licence** so the
project's licensing can't appear to absorb it. This is the ONE shipped
fallback face (§101a, user-signed 2026-09-17): JetBrains Mono stays the
primary, and this face's subset keeps only what the primary lacks, so no glyph
the UI or the atlas draws ever comes from an unspecified OS face.

## What's here

| File | Role |
|---|---|
| `DejaVuSansMono.ttf` | Upstream source, vendored so the build is hermetic (no network at build time) |
| `dejavu-sans-mono-subset-400.woff2` | **Generated** — what actually ships. Rebuild with `npm run gen:font` |
| `LICENSE.txt` | Upstream licence, verbatim (the release's `LICENSE`) |
| `AUTHORS.txt` | Upstream authors, verbatim (the release's `AUTHORS`) |

## Provenance

- Upstream: <https://github.com/dejavu-fonts/dejavu-fonts>, release **2.37**
  (`dejavu-fonts-ttf-2.37.zip`, sha256
  `7576310b219e04159d35ff61dd4a4ec4cdba4f35c00e002a136f00e96a908b0a`;
  the TTF inside it sha256
  `b4a6c3e4faab8773f4ff761d56451646409f29abedd68f05d38c2df667d3c582`).
- `LICENSE.txt` and `AUTHORS.txt` are copied unmodified from that release.

## Why this face

The DOM UI had come to carry 20 codepoints outside the shipped JetBrains Mono
subset, six absent from the TTF itself (`▤ ★ ☆ ☠ ⏸ ⌖`); each painted from
whatever the player's OS substituted, and a fallback face's taller ascent
grows the line it sits on (the 46 / 45 px chrome chip that opened §101).
Three candidates were probed against their own cmap + vertical metrics:

| Face | Covered of the 20 | Ascent / descent (JetBrains: 1.02 / 0.30) | Advance |
|---|---|---|---|
| **DejaVu Sans Mono 2.37** | 18 | 0.93 / 0.24 — fits INSIDE the line | 0.602 (JetBrains 0.600) |
| Unifont 18.0.01 | 20 | 0.88 / 0.13 | 1.00, a 16 px bitmap grid |
| Noto Sans Symbols 2 v2.008 | 15 | 1.07 / 0.63 — 29 % taller | 0.80, proportional |

DejaVu fits the line (a fallback glyph can never grow a box), keeps the cell
(a `★` in a chip occupies a letter's advance), and its licence asks for
nothing the project doesn't already do. The two it lacks were re-chosen from
glyphs it has (`⏸` → `❚❚`, `⌖` → `◎`).

## Regenerating

```bash
npm run gen:font
```

Rewrites every face's `.woff2` **and** `src/fonts.css`. The generator keeps,
for this face, only the codepoints inside `SUBSET_RANGES`
([`src/render/fontSubset.ts`](../../../src/render/fontSubset.ts)) that the
primary face lacks. `tests/font-coverage.test.ts` fails `npm test` when any
DOM string carries a codepoint no shipped face supplies.

## Licence obligations — don't quietly break these

The Bitstream Vera Fonts licence (permissive), plus DejaVu's own changes in
the public domain, plus a few glyphs imported from the Arev fonts under
identical terms (the `LICENSE.txt` carries all three). The load-bearing
points for a distributed game:

1. **The copyright, trademark and permission notices travel with every
   copy.** This is why [`public/THIRD-PARTY-LICENSES.txt`](../../../public/THIRD-PARTY-LICENSES.txt)
   carries the licence verbatim — `public/` is copied into `dist/`, so the
   notice reaches the player. A licence file that lives only in this repo
   satisfies nothing.
2. **The font may never be sold on its own.** Bundled inside the game is fine.
3. **A modified font must not carry the names "Bitstream", "Vera", "Arev" or
   "Tavmjong Bah".** A subset is a modification; `DejaVu Sans Mono` contains
   none of those words, so the subset keeps its family name. Never rename it
   to anything that does.
4. **Don't use Bitstream's, Gnome's or Tavmjong Bah's names to promote the
   game** without their written authorization. Attribution belongs in credits.
