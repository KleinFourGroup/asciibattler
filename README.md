# ASCIIbattler

A browser-based, tick-based autobattler with a Slay-the-Spire-style run structure: two teams of ASCII-glyph units fight fully deterministic battles on a square grid, wrapped in a procedurally generated node map you draft your team through between fights. The look is "CRT-diorama" — terminal palette and monospace glyphs rendered as billboarded quads in 3D, with saturation-clamped selective bloom and scanlines.

Built in TypeScript (strict mode) with three.js for rendering, Vite as the build/dev server, and Vitest for tests — no UI framework, the HUD is plain HTML/CSS layered over the canvas.

## Running it

```bash
npm install
npm run dev      # serves at http://localhost:5173
```

## Docs

- **AI coding agents:** start at **[AGENTS.md](AGENTS.md)** — it orients you cold and points to everything else.
- **Humans:** [HANDOFF.md](HANDOFF.md) for where the project stands, [DESIGN.md](DESIGN.md) for what we're building and why, and [ARCHITECTURE.md](ARCHITECTURE.md) for how the code is organized.
