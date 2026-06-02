# run-config (dev tool)

A tiny CLI for **short / specific runs** during playtest and balance work. It
builds a `RunConfig`, prints a browser launch URL describing that run, and
(unless `--no-run`) drives the run headlessly to completion for a quick sanity
pass.

```bash
# Print a launch URL AND drive a headless run:
npm run run-config -- --floors=2 --seed=42 --roster=rogue:3,healer:2 --layout=endlessCorridors

# Just the launch URL (paste into the browser after `npm run dev`):
npm run run-config -- --floors=1 --no-run

# Pick the headless drive strategy (default pure-random):
npm run run-config -- --seed=42 --strategy=greedy
```

Flags: `--seed`, `--floors`, `--roster` (`archetype[:level],…`), `--layout`,
`--width`, `--strategy` (any G5-menu entry — `pure-random` | `greedy` |
`recruit:<archetype>` | `stat:<stat>` | `path:battle` | `path:rest`),
`--no-run`, `--help`. The strategy menu is the shared registry in
`tests/fuzz/strategies/registry.ts`.

The run-config flags reuse the **same param names and validation** as the
browser URL (`src/run/RunConfig.ts`), so a CLI invocation and a browser launch
URL describe the same run — one source of truth. A pinned `--seed` reproduces
the exact run on every invocation; without it, a fresh `Date.now()` seed is
used (and printed in the URL so you can reproduce it).

Not part of the production build — `vite build` only bundles the game entry.
The `tools/` tree is run via `tsx` (or served as static files for the
browser-based tools) and never lands in `dist/`.
