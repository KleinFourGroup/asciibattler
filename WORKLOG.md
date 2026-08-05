# WORKLOG — Cluster 5 (Map Content)

Created at the round boundary (2026-08-04); `## Phase N` sections land
as the cluster runs. The rollout-arbitration interstitial's worklog is
archived at [archive/post-68-worklog.md](archive/post-68-worklog.md).

## Kickoff (the spec session, 2026-08-05)

The planning-stack opening move: a five-surface code-reality audit of
the draft spec BEFORE the design conversation (the Cluster-3
precedent), then the fork-by-fork hardening conversation. Decisions
live in [cluster-5-spec.md](cluster-5-spec.md) §Kickoff resolutions;
this entry carries the findings + rationale.

### The audit (five parallel surveys, all findings verified at HEAD)

1. **Events/sector-gen**: the port phase (50c) is the reusable model
   for a non-battle node phase; all grant chokepoints are
   phase-agnostic but the REMOVAL side is missing (unit removal throws
   outside map/port — gotcha #118; no packet-removal-by-id; no
   unit/pool-health reward entry kinds). `'event'` widens BOTH
   `NodeKind` and `RunPhase` → RunSnapshot bump (union-widening ruled
   a shape change 3× prior: 48b/50c/67a). New phases MUST get
   harness + walker arms or every fuzz run wedges. Widening fuzz
   `PATH_KINDS` breaks the strictObject parse on every committed
   weight vector — a scheduled one-time re-baseline. "Supplies"
   exists nowhere in code — pinned to mean packets. NONE of the
   draft's map-gen complaints are measured today (no divergence /
   early-availability / path-coverage metrics; no rejection scaffold;
   no node-map visualizer — the tools index ADVERTISES one but the
   card is wired to battlefield terrain).
