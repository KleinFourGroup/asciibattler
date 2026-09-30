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

## Probing in a hidden window

`npm run probe -- shell/electron/probes/drive-run.js --seed=7` runs a page
script against the working tree's development build in an Electron window
that is never shown, and prints one JSON line: here, a whole run played to
its end by the probe kit's driver. `--board=<id>` opens a board-explorer
fixture and `--query=<query>` any URL. The exit code is 0 when the script's
checks pass, 1 when one fails or the page throws, and 2 on the time limit.
It is a development tool (`shell/electron/probe-cli.mjs` lists its
options); the probe kit it calls is `window.__probe`
([process/browser-pane.md](process/browser-pane.md)).

## Docs

- **AI coding agents:** start at **[AGENTS.md](AGENTS.md)** — it orients you cold and points to everything else.
- **Humans:** [HANDOFF.md](HANDOFF.md) for where the project stands, [DESIGN.md](DESIGN.md) for what we're building and why, and [ARCHITECTURE.md](ARCHITECTURE.md) for how the code is organized.
