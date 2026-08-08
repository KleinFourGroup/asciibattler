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
0.25/0.2 + spacing 2–3 pattern), LAUNCH-ROUGH for §81. Knock-ons
owned eyes-open: the one-event-per-hop scatter ceiling (§77's ratio
pass is the real control), battle-less width-2 hops (rest+event fills
both slots), the sharpened economy tradeoff (hop-scaled enemies vs
per-fight income — a first-order channel at 0.5 density, §81 reads
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
  eventChance=0 control arm. Not yet a summary.csv column (§81's
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
readEpsilonAA has never read; the §81 board round re-reads it. (3)
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
broken, but not often"; no engine toast (a §81 feel-read revisit if
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
best-strategy outputs regenerate at the next probe; §81 board
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
and demoted the ROADMAP section. Carried forward: the ε floor §81
re-read · the gambler parity repair (§81 first item) · the §77
stress test + ratio pass · the browser-cell gauntlet watch item ·
launch-rough event balance (§81 reads the event era).

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
- +13 tests (camps registry 6 + rollout camp arm 1 + roundtrip §75b
  block 6 — count pending hook verification at commit); typecheck
  clean; the six touched files green pre-commit.
