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

### 84d — the cost probe (2026-08-22, in flight)

**Baseline:** one plain WALK-arm run (seed 1, soldier, the regen
vector, the five ARM flags) = **255 s** locally, a completed 22-hop
run, 365 decision rows. Its per-site DECISION counts — the number
that sizes the shadow — read: grant:empower **31** (7.1 candidates
each) · packetFire:preTurn 34 · packetFire:outOfBattle 13 · nodeChoice
7 · eventChoice 2 · rewardDaemon 2 · portBuy 1 (13 candidates). The
acquisition sites are ~5 decisions/run; the in-horizon sites ~85.

**⚠ A spec deviation caught by those counts — fixed before the probe
re-ran:** 84a's shadow fired on EVERY `decide()`, not the acquisition
sites the spec names (round-6-spec §"The measurement design": "grants,
fires, and node picks … are NOT shadowed"). At a run-end horizon the
empower site alone (31 × 7 × K=2 run-remainders) would have been
~10× every acquisition site combined — which is also why the 84c
one-battle smoke cost ~6 min/run. Fix: `shadowHorizon.sites` (an
allowlist gating both the 84a shadow and `shadowDecide`; absent =
every site, the driver stays generic) + `SHADOW_SITES =
['rewardDaemon', 'portBuy', 'eventChoice', 'recruit']` on the
arbitrated arm; pinned. The first run-end probe was launched on the
unfixed shape, stopped — and its node child SURVIVED the stop as an
orphan (the §57g class: `TaskStop` kills the shell, not the worker;
`Get-Process node` after any stop), still writing to the log path the
relaunch reused. Killed by PID; relaunched clean on the fixed shape:
`--shadow-horizon=run --shadow-sample=8`, seed 1, timed by artifact.

Also landed while the probe ran (84e pulled forward — pure code, no
CPU): the prior-table builder (`tests/fuzz/prior/` — `buildPriorTable`
+ `npm run prior:table -- <dir>…`): long-horizon rows only, the
per-site polarity (rewardDaemon −Δ of decline · portBuy/recruit +Δ of
take · eventChoice excluded — per-choice rows aren't items), unit
levels stripped, cross-site n-weighted merge, `signable` = n ≥ 80,
provenance (HEAD · builtAt · the sidecars swept); refuses to build
from a batch with no long-horizon rows. 5 pins.

**The cohort (2026-08-22 23:32Z → 2026-08-23 06:33Z; a split session —
the launch in one, the morning in the next).** Box
`abox-20260822-233223` (cpx42/fsn1), four arms at `98ba7d2`, ~7 h
total (arm 1 4 h 13 m; the grant arms 50–57 min each), fetched to
`output/box-batches/<id>/` (box-batch.sh's dest is cwd-relative from
the repo root — the cursor's `tests/fuzz/output/…` path was a slip).
**The stand-down watcher** (the billing gap the user named: the queue
drains hours before anyone is awake): a detached `84d-standdown.sh`
beside the driver polled the driver log every 60 s, verified 4/4
`fetched →` lines on `queue drained`, and ran `box-launch.sh destroy`
at 06:32:42Z — the box would otherwise have billed ~6 h more. It HOLDS
the box (loudly) if arms are unaccounted for, and takes the queue over
if the driver process dies; both paths dry-run-tested on synthetic
logs. A keep-awake companion turned out to be belt-and-braces:
`powercfg /requests` (user, elevated) shows Tobii Eye Assist holding a
continuous SYSTEM request, which is why every prior overnight driver
polled fine through the 25-min power-plan timeout. Promote the watcher
into `scripts/` (TODO).

**The three findings** — numbers in BALANCE 2026-08-23; the story
here. (1) The table's nine packets read exactly 0.000, and nine exact
zeros are an instrument smell, not a measurement: the raw rows showed
every packet candidate scoring byte-identically to the null while its
`bitsDelta` proved the buy applied — so the packet sat in the cache
unfired. The walker's default weights (`config/fuzz-strategies.json`)
have no `fire` group; the live arbitrated arm fires through its own
`pickPacketFire` (arbitratedStrategy.ts:256) but no rollout ever does.
A blind spot since §59c/§69e, found only because a count read zero —
the same shape as the 84a every-site deviation (caught by decision
counts) and the 84b clone dials. (2) Hops-linearity was a named
decision point; the answer is no, and the mechanism is walker
fidelity: the cheap walk completes 4.8% of runs from 16–20 hops out vs
33% live, so far branches tie dead and all the measured value sits in
the last five hops. (3) The bridge can't validate magnitudes at n=80
because the score's ±200 outcome terms make the paired se ≈ 28.

**Decisions.** 84f inserted (the shadow-walk strategy override + the
tripwire + the rerun = the close); the all-rollouts weight fix
deferred to the §85 amendment (doctrine, re-sign); the bigger bridge
deferred. The user asked whether a dedicated adversarial review of the
balancer stack is warranted — yes: every hole so far is the one class
(the rollout clone diverging from the live run at an un-enumerated
seam), so §85-pre is inserted as a review phase; its shape (inline vs
a small subagent team — not a full workflow) is DEFERRED to its
kickoff. Renumbering §85→86 was considered and rejected for the
`-pre` convention (§85–88 are referenced from META-ROADMAP, the spec,
and code comments).

### 84e — the builder + the bridge read (2026-08-23)

The builder landed 2026-08-22 (above); the read is the v0 table +
finding 3. Committed with a provenance `--note` naming the structural
zero and the last-five-hops caveat so §85 cannot consume it blind.
Superseded by 84f's rebuild.

### 84f — cut (2026-08-23, user-signed)

- **84f1** — the long-walk `strategy` override: `judgeLong`'s spec
  takes the live vector's scored strategy (fire + port groups) for the
  shadow walk ONLY; the live records stay byte-identical (extend the
  84a pin); a pin that a walked packet buy now changes a branch.
- **84f2** — the inert-class tripwire: per site × candidate class, the
  "score ≠ null" rate in the per-item aggregate + a board-report WARN
  at 0 (rides every default-arm batch; would have flagged packets on
  the first §69e batch).
- **84f3** — the arm-1 rerun on the box (one arm, ~4 h) → rebuild the
  table → re-read the hops bins → the phase close. Predictions: no
  snapshot bump (harness-side); fuzz:smoke additive; the commit is the
  doc flip + the table.

### 84f2 — the inert-class tripwire (2026-08-23)

Landed as cut: `inertClassStats` buckets candidate instances per
site × **horizon** × class (horizon added to the signed key — the same
never-pool rule as the per-item aggregate, and load-bearing here:
84f1 armed only the shadow walk, so post-fix the run horizon goes
live while the live rollouts stay packet-blind until the §85
amendment; pooling would have hidden exactly that). Class =
item-key prefix (`unit`/`daemon`/`packet`); the fire sites are
class-tagged by SITE (their item keys are bare packet ids); grant /
node / event sites are their own class, so a fully-inert grant site
trips too. "Live" = the instance's score differs from the SAME
decision's null-arm score. Rendered on both consumers: the fuzz
CLI stdout (any batch logging decisions) and the board report (per
instrument dir + a bottom-line ⚠ count; never gates the exit code —
WARN grade). 3 pins.

**The probe** (scratchpad, vs the real 84d sidecar, 56,141 rows):
the run horizon flags `portBuy/run/packet` at exactly 0/499 — the
tripwire reproduces finding 1's nine structural zeros automatically.
⭐ The nuance: the LIVE horizon reads 2/499 (0.4%) — two packet-buy
instances perturbed their one-battle rollout (RNG/wave-composition
coupling from the clone's buy, not packet value), so the strict at-0
trigger does not fire there, and the cut's "would have flagged on
the first §69e batch" carries that caveat on live-only batches.
**Decision (user, 2026-08-23): at-0 RE-SIGNED.** Exact-tie across a
whole class is structural proof with zero false positives; a
near-zero threshold would change the signed semantics and buy a
false-positive surface; the value read (meanΔ ≈ 0) is the per-item
table's job. The standing live-horizon packet blindness is the
§85-amendment's deferred fix, and the tripwire's standing work is
the shadow rows from 84f3 onward.

### 84f3 — the arm-1 rerun + the v1 table (2026-08-24, overnight)

Ran unattended end-to-end: launch 23:06:53Z at `53283d8` (the 84f2
commit) → drained + fetched 03:26:55Z (~4 h 20 m) → the stand-down
watcher destroyed the box at 03:26:56Z (zero idle billing; the 84d
watcher shape, promoted-by-reuse — the scripts/ promotion TODO
stands). Numbers in BALANCE 2026-08-24; the story: the tripwire
reads ALL LIVE (portBuy/run/packet 0/499 → 79/499 — 84f2 closed the
finding it was built for, on its first real batch), summary.csv came
back BYTE-IDENTICAL to 84d arm-1 (the shadow-only contract confirmed
at batch scale for free — the strongest oracle the instrument could
get), the v1 table has 8/9 packets carrying real signed values
(miner's exact 0 is structural at λ=0 — a bits-only packet), and
the hops-linearity NO stands (far bins more distinguishable, still
outcome-quantized). One provenance nuance, named in the table note:
rows measured at `53283d8`, table built at `aca67da` — the
intervening commit is 85-pre's harness-side F1–F5, measurement
semantics untouched. Ops nuance for the record: the session crashed
at 84f2's close and the box ritual ran from a fresh session; the
PowerShell Start-Process ArgumentList quoting quirk (args with
spaces are NOT auto-quoted — bash got `-c echo`) silently killed the
first driver launch; pre-quote the -c payload. **84f close: PENDING
the user's morning sign-off** (the table + the doc flips are this
commit; the checkbox flips at the sign).

## Phase 85-pre — The rollout-stack adversarial review

### Kickoff + shape (2026-08-23, user-signed)

Shape resolved (the deferred decision point): a HYBRID — the
live-vs-rollout divergence table built inline (context-heavy,
mechanical), THREE adversarial subagents (Fable, one per lens:
evaluator pathologies · CRN/ε contracts · clone/walk fidelity), each
briefed to REFUTE named safety properties, then an inline merge with
probe-verification of every finding before it lands (one agent per
lens, not a team — probe verification is deterministic and stronger
than within-lens voting). Ran while the 84f3 box arm churned.

### The divergence table (85-pre.a)

The 7 FuzzStrategy methods × live-arbitrated-arm vs walk, plus the
non-method seams. Five method rows DELIBERATE with receipts (node,
port-coherence, grant, reward, event), packet-fire KNOWN (§84 story),
recruit deliberate-by-class. Non-method: clone streamRoot override
(77d2) sound; turn gates aligned; inner tier deliberate. New from the
table pass: **FLAG-1 — the arm's --redraw/--empower (and maxHops) are
NOT threaded into rollout walks** (arbitratedStrategy.ts:230-234
carries only horizonBattles/innerTier/bitsLambda; WalkOptions falls to
the hardwired doctrine defaults). Inert for the doctrine arm, latent
for any policy-varied arm.

### Consolidated findings (85-pre.b + .c) — verdicts after probes

All three lenses converged independently on #1-#3 (the panel working).
Code-verified = read at the cited lines; CSV-verified = probed on the
real 84d sidecar (85-pre-c-probes, scratchpad).

**CONFIRMED (code + CSV):**
1. **Dead-terminal quantization** — playerHealth clamps to 0
   (Run.ts:3006), so every dying clone scores an exact decision-point
   constant (evaluator.ts:99-108); death timing/roster/bank destroyed.
   CSV: 73.6% of run-horizon deltas EXACTLY 0, 18.1% at the full ±200
   quantum, 7.1% pool-channel, and the half-quantum bucket EMPTY (a
   flip flips both CRN pairs). This is the mechanism UNDER the 84d
   hops-nonlinearity and bridge-underpower findings: the instrument
   measures only the completion tail; margins are quantized, not noisy.
2. **The one-battle ε is inert at the long horizon** — judgeLong
   applies the site floor (driver.ts:414); CSV: σ(margin) 74–116 vs
   ε ≈ 3 at every long site. Contained: the prior table reads means,
   not chosenIndex. REFINED vs the agents' claim: non-null pick rates
   are far BELOW C/(C+1) (recruit 30% vs 76%) because exact ties fail
   strict-greater argmax — chosenIndex is "which candidate flipped an
   outcome", not uniform noise; still not a value signal.
3. **'stuck' walks score as healthy truncations** — evaluator.ts:181
   discards WalkResult; scoreTerminal reads phase only. Armed, not
   firing (~22-hop map vs DEFAULT_MAX_HOPS 50 — and run-horizon specs
   never set maxHops: the FLAG-1 seam). Act 3 fires it.
4. **Clone dial resets are LIVE on the standing board** —
   Run.fromJSON nulls forcedEncounterId/forcedLayoutId/drawAmountAdd/
   difficultyMultipliers (Run.ts:4037-4049) and drops
   sectorScatterConfig; the 84b guard refuses only --hops/--sector-hops.
   board.ts:297/304 (arb-wall-king/queen) run --encounter + ARM: every
   rollout on those rows judges against pool-rolled futures the live
   run cannot have. The known 84b class, four un-enumerated members.
5. **The 84f1 overlay is a no-op for fire-group-less bases** —
   shadowWalkStrategyFor returns undefined when base.pickPacketFire is
   undefined (default base = DEFAULT_SCORED_WEIGHTS, no fire group);
   the live arm fires regardless (arbitratePacketFire enumerates the
   CACHE). A bare --arbitrate --shadow-horizon arm's shadow walks are
   still packet-blind. The 84f3 batch is UNAFFECTED (regen vector
   carries fire). The 84f2 tripwire catches it post-hoc; nothing at
   launch.
6. **The walker's searcher tier drops the live config** —
   walker.ts:173 passes {} where runOne passes rolloutSearch
   (audition scripts + K, harness.ts:465): no tier setting can
   reproduce live battle play inside a rollout.
7. **Run.registerTrigger has ZERO callers** — the fromJSON comment
   "re-register on rehydrate" is aspirational (every call site is
   World's sibling). The first run-trigger daemon silently loses its
   handler in every clone AND every save/load.
8. **Ad-hoc additive seed offsets** — RNG(runSeed + 0x70a1 / 0x84c1)
   (arbitratedStrategy.ts:81-84) is the construction RNG.ts:16 calls
   a review offense; cross-seed stream identity at seed spans ≥ 5152,
   bound unenumerated. Migration = stream break (gotcha #125) — a §85
   amendment item.
9. **buildPriorTable weight mismatch** — per-hop means computed over
   the hops>0 subset but weighted by full-row n (priorTable.ts:111-133).
   Small today; a silent unit error in §85's input.

**CONFIRMED with softened magnitude:**
10. **Pseudo-replication vs the n=80 floor** — deltas at one decision
    share the null draw; CSV: recruit rows n ≈ 1.1× distinct
    decisions, so inflation is MILD for the table's main rows (the
    agents' "n=80 could be ~30" overstated); portBuy C≈9.5 rows carry
    more. Shared-null correlation stands qualitatively.

**PLAUSIBLE — probe deferred (needs new CPU or §85 context):**
11. **ε argmax inflation on LIVE decisions** — floors calibrated on
    single A/A margins but gating max-over-C (portBuy C≈13); the
    false-act rate exceeds the 2σ intent at candidate-rich sites.
    Probe = an A/A extension run (a §85 ε re-read work item).
12. **§85 fold landmines** (pre-registered for the fold design):
    (a) priorBonus × hopsRemaining (×~20) can breach the death-penalty
    ordinal — no runtime guard (evaluator.ts:49-53 "doc note");
    (b) terminal-holdings delta CHARGES a branch for firing a packet
    (−1 holding × table value × h) — re-creates packets-inert through
    the new mechanism with inverted sign; needs a fired-packets
    accounting rule in the fold spec;
    (c) walker-acquired downstream items inject table-scaled noise
    into the prior once the fold is live (feedback, no de-fold step);
    (d) the mean-of-ratios Δ/h estimator amplifies near-terminal
    quantization noise, then the fold re-multiplies by h.
13. **Run-horizon walks never shop ANY future dock** — the coherence
    rule needs only the decision dock excluded; bits carry zero option
    value over 16–20 hops, so decline/null branches are systematically
    undervalued and +Δ-of-take polarity overstates spending. With #1
    and #6, the ranked candidates for the 4.8%-vs-33% completion gap
    (inner-tier skill + config drop > no-ports > no-fires >
    default-vector routing/drafting > grant policy).
14. **eventChoice nominee pin at run horizon** — the (eventId, pageId)
    pin designed for the 1-battle A→B→A loop pins every later
    occurrence of the same page in the walked remainder (small: ~2
    event decisions/run).
15. **λ not reconstructible from the sidecar** — no lambda column;
    the independent-recompute lint impossible on λ≠0 arms exactly
    where spend distortion is watched.

**Minor/doc:** stale pre-77d2 policySeed rationale (walker.ts:29-33);
harness.ts:10 fork-vs-direct comment drift; horizon-1 walks exit
before the final battle's rewards are accepted (bitsDelta telemetry
under-counts, CRN-shared so unbiased); E1 zero-σ pooling in the ε
class floors (under-floors the variable contexts ~16%); sample-gate
coupling (cloneSeed both gates and seeds pair 0 — benign under mix()).

### Triage (fix-first; scope guard: no live-arm doctrine change
outside the §85 amendment) — USER-SIGNED 2026-08-23 (F3 = option A:
de-arbitrate the wall rows + full guard + PENDING re-pin, over the
lineage-preserving deferral). ALL FIVE LANDED same day (below).

Land in 85-pre (instrument-side, cheap, no doctrine change):
- F1: thread WalkResult.outcome into RunScoreBreakdown (+ a stuck
  guard: run-horizon specs set maxHops with slack) — closes #3, arms
  #1's future probes. Additive column, append-last.
- F2: coherence pins — defaultWalkStrategy carries no port/fire
  method; shadowWalkStrategyFor(default base) documented + a WARN (or
  refuse) when a shadow-horizon arm has no fire policy to overlay
  (closes #5's silent-at-launch edge).
- F3: the 84b guard extended to refuse --encounter/--layout/
  --draw-add/--bits-multiplier/scatter flags with --arbitrate (closes
  #4's silent class the 84b way) — the BOARD's two wall rows then
  refuse; board fix = drop ARM from those rows (they're winRate
  drift refs; arbitration not load-bearing there) or accept the
  refusal until a clone-config seam exists. USER CALL.
- F4: doc fixes (walker policySeed rationale, harness comment,
  walker-header recruit-weights note, registerTrigger landmine
  comment + a loud assert).
- F5: the λ column + a decisions-distinct-from-instances note in the
  per-item header (closes #15, softens #10's reading).
Defer to the §85 amendment (measurement semantics / doctrine):
- The all-rollouts strategy fix (packets + the #6 searcher config +
  the #13 future-docks rule) — one coherent walk-fidelity amendment.
- The ε re-derivation (#2 long-horizon floors, #11 argmax inflation,
  E1 zero-σ pooling) — the amendment already owns the ε re-read.
- The seed-offset migration (#8, stream break).
- The fold design constraints (#12a–d) — pre-registered into §85's
  design notes BEFORE the fold is coded.

### The fix-first landing (2026-08-23, one commit)

F1: `walkOutcome` on RunScoreBreakdown (evaluateRunCandidate attaches
it; fixtures stay optional) + decisions.csv `stuckFrac` (append-last;
'' when breakdowns carry no outcome) + judgeLong sets `maxHops =
max(50, hopsRemaining×3+10)` when the spec carries none (a site's
explicit maxHops wins) — a stuck long walk is now visible and, on
today's shapes, unreachable. Pins: a real evaluation carries an
outcome; maxHops −1 reads 'stuck'. F2: the coherence pin
(defaultWalkStrategy defines NO optional site method) + the
shadowWalkStrategyFor(default-base) → undefined pin + a stderr launch
warning on `--shadow-horizon` with a fire-group-less base. F3: the
--arbitrate dial guard (encounter/layout/draw-add/bits-multiplier
always; the three scatter chances only on multi-sector shapes — the
start map rides the clone's wire, so act-1 --hops probe combos stay
legal); board wall rows → `wall-king`/`wall-queen` on CONTROL_ARM,
strategyRow `scored:59-regen-vector`, refs = the ARB 83f pins marked
PENDING RE-PIN (expect a WARN pair on the next board until
re-measured); board.test re-pinned 8 primaries + 2 checked wall rows
+ 5 controls. F4: walker policySeed rationale rewritten post-77d2;
harness header comment fixed; the recruit/route-on-default-weights
divergence named at defaultWalkStrategy; TriggerDispatcher gains
`size` and Run.toJSON THROWS on a trigger-bearing run (the landmine
made loud — zero callers today). F5: decisions.csv `lambda` column
(the record's bitsLambda; scores reconstructible on λ≠0 arms) + the
shared-null pseudo-replication note in the per-item header. Sidecar
generations: 83f-era / 84c-era / 85-era all parse (pinned).
2692 + 440 green.

### The §84 close (2026-08-24, user-signed)

The 84f3 read signed as-is; §84 CLOSED (a-f), the ROADMAP section
demoted to its stub, the v1 table is §85's input. §85 kicks off in a
FRESH session (this one carried 84f2 → the box ritual → §85-pre →
84f3 end-to-end); the kickoff's first act = the code-reality audit +
the fold-shape design against the pre-registered 85-pre constraints
(the cursor carries the full list).

## Phase 85 — The fold + the ε re-read + the two riders

### Kickoff: the code-reality audit (2026-08-24)

Surfaces surveyed as they exist at the 84f3 table commit (39db3e9):
evaluator.ts / priorTable.ts + the committed v1 table / driver.ts /
arbitratedStrategy.ts / readEpsilonAA.ts / reporters.ts / the
battleSetup enemy-pull seam / board.ts / Strategy.ts / harness.

1. **The dominance landmine (12a) is numeric, not hypothetical.**
   `RUN_DEATH_PENALTY = 10 × playerHealthMax = 200` (health.json: 20).
   The v1 table's top `valuePerHop` rows read ~5.8 (minerva,
   corrupter); linear `× hopsRemaining` at h≈20 gives ~116 for ONE
   item at λ=1 — a 2-item holdings delta breaches the death ordinal.
   The evaluator's dominance contract is a doc note (evaluator.ts:49),
   no runtime guard.
2. **The linear ×h shape is dead on the data anyway** (the twice-
   measured hops-linearity NO, re-confirmed by the 84f3 provenance
   note: value still concentrates in the last ~5 hops; far bins
   quantized). The table's `meanDelta` (raw long-horizon margin,
   |max| ≈ 35, typically < 20) is bounded exactly where the fold
   needs boundedness — and if value is near-terminal-concentrated,
   the holding margin is ~h-independent for h beyond the
   concentration window, so an UNSCALED meanDelta is the
   measurement-honest rung 1, not a retreat.
3. **The fired-packet rule (12b) needs walker-side accounting** — Run
   tracks no cumulative fired-packet tally (grep: zero hits), so
   "terminal cache − live cache" charges a branch −table[p] for
   firing. The fix is harness-side: the walk counts packet ids fired
   during the walk and holdings(packets) = terminal cache ∪
   fired-during-walk (fired = value REALIZED, not lost; daemons/units
   can't be consumed, so the rule is packets-only).
4. **The feedback channel (12c) has a clean structural answer**: the
   fold applies to LIVE decision scoring only — shadow long-horizon
   records (the table's input) keep scoring at λ_prior = 0, so every
   future table rebuild reads raw margins. The de-fold step exists by
   construction; residual feedback is only behavioral (a λ>0 arm
   walks different runs), which the provenance head pins.
5. **The estimator (12d + finding 9)**: reporters.ts:453 is the
   mean-of-ratios (Δ/h per instance, then mean) and
   priorTable.ts:111-133 weights `perHopSum` by full-row n while
   summing only the hops>0 subset. Both live in the valuePerHop
   column; a fold that reads `meanDelta` bypasses the whole estimator
   class, and the builder fix lands regardless (the table keeps
   valuePerHop as a reader column).
6. **readRunMetrics widening is trivial**: `run.daemons.map(d=>d.id)`
   / `run.cache` (packet ids, acquisition order) / `run.team`
   archetypes all public. Items held on both sides cancel per spec.
7. **campRaid rides entirely harness-side — no snapshot bump.** The
   HARNESS builds battle worlds (harness.ts `spawnEncounter`), and
   the §75g enemy pull (battleSetup.ts:289-305) is the exact rails:
   `setObjective` team-order engage on a camp's primed member. A
   player-side mirror needs no Run state — the site decides at
   preTurn (the existing FIRE_PRETURN clone context), the winning
   order rides a harness/walker-side flag consumed at the next spawn.
   v1 candidate set = {null, raid} (one selective per-battle choice —
   the 83e indiscriminate probe is the baseline it must beat);
   per-camp enumeration deferred until a layout carries >1 camp and
   the read demands it.
8. **No preTurn RUN-LAYER site exists today** — the arbitrated
   strategy's preTurn presence is packetFire only; campRaid is a new
   site string + a new ε question (the preTurn class floor 1.101 was
   derived on a dominated current-battle horizon; a raid's payout is
   run-layer — its ε re-derives with the post-fold floors).
9. **ε floors are λ- and walk-sensitive**: the prior term adds
   variance to A/A margins (holdings deltas differ across policy
   seeds), and the walk-fidelity fix changes walk variance — the ε
   re-read must land AFTER both, and the cohort should run on the
   re-derived floors, which orders the phase: fidelity → fold → ε →
   cohort.
10. **The deferred walk-fidelity items are all-rollouts doctrine**
    (fire overlay for every rollout, walker.ts:173's dropped
    rolloutSearch config, the future-docks rule with only the
    decision dock excluded) — they move every arb board row, so they
    must land BEFORE the fold's paired pre/post read or the fold is
    measured against a walk we intend to discard. The seed-offset
    migration (0x70a1/0x84c1 → keyed deriveRng streams, gotcha #125
    rules) is a pure stream break — same re-baseline commit.

Shape-lock proposal presented (fold shape = unscaled meanDelta +
clamp; ordering = fidelity-first; the design answers above as the
12a-d record).

### Shape-lock (2026-08-24, USER-SIGNED)

All three calls signed as recommended:
1. **Fold shape = UNSCALED meanDelta** — `priorBonus = λ_prior ×
   Σ table[item].meanDelta` over the holdings delta; no
   `× hopsRemaining` (the spec's locked linear shape is superseded by
   the twice-measured hops-linearity NO — audit finding 2 is the
   rationale of record). Clamp `|priorBonus| ≤ 0.5 × RUN_DEATH_PENALTY`
   (=100), clamp visibly flagged in the breakdown (12a). Fired
   packets count as held (12b). Shadow long-horizon records score at
   λ_prior = 0 structurally (12c). valuePerHop stays a reader column;
   the builder weight fix lands in 85a regardless (12d/finding 9).
2. **Ordering = fidelity-first**: the walk-fidelity batch + the
   seed-offset migration land BEFORE the fold's paired read, so one
   cohort measures both on the walk we keep.
3. **campRaid v1 = {null, raid}** — one selective per-battle choice;
   per-camp enumeration deferred until a layout carries >1 camp and
   the read demands it.

The 85a-85h cut written into ROADMAP §85. Snapshot prediction
re-affirmed at the lock: World v35 / Run v44 hold (all
harness/bot-side, campRaid included — audit finding 7).

### 85a — the builder weight fix + the table rebuild (2026-08-24)

`ItemDecisionStats` gains `nPerHop` (the hops>0 subset size the
per-hop mean was computed over) and `buildPriorTable` weights every
per-hop merge by it — both the cross-bucket accumulation and the
per-site contribution merge (`PriorSiteContribution` gains `nPerHop`
too); full-row-n weighting skewed toward buckets with thin hop
coverage. New discriminating pin: a two-bucket fixture where hop
coverage differs (10/10 vs 2/10) — subset-weighted 0.533 vs the old
0.4. Headers re-pointed: the fold input is `meanDelta` UNSCALED,
`valuePerHop` demoted to the hops-shape reader column (priorTable.ts
header + PriorRow docs + the render legend).

Table rebuilt from the 84f3 sidecar (56,141 rows / 9,748
long-horizon / 2,621 decisions — same counts as v1). **meanΔ
byte-stable on every row** (the fold input untouched, by
construction); value/hop moved where hop coverage was uneven —
cornucopia −2.43→−2.69, minerva 5.82→5.58, patricians-seal
2.21→2.76. Independent recompute of the cornucopia merge from the
JSON's own site rows: (−4.5049×26 + −0.8034×25)/51 = −2.6905 exact;
the rewardDaemon bucket reads nPerHop 25 vs n 33 — the real data
exercised the bug path (8 hop-less instances previously counted in
the weights). Signable/directional membership unchanged (17 + 18).
Provenance note carries the 84f3 reads forward + names the
measurement HEAD 53283d8 (the build-time HEAD is post-kickoff).

### 85b — the walk-fidelity batch + the keyed-stream migration
(2026-08-24)

The four pre-registered items in one re-baseline commit:

1. **The all-rollouts walk-policy overlay** — 84f1's shadow-only
   `shadowHorizon.walkStrategy` RETIRED, replaced by
   `RunRolloutSpec.walkPolicies`: `walkPolicyOverlay(base)` (the
   base's `pickPacketFire` when it carries one + the new
   `walkPortBuy` dock policy) rides the arm's driver config and the
   EVALUATOR owns the one compose point (site strategies keep their
   pick methods and gain the overlay on top). Coherence moved from
   "leave the policies off" to per-site GATED overrides:
   - the port site suppresses dock buys at the DECISION DOCK only
     (keyed on sector+node; a forward-DAG walk never revisits) and
     shops every later dock — the future-docks rule (finding 13):
     bits now carry option value in walks, and the long-horizon
     shadow inherits the same gating through the per-call spec;
   - the fire site suppresses fires of the decision's OWN context at
     the decision's node (same-gate firing would zero every margin
     and kill the live fire channel); a later preTurn gate inside an
     outOfBattle decision's horizon can fire what the ask banked —
     the margin now reads fire-now vs fire-LATER, not fire-now vs
     never (the 84d packets-inert mechanism, closed at the live
     horizon);
   - grant/reward/node/event/recruit rollouts take the overlay whole
     (a node candidate entering a port node now realizes shopping
     value; the grant site's turn-intro fires ride symmetrically in
     both branches under CRN — named, accepted).
   `walkPortBuy` = the 50g buy-all-affordable mirror (lane order,
   affordability, the 49c cache-room lock — proposals always land,
   the loop never wedges). A PROXY for the arm's own rollout-judged
   port behavior (walks can't recurse); imperfect but symmetric —
   what it measures is bits' option value at future docks.
2. **The walker's searcher config (finding 6)** — `WalkOptions` +
   `RunRolloutSpec` gain `rolloutSearch`; walker passes it where it
   passed `{}`; run.ts threads the live arm's resolved config
   (normalized like the harness; `kFlipTelemetry` stripped — a
   rollout needs the play policy, not the instrument). Inert on the
   default traffic tier.
3. **The seed-offset → keyed-stream migration (finding 8)** —
   `runSeed + 0x70a1`/`+ 0x84c1` replaced by
   `deriveRng(runSeed, 'arbDriver')` / `'arbShadowSites'` (two new
   PERMANENT registry keys, gotcha #125 rules). A deliberate
   arb-DECISION stream break; every game stream untouched (keyed
   additions never move existing streams).
4. **The F2 launch warning generalized** — fires now ride every
   rollout, so a fire-group-less base under bare `--arbitrate` warns
   at launch (not just under `--shadow-horizon`).

**Re-pin count: ZERO.** 2692 main + 442 fuzz green at the first
post-migration sweep — the §77 keyed-stream architecture + the 77d3
self-healing fixture hardening (dockSnapshot scans for its own
context instead of pinning literals) absorbed the stream break
exactly as designed. Driver tests re-authored 84f1→85b (walkPolicies
on BOTH horizons; per-call replacement = the site-gating shape; the
stream-untouched pin); the overlay suite pins the dock policy's 50g
mirror + the finding-5 edge (fire-less base composes no fire).

**Non-vacuous proof** (the portPurchases/packetsFired-twin norm): a
2-seed live arb probe on the regen vector (`--arbitrate
--strategy=59-regen-vector --redraw=level:2 --empower=level:hi`, no
searcher), read via the standing 84f2 tripwire:
- `portBuy/live/packet` **5/9 live (56%)** — pre-85b this class read
  2/499 (0.4%) structurally: a bought packet now fires inside the
  horizon-1 walk and moves rollout scores. One packet buy WON a live
  decision (`packet:patch`, Δ +6.00) — the first rollout-judged
  packet purchase in the project's history.
- `packetFire:preTurn/packet` 12/33 (36%) and `outOfBattle` 2/19
  (11%) — fire margins now read fire-now vs fire-later, non-zero.
- `portBuy/unit` 10/10, `portBuy/daemon` 2/4, node/event/grant
  classes live at prior rates.
- The two ⚠ INERT warns are thin-sample noise, not the structural
  signature: `grant:redraw` n=4 and `rewardDaemon` n=2 (janus/moneta
  at Δ 0.00 — moneta IS ~0-value per the v1 table).
The probe rode the stdout tripwire exactly as designed — the
instrument catching its own fix landing.

### 85c — the fold mechanics (2026-08-24)

The signed design, landed:
- **`readRunMetrics` widened** with the holdings read (`daemonIds` /
  `cachePacketIds` / `teamArchetypes` — multisets, level stripped).
- **`priorBonusOf` + `scoreTerminal(…, prior?)`** — `priorBonus =
  λ_prior × Σ table[item] × Δcount` over the holdings delta,
  `table[item]` = the v1 table's UNSCALED meanDelta
  (`priorFoldValues`; every row participates, directional included —
  the n=80 floor governs signing, not the instrument's internal
  prior). Clamp at `PRIOR_BONUS_CAP = 0.5 × RUN_DEATH_PENALTY` (=100)
  with a `priorClamped` breakdown flag (12a — visible, never silent).
- **12b, fired counts as held**: the evaluator subscribes the CLONE's
  private bus to `run:packetUsed` for the whole branch (candidate
  apply + walk), and fired ids union into terminal packet holdings —
  firing realizes value, never charges it.
- **12c, the structural de-fold**: `judgeLong` STRIPS
  priorLambda/priorTable from every long-horizon spec and stamps
  `priorLambda: 0` on the record — the table's input is always raw;
  a rebuild can never eat its own prior.
- **Byte-identity at λ=0**: the fold path (subscription, diff, field)
  only engages at λ ≠ 0; `priorLambda ≠ 0` without a table throws at
  launch, before any seed runs.
- **Plumbing**: `--prior-lambda=<f>` (requires --arbitrate, finite
  ≥ 0) → ArbitratedConfig → driver rollout spec → evaluator;
  decisions.csv gains `priorLambda` + `priorBonus` append-last (both
  '' pre-85c; parse degrades — the three-generation pin extended);
  RunDecisionRecord carries priorLambda; the run banner notes the
  arm.

Pins: the fold arithmetic suite (cancellation · multiset · unknown-
item-0 · fired-neutrality/credit · λ-linearity · ±cap + flag · the
breakdown presence contract) + the evaluator λ=0 toEqual pin + the
no-table throw + the λ≠0 fold-runs-per-pair pin (score ≡ base +
priorBonus, the breakdown-level recompute lint) + the 12c strip pin +
the --prior-lambda arg pins + the csv generation pin extended to
85c-era. 2692 main + 453 fuzz green.

**Non-vacuous proof — three 1-seed probe arms** (regen vector, same
config as the 85b probe):
- baseline vs `--prior-lambda=0`: summary.csv AND decisions.csv
  **BYTE-IDENTICAL** — the board-control contract holds at batch
  scale, csv columns included (the absent flag records the same 0).
- `--prior-lambda=1`: 462 decisions.csv rows at priorLambda=1, 74
  non-zero priorBonus values, and the values read back as the
  table's OWN rows exactly (portunus +5.970 / laverna −8.653 /
  rogue −11.178 / mercenary −1.749) — an independent recompute by
  inspection; summary.csv DIFFERS from baseline (the fold moves
  decisions, as a λ arm must). The boon-event's daemon choice
  carries a +24.53 prior on its acquiring arm — the §85f
  boon-separation validation mechanism visibly armed. No clamp
  engaged on this seed.
- Interplay note (85b × 85c): a nodeChoice candidate that enters a
  port node and dock-shops in its walk picks up holdings the prior
  then credits (enterNode:24(port) bonus +15.82) — by design; the
  85f cohort reads the composed behavior.

### 85d — the campRaid site (2026-08-24)

The fold rider, on the signed v1 shape ({null, raid}; harness-side,
no snapshot bump — kickoff finding 7 held):

- **The shared order** (`tests/fuzz/campRaid.ts`): `orderCampRaid` =
  an ordered engage on the first living camp member at spawn (only
  primes are alive at spawn — §75h), the exact §75g pull command
  shape, player-side; deterministic, draw-free, no-op campless.
  ONE definition consumed by both the live harness and the walker —
  a live-vs-rollout divergence here would be a coherence bug, so the
  walker's deliberate-duplication doctrine (battle wiring only)
  deliberately does not apply. Hostility untouched: the raid reads
  passive until first blow (damage-aggro stays the single source).
- **The site** (`arbitrateCampRaid`): asked once per turn-intro
  BEFORE the fire loop; the raid apply sets the CLONE's
  `raidNextBattle` (a new mutable field on `RunRolloutClone` —
  battle-plan state riding the handle, never serialized); the walker
  consumes it at the walk's FIRST battle spawn; the live harness
  mirrors with its own flag at battle:started. Eligibility gates the
  rollout SPEND: an authored campless layout enumerates nothing; the
  procedural sentinel stays eligible (a campless roll makes raid ≡
  null, ties→NULL). ⭐ The eligibility read is
  **`run.encounterMap.layoutId`** — rolled at encounter start
  (K3.5), alive at turn-intro; `currentEncounter` does NOT exist
  until the battle starts (the first parking attempt read null — a
  cheap surprise the test caught before the site shipped it).
- **ε**: `CAMP_RAID_EPSILON = FIRE_PRETURN_EPSILON` PROVISIONAL by
  class argument (the RECRUIT_EPSILON precedent) — flagged weaker
  than usual (a raid's variance profile is a whole side-battle, not
  a packet fire); 85e derives the site its own floor.
- **"Raid first, then fight" — the traffic tier needed the guard**:
  the searcher already had §54 foreign-order conservatism (never
  search against or clobber a foreign order; the dead-target
  auto-revert releases), but TrafficScriptDriver's ownership rule
  only stopped the NULL action — a TRIGGERED script would have
  clobbered the raid order mid-rollout. 85d imports the searcher's
  rule (hold while a foreign order stands). Byte-identical for every
  existing arm: no foreign player-team order existed in bot-driven
  battles before this site. New pin: an eager script holds through
  the foreign order and resumes after the auto-revert.
- Pins: campRaidEligible config-derived over the whole shipped
  catalog (both branches non-empty) · orderCampRaid's target class +
  order-survives-the-tick + campless no-op + hostility-untouched ·
  the site's win/tie-stands/apply-sets-flag/eligibility-governs-
  spend suite (the parked-turn-intro fixture generalizes the
  readEpsilonAA recipe self-healing across depths) · the traffic
  conservatism pin. 2693 main + 460 fuzz green.

**The A/B probe caught TWO silent no-ops before commit** (the
84f1-class hunt done deliberately this time — the first live probe
read all 22 campRaid margins EXACTLY 0.000, and per the twice-bitten
doctrine that signature got a scratchpad A/B probe instead of a
shrug: paired walks with/without the raid flag on scanned campy
turn-intro states, `objective:set` bus events as the discriminator):
1. **The predicate bug** — `orderCampRaid` filtered on
   `campId !== undefined`, but non-camp units carry campId NULL: the
   order targeted the first living PLAYER unit and
   `clearResolvedObjectives` silently reverted it the same tick. The
   probe's B walks showed the order placed yet zero divergence; the
   camp-only unit fixture couldn't see it (now it spawns a player
   unit first, and the pin asserts the order SURVIVES the tick —
   the silent-revert signature).
2. **The drain race** — with the predicate fixed, 8/12 pairs were
   STILL byte-equal: an order ENQUEUED at spawn drains after tick
   0's bot decides, so the traffic driver (deciding under the
   still-atWill objective) clobbered the raid inside the very same
   drain — and the 85d conservatism guard never fired because the
   foreign order wasn't applied yet at decide time. The enemy pull
   never hits this only because the enemy team has NO driver. Fix:
   **`World.setInitialObjective`** — a sanctioned SETUP-PHASE direct
   write (spawn-time setup mutates the world directly by design;
   the guard throws past tick 0, so mid-battle mutation stays
   command-channel-only and the O1 invariant is structural, not
   habitual). No serialized shape touched — World v35 holds.
After both fixes: **12/12 probe pairs diverge**, B walks open on the
standing raid order with tile scripts resuming only after the
auto-revert ("raid first, then fight" observed), tick counts move
like a real detour (550 vs 1031 on one pair).

**The live probe, rerun** (1 arb seed, regen vector): 21 raid
candidates · **10 non-zero margins · 4 raids WON** · mean margin
+1.55 — the site is selective and does get picked (the spec's
re-evaluate-the-layer decision point stays closed). Value judgment
is the §85f cohort's; the 83e indiscriminate baseline (decisively
net-negative) is what the selective pick-rate must beat.

## Phase 85e — the ε re-read (2026-08-24, user-signed same day)

The re-read shape-locked and signed in-session (the three methodology
calls below), built on three edits: the walker's `stopAtPhase` union
gains `'event'` + `'turn-intro'` (parks fire at the loop top BEFORE the
walker's own fires/grants — the pristine site context), `deriveEpsilonAA`
gains an optional `arm` (armed floor reads; the control becomes
arm-vs-arm under shared pairs, still exactly 0) and returns raw
`scores`, and `readEpsilonAA` was rebuilt wholesale: all contexts prep
through the walker seam, two new classes (event page; campRaid unarmed
AND raid-armed), every context read at λ_prior ∈ {0, 1} under IDENTICAL
pair seeds (λ only re-scores — trajectories are λ-independent — so Δσ
is the fold's own contribution, read paired), E1 both-ways pooling, and
the #11 within-context argmax bootstrap. 32 reads, every control
exactly 0 (including the armed and λ=1 controls — the 85d raid
determinism and the fold's determinism re-pinned through the full
pipeline). Log: scratchpad 85e-epsilon-read.log.

**Finding 1 — the fold's noise injection is structural and
horizon-shaped (#12c QUANTIFIED).** At λ=1 the A/A σ explodes at
exactly the contexts where item acquisitions sit inside the walk
horizon (fresh hop-1 map 1.43→13.6 ×9.5; starting boon page 1.55→13.6;
reward gates 1.9→11.6 / 1.4→7.3; port docks 2.3→5.3/5.7) and is
BYTE-IDENTICAL to λ=0 everywhere else (mid-act maps, preTurn,
campRaid) — the split rides the known horizon-1-exits-before-rewards
seam, which shields mid-act map states. Margin |max| jumps ~6→~30 (the
table's item quanta).

**Finding 2 — E1 confirmed.** The preTurn depth-0 context reads
σ=0.000 again on the NEW post-boon park (dominated current-battle
horizon); RMS-pooling it in under-floors the live mid-act context ~2×.

**Finding 3 — the campRaid provisional was under-pinned ~5.6×** (the
85d weaker-class-argument flag was right): true camp-carrying
turn-intro contexts read σN 2.865 pooled, and the ARMED read confirms
the raid arm is genuinely noisier (σR 3.324; 4.122/2.261 vs 3.375/2.242
by depth) → mixed-arm ε = 2·√((σN²+σR²)/2) = 6.206 vs the provisional
1.101.

**Finding 4 — the event class reads WIDER than the map class it
borrowed from** (mid-act page σ 2.861 vs map max 2.738; ×1.84 spread
vs the boon page): under the RMS class floor the mid-act page's argmax
false-act rate hit 38% at C=13. The 74g provisional (owed the §81
re-read that never ran) is retired by derivation.

**Finding 5 — post-fidelity drift at λ=0 is real at every class**
(port 3.145→4.646 · map 3.265→5.476 · preTurn 1.101→3.277 · reward
2.873→3.874 by the v2 rule). Also caught: the old script's
parkAtTurnIntro(0) recipe has been silently BROKEN since §74 stamped
the root as the starting-event node (entering the root opens a page,
not a turn gate) — the v1 preTurn/reward-era numbers were derived on
pre-§74 state shapes; the rebuilt recipes park via stopAtPhase. The
69f "post-battle turn-outcome" context was dropped (no site clones
there).

**Finding 6 — #11 argmax inflation CONFIRMED, modest with correct
floors.** Within-context bootstrap (20k trials, one shared null score +
C candidate margins vs the class floor): at correctly-floored λ=0
contexts C=13 runs 2.4–8.7% vs the 2.3% single-comparison intent
(2–4×, inherent to max-over-C); the scary 28–38% rates all traced to
class-pooling under-floors, closed by the max-context rule.

**The three signed calls (all as recommended):**
1. **Floors are λ=0-derived and apply to ALL λ arms.** Per-λ floors
   would neuter the λ=1 arm (map ε≈14). The λ=1 false-act exposure is
   a pre-registered WATCH on the §85f sidecar (priorLambda+priorBonus
   → realized flip rates); the structural fix — computing the prior on
   the CANDIDATE's own holdings delta at short-horizon sites, which
   makes floors λ-invariant by construction — goes on the §85h
   amendment menu, not built mid-phase.
2. **v2 pooling: flat per class at the MAX-σ non-degenerate context**
   (E1 exclusion + max-context supersedes RMS). Cost: fewer marginal
   acts at below-max contexts; still flat-per-class (the
   state-conditioned-ε scope guard holds).
3. **No argmax C-correction.** Re-read after 85f's realized-flip data.

**The re-pin** (arbitratedStrategy.ts, derivation header rewritten):
port 4.646 · map/outOfBattle 5.476 · preTurn 3.277 · reward 3.874 ·
event 5.723 (own constant) · campRaid 6.206 (own constant, mixed-arm).
GRANT/NODE_CHOICE/RECRUIT keep their class shares. Tests reference the
constants symbolically — no pin edits needed.

## Phase 85f — the box cohort (2026-08-24 → 08-25, user-signed close)

**The cohort as landed:** 29 planned arms → 30 banked batches at TWO
HEADs (790bd08 arms 1–5; 0e68337 — the mid-cohort pin fix — arms 6+),
n=120 same-HEAD protocol, box created/destroyed same window (zero
billing), every arm artifact-verified. The two-HEAD split was a
USER-SIGNED mid-flight call (see the crash below); its pooling license
is the **byte-identity ORACLE: the 0e68337 re-run of the 790bd08
arb-walk-55pre base sha-matches exactly** — proof, not argument.
The scratchpad drivers: v1 (box-batch `run`-mode — retired), v2
(hand-rolled launch→status-poll→fetch, one batch at a time, artifact-
verified stand-down) — v2 is the promotable shape (TODO).

**The mid-cohort crash + fix (85f's unplanned half):** arm 4
(arb-walk-55pre-ext) died on `walker: 500 event choices in one walk` —
the 74g eventChoice nominee pin returns its pinned choice WITHOUT an
enablement check, and `repeatable: true` events (cheese-tax, the
catalog's ONE repeatable+conditioned member) can re-roll the decision
page mid-walk with the nominee's `bitsAtLeast` now false (the pin
itself paid the bits): handleChooseEventOption silently no-ops, phase
never leaves 'event', the walker's guard throws. Finding #14 upgraded
from mild-bias to crash engine; three static content scans all read
CLEAN before a deterministic repro (seed 42) + a dispatch-monkeypatch
probe named the true mechanism — the reminder that the repro beats the
mechanism story. Fix: `pinnedEventPick` (nominee-if-enabled, else the
walk's uniform-random-among-enabled), byte-identical on every walk
that didn't crash (the guard reads, never draws) — proven by the
oracle above AND by arm 26 re-running the crashing seeds clean at
batch scale. Landed mid-cohort by user call (`0e68337`); remaining
arms re-HEADed at launch via the parity pull, zero collisions.

**The ghost driver (gotcha #126):** TaskStop on driver v1 killed the
wrapper, not the bash tree — the orphan ran its remaining ~21 arms
interleaved with v2 all night (2× contention; the λ05-regen wait ran
2.3h). Every ghost batch proved BYTE-IDENTICAL to its v2 twin
(21/21 sha-verified before deletion) — the project's largest same-HEAD
reproducibility proof, by accident. v1's manifest also banked the
three pre-kill 790bd08 walk arms (canonical).

**The tiger team (parallel-session thread):** the user commissioned an
external adversarial review (GPT 5.6 Sol) of the balance protocol;
session asciibattler-98 verified it (4 read-only agents, file:line),
repaired SIX defects in 85f-read.ts in place overnight (lexicographic
depth keys — the THIRD #120-shape instance; 'reward'→'rewardDaemon' —
the 82c family; arm-qualified keys; set-dedup; sign-test p + 95% CIs;
the per-logical-arm duplicate-seed guard that then CAUGHT the ghost's
duplicates), and staged the amendment draft at
scratch/85f-tiger-team-actions.md. Verified here: the prior table's
rows were measured at 53283d8 (pre-85b walker) on seeds overlapping
the cohort's — a train/select leak, so **85f is EXPLORATORY for
λ-signing** (user-signed disposition; the λ default waits on the §85h
protocol). Cross-session coordination worked: repair handed off clean,
the oracle gate + ORACLE-EXCLUDED marker mechanism co-designed.

**The reads (the reader: output/box-batches/85f-read.ts + the board):**
- **Paired λ (the exit criterion):** 55pre λ=0.5 Δwin **+0.142
  [+0.045,+0.238], sign-test p=0.008** (27▲/10▼) — significant,
  in-sample-caveated; 55pre λ=1 +0.108 p=0.053; regen +0.050 p=0.377 /
  +0.067 p=0.200. All four positive. **The λ=1 overspend signature on
  both vectors** (λ=1 banks −45 vs λ=0.5's −17 on 55pre, for LESS
  win) — λ=0.5 pre-registers as the default candidate for the clean
  disjoint-seed rerun. Δbank CIs exclude zero at every λ arm — the
  fold's behavior shift (hoarded bits → acquisitions/fires, fires
  2.27→~4) is significant even where Δwin isn't.
- **Boon-event separation: PASSES as a WIRING proof** — λ=0 reproduces
  83e's indiscrimination exactly (3 rows, pick 0.00, Δ≈0, n≈160/row);
  λ=0.5 separates decisively (packets 0.95 / daemon+bits 0.00,
  tracking table signs). Held-out predictive value = the real test
  (tiger-team framing, adopted).
- **The 85e WATCH confirmed live:** acquisition sites wake at λ>0
  (portBuy act 0.07→0.78 · rewardDaemon 0.00→0.36 · eventChoice
  0.01→0.21) with |priorBonus| carrying nearly the whole acted margin
  there and 0.00 at every non-acquisition site.
- **Board 0 FAIL / 5 WARN** — one coherent story: the 85e floors made
  λ=0 arbitration MORE CONSERVATIVE (arb-55pre fires 0.82 under band;
  act-1 regen ceiling −0.092, arb UNDER doctrine) while every λ>0 arm
  improves on λ=0 → **the fold-makes-arb-pay thesis** (85h). The
  regen-walk wall 0.438 (vs signed 30–35, was floor-hugging 0.265 at
  83f) is a NAMED 85h re-read. Wall rows RE-PINNED (user-signed):
  King 0.775 / Queen 0.675, doctrine arm, n=120, order preserved —
  the F3A ⚠ PENDING closed (sheet amended 2026-08-25).
- **campRaid:** alive + selective (pick ~1% at all λ, 59/6445
  candidates at λ=0; rollout-estimate margin ~8, explicitly
  NON-CAUSAL — the enabled-vs-disabled paired arm is an 85h item).
  The spec's re-evaluate-the-layer decision point stays closed.

**Signed calls at close (2026-08-25):** (1) the wall re-pin above;
(2) **85g RE-ORDERED BEHIND 85h** — the 55pre fork (freeze-as-
shopper-stress vs regenerate), the search-trains-non-arbitrated
mismatch (args.ts refusal), and the λ default all shape what 85g
should search; (3) the **85h agenda** = the tiger-team draft's 8 items
+ the fold-makes-arb-pay thesis + the λ=0.5>λ=1 signature + the
campRaid causal arm + the 0.438 wall re-read; (4) gotcha #126 + the
retro notes. Ops lessons → retro/scratchpad.md (the ritual sweeps at
the round boundary).

## Phase 85h — the amendment session (2026-08-25, user-signed)

All twelve agenda items (the tiger-team draft's 8 + the four 85f
additions) **signed as proposed in one sitting**; the only item the
user probed was the 55pre fork's compat cost, answered by a
code-reality audit before the signature (below). The agenda doc
(`scratch/85f-tiger-team-actions.md`, gitignored scratch) is stamped
DISPOSITIONED and historical.

### The decisions

1. **The 55pre fork = REGENERATE-AND-COLLAPSE**, and the
   `--arbitrate`+`--search` compat build is IN 85g scope. Rationale:
   the "no search can train on the arm the fixtures deploy on"
   mismatch (train non-arbitrated, judge arbitrated, every board row)
   is structural debt that only grows — 85f just showed the fold
   changes what the deployed arm *does* (fires 2.27→~4, bank −17/−45),
   so a non-arb-trained strategy is increasingly optimizing a
   different game. 55pre keeps no frozen alias; `pre55ReachRef`
   retires at the re-derive.
2. **λ_prior's default signs POST-RERUN, not at 85h.** λ=0.5 is the
   PRE-REGISTERED candidate (the 85f overspend signature: λ=1 banks
   −45 vs λ=0.5's −17 on 55pre for LESS win, both vectors). The
   doctrine arm stays λ=0 until the signing.
3. **The λ rerun protocol is MANDATORY** (the tiger team's core catch,
   adopted verbatim): (a) the candidate-delta de-fold built and used
   for attribution — never all-holdings; (b) the prior table
   re-estimated under FINAL walker semantics (85f's table rows are
   pre-85b-walker at `53283d8` on seeds overlapping the cohort — the
   train/select leak); (c) disjoint seed banks: train / choose /
   one-use signing.

### The compat audit (the code reality behind decision 1)

The `args.ts:483` refusal is the 70a LABELING guard ("a search
silently ignoring the flag would label the batch wrong"), not a
technical wall — `--searcher` sat behind the identical guard until
59e. The 59e pattern is the template: flags ride the shard job file,
the worker re-resolves through the same resolver run mode uses
(`evalShard.ts:59`), so the sharded search drives the identical arm
byte-for-byte. One real design choice: run mode wraps the strategy
PER SEED (`run.ts` `strategyFor` — the arbitrated arm is stateful,
one driver per run) while the search worker hands ONE shared instance
to `runMany`; the clean fix is moving the wrap into `HarnessOptions`
so `runOne` does the per-seed wrap — which makes a **byte-identity
oracle on the run path mandatory** (same-seed summary+decisions
sha-match across the relocation). Estimate: ~a day of code incl. the
refusal-matrix + shard-parity tests (`searcherArgs.test.ts`
precedent); no snapshot bump predicted (harness-side only).

**The real cost is compute, not code:** one arbitrated ARM run ≈
255 s/seed (the 84d probe), so a naïve full-arb search (vectors ×
train seeds + test + refine) is box-DAYS. Two shapes on the table,
**decided probe-first at 85g** (the 84d/59f discipline — one cost
probe at real search shapes before the cohort sizes): (a) HYBRID
staging — train/screen non-arbitrated, refine + final selection
arbitrated (the winning strategy is judged on the deployed arm at a
fraction of the cost; residual impurity: the coarse screen still
ranks on the old game); (b) full-arb search, only viable if §86's
warm-start/successive-halving riders get pulled forward. Prior
going in: hybrid wins value-per-box-hour.

### The routing (B-items)

- **Board split → a §86-adjacent instrument step**: the fail-closed
  verdict board (missing / N-A / empty-strategy / under-n /
  duplicate-seed / provenance-mismatch all FAIL, never silent pass)
  split from the drift dashboard and the instrument-health suite; +
  the skill-gradient anchor rows (pure-random / greedy / searched
  upper) and the per-batch machine manifest. Too load-bearing for a
  post-round audit — the review's "board cannot fail" finding.
- **Perf riders → the §86 charter** (profile-first still governs):
  transient-only spawn retry · dynamic per-seed queue · staged
  n40→80→120 with pre-registered extension rules · stratified shadow
  quotas · warm-start + successive-halving for `--search`.
- **Prior v2 shrinkage + provenance RIDE the 85g re-estimate** (one
  rebuild): site-conditioned prior via hierarchical shrinkage toward
  the pooled mean (the sign-flips are systemic — boon-packet ±0.04,
  ronin −33/+2.9, stormcaller +82/+5, mercury +15/−10 — but portBuy
  cells are n=8–32, so never a naive per-site split);
  `measurementHead` + `buildHead` as separate MACHINE fields (the
  free-text `head` misled across two rebuilds) + hashed/relative
  sources.
- **Later rounds**: the human-calibration re-record gate sharpened in
  META-ROADMAP Round 12 (no macro band signs against the ~80% human
  anchor until the re-record — one player × 11 cells × 3 seeds on the
  old engine); the clean-sheet value-model idea parked in TODO with
  the review's own caution as the reason.

### Landed this session (C-items)

- **Gotchas #127 + #128** + the structural guards (the second
  commit): `tests/fuzz/walkDepth.ts` — the ONE home for lexicographic
  (sectorsCleared, finalHop) depth compares, board.ts + reporters.ts
  rewired through it (the 85f reader's bare-finalHop was the THIRD
  #120-shape instance, and the first in a READER — the class re-opens
  with every new scratch reader unless the helper is the path of
  least resistance); `tests/fuzz/rollout/sites.ts` — the canonical
  `DECISION_SITES` registry + `DecisionSite` union (the reader's
  `site === 'reward'` silently dropped ~144 rows/arm; the 82c family;
  `verifyArbitratedRuns.ts` carried its own stale local list —
  missing eventChoice/recruit/campRaid — now `satisfies`-checked).
- **The fold-makes-arb-pay thesis adopted as the STANDING
  interpretation** (BALANCE run-log 2026-08-25): the 85e floors made
  λ=0 arbitration MORE conservative — arb reads at/below doctrine
  (act-1 regen ceiling −0.092; arb-55pre fires 0.82 under band) —
  while every λ>0 arm improves on λ=0. The five 85f board WARNs are
  ONE story, not five defects.
- **The 0.438 regen-walk wall DISPOSITIONED: re-read after the λ
  rerun.** The fold moves the wall directly (0.438→0.327→0.300
  across λ on the regen vector) — dispositioning it at λ=0 would
  sign a number the pending default is about to move.
- **The campRaid causal arm** (enabled-vs-disabled paired) rides the
  85g cohort on the same disjoint-seed banks — no separate box trip.

### The re-scoped 85g (charter level; sub-steps cut at its kickoff)

De-fold build → prior v2 rebuild (final-walker re-measure ·
shrinkage · machine provenance) → the search-arm compat (per-seed
wrap into HarnessOptions + the byte-identity oracle + job-file
plumbing) → the cost probe (full-arb vs hybrid) → the 55pre
regenerate re-derive → the disjoint-seed λ cohort (+ campRaid causal
arm) → λ signs and `pre55ReachRef` retires.

## Phase 85g — kickoff (2026-08-25, same session as the 85h close;
cut user-signed)

The code-reality audit (step 1) + the commit cut (step 2, in ROADMAP
§85g) + the shape-lock (step 3, signed with two flagged calls:
**replace the fold outright** — no dual-mode flag, nobody signed the
all-walk semantics and two fold modes double every λ arm — and
**re-derive at λ=0 doctrine**, breaking the 85g5⇄85g6 circle
conservatively: a nonzero λ* makes the vector re-derive a sheet
rider). Audit findings:

1. **The all-holdings noise is LOCATED**: `priorBonusOf(before,
   after)` at `evaluator.ts` diffs the live run against each branch's
   FULL-WALK terminal holdings, so any stochastic mid-walk
   acquisition injects its whole table value into the margin — the
   85e σ×2.3–9.5, and landmine 12(c)'s pre-registered residual
   ("feedback, no de-fold step" — 85c's judgeLong strip closed only
   the TABLE half).
2. **⚠ THE MECHANISM REVISION (differs from the shape-locked
   sketch):** the signed proposal said "snapshot after
   candidate-apply, pre-walk" — the audit killed that mechanism
   before a line was written: the rewardDaemon site's polarity is
   FLIPPED (null = accept, challenger = decline) and its null arm has
   NO apply — the acceptance happens INSIDE the walk, so an
   apply-time snapshot reads 0 for both branches and the fold goes
   dead at the site it most serves. The revised mechanism keeps the
   walk-terminal diff + fired-as-held EXACTLY as-is and restricts the
   delta to the decision's own item keys (`priorItemKeys`, per-site):
   portBuy = the union of offered slot keys · packetFire = the
   candidate packet ids · rewardDaemon = the portion's daemon ·
   grant/nodeChoice = `[]` (no acquisition — their walk-holdings
   drift is pure noise, and the 85f WATCH read |priorBonus| ≈ 0 at
   non-acquisition sites anyway) · eventChoice = the static union of
   every holdings-touching op id in the active event's def (addPacket
   / removePacket / addDaemon / removeDaemon / grantUnit across ALL
   pages — a safe over-approximation robust to page-graph
   reachability; `removeUnit`'s key is dynamic and is EXCLUDED,
   documented) · campRaid = the explicit `'all'` sentinel
   (CORRECTED at the 85g1 build from the kickoff sketch's `[]`: the
   85d site header NAMES the raid's packet payout reaching the
   run-layer score — "the packet prior once held" — as signed
   design, and reward-roll payouts aren't statically nameable, so
   campRaid stays deliberately UNRESTRICTED; the `'all'` sentinel
   exists precisely so "deliberate" and "forgot" are
   distinguishable). Fail-closed: `driver.decide` THROWS on a λ≠0
   spec with no `priorItemKeys` (the 85c launch-mistake pattern);
   the evaluator-level `itemKeys` stays optional (absent =
   unrestricted) for fixtures. The boon-separation instrument
   survives by construction — the granted items ARE in the key set;
   only off-key noise dies.
3. **Prior v2 needs a fresh box shadow batch** before the rebuild:
   "final walker semantics" is simply current HEAD (post-85b,
   post-`0e68337`), but the rows must be RE-MEASURED — an §84-style
   shadow arm on the new TRAIN bank. The builder already keeps
   per-site contributions (`PriorRow.sites`), so shrinkage is a
   builder change, not a schema rework.
4. **The compat has no import cycle** (`arbitratedStrategy` doesn't
   import the harness) but the cleaner shape is the generic
   `HarnessOptions.wrapStrategy?: (seed, base) => FuzzStrategy`
   factory — the harness stays arbitration-ignorant; run.ts and
   evalShard build the factory through one shared resolver (the 59e
   `searcherFromArgs` pattern). Search mode routes EVERY eval (train,
   test, refine) through `evaluateVectorsSharded`, so there is
   exactly one seam to thread.

### 85g2a — prior v2, the code half (2026-08-25)

Shrinkage + machine provenance, landed ahead of the box batch
(85g2b). Two design calls worth their rationale:

- **Shrinkage is computed AT LOAD, not baked at build** — the v1
  schema already commits per-site `(n, meanDelta)`
  (`PriorRow.sites`), so `priorFoldValuesBySite(table, k)` derives
  the site-conditioned views from the signed artifact's own stats:
  one source of truth, no value-schema change, and the MECHANISM
  works on the existing committed table (85g2b refreshes
  measurements + provenance, not the machinery). The driver swaps
  the matching view into the rollout spec per decide-site (the swap
  lives where the site is known — the driver stays generic, plain
  data); sites without a view (grants · nodes · fires · eventChoice
  · campRaid) keep the pooled `priorFoldValues` fallback.
- **K = the per-item signing floor (`SHRINK_K = PER_ITEM_N_FLOOR`,
  80)** — a site's own cell reaches HALF weight exactly when it
  could sign on its own; portBuy cells at n=8–32 read w≈0.09–0.29
  (mostly pooled, tilted by their own evidence), which is the
  "hierarchical shrinkage, not a naive per-site split" the 85h item
  mandates. k is a parameter; k=0 (the naive split) is pinned as the
  boundary case.

Provenance v2: `measurementHead` (parsed from the batch-dir
`YYYYMMDD-HHMMSS-<head>` naming — MIXED heads THROW, the
one-HEAD-per-table rule; `--measurement-head=` for unlabeled dirs,
contradictions refused) + `buildHead` (`git rev-parse`, the builder
version) as separate machine fields; sources repo-root-relative with
forward slashes; legacy v1 `head` tolerated at load/render. Pins:
the shrinkage algebra (hand-computed), the fallbacks, the head
parse/mix/none cases, the driver's per-site spec swap, both render
generations.

### 85g2b — the TRAIN-bank shadow batch + table v2 (2026-08-25 →
08-26, the batch overnight-adjacent)

**The batch:** `20260825-211240-fbcb363` — the exact 84f3 instrument
shape (`--shadow-horizon=run`, the full ARM, the regen vector,
`--jobs=8`) at `--seed-offset=1000 --count=120` (the TRAIN bank
1001–1120). Box created/launched/fetched/destroyed by the
single-arm v2 driver in one clean pass: DONE at +206 m (the 84f3
anchor ×120/160 predicted 195 m), 47,936 decision rows, artifact
verified, box down at 00:40Z — zero idle billing. The mid-run 85g3/
85g4 commits were safe by construction (single-launch queue; the box
pulled `fbcb363` at launch and never re-pulled).

**Table v2** (`prior-table.json`, 35 items from 1,952 long-horizon
decisions): provenance v2's FIRST real build — `measured @fbcb363 ·
built @fed4803`, the head parsed from the batch-dir name, sources
repo-relative. 17 units SIGNABLE (n=168–309); all 9 daemons + 9
packets DIRECTIONAL (n=20–44 — the 120-seed bank is thinner than
v1's 160; the §88 targeted-grant list grows). The reads:

- **`packet:miner` is ALIVE (−40.65 directional, n=20)** — v1's nine
  exact zeros included miner as STRUCTURAL (bits-only = score-
  invisible). Candidate mechanism, not overclaimed: the 85b armed
  walk gives bits a real downstream channel (docks shop inside
  walks), so a bits-only packet finally moves terminal state. The
  magnitude is n=20 noise territory; §88's targeted grant is the
  proper read.
- **Magnitudes grew broadly** (unit meanΔ now spans ±25 vs v1's ±6)
  and **rioter SIGN-FLIPPED** (v1 +4.98 → v2 −14.49); halberdier
  +2.69→+24.63, stormcaller +3.72→+19.08, bandit −4.82→−19.58. Two
  entangled causes, both intended: final-walker semantics (armed
  fires/docks make branches genuinely diverge — the 84f2 live-
  fraction lift) and the clean seed bank. v1-vs-v2 deltas are NOT
  drift evidence — different instrument, different seeds, by design.
- Directional daemons carry large values (janus +72.7, minerva
  +62.4) — single-item folds stay under the ±100 clamp, and λ=0.5
  is the pre-registered default; the clamp flag stays the tell.

### 85g3 — the search-arm compat (2026-08-25; built while the 85g2b
batch ran on the box)

As cut, on the 59e template. The seam:
`HarnessOptions.wrapStrategy?: (seed, base) => FuzzStrategy` — a
GENERIC per-seed factory (the harness stays arbitration-ignorant),
applied by a thin `runOne` shell over the renamed inner body so none
of its return sites change; the shell also duck-types the 71a
decisions harvest off the wrapped instance's `driver.decisions`
(relocated from run.ts's manual attach). run.ts's local wrap is GONE:
the CORE arm (tier + the fold's two table views [throw-at-launch on a
missing table, same timing] + the normalized searcher-tier rollout
config) resolves through the ONE resolver `arbitratedWrapFromArgs` —
shared verbatim with the `--eval-shard` children — and the run-mode
instruments (shadow tier · grant-ε · the long-horizon shadow) compose
on top as `extras`, REFUSED with `--search` in args.ts.

**The byte-identity oracle: PASSED.** Same-seed 2-run probe (hops=5,
the full ARM, λ=0.5 — the fold path engaged) is sha-IDENTICAL across
the relocation on BOTH artifacts: summary.csv `e6247f7e…`,
decisions.csv `3d0d8fd7…`, before vs after.

Plumbing: the args 483 guard relaxed mode-by-mode (sweep/arena still
refuse); ShardJob/ShardedEvalParams gain
`{arbitrate, arbitrateTier, priorLambda}` (flags only — the 59e
JSON-safe discipline; λ's table loads in each child from the committed
file); search.ts threads ALL THREE eval stages — the shard train
path, the in-process test scoring + jobs=1 serial path (both via
harnessOptions), and refine. Cost note printed in search.ts: an
arbitrated eval is MINUTES per seed — the 85g4 probe governs use.
Tests: the arg matrix + resolver pins + the JSON round-trip + the
59e-style search-vs-run parity + the relocated-harvest pin
(`arbitrateSearchCompat.test.ts`).

### 85g4 — the staging decision (2026-08-25, user-signed same day)

**HYBRID-LIGHT signed.** The math, anchored on 84d's measured
255 s/seed full-walk ARM cost + the search presets (heavy =
120 vectors × 30 train seeds, full length):

- (a) HYBRID-LIGHT — train + refine non-arb (the classic recipe,
  ~2–3 h box) + the K finalists scored ARBITRATED at full length
  (4 × 30 × 255 s ÷ 8 ≈ 1.1 h): **~3–4 h box total**. ← signed
- (b) hybrid-heavy — arbitrated refine + selection: ~11 h, marginally
  purer refinement.
- (c) full-arb heavy — ~32 h+; §86's successive-halving territory.

Rationale: (a) kills the worst of the train-on-the-wrong-game
mismatch — the vector that DEPLOYS is chosen by the deployed arm at
full length — while the coarse screen (where arb noise-per-dollar is
worst) stays cheap. Execution shape: NO new search mode — the K
finalists come out of the classic search's ranking
(search-results.csv), each gets an ordinary run-mode arbitrated batch
on the TRAIN bank (decisions.csv rides for free), and argmax picks
the deployed vector. The queue-file driver runs it as a K-arm cohort.
The 85g3 compat stays the enabling infrastructure (and the road to
(c) when §86 lands). A short probe validating the 255 s scaling at
the exact shapes rides the 85g5 launch — the estimate is anchored,
not assumed. Residual impurity, accepted at signing: the coarse
screen still ranks on the non-arbitrated game.

### 85g5 — the overnight + the arbitrated selection (2026-08-26; autonomous session, protocol calls PENDING USER REVIEW)

The overnight fired at session open per the staged driver (launch
01:26Z at `b92fa75`, DONE +405 m, artifact-verified, box destroyed by
the driver). Numbers: BALANCE 2026-08-26. While it cooked, the two
promotable TODOs landed as `scripts/box-drive.sh` (`6109b4a`) — which
then ran the selection cohort as its maiden voyage, 4/4 clean.

**Finalist materialization.** The search persists only the winner's
vector, so the base finalists were regenerated locally from the
deterministic proposal step (`generateVectors(DEFAULT_BOX, 85, 96)` —
the documented re-derivation contract) and verified NON-CIRCULARLY
(§79e): the box's post-refine winner lies inside the exact
0.15-radius perturb envelope of finalist 56 on every coordinate
(maxAbsDiff 0.2975 ≤ 0.30 = radius × span) and 1.8+ from 72/73 — a
wrong regeneration cannot produce that. Fixtures committed at
`046c83a` (`tests/fuzz/fixtures/85g5-*.json`).

**Autonomous protocol calls (flagged for review, all cheap to re-run
on TRAIN):** (1) K=4 arms — the cursor said "3 finalists" but the
85g4 staging budgeted "4 ×"; the superset {3 base + refined winner}
covers both readings and argmax over a superset is safe. (2) n=30 @
offset 1000 per the staging math (the search trained on 26).
(3) λ_prior omitted (=0) — selection scores under the DEPLOYED arm,
which stays λ=0 until the 85g6 signing.

**Result: argmax = finalist-56 (18/30).** The refined winner placed
THIRD (15/30) — behind its own perturb parent — the
train-on-the-wrong-game inversion hybrid-light was signed to catch,
now observed in the wild. Open at close: the user's deploy signing
(argmax pre-registered; the 56-vs-73 margin is thin, +2 net of 10
discordant), then 85g6 (the λ cohort on CHOOSE 2001+ + the campRaid
causal arm).

**Deploy SIGNED 2026-08-26 (user, at the morning review):** the
deployed vector = **finalist-56**
(`tests/fuzz/fixtures/85g5-finalist-56.json`), per the pre-registered
argmax; the three autonomous protocol calls (K=4 · n=30 · λ_prior=0)
ratified with the signing. No canonical-rename copy made — the
fixture name carries its provenance; downstream consumers (85g6, the
55pre re-derive) reference it directly.

## Phase 85g6 — kickoff (2026-08-26, same session as the deploy signing; cut user-signed at the morning shape-lock)

The code-reality audit (step 1): the campRaid site had NO disable dial
— built as 85g6a. The key finding shaping the mechanism: Strategy.ts's
`pickCampRaid` contract is ABSENT = never raid (the pre-85d behavior,
the doctrine arms' permanent policy), so "disabled" = OMIT the site
from the strategy object — the causal pair is then exactly
site-vs-no-site under paired luck, with no ε or walker consultation on
the off arm. The cut (step 2, in ROADMAP §85g6): 85g6a the dial ·
85g6b the 7-arm λ cohort on CHOOSE (deploy+regen × λ{0,0.5,1} + the
causal arm; n=120) · 85g6c the λ*/causal reads · 85g6d the SIGN pass.
Shape-locked (step 3) with two flagged calls, both user-signed: n=120
per arm, and the 3 regen arms kept for the two-vector consistency
read.

**85g6a LANDED (this commit):** `--camp-raid=off|on` (run-mode
ablation dial, the grant-epsilon class: requires --arbitrate, refused
with --search, on|off only — a typo'd value throws rather than
silently running the default arm under an ablation label). run.ts
threads it as a wrapStrategy extra; the batch label prints
`camp-raid=OFF` (70a labeling). Tests: the priorLambdaArg-pattern arg
matrix + the site-omission pin (campRaid:false → pickCampRaid
undefined; default/true → defined). --jobs children re-parse argv
(the parallel.ts passthrough), so no job-file plumbing.

**The day's ops plan (the box-drive freeze shapes it):** the board
re-anchor cohort fires after this commit (the 83a shape, 25 batches
~9.6h — queue `output/box-batches/85g5-board.queue`); the repo is
READ-ONLY while it drains (box-drive refuses a dirty tree or HEAD
flip at every launch). Evening: fetch → file → the re-pin amendment →
user signs → the λ cohort fires overnight (queue
`output/box-batches/85g6-lambda.queue`, ~7.5h).

**The 85g5 re-anchor board run + the amendment (2026-08-26 evening,
user-signed):** 25/25 artifact-verified (box-drive, one box ~7.6 h,
per-ID filing cross-checked batch-by-batch against each args file —
the 83d rule). Numbers: BALANCE 2026-08-26 (the amendment's board
run). The two ⭐ findings: the deploy twin's reach lands IN the signed
band on first read (pre55ReachRef's retirement vindicated), and the
55pre shape-coupled parity breach is REPAIRED by the re-derive
(deploy gaps inside ±5 both characters; priest-regen −5.0 the named
watch). The λ=0 ceiling deltas deepened (walk-deploy −0.325) — filed
under the fold-makes-arb-pay standing interpretation, the λ cohort's
question. ⚠ OPEN for 85g6c: TRAIN-vs-in-sample arb λ=0 deploy walk
60% vs 22.5% (beyond bank noise; doctrine reads 0.550 in-sample).
**85g5 CLOSES with this amendment** — the re-derive at λ=0 doctrine
shipped end to end: search → arbitrated selection → deploy signed →
the six rows re-anchored → the re-pin signed. The λ cohort
(85g6b) fires tonight on CHOOSE 2001+.

**85g6c — the λ + causal reads (2026-08-27 overnight, autonomous;
numbers BALANCE 2026-08-27):** both cohorts drained clean (the 7-arm
λ cohort ~11h — arms ran ~95 min, over the 64-min estimate but under
the 68h hatch; the 2-arm TRAIN probe ~2.7h; zero boxes billing).
Three findings: (1) λ=0.5 confirms DIRECTIONALLY on the clean bank
(+0.083 deploy / +0.033 regen, pooled p≈0.061 — half the leaked 85f
estimate, the expected shrinkage), λ=1 flat vs 0.5 with the deploy
overspend signature — the pre-registration holds; the deploy walk
wall at λ=0.5 reads 0.318, INSIDE the signed band (the §85h wall
disposition paying off). (2) The campRaid causal read is
indistinguishable from zero — and the −6.7pt point estimate is
MECHANISTICALLY impossible as a raid effect (raid rate 1.1%,
12/1112; the pair is dominated by consultation-order RNG divergence
in the shared driver stream). Lesson for future site-causal reads:
an on/off site pair measures existence INCLUDING stream
perturbation — a raids-only read needs a stream-isolated design.
(3) The 60-vs-22.5 anomaly CLOSED: subset luck (18/30 reproduced
exactly — sim-inertness proven across b92fa75→7708b89) + ordinary
bank variation; the selection argmax stands. PENDING the user's
morning: the SIGN-pass criterion pre-specification, then 85g6d.

**85g6d — the SIGN criterion PRE-SPECIFIED (2026-08-27 morning,
user-signed BEFORE the read):** sign λ=0.5 iff the SIGN-bank paired
Δwin (deploy λ0.5 − λ0, one-use bank 3001+, n=120) is > 0; Δ ≤ 0 →
λ stays 0 and the fold ships dormant. Rationale: directional
consistency across three independent cohorts (85f +0.142 leaked ·
CHOOSE +0.083 p≈0.061 · the coherent wall/reach/bank mechanism on
both vectors) + the 85h pre-registration — SIGN is the tripwire
against sign error, not a fresh discovery (option (a) of the two
presented; (b) p<0.05-on-SIGN-alone rejected as underpowered at
Δ≈0.08). The pass: deploy × λ{0, 0.5} on SIGN 3001+, fired at this
commit's HEAD.

**85g6d — λ=0.5 SIGNED (2026-08-27, the pre-specified criterion met
with margin):** the SIGN-bank pass (deploy λ{0,0.5} on 3001–3120,
n=120, box-drive 2/2 verified) read paired Δwin **+0.092** (20/9
discordant, z=2.04, p≈0.041 — nominally significant on its own,
beyond what the criterion required). The three-bank chain: 85f
+0.142 (leaked) · CHOOSE +0.083 (p≈0.061) · SIGN +0.092 (p≈0.041).
**The ARM updates: `--prior-lambda=0.5` joins the doctrine flags**
(board.ts ARM + the paired-shape test strips the flag pair; the
sheet's signedAt carries the amendment; the agent memory's doctrine
line updated). The arb-row refs are PENDING RE-PIN at the new-ARM
baseline board (fired this afternoon, the 83a shape); the formal
0.438-wall re-read lands there (CHOOSE previewed deploy 0.318
IN-BAND at λ=0.5). 85g6b/c close with this entry; 85g6d closes at
the evening re-pin signing.

**85g6d cont. — the new-ARM baseline board (2026-08-28 overnight,
autonomous; numbers BALANCE 2026-08-28):** 25/25 verified, filed
per-ID with the λ-identity check added (arb rows must carry
--prior-lambda=0.5, doctrine rows must not — all 25 conform). The
three findings: (1) ⭐⭐ both walk walls land IN the signed band
(0.304/0.324) — the 0.438 re-read closes as the fold thesis
predicted, and the floor-hugging watch clears with it; (2) ⭐ the
fold re-activates the port economy (tx ≈0 → 0.25/0.775) — the 72f
posture-dissolution doctrine notes retire with the amendment, and
the sheet needs a `firerTransactionRate` field (the hardcoded-0
check re-pins); (3) the gambler parity breach RETURNS shape-flipped
at the fold arm (deploy −10.0 / regen +5.8) — the named next-round
item; priest clears. The deploy walk reach 0.567 above band = the
new overperformance watch (a design-target question, deliberately
NOT a re-introduced per-twin ref — that pattern died with
pre55ReachRef). Cost note for §86: fold arms ran the board ~1.5h
long (deeper runs + port traffic). PENDING the morning: the re-pin
amendment signature → 85g6d closes → the §85 phase close.

**85g6d CLOSED + PHASE 85 CLOSED (2026-08-28 morning, the amendment
user-signed "enthusiastically"):** the fold-baseline re-pin landed —
six act-1 refs + the economy refs at the fold reality
(`firerTransactionRate` joins the sheet; the 72f shops-≈never
doctrine notes retired in board.ts; the stale 0.02 tx fixture in
board.test.ts converted to the balance-proof sheet read — the same
class the 83f bank fixture caught). The amended board: **0 FAIL /
4 WARN**, the four survivors being the deliberate named watches
(deploy reach 0.567 overperformance + its derived-win twin, the
gambler shape-flip, the walk-deploy ceiling). §85's ledger: the fold
built, de-folded, shrunk, ε-floored, cohorted on three disjoint
banks, and SIGNED at λ=0.5 into the ARM; the 55pre anchor
re-derived and deployed; both walls in the signed band; the port
economy alive for the first time since 72f. Ops legacy: box-drive
promoted and 8 cohorts driven with zero manual stand-downs and zero
orphaned billing. NEXT: the §86 kickoff (perf, profile-first) — the
fold arms' ~20% batch-cost increase is the charter's newest exhibit.

## Phase 86 — kickoff (2026-08-28, shape-lock USER-SIGNED)

### The code-reality audit (two parallel read-only sweeps: sim hot
### loop · harness/batch/board)

The charter's opening question — split per-seed cost between outer
battles and rollouts — is **already answered on record**:
`benchRunRollout.ts` concludes the battle sim is ~100% of rollout
cost and the clone negligible (<0.1 ms vs 15–1700 ms). The profile
therefore goes straight at `World.tick` + the per-tick bot `decide()`
layer. The audit then moved three of the charter's four expected
levers:

1. **Pathfinding scratch — confirmed, larger than charted.**
   `findPath` (Pathfinding.ts) has zero scratch reuse: string-keyed
   Maps/Sets fresh per call, a template-literal string per cell per
   expansion, an O(open²) linear-scan pop allocating an object per
   open-set member per pop. Amplified upstream: `buildMovementContext`
   (3 Sets + 2 Maps) rebuilt 2–4× per unit per tick; §45c's stable
   route can double the A* count per goal. `routeToward` is already
   annotated "the cache boundary" (movement.ts:161).
2. **`livingUnits` is NOT in the sim** — it's a bot-layer sensor
   (`src/bot/sensors.ts:55`, 23 call sites) hit every tick via
   `decide()`; on-target for a *balancer* pass but the fix is a
   bot-layer memo, outside `World.tick`. The unlisted heavy hitter
   behind the same gate: **`armyMinCut`** — a full Edmonds–Karp
   rebuilt per traffic-script evaluate, per tick, uncadenced; its
   "fine per tick" docstring has never been tested.
3. **Map churn isn't in `World.tick`** — it lives in pathfinding /
   movement / occupancy / sensors. What `World.tick` does churn: two
   unconditional `units.slice()` copies per tick (lines 1263, 1802)
   and an array spread per `EventBus.emit` with subscribers
   (EventBus.ts:42; empty-set early-return means fresh-bus rollout
   clones pay nothing).
4. **The pooling TODO argues against itself for this phase**
   (TODO.md:176): heapUsed flat across 600 fuzz runs; the payoff it
   predicts is frame-time smoothness, not balancer throughput.
   DEPRIORITIZED unless the profile shows real GC share.

Cross-cutting: **no timing instrumentation exists on the batch path**
(no per-seed ms anywhere; "no profile ever taken" is literally true —
the only tick-level number on record is I3's ≤0.236 ms/tick in a test
comment). Any timing capture must ride a **separate sidecar**, never
summary.csv — wall clock breaks the byte-identity oracle by
construction (the decisions.csv precedent). The 47e oracle itself is
a **manual procedure, no script**.

The 85h-rider surfaces: `retryAsync` retries ANY error — deterministic
CLI crashes re-run 3×; the transient/deterministic cut line is exactly
the three reject sites (spawn `error` + 0xC0000142 = transient;
non-zero exit / missing artifact / unparseable out = deterministic).
The parallel driver is static contiguous chunks whose merge RELIES on
contiguity (parallel.ts:218–269) — a dynamic queue must keep
contiguous per-shard seed sets or re-author the merge. Staged-n has no
cross-dir merge (board reads exactly one summary.csv per instrument).
**Successive-halving is structurally blocked** — the eval-shard
boundary returns scalar winRates only, no per-seed data crosses it —
and hybrid-light's 85g4 signing removed its customer. Shadow sampling
is uniform 1-in-m keyed off the first CRN pair's cloneSeed, with a
site allowlist but no quotas. **The board structurally cannot fail**:
every check is `reference`-grade via `ref()` (board.ts:166 hardwires
it), so `fails` is always 0; missing artifacts silently drop
(cli.ts:106 `continue`); `runs` is computed and never read; seeds
aren't parsed at all (duplicates inflate silently); no provenance
concept exists — the box batch-dir name is the only HEAD carrier and
local batches carry nothing.

Stale guards caught in passing: `pathing-perf.test.ts`'s "≤2 A* per
unit per tick" bound predates §45c and holds only because its fixture
(moveCooldownTicks:1) produces no transients — scenario-dependent,
not structural. Neither bench is in package.json scripts.

### Shape-lock (2026-08-28, USER-SIGNED)

The 86a–86f cut signed as proposed, with two user riders: (1)
**robustness over cleverness** — features are still landing; no
fragile-but-fast optimization (e.g. shared mutable scratch a future
feature trips over) ships for a marginal win; (2) the user's formal
background is performance engineering — this phase's reads go
IN-DEPTH (numbers and mechanisms surfaced, not summarized away).
Proposed 86d dispositions accepted at charter level (re-signed at the
86d step): build transient-only retry + the staged-n merge helper;
measure-then-decide the dynamic queue; defer shadow quotas +
warm-start/successive-halving. Predictions: World v35 / Run v44 hold
(harness/bot/sim-internal only); no new RNG streams; signed-sheet
NUMBERS untouched (86e changes verdict plumbing, not bands).

### 86a — the first-ever CPU profiles + the timings sidecar
### (2026-08-28)

**The sidecar** (`521d606`): per-seed wall ms captured around `runOne`
only, written to `timings.csv` (seed,strategy,ms — summary.csv's keys
and ordering); `--jobs` adopts shard timings via the summary regroup.
Wall clock is nondeterministic by nature, so the file is a SIDECAR
and never a summary column — keys/order pinned in
parallelRun.test.ts, values deliberately outside the byte contract.

**The profiles** (`node --cpu-prof` through the fuzz CLI; seed 1,
soldier, the 59-regen vector; artifacts + analyzer in the session
scratchpad `prof86/`). Three shapes chosen so the deltas decompose
the stack — the cut's "walk row" refined to the doctrine CONTROL_ARM
so each shape adds exactly one layer:

| shape | flags beyond the vector | per-seed wall |
|---|---|---|
| C — pure sim + scored bot (the search-eval mass shape) | `--hops=4`, n=16 | 0.2–2.6 s (mean ~1.3 s; 12.6× seed spread) |
| B — + battle searcher (CONTROL_ARM, act-1) | `--hops=11`, n=1 | 28.5 s |
| A — the full ARM (+ arbitration walker + fold) | `--hops=11`, n=1 | 204.8 s |

**THE HEADLINE: the balancer is a pathfinding benchmark.** The
subsystem self-time rollup is near-identical across all three shapes
— the searcher and the walker just multiply how many sim ticks run,
and the sim ticks are A*:

| subsystem (self time) | C | B | A |
|---|---|---|---|
| pathfinding (A* core, Pathfinding.ts) | 51.1% | 52.8% | 49.6% |
| movement ctx/route (movement.ts) | 26.2% | 29.5% | 25.9% |
| occupancy helpers | 4.3% | 4.4% | 5.4% |
| traffic-script sensors (armyMinCut/chokeRead/…) | ~0% | 0.2% | ~7.9% |
| GC | 1.5% | 1.5% | 1.5% |
| clone + JSON + run layer + evaluator | ~0% | 0.4% | ~0.2% |

Top self-time functions on the ARM shape: `findPath` 21.0% ·
`blockFits` (the anon closure: string build + `Set.has` + a fresh
`{x,y}` per neighbour candidate per expansion) 14.8% · movement
`costAt` (the per-expansion cost callback: string key + up to 3
string-keyed Map/Set probes) 14.3% · `popLowestF` (the O(open)
linear-scan pop, re-parsing every open key via `fromKey`) 7.4% ·
`fromKey` 5.1%. **The string-keyed A* design IS the cost** — the
`"x,y"` key architecture accounts for roughly a third of the entire
balancer by itself once the parses, builds, and string-hashing are
summed.

**Findings against the audit's candidate pool** (the profile
adjudicates, per the charter):

1. **CONFIRMED, dominant:** the A* core + the movement/occupancy
   string-key layer ≈ **81% of the ARM run** (and ~82% of the
   searcher tier, ~86% of pure sim). This is the phase.
2. **NEW at ARM grade:** the walker's rollouts run the traffic
   scripts, so the script sensors surface only on shape A —
   `TrafficScriptDriver.decide` 9.4% inclusive, chokeHold 6.3%,
   `armyMinCut` 4.3% inclusive / ~6.1% self with its closures. A
   bot-layer per-tick memo caps at ~5–7%.
3. **DEAD, profile-backed:** pooling (GC is 1.5% flat across shapes
   — the TODO.md skepticism was right); clone sharing (0.1%);
   `livingUnits` memos (0.2% inclusive); the `units.slice()` copies
   + EventBus emit spread (World.ts self is 1.2% TOTAL); the
   evaluator + **the fold** (`scoreTerminal` = 3.5 ms in a 205 s run
   — the λ fold is FREE; the fold arms' ~20% board-cost increase is
   run SHAPE — deeper runs, port traffic — not per-tick compute,
   the 85g6d cost note now measured).
4. The rollout-vs-outer split, now measured rather than inferred:
   88.4% of the ARM run is inside `World.tick`, 78.7% under the
   run-layer walker, 17.5% under the battle searcher — the
   benchRunRollout "battle sim ≈100% of rollout cost" conclusion
   holds at profile grade.

**The proposed 86c lever list** (⛔ awaiting the user's signature):
L1 the A* numeric core (per-call typed-array scratch, packed
`y*W+x` indices, `blockFits` inlined numeric, the pop's 5-way total
order preserved verbatim — no shared mutable scratch, per the
robustness rider); L2 numeric keys through `PathCostContext` /
`costAt` / the movement-context builders (the string tax outside
Pathfinding.ts); L3 (optional) the per-tick traffic-sensor memo.
L1+L2 cover ~75% of self time → a plausible **2–3× per-seed**
compound; every box cohort, board batch, and the 40 h full-arb
search estimate scale with it. popLowestF stays a linear scan in L1
(numeric compares, no parse) — a heap is L1b only if the post-L1
profile still shows pop dominance.

### 86c — the lever signing (2026-08-28, USER-SIGNED)

L1 → L2 → L3 signed as proposed after the in-depth walkthrough
(pipeline refresher · per-expansion cost mechanics · the Amdahl
math), explicitly framed and accepted as **pure speedup, zero
algorithmic change** — same searches, same expansions, same paths,
same bytes. Byte-safety arguments on record: popLowestF's 5-way
comparator is a strict total order (the (y,x) tail is unique), so
the argmin is container-order-independent; L1 changes no float
summation order; the pathing baseline pins double as a free oracle
(byte-identity = NO re-pin — a moved pin means revert the lever).
**Pre-registered escalation (user's addition):** if the compound
speedup lands under ~1.5×, the phase EXPANDS to algorithmic levers
— call-count reduction (route caching at the `routeToward` seam,
flow fields, the §46 WHCA*-lite class) and a considered re-open of
the derive-don't-cache doctrine. Order of work: 86b (oracle) →
L1 → re-profile → L2 → L3.

### 86b + 86c-L1 landed (2026-08-28)

**86b** (`cb4e76f`): `scripts/perf-oracle.sh` — the 47e procedure
mechanized (worktree-pin at the baseline ref + a `node_modules`
junction; `//J` escapes MSYS path conversion; cleanup rmdir-unlinks
the junction BEFORE worktree teardown so the real node_modules can
never be recursed into). Two shapes per the 85g3 precedent: a
scored pure-sim spread (n=4, defeats included) + the full ARM at
hops=5 (non-empty decisions.csv). sha-compares summary+decisions;
timings.csv deliberately excluded. HEAD-vs-HEAD self-test PASS.

**86c-L1** (`9f01ce5`): the A* numeric core. `findPath`'s interior
state moved from string-keyed Maps/Sets to per-call typed arrays on
packed `y*W+x` indices (no shared scratch — nothing to reset);
`blockFits` + the second `costAt(corner)` folded into ONE pure call
per candidate (`fitCost`, NaN = doesn't fit); `popLowestFIdx` keeps
the linear scan but on pure numeric compares, comparator verbatim.
One real catch during the rewrite: packing an off-grid blocker
coord would ALIAS an on-grid cell (x=−1 → the previous row's last
cell) where string keys could never collide — the per-axis bounds
guard is load-bearing, don't "simplify" it. Rider landed in the
same commit: the pathing-perf bound re-annotated SCENARIO-VALID
(predates §45c stable routes; production can run 4/unit + rubble).

**Gates:** oracle PASS both shapes vs `cb4e76f` (shas identical to
the self-test run = cross-run determinism confirmed twice); 2693 +
491 green; ZERO pathing pins moved (byte-identity = no re-pin, as
pre-registered at the signing).

**The paired bench** (worktree-pinned baseline, sequential,
interleaved per shape, no profiler): scored n=16 21.88→8.95 s =
**2.44×** · searcher act-1 30.0→13.1 s = **2.29×** · full ARM
act-1 212.3→101.4 s = **2.09×**. Every shape-C seed sped up ~2–3×
(spread preserved). The ARM's 2.09× sits AT the Amdahl ceiling for
a ~50% lever (max 2.08× if the A* core went to ~0) — the string
tax WAS the core. Bonus datum: pre-commit fuzz:smoke 314→205 s.
**The 1.5× escalation floor is already cleared by L1 alone.**

**Post-L1 re-profile (shape C):** pathfinding 51.1%→29.6% ·
movement 26.2%→28.1% (proportionally grown, as predicted). New top
self-time: movement `costAt` 17.9% · `fitCost` 12.8% (its
remaining cost = the `{x,y}`-allocating public CostFn boundary +
the string-keyed probes inside `costAt`) · `findPath` 10.4% ·
`popLowestFIdx` 5.6% (≈6× cheaper absolute — L1b heap stays
deferred). Newly visible tail: `isReservedSwapPartner` 5.3%,
`nearestActingCell` 2.9%, `hasLineOfSight` 2.5%. L2 exactly as
signed: numeric keys through `PathCostContext`/`costAt`/the context
builders + the packed-index CostFn boundary.

### 86c-L2 landed (2026-08-28, `21b24e6`)

`cellIndex` (packed `y*W+x`) joins `cellKey` in occupancy —
per-grid, in-bounds-only (the aliasing caveat documented at the
definition); `PathCostContext`/`MovementContext` collections,
`claimEtas`, sidestep's occupied set, and Targeting's rubble map
all re-keyed numeric; **`CostFn` becomes `(x, y) => number`** (no
coord object per candidate — the fitCost 12.8% finding) with
`TileGrid.costAtXY` as the allocation-free twin. The type flip
enumerated the whole blast radius via strict tsc (the 82c
sweep-by-key discipline); out-of-scope string-key users (wander's
`occupiedCells`, `passable`, BFS visited sets, the serialized
`World.claims` registry) deliberately untouched. Test churn: the
movement/camps assertions re-derive expected keys from
`world.gridW` (grid-size-proof), Pathfinding.test.ts closures to
`(x, y)`.

**Gates:** oracle PASS both shapes vs `6480e31` (same shas as
every run this phase); 2693 + 491 green; zero pathing pins moved.

**Paired bench vs the L1 baseline:** scored 9.82→6.96 s =
**1.41×** · searcher 14.06→9.70 s = **1.45×** · full ARM
105.7→81.4 s = **1.30×**. **Compound vs pre-phase: 3.14× / 3.09×
/ 2.61×** — the signed 2–3× estimate hit inside two levers.
fuzz:smoke: 314 s (pre-phase) → 189 s.

**Post-L2 re-profile (shape C):** A*+movement absolute self
5426→3750 ms; the new top: `fitCost` 15.1% + `findPath` 13.3% +
`popLowestFIdx` 6.6% (real work now, not key traffic) ·
⭐ **`isReservedSwapPartner` 7.1% — #3** (the user's named
follow-up = L2b) · `nearestActingCell` 3.4% · `hasLineOfSight`
2.8% · GC 1.4%. Note for L2b: the reservation set can change
MID-tick-loop (a swap seated by an earlier unit must reserve its
partner before the partner's own iteration the same tick), so a
loop-start hoist is a behavior change — the honest shapes are a
call-count probe first, then either a scan-constant shrink or a
type-enforced `activeAction` mutation chokepoint + an
incrementally-maintained derived index (the `unitsById`/`claims`
robustness class, rebuilt on fromJSON, never serialized).

### 86c-L2b — design SIGNED (2026-08-28); build handed to a fresh
### session

The user chose the chokepoint+index shape directly, with the
honest-trade framing accepted: the current scan is correct BY
CONSTRUCTION (derive-don't-cache), and the index swaps that
guarantee for a maintained invariant — so **the signed design
keeps the derived scan as the index's VERIFIER** (the §79e
principle applied to a cache): recompute-and-compare in the
determinism/swap tests, fast index in production. Expectation
SET: ~7% on cheap shapes (the --search mass shape), only ~1–2%
on the full ARM — this lever is hygiene-motivated as much as
perf; the worklog says so out loud.

The build plan for the fresh session:
1. **Chokepoint** — `activeAction` writes route through World-owned
   seat/clear helpers. Code reality (grepped 2026-08-28): NINE
   production writes — World.ts ×8 (tick clears 1325/1344/1360 ·
   seat 1450 · instant/spawn seats 2030/2072/2431 · fromJSON 2740)
   + the SwapAction abort clear (SwapAction.ts:138). Enforce by
   type (private field + accessors), not convention.
2. **Index** — `reservedPartnerIds` (or a count-map for multi-swap
   overlaps — check whether one unit can be partner to two swaps;
   the reserve gate should make it impossible, assert it)
   maintained at seat/clear; rebuilt in fromJSON.
3. **Verifier** — the old O(n) scan stays, retitled, as the
   test-side recompute-and-compare invariant.
4. **Test churn** — ~35 fixture writes across 15 files hand-seat
   actions; route them through the seam (fixtures come out cleaner
   than the raw `{action, startTick, finishTick, phases}` literals).
5. Gates as ever: oracle vs HEAD both shapes · full suite +
   fuzz:smoke · zero pathing-pin movement · the paired bench.
Then L3 (the ARM-only traffic-sensor hoist) → 86d → 86e → 86f.

### 86c-L2b landed (2026-08-28)

Built exactly as signed. The shape: `Action.reservedPartnerId?()`
joins the optional-method idiom (`destinationCell?.()` family) so
World stays swap-agnostic; `Unit.activeAction` becomes a private
field + getter (direct assignment is now a COMPILE error — strict
tsc enumerated all 34 test writes across 13 files in one sweep, the
82c discipline) with an `@internal _setActiveAction` only World's
chokepoint calls; World gains `seatAction(unit, action, phases)`
(computes start/finish from tickCount — the shape all four live
seat sites and most fixtures share), `seatActiveAction(unit, aa)`
(raw: fromJSON + backdated fixtures; re-seat legal), and
`clearActiveAction(unit)`, each maintaining
`swapReservedPartners: Map<partnerId, actorId>` in the same breath.
The design's enumerated NINE production writes all routed; the
audit's tenth surface — `removeUnit` — unindexes a removed ACTOR
(the scan stopped seeing it the moment it left `units`; a removed
PARTNER's entry deliberately stands until the actor's flip settles
it, scan-semantics preserved exactly). fromJSON seats through the
chokepoint, so the index rebuilds on rehydrate for free — including
`cloneForRollout`, which is a fromJSON round-trip. Mid-tick-loop
mutation ordering (the no-hoist caveat) is preserved by
construction: the index updates at seat time, inside the loop.

The one-reservation-per-partner question resolved as predicted: the
`isSwappablePartner` gate makes a double-reserve unreachable live,
so `seatActiveAction` THROWS on it (loud, the missing-prior-table
style), pinned by a test.

**The verifier** (the signed §79e rider): the old O(n) scan
survives as `scanReservedSwapPartners` (SwapAction.ts, documented
never-in-production), and recompute-and-compare rides FOUR homes —
per-tick in determinism.test.ts's replay loop, per-tick in
layout-deadlock.test.ts (corridor layouts seat real swaps through
the production chokepoint — the invariant exercised where it
lives), plus a dedicated index-lifecycle suite in SwapAction.test.ts
(seat → abort-clear · actor-removal · partner-removal ·
double-reserve throw · fromJSON rebuild).

**Gates:** typecheck clean · 2698 main green (2693 + the 5 new
lifecycle pins) · fuzz:smoke 491 green · **oracle PASS both shapes
vs `08a002e`** (summary + decisions sha-identical) · zero pathing
pins moved.

**The paired bench** (same protocol, run TWICE for stability;
sidecar-ms ratios): scored **1.224× / 1.193×** · searcher 1.000× /
1.036× · full ARM 1.007× / **1.025×**. ARM lands inside the
predicted 1–2%; searcher sits at the noise floor (no regression
from the getter indirection); scored comes in WELL above the ~7%
expectation — the scan's 7.1% was SELF time only, and the retired
cost also included the per-free-unit tick-loop scan plus every
proposer's `isSwappablePartner` probe, so the inclusive tax on the
scan-heavy cheap shape was roughly 3× its profile self line. Bonus
datum: pre-commit fuzz:smoke 189 → 172 s. Compound vs pre-phase
(from the L2 close, scored ≈ 3.14 × 1.2): **~3.8× scored / ~3.1×
searcher / ~2.7× ARM**. NEXT: L3 (the ARM-only traffic-sensor
hoist) → 86d.

**⚠ CORRECTION (2026-08-28, caught during L3):** the scored 1.2×
reading above was INSTRUMENT BIAS, and the "inclusive tax ≈3× the
self line" mechanism story authored to explain it is retracted.
The bench's first measured leg ran on a FRESHLY CREATED worktree —
cold file reads + AV scanning inflate a ~7 s leg by ~10–15%, and
the scored shape always ran first, always on the baseline side.
Proof (the L3 bias probe): with one warmup leg on the worktree
first, scored reads 1.022/0.985/0.982 vs a baseline (L2b+L3 vs
L2b) where the true ratio is exactly 1.00 by mechanism; and the
warmed re-measure of the REAL L2b question (08a002e vs the
L2b-carrying tree) reads **1.086/1.093/1.105 ≈ 1.09×** — right on
the pre-registered ~7% expectation. The searcher/ARM legs ran
second/third on the already-warmed worktree, so **the L2b searcher
and ARM numbers stand as reported**. Corrected L2b line: **~1.09×
scored / ~1.0× searcher / ~1.01–1.03× ARM** — the expectation was
right; the instrument was biased. Lesson filed (retro/scratchpad):
warm a fresh worktree with a discarded leg before the first
measured one.

### 86c-L3 landed (2026-08-28)

**Profile-first re-read (the signed doctrine):** a fresh ARM-shape
CPU profile at the L2b HEAD showed the traffic-sensor share had
GROWN as A* shrank around it — `chokeRead`'s subtree (armyMinCut
5.2% self + its closures 5.5% + chokeRead's own reduces 4.8%) =
**16.1% of the whole ARM run**, up from ~7.9% at 86a. Every other
sensor is noise (jamRead 0.7% incl; regroupCell 2.9% self — noted,
out of scope). The cost is pure call volume: the walker's rollout
battles run `TrafficScriptDriver.decide` every tick, and every
tick that reaches script #3 recomputes the max-flow from scratch
at ~6 µs × millions of rollout ticks.

**The call-count probe first (per the L2 close's prescription):**
the memo's decisive number is the exact-input repeat rate across
consecutive ticks — measured 76.5% overall across all 12 layouts ×
3 seeds of real trigger-driven battles (88.8% on isthmus, where
choke actually fires; worst 58.7% labyrinth). Positions only flip
at move-impact boundaries and walls never move, so most ticks the
choke read's entire input vector is byte-identical to the last.

**The build:** an EXACT-INPUT memo at chokeHold.ts' consumer seam
(`chokeRead`), NOT a hash and NOT a same-tick memo: the key is an
element-wise-compared Int32Array of every input the compute reads
— `TileGrid.mutations` (a new monotonic, never-serialized epoch
bumped in `setKind`; production only mutates tiles at setup, tests
mutate freely) + per unit in `world.units` order (order IS an
input — it fixes edge insertion order, which fixes the augmenting-
path order the cut extraction depends on): id, team, position,
alive flag, footprint, inert flag. A hit means the pure function
would return the identical value — no staleness class exists. The
proposal is re-cloned per call (callers historically got fresh
objects; proposals flow into `world.objectives`). Memo keyed
per-World-INSTANCE (WeakMap — rollout clones never share) and per
team. `armyMinCut` and all of sensors.ts stay CACHE-FREE — the
54b doctrine header now points at this one sanctioned exception.
The pure compute survives exported as `computeChokeRead`, the §79e
verifier surface.

**Verifier + pins (chokeHold.test.ts):** recompute-and-compare
across a real driven isthmus battle (memoized === fresh every
tick, hits > 0) · DECISIVE invalidation pins for position, death,
and tile mutation (each mutation chosen so stale ≠ fresh — a
broken key fails loudly, never vacuously) · fromJSON clones never
share entries.

**Gates:** typecheck clean · 2703 main (2698 + the 5 memo pins) ·
491 fuzz:smoke · oracle PASS both shapes vs `864f7b2` (same shas
as every run this phase) · zero pathing pins moved.

**The bench — and the instrument catch:** the ARM, 4 alternating
warmed pairs: **1.100 / 1.089 / 1.115 / 1.104 → median 1.10×**
(83.0 s → 75.5 s), matching the 16.1% × 76.5% ≈ 11–12% prediction
(net of key-build overhead) — double the 86a memo estimate because
the sensor share had doubled since. Searcher ~1.00 (nominations
are rare — expected). Scored 1.00 EXACTLY (bias-corrected — the
shape runs no driver at all, which is what exposed the cold-
worktree first-leg bias and forced the L2b correction above).
fuzz:smoke 172 → 140 s (the fuzz suites run walker rollouts —
real, ~19%). Compound ARM vs pre-phase: **~2.9×** (2.61 × ~1.02 ×
1.10); scored ~3.4× · searcher ~3.1× (bias-corrected compounds).
NEXT: 86d (the batch riders — decision point: dispositions
re-signed).

### 86d — the batch riders (2026-08-28, dispositions RE-SIGNED + landed)

The charter dispositions re-signed at the step with two user
amendments from the shape-lock Q&A: (1) **no hard-coded Windows
error code as the classification** — the robust cut derives from
determinism itself (process-reported failures recur on retry;
environment failures clear), with 0xC0000142 demoted to a
win32-GATED special case; (2) the dynamic queue lands as the
finer-chunk pool, explicitly NOT a persistent-worker protocol
("given how much speed-up we just got, we don't need a full
parallel runtime — at least not yet").

**86d1 — transient-only retry.** `retryAsync` gains a `retryable`
predicate; both shard drivers reject typed `ShardError`s via
`classifyShardExit`: spawn `error` events + signal kills (code
null — previously retried by ACCIDENT as "exited with code null")
= transient on any OS; any other non-zero exit + broken artifacts
behind exit 0 = deterministic, FAIL FAST (no more re-running a
multi-minute shard twice against a crash determinism guarantees
will recur); 0xC0000142 transient on win32 only (both signed/
unsigned encodings). Six new pins (predicate fast path + the
classification table).

**86d2 — the staged-n merge.** `--merge-stages=<dirs> --out=<dir>`
folds same-arm stage dirs with adjacent seed windows into the
byte-identical artifact set of one serial run — the n=120
protocol's 40+80 extension finally lands in ONE summary.csv per
instrument. One regroup serves all five per-run-row csvs (they
share the `seed,strategy` leading columns; mergeSummaries
exported from the --jobs parent). Guards, all loud: header +
strategy-set equality · the same-arm check over box `args` records
(partition flags stripped; the protocol's same-arm rule made
checkable — same-HEAD verification stays 86e's) · disjoint +
contiguous windows · uniform sidecar presence · not-reproduced
files LISTED, never dropped. Pins: the REAL oracle (serial n=12
vs staged 4+8 — summary byte-identical, timings keys, failures) +
six synthetic guard pins.

**86d3 — the dynamic queue, measured then built.** The
measurement (12 real 85g6 box batches, per-seed totalTicks as the
wall proxy): per-seed spread 5.7–14.7× within one arm; static
contiguous chunks run a median **~1.15× ideal makespan** (range
1.06–1.22); per-seed dynamic assignment ~1.05× — **median ~8% of
batch wall, range −7% to +14%**. Built as the finer-chunk worker
pool: `CHUNK_FACTOR=4` × jobs contiguous chunks, at most `jobs`
children live, workers pull the next chunk INDEX as they free.
The merge is UNTOUCHED (chunks stay contiguous ascending, read in
index order) so byte-identity holds by construction — the
existing parity pins exercise chunks > workers for free and PASS.
Per-seed granularity rejected on the tsx import tax (~2–4 s per
child ×80 spawns eats half the win) and on spawn count AS the
risk surface (0xC0000142 is spawn-under-load). Expected box-batch
wall: ~5–8% off, net of ~8–16 s chunk overhead.

**86d4 — deferrals re-signed:** shadow quotas (no consumer) +
warm-start/successive-halving (structurally blocked at the
eval-shard boundary; hybrid-light removed the customer).

Landed as three commits (d1 · d2 · d3), each hook-green;
predictions HELD: no snapshot bump, no new RNG streams, no
signed-sheet movement. The sweep sharding (searchShard's
vector-level chunks) deliberately keeps static chunking — its
imbalance is vector-count-shaped, unmeasured, and no live
consumer complained; re-measure if a §88-era sweep straggles.

### 86e — the board split kickoff: shape-lock + 86e1 (2026-08-29)

**The step's premise re-verified against the tree** (the step-zero
rule): all seven kickoff-audit findings still hold at the 86d3
close — every board check is `reference`-grade so `statusFor` can
never emit FAIL (board.ts:530 / the `ref()` hardwire at 166) and
the CLI's exit-code gate is dead code; a missing summary.csv is a
`continue` + a footer line (cli.ts:106), never a verdict; `runs`
is computed and never read; seeds aren't parsed at board level
(dup-seed inflation is silent); an empty `strategyRow` filter
reads as winRate 0 instead of "wrong arm"; a checked metric's
null renders N/A and gates nothing; and no output dir carries any
provenance (86d2's header comment is the written IOU).

**Shape-lock (USER-SIGNED 2026-08-29), the e1–e4 cut:** e1 the
machine manifest (run / jobs-parent / merge-stages sidecars) ·
e2 the three-way report split — VERDICT (fail-closed integrity,
exit 1) / DRIFT (the reference bands, WARN unchanged) /
INSTRUMENT HEALTH (inert-class tripwire + gradients) · e3 the
skill-gradient anchor rows · e4 the fail-closed pins + docs.
The ⛔ decision point resolved on the proposed recommendations:
(A) missing manifest = FAIL by default, `--allow-unmanifested`
downgrades exactly that check to WARN for pre-86e1 archives,
loud in the report header; (B) cross-dir HEAD mismatch FAILs
(the SAME-HEAD protocol made checkable), measurement-HEAD vs
the evaluating tree's HEAD prints prominently but only WARNs
(docs commits legitimately land between a box fetch and
--report); (C) anchor cadence: random+greedy ride every full
board, searched-upper required only at amendment/re-pin boards.
Predictions (carried from the phase shape-lock): harness-only,
World v35 / Run v44 hold, no new RNG streams, no signed number
moves, summary.csv schema untouched.

**86e1 landed — the per-batch machine manifest.** `manifest.json`
in every batch out dir: `head` (a bare sha — the §85g free-text
lesson; null = git unavailable, recorded honestly and judged by
e2, never papered over at capture), `dirty`, the verbatim argv,
`seedWindow {firstSeed, count}`, kind (run / jobs-parent /
merge-stages), version, timestamp. Sidecar discipline throughout:
never on a byte-identity surface (the 86b oracle + all parity
pins compare named files, verified before writing a byte).
Placement: serial run.ts beside timings.csv; the --jobs parent
after the shards wipe (shard manifests die with the scratch
dirs); --merge-stages derives the STAGES' provenance — common
head, dirty-OR — never the merging machine's HEAD (it reassembled
bytes, it measured nothing). The merge also gains the upgraded
guards: manifest-argv same-arm check (authoritative over the box
`args` proxy, which stays for pre-86e1 box dirs) and a loud bail
when stages name PROVEN-different heads — the n=120 SAME-HEAD
rule is now machine-checked at the merge seam. One list for
partition flags now (`PARTITION_FLAG_PREFIXES` in manifest.ts;
parallel.ts + mergeStages.ts import it). CliArgs gains optional
`raw` (parseArgs stashes the verbatim argv). Pins: +4 manifest
(round-trip, real-repo git capture, loud-on-corrupt read —
a broken provenance record must never quietly read as "no
provenance", flag-boundary strip) · +3 merge guards (different
heads bail, different manifest arms bail, unmanifested stage
merges with null provenance) · the real oracles extended (the
merged dir's manifest carries the stages' head over the union
window; serial + jobs-parent manifests asserted in the parity
pin). 16/16 across the three suites; typecheck clean.

**86e2 landed — the three-way verdict split.** The report is now
VERDICT → DRIFT → INSTRUMENT HEALTH, with distinct semantics per
section. VERDICT is the fail-closed integrity layer
(`evaluateVerdict` in board.ts, pure — cli.ts only gathers
per-dir facts into `InstrumentAudit`): missing / unparseable /
empty / arm-match-0 / under-`BOARD_MIN_N`(40) / dup-seed /
seeds-vs-manifest-window / provenance (no manifest · corrupt
manifest · head=null · dirty tree · manifest-argv ≠ the
instrument's arm signature) / N/A-on-a-checked-row (metrics AND
deltas) / cross-dir head-split — every one a FAIL and exit 1.
DRIFT is the untouched reference-band table (`signed`-grade
still FAILs there; none exist by the 68d design). HEALTH holds
the 84f2 inert-class tripwire (never gates), ready for e3's
gradients. Decisions wired as signed: `--allow-unmanifested`
downgrades exactly the missing-manifest check to WARN (loud
banner; corrupt/dirty/head-split still FAIL under it);
measurement-HEAD vs the evaluating tree prints on the report but
only WARNs; cross-dir split FAILs and voids `measurementHead`.
parseSummaryCsv now extracts `seed` (the verdict layer's
dup/window reads); the drift/metrics layer is otherwise
untouched — all 20 pre-existing board pins pass unmodified.
+6 mechanism-smoke pins (clean-board PASS · missing FAIL ·
decision A both modes · decision B both halves · checked-row N/A
FAIL · wrong-arm FAIL); the per-class CLI-level fixture pins are
e4's charter. Live verify against the real 85g6d fold-baseline
dirs: strict read = 15 provenance FAILs, exit 1 (all pre-86e1
archives — exactly decision A's case); `--allow-unmanifested` =
integrity PASS at 15 WARNs, exit 0, and the drift table
reproduces the known 0 FAIL / 4 WARN baseline byte-for-byte in
values. The old silent shapes are all dead: the MISSING footer
still prints, but a missing dir now also FAILs; `runs` is
finally read; a stage dir reported next to its merged superset
now trips the window check.

**86e3 landed — the skill-gradient anchors.** Two new checkless
board rows, `anchor-random` + `anchor-greedy`: the registry's two
bare baselines (`pure-random`, `greedy`) on the act-1 shape —
SAME shape as the arb soldier rows, because probe-shape win rates
are shape artifacts and a gradient only reads on shape-matched
legs. Deliberately guileless: no searcher/redraw/empower/
arbitrate/λ (pinned by test — the floor must not carry the arm).
`evaluateSkillGradient` (pure, HEALTH section, never gates):
random < greedy < the-best-act-1-ARM-row; an INVERSION is a
broken instrument, not a balance finding. Decision C as signed:
the two cheap anchors ride every full board (they cost ~a minute
total at n=40 --jobs=8 — no searcher); the searched-UPPER leg is
the standing arb rows day-to-day, and at amendment/re-pin boards
the protocol requires a FRESH `--search` derive as the ceiling
read (the 85g5 frozen-vector lesson; e4 writes this into
BALANCE). Rider: an explicit `--only` now scopes verdict+drift
to the selection under a loud PARTIAL-BOARD banner — fail-closed
targets SILENT partiality; a named smoke read is legitimate but
never a signing board.

⭐ The maiden live run vindicated the verdict layer on its first
read: the anchor batches ran with the 86e3 edits UNCOMMITTED, and
the board FAILed both rows — "the batch ran on a DIRTY tree — the
measurement HEAD is not the code that ran" (manifest head 132b648
+ dirty:true). Pre-86e2 this read would have printed clean rows
and exit 0. First gradient values: pure-random 0.200 < greedy
0.225 (ok; NOTE the bare-baseline gap is narrow at n=40 — an
occasional inversion WARN there is expected noise, the
ARM-vs-anchor legs are the load-bearing ones), ARM legs 0.667/
0.758 — a wide healthy gradient. +4 gradient pins + the bare-
anchor definition pin; the two board-definition tests that
asserted every row runs the extended arm now exempt the anchor
category (an honest structure change, not a relaxation).

**86e4 landed — the fail-closed contract as tests + the protocol
docs; §86e CLOSED.** `boardCli.test.ts`: the FAIL classes pinned
through the REAL `balance:board --report` entry — the exit-code
wiring is exactly the part that sat dead for two months, so
pure-layer pins weren't enough. Four spawns (~6 s): a happy
17-instrument fixture tree (integrity PASS, exit 0, the
vs-current WARN riding — decision B's soft half); one
mega-mutation tree (nine independent per-instrument breakages in
ONE report, classes judged per-instrument so none masks another:
missing · unparseable · arm-match-0 · under-n · dup-seed ·
window-mismatch · no-manifest · dirty-tree · wrong-arm-manifest ·
head-split · checked-row-N/A — exit 1, every class named); the
decision-A pair (strict exit 1 / --allow-unmanifested exit 0 +
the loud banner). One test-authoring catch worth keeping: the
first draft's `manifest:false` re-write left the happy tree's
manifest lying and the whole tree read clean — the fixture bug
was itself the silent-staleness shape the verdict exists to
catch; writeDir now deletes. Docs: BALANCE gains §"The board
integrity protocol" (the three-way split, the FAIL classes, the
HEAD discipline, the anchor cadence incl. the signing-board
fresh-derive rule, the PARTIAL-board rule) + the 86e3 anchor
maiden read in the run log (random 0.200 · greedy 0.225 · ARM
0.667/0.758, monotone, values reproduced exactly across the
dirty-tree first run and the clean re-run); AGENTS gets a
one-line pointer in the box-ops bullet. Operational note for the
next board cohort: the 15 standing archive dirs are pre-86e1
(unmanifested) — the next FULL board run re-measures everything
manifested at one HEAD, plus the two anchor rows; until then a
full `--report` needs `--allow-unmanifested` and is not a
signing read.

### 86f — the close: the direct end-to-end re-run (2026-08-29)

The compound numbers this phase carried (~3.4×/~3.1×/~2.9×) were
CHAINED per-lever ratios measured at different HEADs on different
days — the close replaces the chain with ONE direct measurement:
the three 86a shapes, pre-lever baseline `d24362e` (the last
commit before L1; carries the timings sidecar, zero levers) in a
worktree + node_modules junction vs the 86e-close HEAD `087bd75`,
warmed with a discarded scored leg first (the L2b lesson),
3 alternating same-seed pairs per shape, sidecar-ms totals:

| shape | base ms (×3) | HEAD ms (×3) | ratios | median |
|---|---|---|---|---|
| scored (hops=4, n=16) | 21719/22040/21919 | 6692/6356/6116 | 3.25/3.47/3.58 | **3.47×** |
| searcher (act-1, n=1) | 31062/30804/30910 | 9386/9269/7506 | 3.31/3.32/4.12 | **3.32×** |
| full ARM (act-1, n=1) | 220807/219586/217540 | 75279/74120/73678 | 2.93/2.96/2.95 | **2.95×** |

Every chained estimate CONFIRMED and slightly exceeded by the
direct read (3.4→3.47 · 3.1→3.32 · 2.9→2.95); the ARM triplet is
strikingly tight (base spread 1.5%, head spread 2.2%). No
regression from the 86d/86e riders (the manifest write is
noise, as predicted). Bonus verification: the seed-1 ARM
summary row is BYTE-IDENTICAL between the pre-lever tree and
the close HEAD — the phase's per-lever oracle chain confirmed
end-to-end in one diff. fuzz:smoke at the close: ~146–152 s
under pre-commit load at 524 tests (pre-phase: 314 s at 504).
Worktree + junction removed cleanly (junction rmdir'd first;
main node_modules verified intact).

Instrument note for the scratchpad: the first scored pair read
exactly 1.00× because a persisted `cd` ran BOTH legs on the
baseline tree — the absurd ratio was the tell; paired-bench legs
now subshell their cd. (Same family as the §57g/L2b lessons:
the bench's failure modes are the instrument's, and an
implausibly clean number is the first thing to distrust.)

**§86 CLOSED.** Every step user-signed; predictions all HELD
(World v35 / Run v44 untouched, no new RNG streams, signed-sheet
numbers untouched — 86e changed verdict plumbing, not bands).
What the phase bought, concretely: a full ARM act-1 seed
205→74 s · a box ARM cohort at n=120 ≈ 7→2.5 h before the d3
pool's ~8% · the hook's sim-touching path 314→~146 s · and the
40 h full-arb search estimate now ≈ 14 h (still a box job, but
a tractable one). NEXT = the §87 kickoff (roster realism:
`playerArchetypes` capture + `--roster=sampled:<hop>` → the X3
re-read).

## Phase 87 — Roster realism for isolation reads

### 87 kickoff: code-reality audit + shape-lock (2026-08-29, USER-SIGNED)

Step-zero re-verify of the spec's "Confirmed:" line (written
2026-08-22, three phases of churn back) — every premise HOLDS:
`playerArchetypes` exists nowhere; the capture site is
harness.ts:515 (`playerLevels` beside `UnitTemplate.archetype` —
a sibling map + the PartialBattle/hang-path copies); `--roster` →
`parseRunConfig` → `RunConfig.startingRoster`, resolved ONCE for
all seeds in run.ts (so the sampled mode needs a per-seed
harness-side seam); per-battle rows reach disk only via the
opt-in results.json — the spec's "a reporter column"
under-scopes it, and the real deliverable is a `rosters.csv`
SIDECAR riding every batch (timings.csv discipline: MERGEABLE +
shard adoption; unlike timings it is fully deterministic, so the
parity pin is byte-identity). The table pipeline's precedent is
exact: `prior:table` (sweep sidecars → committed JSON with
machine `measurementHead` provenance, refuse-empty).

The signed cut: **87a** the capture (`playerArchetypes` +
rosters.csv through serial/--jobs/--merge-stages, parity-pinned)
· **87b** ⭐ the capture cohort DOUBLES as the manifested
full-board re-measure (one box-drive.sh cohort kills the 86e
"archives are unmanifested" ⚠, gives the anchors their first
boxed read, AND sources the table; n=40 rows, extension via the
now-verified --merge-stages only if a re-pin question arises;
expect WARN families vs the n=120-pinned refs — a drift read,
not a re-pin) · **87c** the table + the mode (`roster:table` →
`tests/fuzz/board/roster-table.json`, whole rows with
multiplicity keyed (character, sector, hop);
`--roster=sampled:<hop>` act-1 default / `sampled:<sector>:<hop>`
act-2, per-seed seed-derived RNG, loud-throw contract, composes
with the full ARM) · **87d** the X3 re-read cohort under sampled
rosters on the fold's ARM — the per-kind bands dispositioned
hold / re-pin / defect (⛔ the dispositions are the user's).
Predictions: World v35 / Run v44 hold; no new serialized RNG
streams (the sampler RNG is harness-local); default arms
byte-untouched (the sidecar is additive).

### 87a landed — the roster capture (2026-08-29)

`BattleResult.playerArchetypes` beside `playerLevels` (the same
pre-damage capture at the encounter snapshot, the hang-path copy
included; index-paired — the whole-row contract §87c depends on,
pinned against a real driven run with every entry validated
against ALL_ARCHETYPES). The `rosters.csv` sidecar rides EVERY
batch: `seed,strategy,character,sector,hop,archetypes,levels`
(pipe-joined lists), one row per battle — fully deterministic
(unlike timings.csv), so the --jobs shard regroup and the
--merge-stages regroup reproduce it BYTE-IDENTICAL to serial
(both real-spawn oracles extended and green). MERGEABLE gains it;
the parent adopts it timings-style. Character stamped per row
from the batch's resolved selection (uniform per batch — the
§68 per-batch isolation makes the column trivially correct).
Six harness fixture literals gained the field (typecheck-
enumerated). Every future batch is now capture-usable — the
capture cohort (87b) needs no special arm.
