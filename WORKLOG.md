# WORKLOG — Round 6 (Instruments)

Per-round narrative log (AGENTS "The planning stack"): findings, decision
rationale, rejected alternatives, scope changes, playtest verdicts land
here under the matching `## Phase N`; the ROADMAP stays a plan (one-line
mutations + a pointer back here). Created 2026-08-21 at the Round 6
kickoff's mechanical half; the spec session's `## Kickoff` entry lands
next. Prior round's log: [archive/post-72-worklog.md](archive/post-72-worklog.md)
(Cluster 5).

## Post-C5 planning (2026-08-21) — the session that produced META-ROADMAP v2

The user opened a planning session at the Cluster-5 close: reorganize
everything left, find the missed features, plan the next phase of
development. Output: [META-ROADMAP.md](META-ROADMAP.md) v2 (seven
rounds 6→12), commit `daff9a0`; the v1 six-cluster plan archived →
[archive/post-x-meta-roadmap.md](archive/post-x-meta-roadmap.md).
This entry carries the findings; the roadmap carries the order.

### The structural read

The v1 META-ROADMAP was a SYSTEMS roadmap and was spent: five of six
clusters closed, every "model before content" seam in place. What was
left on paper — the balance interstitial + a "Cluster 6" that had
accreted from difficulty/unlocks/ship into the store's four consumers,
music, the sound registry, telemetry, and a Steam-shaped ship — hid
three kinds of work nobody had named: **content volume** (2 sectors, 19
encounters, 13 events, 5 camps, 11 layouts, ~30 unit defs — no roadmap
built more game), **a title/main menu** (implied by half of C6, listed
nowhere), and **ship engineering** (i18n, browser matrix, touch,
toolchain). Decisions signed in the conversation: fold first inside the
interstitial; THREE acts; Steam-shaped via Electron (bundled Chromium —
the WebGL/Web Audio matrix collapses to one renderer; Tauri's system
webviews bring it back); i18n IN, retrofit before any further content
(census: ~150 DOM text assignments across 46 ui/scene files — an
undercount — plus ~270 config prose fields, events 122 of them);
foundations before content (mid-run save makes act-2/3 playtests
possible without replaying act 1); the §80 `plans/` docs reviewed and
signed with ONE amendment — the tutorial is *deterministic board,
reactive callouts* (a pinned seed guarantees the teaching material; the
callouts are condition-triggered like §74 event conditions; no control
is ever disabled — the user's objection to "scripted" was right);
reject-stale saves until 1.0 (no migrations; bumps in Rounds 9–10 stay
cheap; one `BUILD_ID` shared by store/saves/traces).

### The feature-list audit (five parallel read-only sweeps, ~6 min)

Nineteen user-listed items, each checked against HEAD before it was
placed. The headline: **nine were mechanisms**, which is what inserted
Round 9 (Extensions) ahead of the content round — the C1/C2 shape
again. Per item, the load-bearing fact + where it cites:

- **Lifesteal** — no op; the op union is `damage|heal|move|applyStatus|chain|summon`
  (`src/sim/effects/schema.ts:347`); `World.applyDamage` returns a
  boolean (`World.ts:1106/1146/1168`) and `FireScratch` carries only
  `missed`. But the K1 `dealHit` trigger already carries resolved
  `damage` (`src/sim/triggers.ts:32`), and `BattleRule`'s handler
  destructures it away (`battleRules.ts:137`) — a `healActor` effect
  arm is ~15 lines. The ability-native op needs the boolean→number
  widening + a scratch accumulator.
- **Deck-event daemons** — none exist; the three `deck:*` events are
  "cue-not-truth" (`src/core/events.ts:604-632`). Trigger kinds today:
  `turnStart|encounterStart|encounterEnd|dealHit|kill`
  (`src/config/daemons.ts:42-59`). Chokepoints `Run.drawCard` (:3860)
  / `discardCard` (:3846); a chance-gated draw hook needs a 4th
  `'daemon'` RNG site + a serialized per-draw counter (Run bump);
  `grantEmpowers` only queues player-spent budget — an auto-apply op
  is new.
- **Enemy-only auras** — config today: `affects:'enemies'` exists and
  is pinned (`aura.test.ts:162`); pure team-inequality, so it spans
  passive camps (`World.ts:1719-1722` documents the widening).
- **Specials** — `AbilityDef.priority` exists (`schema.ts:462`); dash
  proves cooldown ≫ duration. Gaps: `proposeSelfAbility` routes `self`
  to summon-or-move only (`propose.ts:211`) — a self-buff arm is ~10
  lines; priority is static; a `self` `heal` op silently no-ops.
- **Moving 2×2** — A* is footprint-correct (`Pathfinding.ts:102-119`)
  and the renderer lerps a footprint walk (`BattleRenderer.ts:982`);
  1×1-blind: `destinationBlocked` (`World.ts:1836`), `claimCell`
  (:1857), `spawnTeam` (`battleSetup.ts:94` — no fit check), overflow
  spawn (:1801), sidestep/swap `return null` on N>1 (`movement.ts:612`).
  Only `rubble_2x2`/`_3x3` carry `footprint>1`.
- **Ability-granting packets** — abilities are fixed at FOUR spawn
  sites (`battleSetup.ts:113`, `World.ts:2005/2048/2407`) from the
  catalog; `encounterEffects` carries stat-keyed `StatusEffect`s only;
  `UnitTemplate` has no abilities field (`Unit.ts:181-211`). World
  already round-trips ability ids (`World.ts:2833/2709`).
- **Event resume** — `resolveEventNext` nulls the cursor BEFORE both
  terminals (`Run.ts:1670`); no `resumePage` field; win → recruit /
  sector-advance with no event consult (`Run.ts:3409`); `EventTerminal`
  is exactly two kinds (`src/config/events.ts:142-148`). Keeping the
  cursor across battle breaks no invariant; a separate field needs
  Run v45. Harness/walker arms fine (visit counting at
  `harness.ts:705` won't double-count).
- **Event pool display** — bits already show via the page-lifetime
  `BitsOverlay` chip (`Game.ts:206`); pool = one `renderPoolGauge`
  call (`src/ui/poolGauge.ts:10`, the PreTurnScreen shape).
- **Exhaustion** — never existed; the memory is H7's inert fatigue
  placeholder (`fatiguePerStack` 0 in `config/health.json`;
  `Run.ts:2744` seeds a `power` multiplier off `deploymentCounts`).
  The user: power depletion was a placeholder pending a "fun"
  punishment; asymmetry vs the wave system is by construction.
- **Reskins** — no `extends`; 16 top-level fields / 38 leaves per
  `UnitDef` (`src/config/units.ts:146-213`); seven registration
  places for a new id (units · prices · fuzz-strategies strict record ·
  redraw-fisher strict record [already stale at 10/23] ·
  `Recruitment.test` EXCLUDED · glyph · `REQUIRED_UNIT_IDS`).
- **Marine / flight** — passability is GLOBAL (`TileGrid.ts:111-144`
  hardcoded; `config/tiles.json` is fire/heal tuning only); deep water
  is commented as the declared-inert marine seam (:128-130). Flight:
  `layer`/`ignoresTerrain` inert (`units.ts:190/193`), `planeOf`
  ignores the unit (`occupancy.ts:92`), `blocksFlight`/`targetsLayer`
  don't exist. The Phase-M lock (`archive/post-34-roadmap.md:1331-1364`):
  always-fly · NO co-location · pass over all · mobility-only matrix.
  Cost enters routing at ONE `CostFn` site (`movement.ts:827`) but ~8
  gates read `tileGrid.costAt` directly (the sweep list is in the
  audit output, `World.ts:1837/1954`, `movement.ts:715/302/121`,
  `actingPosition.ts:101/169`, `positioning.ts:308`, `blockedAlly.ts:156`).
- **Ice** — NOT faster: `cost 1, accuracyMod −12` (`TileGrid.ts:141`);
  `stepDurationTicks` reads the cost on ENTER (`movement.ts:781`).
  Gotcha #34: a <1 cost needs `minCost × Chebyshev`. Signed: do the
  heuristic swap (the planner then PREFERS ice — a legible wager), not
  a status.
- **Cavalier** — dash is pure config (`abilities.json:201-219`, the
  `move` op); `proposeSelfMove` hardcodes `targetId:-1`
  (`propose.ts:174-203`) so damage-on-arrival has no target.
- **Balancer perf** — no CPU profile ever; benches 57d (clone 0.07 ms
  @16 units, `archive/post-52-worklog.md:1670`) and 69c (clone
  0.03–0.05 ms, "battle sim ~100%", `archive/post-68-worklog.md:227`);
  clone = `JSON.parse(JSON.stringify(toJSON()))` at `src/bot/rollout.ts:48`
  + `runRollout.ts:52`; a search = up to 7 arms × K=2 × 160 ticks
  (`RolloutSearchDriver.ts:44-52`, `evaluator.ts:79-87`); K=2 locked
  at 9.5% disagreement vs K=8 (BALANCE:1571).
- **Roster realism** — isolation roster = character starting roster at
  `startingLevel` 5 unless `--roster` (`tests/fuzz/commands/run.ts:161`,
  `Run.ts:1088`); enemy budget = `factor × centralLevel × handSize`
  off the FIELDED team (`wave.ts:222-236`); per-hop level/size captured
  (`harness.ts:96-101` → `reporters.ts:804`), archetype composition
  NOT (run-aggregate only, `telemetry.ts:48-62`).
- **Rarity** — §61d tiers = design judgment over the §60e preference
  weights (`archive/post-60-worklog.md:380-403`); `--grant` postdates
  them (§68b); the §76f four tiered in the design round
  (`archive/post-72-worklog.md` §76f); gunslinger `common` by omission
  = by design; `grep -i rarity tests/fuzz/` → zero hits.
- **XP / level-up rewards** (the user's late addition) —
  `REWARD_ENTRY_KINDS = bits|packet|daemon|unit|poolHealth`
  (`src/config/rewards.ts:42`); `bankXpAwards` (`Run.ts:3587`) is the
  one chokepoint, already fed by rest nodes; targeting (which unit) is
  the open design question.
- **Fauna / cavalier / reskins as content** — config, but the glyph
  atlas has ONE free cell (47/48): the resize is a Round-10 pre-step.

### The mechanical half of the Round 6 kickoff (same day)

ROADMAP.md / WORKLOG.md / cluster-5-spec.md → `archive/post-72-roadmap.md`
/ `archive/post-72-worklog.md` / `archive/cluster-5-spec.md` (banners
added); this pair authored as skeletons (ROADMAP carries the signed
order + provisional phase charters §84–§87, no checkboxes); HANDOFF's
cursor and closed-rounds pointers re-homed. **Deliberately NOT done
here:** the spec — it wants a deep read of BALANCE 83e/83f, the ε-floor
method, the decisions.csv aggregates, and the evaluator/search-driver
code on a fresh context; the fold's terminal-score weighting is the
design fork the spec session exists to resolve.

## Kickoff (the spec session, 2026-08-22)

Output: [round-6-spec.md](round-6-spec.md) (the intent + the LOCKED
resolutions) and the ROADMAP re-cut §84–88. The reading list the
Cursor prescribed was read in full first: BALANCE 83e/83f, the 72f
ladder pre-registration (BALANCE:2995 + post-68-worklog §70/§72f),
`readEpsilonAA.ts`, the per-item aggregate (`reporters.ts`
`perItemDecisionStats`), both evaluators, the search/arbitration
drivers, the walker, the clone seams, the 83f board-report per-item
tables, `arbitratedStrategy.ts`'s sites + ε floors, the harness/CLI
surfaces for `--roster`/`--grant`, the rarity config seam.

### The code-reality audit — five findings

1. **The fold's source premise was wrong.** The draft said "fold the
   decisions.csv per-item aggregates into the terminal score." Two
   problems: (a) Δ|picked is the WITHIN-horizon margin — the rollout
   already realized it; folding it back double-counts, and the prior
   needs the BEYOND-horizon value (a run-grade quantity — what the 72f
   pre-registration actually named: the `--grant` paired instruments;
   the 83e/META wording drifted because the convergence read was done
   on decisions.csv); (b) coverage — on the 83f arb-regen table the
   rows clearing n=80 are empower 3483 · patch/surge/shield/discard-one
   127–246 · nodeChoice battle 88, all inside the horizon; the
   run-long assets read rewardDaemon n 3–8 · portBuy daemon n 1–4 ·
   units n 1–3 · event choices ≤ 30, every one Δ 0.00 — the
   horizon-blindness exhibit itself. decisions.csv stays the
   convergence MONITOR (83e's ML-rung tripwire).
2. **Two evaluators, one fold.** The draft's "sixth searcher script"
   campRaid nominator would be arbitrated by the BATTLE evaluator
   (`src/bot/evaluator.ts`: material differential + WIN_BONUS over
   160 ticks; neutrals count in neither team's material) — a raid
   costs material and its payout is invisible there, so it never
   clears ε. The run-layer fold doesn't reach it. The objective shape
   IS free (`battleSetup.ts:301`, the §75g pull).
3. **Perf: two of three draft levers can't bite.** Clone measured
   negligible (57d 0.07 ms / 69c 0.03–0.05 ms); K=2 — nothing to
   halve. The cost is `World.tick` inside the walker's per-pair full
   battle (`walker.ts:273`) and the searcher's (cands+1)×K×160 ticks
   per search point. Expectation reset to tick-level micro-wins or a
   documented no-op.
4. **Roster realism confirmed as drafted** (`Run.ts:1088`,
   `harness.ts:99`, `telemetry.ts` run-aggregate); the only design
   call was marginals vs whole rows.
5. **Rarity's cohort IS the fold's unit rows** — the same `--grant`
   paired recipe; the draft's fold→…→rarity order had an unnamed
   dependency, and its rarity-last rationale (the faster balancer for
   the biggest cohort) bought an hour or two against a ~two-night
   cohort.

### The design conversation (user answers F1–F5, then the pivot)

F1 hops-remaining scaling — signed. F2 daemons + packets + units —
signed. F3 campRaid at the run layer — signed ("re-evaluate if it
literally never gets picked"). F4 whole recorded roster rows — signed.
F5 (one `--grant` cohort first, ~41 batches at n=80 ≈ two box nights)
— the user pushed back: not a fan of a two-night run; it leaves data
on the table (natural early-daemon runs) and grows linearly with
content; floated a softmax data-gathering arm + aggregate compare.

**The pivot — the long-horizon shadow instrument.** The naive softmax
arm was rejected (loses same-seed pairing; confounds on state). The
cousin that keeps its spirit: branch the run at the NATURAL decision
point — the arbitration driver already clones per CRN pair and walks
both branches under shared dice for one battle; §71c's `shadowTier`
already re-judges every candidate telemetry-only with the driver
stream untouched. Generalized to a run-end horizon on the acquisition
sites (+ a new shadow-only recruit site), sampled 1-in-m, on its own
arm: values arrive at natural hops with natural rosters (the
hops-remaining scaling becomes measured), every candidate branch is
evaluated regardless of the live pick (exploration for free), cost
scales per decision not per item, any shadow-on batch refreshes the
table. Catches owned up front: cheap-walker fidelity for absolute
magnitudes (→ the `--grant` bridge on ~3 items, once) and thin rows
for rare offers (→ targeted `--grant` arms, the rarity phase's box
time). Ballpark ~6 run-equivalents overhead per run vs the cohort's
~3,300 runs. **User: "enthusiastically approved"**; renumbered so the
instrument is a regular §84.

Rejected alternatives, for the record: the 41-arm cohort (cost,
hop-0-only values); the naive softmax arm (pairing, confounding); a
battle-evaluator camp-credit term (a second fold + a bits→material
rate to invent + a harder §86 oracle).

### Predictions at the lock

World v35 / Run v44 hold for the round (everything harness/bot-side);
fuzz:smoke grows additively; every arb board row moves at §85 — the
ONE amendment absorbs it (pre-registered at 83f).

## Phase 84 — The long-horizon shadow instrument

### Kickoff (2026-08-22, same session as the spec lock)

**Code-reality audit of the §84 surfaces** (`driver.ts` · `walker.ts`
· `arbitratedStrategy.ts` · `reporters.ts` · `commands/run.ts` /
`args.ts` · `harness.ts`'s recruit dispatch · `Run.ts`'s hop reads ·
`sectorWalk.ts` · `driver.test.ts`):

- The shadow seam is exactly the 71c shape: pairs derived once, the
  shadow loop runs AFTER the primary under the same pairs, four tests
  pin byte-equal decide sequences shadow on/off. A long-horizon shadow
  reuses the pairs (no draw) and a 1-in-m sample can key off the pair
  seed (`cloneSeed % m`) — no draw either.
- Run-end walks exist: `walkToHorizon` returns on complete/defeat;
  `readEpsilonAA` already passes `horizonBattles: 9999`; only
  `maxHops` (default 50) needs to be explicit.
- Recruit is the ONE new site (`harness.ts:1033` → `chooseRecruit` /
  `passRecruit`; the arm delegates `pickRecruit` to the base). It must
  stay shadow-only: a live one-battle arbitration of recruits would be
  a doctrine change at the wrong horizon (the recruit-censoring
  lesson).
- No hops-remaining read exists: `currentHop` is per-sector (gotcha
  #120), pre-root throws (#110), `currentSectorLength()` is private,
  and the sector DAG is walked by random successor (`pickNextSector`).
  The shipped DAG is linear (start → deep-end), so "rest of this
  sector + the successor chain" is exact today.
- decisions.csv extends append-last by contract; `itemKeyOf` keys on
  site prefixes; `perItemDecisionStats` is pure over rows — nothing
  reshapes.
- Cost shape from the 83f table: rewardDaemon ≈ 1 decision/run,
  eventChoice ≈ 2, portBuy ≈ 1–2 (several candidates each); the recruit
  site will dominate (~one offer per won battle × 3–4 branches) — `m`
  is mostly a recruit-site dial.

**Shape-lock (user-signed "on all counts"):** separate long-horizon
records with a horizon marker (the aggregate + csv stay unchanged;
rejected: a parallel field on the live record) · hops remaining =
shortest remaining DAG path, moot on the shipped map · shadow K = the
primary's 2, `m` from the 84d probe. The five-step cut is in ROADMAP
§84.

### 84b — `Run.hopsRemaining` (2026-08-22)

Landed as a derived getter (never on the wire — pinned) over the LIVE
node-map (`hops.length` — hop 0 is the root, L−1 the terminal, so
pre-root has all L ahead and hop h has L−1−h) plus the pure
`remainingSectorHops` (sectorWalk.ts: the shortest path to a sink in
node entries, each successor at its cheapest sector's length — the
signed branching rule; memoized over the schema-acyclic DAG). A
`hopCount` probe adds nothing beyond its map (its terminal IS the run
terminal); `sectorHops` overrides every sector on the path.

**Finding (the post-seam pin caught it):** the walker-driven pin
expected the new sector at the `sectorHops` override and read the
AUTHORED 11 — `Run.fromJSON` resets BOTH run-shape dials
(`singleSectorRun = false`, `sectorHopsOverride = undefined`; "a
rehydrated run runs unbounded"), and a rollout clone IS a wire
round-trip. So every arbitration rollout already walks future sectors
at authored length, and — the part that matters for §84 — a run-end
shadow from an act-1 `--hops=11` batch would walk into the deep end
while the live run ends at hop 11: the record's `hopsRemaining` (live)
and the shadow's walk would disagree on what "the rest of the run" is.
Disposition: the instrument is defined on the FULL-WALK shape; 84c's
CLI refuses `--shadow-horizon` with `--hops` or `--sector-hops` (loud,
not silent). The same reset also re-resolves the X1 difficulty
multipliers to shipped defaults inside every clone — pre-existing for
all arbitration, noted here, not a §84 item. The pin now reads the
clone's actual map and documents the discipline.

### 84c — the shadow-only recruit site + the arm (2026-08-22)

Two design facts settled in the build, both now pinned:

- **A shadow-only site can't borrow pairs and must not draw the
  driver's.** `shadowDecide` derives its CRN pairs off a separate
  `shadowHorizon.siteRng` (the strategy seeds it at `runSeed + 0x84c1`),
  drawn BEFORE the sample gate so the site stream advances identically
  sampled or not; interleaving shadow-only calls between live decides
  leaves the live + 84a records byte-equal (pinned).
- **The null arm must be an explicit baseline.** An empty apply leaves
  the clone AT the recruit phase, where the rollout walker's own policy
  would recruit — not a null arm. Recruit's null = `passRecruit`; the
  challengers = every offer slot (the clone's own offer — `chooseRecruit`
  appends by value), labeled `recruit unit:<archetype>:L<n>`, keyed per
  ARCHETYPE in the aggregate (level = instance noise; the prior and the
  §88 rarity read are per archetype). The live pick stays the base's and
  the base's rng consumption is identical shadow on/off (pinned); the
  record judges under the reward-class floor (`RECRUIT_EPSILON`,
  telemetry-only).

decisions.csv gained `horizon` + `hopsRemaining` append-last; the
reader treats both as OPTIONAL so every 83f-era board dir still parses
(pinned by stripping the columns and re-parsing). `perItemDecisionStats`
keys `(site, horizon, item)` — the within-horizon and beyond-horizon
margins never pool (the spec's distinction) — and carries
`meanDeltaPerHop` (Δ / hopsRemaining over the instances that carry
hops; null, never NaN). The walker's `stopAtPhase` gained `'recruit'`
for the fixture.

**The one-seed smoke (the exit criterion):** `--count=1 --searcher
--audition --redraw=level:2 --empower=level:hi --arbitrate
--shadow-horizon=1 --shadow-sample=1` (no `--strategy`, so the default
fuzz set — TWO runs) wrote 1732 decision rows, 914 at horizon 1, 96 on
the recruit site; `hopsRemaining` read 20 at hop 1 (9 left in The Start
+ 11 in the Deep End) and 18 at hop 3 — the sector-aware read in the
wild. **Cost read for 84d:** ~12 min wall for the two runs at horizon
ONE battle, sample 1 — ~6 min/run, roughly 2–3× a plain run; the
recruit site (8–12 offers/run × 4 branches) dominates exactly as the
kickoff predicted. A run-END shadow multiplies each branch by the hops
ahead, so 84d's probe sizes `m` (and may sample the recruit site harder
than the others — a per-site `m` is the obvious follow-up if one rate
can't serve both).
