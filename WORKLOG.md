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
   next probe, board re-sign at §83.
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

**As-built (74c-pre + 74c, both landed 2026-08-05).** To plan on the
resolutions above. Notes beyond the cut line:

- The executor's standing philosophy, now written at the switch: an
  authored effect is ALWAYS honored, degrading gracefully (spendBits
  floors · addPacket overflows · absent-id removals no-op); loud
  throws are reserved for catalog corruption (unknown addDaemon /
  grantUnit ids — bespoke-catalog-only reachable, the shipped
  catalog is boot-asserted).
- `removeDaemon` is a public chokepoint sibling of `addDaemon`
  (first-match ≡ whole-match — duplicates can't exist) and carries
  the same 49b `emitCacheChanged` (losing a size-modifier idol can
  shrink capacity into forced-keep). Rollout safety checked:
  `cloneRunForRollout` is a full wire round-trip — no shared arrays,
  a rollout's removeDaemon can't touch the live run.
- `removePacket` routes through `handleDiscardPacket` (the single-
  mutator discipline, the 49c swap's precedent).
- Reward-side: `rollRewards` gains the two branches (unit templates
  pre-rolled on the bits stream; poolHealth zero-draw), fromJSON
  passes unit templates through like `team` (the port-stock rule),
  RewardScreen gains two render arms, and the editor gains the
  full kind support (dropdown was already REWARD_ENTRY_KINDS-derived;
  defaults/fields/describe/EV + the assertRewardUnitRefs validation
  arm). The formatter's level rule: authored level emitted, absent
  OMITTED (= 1) — pinned byte-level in the editor test.
- All fuzz `pickReward` consumers default-accept the new kinds
  (their only guard is packet-at-full-cache) — no arm changes.
- Discovered en route: STARTING_LEVEL is 5 and the starting roster
  is 10 (two test fixtures initially assumed 1/small — fixture
  levels now clear the real roster).
- No shipped reward table authors the new kinds yet — that's §74i's
  content round (ARCHITECTURE notes them unauthored).

### 74d — the Surge rename (2026-08-06)

`draw-two` → `surge`, landed to the kickoff touch-list exactly: the
three boot-asserted config sites (`packets.json` id ·
`rewards.json` packet ref · `prices.json` price key, renamed in
place) + the Run.test/scored.test sites + the cli.ts `--grant` doc
example. Historical BALANCE.md rows and gitignored decisions.csv
outputs keep the old id (measurement records, not live refs — the
TODO's "outputs, no action" clause). Rides the open v41 window: a
dev-save carrying `draw-two` in its cache now hard-rejects on the
catalog re-validation, which is the window's whole point. Closes
TODO.md's rename line (user call, 73c).

### 74e — placement + sector seams (2026-08-06)

**The shape-lock (user-signed, this session).** Three calls: (1) the
three smoke events POOL into both shipped sectors' `events` at 74e —
placement of shipped content, not §74i's design round; without it the
exit criterion would test node traversal but never the event phase.
(2) `startingEvents` ships seam-only (schema + zero-draw stamp +
empty arrays; §74i authors the first entry); the `firstNodeKind` dev
dial BEATS the sector stamp (isolation power). (3) **The density
correction** — the spec's elite-style "optional detour" framing was
wrong: events are a major run component, ~half as frequent as battles
on a path, back-to-back legal (user feel call). Shipped
`eventChance 0.5` / `eventMinSpacing 1` (vs the elite/port
0.25/0.2 + spacing 2–3 pattern), LAUNCH-ROUGH for §83. Knock-ons
owned eyes-open: the one-event-per-hop scatter ceiling (§77's ratio
pass is the real control), battle-less width-2 hops (rest+event fills
both slots), the sharpened economy tradeoff (hop-scaled enemies vs
per-fight income — a first-order channel at 0.5 density, §83 reads
it), and 3-event catalog repetition until §74i.

**As-built to the cut + the shape-lock.** Notes beyond the cut line:

- The scatter is the FOURTH tail pass (after port INCLUDING its
  fallback); rest/elite/port placement byte-identical to pre-74e —
  pinned per-seed by the eventChance-dial twin test (a dialed map's
  non-event kinds equal the plain map's). The appended draws shift
  the boss forewarning pre-roll (same `sectorRng`) — the scheduled
  seed-stream break, on top of placement itself changing routes.
- `stampRootKind` (NodeMap export) is the startingEvents stamp
  mechanism: a pure post-generation transform, boss-wins on the
  hopCount-1 degenerate. Run applies it at BOTH sector-entry seams;
  the advanceSector seam is dial-free by construction (the scatter
  slice never carries `firstNodeKind`). ⚠ The Run-level startingEvents
  wiring (stamp + the ignore-combat-resolve branch) ships EXERCISED
  ONLY by unit tests on the pure pieces — no shipped sector authors
  `startingEvents` until §74i, whose exit sweep is the landing note
  for end-to-end coverage.
- A starting-event entry still DRAWS the combat-resolve roll (the #49
  draw-count discipline) but ignores the result — an authored opening
  beat must not vanish 25% of the time. Empty-eligible still degrades.
- `rollEventForNode` resolves pool ids against the ACTIVE catalog and
  silently skips unresolvable entries (bespoke-catalog runs against
  shipped sector pools); the sectors.ts guard 5 owns shipped drift.
  One cumulative-weight draw, singletons included (#111 forward).
- `eventChance` joined `sectorAdvanceConfig` (#121) + the fuzz
  `--event-chance` dial; `--first-node=event` widened in the fuzz CLI
  (the 74b RunConfig widening surfaced — it still bailed on 'event').
- **`RunResult.eventsVisited`** — the portPurchases/packetsFired
  non-vacuous twin, counted at the first choice-iteration per visit
  (TS narrows `run.phase` at the dispatch site). The §74e exit
  criterion is a REGRESSION PIN now: harness.test's traversal test
  proves opened pages at eventChance=1 and exact zero on the
  eventChance=0 control arm. Not yet a summary.csv column (§83's
  call).
- `dockAtPort` (Run.test) routes event-free by construction now — an
  opened event would perturb the port pins and a combat-resolve is a
  chance draw; seeds 41→42 / 84→87 re-seeded (no event-free route).
  The loud-throw discipline mirrors findRestRun.
- Main suite needed NO other re-baseline: the 74b-hardened drivers
  (win-until-done) absorbed the stream shift. 2423 main (+20) /
  387 fuzz (+1) / typecheck clean.
- Browser-verified post-commit (`bec98dd`): `?` glyphs render on the
  live map (DOM read, seed 43: 4 events + elite/port/rest siblings);
  a 50-seed live-path sweep read mean 3.74 events/map with exactly
  one zero-event seed (42 — the ~0.4% tail, land on it and the map
  just has no `?`s). ⚠ **Interim browser hazard until §74f:** no
  scene consumes `event:entered` yet, so a human clicking a `?` that
  OPENS (the ~75% non-resolve case) strands the run in the event
  phase with no UI. Dev-only exposure (no deploy mid-phase), and 74f
  is NEXT — don't playtest events in the browser before it lands.
  *(CLOSED at 74f, same day.)*
- Follow-up (`c5603f5`, user call): event nodes gained their kind
  accent — new palette entry **TERMINAL_BLUE `#3D7BFF`** (a true blue;
  the cyan FLOURESCENT_BLUE is spoken for as the frontier/clickable
  STATE color) + the standard `.map-node.event` rule. Without it the
  `?`s blended into battles.

### 74f — EventScene/EventScreen (2026-08-06)

Landed to the cut on the port model, low-risk to plan. Notes beyond
the cut line:

- **`describeEventCondition` (config/events.ts)** — the requirement
  copy as a composable PHRASE ("10+ bits"; the UI prefixes
  "Requires"), so the `not` combinator reads naturally and the §74h
  event editor can reuse the same phrases in its choice rows. Names
  resolve through the sibling catalogs (boot-asserted refs mean no
  shipped fallback); flag phrases show the raw namespaced flag —
  dev-grade copy, §74i owns player-facing wording if it wants it.
- **`Run.activeEventName`** — the one new read (the catalog stays
  private; the screen gets exactly what it needs).
- Screen shape: the PortScreen live-Run + full-re-render discipline,
  re-rendering off `event:pageChanged` (+ `run:bitsChanged`,
  currently unreachable mid-page — effects execute only on choice
  resolution — but the affordability disables must not be able to go
  stale if that changes). Met conditions keep their requirement line
  VISIBLE but dimmed (the row doesn't jump when state crosses the
  threshold); failing = disabled + amber (a cost, not an error).
  Chrome keyed to TERMINAL_BLUE — the scene answers the `?` glyph
  the player clicked. The `art` seam renders nothing (scope guard).
- Game wiring was 74b-prebuilt (the chooseEventOption silent-
  transition catcher); 74f added only the `event:entered` →
  EventScene subscription. **The 74e interim hazard is closed.**
- Browser-driven exit (the step's eyeball criterion), all five flows
  via the preview MCP at `firstNode=event`: open (shrine, heading +
  text + 3 choices) · shown-disabled ("Make an offering" at 0 bits:
  disabled, amber "Requires 10+ bits") · met-dim (at `bits=100`:
  enabled, grey requirement, spend 100→90) · page hop (seed 231:
  scoop → guardians, DOM re-rendered) · start-encounter ("Stand and
  fight" → deserters + the bits-large override pinned → the battle
  path). Zero console errors. Subjective feel = the user's native
  pass, as always.
- render/ui policy: no new tests (eyeball-only); the main suite +
  typecheck stay green (Run.ts gained only the getter).

### 74g — arbitration: the eventChoice site (2026-08-06)

**Shape-lock (user-signed, this session).** Three calls: (1) **the
nominator model** — the doctrine policy's uniform-random pick among the
enabled choices is the NOMINEE/null arm (the nodeChoice precedent); the
live-vs-rollout coherence rule holds via a rollout strategy override
that pins `pickEventChoice` to the nominee while the clone sits at the
decision's `(eventId, pageId)` (`run.activeEvent` is public — no new
Run API), plays cheap uniform-random on later pages, and re-pins on an
authored loop revisit (deterministic, MAX_EVENT_STEPS-capped). (2)
**ε = the MAP class floor (3.265), shared by class argument** — the
grant→preTurn / nodeChoice→map precedent (out-of-battle clone,
next-battle horizon). PROVISIONAL: event pages are a context class
readEpsilonAA has never read; the §83 board round re-reads it. (3)
**A single enabled choice is not a decision** — no draw, no rollouts,
no log (the singleton-frontier rule; forced pages stay free).

**As-built to the cut.** Notes beyond the cut line:

- `FuzzStrategy.pickEventChoice` is the sixth optional hook; ABSENT =
  the doctrine draw byte-for-byte (pinned by the harness-contract
  mirror test, the pickReward/pickGrantAction idiom). Harness + walker
  both consult it; the walker's clone-contract phase list gains
  `'event'`.
- The bespoke-catalog caveat is written at the site header: rollout
  clones are wire round-trips, so the arb arm can't arbitrate a
  bespoke (in-memory `eventCatalog`) event — the 74b pin makes it
  throw loud in `Run.fromJSON`. Every fuzz batch runs shipped
  content; the dev-dial combination is documented, not repaired.
- `eventChoiceEpsilon` joins the per-site `ArbitratedConfig`
  overrides. NO CLI flag: `--grant-epsilon` exists for the 71d
  ablation instrument specifically — an event ablation dial gets
  added when an instrument wants one, not speculatively.
- Test fixtures ride the 74b dev dials (`firstNodeKind:'event'` +
  `forcedEventId` + a deterministic open-entry seed hunt — no bespoke
  daemon needed); the singleton pin uses a bespoke two-choice event
  legally (the mechanism path never clones) and passes `rng: null` +
  an empty evaluator so both zero-cost claims are load-bearing.
- Exit met: a 4-seed `--arbitrate --event-chance=1` batch wrote 17
  `eventChoice` rows to decisions.csv — site string + authored choice
  labels + ε 3.265 in the existing 18-col schema, zero column changes
  (the kickoff's append-safe prediction held). +7 fuzz tests (387→394
  fuzz:smoke); main 2423 unchanged; typecheck clean.

### 74h — the event editor (2026-08-06)

Landed to the cut on the reward/encounter-editor shape
(`tools/event-editor/`). Notes beyond the cut line:

- **formatEventsJson** — the leaf-inline / composite-expand rules
  derived from the committed file: conditions (recursively, `not`
  included), effect ops, and `return-to-map` stay inline;
  single-element `effects`/`eligibility` arrays stay inline; an
  outcome is inline iff it has no effects and an inline next;
  `start-encounter` always expands. Explicit per-kind emitters (never
  `Object.entries`) so zod's parse-time key ordering can't shape the
  bytes. The verbatim pin passed on the first run.
- **The editor**: visual builder (page cards → choice cards → outcome
  rows) + a raw-JSON fallback for the `pages` record, both funneling
  into one working model (the encounter editor's waves-box contract).
  The `not` combinator is a NOT toggle one level deep — deeper nesting
  stays JSON-authorable; the form shows its phrase and collapses it on
  edit (documented at the row). All three boot layers validate LIVE
  (schema superRefine + the termination fixpoint + `assertEventRefs`
  on the live catalogs) plus the sectors-side reverse check (renaming
  an event a committed sector pools warns); Save disables on any.
  `describeEventCondition` phrases render per condition row — the 74f
  reuse, so the author reads exactly the player's copy. Page rename
  rewrites `entry` + every string `next` in the same gesture.
  Placement = a read-only pane over committed SECTORS
  (sector-owns-both — authoring stays in the sector editor).
- `CONDITION_KINDS`/`OP_KINDS` are pinned complete against their
  unions at compile time (`satisfies` + an Exclude guard) — widening a
  union without a form arm becomes a build error, not a silent gap.
- The playtest link is `?hops=3&firstNode=event` only —
  `forcedEventId` is deliberately programmatic-only (its RunConfig doc
  comment), so the card carries the honest hint instead of a new URL
  param.
- **Browser-driven exit** (preview MCP, DOM reads): boot clean — 3
  tabs, the full shrine/terminal page-map render, 0 console errors ·
  the **no-edit Save wrote a BYTE-IDENTICAL file** (git diff empty —
  the live twin of the vitest pin) then reload + stash-restore showed
  the confirmation · NOT toggle → "not 10+ bits" + the combinator in
  the export, still valid · deleting the guardians page → the exact
  superRefine dangling-ref error + Save disabled → Revert green ·
  JSON view holds the record; rename guardians→ambush rewrote the
  `next` ref and stayed valid. Preview server stopped after. Feel =
  the user's native pass, as always.
- +3 main tests (2426); the fuzz suite is untouched (tools/ paths
  don't trip the hook). vite.config.ts allowlists `events.json`;
  the tools index gains the card.

### 74i — the demo-catalog design round (2026-08-07, IN FLIGHT)

**The design conversation (user-signed).** Fork 1 (the outcome-beat
rider): the AUTHORED outcome-page convention — a terminal page narrates
the result, its acknowledging choice carries the effects — "sometimes
broken, but not often"; no engine toast (a §83 feel-read revisit if
prose proves insufficient). Fork 2 (the repeat rider): DEFAULT
NO-REPEAT per run, opt-out `repeatable: true` per def. Starting-event-
as-buff and the two whimsical events confirmed intentional (levity
offsetting the grim cadre chain).

**The content review (the user wrote nine events + a bespoke unit
before the round opened).** Machine-valid, byte-faithful, all refs
resolved — but TWO events shipped silently dead content: orphaned
pages no validator saw (cadre-3's entire back half — the Moneta idol,
the 50-bit rescue, the infernalColumn fight; orange-mob's reward
page). Root cause: the termination assert checks pages can EXIT, not
that they can be ENTERED. Both rewired by the user; the class is now
closed by `assertEventPagesReachable` (below). Balance flags owned
eyes-open: the silent-mage grant (user cut L12→L10 and put risk on the
meditation path), the sector-1-start second daemon (intended).

**74i-a — the repeat mechanism + the reachability assert (landed).**

- `repeatable?: boolean` on EventDef (schema + formatter key order
  `id/name/repeatable?/…` + editor checkbox; absent = the no-repeat
  default).
- The engine writes **`visited:<eventId>`** into the EXISTING flag
  store the moment a page opens (combat-resolved entries never mark —
  the player never saw it; repeatable defs still mark, history is
  free). The pool roll — both `events` and `startingEvents` — skips
  visited non-repeatable defs; `forcedEventId` bypasses (a force is a
  force). ZERO serialization change: flags already ride v41.
- The namespace contract: authored content READS `visited:*` freely
  (cross-event eligibility gates come free — the sold feature);
  WRITING one is boot-asserted (`assertEventReservedFlags`) — one
  writer keeps "visited" honest.
- **`assertEventPagesReachable`** (BFS from entry) joins the boot
  asserts + the editor validation pane — the content-review bug class
  can no longer save, let alone ship.
- Exhaustion degrades free: an all-visited pool = the 74b
  empty-eligible rule (fight). Probe finding en route: the scatter
  never places events at hop 1 (all seeds), so the repeat tests
  teleport via `currentNodeId` to reach a second event node — a
  fromJSON teleport would re-pin the shipped catalog (the 74b
  bespoke-rejection rule).

**74i-b — the content landing + the prodigy consumption contract.**
The user's nine events + the `prodigy` unit def (legendary,
`draftable: false`, event-grant-only, high growth). The new-unit
checklist paid: `prodigy: 0` padded into BOTH archetype-keyed weight
records (`archetype` + `composition` — scoredWeights' only two, class
audited) across config/fuzz-strategies.json + redraw-level-fisher +
the 12 fixture vectors (the 50c pad-zero procedure; local
best-strategy outputs regenerate at the next probe; §83 board
re-signs), and the §29-close draft-exclusion pin gains 'prodigy'.
Suites: 2435 main (+9) / 394 fuzz green.

**74i-c — placement + the reward kinds + the exit sweep (landed).**
The signed placement: `sector-1-start` → The Start's `startingEvents`
(the Deep End authors none yet); all nine other events pool in BOTH
sectors at weight 1 (the cadre chain spans sectors — flags persist);
`cheese-tax` ships `repeatable: true`. The user's tenth event
(**hostage-trio**, option 3 of the reward-kind fork) carries the new
**`hostage-rescue`** table (`unit` healer-L3 w2 / `unit` mercenary-L3
w1 / `poolHealth` 5 w1) as its `rewardOverride` — both 74c kinds are
shipped content now. DESIGN.md gains the "Events" section (the
outcome-page convention + the no-repeat default + chains) and sheds
the stale "shop + event deferred" lines.

**The scheduled break, paid.** Populating `startingEvents` stamps
EVERY shipped run's root as the opening event — the 74e landing
note's debt, and the biggest test-reality shift since 74b:

- **The `NO_EVENTS` control fixture** (`eventCatalog: []` — every
  event entry degrades to the fight, the 74b rule; battle streams
  untouched, eventRng is dedicated) adopted across the battle-subject
  fixtures: Run.test's shared helpers + stragglers, encounter-loop,
  snapshot-roundtrip's three mid-battle round-trips, determinism's
  two-battle driver, the walker/arbitrated turn-intro parks. Strictly
  stronger isolation than 74e's route avoidance — dockAtPort's
  event-free route hunt is RETIRED (it rejected the event-kind root
  outright and threw on every seed).
- **The dial exemption (Run.ts):** a `firstNodeKind: 'event'` root
  draws from the REGULAR pool — without it the dial lost its 74e
  isolation power the day a sector authored a starting event (every
  74b/74e/74i fixture broke through the startingEvents capture).
  `rootStampedByDial` is construction-only, NOT persisted (the
  forcedEventId discipline).
- Premise updates: the S2 root-kind pin (root = the stamped event
  now), the 74e pool pin derives from the shipped sector (12 events),
  the 74e traversal control arm re-pinned 0 → exactly 1 (the
  starting event is dial-free and resolve-exempt by design), and the
  port canary re-pinned 2→3 (the 50g/56a/61d re-scan discipline;
  scan read 3/5/6/8/10/15 buying). The gauntlet cell drive
  suppresses at the CALL SITE (cellRunConfig stays URL-parity-pure);
  the browser-side cell protocol is a new TODO watch item.
- **The exit-sweep positive pin**: a shipped no-dial run opens the
  authored starting event at the root on every seed, visited-marked —
  the end-to-end coverage the 74e note deferred here. Both riders
  closed in TODO.md.

### §74 CLOSE (74j, 2026-08-07) — user-signed after the native pass

Exit criteria vs actual, all four met: event nodes playable end to
end in the browser (74f's five flows + the user's full playthroughs —
"playing great") · fuzz traverses events green (the traversal pin +
394 fuzz:smoke) · the editor round-trips byte-faithful (the vitest
verbatim pin + the LIVE no-op-save proof) · decisions.csv shows
eventChoice rows (17 on the 74g exit batch). Snapshot trail: v40→v41
at 74b, the bump window CLOSED at this phase close (74d's Surge
rename + 74i's `repeatable` field rode it). 74j swept ARCHITECTURE
(the events.ts/events.json entries were MISSING; Run.ts's annotation
was stale back to v16/pre-§47 — phase union + version pointer fixed;
NodeMap/RunConfig/sectors/sector-map/rewards annotations refreshed)
and demoted the ROADMAP section. Carried forward: the ε floor §83
re-read · the gambler parity repair (§83 first item) · the §77
stress test + ratio pass · the browser-cell gauntlet watch item ·
launch-rough event balance (§83 reads the event era).

## Phase 75 — Camps

### Kickoff (2026-08-08): the code-reality audit

Four parallel surveys at HEAD (post-§74 churn), re-verifying the
cluster-kickoff findings and sharpening them into the cut. Pre-flight
green first: 2436 main / typecheck clean at the §74 close commit.

**1. The neutral-site census — the "~40 sites" estimate held: 41
must-widen, 21 design-calls, 13 fine-as-is** (58 `'neutral'` literals
in non-test src/). Ranked risk:

- The movement.ts moving-wall item is TWO coupled defects, not one:
  neutrals are denied a §45a vacancy ETA (movement.ts:114) AND the
  `else if` at :121-126 means `excludeUnitId` structurally cannot
  exclude a neutral — nothing can ever path onto an active neutral's
  cell, and §45b queue-in-lane never fires behind one.
- FOUR lockstep hard-blocker siblings must move with it:
  blockedAlly.ts:146 (`neutralCells` topology walls),
  actingPosition.ts:68 (firing-cell BFS — its doc explicitly demands
  lockstep with findPath or hold-vs-strike desyncs, the GP4/Qb#3
  freeze class), SupportMovementBehavior.ts:314 (bespoke duplicate),
  and canReach/canApproach via buildMovementContext.
- `recordDamage` drops neutral-target damage at World.ts:804, before
  the attacker lookup — active-neutral kills earn zero XP today.
- positioning.ts:246: a neutral target short-circuits to a
  single-goal bestEffort charge (no firing-cell search, no kite) —
  ranged units would charge camps. positioning.ts:123: every neutral
  with `blocksLineOfSight:false` grants half-cover — a wandering camp
  unit becomes mobile cover unless gated.
- The Targeting root inversions (:37 `findTarget` skips neutral
  candidates; :67 `updateTarget` bails for neutral units) plus the
  two easy-to-miss secondary scans (:463 `findEngageableEnemy`, :493
  `findInRangeEnemy`) — engage/hold/blind units never see neutrals
  even after the root widens.
- The spawn path is structurally new: `spawnEnvironment` +
  `inertDerived` hard-code ZERO_STATS / attackRange 0 /
  moveCooldownTicks 0 and attach NO behaviors; `NeutralUnitDefSchema`
  strict-rejects abilities/stats. ⇒ **camp units are combatant defs
  spawned onto team 'neutral'** via a new path mirroring
  `spawnFromQueue` (behaviors + SpawnAction lockout), not a widened
  neutral def.
- **Latent bug found in passing**: tests/fuzz/harness.ts:488 still
  filters telemetry on the RETIRED `'environment'` sentinel (§38d) —
  walls/half-cover/rubble already register as telemetry combatants
  today. Fix as a pre-step before camps make it load-bearing.

**2. World/snapshot structural facts:**

- **A new World is constructed per TURN** (`beginTurn` →
  `battle:started` → fresh World in BattleScene.mount) — so "camp
  composition resolved on turn start" = battle-setup time. No tick
  hook, no tick-order change. Camp selection rides a `setupRngFor`
  sibling off `encounter.terrainSeed` (the fresh-parent-then-fork
  pattern, battleSetup.ts:220) — off Run's fork ladder entirely,
  zero re-baseline cost.
- **Hazard the spec missed**: `enemyPullChance` as a Run-side
  construction fork would re-baseline every fuzz seed EVEN AT
  DEFAULT 0 — appending to the ladder shifts downstream streams
  regardless of behavior (the exact 74b lesson, not to be paid
  twice). Resolution proposed at the cut: a LAZY per-turn fork off
  `battleRng`, taken only when the layout has camps AND the chance
  > 0 — dedicated (spec satisfied), ephemeral like battleRng itself,
  byte-identical at default 0.
- The `_combatBegan` latch hazard is concrete: `checkBattleEnd`'s
  both-alive early-return fires MID-LOOP (World.ts:1748-1750), so a
  third alive-flag computed in the same loop would be unreliably
  populated — hoist the camp-alive scan before the loop.
- A World-owned `campRng` must be PRESENCE-GATED — an unconditional
  `rng.fork()` at construction advances the parent one step and
  shifts every downstream draw on ALL layouts (byte-identity breach
  everywhere, not just camp layouts). Nullable field, created only
  when camps spawn; joins `cloneForRollout`'s re-seed list
  (rollout.ts:48-49) conditionally, after combatRng — fork order is
  part of the contract.
- v34→v35 touch list: the World.ts changelog + constant; ONE
  hardcoded assert (spawn-overflow.test.ts:216 `toBe(34)`); a new
  snapshot-roundtrip reject case in the `schemaVersion - 1` shape;
  ~5 stale "v34" doc comments (rollout.ts, TrafficScriptDriver.ts,
  battleRules.test.ts); HANDOFF/ROADMAP/spec doc rows. No migration
  machinery exists — the contract is reject-outright.

**3. Behavior/wander:**

- `movementBehavior` widens `['standard','support']` → `+ 'camp'` in
  the COMBATANT schema arm (already the right arm — camp units are
  combatant defs); resolver ternary → switch; zero-arg factory
  registry gains the kind. Two hardcoded test allowlists widen.
  The archetype editor has NO movementBehavior UI today (formatter
  round-trips it generically) — net-new UI only if wanted.
- **The zero-arg factory contract (registry.ts:8-17) forbids behavior
  state ⇒ the leash anchor lives in the World camp registry, never on
  the behavior instance.**
- Leash = behavior-side candidate filtering: build the free-neighbor
  list (the `proposeWander` shape, MovementBehavior.ts:288-313), drop
  cells beyond `chebyshev(candidate, anchor) > leashRadius`, THEN the
  RNG pick — invariant (a) holds by construction, zero movement.ts
  change, the purity ban preserved. SupportMovementBehavior.ts:134 is
  the structural precedent (behavior-level radius test vs an anchor).
- The hostile arm delegates to the standard engagement path
  (currentTarget + engagementDirective + advance) behind one internal
  `if` — no selector change needed. Accepted consequence: a hostile
  camp unit pursuing may leave its leash (the objectiveEngages
  retaliation-escape precedent); the leash invariant applies to the
  PASSIVE state.
- `anchorFootprint`'s `random-intersect` policy is a NO-OP at size 1
  (all four min-corners coincide) — the spec's "overlap spawn" for
  1×1 units is really the caller-level scatter (the runOverflowScan
  candidate-walk shape). random-intersect earns its keep only for
  N×N camp bodies; implement it for real (it was reserved for
  exactly this) but the multi-unit-per-tile scatter is the working
  mechanism.
- `proposeWander` rolls on `world.combatRng` (gotcha #95); camp
  wander rolls ride `campRng` instead per the spec's dedicated-fork
  clause — camp-free layouts spawn no camp units either way, but the
  separate stream keeps camp-present combat streams uncontaminated.

**4. Economy / editors:**

- **The 51a tally portion is the exact turn-end precedent**: a World
  accumulator (serialized, `tallies` shape) → COPIED into the
  `battle:ended` payload at emit (World.ts:1819) → destructured at
  Run.ts:1262 → a portion branch INSIDE `result !== 'lost'`
  (Run.ts:2816) but BEFORE the `won` gate (:2852). The camp-kill
  portion slots between :2845 and :2852 — fires on win/draw/ongoing,
  exactly the spec's win-or-lose clause.
- **The `kill` trigger (World.ts:962) is the ONLY clean killer→victim
  attribution site in the codebase** (fires inside applyDamage before
  the reap, attacker resolved). DoT/environmental kills carry no
  attacker (dealDamage takes `attacker: Unit | undefined`, fires no
  triggers) — the fallback for a DoT-killed final camp unit is the
  status's `sourceUnitId` team. Hostility trigger rides the same
  chokepoint (takeHit where target has a campId → add attacker's team
  to the camp's hostility set).
- Camp reward rolls reuse `rollRewards` + the existing
  `RewardPortion` kinds wholesale (bits/daemon/packet/unit/
  poolHealth — §74c already widened everything needed); draws on
  rewardRng/rewardBitsRng only when camps were killed
  (presence-gated). **No RunSnapshot bump predicted**: no new Run
  fields, no phase widening, no construction fork — the
  `battle:ended` payload widening is an event-shape change, not
  serialized state. (A prediction per the planning stack — its
  absence at build time is a tell.)
- camps.json = ONE vite allowlist line + TWO configHash lines
  (import + CONFIG_SOURCES entry; the drift-guard test enforces) —
  and the hash change invalidates the recorded-trace era
  (TraceRecorder/replayTrace/gauntlet fixture) — a scheduled
  re-baseline at 75a, called out eyes-open.
- Editor models: the camp catalog editor copies the encounter editor
  (reward-ref panel `makeRewardRow`, kind radios, sessionStorage
  save-stash) + the event editor's LIVE boot-assert validation; the
  layout editor's rubble list (`RubblePlacement[]`, click-once
  placement, `buildCurrentLayout` emit-when-non-empty) is the exact
  model for `campSpawns` + a weighted `camps` row list (the
  spawn-region panel / makeRewardRow row shape). Byte-faithful
  formatter per the formatEncountersJson doctrine.

**The ordering property the cut is built on** (the 74b correction
applied forward): every step through 75i is presence-gated AND
fork-append-free — campRng is World-side and nullable, the camp
setup stream derives from terrainSeed (not the Run ladder), the
enemyPull fork is lazy — so fuzz stays byte-identical until 75j
deliberately ships camps into layouts WITH the scheduled board
re-pin. Unlike §74, there is no construction-fork append anywhere in
the plan, so the byte-identity claim covers streams, not just
reachability.

### The shape-lock (user-signed, 2026-08-08)

The four calls from the kickoff proposal, all resolved:

1. **XP from camps: YES** — `recordDamage` widens for ACTIVE
   neutrals; the user's framing: only static units (walls) shouldn't
   grant XP. Camp combat is opposed combat.
2. **No HUD cards for camp units in v1** — third-faction
   sprite/overlay treatment only; no card-row space. A hostile-camp
   row is a possible later follow-up.
3. **`enemyPullChance` = the lazy per-turn fork** off battleRng
   (camps present AND chance > 0), never a Run-ladder append. The
   user probed the cost model and it sharpened to three parts: a
   ladder append (a) fails this phase's byte-identity exit gate BY
   CONSTRUCTION even at default 0, (b) forces a global seed remap —
   every seed-pinned test re-seeds + the board re-pins — for zero
   behavioral payoff, and (c) would pre-pay §77's already-scheduled
   deliberate stream break a phase early. 75j's re-pin, by contrast,
   is content-driven (camp layouts genuinely play differently), not
   a stream break — camp-free layouts stay byte-identical forever.
4. **Overlap spawn = PORTAL DRIP, not setup scatter** (the user's
   original intent, and the argument is decisive): camps sit in
   tight pockets (e.g. two 3×3 labyrinth corners are already
   reserved), where a scatter ring leaks units into hallways unless
   bounded per-map — and even bounded, insufficient room forces a
   queue anyway, so the queue IS the general mechanism. Drip makes
   spatial containment free (units only ever materialize overlapping
   the spawn tile — the spec's literal sentence — and the leash
   holds the pocket) and makes the vacate-≤N-ticks invariant
   load-bearing (queue progress depends on it), exactly as the
   spec's "wanders off in a timely manner" note implied.
   Consequences folded into the cut: **per-camp pending queues live
   in the World camp registry** (not the team-keyed `spawnQueues` —
   a shared neutral queue would head-of-line-block camp B behind
   camp A's wedged tile), drained in a deterministic tick slot
   beside `runOverflowScan` (stable camp-id order);
   **camp-killed = pending queue empty AND no living members** (no
   early credit while trickling); `random-intersect` picks among the
   k overlapping placements of an N×N body at drip time. This
   supersedes the kickoff entry's "scatter is the working mechanism"
   line.

**The §77 rider (user-signed 2026-08-08): the RNG fork
re-architecture** — keyed stream derivation (child seed =
hash(rootSeed, stable name)) to kill the append-coupling class
outright. Decided at §77's kickoff; the one-time global remap rides
§77's ALREADY scheduled seed-stream break so the re-baseline is paid
once, not twice. Draw-count sensitivity within a stream (#49)
remains either way. Rider line added to ROADMAP §77's charter.

### 75a — camps config + layout seams (2026-08-08)

Landed to the cut. Notes beyond the cut line:

- Catalog form: bare array (the encounters.json symmetry — the 75i
  editor copies the encounter editor). TWO smoke defs ship
  (`bandit-squatters`, `ghoul-nest`) as test/editor content; no
  shipped layout lists a camp, so presence-gating holds (the
  campSpawns/camps fields exist on zero committed layouts).
- The combatant-only gate is FREE: `ArchetypeSchema` validates
  against `UNIT_DEFS` (the combatant view), so a neutral def id
  (`wall`) rejects at parse — pinned by test. Camp units are
  combatant defs on team 'neutral', per the kickoff audit.
- Both referential asserts live in camps.ts (import direction
  camps → layouts → (nothing), cycle-free): `assertCampRewardRefs`
  (the encounters sibling) + `assertLayoutCampRefs` (the layout-side
  campId resolution). Both args-injected + self-wired.
- Layout validation: camp spawns reuse the §37g spawn-region
  physically-occupiable rule (the same `spawnBlocked` set) +
  uniqueness; `campSpawns` present with an empty/absent `camps` list
  is a LOUD reject (75c never invents a fallback); duplicate campIds
  in the weighted list reject (weights on the same id are
  meaningless). Typo guards: count ≤ 8/entry, leash ≤ 16 — guards,
  not design knobs.
- The configHash cost came in BELOW the audit's worst case: the
  gauntlet fixture's hash assert is INTERNAL consistency (all traces
  same era), so `tests/gauntlet` stays green; only dev replay of
  pre-75a recorded traces refuses (the era contract working as
  designed). No re-baseline needed.
- +15 tests (camps loader 9 + layouts §75a block 6; 2436 → 2451
  main, hook-verified); typecheck clean.

### 75b — the World camp registry, v34→v35 (2026-08-08)

Landed to the cut. Notes beyond the cut line:

- `CampInstance` = `{ id, defId, anchor, hostileTo: Set<Team>,
  pending: CampPendingUnit[], killedBy }` in a `Map` on World (the
  spawnQueues shape). Leash radius + rewards are NOT copied onto the
  instance — they derive from `getCamp(defId)` at read time (the #114
  call-time rule), which is why `fromJSON` hard-rejects an
  unresolvable defId (the 74b bespoke-rejection posture) AND a member
  unit whose instance id isn't registered (a corrupt save would
  otherwise degrade to silently-passive camps).
- `installCamps` mirrors `installBattleRules`: at most once, empty =
  free no-op that stores NOTHING — including the campRng, which is
  the presence gate itself. A dedicated test pins the stream half:
  two same-seeded Worlds, one camp-aware, keep identical rng/combatRng
  states (no unconditional fork anywhere).
- Serialization determinism: instances serialize in ascending id
  order; `hostileTo` flattens in fixed QUEUE_TEAMS order (aggro
  ORDER never shapes the wire).
- `cloneForRollout` takes the third fork CONDITIONALLY, after
  rng/combatRng — pinned by a test that also proves the camp-free
  path's two-fork alignment is unchanged (the §69a fork-order
  contract).
- `isActiveNeutral` ships in Unit.ts with a STRUCTURAL parameter
  (`{team, campId}`) so snapshots qualify, not just live Units.
- The one hardcoded version assert (spawn-overflow) re-pinned 34→35;
  the stale v34 doc claims updated (rollout header/test,
  TrafficScriptDriver "then-v34", the battleRules describe title
  de-versioned).
- +12 tests (camps registry 6 + rollout camp arm 1 + roundtrip §75b
  block 5; 2451 → 2463 main, hook-verified); typecheck clean; 395
  fuzz:smoke green at the commit — the byte-identity gate holds with
  the registry live.

### 75c — the portal-drip spawn (2026-08-08)

Landed to the cut. Notes beyond the cut line:

- **`spawnCamps` rides `applyTerrain`**, so all four World construction
  sites (BattleScene / harness / replayTrace / spawnEncounter) get
  camps with ZERO per-site changes — the roll is battle-setup-time,
  which IS "resolved on turn start" under the world-per-turn fact.
- Stream derivation as planned: fresh parent off terrainSeed, BURN
  fork #1 (byte-identical to setupRngFor's stream by construction),
  take #2 as the camp stream; selection rolls consume it, then
  installCamps hands the advanced stream to the World for battle
  draws. `weightedCampRef` is a LOCAL pickWeighted twin (sim never
  runtime-imports run) with the #111 zero-draw singleton.
- `random-intersect` implemented for real: all fitting placements
  overlapping the spawn tile in a fixed dy/dx scan, uniform pick;
  singleton returns DRAW-FREE (#111 — pinned by an rng-state test),
  which makes the common 1×1 drip zero-cost on the camp stream. The
  optional `rng` param is the first randomness occupancy.ts has ever
  taken (documented at the site); >1-candidates-without-rng throws.
- The drain (`runCampDripScan`, the runOverflowScan sibling at the
  same tick slot): ascending instance id × per-camp FIFO × the fixed
  candidate scan; a blocked anchor just waits — the drip cadence IS
  the tile vacating, which is what makes 75f's vacate-≤N-ticks
  invariant load-bearing, exactly as the shape-lock argued.
- **The 75f landing note (written at spawnCampUnit):** behavior slot 0
  is `createMovementBehavior` FOR NOW — a camp bandit shares the
  enemy bandit's catalog def, so camp-ness cannot ride the
  `movementBehavior` catalog value; 75f replaces slot 0 in
  `spawnCampUnit` with `CampWanderBehavior`. Until 75d/75e widen
  targeting, dripped units stand idle (spawn mechanics are this
  step's whole surface). The cut's "'camp' enum value" line is
  RE-JUDGED down to this spawn-path override — the enum widening
  would only serve camp-exclusive archetypes, which don't exist.
- N×N drip ships exercised by occupancy unit tests only — no shipped
  COMBATANT def carries footprint > 1 (only rubble does); the first
  multi-tile camp body will exercise it live.
- No shipped layout lists a camp → the whole path is unit-test-only
  until §75j (the 74e seam-only posture; presence gate holds).
- +11 tests (random-intersect 5 + spawnCamps 3 + drip 3; 2463 → 2474
  main, hook-verified); 395 fuzz:smoke green — byte-identity holds
  with the drain in the tick loop.

### The 75d/75e widening worksheet (distilled from the kickoff census
### for the fresh session — line refs verified at the 2026-08-08 HEAD)

Every site gates on `isActiveNeutral` (Unit.ts) — active = fights,
inert = scenery. Line numbers predate the 75b/75c edits to World.ts
(shifted ~+150 there); grep the quoted predicates, don't trust raw
numbers.

**75d — spatial (this step):**

- [x] movement.ts:114 — vacancy ETA: active neutrals get one (they
  move); inert stay `undefined`.
- [x] movement.ts:121-126 — THE moving wall: active neutrals go to
  `otherUnitCells` (soft cost), inert stay `pathBlockers`; the
  `else if` must also let `excludeUnitId` exclude an active neutral
  (today it structurally can't). Docs at :53-55 + :208 update.
- [x] blockedAlly.ts:143-156 — `neutralCells()` topology walls:
  inert-only.
- [x] actingPosition.ts:66-69 — firing-cell BFS blockers: inert-only,
  IN LOCKSTEP with movement.ts:121 (the doc there demands it — the
  GP4/Qb#3 hold-vs-strike freeze class).
- [x] SupportMovementBehavior.ts:314-317 — the bespoke duplicate
  blocker build; :218 `snapToNavigable` via `neutralCells`.
- [x] bot/sensors.ts:289-298 `chokeCells` + :397-406 `armyMinCut` —
  active neutrals leave the static arena mask (bodies move; the doc
  says exactly this).
- [x] positioning.ts:120-126 `collectHalfCoverPositions` (+
  effects/propose.ts:97-106 inherits) — an active neutral must NOT
  grant half-cover (it has `blocksLineOfSight: true` anyway, but
  gate it explicitly; a future non-LOS camp def must not become
  mobile cover).
- [x] positioning.ts:105-111 `collectLosBlockers` + :211-215 inline
  twin — VERIFY-ONLY expected: camp units spawn `blocksLineOfSight:
  true` like every combatant, so including them is correct; confirm
  the combatant-body LOS path treats them consistently.
- [x] World.ts `applyTileStatuses` (`unit.team === 'neutral'`
  continue) — active neutrals catch fire / get healed.
- [x] tests/pathing/metrics.ts:62/216 — NO widening: `MetricTeam`
  stays player|enemy (camp motion deliberately unmeasured — spec).
  tests/pathing/fixtures.ts:63 still uses the retired 'environment'
  archetype (pre-existing cosmetic; fix in passing if touched).

**75e — combat (next step; hostility gates everything):**

- [x] Targeting.ts:35-37 `findTarget` root skip — admit active
  neutrals HOSTILE TO the seeker's team.
- [x] Targeting.ts:66-67 `updateTarget` neutral bail — an active
  neutral with a non-empty hostility set runs acquisition (targets
  only factions its camp is hostile to).
- [x] Targeting.ts:133-139 sticky validity · :251-260
  `nearestReachableHostile` · :570-600 `currentTarget` gate — same
  admit rule.
- [x] Targeting.ts:458-471 `findEngageableEnemy` + :484-504
  `findInRangeEnemy` — the two EASY-TO-MISS secondary scans
  (engage/hold/blind units).
- [x] Targeting.ts:198-231 rubble auto-target family — stays
  RUBBLE-ONLY (passive camps are not auto-attacked; that's the
  non-aggressive default).
- [x] Targeting.ts:306-314 `validDestructibleNeutralTarget` +
  :338-361 focus arms + :399-442 objective arms (incl. the :433
  hard-coded `=== 'enemy'`) — camp units become valid engage/focus
  objective targets (the click sources wire at 75h).
- [x] Targeting.ts:518-533 confused re-roll — design call: confused
  units may target active neutrals (chaos is chaos); decide at the
  step.
- [x] MovementBehavior.ts:322-334 `nearestEnemy` flee anchor —
  hostile camp members are threats.
- [x] positioning.ts:246-256 — the neutral-target bestEffort
  short-circuit: active neutrals get the REAL firing-cell/kite path
  (ranged units currently would charge them).
- [x] effects/targeting.ts:91-94 `isCombatTargetable` — active
  neutrals pass (AoE splash hits them; `affectsMatch`'s 'enemies'
  already includes neutrals).
- [x] World.recordDamage neutral drop (`if (target.team ===
  'neutral') return`) — active neutrals record (XP signed at the
  shape-lock); inert keep dropping.
- [x] Aggro: the `takeHit`/damage chokepoint — striking a camp
  member calls `markCampHostile(campId, attacker.team)` (AoE splash
  included, the signed intent).
- [x] Kill credit: the `kill` trigger (the only clean attribution
  site) + the DoT fallback (status `sourceUnitId`'s team) → set
  `killedBy` when pending EMPTY and no living members (drip-aware);
  stamp into the serialized campKills read (75g consumes).
- [x] checkBattleEnd — VERIFY neutral-only boards stay silent +
  camps never extend a battle (pin by test); the third alive-flag
  itself is 75g's.
- [x] main.ts:90 dev `applyStatus` neutral guard — widen for active
  (dev QoL, optional).
- [x] VERIFY-ONLY: stats.ts/archetypes.ts neutral defaults
  (damageStatFor / minRangeForArchetype) resolve correctly for camp
  units — they're COMBATANT archetypes, so the combatant path
  should already fire; pin one test.

**75h render/UI (parked list, same census):** spriteColor.ts:23-46
third-faction color+tint · BattleRenderer.ts:373-403 click
candidates + :485-501 neutral early-return (bloom/badge/fade) ·
UnitOverlayLayer.ts:170-178 + :405-414 (badge/hp-bar) ·
BattleScene.ts:142-149 death SFX · ObjectiveController.ts:134-165
(camp = attack target, not demolish) · HUD.ts:516-528 no-cards
(signed) · UnitCard.ts:134 · palette.ts:26/34 bloom comments ·
tests/fuzz/objectiveStrategy.ts:209 mirrors ObjectiveController.

### 75d — the spatial widening (2026-08-08)

Landed to the worksheet, all ten spatial boxes. The shape:

- **`isInertNeutral` (Unit.ts)** — the predicate the sites actually
  needed: the widening flips "is this a wall" tests from
  `team === 'neutral'` to inert-only, so the complement helper reads
  better at every site than a sprinkled `&& !isActiveNeutral(u)`.
- **The moving-wall fix (`buildMovementContext`)**: active neutrals →
  `otherUnitCells` (soft cost) + a REAL vacancy ETA; `excludeUnitId`
  can now exclude one (the else-if restructure the worksheet
  predicted); still in `occupied` (exclusion softens routing, never a
  collision check — #113 rule intact). Docs at the context interface
  + the intent's `excludeUnitId` updated.
- **The four lockstep blocker siblings** all flipped inert-only:
  `blockedAlly.neutralCells` (covers `snapToNavigable` for free),
  `nearestActingCell`'s BFS walls (lockstep comment now names
  `buildMovementContext` explicitly — the GP4/Qb#3 class), the
  healer's bespoke `stepToward` build, and the bot's
  `chokeCells`/`armyMinCut` masks (camp bodies move; choke is the
  arena's shape — their cells stay body-∞ in the min-cut, consistent
  with combatants).
- **Half-cover explicitly gated** (`collectHalfCoverPositions`
  inert-only; propose.ts inherits): today redundant (every camp
  archetype is a `blocksLineOfSight: true` combatant), pinned so a
  future non-LOS camp def can't become mobile cover.
- **LOS: active neutrals STAY occluders** (the census call, now
  documented at `collectLosBlockers`): camp bodies shadow cells
  behind them exactly as rubble; endpoints are never blockers, so a
  hostile camp member stays shootable. Verified consistent with the
  inline twin in `engagementDirective`.
- **`applyTileStatuses`** — inert-only skip: camp members catch
  fire / get healed like combatants (pinned both ways: wall on fire
  stays clean).
- `tests/pathing/metrics.ts` untouched per spec (camp motion
  deliberately unmeasured); fixtures.ts's retired-'environment'
  cosmetic left alone (file untouched).
- One vitest-vs-tsc catch (the AGENTS §pre-commit class): the
  half-cover pin mutated readonly `blocksLineOfSight` — esbuild
  accepted it, `tsc` rejected; structural cast in the test.
- +11 tests (`src/sim/camps.spatial.test.ts`: context 3 + topology
  4 + cover/LOS 2 + tiles 2; 2474 → 2485 main). 395 fuzz:smoke
  green — presence-gated byte-identity holds: with zero active
  neutrals every flipped predicate degenerates to the old
  `team === 'neutral'` read.

### 75e — the combat widening (2026-08-08)

All sixteen combat rows landed. The shape:

- **`hostileCandidate` (Targeting.ts, exported)** — THE shared admit rule
  the worksheet's scattered sites converged onto: combatant-vs-combatant
  unchanged; combatant-vs-active-neutral admitted only once the camp is
  hostile to the seeker's faction; an active-neutral seeker targets only
  factions its camp is hostile to; inert scenery never, either direction;
  camp-vs-camp structurally out. Applied at findTarget, the sticky
  validity, the rubble-overlay committed check, nearestReachableHostile,
  findEngageableEnemy, findInRangeEnemy (hold + blind inherit), and
  MovementBehavior's panic-flee anchor.
- **The updateTarget bail** widened: an active neutral with a non-empty
  hostility set runs the default sticky path (objectiveFor('neutral') is
  atWill, so no objective plumbing needed — the census's argument held).
- **Aggro + kill credit ride `dealDamage`** (ONE chokepoint → AoE splash
  and living-source DoT ticks covered for free): any faction damage to a
  camp member marks the whole camp hostile to that faction (the
  attacker-team guard keeps 'neutral' out of hostileTo); a lethal blow
  that leaves pending EMPTY and no living members stamps `killedBy` (the
  serialized read 75g's win-or-lose portion consumes). ACCEPTED EDGE: a
  dead-source DoT wipe has no recoverable team (units leave the index at
  reap) — `killedBy` stays null, deliberately.
- **XP-yes**: `recordDamage`'s neutral drop is now inert-only (the signed
  shape-lock call).
- **`currentTarget` honors any active-neutral commitment** regardless of
  hostility — commitments only arise from hostility-gated acquisition,
  the confusion re-roll, or a manual engage/focus order on a passive
  camp, and that ordered FIRST BLOW must land (it is what aggros the
  camp). Without this the 75h click-to-engage would deadlock at blow one.
- **`validDestructibleNeutralTarget` → `validNeutralObjectiveTarget`**:
  admits living active neutrals alongside destructible scenery (both
  focus + engage arms). The engage enemy-arm's hard-coded `=== 'enemy'`
  became team-relative (mirrors the focus arm; byte-identical for the
  player team — the latent player-only assumption the worksheet flagged).
- **Confusion design call, RECORDED: chaos is chaos** — active neutrals
  join the confusion pool regardless of hostility (a confused swing at a
  passive camp lands, and the landed hit aggros the camp — emergent,
  consistent with the chokepoint). One-line revert if the 75j feel pass
  disagrees.
- **The kite path**: positioning's neutral short-circuit is inert-only —
  a ranged unit runs the REAL firing-cell/kite protocol against a hostile
  camp member (exclusion + no bestEffort corner-charge; pinned).
- **`isCombatTargetable`** admits active neutrals (AoE splash + chain
  arcs hit camp bodies). Rubble auto-target family untouched (passive
  camps are not auto-attacked — the non-aggressive default holds).
- checkBattleEnd VERIFIED by pin, no code change: neutral-only boards
  silent; camps never extend a battle (the third alive-flag stays 75g's).
- main.ts dev sprayer: 'neutral' team filter reaches active neutrals.
- +13 tests (`src/sim/camps.combat.test.ts`: gating 4 + chokepoint 3 +
  kill stamp 2 + battle-end 2 + kite 1 + the live-fight
  stats/archetype-verify pin 1; 2485 → 2498 main). 395 fuzz:smoke green —
  presence-gated byte-identity holds through the whole targeting stack.

### 75f — CampWanderBehavior (2026-08-08)

The 75c landing note landed: `spawnCampUnit` behavior slot 0 is now
`CampWanderBehavior` ('camp' in the behavior registry — the re-judged
scope: a registry arm for snapshot rehydrate, NO catalog enum widening).

- **Two modes, one class**: `currentTarget` resolves an admissible mark
  (the 75e hostility gate) → wholesale DELEGATE to a stateless inner
  `MovementBehavior` — camps fight exactly like combatants, pursuit may
  leave the leash (it bounds idling, not retaliation; pinned). Passive →
  the leash-filtered wander: per eligible poll (free + move off cooldown
  + not status-rooted), roll `SIM.campWanderChance` (new knob,
  config/sim.json, 0.05 — feel-tuned at 75j) and take one uniform step
  among free unclaimed in-leash neighbors.
- **The vacate rule**: standing on the camp anchor skips the chance gate
  — the member steps off ASAP, which is what keeps the drip queue
  flowing (the exit invariant's mechanism).
- **Self-healing leash**: a member displaced beyond the leash
  (shove/knockback) gets a candidate set of strictly-anchor-closer
  neighbors — it walks itself back (pinned).
- **RNG discipline**: every draw rides `campRng`; draw shape = 1 chance
  roll (skipped on-anchor) + 1 pick (skipped for singletons, #111); the
  cooldown early-return keeps locked-out polls draw-free. Pinned
  structurally: 100 passive-wander ticks leave `rng` AND `combatRng`
  byte-untouched while `campRng` advances. The standing
  NO-RNG-IN-MOVEMENT doctrine is faction-pathing scoped; camp idle
  wander on its own presence-gated stream is the kickoff shape-lock's
  signed exception (the cut line names campRng).
- **Support-archetype camp members deliberately get the charger
  delegate** (doc'd at the class): the healer protocol trails a faction
  army and heals team-mates — 'neutral' team-mates include WALLS — so
  camp content ships charger-only until a camp healer is a real design
  want.
- Wander steps are single-cell; a multi-tile camp body pays the
  footprint-aware scan when one ships (the 75c N×N note).
- **THE TWO EXIT INVARIANTS are standing tests**
  (CampWanderBehavior.test.ts): leash-bound over 400 ticks with a
  liveness floor (config-derived leash, never hardcoded) · spawn vacated
  within `SPAWN.durationTicks + 2×moveCooldown + 4` (derived bound, both
  members materialize). Plus same-seed wander identity + the hostile
  delegate pin (damage lands, leash released).
- +8 tests (2498 → 2506 main); 395 fuzz:smoke green (the wander is
  presence-gated behind camp existence — camp-free byte-identity holds).

### 75g — run economy (2026-08-08)

All three cut items landed. NO RunSnapshot bump, as predicted at the
kickoff: camp portions are existing RewardPortion kinds, `campKills` is
event-payload-only, and the enemy-pull order rides the already-serialized
command queue + hostility set.

- **`campKills` → `battle:ended`**: emitBattleEnded collects the stamped
  `killedBy` camps (stable id order) and OMITS the field when empty —
  camp-free payloads stay byte-identical. Pinned: wiped camp rides the
  payload; un-wiped (member alive or pending) contributes nothing;
  camp-free omits.
- **The portion branch** (handleTurnEnded, inside `result !== 'lost'`,
  after the tally, before the `won` roll — exactly the cut's slot):
  player-killed camps roll their def's reward refs through `rollRewards`
  on the two EXISTING reward streams (no new fork — camp-free turns draw
  nothing). Win-or-lose per the shape-lock (a drawn/lost BATTLE still
  pays; only the run-terminal `result === 'lost'` skips, the XP-bank
  rule — all four pinned). Enemy-killed camps pay nothing.
- **`blockCampTurnEnd`** (SIM knob, default false): when ON, a decisive
  end is HELD while the would-be winner has an uncleared hostile camp;
  the extracted `campCleared` (drip-aware — shared by the kill stamp,
  this gate, and the objective revert) decides. Checked at the decisive
  emit rather than accumulated in the alive-flag loop — the loop's
  early-return would truncate a mid-loop scan (the cut's hoist concern,
  resolved by not scanning in the loop at all); the mutual-wipe draw
  and the turn cap stay unblocked, so battles stay bounded. Pinned both
  ways (held-then-lands · loser's camp never holds the winner hostage).
- **`enemyPullChance`** (SIM knob, default 0 = DORMANT): rolls on a LAZY
  third fork off spawnCamps' terrainSeed parent, taken ONLY inside the
  knob>0 branch — the dormant path appends nothing (the shape-lock's
  no-append clause). A pass pre-marks one camp (uniform pick, #111
  singleton draw-free) hostile to 'enemy' and enqueues a
  `setObjective enemy engage{tile: anchor}` command (drains tick 1;
  serialized → resume-safe). The camp-anchor tile is the ONE exception
  to the J1 engage-tile persist rule: `clearResolvedObjectives` reverts
  it once that camp is cleared (no corpse-pile guarding). Pinned:
  dormant-at-0 · live-at-1 marks + orders · auto-revert on clear.
  DEFERRED deliberately: the spec's optional per-encounter override —
  adding the schema field without encounter-editor formatter support
  would break the no-op-save proof; it lands with 75j's tuning if the
  feel verdict wants it.
- +12 tests (economy sim 8: payload 3 + block 2 + pull 3 · Run-side 4;
  2506 → 2518 main); 395 fuzz:smoke green — camp-free byte-identity
  holds through the payload, the gate, and the dormant seam.

### 75h — the renderer/HUD third faction (2026-08-08)

All nine parked-list rows landed, plus one browser-caught sim fix.

- **TERMINAL_AMBER is the third-faction color** (spriteColor.ts): an
  active neutral paints amber — the warm "alive but not yours" lane
  between player green and enemy red, otherwise unused on battle
  sprites; a camp bandit shares the enemy bandit's glyph, so the color
  IS the tell (the §40c argument). One color passive AND hostile in v1
  (a 75j split candidate). Structural param gains `campId`; the
  headless color test extends (+1).
- **BattleRenderer**: the spawn-time neutral early-return is inert-only
  — camp members take the full combatant path: natural bloom (0.15
  idle, verified in-browser via the instanced aColor/aBloomIntensity
  attributes: camp (255,111,0) linear ≡ #FFB000, rubble stays bloom-0),
  the level-badge + HP-bar overlay, and the mid-battle fade-in — the
  drip's `instant:false` makes portal materialization FREE.
  `destructibleBillboards` admits camp members (click surface).
- **`unit:died` payload gains `campId`** (the dead unit is already
  spliced out — no lookup possible): BattleScene's death SFX plays for
  camp members, stays silent for crumbling scenery. Four payload-pinning
  tests updated.
- **ObjectiveController** widens its cell-fallback neutral list (camp =
  a fight to pick, not an obstacle to demolish); the HUD/UnitCard
  no-cards gates stay by team — now COMMENTED as the signed v1 call so
  nobody "fixes" them; palette bloom comments re-scoped inert-only;
  objectiveStrategy documents its DELIBERATE divergence (bot
  camp-seeking stays out — the §83 probe arm, per the scope guard).
- **THE BROWSER-CAUGHT BUG**: `clearResolvedObjectives`' neutral arm
  still demanded `isDestructibleNeutral`, so a click-to-engage order on
  a camp member REVERTED THE SAME TICK it landed — the 75e first-blow
  guarantee was unreachable through the real objective path (the
  headless 75e tests exercised `currentTarget` directly and couldn't
  see it). Fixed to mirror `validNeutralObjectiveTarget`; pinned
  headlessly (+1: order holds while the member lives, reverts on its
  death). Exactly what this step's browser gate is for.
- **Browser-verified end to end** (dev-preview, a TEMPORARY river-layout
  camp reverted before commit; throttled-tab manual tick driving per the
  HANDOFF tips): character select → boon → battle → both members DRIP
  onto the anchor and wander the leash → the engage order holds → the
  march aggros the camp (hostile at tick 316) → ordered target dies →
  objective auto-reverts → camp wiped by a player blow → `battle:ended`
  carries `campKills` → the turn offer holds the camp's rolled loot (a
  shield packet). Zero console errors. Screenshot unavailable (pane not
  compositing — the known throttle); the color proof came from the
  instanced attributes instead, which is STRONGER than a JPEG.
- NATIVE EYEBALL (the user's half): temp-add to river in layouts.json —
  `"campSpawns": [{"x": 9, "y": 9}], "camps": [{"campId":
  "bandit-squatters"}]` — then `?layout=river`. Looking for: amber
  bandits materializing + wandering, badge/HP overlays, bloom parity,
  death cry on camp kills, click-to-engage feel.
- +2 tests (2518 → 2520 main); 395 fuzz:smoke green.

### 75h2 — the setup-time camp prime (2026-08-09, user feedback)

The 75h native eyeball's one finding: the first camp member arrived a
drip-tick late and faded in, so it wasn't targetable during the
pre-battle countdown — unlike the initial teams, which spawn at setup.

- Fix: `World.primeCampSpawns()` — each camp's HEAD-OF-QUEUE member
  materializes at battle setup, INSTANT (no SpawnAction lockout, no
  fade, `unit:spawned{instant:true}`), standing on its anchor. Called
  by `spawnCamps` right after `installCamps`, so all four World
  construction sites inherit it. The tail keeps the signed PORTAL DRIP
  untouched (they couldn't fit anyway — overlap is why the queue
  exists); the drip drain and the prime share one body
  (`dripCampMember(camp, instant)`), so placement determinism is
  literally the same code. Draw-order: the prime's N×N placement draws
  sit exactly where the first drip tick's used to, one tick earlier.
- A blocked anchor at setup skips silently (pending intact — the
  existing blocked-anchor pin covers it); the primed member wanders
  off the anchor from tick 1 (no lockout), so the vacate invariant
  bound only tightens.
- The §75c pins reshaped to the new contract: primed-at-setup
  (instant, no lockout, on-anchor) + second-member-drips (lockout +
  fade). Browser-verified live at TICK 0: primed alpha 1 +
  click-targetable during the countdown window; member two arrives
  alpha 0.05 mid-fade with the `spawn` lockout. Zero console errors.
- Session note: the suite briefly went red on `formatLayoutsJson`
  verbatim — the USER's own temp river-camp edit (the eyeball recipe)
  was still in the tree; reverted, as the recipe instructs.
- +1 test net (2520 → 2521 main); 395 fuzz:smoke green (the prime is
  presence-gated like everything else).

### 75i — the editors (2026-08-09)

Landed to the cut in three commits (`bde0cc4` the formatter, `9770531`
the layout-editor camps layer, `2075c7a` the camp editor). Notes beyond
the cut lines:

- **camps.json normalized once** at the formatter landing: the 75a
  file carried prettier-style fits-on-one-line array collapsing
  (single-element `units`/`rewards` inline, multi-element expanded),
  which a deterministic formatter can't reproduce cleanly — normalized
  to the encounters convention (arrays always expand, leaf entries
  inline). Whitespace-only: `configHash` stringifies the PARSED value
  (checked before deciding), so the trace era is untouched — no 75a-
  style re-baseline. fuzz:smoke 395 green on the commit confirms.
- The layout editor grew a fourth LAYER (not a neutral sub-tool):
  camp spawns are click-once list entities (the rubble model) and the
  weighted `camps` list panel rides the layer the way the region panel
  rides spawn-regions. The brush refuses cells a unit can't occupy;
  the buried-spawn case (blocker painted over an existing spawn) is a
  validation error instead. Resize clips out-of-bounds spawn tiles but
  keeps the camps LIST (it references the catalog, not cells).
- The camp editor runs BOTH 75a boot asserts live (the event-editor
  posture): `assertLayoutCampRefs` fed the committed LAYOUTS means
  renaming/deleting a camp a shipped layout references blocks Save —
  the brick-the-next-boot case the asserts exist for.
- The editor keeps the encounter editor's ≥1-camp floor even though
  `CampsSchema` legalizes an empty catalog (the form assumes an active
  tab); the delete-guard message points at hand-editing to `[]`. A
  deliberate UI-simplicity tradeoff, noted in the README.
- **Both live no-op-save proofs done in the browser** (the V2
  precedent): camp editor Revert→Save → the verbatim pin re-run green
  against the written file; layout editor load `rubbleQuarry` →
  Save (overwrite confirmed at 9:35 AM) → `git diff --quiet
  config/layouts.json` IDENTICAL to HEAD.
- Fuzz byte-identity holds through 75i by construction: everything
  here is `tools/` + tests except the camps.json whitespace
  normalization (parsed-identical). +7 tests (2521 → 2528 main).

### 75i-post — camp identity is per-encounter, punted (2026-08-09)

The user's post-75i playtest (camps hand-added to labyrinth, two corner
tiles at 13,13 + 1,1, both camps weight-1 — a good 75j starting
placement) surfaced: both tiles rolled ghoul-nest three turns running.
Diagnosis, confirm-the-deficit style, before any mechanism story:

- `weightedCampRef` is CLEAN (`?? 1` defaults, correct cumulative
  walk). The actual cause is one level up: the camp stream seeds off
  `encounter.terrainSeed`, and K3.5 made that PER-ENCOUNTER (rolled
  once in `buildEncounterMap`; every `beginTurn` reuses it — it's what
  keeps walls stable across turns). So the per-turn `spawnCamps` call
  replays byte-identical draws: the spec's "re-rolls fresh at every
  turn start" (kickoff cut line) silently degraded to per-encounter
  identity. The kickoff audit picked terrainSeed for its genuine
  zero-re-baseline virtue and missed that it's a per-encounter
  constant. Observed probability corrected: one fair 1/4 roll (turn
  1), then deterministic replays — not 1/64.
- **User call: PUNT (leave as-is), 2026-08-09.** Rationale: (a) the
  feel verdict needs play time, and 75j's feel pass is its natural
  slot (now a third decision point there); (b) if per-turn wins, §77's
  keyed-stream rider implements it as `hash(root, 'campSetup', turn)`
  — doing an ad-hoc seed mix now would pay the derivation twice. A
  defensible design reading also exists for the shipped behavior: the
  camp is battlefield furniture, and the battlefield is deliberately
  per-encounter stable since K3.5.
- Landing notes: the ⚠ block at `spawnCamps`' stream-derivation
  docstring (battleSetup.ts — "don't fix the seed here ad hoc"), the
  spec §Camps bullet annotated, ROADMAP §75 decision points + 75j cut
  + §77 rider each carry the line. The playtest layout edit reverted
  (user-asked); shipped content stays camp-free until 75j.

### 75j — the design round + content drop (2026-08-09)

The catalog/placement proposal went through one veto cycle before
signing; the content landed as `a299b77`. The decision trail:

- **User veto: no daemon or unit drops from always-on camps** (the
  proposal's banshee-barrow daemon-cache @0.35 + slaver-pen
  hostage-rescue @1). The generalized rule, distilled together and
  **user-signed — THE CONTINUOUS-VALUE RULE**: camps respawn every
  turn of an encounter (the no-cross-turn-state call), so any camp
  reward repeats N× per fight; bits/packets survive that (continuous
  value, self-taxing — farming costs unit-time under the cap while
  the pool war runs) but discrete-permanent drops (units, daemons,
  poolHealth) are step-function value with no diminishing cost —
  "roll quarry, walk out with 3+ healers." **Always-on camps pay
  continuous value only; discrete-permanent drops belong to one-shot
  contexts.** The low-odds alternative (~10%) was considered and
  rejected: unfeelable in playtest AND still farmable in expectation.
- **The slaver-pen concept is archived, not dead**: the first
  event-encounter camp (event → start-encounter → an encounter whose
  fit-filter names a dedicated camp layout; fires once via the §74
  no-repeat default, so hostage-rescue @1 is safe there). Open wiring
  question for whoever builds it: can an encounter fit-filter reach a
  layout deliberately absent from every sector pool? Verify then.
- **The level fork (per-act variants vs a level budget) is DEFERRED
  to §83 with data**: v1 camps are act-agnostic (both sectors pool
  the same layouts; the weighted list is per-layout), so L1–2 camps
  will read trivial in The Deep End. Measured by §83's board + camp
  probe before any mechanism signs — my recorded lean: a camp-side
  level budget reusing the wave-resolver vocabulary over catalog
  variant pairs, IF the deficit is real.
- The shipped catalog: bandit-squatters + ghoul-nest unchanged ·
  toll-post (bandit L2 + 2× archer — the ranged camp; ignoring the
  pocket stops being free) · frost-coven (2× ice_mage L2 + shaman) ·
  banshee-barrow (banshee L2 + 2× ghoul L2; bits-large @1 +
  bits-small @1 — the richest continuous payer, no new tables).
- Placements (ASCII-rendered before picking; all schema-validated):
  labyrinth (13,13)+(1,1) the playtested corners, list squatters w2 /
  nest / toll-post · fetidPond (13,1) the bottom-right floor pocket —
  mud anchors were rejected (idle wander in mud = slow self-poison) ·
  icebergs (2,8) ON the left iceberg (an ice cell) · rubbleQuarry
  (9,4) the pit slot between heaps (rubble auto-break lets the camp
  dig out). Conservative 4-of-11 so camps read as discoveries.
- **`enemyPullChance` ships at the 0.15 trial** for the feel pass.
  Fallout: the dormant-path pin now INJECTS 0 (was asserting the
  shipped default), and the same-day class audit (twice-bitten rule)
  converted every hardcoded knob restore in camps.economy.test.ts to
  captured originals — under `isolate:false` a hardcoded restore
  leaks the wrong knob into later tests.
- Both files were written through the REAL formatters by a scratch
  tsx script (schema + boot asserts pre-validated; deleted after) —
  the verbatim pins held by construction, zero hand-edited JSON.
- 2528 main + 395 fuzz:smoke green on the live content. **Still open
  in 75j: the user's native feel pass (the three verdicts) → THEN the
  board re-pin on final knob values** (ordering deliberate — verdicts
  first so the box board bakes the signed numbers once).

### 75j-verdicts — the feel pass signs (2026-08-09, `c998614`)

All three decision points resolved at the user's native playtest:

1. **`enemyPullChance` 0.25** (from the 0.15 trial — "works, but it
   feels too rare").
2. **`blockCampTurnEnd` TRUE** — the spec's original lean ("hostile
   camps do not block turn end") resolved the OTHER way, exactly via
   the seam the spec's least-sure note asked for: with no fine-grained
   disengage control, the last enemy dying mid-camp-fight ends the
   battle out from under a half-fought camp — bad feel, not mercy.
   Spec bullet annotated ✅-resolved-the-other-way.
3. **Camp identity: PER-ENCOUNTER STAYS** ("that's looking good") —
   the §75i-post punt resolves as signed design; the §77 keyed-stream
   switch is dormant unless reopened. Wander cadence also approved.
- **The verdict question that caught a real bug**: "does wander scale
  to tick rate?" — NO, it didn't: the chance rolled per TICK while
  off cooldown (a failed roll sets no cooldown → re-poll next tick),
  so TICK_RATE re-tuned idle fidget rate — a gotcha-#6-class
  violation. Re-authored `campWanderChancePerSecond` (0.64 ≡ the old
  0.05/tick @20Hz, feel-preserving) with the per-tick threshold
  derived at load: `1 − (1−p)^(1/TICK_RATE)`.
- Fallout: the two OFF-behavior pins (§75e never-extends + the
  economy no-stamp case) now inject `blockCampTurnEnd=false` with
  captured-original restores — the same class the 75j-1 audit closed.
- **Still open in 75j**: the user's manual placement-symmetry pass
  (their call: "some are too asymmetric") → THEN the box board
  re-pin (locations move trajectories, so the pass goes first).
  Procedural-map camp support ("Uncharted Ground") deliberately NOT
  in §75 — proposed as its own catch-up phase (with the §37
  terrain-type backlog); APPROVED + numbered §81 (the old §81 → §82;
  see the §75j2 entry).

### 75j2 — the pull re-authored + the per-turn seed + the §81 insertion (2026-08-09)

The user's post-placement playtest ("the fetidPond camp is sometimes
hostile to the enemy from the start — bug?") decomposed into a
misread feature AND a real bug, then a design re-author (`0a7ae8c`):

- **The probe** (800 synthetic encounters): start-hostility at 24.1%
  ≈ the 0.25 knob — the pull working as shipped. But 0/800
  within-encounter disagreements across worldSeeds — the pull's lazy
  fork rode the per-ENCOUNTER terrainSeed parent, replaying
  identically every turn: the §75i-post replay class again,
  contradicting shape-lock #3's signed per-turn fork. At 0.25 that
  meant 25% of encounters enemy-beelined the camp EVERY turn.
- **The re-author (the user's original intent, disruption read LOW)**:
  the pull is now the first consumer of the enemy objective system —
  `engage{neutral}` on the pulled camp's PRIMED member, riding the
  ordered-first-blow + dead-target-revert rails the player's
  click-to-engage already pinned. NO pre-marked hostility: damage
  keeps its place as hostility's single source, so a pulled camp
  reads passive until actually struck, then aggros camp-wide and the
  fight cascades. Blocked-anchor edge (no primed member) skips the
  pull. The `clearResolvedObjectives` camp-anchor TILE exception
  stays (the player tile-engage path can still hit it).
- **The seed fix**: the pull rolls on a lazy RNG seeded
  `mix(terrainSeed, worldSeed)` — per-turn, no ladder append, no
  burn needed (no other stream uses the mixed seed). `spawnCamps`
  gains `worldSeed` via `applyTerrain` (all four construction sites
  free). Camp IDENTITY stays per-encounter on the terrainSeed parent
  — the signed verdict, untouched. `mixSeeds` is a LOCAL one-off;
  §77's keyed-stream re-architecture generalizes the shape.
- Pins: live-at-1 reshaped (ordered engage + NO pre-hostility) · the
  revert test moved to the standard dead-target rule · NEW
  self-healing scan pin (worldSeeds disagree — the replay
  regression). 2529 main + 395 fuzz:smoke green.
- **The §81 insertion (user-approved)**: procedural parity
  ("Uncharted Ground" — the §37 terrain tiles in gen + per-theme
  camp pools) is the new §81, before the closing rebalance, which
  renumbers §81→§82 — the user's call: `<phase><letter>` is the STEP
  convention, so no "80b" phase names. Every live-doc forward ref
  swept (ROADMAP · HANDOFF · TODO · this file · the agent memory);
  archives untouched.

### 75j-close — placements done, a latent freeze caught, the 75k insertion (2026-08-09)

- **The user's placement-symmetry pass landed (`4ae697d`)**: fetidPond's
  camp moved INTO the pond (7,7 — a water cell, passable); rubbleQuarry's
  moved to (13,6) behind a NEW rubble block at (13,8) — a
  destructible-gated enclosure; labyrinth + icebergs held. Editor-written,
  formatter pin green.
- **The enclosure exposed a latent bug — the NEW 75k**: a melee unit
  whose `engage{neutral}` objective sits behind destructible rubble
  FREEZES ("as if unreachable") instead of auto-breaking through.
  Latent, not 75j2-caused: the player's click-to-engage issues the same
  ordered objective, so it almost certainly shares the path — the 75j2
  pull just made an AI team exercise it every pulled turn. The process
  read: a new consumer of an old seam walked the seam's untested branch.
- **Suspect seams for the fresh session** (recorded, NOT yet
  investigated — repro first, the layout-deadlock.test.ts pattern):
  the ordered-first-blow branch of `currentTarget` (Targeting.ts) holds
  the ordered mark while `MovementBehavior`'s path to it comes back
  empty/unreachable → no proposal → freeze; the rubble AUTO-BREAK
  fallback (`applyRubbleAutoTarget` — the §40 "walled-off unit
  auto-chips through" rule + `layoutConnectivity`'s rubble-is-passable
  classification) likely lives only on the atWill acquisition path, so
  the ordered branch never reaches it. Repro shape: enemy melee +
  `engage{neutral, campMember}` + a rubble ring around the camp →
  expect an auto-target-rubble (or path-through-rubble) proposal,
  observe the freeze.
- **The relabel (user-signed)**: 75j CLOSES here; the fix INSERTS as
  75k; the old 75k (docs close) → 75l and inherits the board re-pin —
  moved out of 75j deliberately: the 75k sim fix moves camp-layout
  trajectories, so pinning before it would pay the box twice (the
  "verdicts first, board once" logic applied again).

### 75k — the ordered-engage rubble auto-break (2026-08-09)

- **Repro-first paid again**: the recorded suspect seams both confirmed
  in one headless read (~1.6s vs the C1d browser-poll hour). The freeze
  = two cooperating layers: the ordered PURSUE branches
  (`updateObjectiveTarget` step 3 + `updateFocusTarget`'s enemy/neutral
  commits) re-commit the unreachable mark every tick, and the §40b
  rubble overlay (`applyRubbleAutoTarget`) rides ONLY the atWill
  acquisition path (`updateTargetDefault`) — so `currentTarget` kept
  honoring the mark, movement's path came back empty, and no proposal
  ever landed.
- **The fix (`db53957`)**: `applyOrderedRubbleFallback` — the overlay's
  sibling for the ordered paths, called from all three pursue-commit
  sites. An unreachable MOBILE ordered mark (enemy or active neutral)
  redirects onto the nearest approachable auto-target rubble; the
  per-tick re-commit resumes the order the moment the breach opens.
  Two deliberate omissions vs the overlay: NO reachable-hostile
  re-rank (engage steps 1–2 already own preemption; focus preempts
  nothing by design), and an INERT committed neutral is skipped — a
  deliberate far-rubble focus must not re-rank onto a nearer one
  (guard pinned by test). **The class closed in one pass** (the
  twice-bitten doctrine pre-empted): engage{enemy}, engage{neutral},
  focus{enemy}, focus{neutral} all get the fallback; the tile branches
  were already bestEffort (J3).
- **Pins** ([Targeting.orderedRubble.test.ts](src/sim/Targeting.orderedRubble.test.ts)):
  the redirect on both ordered modes, the inert-focus guard, and the
  full chip→breach→ordered-first-blow→camp-aggro loop under real ticks
  on BOTH arms (player click-to-engage + the §75j2 pull's enemy-team
  rails). Control-probed: 4/5 fail at pre-fix HEAD, 5/5 green after.
  2534 main + 395 fuzz:smoke green.
- **Two harness learnings** (recorded for the next fixture author): a
  bare `world.spawnUnit` template carries NO behaviors/abilities —
  the first integration run "reproduced" the freeze with an attacker
  that couldn't act at all (the probe caught it; battleSetup or the
  rubbleAutoTarget.test.ts equip idiom is the fix). And a ONE-faction
  board ends decisively at tick 1 even with `blockCampTurnEnd` ON —
  `hasUnclearedHostileCamp` gates on HOSTILE, and a pulled camp is
  passive until the first blow — so camp fixtures park an opposing
  `hold` dummy to keep the battle open (real encounters always field
  both factions).
- **Scope note**: `canReach` counts "within attackRange" as reachable
  regardless of LOS (inherited overlay semantics) — an ordered ARCHER
  LOS-blocked at range still holds its mark, exactly as atWill does.
  Not part of the freeze class (melee-shaped); left alone.
- **Residual**: the rubbleQuarry re-eyeball (the pull now breaking
  through the 13,8 gate in the native browser) — the user's check,
  pending at this entry.

### 75k2 — the route-aware gate pick (2026-08-09)

- **The live catch (user, labyrinth)**: spawned SE, ordered onto the
  NE camp; the pulled lone adventurer (guarded-adventurer wave 3)
  destroyed the SW camp's gate, then walked off toward the player
  units. Diagnosis from the layout: BOTH labyrinth camps are
  rubble-gated by design ((13,13) gated by (14,11); (1,1) by (0,3)),
  and the enemy spawn corner sits nearly atop the SW gate — so a pull
  to the NE camp met 75k's `nearestApproachableRubble`, which is
  PATH-BLIND (nearest approachable rubble anywhere on the board, not
  a rubble gating the route), chipped the wrong gate, then walked NE
  at the next gate/breach and leash-preempted onto the player. atWill
  ruled out: the §40b overlay chips only when NO hostile is reachable,
  and the player was reachable the whole battle — a rubble-chipping
  enemy is the signature of the ordered path.
- **The fix (`4523cc2`)**: `routeGateRubble` — ONE A* over the
  PERMEABLE graph (the unit's real movement context, auto-target
  rubble lifted from the hard blockers, body cells priced at
  `RUBBLE_ROUTE_CHIP_COST` 25); the FIRST rubble body cell along the
  route names the gate. The premium is a tiebreak BETWEEN gated routes
  (every candidate route crosses ≥1 rubble — a rubble-free route would
  have made `canReach` true), sized to dominate the +4-class soft-cell
  penalties; a code constant, not a sim.json dial. Per-tick re-probe
  ⇒ a sequentially-gated corridor resolves gate by gate (the user's
  double-gate question — falls out structurally, pinned). A null probe
  now HOLDS the ordered mark and idles — two honest cases 75k chipped
  futilely: wall-sealed (genuinely unreachable) and body-blocked
  (transient; queueing resolves it).
- **Scope**: the ordered fallback is the only consumer rewired; the
  atWill overlay keeps its signed §40b nearest-pick (same latent
  flaw, but its no-hostile-reachable trigger makes it ~unobservable
  — noted, deliberately left).
- **Cost**: ≤2 A* per walled-off ordered unit-tick (`canReach` + the
  probe) — CHEAPER than 75k's per-candidate approach probes on a
  multi-rubble board.
- **Pins** (Targeting.orderedRubble.test.ts §75k2): the wrong-gate
  discriminator (decoy nearer than the gate) · the double-gate
  corridor chip-through under real ticks · the sealed-target
  mark-hold · 2×2 body-cell resolution. Control-probed against
  75k-only code: the two discriminators fail there; double-gate and
  2×2 passed there by GEOMETRIC ACCIDENT (nearest happened to be
  right) and now guard the class. 2538 main + 395 fuzz:smoke green.
- **Residual**: the native-browser re-eyeball now covers BOTH boards —
  rubbleQuarry (the pull breaking the 13,8 gate) and labyrinth (a
  pulled enemy walking to the CORRECT camp's gate) — the user's check.
- **✅ BOTH re-eyeballs USER-SIGNED same-day** ("that got it") — 75k +
  75k2 close together; the auto-break + route-aware gate pick are the
  shipped behavior.

### 75l — docs close + the box board re-pin (2026-08-09)

- **Docs close landed**: ARCHITECTURE (the camp registry / spawnCamps
  + pull / CampWanderBehavior / camps.ts+json / camp-editor + the
  layout-editor camps layer / the Targeting §75e+§75k lines / the
  battle:ended.campKills + unit:died.campId catalog rows) · DESIGN
  (§Camps — the five signed pillars: passive-until-struck ·
  tactical-wager · ⭐ continuous-value · the pull · per-encounter
  identity; the blockCampTurnEnd win-condition nuance) · GOTCHAS
  **#122** (the null-probe idle is designed — don't re-litigate it
  into nearest-rubble chipping) + **#123** (camp fixtures: both
  factions + equipped units, the twin 75k fake-repro traps) · ROADMAP
  §75 demoted to the stub.
- **The board re-pin**: the full 15-instrument §72f board (10 arb
  primaries + 5 doctrine controls) re-run on the box at the §75-close
  HEAD — the SCHEDULED content re-pin (camps + placements + the pull
  moved trajectories; deferred from 75j past the 75k sim fixes so the
  box is paid once). Procedure per §72a/72c precedent: push → box up →
  sequential box-batch walk → fetch all 15 → local `--report` →
  numbers to BALANCE → box down.
- **The walk landed clean (overnight 2026-08-10): 15/15 fetched,
  0 FAIL / 9 WARN** — the first board carrying §74 events AND §75
  camps (nothing ran between the 72f signing and this). Under the
  user's overnight authorization, the WARN pattern earned a
  decomposition round: a new `--set=group.key=value` fuzz override
  (`577954e` — sim joined the sweep knob registry; local 2-seed
  pairing probes first, the 72a discipline) + the existing
  `--event-chance=0` control arm → 8 paired ablation arms on box #2
  (both boxes serial, both destroyed same-night). **The full numbers +
  the decomposition table are BALANCE 2026-08-10 (canonical).** The
  three findings that matter: ⭐ the below-band walk WALLS are
  PULL-SOFTENED (walk-regen wall 0.267 with the pull → 0.533 without —
  the pull fires on boss boards and diverts the boss-side wave off the
  pool; "should it?" is a NAMED §83 question, deliberately NOT
  answered by re-dosing overnight) · the pull's win lift scales with
  fight length (0 soldier act-1 / +15 priest act-1 / +10 both walks)
  while events add ~+10 everywhere by node dilution + boons (the
  priest +20 WARN decomposes into both) · the fire-channel INVERSION
  (+0.125→−0.075) is the one unexplained WARN — doctrine-pair-only,
  candidate mechanisms recorded, open for the signing session.
  Signing-session queue distilled: act-1 ref re-pins at the observed
  §74/§75-era values · the boss-board pull question (± re-bracketing
  the deep-end dose) · the fire-channel read · the walk-regen reach
  dip (0.375, its events residual is a −0.10 drag) · the widened
  55pre ceiling watch (+0.225). No signed number was touched
  overnight (the standing rule).
- **§75 CLOSES with this entry** — all exit criteria met (playable ✓
  user-signed feel ✓ the two headless invariants ✓ camp-free
  byte-identity held every step ✓ verdicts recorded ✓) + the docs
  close + the board re-pinned at content reality.
- **The morning signings (2026-08-10, user)**: the boss-board pull →
  §83 (tentative lean NO-pull-on-boss, on final data) · the
  fire-channel read → §83, reassured by the paired flip analysis
  (5–2 discordant, p≈0.23 — collapsed-to-≈0, not reliably negative;
  the arb per-item Δ|picked stays positive) · ⭑ the SHEET AMENDMENT
  signed: act-1 win refs + forced-boss refs re-pin at the 75l
  observed values, walk bands + fire-channel HOLD (§83 owns them).
  Post-amendment board: **0 FAIL / 7 WARN, all pre-registered** —
  §76 opens against a clean §74/§75-era baseline. Detail: BALANCE
  2026-08-10 (the amendment paragraph) + ROADMAP §83 riders.

## Phase 76 — Unit mechanics & stat identity

### Kickoff code-reality audit (2026-08-10)

Three-surface audit (aura engine · stat feel · promotion/archetype/
board), run fresh against HEAD `c9c29f1`. The 2026-08-05 spec-audit
facts held up well; corrections below. The cut derives from these
findings; shape-lock pending.

**Aura surface (the locked shape survives; five sharp edges found):**

- `applyAuraStatuses()` slots between `applyPeriodicEffects` and
  `applyTileStatuses` (World.ts:1439→1447) — after `runCampDripScan`,
  so a just-dripped camp member is in-aura the same tick. Camps did
  NOT land as tick passes (wander = a slot-0 behavior; hostility =
  the damage chokepoint) — the aura pass is only the SECOND non-tile
  non-effect pass, not one of many.
- `sustainTileStatus` (World.ts:1669) is reusable but its top-up
  branch is policy-blind: it mutates `lifetime` directly, bypassing
  merge policy AND the susceptibility gate, and hardcodes
  `sourceUnitId: null` / `magnitude: 1`. "Non-stacking falls out of
  merge:refresh" is true only for the FIRST application — pin
  no-stack with a test, don't trust the merge table. No caster
  attribution without extending it (fine for v1 stat auras).
- ⚠ Selector hazard: an `aoe anchor:'caster'` aura def would inflate
  `derived.attackRange` to the aura radius (`rangeForArchetype`,
  archetypes.ts:43-56) and strand the caster out of engagement — the
  N1 dash hazard again. Aura-only defs author `target:'self'`
  (already excluded) + the pass reads `aura.radius` directly;
  `proposeSelfAbility` needs a skip arm (an op-less self def
  currently falls into `proposeSelfMove` and would break).
- Four blast-radius items the spec missed: `assertStatusRefsResolve`
  walks only `def.effects`+`chain.ops` — needs a third arm for
  `aura.statusId` (else a typo fails at runtime, not boot) ·
  `tools/attack-editor/format.ts` is a hand-written emitter that
  would SILENTLY DROP an `aura` field on every Save (the round-trip
  test catches it — add the arm in the same commit as the schema
  field) · `abilityDetail.ts` would mislabel an aura def as "dash N"
  (the §29d summon-branch bug class) · `STATUS_DISPLAY` has no
  coverage assert and `emboldened` is ALREADY missing an entry
  (renders magenta) — fix both, consider the assert.
- `affects` vocabulary is team-only; a camp-caster aura with
  `affects:'allies'` would buff every neutral on the map including
  walls. V1: copy `applyTileStatuses`'s `isInertNeutral` skip;
  camp-carried auras stay unauthored (no camp-awareness work).
- Serialization: statuses already ride `UnitSnapshot.effects` (v24) —
  the NO-BUMP prediction HOLDS. One new load-bearing fact: no shipped
  effect has ever touched mobility, so the snapshot-restore
  `refreshDerived` idempotence claim (World.ts:2604) gets exercised
  for the first time — add a mobility-status round-trip test.
- `foldEffects` already folds mobility (the sole SIGNED_STAT —
  negative works) and `refreshDerived` → `deriveStats` picks it up on
  the next proposal: the K1 seam goes live for the first time, no
  engine work. `emboldened` is the exact statMods precedent for
  `inspired`.

**Stat-feel surface (numbers corrected, direction intact):**

- Critable inventory: 14 damage ops, 9 true / 5 false (`magic_bolt`,
  `catapult_shot`, `vial`, `ice_storm`, `chain_lightning` inner) —
  critable and evadable are currently perfectly correlated; the flip
  decouples them for the first time. The spec's "8 of 18" is really
  **9 of 19**: 5 flip-fixable + 4 with NO damage op at all (healer,
  warlock, banshee, shaman — their luck stays dead regardless; the
  luck ScaledValue seam on hex/wail/raise_dead magnitudes is the only
  lever for them).
- ⚠ The flip adds a combatRng draw per victim per fire on those 5
  ops — **the whole combat stream shifts**, which is the mechanical
  reason the board moves. `abilities.test.ts:88-91` (the
  critable-gate pin) is the one hard test break, rewritten as part of
  the flip. `statuses.test.ts:72` pins DoT ticks non-critable —
  decision point.
- Dormant-seam confirmations: `ScaledValue stat:"luck"` is
  accepted-nowhere-used (the only shipped ScaledValue is raise_dead's
  magic-scaled level); daemon/packet `crit` filters (daemons.ts:120,
  packets.ts:103) WAKE UP for caster comps post-flip — pre-register
  in the board read.
- Mobility: constants live in **config/stats.json** (not sim.json) —
  `mobilityCdPerStat 0.15` / `mobilityMinCdScale 0.4` confirmed;
  floor hits exactly at mobility 4 (8 ticks). All formula tests
  derive from config (stats.test.ts safe); no hardcoded 0.15/0.4
  anywhere. ⚠ Design tension for the round: at ~0.075/point a
  LOW-end mobility point is worth 1-2 ticks instead of 3 —
  de-saturation extends the top while muting the early levels, which
  cuts against the legibility charter. 14 of 19 archetypes sit at
  mob ≤3 and only the 0.13-growth melee reach the wall (~lv 12-15).
  Options to weigh: pair the rate drop with mobility growth raises,
  or drop baseMoveCooldownSeconds.
- prc/eva: the uniform-5 premise is already three exceptions stale
  (adventurer eva 11, ronin prc 6, rogue eva 7; eva growth 0.45/0.5
  outliers too) — the identity pass is a widening, not a
  from-scratch. No test asserts catalog prc/eva values; the spread is
  free at test level. `stats.test.ts:100-108` documents the retiring
  invariant in prose — update the comment when spreading.
- Atlas: **43/48, 5 free cells** (verified by hand after the two
  audit agents split 43 vs 41; NON_UNIT_GLYPHS = 21, distinct unit
  glyphs = 22). §75 camps added zero glyphs. Five new archetypes fit
  ONLY if ≤5 want new distinct glyphs — margin exactly zero, or
  reuse/resize.
- The four weapons: `vial` is Molotov's clone parent (radius 1 IS
  3×3; `burn` + fx keys already exist — zero new-status work);
  registry cost = one line each in `DEMO_ABILITY_IDS`
  (registry.ts:45-57), boot-asserted set-equal; fx reuse
  (melee_swing / ranged_shot / vial_*) keeps them pure-config, a
  distinct cue costs one FX_REGISTRY line. Pistol's "low accuracy"
  reads ≈ literally at uniform prc==eva (authored range today: club
  0.40 → gambit 0.85).

**Promotion/board surface:**

- `PromotionInfo` already carries `oldStats`/`newStats`/`archetype` —
  everything the delta display needs; `stats.ts` is pure and
  UI-importable. **The archetype editor's derived preview
  (editor.ts:544-608) is a working reference implementation**
  (REF_ACCURACY 0.6 convention, dodge/cadence/per-ability hit-crit
  lines). Plan: extract a pure `promotionDeltaParts(old, new,
  archetype)` + headless test (the abilityDetail precedent); DOM
  stays eyeball-only. Zero existing test touches the screen
  (confirmed: Run.test.ts covers the phase upstream only). Per-unit
  crit/hit don't exist as derived values (I6) — deltas render
  per-ability or vs the reference attacker, same as the editor.
- New-archetype path: pure data + TWO mandatory side edits — a
  prices.json base entry (boot-FATAL if missing for a draftable) and
  `Recruitment.test.ts:55`'s hardcoded EXCLUDED list (breaks only on
  non-draftable adds). Recruit pool/tiers/roster order all derive.
  Enemy-side exposure is authored encounters only — a new archetype
  does NOT appear as an enemy unless encounters.json says so.
- ⚠ Camps leak: camp units resolve stats/abilities through the SAME
  catalog at spawn (World.ts:1897) — prc/eva or critable changes to
  bandit/archer/ghoul/warlock/ice_mage/shaman/banshee move camp
  fights on all 4 placed layouts + their bits payouts, and NO board
  row watches camps (the §83 probe-arm rider gets more load-bearing
  after this phase). Pre-register in the board read.
- Board: everything is reference-grade WARN by design; the SIGNED
  trio (seam 15–18 · reach 40–50 · wall 30–35) must not silently
  re-pin — any movement is a signing session. Act-1 + forced-boss
  refs (±8/±10) are the expected movers. The fire channel is ALREADY
  in an open inverted state from 75l — do not attribute its
  §76-board movement to §76. Board-structure tests pin row counts/ids
  (board.test.ts:255-312) — only break if we add rows, which we
  don't plan to.

**Shape-lock (user-signed 2026-08-10):** the 9-step cut approved as
presented (ROADMAP §76 carries the checkboxes). The three decision
points resolved: **(1) DoT ticks STAY non-critable** (`bypassDefense`
chip damage; critting ticks would double-count luck and add stream
draws on every carrier — `statuses.test.ts:72` stands). **(2) The
mobility low-end mute is an ACCEPTED tradeoff** — current per-point
differences are too dramatic and NEED muting; the design round
re-tunes starting mobility values to be roughly cadence-equivalent
under the new curve (re-anchor bases, not the curve). **(3) New
archetypes ship DRAFTABLE-ONLY** — the user has encounter ideas but
authoring them now is too much at once; enemy-side exposure deferred
(design-round discretion or §83), so the board amendment measures
the stat changes, not new enemy content.

### 76e — the structural flip (2026-08-10)

The mobility re-anchor landed as an EXACT level-1 equivalence, not an
approximation: rate halved precisely (0.15→0.075, floor 0.4→0.3) and
every base mobility + mobility growth DOUBLED (38 values, scripted) —
so every level-1 cadence is byte-identical, the pathing baselines and
drift gates never moved (verified: full suite green with zero
re-pins), and the de-saturation is purely in the growth grain (each
grown point now worth a half-step; saturation at ~10 points, the spec
target). What changes at runtime: LEVELED cadences diverge at
half-step rounding, and the growth ceiling now outruns the old 8t
floor (top melee can reach 6t deep in a run) — both absorbed by the
76h board. The 76f identity spread starts from this clean baseline.
Note for the design round: a +1-mobility status/empower (e.g.
`inspired`) is now worth HALF a step — aura numbers must be authored
on the new scale. Critable: all 5 ops flipped (the catalog is now
universally critable, pinned as a law over top-level + chain-inner
ops); DoT ticks stay non-critable (res. 1). The luck ScaledValue seam
got its evaluator pin. fuzz:smoke 398 green — the smoke pins are
determinism/structure-shaped, so the deliberate stream shift passes;
the absolute movement shows up only at the 76h board.

### 76f — the design round (2026-08-10, user-signed)

**The Officer resolution** — the round's structural call: the cane's
two competing identities (gentleman / partisan battle-cane) and the
missing Inspire carrier collapsed into ONE unit — the Officer, a
commanding gentleman whose swagger cane IS the melee spray and whose
kit carries the pure-aura `inspire` def (`[cane, inspire]` — the
first two-ability kit since the rogue, and the first composed
weapon+aura kit ever). No rename needed; the stave/Brawler split was
considered and passed over (4 units beat 5 — tighter, and it saves
an atlas cell). Rioter's glyph went `p`→`f` (flame) after the pool
strained — which triggered the FONT/STYLE AXIS reopen: the archived
Phase-I deferral ("revisit when glyphs actually collide") is
half-fired (pool exhaustion, not collision); signed as a §79 rider
with the §83 boss wave in view, NOT paid mid-§76. Facts pinned in
the rider: latin-1 is already loaded; a subset import must join the
FontAtlas font-ready await (the serif-bake hazard).

**Shipped:** 4 archetypes (Rioter f/uncommon · Gunslinger G/common ·
Halberdier H/uncommon · Officer O/rare; prices 28/25/28/32; atlas
47/48) · `inspire` (r4 / `inspired` +2 mobility / 5s — user's
numbers) + march-green display · the prc/eva pass (16 edits, 11
entries: snipers archer+luminant prc 7 · wild bandit 4/ghoul 3 ·
armor can't dodge catapult 3/reaver 4/halberdier 3 · robes dodge
casters eva 6 + prc growth →0.05 vestigial — the unmissable-magic
identity keeps prc DEAD deliberately) · luck durations lit on
hex/wail/molotov (confusion/panic/burn ride caster luck, capped) ·
healer's luck stays dead (needs HealOp.might→ScalarOrScaled — a
flagged deferral, not smuggled in). Existing-roster mobility bases
DELIBERATELY untouched (protects the 76e level-1 equivalence; the
identity range lives in the new units: Officer 6 / Rioter 5 /
Gunslinger 4 / Halberdier 2).

**Breakage triage (all expected classes):** the committed
fuzz-strategies.json archetype records are exhaustive-by-schema →
the 4 new ids joined at weight 0 (the §74 PATH_KINDS re-baseline
class, scheduled-not-surprise; redraw-level-fisher parses partial —
untouched) · the archetype-editor verbatim diff was ONE byte-class
miss (`["cane", "inspire"]` vs the formatter's no-space join) ·
`inspire` is the first op-less def — the attack-editor formatter
gained the inline-`[]` empty-effects arm · statuses catalog pin +
inspired joined. The blacklist-editor failures were pure downstream
of the verbatim diff.

### 76g — promotion derived-delta display (2026-08-10)

Landed to the kickoff plan: pure `promotionDeltaParts(old, new,
archetype)` ([src/ui/promotionDelta.ts](src/ui/promotionDelta.ts)) +
10 headless tests (the abilityDetail precedent — every expected
number runs through the same sim helpers, no hand-computed
arithmetic) + a final-beat block on the promotion card (one reveal
beat after the raw stat chips; CSS-only styling, dashed-top green
rows).

Design calls made in-step (implementation discretion under the
signed cut):

- **Only DISPLAY-grade changes emit a line** — values format first,
  compare as strings. A mobility bump that tick-rounding swallows or
  a crit already at cap produces NO row, so the block never claims a
  change the player can't feel. A power-only level renders no block
  at all (the raw `+N` chip already covers POW).
- **Per-ability rows diff `abilityDetailParts` positionally** instead
  of re-deriving ops: part STRUCTURE depends only on the def, so
  old/new arrays always align; stat-independent parts (`rng`, riders,
  aura lines) drop out for free, and any future op kind the detail
  builder learns is covered with zero new code here. The speed-scaled
  cadence (abilityRow's separate column) diffs alongside.
- **Reference conventions match the card the block sits on:** hit%
  vs the 0-evasion neutral target (the abilityDetail convention);
  dodge% mirrors it as a base-0.6 (REF_ACCURACY) 0-precision
  reference attacker — the editor's convention, fixed rather than
  dialable.

Preview-verified via the forced `promotion:pending` emit (the HANDOFF
force-verify pattern, no code hook needed — `__game.bus` is already
exposed): a con+str+prc+mob synthetic promotion rendered exactly
`Max HP 20 → 22 · Move cadence 0.80s → 0.70s · Sword: 13 dmg →
14 dmg · 70% hit → 72% hit` (all four hand-checkable against
config), the block held `hidden` until its beat fired (~3s in), a
con-only promotion rendered exactly one row, console clean. Feel +
the NATIVE-BROWSER eyeball rider (aura linger + the 4 new draftable
units + this block in a real run) ride with the user.

**76g eyeball verdicts (user, 2026-08-10):** contents ✅ ("look
great") · new units + aura pips ✅ · two findings: **(1) the reveal
re-centered the card row** — the block was `display:none` until its
beat, so the card grew mid-timeline and the flex centering re-seated
everything (layout shift). Fixed at the source: the block now holds
its height from card-land and the reveal gates on `visibility` (+
`.is-revealed`); preview-proven — card `top`/`height` byte-identical
across the reveal (378.25 / y 174.875 before and after). The SAME
class exists pre-76g on the RewardScreen (accepting a portion shifts
the list) and likely elsewhere — the systemic sweep is a TODO
("Layout-stability sweep"), deliberately NOT smuggled into §76.
**(2) aura RANGE is illegible** — pips prove the buff applies, but
nothing shows the radius. Taken as an in-charter insertion (the exit
criterion is "aura buffs visibly apply"), design shapes offered to
the user → 76g2.

### 76g2 — the aura-range ring (2026-08-11, user-picked shape)

Three shapes offered: **A** persistent boundary motes (recommended) ·
**B** radiating pulse · **C** tile-tint decal (needs a new
TerrainRenderer overlay layer + fights the §37 parsing-load
discipline). **User call: A alone first, expecting to want A+B
eventually; sprite-anchored** (half a cell of dishonesty during a
move lerp beats a ring that snaps cell to cell).

Built render-only in BattleRenderer: every 0.15s each live aura
carrier sheds 4 faint `.` motes (already an atlas cell — zero budget)
at random points on the aura's square boundary at `radius + 0.5` (the
affected cells' outer edge, matching the sim's `unitDistance ≤
radius` gate for a 1×1 carrier), colored by `statusColor(statusId)`
so ring and recipient pips read as one system. Rides the existing
explosion-particle lane — the lane gained an optional `alphaScale`
(default 1, existing bursts byte-identical) so the ring can whisper
at 0.5 peak alpha. Derives carriers per shed from `world.units[i]
.abilities[j].aura` (derive-don't-cache; enemy/camp carriers covered
for free). Advances on the speed-scaled `dt` → slows with playback,
freezes at pause; motes are swept by the existing `detach` sweep.

Preview-verified functionally (driven via `br.update` by hand, tab
throttling irrelevant): baseline battle 0 particles → console-spawned
Officer (+ `createAbility('cane'/'inspire')` attached by hand —
worth knowing: `spawnUnit` does NOT attach abilities; battleSetup.ts
does) → steady-state EXACTLY 16 motes (4/0.15s × 0.6s life), every
mote at Chebyshev 4.500 from the sprite (inspire r4 + 0.5 edge) →
carrier death: shedding stops, motes drain to 0 in one lifetime, no
leak; console clean. Density/alpha/bloom are eyeball-tunable consts
(`AURA_RING_*`) — the FEEL read (and the A+B call) rides the user's
native browser.

**76g2 eyeball verdict (user, 2026-08-11):** "really nice and
subtle" ✅ — and the countdown-vs-pause dt question surfaced a
worth-knowing seam: the Q2 countdown branch feeds the renderer REAL
unscaled dt (a living board during the read window, by design) while
manual pause feeds speed-scaled dt = 0 (a true freeze-frame) — the
aura FX inherit both behaviors for free by advancing on whatever dt
`br.update` receives. Confirmed working-as-designed, no change.

### 76g3 — the B pulse layered (2026-08-11, user call)

The anticipated A+B composition, requested after the A ring read
well. Every 2.4s each live carrier emits a square WAVEFRONT — 16
evenly-spaced motes (4/side, half-step corner offset so adjacent
sides interleave), expanding from 0.15× the boundary offset out to
the same `radius + 0.5` edge the ring marks, ground-flat, fading as
it arrives. The expanding square is the honest wavefront of the
aura's Chebyshev metric (not a circle approximation), and the
particle lane's existing ease-out lerp (fast start, settle at the
extent) already reads as a wave losing energy — zero new animation
code. Brighter than the idle ring (alpha 0.7 vs 0.5, bloom 1.1 vs
0.8): the pulse states "this radiates," the ring answers "where's
the edge." `updateAuraRings` refactored to `updateAuraFx` — one
carrier walk, two independent clocks (`AURA_RING_*` / `AURA_PULSE_*`
cadences tune separately).

Preview-verified (hand-driven frames): at 2.35s only the ring's 16
motes exist → crossing 2.4s exactly +16, every pulse mote `from` at
Chebyshev 0.675 (= 0.15 × 4.5) and `to` at exactly 4.500 → 0.7s
later fully drained back to 16 → the 4.8s boundary fires the next
16. Console clean. The composed feel read rides the user's native
browser.

### 76g4 — the pulse Doppler + the aura-FX mode switch (2026-08-11)

**The user's tuning session found the keeper regime AND its defect:**
cadence 0.9s / travel 1.8s (two concurrent wavefronts, signed into
the constants this commit) — but with 1.8s in flight, the fixed
spawn-center pulses trail a moving Officer: compressed ahead,
stretched behind ("kinda a Doppler effect", user-caught). Two
workarounds priced on request: (1) carrier-tracked pulses ~40 lines
(the shared explosion lane bakes `from`/`to` at spawn, so tracking
needs its own small lane storing offset + unitId, position re-derived
from the live sprite per frame); (2) area-fill shed ~10 lines (kill
pulses, sample the whole square). Both built behind a live A/B
switch — `window.__auraFx = 'track' | 'fill' | 'fixed'` — read every
frame, flippable mid-battle without rebuild.

Preview-verified: 'track' — teleporting the carrier +3 mid-wave left
the 16-mote wavefront centroid at 0.000 offset from the new center;
'fill' — tracked lane drains, 32-mote steady state spread through
the area (Chebyshev 1.35–4.40, 27/32 well inside); 'fixed' —
byte-identical shipped behavior. Console clean.

**Interim verdict (user, 2026-08-11): leaning TRACK (the legibility
argument — the aura's range is measured from wherever the carrier
stands NOW, so tracking is the truthful display of the MECHANIC even
if fixed is the truthful wave physics), but fill reads better
aesthetically — HOLD it for a wider feel jury, and the switch may
graduate to a player-facing graphics setting.** So the rig ships
default-'track' instead of being scrubbed to a winner; the
resolution (scrub vs promote to a settings surface) is a TODO
("Aura-FX mode") for a UI/polish round. The §76 exit criterion
(aura visibly applies + lingers) is satisfied by every mode.

### 76h — the board amendment run (2026-08-11, in flight)

**First launch crashed 4-for-4 on the box in seconds:** every board
fixture vector (`tests/fuzz/fixtures/*.json`) failed `parseWeights` —
the schema's `archetype`/`composition` records are
exhaustive-by-schema over `ALL_ARCHETYPES`, and the §76f triage
patched `config/fuzz-strategies.json` at weight 0 but MISSED the
fixtures (the same §74 PATH_KINDS re-baseline class, one more
surface). Class swept per the twice-bitten rule: all 12 fixture
vectors patched (the 4 new ids at 0, appended after `prodigy` — the
prior late-join precedent), every one re-validated through the real
`loadWeightsFile`, and the exact failing arm re-run 1-seed locally
to a clean summary.csv before relaunch. Ops note: the crashes cost
~4 box-minutes; the driver's no-summary flag + the fetched batch.log
made the diagnosis one read.

**The run (attempt 2, HEAD `3a0b48e`):** 15/15 fetched clean over
~3.9h (arb walk arms ~35min each, doctrine controls ~5min — the
arm-dependent cost shape), box destroyed same-night. **Board: 0 FAIL
/ 7 WARN — the WARN composition ROTATED from 75l** (numbers +
attribution notes: BALANCE 2026-08-11, the canonical entry). The
one-breath read: act-1 held at the amended refs and the priest +
fire-channel WARNs healed, but the walk walls flipped from
pull-softened (below band) to HARDENED (0.412/0.481, above the
signed 30–35), both walk ceilings went negative (arb underperforms
doctrine on two-act shapes — a paired sign-flip on the 55pre twin),
and the gambler's organic luck-seam gain did not arrive (the
regen-shape parity gap widens to −22.5). Signing queue presented to
the user: (1) wall-flip attribution — `--set` ablation bracket now
vs ride to §83 with the pull question · (2) the negative walk
ceilings — flag vs probe · (3) the gambler premise update for the
§83 rider · (4) accept the board as the §76h green.

**Signed (user, 2026-08-11):** the board accepted as the §76h green;
all three riders ride to §83 (the wall probe deliberately deferred —
one `--set` bracket will own the flip + the pull together). **Plus a
protocol call raised by the user's noise question: §83's
decision-feeding arms run n=120.** The honest arithmetic that framed
it: at n=40 a win-rate carries SE ≈ ±7.7 pts (independent-arm
differences ±11), so the gambler drop and the ceiling deltas are
1–2σ — suggestive, not settled (the paired ceilings do better than
independent since discordant pairs govern); only the wall move
clears noise comfortably. At n=120: SE ±4.5, differences ±6.4, and
the n=80 per-item floor clears so decisions.csv reads become
citable. Determinism makes the upgrade cheap: `--seed-offset`
extends 41..120 and POOLS with the 76h batches — the first 40 seeds
are already paid for. Riders + protocol recorded in ROADMAP §83.

**Plus (user-called, 2026-08-12): the 83-pre pin** — the BALANCE
audit + plain-English primer as §83's step zero. The user's framing:
protocol grasp has eroded under accretion (many arms, features still
landing, the ML rung-zero still ahead, BALANCE.md massive). The
assessment that signed it: not overcorrection — the run-log layer is
append-only history and SUPPOSED to grow; the disease is current
truth SMEARED across the header sections / the sheet JSON / buried
amendments / ROADMAP riders. The primer's guard against becoming a
second drift surface: CONCEPTS ONLY, numbers and live status stay in
their homes (the one-fact-one-home rule); a docs.test.ts cap on the
header layer is the candidate mechanization. Pinned in ROADMAP §83.

### 76i — docs close (2026-08-12)

Landed: DESIGN gains §Auras + §Stat identity plus the luck (critable
UNIVERSAL + duration seam) and mobility (de-saturation re-anchor)
bullet amendments · ARCHITECTURE entries for the World aura pass,
`engagementReach`, `promotionDelta.ts`, and the aura-range FX +
`__auraFx` switch · gotcha #124 (the exhaustive weight-vector join
class) · ROADMAP §76 demoted to its stub · the 83-pre pin (above) ·
the HANDOFF cursor flipped to the §77 kickoff. §76 closed — every
step user-signed, no snapshot bump end to end (as the kickoff
predicted).

## Phase 77 — Sector-map generation rework

### The kickoff audit (2026-08-12)

Two surveys — the generator + its consumers (direct), and the full
RNG fork-ladder map (the keyed-stream rider's evidence base). All
findings verified at HEAD (`e019202`).

**The generator as it exists** ([NodeMap.ts](src/run/NodeMap.ts)):
a staircase-interval planar DAG — widths → per-pair contiguous
child intervals (diagonal-biased ends, 50/50 mirror bit) → FOUR
appended tail scatter passes (rest → elite → port + ≥1 fallback →
event), each pass byte-preserving every pass before it (the
G3/W2/50c/74e discipline). §77 retires that discipline by design.
The in-code comment at the event pass already names the width-2
"battle-less hop" artifact as §77's to own. `stampRootKind` (the
startingEvents root stamp) is LIVE, not pending — The Start opens
on `sector-1-start` since 74i — so §77's placement work is the
events-to-combat RATIO pass, not the stamp.

**Cluster-kickoff findings re-verified current:** no divergence /
early-availability / path-coverage metric exists anywhere; no
rejection scaffold; no node-map visualizer (tools/mapgen-prototype
is the BATTLEFIELD terrain sandbox; the 73e honesty comment on the
tools-index card still points here).

**Consumers + re-baseline surface:** `nodeMap` is serialized
wholesale in RunSnapshot (v41; exact-version reject, no migration),
so the shape is free to change under the scheduled bump. The
isolation dials (`eliteChance`/`portChance`/`eventChance`) already
ride `sectorAdvanceConfig` (#121) — the carry rule is that every
NEW §77 knob joins the slice in the commit that adds it.
[NodeMap.test.ts](src/run/NodeMap.test.ts) is ~60 tests, nearly all
seed-sweep structural invariants (survive the rework); the
tail-append byte-identity contract tests die with the discipline
they pin.

**The fork-ladder map (the keyed-stream evidence).** The Run
constructor takes TEN positional forks in fixed order (sector →
team → levelup → deck → daemon → reward → rewardBits → portStock →
portPrice → event — the last five appended by later phases, each
append a paid global re-baseline). Transient forks: `mapRng`
per-encounter, `battleRng` per-turn, `offerRng` per-recruit,
`sectorRng` per-advance. The four sharpest positional hazards, all
found live:

1. **The boss branch takes ZERO forks** where the non-boss branch
   takes one (Run.ts:1946 vs 1961) — parent fork count diverges by
   node kind. The strongest single argument for keyed derivation.
2. **runRollout.ts:60–68** re-seeds clones with NINE sequential
   forks that must mirror the RunSnapshot field order BY HAND.
3. **rollout.ts:56–58** carries a conditional third `campRng` fork
   purely to preserve historical two-fork alignment (dead weight
   under keyed derivation).
4. **battleSetup.ts:206** is a burn fork existing only because
   `setupRngFor` already took fork #1 off the same fresh parent.

Three code sites already forward-reference the keyed form by name
(battleSetup.ts:184 `hash(root,'campSetup',turn)`, battleSetup.ts:289
`mixSeeds` self-describing as "the §77 keyed stream re-architecture
generalizes this shape", worklog §75 shape-lock). Donor primitives:
`mixSeeds` (battleSetup, module-private) + `fnv1a` (dev/configHash,
string→hex). The absolute-pin re-pin list is small and precedented:
the port canary (harnessPort.test.ts — re-pinned at every prior
stream break, 56a and 61d), the economy seed-3 pin, the 74e
`eventsVisited` exit pin, `signed-sheet.json` (the board re-pin,
already scheduled), and the 12 fixture weight vectors (regenerated,
not hand-edited). The pathing baselines are RNG-free (immune);
trace replay is self-contained (worldSeed/terrainSeed literals) and
safe provided `setupRngFor`'s single-fork meaning is preserved or
its replay path is converted with it. Camp identity stays
PER-ENCOUNTER under conversion (`hash(terrainSeed,'campSetup')`, no
turn component) — the 75j signed verdict is preserved by keying off
the same parent, so the dormant per-turn option stays dormant.

**Doc drift found in passing:** ROADMAP's 74j + 76i boxes were
never flipped despite both phases being closed (the close commits
exist); the ROADMAP title still reads "Phases 73–81" from before
the §81 insertion renumber. Fixed with this kickoff commit.

### The shape-lock (user-signed, 2026-08-12)

Three resolutions:

1. **The RNG rider: YES, at the FULL robustness bundle.** The
   seams-only keyed-stream proposal kills append-coupling but not
   the #49 draw-count-sensitivity class (the 74b precedent: the
   eventRng append re-rolled every seed's battles). The user's
   framing — "adding extra RNG mechanics shouldn't bite us in the
   future" — signed all five escalations: (1) **per-occurrence
   derivation** replacing long-lived streams — every logical random
   decision derives fresh from stable keys
   (`child(root,'levelup',unitId,level)`,
   `child(root,'portStock',sectorIndex,nodeId)`, …); the nine
   serialized RunSnapshot RNG states retire in favor of counters
   (mostly pre-existing; serialized counter only where no natural id
   exists, e.g. deck shuffles); a new draw can only remap its own
   occurrence, forever. **Node-anchored semantics signed
   explicitly**: outcomes stop depending on visit order (port stock
   at node N is seed-fixed regardless of route) — judged an
   improvement (StS-style seed fairness, better probes), not just
   plumbing. **The rollout trap, designed-in**: clones must diverge
   (CRN), so Run carries a `streamRoot` and a clone overrides it
   with `derive(rolloutSeed)` — replaces the hand-mirrored
   nine-fork list in runRollout. (2) One-stream-per-consumer
   (sector/nodemap/boss split; generate()'s passes on named
   sub-streams — the tail-append discipline retires instead of
   relocating). (3) The single sanctioned door
   (`RNG.child`/`deriveSeed` in RNG.ts; mixSeeds folds in; ad-hoc
   `new RNG(hash)` becomes a review offense). (4) The stream-key
   registry module + the permanence rule: KEY STRINGS ARE LIKE
   GOTCHA NUMBERS — renaming one is a global stream break; the hash
   function is frozen under the same rule. (5) The independence
   acceptance test (add a draw to stream A, assert stream B
   untouched) as the structural pin of the new contract.
   Cost acknowledged: the per-occurrence conversion is ~1.5–2× the
   seams-only 77d — accepted as a one-time cost on a re-baseline
   already being paid. The cut splits it d1 (additive primitive, no
   break) / d2 (Run, THE bump v41→v42) / d3 (battleSetup/World +
   bot clones) so each breaking commit's re-pins stay attributable.
2. **Baseline-first metrics signed**: the three metrics (early
   availability by hop-k · path-kind coverage across root→boss
   routes · branch divergence = rejoin distance + content
   differentiation) are measured on the CURRENT generator at 77b;
   thresholds sign at 77c against real distributions, not a priori.
3. **The events-to-combat ratio stays its own signed band** (user
   double-checked it made the charter — it did, spec approach item
   4 "its own knob"): divergence measures branch DIFFERENCE, the
   ratio measures route COMPOSITION — a map can be divergent and
   still all-events. Same 77b corpus feeds both, so the band joins
   the 77c signing list for free. The §83 event-ratio economy read
   is the balance-side complement, unchanged.

### 77a — the visualizer (2026-08-12)

Landed to the cut (`380019f` + the label fix `bbd7d05`).
Notes beyond the cut line: the 50-seed config-parity probe (explicit
slider config ≡ authored default path — the G1 `??` contract); one
real bug caught in DOM verification (`outerHTML` replacement
detached the board element — redraws after the first threw; fixed
to a stable-container `innerHTML`); the stamp select mirrors the
RESTRICTED `firstNodeKind` union (`'elite' | 'event'`) and, after a
user question, labels each option's true nature — battle is the
natural root, event is the startingEvents shape, elite exists ONLY
as the 68e isolation probe (no organic elite root; 74i-c: the dial
beats the pool).

### 77b — metrics + the baseline read (2026-08-12)

`src/run/mapMetrics.ts` (pure, RNG-free) + co-located test (6
fixtures-first tests + generator sanity bounds) + the corpus CLI
(`npm run nodemap:metrics`, dial flags mirror the visualizer) + the
per-map overlay in nodemap-viz. Metric shapes: early availability =
first hop per kind; path-kind coverage = route fraction (avoid-DP,
no double-count) + first-choice coverage (fraction of hop-1
branches retaining access); divergence = per-child-pair rejoin
distance + kind-multiset content differentiation; plus the ratio
reads (expected per-kind route composition by linearity;
battle-less middle hops). Route-uniformity caveat documented in the
module header (uniform-over-routes is a baseline stat, not a player
model — the fuzz walker measures the steered reality).

**THE BASELINE (500 seeds, authored config, hopCount 11) — every
spec complaint confirmed with a number:**

- **Early availability:** by hop 4 only 70% of maps have a rest,
  61% an elite, 55% a port ("no early elite, rest, or shop" ≈
  every other map for ports). Absent ENTIRELY: rest 3.0%, elite
  10.2% of maps (port 100% — the ≥1 guarantee works; event 99.2%).
- **Path-kind coverage:** port rides only 35.7% of routes on
  average (P10 8.1%); in 73.4% of maps fewer than half the routes
  see a port; in 41.4% of maps at least one FIRST CHOICE locks the
  player out of ports entirely (elite 31.8%, rest 22.1% — the "all
  on the same path" complaint, measured).
- **Branch divergence:** 59.8% of all branch pairs rejoin at
  distance 2 — the MINIMUM possible ("almost immediately rejoining"
  is the MAJORITY case); only 60.7% of pairs differ in content
  (≈40% of choices offer identical kinds either side).
- **Ratio anchors:** expected route composition battle 7.41 · event
  1.12 · rest 0.62 · elite 0.46 · port 0.39 · boss 1.00; combat
  share 80.6%. The 74e stacking artifact: ≥1 battle-less middle hop
  in 46.8% of maps (mean 0.60).

These are the numbers 77c signs thresholds against.

### 77c — the threshold signing (user-signed, 2026-08-12)

The whole proposed sheet signed as-is except one amendment. Each row
is (metric · today · signed threshold · mechanism), where C =
constructive pass (guaranteed by construction at 77e) and R =
rejection-sampled residue (a corpus-percentage gate in
nodemap-metrics.test.ts):

- Instant (d2) rejoins · 59.8% of pairs · **≤ 25% per map** · C
  (the min-divergence edge rule)
- Content-divergent pairs · 60.7% · **≥ 80%** · R
- Kind presence · elite absent 10.2% / rest 3% · **every map ≥1
  rest, elite, port, event** · C (budget floor)
- Port by hop · 55% by h4 · **100% by h5** · C (the guarantee pass
  generalized)
- Rest/elite by hop · 70%/61% by h4 · **≥ 90% by h5** · R
- First-choice port lockout · 41.4% of maps · **0%** (every first
  choice keeps shop access) · C
- First-choice elite/rest lockout · 31.8%/22.1% · **≤ 10%** · R
- Port route-fraction · mean 35.7%, P10 8% · **mean ≥ 50%, P10 ≥
  25%** · R
- Battle-less middle hops · 46.8% of maps · **0%** (a battle floor
  per middle hop) · C
- **The ratio band — the user's amendment**: events per route
  target **≈3 (band 2.5–3.5)**, not the proposed 1.5–2 ("I was
  envisioning closer to 3"). Combat share lands ≈55–65% (from
  80.6%). Explicitly a free dial — the §83 event-ratio economy
  read judges the income/XP/pool consequences on final content.

The corpus gates run at n=500 seeds (the baseline instrument's
shape). The user's reaction to the baseline, for the record: the
60% instant-rejoin and 41% shop-lockout rates were WORSE than the
felt complaint ("I knew it was bad, but not that bad").

### 77d1 — the derivation primitive (2026-08-12)

Landed to the cut. `deriveSeed(root, streamKey, ...indices)` +
`deriveRng` in RNG.ts — one xor-imul mix round per component (the
battleSetup `mixSeeds` shape generalized; that local one-off folds
in at 77d3) over an FNV-1a key hash; THE HASH IS FROZEN (header +
6 pinned vectors — a legitimate pin change = a deliberate global
stream break). `rngStreams.ts` registers all 22 planned keys as a
closed union (run ladder + world side + 'test'), each with its
index signature documented; unregistered keys fail to compile.
KEYS ARE PERMANENT (the gotcha-number rule — renaming remaps the
stream; tombstones over reuse). The independence suite pins the
architecture's point: order-freedom (deriving B never moves A or
any live RNG), the #49 kill (draw-count changes inside occurrence
N can't remap occurrence N+1), cross-key/index uniqueness at
birthday-bound density, crude uniformity. `fork()` survives
untouched as the POSITIONAL door for local self-contained use —
its 12 contract tests still pass unmodified. The registry design
choice worth recording: keys are registered a step AHEAD of their
wiring (d2/d3 consume the run/world blocks) — additions never move
existing streams, so pre-registration is free and gives d2/d3 a
signed target shape. 'campSetup' carries NO turn index by design
(the 75j per-encounter identity verdict, preserved).

### 77d2 — the Run conversion (2026-08-12)

Landed to the cut: THE bump (**RunSnapshot v41→v42**) and the
scheduled global stream break. The shape:

- **RunSnapshot**: `streamRoot` + three occurrence counters
  (`sectorIndex` / `deckShuffleIndex` / `eventStep`) replace the TEN
  serialized RNG states (`rng` + the nine E4→74b streams). fromJSON
  restores the root + counters; streams re-derive at their sites.
- **The atomicity law** (the conversion's load-bearing design rule,
  found at the step-zero audit): an occurrence must be ATOMIC
  between snapshots — one synchronous resolution — or carry a
  serialized counter. Multi-site streams got site-composite keys:
  'daemon' = (sectorIndex, nodeId, site 0|1|2, turnIndex) for its
  three hook sites; 'reward'/'rewardBits' key per turn boundary;
  'levelup' per XP-banking call (its batch is synchronous); 'event'
  rides the serialized `eventStep` because page routing can revisit
  pages (node entry and each choice resolution are the two atomic
  occurrence shapes; `executeEventOp`/`rollEventOutcome`/
  `rollEventForNode` now take the occurrence rng as a param).
- **One stream per consumer**: the old shared `sectorRng`
  (pick+nodemap+boss on one fork) split into 'sector'/'nodemap'/
  'boss', each keyed (sectorIndex) — the 77e generator rework can
  now change draw counts without moving the boss pre-roll.
- **The boss zero-fork hazard is dead** by construction ('map' keys
  on the node; a boss node simply derives nothing).
- **runRollout**: the hand-mirrored nine-fork re-seed list collapsed
  to `wire.streamRoot = deriveSeed(rolloutSeed, 'rolloutRoot')` —
  counters ride the wire, so a clone continues from the same
  position with fresh dice (CRN contract preserved; the test's
  control now proves root-sharing = future-sharing).
- **Node-anchored semantics live**: port stock/prices key on
  (sectorIndex, nodeId) — seed-fixed regardless of route (signed at
  the shape-lock).

**Fallout, exactly the precedented classes**: 11 Run.test failures
(4 schema-version pins 41→42; 7 seed-remap pins on the seed-1
selected encounter's pool — REPAIRED BY DERIVATION per the
balance-proof rule: chips/asserts now read the selected encounter's
authored `healthPool` from the catalog/`enemyHealthPoolMax`, so the
next stream break can't stale them again) + the two port canaries
(scan of 1..20 read seeds 2/12 buying; re-pinned 3→2, the ritual's
fifth entry; the no-buy seed-1 arm held) + the snapshot-roundtrip
deckRng assertions → counter assertions. The 74e `eventsVisited`
seed-1 exit pin survived unmoved. Green: 2597 main + 398
fuzz:smoke + typecheck.

### 77d3 — the battle-side conversion + the docs sweep (2026-08-12)

Landed to the cut. Every battle-setup stream now keys off
`terrainSeed`: `'terrain'` (generation — raw `new RNG(terrainSeed)`
made the terrain stream IDENTICAL to the root, the very collision
class that forced the §75 burn fork), `'spawnSetup'` (setupRngFor —
the D5.B fresh-parent-fork retired), `'campSetup'` (the burn fork
deleted; the key carries NO turn index — the 75j per-encounter
verdict, now one key index away if ever reopened), `'enemyPull'`
(per-turn via the worldSeed index; the §75j2 local `mixSeeds`
folded into the frozen deriveSeed door exactly as its comment
predicted). rollout.ts's World-clone re-seed converted to three
independent derives — the conditional-third-fork alignment hack is
dead (derivation has no order to preserve; `campRng: null` stays
null). World.ts untouched: **WorldSnapshot v35 HELD, as predicted**
(the combatRng default fork is the legal local-parent class; camp
stream state still serializes — sequential consumption within one
battle is inherent). replayTrace converts transitively (it calls
setupRngFor; record-then-replay tests prove consistency).

Fallout: ONE fuzz fixture — arbitratedStrategy.test's dock fixture
scan found a walk that docked BROKE under the remap (its condition
was dock, not dock-with-funds). Hardened to
dock-with-affordable-slot: self-healing, no pinned literal for the
next break to stale (the harness.test.ts:195 scan-over-pin
precedent). Both port canaries survived d3 unmoved (seed 2 still
buys). Docs sweep: TESTING contract #2 rewritten keyed-first ·
GOTCHAS #5 + #57 amended, **#125 added** (keys/hash permanent, the
atomicity law, one-stream-per-consumer, the campSetup verdict, the
fork() legality rule) · ARCHITECTURE §RNG rewritten + the
battleSetup tree line · DESIGN camps bullet · AGENTS determinism
invariant · sim.ts enemyPullChance comment. Green: 2597 main + 398
fuzz:smoke + typecheck.

### 77e — the design round: the braid overhaul (user-signed, 2026-08-12)

Step zero re-verified the card (generator untouched by 77d; nothing
pre-built; `'nodemap'` keyed stream live; the tail-append contracts
die as predicted). The incremental proposal — constructive passes
kept on the staircase skeleton + a rejection residue — was presented
and then SUPERSEDED by the user's counter-proposal, which is signed:
**the full braid/lane overhaul.** Lanes (path objects) are the
first-class primitive; hop width = active lane count; split/merge
are adjacent-lane ops; kinds generate per lane via a state machine
with a per-hop arbiter.

**Why the overhaul won (the assessment that signed it):** the 77c
sheet is route-centric, and the braid states it in native
primitives — planarity/connectivity/degree caps are free by
construction; a split opens a SEAM and a d2 rejoin is exactly a
sibling merge at the next transition (seam-lifetime budget = the
≤25% cap, direct); splits are the ONLY out-degree≥2 sites, so a
split-time content rule covers ALL branch pairs (the ≥80% row);
first-choice cones are trackable lane intervals; per-lane pacing is
what the ratio band actually measures. Rejection shrinks to a
bounded guard (kept per the scope guard, expected never hit).
Timing argument: the seed break is already being paid — a full swap
costs no extra re-baseline, and there is no byte-preservation
discipline left to protect.

**The signed resolutions:**

1. **Hybrid width control** — the width sequence draws first
   (budget/feasibility control kept from the staircase), then ops
   realize Δw per transition; CHURN pairs (split+merge on a width
   plateau) are where branch texture comes from — a knob, not an
   accident.
2. **State-machine rules (initial set — no additions until the user
   sees examples; 77e3 is the tuning session):** back-to-back
   events LEGAL (the 74e feel call carried) · back-to-back elites
   DISCOURAGED · rests biased to appear BEFORE elites, more
   strongly before the boss.
3. **1→3 splits and 3→1 merges: rare but possible** (fused from
   pairs of 2-ops when |Δw| ≥ 2, plus a rare-chance dial).
4. **The width nudge is signed** (ratio-band slack — the slot
   arithmetic is model-independent: events≈3/route + the battle
   floor + ≥1 rest/elite/port needs ~11–14 special slots vs ~14 at
   today's widths) · **min-spacing knobs become state-machine
   cooldowns** rather than dying.

**Recorded caveats:** (a) lanes ≠ routes — players re-compose
routes across merges, so per-lane pacing approximates composed-route
composition; `nodemap-metrics.test.ts` (n=500) stays the independent
oracle regardless of generator. (b) A known expressiveness change:
the staircase's PARTIAL merges (boundary-sharing where both parents
keep other children) don't exist in the braid — ops are exclusive.
That pattern was the d2-rejoin engine (59.8%), so its death is the
point; the feel gets eyeballed at e3. (c) `NodeMap`'s output
interface is unchanged (nodes/edges/hops) — Run/renderer/
serialization untouched, **RunSnapshot v42 HOLDS** through 77e; the
map remap is the scheduled break, re-pins land per-commit + 77f.

**The cut (ROADMAP 77e re-scoped):** e1 the braid skeleton (widths →
op placement with seams + rare 3-ops; the OLD four scatter passes
ported verbatim onto a kinds sub-stream as a DELIBERATE BRIDGE so
the tree stays green — landing note: the bridge dies at e2, and its
placement distributions are throwaway) / e2 the kind layer (quotas +
the per-lane machine + the per-hop arbiter incl. battle floor +
port-cone placement + the bounded rejection guard + the metrics
gate; new knobs join `sectorAdvanceConfig`, #121) / e3 the example
session (viz gallery + state-machine tuning with the user + docs).

### 77e1 — the braid skeleton (2026-08-12)

Landed to the cut. `generate()` is now the braid: the widths pass
survives verbatim (budget + growth cap) plus the braid's shrink
floor (`ceil(prev/3)`) and a NO-GROWTH clamp into the last middle
hop (a pair born there has only the boss merge-all ahead — an
automatic d2; churn is suppressed on that transition for the same
reason). The ops pass realizes each width delta as split2/merge2
tokens with forced+rare 3-op fusing, churn pairs as the branch
texture source, and a bounded 24-shuffle arrangement search under
the seam rule (age-1 closures only via `d2RejoinChance` inside the
≤25% budget; deterministic least-bad fallback). Three registry keys
(`nodemapWidths`/`nodemapOps`/`nodemapKinds`) off ONE u32 drawn
from the caller's 'nodemap' stream; four structure knobs in
nodemap.json (`churnChance` 0.6 / `split3Chance` / `merge3Chance`
0.15 / `d2RejoinChance` 0.1) — deliberately NOT RunConfig dials
(they're not probe-isolation knobs; e2's kind knobs join the #121
slice as planned). The kinds bridge rode over verbatim: all ~60
NodeMap invariants + the dial contracts passed UNCHANGED on the
first run, as did the full 2597 suite.

**Fallout: exactly one fuzz file.** arbitratedStrategy's
`mapStateWithChoice` scan stranded — braid maps branch ONLY at
split nodes (out-degree 1 between splits), so all six scan depths
legitimately stopped on choiceless nodes. Hardened scan-over-pin
(the harness.test.ts:195 precedent) with a 4-trial policy-seed
axis. 398 fuzz green.

**The 500-seed corpus read (bridge kinds, so kind rows are
throwaway):** d2 instant rejoins **59.8% → 20.1%** (per-map mean
19.0% — the signed ≤25% cap already holds constructively);
content-divergent pairs **60.7% → 77.2%** (the ≥80% row nearly met
before e2's split-time rule exists); 11.1 branch pairs/map; route
composition ≈ unchanged (bridge). Port cone rows moved WORSE
(first-choice lockout 41%→61%): deeper divergence = narrower
first-choice cones = random scatter reaches them less — exactly
the case for e2's constructive cone placement.

**Feel observation for the e3 session:** per-node choice frequency
is DOWN vs the staircase (avg out-degree ~1.3; the interval fans
are gone) — `churnChance` is the dial; expect fewer nodeChoice
arbitration calls per run in the 77f decisions.csv. Viz confirmed
live on braid maps (console-clean; overlay + variety gallery;
forced-merge3 narrowings render planar).

### 77e2 — the kind layer + the corpus gates (2026-08-12)

Landed to the cut, TDD'd against the new
`tests/nodemap-metrics.test.ts` (the drift.test.ts analog: every
signed 77c row as an n=500 gate; C rows = mechanism, R rows =
statistical; NEVER relax). The bridge is dead. The engine:
route-share quotas (`*RouteTarget` knobs; exact through-routes DP)
placed in PRIORITY ORDER = signedness — (1) the port CONE pass
(each hop-1 cone gets a port by h≤5; guarantee beats pacing), (2)
presence floors as HARD early-window picks (port → elite → rest;
cascading pools), (3) EVENTS to the signed band (share×spread
weights), (4) elite/rest cone repairs, (5) feel top-ups on
leftovers. Battle floor (specials ≤ width−1) and PATH-WINDOW
cooldowns everywhere — spacing is now per-route, not per-hop
(braid edges never cross lanes outside ops, so the window is an
exact route guarantee). Kinds rejection: attempt-indexed re-roll,
cone-failure-only retryable, `kindMaxAttempts` throw.

**The gate run drove four mechanism fixes** (each red row → a fix,
same session): (a) the d2 cap leaked on width sawteeth (2→6→2
forces split3s merged straight back — seed 14's six pairs) →
**width smoothing** (±2 per transition + NO shrink right after
growth, soft under budget) + a bounded ops-pass re-roll
(`nodemapOps` gains the attempt index); (b) rest-by-h5 87.6% → the
floor pick is pure availability (a soft early WEIGHT provably
insufficient; the `earlyKindWeight` knob died for a hard window);
(c) elite lockout 23.4% → the cone-repair pass; (d) events band
starved on narrow maps (16/300 below, all free=0) → the priority
reorder above.

**Deliberate semantics changes (flagged for user ratification at
this pause):** ① `portChance=0` now kills ports ENTIRELY (was:
exactly-1 fallback) — all four kinds unify on "dial 0 = kind
absent", the control-arm precedent; ② the 74e "an event dial
leaves other kinds byte-identical" contract NARROWED to
structure-only + guarantees (kinds share one slot pool by design —
displacement is real gameplay); ③ the events-band gate is
statistical (≥99% in band · floor 2.2 · mean 2.8–3.2), not
per-map-100%: ~0.4% of maps are min-width corridors whose early
slots the C-row guarantees fully consume (seeds 13/430, ev 2.33) —
tightening to 100% = a width-floor decision (killing 2-wide
corridors), the user's call; ④ floor priority port>elite>rest
means 4-hop dev maps host a port but never a rest (the rest
fixtures moved to hopCount 5). The signed WIDTH NUDGE proved
unnecessary — priority ordering resolved the slot arithmetic.

**Fallout:** the port canary re-pinned 2→3 (scan read
3/4/6/7/10/13/17/19 buying in 1..20 — the ritual's sixth entry;
the port floor REVIVED the SHORT shape, which had gone portless
under cones-only sourcing) + the four hopCount-4 rest fixtures →
hopCount 5. Green: 2610 main (+13: the gates) + 398 fuzz:smoke +
typecheck.

### 77e2b — the shear investigation + instrument promotion (2026-08-13)

The user's spot checks read a directional edge bias (right/up) —
the G2 class ("de-bias map edge direction", commit `41293a9`,
2026-06-02: the interval sweep was HANDED, +0.146 mean shear,
fixed by the 50/50 mirror to −0.006). The original instrument was
a scratch probe that never survived; re-derived from the commit
message's definition (mean normalized child-x − parent-x per edge
+ endpoint thirds) and measured in all three live coordinate
models (G2-normalized · MapScreen stretched · viz centered),
n=500 / 23,624 edges.

**Verdict — ensemble CLEAN, per-map drift REAL:** mean shear
−0.0016 (≈1.1 SE from zero; the old bug was 90× larger), thirds
31.6/36.9/31.5, exactly 232/500 maps lean right, every transition
class (grow/plateau/shrink) individually unbiased — the braid has
no handedness (token shuffles are reflection-symmetric where the
interval sweep's free right end was not). BUT individual maps
drift COHERENTLY with random sign: median map has 58.6% of its
diagonal edges pointing its majority way, P90 69.2%, max 82.1% —
per-map |shear| max 0.143 ≈ the old global bug. A spot check of a
few seeds reliably "shows bias"; the ensemble cancels. Likely
mechanism: the seam rule pushes consecutive merges away from
recent split sites, sustaining directional flow within a map.

**Landed (user-signed):** the instrument PROMOTED from scratch —
`meanEdgeShear` + `diagonalMajorityShare` on MapMetrics
(fixtures-first pencil tests), a SHEAR+DRIFT section in the
corpus report, and a handedness gate in nodemap-metrics.test.ts
(|corpus mean| ≤ 0.02 ≈ 10σ — the class that actually bit us
can't ship silently again). Per-map drift is deliberately NOT
gated: whether it's a defect or organic texture is the **e3
anti-drift dial question** (candidate mechanism: counter-drift
preference among equally-clean arrangements; exhibits = the P90+
drifters). Green: 2610 main (net +2) + typecheck.

### 77e3 — the example session (2026-08-13, in progress)

**Anti-drift: RESOLVED — LEAVE IT (user-signed 2026-08-13).** The
per-map coherent drift stays as organic texture ("it flows really
nicely on average, and a wonky one every once in a while isn't
bad"); revisit ONLY on negative playtest feedback. No anti-drift
mechanism built; the handedness gate + the diagonalMajorityShare
instrument stand watch. (The corpus punchline for posterity: seed
1 — the viz's default — is the single worst drifter in 500.)

**The dial session (user-experimented in the viz, signed
2026-08-13):** `churnChance` 0.6→**0.4** (a bit less braid churn) ·
`split3Chance`/`merge3Chance` 0.15→**0.25** ("they look cool but
got too chaotic above that") · `d2RejoinChance` HELD 0.1 (pumped
high it still added little — small diamonds just aren't visible
texture; the corpus d2 sits ~2%) · EVERY kind dial HELD as-shipped
("I REALLY like how they turned out"). Corpus at the signed
values: all gates green, 8.4 pairs/map (from 9.2), LONGER branch
lives (d7–d10 mass grew), divergence 94.8%, composition unchanged
(events 3.12 · combat 58.1%), zero test fallout (the self-healing
pin discipline paid — no re-pins needed).

**Ratifications (user, 2026-08-13):** all four e2 semantics
changes CONFIRMED — portChance-0 kills ports · the dial contract
narrowed to structure · the statistical band gate · floor priority
port>elite>rest. **Corridors KEPT** (the min-width outlier maps =
the same occasional-wonky-map philosophy as drift).

**Rider (user-called, 2026-08-13): the in-game MapScreen
full-width stretch.** MapScreen stretches every hop across the
panel (`x = (i+0.5)/width`), so braid lanes read too separated.
Slotted HERE as an e3 rider (a §77-caused render consequence;
§78's map work is the overlay, not this): fixed-pitch centered
columns — the nodemap-viz model — so lane spacing is constant and
narrow hops cluster instead of stretching. LANDED same day:
`LANE_PX = 110` per-lane pitch against the widest hop + a board
`max-width` cap (`maxLanes × LANE_PX`, auto-margin centered).
DOM-verified in the preview (board 660px on a 1280px viewport,
equal 302.5px margins, a width-2 hop occupying the two CENTER
lanes of six, console clean); native-browser eyeball = the user's
(render policy).

**The corpus, before → signed → now:** d2 59.8% → ≤25% → **2.9%**
· divergent 60.7% → ≥80% → **94.2%** · presence → 100% all four ·
port-by-h5 → **100%** · rest/elite-by-h5 → **100%/100%** · port
lockout 41.4% → 0% → **0.0%** · elite/rest lockout 31.8/22.1% →
≤10% → **1.6%/3.4%** · port routes 35.7% → ≥50% → **68.0%** (P10
54.5) · battle-less hops 46.8% → 0% → **0.0%** · events/route 1.12
→ ≈3 → **3.13** · combat share 80.6% → ≈55–65% → **57.9%**. Viz
live (widths smooth, overlay coherent). e3 agenda: choice density
(`churnChance`), diamond scarcity (d2 now 3% — maybe TOO clean;
`d2RejoinChance` dials up), wide-map special-node counts, the
corridor question (③), new-knob sliders.

### 77f — the full re-baseline + the stress board (2026-08-13)

The fuzz half was already settled in passing: every exit pin and
fixture self-healed through the e1/e2/e3 remaps (the scan-over-pin
discipline; the one port-canary re-pin 2→3 landed at e2). The board
half ran as the 68h shape: box `abox-20260813-155706` (cpx42,
fsn1, provisioned at `f24a7f9` — parity enforced at launch), all 15
rows driven sequentially through box-batch.sh (~2.5h box time;
completion verified by the fetched-count artifact, 15/15), box
destroyed on fetch. **THE STRESS READ: 0 FAIL / 7 WARN — the
two-act signed architecture survived the map-generator
replacement** (reach mid-band, seam in-band, walls re-softened to
the band edge, the walk ceilings RECOVERED to parity — the 76h
negative-ceiling flag dissolves). Act-1 refs drifted (priest regen
−14 = a NEW parity breach; the gambler breach FLIPPED SHAPES —
premise updated again: shape-coupled, not kit-intrinsic).
Full decomposition + the re-pin proposal: BALANCE 2026-08-13
(§77f). Reference re-pins await the user's signature (the 75l
amendment ritual); signed bands deliberately unmoved (§83 owns
reality-vs-band).

### 77g — the close (2026-08-13)

The re-pins SIGNED (user, same day): act-1 six + the two
forced-boss refs at the braid-world values — the sheet's third
amendment (signedAt updated; gamblerNote rewritten to the
shape-coupled premise; the priest regen breach recorded as the
second named §83 parity item). The closing report: **0 FAIL / 4
WARN, every WARN a carried §83-named watch** (wall-regen
below-band · the 55pre reach watch + its derived win · the fire
channel); board tests 20/20. ROADMAP §77 demoted to the stub;
HANDOFF cursor flipped (nothing in flight; NEXT = the §78
kickoff). §77 ran 77a→77g in three sessions, 2026-08-12→13:
two Run-bump-scale re-architectures (keyed RNG + the braid), one
mid-phase user-signed re-scope, five gates added, zero
regressions shipped.

## Phase 78 — UI/UX batch

### 78-kickoff — the code-reality audit (2026-08-13)

The five §78 surfaces surveyed at HEAD (`2d3f799`), against the
2026-08-05 spec resolutions — four phases of churn later (§§74–77,
incl. the Run v42 RNG rework). Verdict: the resolutions HOLD; two
charter items are ALREADY SHIPPED; no new blockers.

- **Already shipped (the step-zero premise check):**
  Stop-never-highlighted landed at **73d** (the `'atWill'` sentinel is
  live in HUD.ts — `activeObjectiveMode` three-state) and the hand
  density fix at **73c**. Both were spec'd under §78's umbrella
  section but pulled forward; they leave the §78 charter, no work
  remains.
- **Objective clicks (ObjectiveController.ts):** exactly as
  resolved — right-click is the unarmed ENGAGE fast path
  (`onContextMenu` → `setFromClient('engage')`, ignores any arm);
  left-click is inert unless armed. The three-tier resolve
  (enemy billboard → destructible/camp neutral billboard → terrain
  cell, §75h camps included) is mode-agnostic — the left/right remap
  is confined to the two DOM handlers. The TWO NAMED DECISION POINTS
  stand (arming survival; armed-vs-default precedence).
- **HUD cards (HUD.ts):** `ObjectiveControls` ({arm, hold, stop}) is
  already injected into HUD; the `cards` map covers BOTH teams keyed
  by unitId, so an enemy-card click has its `{kind:'enemy', unitId}`
  target in hand. The widening is `setOn(mode, target)` on the
  interface + controller, as resolved. Player-card decision point
  stands (per-unit objectives remain out of scope).
- **Empower (Run.ts / events.ts / PreTurnScreen.ts):** the bug is
  confirmed live in the data, unchanged by §§74–77:
  `Run.empowerMagnitudes()` sums ALL buff keys (daemon hooks + §49e
  packet `applyBuff` keys) into ONE integer per hand slot; the
  PreTurnScreen badge title then joins every granting idol's mods
  into one string (`buffSummary` — the merged-hover bug verbatim).
  The column rides FOUR event payloads (`turn:starting` ·
  `turn:handRedrawn` · `turn:unitEmpowered` · `run:packetUsed`) and
  SIX Run.test.ts sites, per the resolution. Key fact: the column is
  DERIVED (never serialized) and the payloads are events, not
  snapshots — **predicted: NO snapshot bump, Run v42 / World v35
  hold**. In-battle markers stay cheap: `HUD.refreshStatuses`
  already walks every card against the live `unit.effects` per tick,
  and empower lands there as a keyed effect.
- **Sector-map overlay (MapScreen.ts / CacheOverlay.ts /
  Keybindings.ts):** MapScreen is still a pure view
  (`show(map, currentNodeId, visited, roster, sectorTitle,
  forewarning)` — all Run-derivable); the §77e3 lane-pitch rework
  didn't change its contract. CacheOverlay remains the page-lifetime
  pattern to copy (Game-owned, `#ui`-mounted, getter-deps so a Run
  swap is invisible). `KeyM` is unbound (9 actions in
  keybindings.json, none on M). One wrinkle the resolution already
  called: keybind HANDLERS are battle-scoped by convention
  (Keybindings.ts header) — the `toggleSectorMap` subscription must
  live at the GAME layer (Game already owns the window listener),
  the first page-lifetime subscriber. `readOnly` flag suppresses the
  frontier `enterNode` dispatch.
- **Fuzz/pin exposure:** 78a/b/d/e are render/ui-only (eyeball
  policy, no pins). 78c touches `src/run/` (the derived column +
  emit sites) → the pre-commit fuzz trigger fires; no behavior
  change intended — fuzz pins predicted to hold byte-identical. The
  keybind step touches `src/config/keybindings.ts` (union widening)
  → same trigger, same prediction.

Cut + shape-lock: next entry.

### 78-kickoff — the shape-lock (2026-08-13)

Both decision points signed as recommended: **arming survives** —
armed mode outranks the default mapping (armed left-click fires the
armed mode; unarmed left-click engages), and right-click becomes the
FOCUS fast path, the clean mirror of J3's engage fast path; the E/F
hotkey arming keeps working unchanged. **Player-card clicks
dropped** — the team-wide objective model gives them no coherent
meaning; enemy cards only (the camera-pan alternative noted, not
taken). Two user amendments at the lock: (1) map access gets a
BUTTON as well as the hotkey — resolved as a page-lifetime map chip
joining the bits/cache chrome column (Game-owned, visible whenever
a run is live, hidden on MapScene itself / pre-run / game-over) —
"most screens" for free rather than per-screen buttons; (2) larger
objective buttons confirmed in-cut (78a tail, per the charter). The
six-step cut written to ROADMAP §78; 78f carries the box-flipped-ON-
TIME note (74j/76i were both caught late).

### 78a — click semantics + larger buttons (2026-08-13)

Landed to plan. The remap is confined to ObjectiveController's two
DOM handlers, per the audit: `onContextMenu` → focus (was engage),
`onClick` → armed mode when armed, else the new unarmed ENGAGE fast
path (a board miss stays inert, so a stray void click orders
nothing — deliberate asymmetry with the armed path's stay-armed
retry). Buttons: 13px/4px-10px → 16px/9px-16px (~26px → 42px tall);
tooltips re-state the per-mode fast path (engage owns bare left,
focus owns right). Stale-semantics comment sweep: HUD ×3, ui.css,
keybindings.ts, objective.ts, objective.test.ts, BattleScene,
BattleRenderer, ARCHITECTURE ×2 — MovementBehavior's two
"right-clicking a wall" mentions kept AS-IS (historical bug-report
accounts, not semantics claims).

Verified headless-style in the preview browser (the bus-event
capture protocol, not DOM reads): bare left → `objective:set
engage` · bare right → `focus` · armed focus + left → `focus` +
disarm (armed outranks the default) · armed engage + right →
`focus` + disarm (right ignores the arm) · void left-click → no
event. Two throttled-tab potholes for the tips file: the WebGL
canvas sat at 0×0 (no resize ever fired in the hidden tab —
`window.dispatchEvent(new Event('resize'))` fixes picking) and the
sim needed hand-ticking (the known rAF freeze). Computed-style
check: 16px / 9px 16px live. Native-browser feel verdict rides
with the user (the eyeball policy).

### 78b — setOn + HUD enemy-card targeting (2026-08-13)

Landed to plan. `ObjectiveControls` gains `setOn(mode, target)` —
the direct known-target set, routed through the same
`enqueueObjective` chokepoint as the three pointer paths; it
disarms (the click consumed the intent). HUD: enemy cards get
left=engage / right=focus handlers + the `hud-card-targetable`
affordance (pointer + amber hover glow + tooltip); liveness gated
at CLICK time via `findUnit` + `currentHp > 0`, so a grayed death
readout goes inert the moment the unit dies (and a reaped id
no-ops the same way). Player cards deliberately NOT wired (the
shape-lock drop) — commented at the addCard seam so it isn't
"fixed" later.

Bus-event verification (same protocol as 78a): card left-click →
`objective:set engage {kind:'enemy', unitId:7}` · card right-click
→ `focus` on unitId 8 (id mapping correct across cards) · armed +
card click → set + disarm · player-card click → no event (6 cards,
none targetable) · killed enemy 7 through the applyDamage
chokepoint → card gains `.is-dead`, click → no event. Native feel
verdict rides with the user.

**78b rider (user screenshot):** the hover glow clipped on the
row's outer cards — `.hud-enemy-cards` is a scroll container
(`overflow-y: auto`), which clips at its box edge; 8px interior
padding gives the 7px glow (1px outline + 6px shadow) paint room.
Geometry-verified live (8px clearance all four sides).

### 78c — the empower per-key widening (2026-08-13)

The merged-hover bug is dead at the data layer. `EmpowerStackView`
({key, magnitude, mods}) lands in empower.ts; `Run.empowerStacks()`
replaces `empowerMagnitudes()` — same badge-eligibility key set
(daemon hooks + packet applyBuff keys, the 47d/49e union), but the
column is now one entry PER KEY per hand slot (store order =
acquisition order), entries deep-copied via `cloneEffect` so a
retained payload never aliases the merge-mutated store (pinned:
`.not.toBe` on the mods object). All 4 payloads + the 4 emit sites
+ the 6 predicted test sites converted; expectations stay
config-derived (`EMPOWER.buff.key` / `buff.mods` — nothing
hardcoded). PreTurnScreen: the `buffSummary` join (the bug's home)
RETIRED; `renderHandCard` renders one `▲` chip per key, each
hover-titled `<Key> ×N — <its own mods>` (keys are authored
adjectives, so the label is the capitalized key — no second naming
table); `data-buff-key` rides each chip as 78d's color hook.

Browser-proven (Soldier/Mars + a forced hype packet): one card
carrying BOTH keys renders two chips — "Empowered ×1 — +8 STR ·
+8 RNG · +8 MAG" and "Hyped ×1 — …" — distinct titles, other
cards clean. Typecheck + Run suite (338) green pre-hook. NO
snapshot bump, as the kickoff predicted (the column is derived;
payloads are events, not saves).

### 78d — the color map + in-battle markers (2026-08-14)

The color half: `EMPOWER_DISPLAY` + `empowerColor()` land in
statusDisplay.ts as the STATUS_DISPLAY sibling (the keys CAN'T join
the status table — its orphan guard correctly rejects non-StatusDef
keys, which is what makes a second table the right shape). Five
entries: empowered keeps FLOURESCENT_BLUE (the known K4 accent);
warded aegis-lavender / hyped party-pink / shielded shield-steel /
overclocked volt-yellow, hues clear of the status palette
(eyeball-tunable, comments carry the collision notes). Coverage
pinned with the same three guards as §76b's, derived from the LIVE
key sources (daemon empower hooks + packet applyBuff — a new key
fails until it picks a color; a retired one trips the orphan
guard).

The marker half: EMPOWER_DISPLAY membership doubles as the HUD's
marker-eligibility filter (one table drives color + presence —
`readUnitStatuses` deliberately skips these raw stat effects, §32c,
so the status row was never going to show them and its contract
stays untouched). Compact cards gain an `empowerRow` +
`updateCardEmpowerMarkers` (signature-cached, the status-row
cheapness contract), driven from `HUD.refreshStatuses` on the same
per-tick gate; reaped units clear markers like they clear
statuses. `buffKeyLabel`/`buffModsSummary` moved to UnitCard.ts as
shared exports (PreTurnScreen's local copies retired); pre-turn
chips now color inline off the same map.

Browser-proven end to end (Soldier/Mars + forced hype): pre-turn
chips read #15F4EE / #FF7AD9 with distinct titles; in battle,
exactly ONE card shows the marker row — both chips in the same two
colors, same per-key hovers. Typecheck + the 6 coverage pins green
pre-hook. Native feel + color verdicts ride with the user.

**78d riders (user eyeball, 2026-08-14):** ✅ the countdown-window
bug FIXED — markers (and seeded statuses) were invisible until the
Q2 countdown released the clock: `refreshStatuses` recomputes once
per SIM TICK, the countdown parks the clock at 0, and the cards
mount after that tick's one pass — so every later frame skipped as
"same tick". Fix: `addCard` invalidates the tick cache
(`statusTick = -1`), so the next frame repopulates on a parked
clock; browser-proven at tick 0 (both chips visible, clock never
advanced). Two items filed to TODO §Polish by user call: the
"empower" mechanic-vs-Mars-key naming collision (rename touches
serialized effect keys — a deliberate step, not a drive-by) and
hoisting STATUS_DISPLAY/EMPOWER_DISPLAY into config JSON.

### 78e — the sector-map overlay (2026-08-14)

Landed to the resolved shape. MapScreen gains `{readOnly}` (ctor
opt): frontier nodes keep their styling — the plan-ahead read is
the point — but never dispatch, and the R1 roster button is
skipped (a nested modal would fight the overlay's own chrome; the
real screens keep it). `SectorMapOverlay` is the THIRD
page-lifetime chrome element (the BitsOverlay/CacheOverlay
lineage): the `⊞ map` chip stacks below the cache chip, and chip
click or `M` (`toggleSectorMap`, the new 10th keybind action)
opens a full-viewport read-only MapScreen fed by ONE view getter
closing over `this.run` (reset-invisible, always-live). The
keybind subscribes at the GAME layer — the first page-lifetime
keybind consumer (the Keybindings header's battle-scoped
convention now has a documented exception). Availability is
scene-derived and pushed from `Game.swap` (the one chokepoint):
hidden on MapScene / pre-run / game-over, and going unavailable
closes an open overlay. Esc / backdrop / re-toggle close.

Browser-proven end to end: chip hidden pre-run + on MapScene (M
no-ops on both) · visible on event + battle scenes · overlay
renders the braid map (41 nodes, banner + forewarning sub-line,
current highlighted, no roster button, readonly class) · a
frontier-node click moves NOTHING (node + phase unchanged) · Esc
closes, M toggles, works over a live battle. One probe-side
gotcha for the tips: the chip is a `<button>` in #ui, so
positional `#ui button` indexing in drive scripts now hits it
first — match by text.

**78e rider (user call, 2026-08-14): the clickable close + the
input-accessibility principle.** The overlay shipped keyboard-only
on the way out — the opaque full-viewport map buries both the
backdrop and the chip, so a pure-mouse player had NO exit (the
user's rationale for the chip in the first place: touch-friendly /
mouse-sufficient, keyboard as the fast path — a rationale that
hadn't been written down anywhere). Fixed with a fixed top-right
`✕ close` (terminal-plate chrome); the principle is now DESIGN
§Input accessibility so future modals inherit it as an audit rule.
Pure-mouse loop browser-proven: chip click opens → ✕ click closes.

### 78f — the docs close (2026-08-14)

The close ritual, box flipped ON TIME for once (74j/76i were both
caught late): ROADMAP §78 demoted to the stub · HANDOFF cursor
flipped (NEXT = the §79 kickoff; tests 2616; the §79 scoping facts
pre-staged in the In-flight row) · the memory snapshot advanced.
Placement decision folded in (user question at the 78e close):
**the UI style & robustness audit lands in the post-C5
interstitial, NOT Cluster 6** — C6 authors the biggest remaining
UI (options menu, tutorial, save/load) and should build on audited
idioms (ordering principle #1 applied to UI); recorded as PLANNED
in META-ROADMAP §Interstitials with the scope sketch (accessibility
audit vs DESIGN §Input accessibility · layout-stability sweep ·
style-idiom unification · the accumulated TODO riders), re-confirm
at the §83 close. The stale rollout-arbitration PLANNED bullet
flipped to its completed state in the same pass. §78 ran
78-kickoff→78f in three sessions, 2026-08-13→14: five build steps,
three user-caught riders (glow clip · countdown clock · the
clickable close → the signed accessibility principle), zero
snapshot bumps, +3 tests.

## Phase 79 — Glyph targeted fix

### 79-kickoff — the code-reality audit (2026-08-14)

Premise checks against the charter, all surfaces read directly:

- **The exit criterion's "TODO #79 + #81"** — TODO.md items are
  unnumbered; the two the charter means are the **auto-generated
  glyph ink-boxes** item and the **far-edge sprite-on-tile
  alignment** item (both cited by name from here on).
- **The anchor problem is real and is the off-axis class.** The
  sprite anchor lifts on WORLD-Y (`SPRITE_CENTER_OFFSET = 0.5` in
  `tileWorldPos`, BattleRenderer) while the billboard offsets in
  view space (billboard.vert.glsl) — the same off-axis
  world-Y-lift family the I2 hitsplat (dual-projection fix,
  UnitOverlayLayer.spawnHitsplat) and the J3 marker (camera-up
  lift, `OBJECTIVE_MARKER_ENEMY_LIFT`) already hit. **Third
  instance of the class** — the twice-bitten rule applies, which
  reshaped the phase (below).
- **Ink boxes:** the TODO's spec still matches code exactly —
  `GLYPH_INK` holds ONE measured entry (`▄`), everything else
  falls back to the full cell; `FontAtlas.create` already
  rasterizes every glyph and owns the y-flip convention
  (`getGlyphUV`); only two builders stamp ink
  (`enemyBillboards`/`destructibleBillboards`). Built-in oracle:
  the derived `▄` box should reproduce the hand-measured
  `{0.17, 0, 0.83, 0.53}` within tolerance.
- **Bars are already screen-space-correct**: the DOM overlay layer
  projects the LIVE sprite position per frame and stacks in pure
  CSS — it inherits any anchor fix for free. The world-Y holdouts
  are the sprite quad itself + the world-point FX endpoints.
- **§76f rider facts re-verified:** only `latin-400` loads; a new
  subset import must join the font-ready await
  (FontAtlas.ts:94); the atlas sits at **47/48 cells** —
  load-bearing for the style-axis scoping (a (char,style)-keyed
  atlas multiplies cell pressure; the §83 boss wave adds glyphs
  on top).

### 79-kickoff — the shape-lock (2026-08-14, user-signed)

**The user upgraded the anchor fix from minimal to robust** ("I'm
willing to take extra time to get things right"), asking the
design question directly: is the per-instance lift patch what a
from-scratch renderer would do? Answer: no. The from-scratch
design, now the signed shape — **the anchor-convention rework**:

1. **An anchor is a GROUND point** — `instancePosition` becomes
   the thing's true scene location (tile-top center for units,
   flight point for projectiles); `tileWorldPos` loses its +0.5;
   no presentation baked into world coordinates.
2. **The quad declares where its anchor sits, per instance** — a
   new sprite attribute (quad-local anchor point, applied in view
   space in the shader). Units = bottom-center ("stands on its
   anchor"); projectiles/motes/markers = center ("floats at its
   anchor"). Off-axis skew becomes impossible by construction,
   and a future big glyph (§83 bosses, the style axis) grows UP
   from its tile instead of sinking in.
3. **One shared above-the-anchor helper** on the JS side — the
   single implementation of "N units up the screen from this
   anchor," replacing the three hand-rolled copies (marker's
   `setFromMatrixColumn`, the hitsplat dual-projection,
   `HITSPLAT_Y_OFFSET` consumers). The next overlay surface gets
   it right by default — that's what kills the class.

**Billboarding itself stays** (standing 3D quads would trapezoid
the glyphs at the edges — fights the flat-terminal aesthetic);
`pick.ts` stays the shader's pure headless-tested twin and gains
the same anchor math in lockstep. **Cost accepted:** 2–3 sessions
vs ~1 minimal; risk LOW → LOW-MEDIUM, still render-only (no sim,
no snapshot). **Deliberately NOT pulled in:** the TODO
position-reconciliation rework (position STATE management — a
different class; stays a TODO) and any depth-write/alpha-test
change (charter scope guard). **Diagnosis stays first** (79b):
the TODO lists three candidate causes; if the far-edge symptom
turns out (a)-and-acceptable the rework still proceeds as the
class fix, but the diagnosis anchors the before/after evidence.
The 79f scoping note lands in this worklog (user call — no
standalone doc). One naming amendment at signing: flat 79a–79g,
no c1/c2/c3 sub-numbering.

### 79a — atlas-derived ink boxes (2026-08-14)

Landed to plan. `inkRectFromRgba` (glyphs.ts) is the pure DOM-free
half — takes raw RGBA in canvas convention, returns the normalized
y-up `GlyphInk`, owns the y flip, `FULL_GLYPH_INK` on an empty
cell; `INK_ALPHA_THRESHOLD = 16` pinned as the exported contract
(strictly-greater, matching the one-off measurement). 8 headless
tests pin the flip + corner conventions + the threshold boundary.
`FontAtlas.create` measures every cell right after its `fillText`
(one 64×64 `getImageData` per glyph at boot) and serves
`getGlyphInk` with the full-cell fallback (degrade, don't throw —
unlike `getGlyphUV`). The hand `GLYPH_INK` table + `glyphInk()`
are DELETED; both billboard builders stamp
`this.sprites.atlas.getGlyphInk(...)` (SpriteRenderer's `atlas`
went public — the ink source must be the same atlas the glyphs
render from). **Browser proof (dev-preview eval):** derived `▄` =
`{0.172, 0, 0.828, 0.531}` vs the retired hand-measured
`{0.17, 0, 0.83, 0.53}` — the oracle reproduces to ±0.002; `!`
now hugs its column (`x 0.42–0.58`, was full-quad), `s` hugs its
x-height band, unregistered glyph → full-cell fallback; console
clean. Click-feel verdict rides with the 79g eyeball. No padding
added (matches the oracle exactly); if clicks ever feel too tight
the threshold/padding knobs live in one place now.

**79a rider (user call at the quick test, 2026-08-14): +3px click
padding.** The raw derived boxes read a touch too tight in play;
`INK_PAD_PX = 3` (cell px ≈ screen px at default zoom) now widens
every side inside `inkRectFromRgba`, clamped to the cell; empty
cells stay the untouched fallback. Geometry pins re-anchored on
`padPx: 0`; a dedicated pin covers pad + clamp. Browser re-probe:
`▄` → `{0.125, 0, 0.875, 0.578}` (bottom clamped), `!` →
`x 0.375–0.625`. Tune by feel at the one constant.

### 79b — the far-edge diagnosis (2026-08-14)

**Verdict: cause (c) CONFIRMED — the world-Y anchor lift.** Probe:
a live 15×15 battle (Soldier, node 1, clock frozen), projecting
three points per cell on the live camera (45° pitch, canvas
1280×720): the tile-top center, the CURRENT anchor (tile-top +
0.5 world-Y), and the J3-pattern alternative (tile-top + 0.5
along camera-up). Horizontal skew of the current anchor vs the
tile top (`dxWorldY`), by column: **0 at the center column,
growing linearly to ±9.1px at the near-row edges** (±5.0 mid-row,
±3.2 far row) — sign outward, exactly the "sprite shifted
sideways off its tile" symptom, and it scales with resolution
(≈ ±27px at 4K). The camera-up anchor's skew is **exactly 0 at
every probed cell** — kills the class by construction. Cause (b)
excluded: the grid center projects to x=640 on a 1280 canvas —
fit/scroll centering is exact. Cause (a) residual: the quad's own
view-space extent is symmetric about the anchor, no horizontal
contribution.

**Second finding (feeds the 79e tune):** today's glyph BASE sits
~14px BELOW the tile-top projection at near rows (anchor center
rides only −12.5px while the half-quad spans 26.3px on screen) —
glyphs visibly sink into the tile's front face, worst near the
camera. Base-anchoring at the tile top (79c) will therefore RAISE
glyphs on screen (most at near rows); expect the eyeball to want
a small deliberate sink-back constant — budget it as the 79e
re-tune, one constant.

No commit (probe-only, per the cut). Before-screenshot could not
be captured (backgrounded-pane screenshot throttle, the known
HANDOFF limitation) — the numeric table above is the before
evidence and the scene re-derives deterministically.

### 79c — the anchor mechanism (2026-08-14)

**One deliberate re-scope at step zero** (the audit's find): the
cut line said 79c flips units to ground-point anchors; but the
call-site map shows FX sites PERVASIVELY consume
`sprites.getPosition` (the live anchor) as "the unit's visual
position" — projectile from/to, hitsplat anchors, aura centers,
duds, the overlay follow. Flipping anchors in 79c would leave all
of them at the units' feet for a whole commit — a visually broken
interim state. So the seam moved: **79c = the mechanism only,
strictly behavior-neutral** (every sprite stays center-anchored by
default; render byte-identical); **79d does the coordinated flip**
— units→base anchors AND every consumer converts in the same
commit, off the audit table. Landed:

- `instanceAnchor` (vec2) in billboard.vert.glsl — quad offset
  becomes `(position.xy − instanceAnchor) · size`, applied in
  view space; (0,0) reproduces the old math exactly.
- `SpriteAnchor` (`'center' | 'base'`) + exported `ANCHOR_XY` in
  SpriteRenderer; `addSprite` gains the anchor param (add-time —
  a sprite's anchor is what it IS, not per-frame state); the
  seventh instanced attribute rides the full slot lifecycle
  (removeSprite swap-compaction + the Qb#2 depth-sort repack —
  both pinned by new tests, since a scrambled anchor would
  silently re-center a standing glyph).
- pick.ts mirrors the shader (`PickCandidate.anchor`, quad center
  = view pos − anchor·size, ink rect composes on top) — 3 new
  headless pins incl. the base-vs-center swap case and the
  (0,0)≡undefined identity.

Tests 2624→2631; typecheck clean. Browser sanity: full drive to a
live battle post-HMR — 77 sprites, every anchor `(0,0)`, console
clean (no shader compile errors). The 79d landing note: convert
sites off the audit table (ground vs visual-center per site), flip
units to `'base'` + ground anchors, route visual-center consumers
through the shared above-the-anchor helper; the pick builders
must stamp `ANCHOR_XY.base` in the SAME commit the sprites flip
(pick and shader may never disagree).

### 79d — the coordinated flip + consumer sweep (2026-08-14)

The audit table (every `tileWorldPos`/`getPosition` consumer,
classified GROUND vs VISUAL-CENTER, all converted in this one
commit — pick builders included, per the 79c landing note):

| Site | Class | Conversion |
|---|---|---|
| unit body sprites (`onUnitSpawned`) | ground | `unitAnchorPos` + `'base'` anchor; the §39d `(n−1)` flush-fixup DELETED (base-anchoring makes it structural) |
| move/settle/swap lerps | ground | `unitAnchorPos` (rename) |
| shove direction | ground (XZ only) | `tileGroundPos` rename |
| pick builders ×2 | ground + base box | stamp `ANCHOR_XY.base` |
| overlay follow + spawn seeds | visual center | `unitVisualCenter` (footprint-aware) |
| hitsplat anchor | visual TOP | `aboveAnchor(ground, 2·half·n)`; UnitOverlayLayer.spawnHitsplat collapses to ONE projection — ⭐ the I2 dual-projection workaround RETIRED |
| enemy objective marker | above visual center | `aboveAnchor` (the J3 hand-rolled camera-up copy RETIRED) |
| rally-tile marker | above cell center | `aboveAnchor(ground, half + TILE_LIFT)` — now edge-true too |
| projectile/tracer/chain/bolt endpoints + homing provider | visual center | `unitVisualCenter` / `cellVisualCenter` (provider re-derives per frame) |
| explosion/dud burst cells | cell visual center | `cellVisualCenter` |
| sparkle | visual center + nudge | `unitVisualCenter` + SPARKLE_Y_OFFSET (now camera-up) |
| aura ring/pulse/fill | GROUND (floor decoration — world-Y is CORRECT here) | anchor is now ground; `AURA_RING_Y_OFFSET` rebased −0.35→+0.15 (same world height) |
| `gridToWorld` default Y | ground plane | 0.5 → 0 (only external consumer reads XZ) |

Constants: `SPRITE_CENTER_OFFSET` + `HITSPLAT_Y_OFFSET` DELETED,
replaced by `GLYPH_HALF_HEIGHT` (the anchor convention's one
vertical vocabulary word); `cameraUpScratch` + the overlay
`liftScratch` deleted (their jobs live in `aboveAnchor`). New:
[anchor.ts](src/render/anchor.ts) — `aboveAnchor`, with the
headless no-horizontal-drift pin (+ the world-Y counterexample
proving the class it kills).

**Verification.** Tests 2631→2635 + typecheck clean. Browser
(numeric, the 79b probe re-run on REAL sprites): 70/70 idle units'
anchors EXACTLY at `tileGroundPos` (error 0.000000) · all 70
base-anchored, zero strays, non-unit sprites all centered ·
glyph-center-vs-tile-ground horizontal drift **0.0000px at every
cell** (was ±9.1px at 720p edges) · all 8 enemies pick-resolve to
themselves at mid-glyph clicks · a below-the-base click misses
(the risen clickbox) · console clean. One environment quirk hit
mid-probe, NOT ours: a never-displayed preview pane boots the
camera with aspect NaN (canvas read 0×0 at init); a forced
`resize` event heals it — noted for future probe sessions.
Expected visual deltas for the 79e eyeball: glyphs ride slightly
higher (base ON the tile, no more front-face sink — the 79b
second finding), bars/badges likewise, big-rubble bars may want a
`FOOTPRINT_LIFT_PX` re-tune.

### 79d2 — baseline-anchored glyphs (2026-08-14, INSERTED)

**The find (user eyeball, two screenshots):** the rally X floated
at/above its tile's top edge. Diagnosis (user's hypothesis,
confirmed by the 79a instrument): the GLYPH-CELL INK SKIRT —
`FontAtlas` rasterizes 56px in a 64px cell, `textBaseline:
'middle'`, so a letterform's visible ink starts ~25% up the quad
(census over all 47 registered glyphs: 42 stand on the baseline
cluster y≈0.25–0.266; `g` is the LONE descender unit glyph, plus
`@` and HUD `/`; `▄`/`╥` touch the floor). A base-anchored QUAD
stood on the tile; the INK hovered a quarter-cell up — and
pre-79d the ~14px front-face sink had partially MASKED it (two
errors half-canceling).

**The design fork (talked through before building, user-signed):**
pure ink-bottom anchoring would stand `g`'s tail-tip on the tile
and raise its bowl off the shared line — breaking the terminal
look. Signed rule instead — **the BASELINE rule**: letters stand
on the font's alphabetic baseline (measured ONCE at atlas build
via TextMetrics, ≈0.261, with the ink-bottom-of-'X' fallback);
floor-touching blocks (ink.y0 = 0, incl. the unmeasured-glyph
fallback) stay flush on the quad bottom. Descenders dip below the
line like text on ruled paper. Pure rule = `baseAnchorYFor`
(glyphs.ts, headless-tested).

**Landed:** the raw/padded ink split (`inkRectFromRgba` returns
RAW; `padInk` applies the 79a +3px rider at PICK-candidate build
only — anchoring reads raw) · `FontAtlas.baseAnchorY` /
`inkCenterLift` / `inkTopLift` · SpriteRenderer stores the anchor
MODE per slot and derives the vec2 at every glyph write (a
base sprite's `updateSprite({glyph})` re-derives its stand line —
the marker's X⇄! swap can't go stale; mode array rides
compaction + the depth-sort repack, both pinned) · the rally X is
now BASE-anchored at `ground + TILE_LIFT` (the screenshot bug
dies) · the enemy mark rides `inkTopLift(target) + 0.2` (the
constant re-anchored: old 0.6-above-center ≈ 0.19 above ink) ·
hitsplats float at the INK top · FX endpoints/sparkles at the INK
center · overlays DELIBERATELY keep the uniform half-quad line
(bars scannable across mixed glyphs, not bobbing per letterform).

**Verification:** tests 2635→2640 + typecheck clean. Browser:
baseline measured 0.261 · anchors s/X/g = −0.239 (one shared
line, descender included) vs ▄/unmeasured = −0.5 · live battle:
14/14 sprite anchor attrs equal `baseAnchorY(glyph)` · 8/8 picks
at ink centers · a click 0.15 below the stand line misses (at
the ground point it HITS — correct: raw ink dips ~0.011 under
the baseline + the 3px pad) · fresh boot clean (the ANCHOR_XY
console errors were retained history from mid-edit HMR states).
Native eyeball → 79e/79g.

**79d2 rider (user screenshot, 2026-08-14): the N×N near-row
anchor.** The 3×3 rubble clipped through the ground (jagged bite)
and its footprint read as the center row only. Root cause: the
footprint-CENTER anchor put the front 1½ rows of the body's OWN
footprint nearer than the sprite's depth — their tile-tops
depth-clipped the slab's lower band; 1×1 units can't exhibit this
(no own-terrain in front). Fix (user-signed after the analysis):
`unitAnchorPos` anchors at the **near-row center** — x centered
across columns, z UNSHIFTED (the corner row IS the camera-near
row; the camera never rotates) — so no part of the body's
footprint is nearer than the sprite (clip impossible), the slab
stands at its front row with its ink covering the rows behind,
and n=1 degenerates to the plain tile center (no special case).
Depth-sort keys off the front edge now too (correct painter's
order vs neighbors). Pick/bars/FX follow the anchor
automatically. Verified live on ?layout=rubbleQuarry: 5/5
multi-tile bodies (3×3 + 2×2) at exactly near-row-center anchors.
Held back deliberately: per-cell glyph tiling (walks back §39d's
one-scaled-glyph) — only if the eyeball still reads ambiguous;
FOOTPRINT_LIFT_PX re-tune rides the 79e pass.

**79d2 rider 2 (user diagnosis, 2026-08-14): near-row MAX height.**
Still clipping after rider 1 — because the anchor's Y read the
CORNER cell's terrain height, and the height profile varies per
cell: a TALLER front-row neighbor's tile-top rose above the base
line while its front half sat nearer in depth → bite (live data:
one 3×3's corner at −0.201 vs a row neighbor at −0.053 — a
0.15-unit bite, matching the screenshot). The user called the fix
exactly: Y = the MAX tile-top height across the near row's cells —
at the row max, every nearer front-row surface projects BELOW the
base line, so the self-clip is impossible again. Verified live on
?layout=rubbleQuarry: 5/5 multi-tile bodies anchor at their row
max. (Genuinely-in-front TALL terrain outside the footprint can
still occlude a body's feet — that's correct occlusion, standing
behind a ridge, and applies to 1×1 units equally.)

### 79e — the tune pass (2026-08-15)

**The eyeball verdict (user, native browser).** Sprite-on-tile
seating "golden", hitsplats good, objective markers "a bit higher
than they were but look pretty good" → NO change to the marker
constants (`OBJECTIVE_MARKER_ENEMY_LIFT` 0.2 /
`_TILE_LIFT` 0.1 both stand as 79d2 left them). Two findings:
the HP/progress bars read "really high for all glyphs", and a
LONGSTANDING layout churn — the action-progress bar shoved the HP
bar upward when it appeared. Plus one feel call: `INK_PAD_PX`
3 → 5 (`7c8cac1`).

**One root cause under both bar findings.** The stack's transform
was `translate(-50%, calc(-260% - var(--fp-lift)))` — and `-260%`
is a percentage of the stack's OWN height. So every element that
toggles (the progress bar, and the status pip-strip — the same bug
shape, unreported) changed the height and the translate multiplied
that delta by 2.6 before it hit the screen (~18px of jump for the
progress bar alone). It also made "how high do bars float"
content-dependent, which is why `FOOTPRINT_LIFT_PX`'s flat px
values read as swamped.

**Landed in two moves, the second reversing a signed rule.**

*Move 1 — kill the churn (structural).* Bottom-anchor the stack at
a fixed px gap (`-100% - var(--overlay-gap)`), and make the HP bar
the LAST child with the toggling elements above it (the user's
call — "flip those around"). Growth is now strictly upward and the
HP bar is pinned: measured `hpBarMoved: 0.00px` with the progress
bar AND a status pip revealed. Taking the status strip with it was
the twice-bitten rule — same shape, closed as a class rather than
fixing the reported instance. ⭐ Same commit retires
`FOOTPRINT_LIFT_PX = [0,0,22,33,39]` entirely: it compensated for a
world anchor that didn't scale with footprint, and §79d's DOES
(`GLYPH_HALF_HEIGHT * footprint`), so it had become a double-count
— measured, not assumed (a 3×3's bar sat ~40px off its slab vs a
~7px target; deleting it dropped every multi-tile body into the
same clearance band as the 1×1s).

*Move 2 — the ink-top anchor (⚠ REVERSES the 79d2 rule).* Move 1
alone left an awkward split the user named precisely: cramped up
close, high far away, and "very noticeably high for short glyphs
like `a`". Both halves are the same defect — the anchor was
glyph-blind (79d2's deliberate uniform half-quad line) AND
depth-blind, while the gap was screen-px, so **no single gap value
could satisfy both ends**; the user pushed 12 → 24 chasing it and
the split just inverted. Fix: anchor the overlay stack on the
glyph's visible INK TOP (`inkTopLiftFor` — one definition, shared
with the hitsplat anchor, which had been inlining the same math).
The anchor then carries the perspective itself, so `--overlay-gap`
is exact screen px. Measured across 26 bodies spanning a ~400px
depth range, `a`/`M`/`r`/`▄` and footprints 1–3: **9.96–10.05px**
(the ±0.05 is `updatePosition`'s `.toFixed(1)` rounding, not
drift).

**The reversal, explicitly.** §79d2 signed "overlays DELIBERATELY
keep the uniform half-quad line (bars scannable across mixed
glyphs, not bobbing per letterform)". 79e overturns it on the built
result — the user's "might have signed that rule a bit
prematurely". The uniform line and glyph-tight gaps are mutually
exclusive; the user's own complaint about short glyphs IS the
uniform line's cost, seen. Price accepted, stated up front and
signed: bars at equal depth now sit ~5px apart for an `a` vs an
`M`. The rationale lives in `inkTopLiftFor`'s docblock so it can't
later read as an accident.

**The quantized fallback (noted, NOT built — user request).** If
future feedback says a mixed row reads ragged, the middle position
is to keep the ink-top anchor but QUANTIZE the lift — snap
`inkTopLiftFor` to two or three buckets (a baseline-cluster band, a
tall/cap band, a floor-block band) so bars land on a few shared
lines instead of a continuum. That recovers most of 79d2's
scannability without returning to a glyph-blind anchor. Watch item
in TODO.md; do NOT reach for it unless the eyeball asks.

**Verification.** Tests 2640 green + typecheck clean at both
commits (no test moved — `render`/`ui` is eyeball-only by policy,
and nothing referenced the deleted constant). Browser, live on
?layout=rubbleQuarry: the gap table above · churn 0.00px · console
error-free. Native eyeball: user-signed 2026-08-15 ("looks great to
me now"). Probe note: the §79d aspect-NaN quirk recurs — the
preview pane boots 0×0, so `resize_window` + a `resize` event
before projecting anything.

### 79f — font/style-axis SCOPING (2026-08-15, docs-only)

The §76f rider: reopen the archived Phase-I font/style deferral
([archive/post-h-roadmap.md](archive/post-h-roadmap.md) §"What
we're explicitly NOT doing yet"), scoped with the §83 boss wave in
view. **Recommendation: DEFER the style axis. Its trigger has not
fired, and the thing §83 actually needs is a 2-constant atlas-grid
bump, not a glyph-layer investment.** Details below; two findings
the card didn't carry.

**Premise re-verification (step zero).** All four carried facts
CONFIRMED: only `latin-400` loads ([main.ts:3](src/main.ts:3), the
lone import) · FontAtlas explicitly `fonts.load`s the exact face
before `fonts.ready` and rasterizing
([FontAtlas.ts:116](src/render/FontAtlas.ts:116) — the docblock
explains why `ready` alone bakes the serif fallback) · atlas
**47/48** (21 `NON_UNIT_GLYPHS` + 26 distinct catalog glyphs;
`ATLAS_CELL_BUDGET = 48`) · the style axis proper = `glyphStyle` on
UnitDef + a (char,style)-keyed atlas + budget accounting + editor
arm.

**The trigger test — NOT fired.** The Phase-I deferral's condition
was explicit: *"Revisit when the next wave of unit types actually
collides."* Measured against the catalog: 30 unit defs → **26
distinct glyphs, zero combatant collisions**. The only shared
glyphs are deliberate neutral variants (`#` wall/wall_destructible,
`╥` half_cover ×2, `▄` rubble ×3) — one visual identity per
material, not a collision. **29 of 52 letters are still unused.**
The §76 wave strained the pool by consuming case-pairs as distinct
units (M/m, A/a, R/r, B/b, C/c, G/g, H/h — 7 pairs), which is the
legibility strain worth watching, but it is not the stated trigger.

**The real §83 constraint is the atlas GRID, not the font axis.**
One free cell. A boss wave needs several. That fix is two
constants — `COLS`/`ROWS` in FontAtlas.ts + `ATLAS_CELL_BUDGET` in
glyphs.ts (8×6 = 48 → e.g. 8×10 = 80, a 512×640 texture) — already
fenced by three independent guards: the boot throw in
`FontAtlas.create`, the FontAtlas.test.ts budget assert, and the
archetype editor's `atlasCellsFor` Save block. **~5 lines, not a
phase.** Do it when §83 needs the cells; it needs no scoping round.

⭐ **The style axis is CHEAP in cells and expensive in plumbing.**
Worth correcting a natural assumption: a (char,style)-keyed atlas
does NOT multiply the budget by the style count. It costs one cell
per (char,style) COMBINATION ACTUALLY USED — so 30 units each
declaring one style still occupy ~30 cells. The axis's value is
precisely that it lets the same LETTER serve two units (`M`
regular = mercenary, `M` heavy = a boss variant) without spending a
new letter. The cost is all plumbing: UnitDef schema + zod loader +
atlas keying + editor arm + budget accounting.

⚠ **Finding 1 (new): `glyph` IS serialized**
([World.ts:343](src/sim/World.ts:343), `UnitSnapshot.glyph`), so a
`glyphStyle` SIBLING there would bump WorldSnapshot. It needn't be
one: style is archetype-derivable, so the renderer can read it at
CALL time off the catalog exactly as `glyphForArchetype` already
does (gotcha #114 / the derive-don't-cache doctrine) and the axis
ships with **NO snapshot bump**. Whoever builds it should take the
derive-only shape deliberately — the serialized `unit.glyph` is
itself redundant with the catalog, pre-existing debt, and NOT to be
widened. (Recording the bump prediction per the kickoff rule: the
serialized-sibling shape bumps, the derive-only shape does not.)

⚠⚠ **Finding 2 (new, unrelated to the rider, ROBUSTNESS): two of
the 47 glyphs are not in the loaded font.** Empirically measured
in-browser (render each char with `'JetBrains Mono', serif` vs
`…, sans-serif` and diff the rasterized alpha — identical ⇒ the
webfont supplied it, different ⇒ fallback): 45/47 come from
JetBrains Mono; **`╥` (U+2565) and `▄` (U+2584) come from the OS
fallback chain.** Not fixable by adding a subset — fontsource ships
only latin/latin-ext/greek/cyrillic/cyrillic-ext/vietnamese for
this family, and box-drawing/block-elements are in none of them
(the upstream JetBrains Mono TTF does carry them, so shipping a
self-subset font file is the fix, not another `@fontsource` import).
Why it matters concretely: those two glyphs are EVERY wall,
half-cover and rubble entity, and §79d2's stand-line rule branches
on `ink.y0 === 0` — an exact equality on measured ink
([glyphs.ts:213](src/render/glyphs.ts:213)). Measured here both are
exactly 0 → floor branch → flush, correct. On a machine whose
fallback renders either block with even one transparent pixel row
at the cell bottom, it falls into the BASELINE branch instead and
that entity anchors on the text baseline — a visible regression
reproducible only on someone else's machine. **Routed to the
post-C5 UI style & robustness audit** (META-ROADMAP §Interstitials,
already planned); TODO watch item filed. Deliberately NOT fixed
here — 79f is docs-only and this is not the rider's subject.

**Recommendation, in one line:** defer the style axis until a
combatant collision actually forces it (re-test the trigger at the
§83 boss wave — the census above is the cheap re-run); bump the
atlas grid as a ~5-line chore when §83 needs cells; fix the
fallback-font gap in the robustness audit, where it belongs.

**⚠ SUPERSEDED same-day (2026-08-16) on the last clause** — the
user pulled the fallback fix OUT of the robustness audit and into
§79 as its own step (79g, exit eyeball renamed 79h). Their
reasoning, which is better than mine: §79 just derived two
alignment rules from MEASURED ink, and for those two glyphs we
measured a font we don't control — so it's a defect in §79's own
output, not a general audit item, and filing it away from the
rules it invalidates is how it gets lost. It also can't sit after
the exit eyeball: the fix CHANGES how walls/cover/rubble look
(real JBM blocks vs the OS substitute), so 79h must eyeball the
result.

### 79g-scoping — the style-axis bundling question + OFL (2026-08-16)

**Asked:** does doing font surgery strengthen the case for building
the style axis now? **Answered NO (user accepted the pushback).**
The overlap is one piece of six — loading a second face shares with
the subset work; the (char,style) atlas re-key, the `glyphStyle`
UnitDef schema + zod + 30 existing defs, the editor arm, the
combination-aware budget accounting, and (the expensive one)
re-keying every glyph-keyed derivation §79 just built
(`baseAnchorY`/`inkTopLift`/`inkCenterLift`/`getPaddedGlyphInk` +
SpriteRenderer's per-slot anchor mode + the 79d2 glyph-swap
re-derivation) do NOT. Bundling would reopen the anchor rules
signed hours earlier, on a wider key, before they'd been eyeballed
on a second machine — and it would destroy the cheapest available
oracle for the font swap itself (same upstream font ⇒ the 45
already-covered glyphs should be PIXEL-IDENTICAL; that proof only
exists if nothing else moves in the commit). Plus the mechanism
would ship with no consumer, against the standing "no abstractions
for hypothetical future needs" norm, and its vocabulary (bold for
elites? italic for spectral?) is a §83 CONTENT question we'd be
guessing at. **The option is kept cheaply instead:** the subset
generator takes a LIST of faces (one entry today) and the boot
assert names the expected face, so a second face is a drop-in, not
a rework. Re-test the collision trigger at §83 with the 79f census.

**OFL 1.1 compliance — read from the shipped license text, not
memory.** Two findings.

⭐ **No Reserved Font Name is declared.** The OFL defines an RFN as
"any names specified as such AFTER the copyright statement(s)"
(§DEFINITIONS); JetBrains Mono's copyright line carries no "with
Reserved Font Name" clause. Clause 3 therefore has no subject —
**our subset may keep the family name `JetBrains Mono`**, so
`FONT_FAMILY` (FontAtlas.ts) and the CSS are untouched. Subsetting
DOES make a Modified Version (the definition names "changing
formats" explicitly), so this needed checking rather than assuming.
Re-verify against upstream's `OFL.txt` when 79g vendors the TTF —
the copy read here is fontsource's repackage.

⚠⚠ **We are ALREADY non-compliant, today, on the live Pages
build.** `dist/assets/` ships `jetbrains-mono-latin-400-normal`
`.woff` + `.woff2` and the build contains ZERO license text
(grepped for "Open Font License" / "SIL OFL" / the copyright line —
no hits anywhere in `dist/`, and there is no attribution file in
the repo root or `public/` either). Fontsource's files are
themselves Modified Versions, and clause 2 requires **each copy**
bundled/redistributed to contain the copyright notice and the
license. TERMINATION makes that void-the-license territory, not a
nitpick. Pre-existing and unrelated to the fallback bug — 79g
absorbs it because it's the same file.

**The obligations 79g must satisfy** (clause → concrete): (1) never
sell the font alone — fine, bundled · (2) notice + full OFL in the
SHIPPED build, i.e. `dist/`, not just the repo — a repo-root
LICENSE never reaches a player, and this is the Steam-critical one
· (3) no RFN ⇒ keep the name, but preserve the internal name table
honestly and record that it's a subset · (4) don't use JetBrains'
name to promote — attribution in credits, NOT Steam marketing copy
· (5) the font stays OFL and must not be relicensed ⇒ vendor it in
its OWN directory with its OWN license file so the project license
can't appear to swallow it. Open product question for the ship
cluster, NOT 79g: whether the player-facing surface is a
`THIRD-PARTY-LICENSES.txt` beside the binary (79g's minimum) or a
proper in-game credits screen (recommended at Cluster 6).

### 79g — the self-hosted font subset + OFL compliance (2026-08-16)

**Premise re-verified FIRST (step zero), and it mattered.** The whole
plan assumed upstream JetBrains Mono carries the two codepoints. It
does — but that was an assumption, not a fact, until a minimal TTF
cmap reader said so. Official release **v2.304** (JetBrains/
JetBrainsMono, zip sha256 `6f6376c6…7bbf`): all 47 registered
glyphs present, `U+2565`+`U+2584` both present, box-drawing
**128/128** and block-elements **32/32** COMPLETE. Geometric shapes
(43/96) and arrows (35/112) are PARTIAL — recorded because §83
must not assume an arbitrary shape exists there.

**Source choice — one rejected.** `jetbrains-mono` on npm is a
THIRD-PARTY repackage whose metadata declares **MIT** for what is
an OFL font. A licence mismatch is not a foundation for a
Steam-bound pipeline; we take the official JetBrains release. The
source TTF is VENDORED (`assets/fonts/jetbrains-mono/`) so the
build is hermetic — no network at build time.

**What landed.** `scripts/build-font.mjs` (+ `npm run gen:font`,
mirroring the `gen:sfx` precedent): subsets the TTF to ASCII +
Latin-1 + arrows + box-drawing + blocks + geometric shapes, emits
woff2 AND generates `src/fonts.css`. Deliberately driven by a
`FACES` **list** with one entry — §79f said don't build the style
axis, but a second face is now a data edit plus a re-run, never a
re-architecture. ⭐ The generator FAILS THE BUILD if the source
lacks any glyph the live `config/units.json` catalog declares (it
reads the catalog directly), so a future font upgrade that drops
one is caught at build, not shipped as a silent OS fallback. Plus
a DEV boot assert in FontAtlas (`assertGlyphsCameFromFont`) — the
serif-vs-sans render diff, run over the real atlas set; warns, does
not throw (loud in dev, never bricks a player's session; the build
gate is the hard one). `@fontsource/jetbrains-mono` **uninstalled**;
`font-display: block` not `swap` (the atlas rasterizes ONCE at
boot — a swap-in afterwards would leave fallback shapes baked in
for the whole session).

**Verification — the oracle held.** 47/47 glyphs now come from
JetBrains Mono, **zero fallbacks** (was 45/47). Every one of the 47
renders **pixel-identical to the vendored upstream TTF** (loaded
in-browser as a second family and diffed cell-by-cell) ⇒ subsetting
was lossless. Build clean, lint clean, tests 2640 green, typecheck
clean. `dist/` carries `THIRD-PARTY-LICENSES.txt` with the full OFL
(clause 2 SATISFIED — the live breach is closed **[⚠ CORRECTED at
§79-post: true of the BUILD OUTPUT only. Deploys are hand-uploaded at
milestone boundaries, so the LIVE build still predates 79g; the breach
closes at the next upload]**) and now ships ONE
hashed font file (39.2KB) where fontsource pulled in two (`.woff` +
`.woff2`), so shipped font bytes went DOWN despite the headroom.

⚠ **One real delta for the 79h eyeball.** Ink measurements moved:
`▄` y1 0.5313→0.5781 and `╥` 0.5625→0.6406 (EXPECTED — they're the
genuine font now instead of an OS substitute; shape confirmed
structurally correct by rasterized ASCII-art dump, and both still
reach the cell floor so the `ink.y0 === 0` floor branch holds).
Less obviously, **every letterform's ink TOP moved down by exactly
1/64** (one cell pixel) — fontsource's woff2 is a reprocessed build
and rasterizes a hair differently from the upstream TTF at the
`INK_ALPHA_THRESHOLD` boundary. Consequences: `ink.y0` and the
measured baseline are UNCHANGED, so §79d2's stand line is
byte-identical — nothing about where glyphs STAND moved. But
`inkTopLift` feeds §79e's overlay anchor and the hitsplat float, so
bars/numbers now ride ~1px lower. Well inside the 10px gap, and
strictly more correct (it's the real font) — but it IS a visible
1px change, so 79h should confirm the bar gap still reads right.

**Pre-existing, NOT bundled (flagged per the side-task norm):**
`npm audit` reports 5 vulns (4 high) — all in the existing dev
toolchain (vite/esbuild/postcss/nanoid/brace-expansion), none
shipped in `dist`. `subset-font@2.5.0` has ZERO dependencies and
introduced none of them. Fix deliberately left out of 79g.

### 79g-postscript — the bar-gap false alarm, and a bad method
(2026-08-16)

User eyeball after 79g: capitals looked cramped while short glyphs
kept their 10px. **Not a code bug — a days-old browser tab.** It had
been accumulating Vite HMR patches, so the new `--overlay-gap` (CSS,
hot-applied cleanly) was landing against an already-constructed
`BattleRenderer` still running the pre-79e UNIFORM half-quad anchor.
Hard reload fixed it. The symptom was a precise fingerprint of that
one superseded path — at the observed zoom the uniform anchor gives
`a` ≈10.6px and a capital ≈3.2px with bars LEVEL across glyphs,
which is exactly what the screenshot showed; reconstructing "which
past version yields exactly this?" is what found it, not
re-measuring current code.

⚠⚠ **But the episode exposed a real methodology failure worth more
than the false alarm.** The §79e verification ("9.96–10.05px across
26 bodies") was CIRCULAR: the probe derived its expected ink top
from `atlas.inkTopLift(glyph)` and compared it to an overlay
*placed* from `atlas.inkTopLift(glyph)`. It could not have returned
anything else. Re-running that same shape against the user's report
produced 10.00px again and nearly became "works on my machine".
The §79e CONCLUSION stands — but it now rests on a link-by-link
proof against sources the render path does NOT consult, built here:
`getGlyphInk` re-measured against the atlas canvas's real pixels
(matches for all probed glyphs) · the shader's actual offset formula
`(position.xy − instanceAnchor) · uSpriteSize · instanceSize` read
from billboard.vert.glsl with `uSpriteSize` confirmed **1** · every
live sprite's `aAnchor` attribute equal to `baseAnchorY(glyph)`,
mode `base` · `getGlyphUV` mapping the FULL cell to the quad ·
px-per-world-unit measured independently at each unit's own depth.
Chained, those force the ink top to sit exactly `inkTopLift` above
the anchor, so the 10px gap is geometric, not asserted. **Standing
rule promoted to the scratchpad: a render probe must re-derive its
expectation from the ASSET or the SHADER, never from the helper
that positioned the thing.**

### 79h — the exit eyeball + phase close (2026-08-16)

**User-signed on all three exit items**, run across several test
battles at native resolution: (1) edge-of-viewport glyphs sit their
tiles — THE phase exit criterion, and the thing §79 existed to fix;
(2) the new block-glyph shapes on walls/half-cover/rubble read right
(they genuinely changed at 79g, real JBM instead of an OS
substitute); (3) the bar gap survives the 79g 1/64 ink shift.

**TODO closes.** Both exit-criterion items closed as one line +
pointer: the glyph ink-box auto-generation (open since 2026-07-03,
landed §79a — and the per-cell alpha it added went on to carry the
entire anchor convention, so the "stop hand-computing boxes"
cleanup turned out to be the foundation the rest of §79 was built
on) and the far-edge sprite alignment check (open since the Z3
playtest 2026-06-24 — its own note guessed cause (c) and flagged
the I2/J3 kinship, both confirmed; §79b measured ±9.1px, §79d took
it to 0.0000px and retired both workarounds). Also corrected a
stale TODO fact found in passing: a J3-era note still read "the
FontAtlas is now 32/32 FULL" — §29 grew the grid to 48 and it's
47/48 today.

**Phase verdict.** §79 opened as a targeted glyph fix (camera-up
anchor + ink click-boxes) and closed having replaced the anchor
CONVENTION, added a font-provenance guarantee, and fixed a live
licence breach. Three of the seven steps were user-inserted off
eyeball findings (79d2, 79e's structural turn, 79g) — the
instruments and the eyeball both working, not planning failures.
Everything it built is render-only: **no snapshot bump, World v35 /
Run v42 hold**, tests 2640 throughout.

### 79-post — the fresh-eyes audit micro-round (2026-08-16)

Not a planned step: the user had a fresh-context agent audit this
phase's worklog the day it closed ("anything that stands out as a
wrong call"), then signed the fixes as a same-day micro-round. Four
findings; none overturned the phase's engineering — the one wrong
call of the phase (79d2's uniform-line rule) had already been caught
and reversed by 79e. What the audit caught was in the CLAIMS and the
GUARD TIERS around the work:

**Finding 1 — the §79g "live breach is closed" line claimed more
than the tools proved.** The fix landed in the repo, but deploys are
BY HAND: the user uploads a build to a separate Pages repo at what
feels like a major milestone (usually a cluster boundary; the link
is semi-private, ~5 trusted testers). Landing 79g on `main` changed
nothing live — the audit probed and the live build still predates
79g (fontsource files, no licence text). User-accepted disposition:
the breach closes at the next milestone upload, when
`THIRD-PARTY-LICENSES.txt` rides along in `dist/` automatically; no
early upload needed for a five-person audience. Corrected in place
at §79g + the HANDOFF Last-phase cell; the deploy process is now
recorded in AGENTS — whose "playable at GitHub Pages" line turned
out to be a reference-style link with NO definition (broken since
the MVP), now reworded with the URL deliberately kept out of this
public repo.

**Finding 2 — the gen:font gates only ran at gen:font time**
(`7693f36`). "The generator fails the build" overstated: gen:font is
a manual script, so its catalog checks ran precisely when someone
was already thinking about the font. The dangerous path — a new
editor-authored catalog glyph outside the subset ranges, landing
without a regen — degraded to the DEV boot warn, the same tier that
let the §79f fallback run silently for weeks. Now
`tests/font-coverage.test.ts` asserts on every `npm test` that
GLYPHS ⊆ `SUBSET_RANGES` AND that the vendored TTF's cmap maps every
registered glyph (the ranges deliberately include PARTIAL upstream
blocks, so "in range" alone proves nothing). Enabler: gen:font now
runs under tsx, so it imports the REAL `GLYPHS` — the §79g mirrored
non-unit list is deleted, `SUBSET_RANGES` moved to
`src/render/fontSubset.ts`, the cmap reader to `tools/font/ttfCmap.ts`
(shared). Regen verified byte-identical (woff2 + fonts.css
untouched). Accepted residual: a stale committed woff2 after a
deliberate range/TTF change is still DEV-warn-only — reading woff2
cmaps means a brotli dependency, not worth it for that path.

**Finding 3 — "makes the render deterministic" overclaimed, and the
stand-line branch was one-pixel-brittle** (`a58bfe8`). Self-hosting
pins the font's PROVENANCE, not its rasterization — §79g itself
measured two builds of the same face rasterizing an ink edge one row
apart at the alpha threshold. §79d2's exact `ink.y0 === 0` branch
meant a platform rasterizer doing that at a block glyph's bottom row
would flip walls/rubble onto the baseline. Fix:
`INK_FLOOR_EPSILON = 3/64` (classification only; the anchor value is
unchanged). Sized off a fresh 47-glyph in-browser census — an
independent canvas probe against the running dev server, per the
79g-postscript probe rule (re-derive from the asset, not the helper):
floor family exactly 0 · nearest letterform ink bottoms `@`/`g` at
7 rows (the 0.109 the §79d2 tests recorded, reconfirmed) · `/` at
11 · baseline cluster 16–17. So 3 rows absorbs the observed one-row
variance class twice over with a 4-row guard band, and the census
proves the change behavior-neutral on this machine (no glyph sits in
(0, 3/64)). Boundary pins added headless.

**Finding 4 — the §79g npm-audit flag had no home.** Flagged "per
the side-task norm" but filed nowhere; a worklog paragraph is where
things go to be forgotten. Now a TODO Docs/tooling item.

Swept in passing: three stale comments (FontAtlas's `@fontsource`
reference and dropped-at-B1 palette-quant rationale; build-font's
determinism sentence). Tests 2640 → 2644 (+2 coverage guards, +2
epsilon pins); typecheck + lint clean; render-only, no snapshot
bump.

## Phase 80 — Feasibility audit docs

### §80 kickoff (2026-08-16) — code-reality audit + shape-lock

**The spec's locked feasibility facts (2026-08-05) all HELD at
re-verification** — with four deltas accumulated over §§74–79, each
folded into the corresponding doc's brief:

- **Sound**: the structural gap GREW — 20 files now reference audio
  playback (spec counted 17; §§74–78 added EventScreen,
  SectorClearedScreen, SectorMapOverlay, CharacterSelectScreen and
  friends, each with hand-written closures). `setMasterVolume`/
  `setMuted` confirmed still zero call sites — no volume/mute UI
  exists anywhere. The known reuse dispositions (`sector:cleared`=win
  sting, `healtick` ×3) stand.
- **Music**: unchanged (nothing exists; AudioPlayer's header names
  Web Audio as the upgrade path). NEW input: the §79g self-hosted-font
  round set the asset licensing/provenance precedent (compliance in
  the BUILD, `THIRD-PARTY-LICENSES.txt`) — the music doc inherits it
  as a requirement instead of reinventing it.
- **Achievements/tutorial**: still blocked on the nonexistent
  persistent store (the only persistence in `src/` is the DEV-only
  trace ring, `src/dev/traceStore.ts`); META-ROADMAP already names
  save/load as C6's hidden prerequisite. NEW inputs for tutorial:
  ⭐ DESIGN §Input accessibility (signed §78) + the planned post-C5
  UI style & robustness audit, which sequences BEFORE C6 — the
  tutorial doc must be written against both.
- **Telemetry**: still no server/network/CI code; deploys hand-
  uploaded. The never-emits-subscriber pattern proven in-tree
  (`TelemetryAccumulator`, `TraceRecorder`). NEW inputs: the
  on-demand hcloud box (a candidate ingest host with established ops
  discipline) and decisions.csv/the board protocol as the shape of
  what offline telemetry already measures — online telemetry is the
  human-arm complement to the §53g human-gauntlet baseline.

**Shape-lock (user-signed 2026-08-16):** five docs in a NEW `plans/`
directory (root-level would dilute the curated living-reference set;
these are forward-looking proposals) · the 80a–80e cut as written
into ROADMAP §80 (achievements+tutorial share one commit — same C6
dependency) · all `docs(...)` commits, zero implementation, no
snapshot risk.

### §80a — the sound-registry proposal (2026-08-16)

`plans/sound-registry.md`. The audit's headline is a CENSUS
CORRECTION: the kickoff spec's "~30 hand-written bus.on closures
across 17 files" counted every play() site — the fresh census splits
the ~45 sites into three mechanisms, and the event-keyed half is
exactly **7 closures** (4 page-lifetime in Game.ts, 3 scene-lifetime
in BattleScene with the two filters — inert-neutral deaths, zero
heals). The FX_REGISTRY half (15 sound-carrying keys) is already
table-driven and healthy; the ~35 direct UI click sites are
interaction sounds with no bus event to key to — both dispositioned
OUT of the registry's scope. So the structural problem is not
volume but the missing COVERAGE GUARANTEE: a new bus event ships
silent by default with nothing to notice.

Proposal accordingly: a small `EVENT_SOUNDS` table + an explicit
`SILENT_EVENTS` list + a coverage pin asserting the two partition
the event catalog (the §78d EMPOWER_DISPLAY / §79-post font-guard
idiom) — a new event fails `npm test` until its author picks
cued-or-silent. Filters become named `when` predicates (typed,
unit-testable). Reuses dispositioned in the doc: `win`×2 KEEP
(67b's comment stands), `healtick`×3 — the PromotionScreen borrow
flagged as the one unprincipled use (stat ticks ≠ healing),
`pickup`×2 principled. ~10 candidate uncued events listed
(battle:started/ended, deck feel, empower, node-arrival stings) vs
the deliberately-silent movement/bookkeeping class (incl. the 27e
post-playtest apply-flash cut and the action:phase double-fire trap
on unit:attacked). C6 must-not-break: AudioPlayer keeps volume
policy (options menu routes through setMasterVolume/setMuted);
sim never imports the table; the music bus splits the volume axis
BEFORE a single-slider options menu hard-codes against it; the pin
is a gate with EMPOWER_DISPLAY standing.

### §80b — the music plan (2026-08-16)

`plans/music.md`. The audit sharpened four things beyond the
kickoff facts: (1) the B6 autoplay-unlock assumption ("the first
trigger is a map-node click") is FALSE for music — a bed should
already be playing on character select, so the plan specifies a
page-lifetime any-gesture unlock instead; (2) the upgrade is a
HYBRID, not a migration — a Web-Audio MusicPlayer for the three
things HTMLAudioElement can't do (gapless loop, GainNode
crossfades, ducking under the win/lose stings) while the proven SFX
pooling stays untouched; (3) the track state machine needs ZERO new
events — encounter kind already rides `turn:starting`, scene swaps
are centralized in Game; (4) assets are the long pole and stay an
open design-round call (licensed Opus tracks under the §79g
build-enforced licensing precedent vs gen-sfx-style procedural/
tracker chiptune), exit criterion a listening session. C6
must-not-break: the volume-axis split (2-or-3 sliders) decided
BEFORE the options menu bakes in one slider; settings persistence
rides the same C6 store as save/load; stings stay SFX with music
ducking — two lanes, two jobs.

### §80c — achievements + tutorial plans (2026-08-16)

`plans/achievements.md` + `plans/tutorial.md`, one commit (the
shared dependency). Both docs EXPLICITLY confirm the C6
persistent-store dependency — the §80 exit criterion — and both
route it to ONE store designed once in C6 with all four consumers
known (save/load · achievements · settings/volume · tutorial
seen-flags), versioned from day one per snapshot discipline.
Achievements held to the kickoff scope guard (confirm, design
nothing): detection is the proven never-emits-subscriber pattern
(TelemetryAccumulator/TraceRecorder precedents) reading the
45-event bus; the four must-not-break rules are the store version,
bus-only detection, no mid-run feedback (unlocks resolve at run
creation — determinism), and fuzz runs never write the store.
Tutorial's audit found its strongest feasibility fact:
**determinism makes a scripted teaching run nearly free** — a
pinned seed + the existing RunConfig/run-config tooling yields a
byte-reproducible authored first run (known board states, no
reactive hint engine); the §74 event-page grammar noted as a
candidate vehicle, not pre-committed. Must-not-break: DESIGN
§Input accessibility as curriculum law (teach the mouse route,
hotkeys are accelerators) · key labels derived from the Keybindings
registry (C6 ships rebind — literal "press M" strings go stale) ·
the post-C5 UI audit sequences BEFORE the tutorial (callouts author
against audited idioms) · the scripted run stays an ORDINARY run.

### §80d — the telemetry plan (2026-08-16)

`plans/telemetry.md`. Two audit products beyond the kickoff facts.
(1) **Determinism collapses the design**: a payload is `seed +
command log + build id` (a few KB), and analysis is REPLAY through
the existing headless harness — decisions.csv-grade human-arm data
from the §68 instrument kit, no client-side metrics at all (the
53b trace format is the near-complete substrate). (2) **The
structural finding — build identity**: the hand-upload deploy
story means live players routinely run a STALE build, so an
unversioned trace silently diverges on replay against HEAD; every
trace carries a baked build hash, and replay checks out that
commit (the 47e worktree-pin pattern). Transport dispositioned in
tiers with an honest cost read: manual export = v1 (zero infra,
sharing IS consent, right-sized for the semi-private population);
the always-up ingest endpoint deliberately NOT recommended — it
reverses the §62 on-demand ops model for marginal capture;
third-party analytics rejected. C6 must-not-break: never-emits +
player-initiated export only · opt-in consent row if tier 2 ever
lands · capture stays Game-layer (fuzz produces no telemetry) ·
DEV/PROD split as a build flag (the §79f silent-fallback shape,
applied to player data).

### §80e — docs close (2026-08-16)

The close ritual, docs-phase-sized: ROADMAP §80 demoted to the
stub + outcome breath; HANDOFF cursor flipped (§§73–80 ✅, NEXT =
§81, §79 condensed into Before-it per demote-as-you-close);
META-ROADMAP's Cluster 6 section gains the READ-THESE-AT-SPEC-TIME
pointer to the five plans/ docs + the one-store-four-consumers
rule. Every §80 exit criterion met: five docs in the repo, each
with a "what Cluster 6 must not break" section, achievements +
tutorial explicitly confirming the C6 store dependency. Zero
implementation, zero code touched — the scope guard held end to
end (five docs commits + kickoff + this close; every hook run
green at 2644/typecheck-clean; fuzz never triggered, correctly, as
no sim/run/core/config path was staged all phase). OPEN RIDER: the
user's read of the five docs — §80 closed on the objective exit
criteria; content amendments land as follow-up commits (the
78a-style "rides with the user" pattern applied to docs). No
scratchpad entries this phase — the census-correction lesson is
already covered by the standing step-zero norm (re-verify the
premise against current code), which is exactly what caught it.

## Phase 81 — Procedural parity ("Uncharted Ground" catch-up)

### §81-kickoff — code-reality audit + shape-lock (2026-08-17)

**Audit verdict: no premise rot — genuinely additive.** Every seam
the charter needs exists:

- The generator ([proceduralMap.ts](src/sim/proceduralMap.ts)) knows
  three surface features (walls · half-cover · `shallow_water`); the
  noise field already carries the structure the §37 tiles slot into
  (high → cover, low → pools).
- **Theme doesn't reach the generator today** — `generateTerrain`
  has no theme param (theme is renderer-only, threaded via
  `EncounterMap`; procedural inherits the SECTOR's theme,
  Run.ts `buildEncounterMap`). `applyTerrain` holds the encounter,
  so threading `encounter.theme` down is a one-line change. Six
  themes exist; shipped sectors use grassland + swamp.
- **Camps are fully generic downstream of the layout**:
  `GeneratedTerrain.campSpawns + camps` → `spawnCamps` works off any
  source (the procedural path fills `[]` today). Generator emits
  tiles + a `CampRef[]` pool ⇒ identity roll (`campSetup` stream),
  portal drip, hostility, rewards, render all work with ZERO
  downstream changes.
- **No new #125 stream keys**: all new draws ride the existing
  `'terrain'`-derived RNG inside the generator; camp identity stays
  on `'campSetup'`. Added draws reorder the procedural stream — the
  deliberate procedural-arm re-pin the roadmap predicts. Authored
  layouts consume zero draws in this path — provably untouched.
- **Snapshot prediction: NO bump (Run v42 / World v35 hold).** All
  five tile kinds are already in the serialized `TileKind` union
  (§37) and camp instances already serialize (World v35, §75b).
  Config schema widens only.
- **Hazard found: `deep_water` is impassable (cost ∞)** but the
  generator's connectivity BFS treats only walls/half-cover as
  obstacles, and the obstacle cap doesn't count tiles. The internal
  cell model + both guards must learn impassable tiles or a swampy
  seed can seal the crossing un-carveably.
- **New decision surfaced (not in the charter): camp symmetry** — a
  single camp on a mirror/point board hands one team a free detour;
  the user's §75j placement pass cared about exactly this.
- Rider candidate: the legacy C1a `wallDensity` /
  `shallowWaterDensity` knobs are dead in this path ("slated for
  removal" per terrainGen's own header) — delete while in the file.

**Shape-lock resolutions (user-signed 2026-08-17):**

1. **Theme→tile palettes** — starting proposal approved: grassland
   hills/mud/shallow · swamp mud/shallow/deep · tundra
   ice/deep/hills · desert sand/hills · barren hills/sand ·
   **volcanic hills/sand + SPARSE FIRE** — the user REVERTED the
   "fire stays hand-authored" call: too thematic to skip; kept low.
   (Procedural fire is volcanic-only; `GeneratedTerrain.fires`
   parallel readout must be filled on the procedural path — it was
   hand-authored-only since D7.B.)
2. **Theme→camp pools** — starting proposal approved (frost-coven →
   tundra · banshee-barrow/ghoul-nest → swamp · bandit camps →
   grassland/barren/desert); density a weighted 0/1/2 per board;
   pools over the §75 5-camp catalog only (scope guard). Exact
   assignments + weights signed at 81c on visible maps.
3. **Camp symmetry (user call)** — placement rolls a MODE: symmetric
   pairs and mid-band split evenly, occasional free/asymmetric
   placement as a RARE occurrence (spice, not the norm). Weighted
   mode knob, dialable.

**The cut** (ROADMAP §81): 81a theme thread + per-theme tile layer
(headless-first; guards learn impassable tiles; arm re-pin) → 81b
procedural camps (per-theme pools + density + the mode roll;
density-0 byte-identity pin) → 81c design round (palettes/pools/
densities signed on visible maps; native eyeball on a handful of
seeds) → 81d docs close. Both build steps predict NO snapshot bump.

### §81a — theme thread + the per-theme tile layer (2026-08-17)

Landed to plan. `generateTerrain` gains a `theme` param (default
`grassland` keeps theme-agnostic callers valid; `applyTerrain`
passes `encounter.theme`); `ProceduralSchema` gains `themeTiles` —
an exhaustive `Record<Theme, …>` (the sectors.ts pattern) of
OPTIONAL range knobs (`poolDensity` override · `deepWaterFraction`
· `hills`/`ice`/`sand`/`mud` patch densities · `fire` scatter
chance), where absent = off = no draw, so each theme's draw count
is fixed by its declaration. Generator mechanics: the pool band's
lowest noise slice deepens to `deep_water` (deep centres stay
wrapped in shallow rim; fords/carves never deepen); ground patches
claim open floor off per-kind value-noise fields in the fixed
`PATCH_KINDS` order; volcanic fire is a sparse per-cell roll that
skips chokepoints. Both guards learned blocking tiles: deep water
counts against `wallCapFraction` and trims/carves to SHALLOW (a
drained breach) — the kickoff's seal-the-crossing hazard closed
and pinned. Legacy C1a knobs (`wallDensity`/`shallowWaterDensity`/
`ensureConnectivity` flag) deleted, schema + json + fixtures. The
mapgen-prototype tool grew the Theme select (live in both modes;
manual mode resolves declared knobs at centre/midpoint), the six
tile colours + legend + Deep/Fire stats — it's the 81c
design-round vehicle.

- **NO snapshot bump, as predicted** (Run v42 / World v35 hold —
  tile kinds + camp registry were already serialized).
- **Proof**: 2657 main green (+13: per-theme presence derived from
  config, deep-water connectivity across all symmetry modes ×
  seeds, cap-counts-deep, patch-floor-only, fire-sparse+choke-free,
  symmetry-of-tiles, all-off-changes-nothing, per-theme draw-count
  pin) · typecheck clean · fuzz:smoke 398 green after ONE
  re-baseline: the arbitratedStrategy frontier-hunt scan widened
  trials 4→8 (themed battles re-routed the walk trajectories; the
  scan-over-pin shape absorbed it — no pinned-value changes
  anywhere else, the predicted "procedural arm re-pin" turned out
  this cheap). Browser: tool driven headlessly-in-page (volcanic
  Fire 2 / swamp Water 38 + Deep 14 in the stats strip, zero
  console errors); native colour eyeball rides with 81c.
- **200-seed distribution probe** (scratchpad, avg tiles/map at
  G=16): swamp 22.4 shallow + 2.3 deep + 3.2 mud · tundra 5.0 ice +
  0.9 deep · volcanic 1.5 fire + 2.6 hills · desert 12.4 sand +
  6.4 oasis water · grassland/barren light accents. ⚠ 81c dial
  fact: interpolated value noise CLUSTERS MID-RANGE, so low
  thresholds under-fire — deep water lands on only ~45% of swamp
  maps (90/200); if the design round wants deep-per-map, raise
  `deepWaterFraction` well past intuition or the pool override.

### §81b — procedural camps (2026-08-17)

Landed to plan; user native eyeball of the 81a maps signed before
this step ("look great"). The envelope: `procedural.camps` =
`density` (site count 0/1/2, weighted ints) + `placement` (the
user-signed mode weights: pair 0.45 / midBand 0.45 / free 0.10 —
rare asymmetry as spice) + `spawnStandoff` (3, Chebyshev from
every spawn tile) + `pools` (exhaustive per-theme CampRef lists
over the §75 catalog; **volcanic ships EMPTY** — its resident is
an 81c decision). Sampling burns TWO unconditional draws (count +
mode) so the stream never depends on outcome or pool; an empty
pool zeroes the count after the draws. Placement runs on the
FINISHED grid (post-cap, post-connectivity): hostable = passable
(shallow/patches fine — the fetidPond precedent), not fire, not a
chokepoint, not spawn-band, standoff respected; `pair` places at
the map's own partner geometry (mirror for `none`), degrades to
midBand when count 1 or no pairable cell; midBand = the middle
third of rows; thin candidate sets under-place rather than force a
bad tile. `terrainGen` pairs sites with the theme pool
(`spawnCamps`' pairing invariant enforced both ways); downstream
§75 machinery (campSetup identity roll · drip · hostility ·
rewards · render) needed ZERO changes, as the kickoff audit
predicted. `assertProceduralCampRefs` boot-guards the pools in
camps.ts (import direction camps → terrain, the layout-side
sibling). The mapgen tool renders sites as violet rings + a Camps
stat (config mode; manual keeps camps off).

- **NO snapshot bump, as predicted** (Run v42 / World v35 hold).
- **The dose-independence pin** (the step's headline): density 0
  vs 2 on the same seed → byte-identical tileGrid/walls/halfCovers
  — camp placement rides strictly AFTER terrain in the stream, so
  the §83 board can dial camp density without re-pinning terrain.
- **Proof**: typecheck clean · 469 green across the touched files
  (+15: dose-independence · hostability incl. deep/fire exclusion +
  standoff · pair-partner across all three symmetry modes ·
  pair-degrade at count 1 · midBand confinement · uniqueness +
  determinism · empty-pool-forces-0 + stocked-pool-rolls · the
  pairing invariant through generateTerrain · volcanic-never-camps
  · the draw-count pin extended (+2 camp draws)) · tool driven
  in-page: swamp config roll shows Camps 2 + legend entry, zero
  console errors. The commit hook caught ONE casualty: the
  catapult integration seed 7 fizzled (target dies mid-flight on
  its reshaped board — the documented 43a class; 13/15 probed
  seeds still hit, mechanic healthy) → re-seeded 7→8 with the
  precedent note extended. Final gate: 2666 main + 398 fuzz:smoke
  + typecheck, all green (`58b7883`).

### §81c — the design round (2026-08-17, in progress)

The user's native tool session (plus one comedy beat: five minutes
rerolling VOLCANIC hunting for camps — the one empty pool 🙈):

- **Camp placement SIGNED** — pairs/mid-band/rare-free at 45/45/10
  reads right on real maps.
- **Volcanic stays EMPTY, signed** — until a thematically
  appropriate resident exists (a "nothing lives here" signature is
  coherent for the fire theme meanwhile).
- **Density re-dialed 50/35/15 → 35/45/20 (user call)**: procedural
  boards are rare enough that a camp-free majority felt too flat —
  the no-camp weight drops to ~a third, most boards now carry one
  camp. Dose-independence means the dial moves zero terrain pins.
- **Tile palettes/densities + camp pools SIGNED as shipped**
  (2026-08-17, after the dial commit): deep water stays
  sometimes-there (the ~45% swamp read accepted — no push needed);
  pools stand as authored.

### §81c2 — the ground-clip fix (2026-08-17, eyeball insertion)

The user's screenshot: glyphs lerp THROUGH the ground stepping from
a low tile to a high one (§37's per-cell height field + §81 making
hills/height-contrast common surfaced it). Diagnosis: at rest the
§79 base-anchored quad can't sink by construction, but
`animateStep`'s LINEAR Y spends the whole second half of a
low→high step with the anchor below the destination tile top —
the glyph's lower band depth-clips into the tile mesh. The user
flagged the trap themselves: any naive world-Y float re-opens the
§79 anchor work.

**The fix — a ground-aware lerp that never touches anchor math:**
`SpriteAnimator.startGroundLerp` re-times Y only (XZ stays linear):
climb-early (rising Y completes by t=0.5) / descend-late (falling
Y starts at t=0.5), matching the §36 50%-mark logical-position
flip — so the anchor sits at-or-above the surface of whichever
cell it's visually over, continuously, no pops, no per-frame
terrain sampling, zero screen-space lift changes (§79 untouched).
Consumers: `animateStep` (moves + swaps) and the §36c settle-backs;
projectiles/tracers/shoves keep the plain lerp (they fly). First
half of an ascent the glyph's feet can occlude behind the higher
tile's near face — that's correct occlusion (approaching a step
from behind it), distinct from the sinking artifact.

**Proof:** typecheck clean · in-page throwaway-animator probe with
a stub sprite sink, exact samples at t=.25/.5/.75/1 — rising
y=0.3→0.5→0.5→0.5, falling y=0.5→0.5→0.3→0.1, flat constant, XZ
linear throughout · a fresh full battle (Soldier → starting event
→ battle) ran real moves through the new path with zero new
console errors. Render-only (no tests by policy). **The native
feel eyeball PASSED — user-signed 2026-08-17 ("nailed it").**

### §81d — docs close (2026-08-17) — §81 CLOSED

The close ritual: DESIGN gains §Procedural parity (the four signed
design facts: per-theme palettes incl. the volcanic-fire revert ·
per-theme pools with volcanic deliberately empty · the 45/45/10
placement fairness doctrine · dose-independence) + the Camps intro
widened to both placement sources; ARCHITECTURE tree annotations
(terrainGen/proceduralMap/SpriteAnimator) + the SpriteAnimator
section's groundLerp paragraph; ROADMAP §81 demoted to the stub +
outcome breath; HANDOFF cursor flipped (§§73–81 ✅, NEXT = §83);
TODO gains the mapgen empty-pool-hint line (the user's five-minute
volcanic camp hunt); agent memory snapshot refreshed at the phase
boundary. Phase summary: inserted at 75j2 as a catch-up, closed in
ONE session-day with every step user-signed, zero snapshot bumps
(both predicted), and the §83 board inheriting a procedural arm
that now measures FINAL content — the whole point of running §81
before the rebalance. No scratchpad entries: the phase ran clean
on the standing norms (step-zero audit, headless-first, the
scan-over-pin shape, pause-per-commit).

### The §82 insertion — reward & weapon feel round (2026-08-17, user call)

Same session as the §81 close, before the new-session handoff: the
user needs several FEEL changes to the reward tables plus a change
or two to weapons — inserted as a NEW §82, renumbering the closing
rebalance §82→§83 (the second renumber on this roadmap; the 75j2
precedent replayed). The ordering logic writes itself: reward/weapon
changes are CONTENT MOVERS, and the closing board must measure
final content — the same rule that put §81 before the rebalance.
**Deliberately NO step cut** (user call): an iterative sit-together
tuning session, changes landing as signed, commit-per-change behind
the usual gate; the kickoff ritual applies only in miniature.
Sweep: every live-doc forward ref §82→§83 (ROADMAP · HANDOFF ·
BALANCE rider pointers · TODO · DESIGN · META-ROADMAP · this file ·
the agent memory), the two historical renumber narratives (75j2 +
the 75j close) restored to their as-happened "§82" phrasing;
archives untouched; zero code/src refs existed. ROADMAP title +
ordering breath re-authored; the §82 charter written (scope guards:
feel only — no new mechanics, no new reward kinds, no schema
widening; snapshot prediction NO bump, a surprise = stop-and-ask).

## Phase 82 — reward & weapon feel round

### The mixed-table split, first slice: bits ⇄ packets (2026-08-17)

The user's opening call: fewer mixed-type reward tables — a table
that MOSTLY pays bits but sometimes swallows the bits and pays a
packet instead reads as noise, not texture. First slice (user had
already pared the tables, unwired): `bits-small` / `bits-large`
are now PURE bits; the packets moved to new `packets-small` /
`packets-large` tables fired as SEPARATE chance refs riding the
existing per-ref independent-chance mechanism in `rollRewards` —
no engine change, pure config wiring. Every `bits-small` ref
(encounters + camps) gained `packets-small` at chance 0.3 (user's
number); every `bits-large` ref gained `packets-large` at 0.5
(the old mixed table replaced bits with a packet ~60% of the
time, so 0.5 keeps large-tier packets common — dialable). Net
feel change, deliberate: bits are now GUARANTEED where they used
to be swallowed, and the packet is a bonus on top — a mild
generosity buff everywhere the pair fires.

Noted, deferred: the `events.json` `rewardOverride: "bits-large"`
terminal pins a SINGLE table at chance 1, so that event-pinned
fight now pays bits only — no packet chance rides an override.
Fine for now; revisit if overrides should carry ref lists when
the daemon-cache / boss-hoard splits land (next slices).

Test fallout, all shape pins: the brigands skeleton-ref pin
(now two refs), the 48b offer-length pin (config-derived now),
declineReward (drains the whole offer). Suite + typecheck +
fuzz:smoke green.

### 82b — the tier-pure split: daemons / packets-elite / packets-boss / bits-boss (2026-08-17)

The second slice, shape-locked in-session and user-signed, with the
mini-cut written into the ROADMAP (the override widening pulled in a
snapshot bump + editor work, so §82 gets checkboxes after all — the
charter's stop-and-ask fired exactly as designed and the user signed
the exception). `daemon-cache` and `boss-hoard` carried byte-identical
10-daemon lists, so they collapse into ONE shared `daemons` table;
the packets carve into `packets-elite` (hype/venom/overclock) and
`packets-boss` (miner diluted with overclock + surge — the user's
call: miner alone at 0.75 was too strong; at weight ⅓ it lands on
~25% of boss kills, up from the old ~14%, dialable); the hoard's
bits become `bits-boss` (25–40). Wiring is TIER-PURE, not additive
(the stacking trap caught at shape-lock: elites/bosses already
carried bits-large@1 + packets-large@0.5, so a literal add would
have doubled both lines): elite = bits-large@1 + packets-elite@0.5
+ daemons@1 · boss = bits-boss@1 + packets-boss@0.75 + daemons@1 ·
bits-large/packets-large revert to camp-only tables. The signed
generosity jumps: elite daemon rate ~36%→100%, boss ~71%→100%
(owned-daemon exclusion still applies — a full collection rolls
nothing). Boss bits stay near-flat by construction (old expected
~32, bits-boss mean 32.5). The `outskirts` override re-points at
`daemons` INTERIM (guaranteed daemon — closest to the old cache's
intent) until 82c widens overrides to ref lists. The cache's old
12–20 bits entry dies uncarved — elites already pay bits-large.
Zero test fallout (the 82a pins were already config-derived); the
encounter-editor fixture's synthetic table ids are schema-only by
design and stand.

### 82c — rewardOverride widens to a ref list (Run v43) (2026-08-17)

The user's catch-turned-call from the 82a close: an event terminal's
`rewardOverride` was a SINGLE table id rolled at chance 1, so the
mixed-table split left event-pinned fights unable to carry the new
multi-table chance mixes. Widened end to end: the events schema
(`rewardOverride?: EncounterRewardRef[]`, non-empty — "no rewards"
is omission, never `[]`), the boot ref-check (per-ref table ids),
`Run.pendingRewardOverride` (ref list on the wire, copied both
directions — the field can alias authored catalog objects), and the
won-boundary consume site collapses to `override ?? encounter refs`
(the refs carry their own triggers now). RUN_SCHEMA_VERSION 42→43,
flat reject per convention — no migration ladder exists and none
starts here. The event-editor formatter emits the ref list under the
encounter-editor's shared leaf convention (one inline
`{ table, trigger }` per line, single-element inline — verbatim-pin
green); editor.ts gets an HONEST INTERIM shim (single-table select
reads ref 0 / writes a chance-1 singleton, tooltip flags the
multi-ref collapse) until 82d builds the real UI.

Two catches worth their lines: the ROADMAP's 82b box shipped
unflipped in 82b's own commit (flipped here — the demote-as-you-go
rule applies to checkboxes too), and a THIRD shipped override
surfaced only when the schema went strict — hostage-trio pins
`hostage-rescue`, invisible to the earlier VALUE-keyed grep
(`bits-small|bits-large|daemon-cache|boss-hoard` — the table name
wasn't in the pattern). The module-load ZodError caught it in one
run; converted to a chance-1 singleton, behavior identical. The
`outskirts` event now pins the full elite trio (bits-large@1 +
packets-elite@0.5 + daemons@1 — the 82b interim single-`daemons`
pin retired); `guardians` stays bits-large-only as signed.

### 82d — the event-editor override ref-list UI (2026-08-17)

The 82c interim shim retired: `makeOverrideControl` renders the
absent state as one "+ reward override" button and the present
state as one row per ref (table select with the catalogSelect ⚠
out-of-registry convention · a [0,1] chance input · ✕) plus
"+ ref". Removing the last ref DELETES the key — the UI can't
express the empty list the schema rejects, so that floor never
surfaces as a validation complaint. The formatter needed nothing
(82c landed the emit + verbatim pin); no new tests — editor.ts is
render/ui-policy (eyeball-only), and the browser pass below is the
verification of record.

Browser-verified on the dev server (DOM-driven; the Browser pane
wasn't compositing so no screenshots, and read_page's a11y tree
turned out BLIND to the whole choices section — element queries
via javascript_tool did the work): add-override, add-ref,
live chance edit (0.3 propagated to the preview emit), remove-to-
single (collapses to the inline form), remove-to-last (key
deleted, button restored), validation pane green + Save enabled
end-state. One self-inflicted scare with a lesson: the page
COMBOBOX at the top of the pages pane is the ENTRY-PAGE selector,
not a page navigator — form-filling it to "navigate" mutated
`entry` and tripped the reachability assert ("'start' unreachable
from entry 'guardians'"), which read as a UI bug for a minute.
Revert-all cleared it; the committed file was never touched (Save
correctly stayed disabled throughout).

### 82e1 — the catapult release gate (sim + schema) (2026-08-17)

The catapult problem, reframed at ideation (user-signed, the B design):
the 2 s wind-up was FAKE counterplay — the shot homes and nothing
rechecked position after propose, so the wind-up was pure delay and
the "absurdly short/long shots" (rare before, common under the
officer's mobility aura) were the renderer faithfully drawing that
lie. The gate makes the telegraph REAL: at the `release` boundary the
EXACT propose-time predicate re-runs (`firingBandCell` — positioning's
one-predicate rule, which its own doc mandates for any future range
gate) against the target's live position; dead / out-of-band /
LOS-blocked → HOLD FIRE. The abort is the §36c family one step later
in the lifecycle: activeAction clears with nothing fired (no phase
event, no effect, NO RNG draw), and instead of §36c's reset-to-0 the
cooldown is set to the RE-AIM window — `releaseGate: { reaimSeconds,
scalesWithSpeed }` on the ability def (nested, user call), authored
`{ 1, scalesWithSpeed: true }` on the catapult so every one of its
time costs shrinks together under haste (the anti-synergy the flat
version would have authored: speed shrinking the windup but not the
penalty). Schema refinements: a gate requires a `release` timeline
phase and the `enemyInRange` selector. `unit:actionHeld` announces
the hold (consumer: 82e2's drain bar). The offset-0 start path skips
the probe deliberately — propose validated the band the same tick.

NO snapshot bump (nothing new serialized — the save/load test drives
the SHIPPED catapult def through the wire mid-windup and holds in the
clone; synthetic defs can't round-trip, `createAction` resolves defId
via the real catalog). Fallout: the attack-editor formatter verbatim
pin forced the emit half of 82e3 in early (releaseGate after
timeline, scalesWithSpeed omitted at default false — the §30a
canonical-convention rules); the editor UI half stays 82e3. Design
options rejected on the way (worklog'd at ideation): impact-recheck
(A — deferred, ~5 lines on top of this if travel-window escapes
offend), windup cut (honest but forecloses the real-telegraph
upside), ground-target (a redesign), re-home (the F2 unfairness
note stands). 8 new tests (schema 2 + behavior 6).
