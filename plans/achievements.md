# Plan — Achievements

A **§80 feasibility-audit doc**: audit + dependency confirmation
only, ZERO implementation — and deliberately **no content design**
(the kickoff resolution: "confirm the dependency, design nothing
yet"). Audited 2026-08-16 at `f776f05`.

## The blocking dependency, confirmed

**Achievements are blocked on a persistent cross-run store that
does not exist.** The only persistence anywhere in `src/` is the
DEV-only battle-trace ring ([traceStore.ts](../src/dev/traceStore.ts),
localStorage, dev tooling — not a pattern to grow product features
on). META-ROADMAP already names persistence/save-load as Cluster
6's hidden prerequisite; achievements are a second consumer of
that same store, alongside save/load, meta unlocks, and settings
(volume — see [plans/music.md](music.md) — and tutorial seen-flags
— see [plans/tutorial.md](tutorial.md)). **The store is designed
once, in C6, with all four consumers known.** Nothing here builds
before it.

## What already exists (the feasibility half)

- **Detection is cheap and proven.** The event bus carries
  everything an achievement checker needs (`unit:died`,
  `run:victory`, `sector:cleared`, `deck:*`, `run:bitsChanged`,
  `event:entered`, …45 event kinds), and the
  bus-subscriber-that-never-emits pattern has two in-tree proofs:
  [TelemetryAccumulator](../tests/fuzz/telemetry.ts) (fuzz
  instrument) and [TraceRecorder](../src/dev/TraceRecorder.ts). An
  achievement engine is a third such subscriber: reads events,
  accumulates counters, writes the store, emits nothing.
- **Run-scoped counters already exist** where detection needs
  memory within a run (`eventsVisited` §74e is the precedent);
  cross-RUN aggregation ("win 10 runs") is exactly the part that
  waits for the store.
- **The sim/meta seam is clean**: an achievement subscriber lives
  outside the sim and cannot perturb determinism — same law as the
  renderer.

## Shape sketch (held to one paragraph, per the scope guard)

A def table (id · name · a typed predicate/counter spec — kin to
the EVENT_SOUNDS/EMPOWER_DISPLAY table idiom, coverage-pinnable) +
one page-lifetime bus subscriber + the C6 store. Unlock *rewards*
(if any — cosmetic vs the C4 starting-character gates) are a C6
meta-progression design question, not this doc's.

## What Cluster 6 must not break

- **The store schema must be versioned from day one** — the
  snapshot-discipline convention (versioned, reject-stale) applied
  to the persistent store. Four consumers will grow independently;
  an unversioned blob is the C6 equivalent of the pre-#125 RNG
  states.
- **Detection reads the bus, never sim internals.** If an
  achievement needs a fact the bus doesn't carry, the fix is a new
  event (catalogued in ARCHITECTURE, dispositioned in the
  sound-registry coverage pin) — never a reach into `World`/`Run`.
- **Achievements never feed back into a run in flight.** Cross-run
  unlocks gating starting characters/archetypes (META-ROADMAP's C6
  charter) resolve at RUN CREATION, where they're part of the
  seeded setup — mid-run "achievement popped, unit buffed" would
  break determinism and replay-shareability.
- **Fuzz/headless runs must not write the store** — the harness
  drives thousands of runs; the store is a browser-layer concern
  (Game wiring), not a Run/World concern, or every fuzz batch
  pollutes real progress.
