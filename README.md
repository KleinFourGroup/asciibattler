# ASCIIbattler

A browser-based, tick-based autobattler with a Slay-the-Spire-style run structure: two teams of ASCII-glyph units fight fully deterministic battles on a square grid, wrapped in a procedurally generated node map you draft your team through between fights. The look is "CRT-diorama" — terminal palette and monospace glyphs rendered as billboarded quads in 3D, with saturation-clamped selective bloom and scanlines.

Built in TypeScript (strict mode) with three.js for rendering, Vite as the build/dev server, and Vitest for tests — no UI framework, the HUD is plain HTML/CSS layered over the canvas.

## Running it

```bash
npm install
npm run dev      # serves at http://localhost:5173
```

## Recording clips

`npm run record -- --board=corridors` (a board-explorer fixture) or
`npm run record -- --seed=12` records a battle to `clips/` as an `.mp4`,
from an offscreen window that never takes focus and plays nothing aloud.
Add `--before=<commit>` for a before/after pair: that commit against the
working tree (or `--after=<commit>`), side by side. A clip opens on the
pre-battle countdown and plays through into the fight; `--countdown=skip`
opens on the fight's first frame instead, for clips joined together. It
ends on the battle's last frame before the next screen.
It is a development tool (`shell/electron/record-cli.mjs` lists its
options) with one external requirement: **ffmpeg** on the PATH, built with
NVENC, and an NVIDIA GPU to run it. On Windows, `winget install
Gyan.FFmpeg` provides both ffmpeg and ffprobe; open a new terminal
afterwards. The recorder checks for them at start and says what is
missing.

## Docs

- **AI coding agents:** start at **[AGENTS.md](AGENTS.md)** — it orients you cold and points to everything else.
- **Humans:** [HANDOFF.md](HANDOFF.md) for where the project stands, [DESIGN.md](DESIGN.md) for what we're building and why, and [ARCHITECTURE.md](ARCHITECTURE.md) for how the code is organized.
