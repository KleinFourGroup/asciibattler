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

### 73c — hand-density fix (landed; native eyeball pending)

The shape: the Fight ▸ button is viewport-pinned BOTTOM-CENTER (all
three corners are taken by the fixed CardListButtons — roster TR,
draw BR, discard BL; the .port-leave precedent) with .preturn-screen
bottom padding so the in-flow strip/packet row scroll clear; the hand
row gets a balanced two-row cap for OVER-DRAWN hands only —
`hand.length > DECK.handSize` (config-derived, the balance-proof
norm) sets max-width to ceil(n/2) columns via CSS vars
(--hand-card-w/--hand-gap), so 10 wraps 5+5, 9 wraps 5+4, and the
standard deal keeps its single row untouched.

Verified on the REAL overdraw path (not a config shortcut — the first
attempt set handSize=10, which correctly does NOT trigger the cap;
the cap is for overdraws past the deal): shipped handSize 6, two
Surge packets injected into the live cache, both fired through the
actual packet-row UI → 10 cards. One real bug caught by the
geometry read: the cards were content-box, so 1px borders made each
186px and the 968px cap wrapped one card early (4+4+2) —
.unit-card--preturn is now border-box (the var IS the outer width).
Final evals: 5+5 clusters exact · card width 184 · Fight pinned +
visible at both scroll extremes · last in-flow control clears the
button · default 6-card deal single-row with no cap · zero console
errors. Screenshots unavailable (backgrounded pane doesn't
composite) — functional geometry is eval-proven; FEEL is the user's
native eyeball, the rider's actual exit gate.

### 73d — Stop never highlighted (landed)

`activeObjectiveMode` gains an `'atWill'` sentinel that matches no
button (init + the `objective:set`/`cleared` handlers store the mode
verbatim; the old code folded `atWill` onto `'stop'`, so Stop sat
green from every battle mount). `renderObjectivePane` needed zero
change — the sentinel simply matches nothing. Doc comment reframes
the semantics: Stop is an ACTION (clear the objective), not a state.
Browser-proof (three states, world objective read alongside the DOM):
initial → objective `atWill`, NO button active · Hold clicked+tick →
`hold`, Hold active · Stop clicked+tick → `atWill`, nothing active.
Zero console errors. Verification note for future sessions: a
backgrounded preview tab freezes rAF, so objective COMMANDS sit
queued until `world.tick()` is hand-driven — a pane click with no
tick reads as a no-op (bit twice this session before the tips'
hand-drive pattern was applied).

73c's native eyeball: **PASSED (user, 2026-08-05)** — and it surfaced
the `draw-two`-id-vs-Surge-draws-3 mismatch → TODO filed (rename
inside the §74 bump window; the id is a serialized cache key).

### 73e + the phase close (2026-08-05)