2. **Camps**: `Team` is already ternary; two seams were RESERVED for
   camps (`anchorFootprint`'s `random-intersect` policy — "deferred to
   camps (Cluster 5)" — and the NodeMap.ts:8 comment); leash-wander
   has the sanctioned RNG-in-behavior precedent (`proposeWander`). The
   dominant cost is ~40 neutral-is-inert sites, including a
   correctness item: movement.ts treats neutrals as immovable hard
   blockers, so a wandering neutral is a moving wall without the
   widening. No aggro/threat/kill-credit state exists anywhere;
   `recordDamage` DROPS neutral-target damage. "Doesn't count toward
   pool" + "doesn't block turn end" are free if camps stay
   `team:'neutral'`.
3. **Auras/abilities/stats**: the four new weapons are pure config
   (AoE, burn, range-2, all knobs shipped); auras are ~80% built —
   the "lingers after leaving" pattern exists verbatim in the
   fire-tile top-up (`sustainTileStatus`); two small gaps (a
   caster-anchored propose arm; `anchor:'caster'` declared but never
   read). ⭐ Structural stat findings: precision + luck are DEAD for
   8/18 archetypes (evadable:false / critable:false abilities) while
   still accruing growth; mobility saturates at 4 points (the
   ≥1-tick-per-point derivation is 10Hz-era — at 20Hz the property
   permits rates down to 0.05); the roster's uniform prc 5 / eva 5
   cancels the subtractive terms exactly.
4. **UI**: the empower hover bug is real but lives in the DATA
   (`empowerMagnitudes` collapses 5 buff keys to one int per slot —
   fixing it widens 4 event payloads + Run + 6 test sites); player-card
   objective clicks are incoherent under the team-wide objective
   model; a REAL shipped bug at maxHandSize 10 (Fight ▸ / fire strip /
   packet row scroll below the fold); the sector-map overlay is cheap
   (MapScreen is a pure view; CacheOverlay is the page-lifetime
   pattern).
5. **Render/hook/audio**: the glyph misalignment root cause is
   CONFIRMED by the math (world-lift 0.5 → view-space 0.354 up +
   0.354 toward camera at 45° pitch → radial displacement at the
   viewport edge; ~3× worse at 3×3 footprints) and was fixed twice
   before in other overlays (J3 marker, I2 hitsplat — camera-up axis);
   TODO #81 already parked the item with this diagnosis. Pre-commit
   measured: 11s + 162s + 161s ≈ 5.6 min, with the main suite doing
   only ~19s of real test CPU (the rest is per-file module re-import
   under worker isolation) — `isolate:false` is the top lever; AGENTS'
   "22 passed" fuzz note is stale ~18×. Audio: event→sound is ~30
   scattered closures, not a table; no music/volume/mute
   infrastructure at all. Telemetry/achievements/tutorial: no
   server/network/CI exists; achievements + tutorial share the
   Cluster-6 persistent-store prerequisite.

### The design conversation — rationale for the non-obvious calls

- **Events follow the FTL lineage** (flat data-driven page trees, id
  references) over StS hand-coded events — matches the project's
  new-mechanics-are-data law. The combat-resolve chance rolls FIRST
  and globally (keeps event defs pure) and routes through the
  Rule/fold vocabulary because the user plans daemons that modify it.
  Chains = run-lifetime flags (the genre-universal answer) rather
  than bespoke chain machinery.
- **Gambles are bot-honest for free**: the §57d/69a clairvoyance
  guard (cloneForRollout re-seeds all serialized streams) means
  rollouts SAMPLE event outcomes — verified in-tree before the
  session leaned on it.
- **Camps stay neutral-team** because the alternative (a 4th team)
  widens ObjectiveTeam/MetricTeam/HUD buckets and re-pins every
  pathing baseline for no needed capability. AoE-hits-and-aggros was
  confirmed as the user's unstated intent. Camp rewards grant
  win-or-lose (the 51a portion precedent — withholding double-punishes
  the detour that caused the loss). Enemy deliberate pulls: the user
  wanted a low% chance; team-wide objectives mean a pull detours the
  WHOLE enemy team, so the seam ships dormant (`enemyPullChance` 0)
  pending a feel verdict at the phase.
- **Aura mechanism = AbilityDef-authored, World-pass-executed** — the
  hybrid keeps the authoring law AND true passive semantics (the
  pipeline route makes the bard choose inspire OR swing). Non-stacking
  falls out of merge:refresh; stacking would be new policy.
- **Stat feel is structural, not scalar**: the signed direction is
  critable-everywhere + luck-scaled magnitudes + roster accuracy
  identities + a promotion-screen derived-delta display (the
  window-dressing complaint is partly a VISIBILITY problem).
- **Map gen: constructive rules first** (the genre standard — StS
  builds constraints in, it doesn't regenerate), bounded rejection
  only for the fuzzy residue, metrics authored regardless as the
  acceptance tests, visualizer built first so decisions are made
  looking at real maps. Bump-coalescing was DROPPED as a phase-ordering
  driver: with no save/load UI until Cluster 6, snapshot bumps cost
  only ledger + re-baseline discipline.

## Phase 73 — Hook speedup + quick fixes

### Kickoff (2026-08-05, same session as the spec)

Code-reality audit was largely pre-paid by the spec session (the hook
timings, the hand-density diagnosis). The cut is in ROADMAP §73. The
one genuinely open question — **what does `isolate: true` actually
buy, and what's the blast radius of flipping it** — was asked by the
user and answered with fresh greps before the flip:

- The suite uses ZERO `vi.mock` / `stubGlobal` / fake timers /
  `resetModules` — the module-mocking rationale for isolation is moot
  here.
- Exactly FIVE files mutate shared module state, ALL with disciplined
  restore: statusBehavior / statusPeriodic / interpreter (STATUS_DEFS
  fixtures, beforeAll→afterAll), occupancy (ALL_UNIT_DEFS test
  giants), Run.test (HEALTH.fatiguePerStack, afterEach). Vitest runs
  ONE file at a time per worker even with `isolate: false`, so
  mutate-then-restore is exactly the contract shared workers need —
  the repo's test culture already follows it (and comments it).
- **Scope**: `isolate` is a Vitest-only knob. The dev server never
  reads the test block; the balancer CLIs (`fuzz` / `balance:board` /
  `pathing` / `run-config`) are standalone tsx processes that have
  ALWAYS run as one shared-registry process per batch — the §56 swap
  engine's config mutations were built for that reality and are
  untouched. The only vitest/balancer intersection is `fuzz:smoke`
  (73b), where the flip is audit-gated with a skip bias — that suite
  is compute-bound (~864s test CPU vs ~300s import), so isolation
  costs it proportionally little and the file split is the real
  lever.

### 73a — main-suite `isolate: false` (landed)

The honesty protocol, three full runs at the flip: **34.65s / 32.66s /
32.77s** (run 3 with `--sequence.shuffle.files`), each **exactly 151
files / 2355 tests, 0 skipped** — vs 162s isolated (import CPU
2648s→73s, transform 852s→40s; actual test CPU ~19s throughout, as
the spec-session measurement predicted). The contract for future
tests (mutate module state ⇒ restore it) is documented at the config
site in vite.config.ts.

### 73b — fuzz-suite rebalancing (landed)

The per-file timing pass (JSON reporter → ranked) REFRAMED the plan:
not one long pole but FOUR — harness.test.ts 136s/35t ·
harnessDaemon.test.ts 136s/6t · parallelRun.test.ts 129s/3t ·
occupancyInvariant.test.ts 126s/2t, against a ~884s total over 39
files. The per-TEST pass then set the floor: the biggest single tests
(perDaemonStats 74.2s, occupancy-greedy 66s, parallel-decisions
64.7s) bound any split at ~74s — rewriting tests to go lower is out
of scope by the phase's own guard.

The minimal surgery: ONE heavy block moved out of each tail file,
whole `it`s only, assertions byte-identical — new files
`harnessDeterminism` (the four strategy-determinism cases, ~68s) ·
`harnessDaemonStats` (the 12-run bucketing case, the 74s bound) ·
`occupancyInvariantRandom` (~60s) · `parallelRunDecisions` (~65s).
39 → 43 files, count 386 EXACT.

The fuzz-side `isolate: false` flip passed its audit gate cleanly:
the suite's ONLY module mutation is objectiveCoverage's
focusTileResolution knob, set/restored in try/finally
(exception-safe); arbitratedStrategy's `vi.fn()`s are local stubs —
no module mocking anywhere. Flipped with the same at-the-site
contract comment as 73a.

Results: **~175s → 114.4s / 114.7s** (second run with
`--sequence.shuffle.files`), both 43 files / 386 tests exactly;
effective concurrency 5.5× → ~8.4× (test CPU ~965–1010s under 114s
wall); import CPU 287→59–87s. Remaining tail = the ~74s single-test
bound + startup — further gains need test rewrites, declined.
Hook paths after 73a+73b: docs/UI ≈ 45s; sim-touching ≈ 2.7 min
(from 5.6). The 73f `vitest related` contingency stays un-cut.

### Housekeeping caught by the audit

- Doc drift: the tools-index map-gen card describes a node-map
  sandbox that doesn't exist (tool is battlefield terrain); AGENTS'
  fuzz:smoke count is stale (22 → 386). Both slated for their phases.
- Agent-memory drift: the "new unit glyphs need a glyphs.ts entry"
  note predated §38e (glyphs are catalog-derived) — fixed in the
  memory index this session.
