# TESTING.md

How we keep the simulation honest. Companion to `DESIGN.md`, `ARCHITECTURE.md`, and `ROADMAP.md`.

## What gets tested

- **`src/core`** — `RNG`, `EventBus`, `Clock`. Pure logic, trivial to assert against.
- **`src/sim`** — `World`, `Unit`, `Pathfinding`, `Targeting`, `archetypes`, behaviors. The whole point of the determinism contract.
- **`src/run`** — `NodeMap`, `Recruitment`, `Run`. Generation is seeded, so the same seed must produce the same map / offers.

## What does NOT get tested here

- **`src/render`** — three.js, shaders, DOM. Visual verification by eyeball. Trying to unit-test render code with jsdom is a tax we choose not to pay for an MVP.
- **`src/ui`** — DOM screens. Same reasoning.

If the renderer ever grows pure-logic helpers (e.g. atlas UV computation), those can live in a tested utility module.

## Tools

- **Vitest 4** — shares the Vite config, so module resolution Just Works.
- Run all tests once: `npm test` (316 passed, 0 todo as of D8).
- Watch mode: `npm run test:watch`
- Imports are explicit (`import { describe, it, expect } from 'vitest'`) — no globals.
- **Fuzz smoke:** `npm run fuzz:smoke` — opt-in vitest run on the headless
  balance harness (A3). Uses [vitest.fuzz.config.ts](vitest.fuzz.config.ts);
  the default `npm test` excludes `tests/fuzz/**` to keep pre-commit fast.
- **Fuzz CLI:** `npm run fuzz -- --count=N` runs N seeds × all strategies,
  emits CSV + per-failure markdown traces under `tests/fuzz/output/`.

## File conventions

- **Unit tests:** co-located next to source as `*.test.ts`. Example: `src/core/RNG.test.ts`.
- **Integration tests:** under `tests/integration/`. These cross module boundaries.
  Current inventory:
  - `determinism.test.ts` — the replay contract backstop (see below).
  - `snapshot-roundtrip.test.ts` — World/Run JSON round-trip (A2).
  - `variable-size.test.ts` — procedural battles at multiple board sizes (D3).
  - `layout-deadlock.test.ts` — each registered layout resolves within 2000 ticks
    (regression pin for the C1d Labyrinth fix).
  - `spawn-overflow.test.ts` — D5.C overflow queue + SpawnAction + WorldSnapshot v4.
- **Toolchain smoke / cross-module fixtures:** under `tests/`.

## The determinism contract

This is the single most load-bearing invariant in the project, called out in `DESIGN.md` and pinned by `ARCHITECTURE.md` principle #2. The replay test in `tests/integration/determinism.test.ts` is the runtime backstop for it.

Concretely, the contract says:

1. **Seed in → state out, deterministically.** Given the same RNG seed and the same initial `World` configuration, calling `world.tick()` N times must produce byte-identical final state and an identical event sequence.
2. **Forked streams are independent.** `rng.fork()` produces a new stream that's deterministic in its own right and does not consume from the parent stream.
3. **No hidden randomness.** No `Math.random()`, no `Date.now()` as entropy, no iteration-order-as-randomness. ESLint catches direct `Math.random()` in `src/sim` and `src/run`; the replay test catches everything else.

The snapshot-roundtrip test extends the contract across serialization: a `World` deserialized from `toJSON()` must produce an identical event trace from that point forward.

## Adding a test

For pure-logic modules: co-locate `Module.test.ts` next to `Module.ts`. Keep tests narrow and named for the behavior, not the function: `it('returns empty array when no path exists', ...)` over `it('findPath case 4', ...)`.

For anything that consumes randomness: take a seeded `RNG` instance as an explicit argument; never reach for global entropy. The tests prove this is doable; lint enforces it.
