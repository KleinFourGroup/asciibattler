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

## Kickoff (the spec session)

_(Lands at the spec session: the code-reality audit of the four
surfaces, the design conversation, the shape-lock, the phase cut.)_
