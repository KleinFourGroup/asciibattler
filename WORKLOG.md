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