73e: the AGENTS pre-commit snippet's fuzz count was a stale duplicate
of a Cursor fact ("22 passed" vs the real 386/39 — ~18× off and the
likely origin of the draft spec's "22-seed" framing) — replaced with
a POINTER to the Cursor per the one-fact-one-home routing rule, so it
can't go stale again. The tools-index map-gen card now describes the
tool that exists (the battlefield-terrain sandbox) with an in-file
note that §77 builds the real node-map visualizer and re-describes
it; verified rendering on the live dev server.

**§73 CLOSED, all five steps + both eyeballs user-signed.** Exit
criteria vs actual: docs-path hook target "well under 2 min" →
~45s; sim path 5.6 → ~2.7 min; counts exact (2355 + 386) through
every verification run; the 73f contingency never cut. The phase's
ROADMAP section is demoted to its stub per the close rule.

### Housekeeping caught by the audit

- Doc drift: the tools-index map-gen card describes a node-map
  sandbox that doesn't exist (tool is battlefield terrain); AGENTS'
  fuzz:smoke count is stale (22 → 386). Both slated for their phases.
- Agent-memory drift: the "new unit glyphs need a glyphs.ts entry"
  note predated §38e (glyphs are catalog-derived) — fixed in the
  memory index this session.

## Phase 74 — Events (the keystone)

### Kickoff (2026-08-05, the dedicated planning session)

Four-surface code-reality audit (Run/phase · effect-op/fold ·
fuzz/bot · editor/config), then the 10-step cut; shape-lock
user-signed same day. The cut lives in ROADMAP §74; this entry
carries the findings + resolutions.

**Audit corrections to the spec's assumptions:**

1. **The "missing arms wedge at maxNodeHops" claim is wrong in both
   directions.** `run.phase satisfies never` (harness.ts:986,
   walker.ts:339) makes the RunPhase widening a COMPILE error until
   arms land — so the minimal arms ride the SAME commit as 74b, not
   merely "before the first fuzz run." The genuine hazard is an
   INCOMPLETE arm whose dispatch is phase-guard-rejected: the loop
   spins in `'event'` with `hops` frozen (increments only in the
   `'map'` case) — neither the hop guard nor the phase guard bounds
   it. Mitigation: arms must always dispatch a legal command; 74b
   adds a safety cap.
2. **The committed PATH_KINDS blast radius is 13 files** —
   `config/fuzz-strategies.json` + 12 fixture vectors (three
   board-load-bearing: regen / 55pre / fire-ablated) — NOT
   "best-strategy outputs" (gitignored; several local ones are
   already stale from pre-50c/pre-W2 eras). `signed-sheet.json`
   carries no path weights — unaffected. The 50c procedure applies:
   pad `event: 0` in one commit, regenerate local outputs at the
   next probe, board re-sign at §81.
3. **"No recursion" ≠ no cycles.** The grammar is flat but `next`
   id-refs can loop (A→B→A). 74a adds a boot assert (every page
   reaches a terminal) + the harness cap above.

**Load-bearing confirmations (the audit's anchors for the cut):**
the port model is exactly reusable (inline `handleEnterNode` branch ·
emit-nothing exit · Game.dispatch's `phase==='map'` catcher);
`executeInstantOps`' untagged `else` (Run.ts:2151) must become an
exhaustive switch BEFORE the union widens — a third op would
silently execute as healPool; `eventRng` appends LAST in the
constructor fork chain and joins `cloneRunForRollout` (nine streams)
in the SAME commit it serializes, or rollouts foresee event dice;
the flags record is `advanceSector`-exempt for free (reset is
by-enumeration); `removeDaemon` / packet-removal-by-id / `damagePool`
genuinely don't exist (all new plumbing, as the cluster audit said);
`KIND_BY_NODE['event'] = 'normal'` IS the combat-resolve pool rule
for free; decisions.csv needs NO new column (a new `site` string +
label convention — the parser resolves by header name, append-safe);
the Surge rename is 3 boot-asserted config sites + ~20 test sites +
1 doc comment, clean everywhere else.

**Shape resolutions (user-signed at the shape-lock):**

- **Non-starting event nodes draw from a sector-owned weighted
  `events` pool** (the `SectorEncounterEntrySchema` shape — same
  paradigm as `startingEvents`); eligibility conditions live on the
  event def and are read at pool-roll time (the flag-gated-chains
  mechanism).
- **The new effect ops are an events-side parallel union** sharing
  sub-schemas with daemons.ts (the packets.ts precedent, import
  direction events→daemons) — the daemon authoring surface does NOT
  widen ("it's its own thing").
- **Condition-failing choices render SHOWN-DISABLED with the
  requirement visible** ("this is a strategy game — players should
  be able to plan").

**Ordering property the cut is built on:** 74a–74d are
presence-gated (nothing places event nodes until 74e), so fuzz stays
byte-identical through the first four commits and the scheduled
re-baseline is 74e's alone — the camps discipline applied to events.
*(CORRECTED at 74b — see below: the stream-append cost breaks the
byte-identity half; the presence-gating half stands.)*

### 74b — the Run integration (v40→v41)

The bump commit landed to plan with ONE kickoff-prediction
correction: **"fuzz byte-identical through 74a–74d" was wrong.**
Appending the `eventRng` construction fork shifts every subsequent
`this.rng.fork()` (per-encounter mapRng, offers, sector advances) —
the exact documented cost of all four prior stream appends (H5, L1,
48b, 50d), missed because the kickoff reasoned about event-node
REACHABILITY (correct: none until 74e) rather than fork alignment.
Surfaced immediately by the determinism suite: seed 2026's first
encounter changed and the two-battle test driver's one-turn-chip +
no-promotion assumptions broke — the driver is now robust to
per-encounter pool depth and gate interposition (win-until-done).
Presence-gating still holds for event BEHAVIOR: no event draw
executes on the default path until §74e places nodes.

As-built notes beyond the cut line: the combat-resolve roll always
draws once on entry (the #49 always-draw discipline) and an
empty-eligible-pool entry degrades to the fight; the outcome roll is
always exactly one draw (no zero-draw singleton class — #111 applied
forward); `damagePool` CAN kill (the FTL lineage — defeat fires
mid-event and routing stops); `spendBits` floors at the balance
(authors gate real costs with `bitsAtLeast`); the 74a termination
fixpoint TIGHTENED to unconditioned-choices-only (a conditioned exit
can vanish mid-event — bits spent, flags flipped — so only an
unconditioned exit guarantees escape; the harness/walker enabled-list
is provably never empty); the six 74c ops throw loud at execution
(the landing-note contract — parse-legal since 74a, dev-dial-only
reachable until 74e). Bespoke `eventCatalog` defs are in-memory only
(a mid-event save carrying one hard-rejects — the bespoke-daemon
precedent, pinned by test). Dev dials: `firstNodeKind` widened to
`'elite' | 'event'` (the stamp was always kind-generic) +
`forcedEventId`.

**The 74c landing note (handoff — the next session starts here).** The
six deferred ops throw in `Run.executeEventOp` — the loud sites ARE
the work list:

- `addPacket`/`removePacket`: removal-BY-ID is new (every existing
  removal is cache-index-based); decide the add-side cache-full
  policy — overflow is legal derived state (the 49f shrink doctrine)
  vs the reward/port swap contract.
- `addDaemon`/`removeDaemon`: removeDaemon is new (daemons are
  push-only today); `effectiveRunStats` re-derives so the fold side
  is free — mind `emitCacheChanged` (ownership feeds the cacheSize
  fold).
- `grantUnit`/`removeUnit`: the gotcha-#118 chokepoint pair —
  `removeRosterUnit`'s map/port guard widens to `'event'`; decide
  which stream `grantUnit`'s `rollUnit` levels off (eventRng is the
  natural home) and the `removeUnit` pick semantics
  (`random | weakest | strongest`, absent = random, per the 74a
  schema).
- The reward-side widening: `REWARD_ENTRY_KINDS` + `RewardPortion` +
  `handleAcceptReward` branches + the reward-editor formatter and its
  byte-fidelity test gain `unit`/`poolHealth` kinds.
- ⚠ Step-zero premise check: the cut's "`executeInstantOps` untagged
  else → exhaustive switch" line predates 74b's decision to give
  events their OWN exhaustive executor — the `InstantOp` union may
  not widen at all, leaving that else a pure hygiene fix. Re-judge
  before building.

74d (the Surge `draw-two`→`surge` rename) rides the OPEN bump window
any time after 74c — the touch-list is in the kickoff audit
(3 boot-asserted config sites + ~20 test sites + TODO.md:93).

### 74c — effect-op execution (the shape-lock + the build)

**Shape-lock (user-signed, this session).** The landing note's open
forks resolved:

1. **addPacket on a full cache = HONOR THE GRANT** — push into
   overflow; the 49f forced-keep flow (already legal derived state)
   demands the discards. Chosen over silent-drop for the same reason
   the 74b ops threw instead of no-op'ing: authored content must
   never silently falsify. (`cacheOverflow`'s "only after a shrink"
   comment gains the second cause.)
2. **addDaemon when already owned = SILENT SKIP at the executor.**
   Everywhere else exclusion runs upstream of the offer (reward
   roller, port stock), so a duplicate would be the first in the
   game and would double-apply folds. The fork also surfaced the
   condition-vocabulary gap (no negation) → **74c-pre inserted
   (user-signed): a generic `not` combinator** — one recursive
   member, closes `not hasDaemon` / `not flagSet` / `not
   characterIs` at once; deliberately the ONLY combinator (no
   allOf/anyOf until content demands — eligibility arrays already
   AND). Termination fixpoint untouched (unconditioned-only walk);
   `assertEventRefs` recurses. The executor skip stays as
   defense-in-depth — `not` makes gating possible, not mandatory.
3. **removeUnit weakest/strongest = level, tie → lowest roster
   index** (deterministic, zero draws); `random` = one eventRng
   draw; roster-of-1 = silent no-op (authors gate with
   `rosterSizeAtLeast`).
4. **Reward `unit` portions pre-roll the full template at OFFER time
   in `rollRewards`** (the port-stock precedent — templates
   serialize through `pendingRewards` like `team`; the screen shows
   real stats). The stat roll rides the EXISTING reward-bits stream
   — deliberately NOT a tenth constructor fork (the 74b stream-
   append cost, not paid twice). Draws only at level>1 (rollUnit's
   no-choice-no-entropy fast path).

**Step-zero verdict:** the cut's "`executeInstantOps` untagged else →
exhaustive switch" line — the `InstantOp` union does NOT widen (74b
gave events their own executor; the reward `poolHealth` settle rides
the existing `healPool` member), so the switch is pure hygiene.
Done anyway: a future widening becomes a compile error, not a
silent heal.
