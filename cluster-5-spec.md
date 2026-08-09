# Cluster 5 Spec

## "I'm the Map"

Seriously, what am I doing with these subtitles?



Cluster 5 seeks to flesh out the additional categories of content for asciibattler.  Nebulously, we are calling these map improvements, but this refers to both the sector map and the encounter layout map.  Really, it's a grab bag.

### Events

We have for a very long time deferred the creation of event nodes.  Event nodes are a new class of node in the sector map.  They generally work as follows:

* Any given event node has a JSON-config chance to simply resolve on entry to a combat encounter.
* Otherwise, the event proceeds as a small choose your own adventure.

  * Text with a list of choices beneath.
  * Each choice can advance to a different screen in the decision tree, award pool health, award bits, award supplies, award daemons, award new units, remove any of those, drop the player into an encounter (with a predetermined reward), and overall recombine these options in any way possible.
  * The aforementioned list should not be treated as exhaustive, though I think it covers most points.
* We also need a way for there to be chains of events, possibly spanning sectors.
* Right now, events are text-only, but we want a seam to add corresponding artwork, and also probably various FX.
* The ratio of events to combat encounters should be fairly even.

I have no idea how such a system is usually implemented, so we'll have to have an education session.  We'll also want a design session for an initial demo catalog.  And the corresponding editor(s).

### Camps

Right now, battles still tend to be rather one dimensional.  Aside from stalling in front of certain hazards, there's little reason to engage with the entirety of an encounter layout.  We propose solving this with neutral camps:

* A camp is a group of neutral enemy units.
* Camps are non-aggressive by default, but will become hostile to a faction upon being attacked.

  * Hostility is shared among the camp as a whole.
* When non-aggressive, units in a camp wander within a leash of their spawn point.
* Spawn points are a single tile.  Units can spawn in anywhere that they overlap with the tile.

  * Need to make sure that, upon spawning, a camp unit wanders off the spawn in a timely manner, so it doesn't just block permanently.
* Camps are pre-defined in their own editor.  Layouts are expanded to include a weighted list of valid camps.
* Camp spawns are distinct from spawn regions.  Each camp spawn randomly selects a camp from the layout's list, resolved on turn start.

  * ⚠ As shipped, "resolved on turn start" replays identically within one encounter (the camp stream rides the per-encounter terrainSeed — K3.5), so camp identity is de facto PER-ENCOUNTER. Found + punted 2026-08-09 (worklog §75i-post): the feel verdict rides 75j; a true per-turn stream folds into §77's keyed-stream rider if wanted.
* Credit for killing a camp goes to the faction who kills the last unit of the camp.
* Each pre-defined camp has a reward table, just like an encounter.
* The reward table is rolled if the player successfully kills the camp, and the rewards are granted upon turn completion.
* Camps do not count toward health pool calculations.
* Hostile camps do not block turn end; they must be killed before the enemy.

  * This last point is the one I am least sure of, so we might want to leave a seam for them to block turn end.  That's a feel decision, not a balance one.

We'll need a design session for the initial demo catalog.

### Additional Archetypes and Unit Mechanics

#### Missing Ability Type: Auras

I don't think we have a way to express passive auras.  I'm thinking of ones that provide a buff, such as mobility +1, etc., for all units inside the aura, lasting possibly for a duration after a unit leaves the aura.  This seems like a pretty important tool for crafting support units, which the game doesn't really have outside of healers.

#### New Abilities

I propose the following new abilities:

* Inspire: an example of the aforementioned auras.  Let's go with a +1 mobility, 3 range?
* Molotov: 3x3 AoE, range 4, weak but inflicts burn.
* Pistol: very high frequency, very low accuracy, weaker than a bow, range 4?  Think a cowboy just firing off like crazy.
* Halberd: A range 2 melee.  Slow, moderate accuracy, but hits heavy.
* Cane.  Melee equivalent of the pistol.

#### New Units

We'll do a design round to create archetypes that use the new weapons.

### Sector Map Generation Rework

Right now, sector maps feel a bit *too* random.  Nodes with out degree > 1 should feel like a choice, but often instead the subsequent paths play out identically, sometimes almost immediately rejoining.  It is fairly common for there to be no early elite, rest, or shop.  It's also fairly common for these nodes to be all "on the same path"--only being accessible if a specific early edge is taken, leaving the majority of the map unreachable if the player wants to visit these nodes.  This is a very fuzzy concept, but we need balance.  I don't know if there's an industry standard for this, or if we just develop metrics and regenerate until they all pass, so I think this is another education-cum-design item.

#### Source Node Rework

I additionally propose that the first node of a sector should be an event node, in particular drawn from a specific per-sector weighted list of starting events.  I don't know if we treat this as a separate node type or not, but the idea is simply that it should be a thematic introduction to the sector.  This means that we're going to need to overhaul the generation of sectors for balance isolation testing.

### Stat Feel Changes

Right now, a lot of the stats for specific units don't feel all that meaningful.  Constitution and the appropriate might stats are visible very quickly, as is defense; but an evasion, precision, or luck level up is complete noise.  Speed isn't much better.  On the other hand, a mobility level is almost too pronounced.  We need to tweak these so that half the stats feel like more than window dressing. Again, this is going to need to be another design session.

### Rebalance

We've changed a lot here!  In particular, we now are introducing two new classes of content whose benefits accrue over a long time, outside of the one-hop myopia horizon for the new balancer.  There should be a proposal for dealing with this somewhere in the balance log, but let's do a fresh design round to lock things in.

### Graphical: Glyph Alignment Investigation

Glyphs on the edge of the map (or more likely the edge of the camera viewport) often appear to be out of alignment with their corresponding tile.  I suspect this is because the glyph quad is centered on a point directly above the tile in 3D space, rather than screen space.  However, this more broadly gestures at issues with the current display system.  Click box for each glyph is not fully intuitive, and the footprint of multi-tile units isn't exactly clear.  I think a fresh design round might be necessary here, to formulate and compare different billboarding techniques.  (I.E. maybe we don't actually want pure billboarding, but instead a quad in 3D space?  Maybe all glyphs need a border?)

### Objective UI/UX: Objectives

* The objective buttons work as follows: the button corresponding to the active objective is highlighted.  However, the default objective maps to the Stop button, which... Looks unintuitive.  We should make it so that "Stop" is never highlighted.
* Right now, right click sets the engage objective, and left click does nothing.  Left click should now set engage, and right click should set focus.
* I often find myself trying to set objectives by clicking the corresponding unit cards in the in-battle HUD.  We should extend the aforementioned click controls to the HUD unit cards.
* The objective buttons should be larger.

### Empower UI/UX

Right now, the empower markers on the pre-turn unit cards are all the same, and I believe have a longstanding bug in which their hover text is merged.  This is particularly confusing as there are already different types of empower.  I propose that we allow different types of empowers to be color coded, and to subsequently fix the hover text bug (if we didn't already).  We should also make it so that empower markers render on the in-battle unit cards.

### QOL: Sector Map View

We need a way to quickly view the sector map from any scene in the game.  It's particularly important when in ports, and I imagine will be useful in encounters, to inform the importance of camp objectives.

### Miscellaneous Investigations

We would like to conduct a series of audits into the current code base, specifically to identify how easily certain features may be added in the future.  We propose the following:

* Audit of events with missing and/or reused sounds
* Feasibility of adding music to the game.
* Feasibility of adding achievements to the game.
* Feasibility of adding a tutorial to the game.
* Feasibility of adding balance telemetry when deploying the game online.

Actually implementing these is out of scope (some of these are explicitly cluster 6), but I think we should begin planning them out, just so we don't make life harder for future us.

### Development QOL: Pre-commit Hook

The pre-commit hook takes roughly five minutes to run.  This is a painfully long amount.  We should revisit what should and should not run.

## Kickoff resolutions (LOCKED 2026-08-05 — the spec-audit design conversation)

Decisions from the five-surface code-reality audit + the design
conversation. These amend the draft above; findings + rationale in
WORKLOG §Kickoff. All sections user-signed (the two items originally
marked PROPOSED — the rebalance scope and the glyph demotion — were
approved at the 2026-08-05 veto pass).

### Events — LOCKED

- **Grammar: a flat page-map with id references** — an event is
  `{ id, pages: Record<pageId, Page>, entry }`; a page is
  `{ text, art?, choices[] }`; a choice is
  `{ label, condition?, outcomes: Weighted<{ effects[], next }>[] }`
  where `next` is a `pageId` or a terminal (`return-to-map` |
  `start-encounter { encounterId, rewardOverride? }`). No recursion —
  pages rejoin and chains cross-reference by id (the FTL lineage, not
  the StS hand-coded-class lineage).
- **Randomness lives in weighted outcome lists on choices**;
  deterministic is the single-entry case.
- **The combat-resolve chance is GLOBAL** (StS ?-node style; the fight
  draws from the sector's normal pool; the roll happens BEFORE the
  event is picked, keeping event defs pure). ⭐ **Routed through the
  Rule/fold vocabulary from day one** (a foldable seam, the
  `bitsMultiplier` pattern) — daemons that play with this chance are
  planned content, so a raw config read is wrong by construction.
- **Condition vocabulary v1** (closed union): `bits ≥ n`,
  `poolHealth ≤/≥ n`, `hasDaemon`, `hasPacket` / `cacheHasRoom`,
  `rosterSize ≥/≤ n`, `characterIs`, `flagSet` / `flagIs`.
- **Chains = persistent flags**, run-lifetime by default, namespaced
  `chainId:key`, explicitly EXEMPT from `advanceSector`'s reset
  (sector-scoped flags are a later opt-in special case). Eligibility
  conditions on the event pool roll read flags — the flag store IS the
  chain state.
- **Effect ops** extend the instant-op executor's closed union:
  `gainBits`/`spendBits`, `healPool`/`damagePool`,
  `addPacket`/`removePacket`, `addDaemon`/`removeDaemon`,
  `grantUnit`/`removeUnit`, `setFlag`. **"Supplies" = packets**
  (pinned; no new resource). The removal side is the genuinely new
  plumbing: `removeRosterUnit`'s map/port guard widens to the event
  phase (gotcha #118 discipline — both chokepoints), packet-removal-by-id
  is new, and reward tables gain `unit` and `poolHealth` entry kinds.
- **Run integration = the port model**: `'event'` joins `NodeKind`
  (the W2 elite touch-list is the checklist) and `RunPhase`
  (`event:entered` → a thin `EventScene`; exit via the
  silent-transition pattern). Serialized: an
  `{ activeEventId, pageId }` cursor + the flags record + ONE dedicated
  `eventRng` stream (filter-dependent draws — the `rewardRng`
  rationale). **RunSnapshot v40→v41.** Known accepted limitation:
  `devLoadRun` stays map-phase-only until Cluster 6.
- **The bot plays events by arbitration** — this is what the
  rollout-arbitration interstitial was sequenced for. Event pages are
  decision sites: choices enumerate as candidates, truncated rollouts
  arbitrate. Gambles are honest by construction: `eventRng` joins the
  `cloneForRollout` re-seed list (the §57d/69a clairvoyance guard), so
  rollouts SAMPLE outcomes across seeds instead of peeking. **The
  harness + rollout walker gain `'event'` phase arms BEFORE the first
  fuzz run** (omission wedges every run at maxNodeHops); the checkless
  doctrine-control arms take uniform-random choice off a policy
  stream. One-time cost: widening fuzz `PATH_KINDS` breaks the
  strict-schema parse on every committed weight vector (fixtures,
  best-strategy outputs) — a scheduled re-baseline, not a surprise.
- **Per-sector `startingEvents`** (the source-node proposal): the
  schema seam + zero-draw roll land WITH the events phase (the
  `firstNodeKind` stamp precedent); the generator rework CONSUMES it.
- **Art/FX seam**: `art?: string` on pages + fx keys on outcomes,
  registry-resolved later; zero implementation this cluster.
- Editor: `tools/event-editor/` on the encounter-editor shape (its
  recursive formatter is the model for the page map); `events.json`
  joins the vite save-allowlist + the configHash registry (the
  drift-guard test enforces the latter).

### Camps — LOCKED

- **Camp units stay `team: 'neutral'`** + a World-level camp registry
  (campId per unit, per-camp per-faction hostility set, leash
  anchors — the `spawnQueues`/`spawnRegions` shape).
  **WorldSnapshot v34→v35.** No fourth team: "doesn't count toward the
  pool" and "doesn't block turn end" are free by construction, fuzz
  buckets and pathing metrics stay untouched, and the work is widening
  the ~40 neutral-is-inert sites behind ONE predicate ("active
  neutral" = has a campId) — including the movement.ts sites where a
  neutral is currently an immovable hard blocker (a wandering neutral
  would otherwise be a moving wall — a correctness item, not a
  filter).
- **AoE splash hits camps and aggros them** (user-confirmed intent) —
  accidental pulls are the point: positioning near camps is the
  "engage the whole layout" texture, and it gives the arbitration bot
  a real decision surface for free.
- **Camp rewards grant on camp-kill regardless of turn outcome**
  (won / lost / draw) — the 51a battle-tally portion is the precedent:
  the player paid for the camp during the turn; a new portion branch
  in `handleTurnEnded`, NOT a reuse of the `won` gate. Kill credit +
  per-faction hostility are new machinery (`unit:died` carries no
  killer; `recordDamage` currently drops neutral-target damage).
- **Camp combat is fully symmetric**: the enemy team can fight, kill,
  and be aggro'd by camps; an enemy-killed camp yields nothing —
  credit denial IS the player's loss. Enemy AI never deliberately
  pulls in v1 — but the seam ships now: a global `enemyPullChance`
  (turn-start roll on a dedicated fork → sets the enemy TEAM objective
  to engage the camp — note this detours the whole enemy team, which
  is why it needs a feel verdict) with an optional per-encounter
  override, **default 0** (byte-identity preserved), enabled and
  tuned at the camps phase's feel pass.
- **Camp composition re-rolls fresh at every turn start** from the
  layout's weighted list; NO cross-turn camp state (dead camps don't
  stay dead across turns).
- **The block-turn-end seam is built now as a real config knob,
  default off** — a third alive-flag in `checkBattleEnd` (mind the
  `_combatBegan` latch), so the deferred feel decision is testable
  instead of re-litigated.
- **Wander**: a new `CampWanderBehavior` on the `movementBehavior`
  catalog seam (`'camp'` value), rolling on the sanctioned
  RNG-in-behavior pattern (`proposeWander` precedent — movement.ts
  stays pure); spawn placement via the `anchorFootprint`
  `random-intersect` policy reserved for exactly this. Camp motion is
  DELIBERATELY unmeasured by the drift gates (neutrals are excluded
  from pathing metrics); instead two headless invariants: (1) a camp
  unit never exceeds its leash radius, (2) a spawned camp unit vacates
  its spawn tile within N ticks (the spec's own timely-wander-off
  requirement, as a test).
- **Determinism constraints (non-negotiable)**: camp rolls ride a
  dedicated RNG fork (never `battleRng`); everything is
  presence-gated so runs with camp-free layouts stay byte-identical —
  the board does not move until the demo catalog deliberately ships
  WITH a scheduled re-pin.
- **The bot won't seek camps in v1** (in-battle camp engagement is not
  a run-layer decision site) — the default arm's board rows stay
  honest; camp TUNING gets its own forced-engagement probe arm at the
  balance pass.
- Editors: a camp catalog editor (encounter-editor shape: unit roster
  + reward-ref panel) + a camp-spawn paint tool in the layout editor
  (`campSpawns` + weighted `camps` list beside `rubble`);
  `camps.json` joins the vite allowlist + configHash.

### Auras & new abilities — LOCKED

- **Aura = authored on the AbilityDef, executed by a dedicated World
  pass.** A new optional `aura: { radius, statusId, affects }` field
  keeps the one-def-per-verb law (editor / catalog / ability-detail
  all keep working); a new `applyAuraStatuses()` pass in `World.tick`
  mirrors `applyTileStatuses` and reuses the `sustainTileStatus`
  top-up verbatim — so "lingers after leaving" = the status's
  `durationSeconds`, and the caster inspires AND swings on the same
  tick (true passive; the ability-pipeline route can't do that).
  **No snapshot bump**: the only runtime state is a `merge: refresh`
  status, already serialized. Accepted concession: the first sim pass
  that is neither tile- nor effect-driven.
- **Same-key auras don't stack** (refresh, by existing merge
  machinery); distinct aura types = the stacking mechanism. The aura
  includes the caster. **No constitution auras in v1** (a con-touching
  effect changes maxHp with no currentHp clamp policy — documented
  exclusion).
- Two small engine gaps close in passing: a caster-anchored /
  ally-targeting propose arm (~40 lines, `proposeSummon` shape) and
  the declared-but-never-read `AoeSelector.anchor: 'caster'` (~3
  lines).
- **Molotov / Pistol / Halberd / Cane are pure config** + one registry
  line each; Molotov is a `vial` clone (range 4, burn) and stays
  UNMISSABLE like every shipped AoE — **Pistol owns the miss-heavy
  identity**. Inspire is the aura demo (+1 mobility, range 3, numbers
  at the design round). New-status checklist: `statuses.json` +
  `STATUS_DISPLAY` color (else magenta pip) + optional fx. Glyph
  budget: 42/48 atlas cells used — five new archetypes fit; the
  archetype editor blocks Save past the budget.

### Stat feel — direction LOCKED, numbers land in-phase against the board

- **Make the dead stats live, don't hide them.** Audit finding:
  precision and luck are literally inert for 8 of 18 archetypes
  (`evadable:false` / `critable:false` abilities) while still accruing
  growth. Signed: **flip `critable: true` on damage ops across the
  board** (crit becomes a universal language; caster luck wakes up);
  `evadable` stays a per-identity choice (unmissable magic is an
  identity — pure casters' precision may stay dead deliberately, with
  growth to match); **light the dormant `ScaledValue stat:"luck"`
  seam** on select defs (a gambler-flavored ability whose magnitude
  rides luck).
- **Mobility: extend the usable range.** The 0.15/point rate + 0.4
  floor saturates at 4 points; the ≥1-tick-per-point derivation dates
  from the 10Hz era (E3.5 doubled TICK_RATE) and now permits rates
  down to 0.05. Direction: lower rate AND floor (≈0.07–0.08 with
  ≈0.3) so growth stays meaningful ~9–10 points deep; constants
  locked against the board.
- **Differentiate roster precision/evasion baselines** in the
  new-archetypes design round — the uniform prc 5 / eva 5 roster makes
  the subtractive terms cancel to raw weapon accuracy; archetype
  accuracy IDENTITIES are what make the stats legible.
- **Promotion screen shows derived deltas** ("+1 evasion → dodge
  10%→12%", "+1 speed → swing 1.05s→1.00s") — attacks the
  window-dressing feel directly, no balance change.

### Sector map generation — approach LOCKED

Constructive rules first, rejection sampling as the bounded fallback
(the genre standard is StS-style construction constraints, not
regenerate-until-pass). In order:

1. **Build the node-map DAG visualizer** (the `tools/index.html`
   map-gen card already DESCRIBES it but is wired to battlefield
   terrain — fix the card, build the tool; `generate()` is pure, so a
   seed sandbox is trivial).
2. **Author the three metrics as acceptance tests** over a seed
   corpus: early availability (kind by hop k), path-kind coverage (the
   "all on the same path" complaint made computable), branch
   divergence (rejoin distance + content differentiation).
3. **Fix constructively where crisp**: guarantee passes for early
   availability (the port ≥1 fallback pattern generalized), a
   minimum-divergence edge rule for instant rejoins; **bounded
   rejection sampling only for the fuzzy residue** (deterministic draw
   consumption, hard failure at max attempts — never a silent
   fallback).
4. **Event placement joins the generator here**: the events-to-combat
   ratio pass (its own knob) + the source-node stamp consuming the
   sector `startingEvents` seam.
5. Standing costs, owned up front: a deliberate seed-stream break
   (documented, the 63c/66a precedent), a RunSnapshot bump, the full
   fuzz re-baseline (weight vectors, fixtures, board re-pin) — the
   natural home for the cluster-5 stress test re-adding the 11-row
   doctrine control set. Isolation dials (`eventChance` etc.) go into
   `sectorAdvanceConfig`.

Bump economics note: with no save/load UI until Cluster 6, RunSnapshot
bumps cost only the ledger entry + re-baseline discipline — events and
gen-rework take SEPARATE bumps in their own phases; ordering is by
content dependency (events → gen-rework), not version thrift.

### Rebalance — scope (APPROVED 2026-08-05)

The draft's rebalance section, made concrete. The two new content
classes (events, camps) accrue value beyond the one-hop rollout
horizon — exactly the pre-registered horizon-blindness case; the
run-grade instruments govern.

- **The gambler shopper parity repair goes FIRST** — it's a repair of
  a signed-sheet breach (−22.5 vs the soldier shopper, deaths 53% at
  the act-1 boss, n=80), not new content; proposed as the cluster's
  opening phase so cluster-5 measurement doesn't stack on a known
  defect.
- **Real sector-2 bosses**: a design round replaces the `-deep`
  PROVISIONAL ×1.25 stat-clones; the wall dose re-brackets per the
  dose-bracket protocol after the reals land.
- **The measured-terminal-prior + state-conditioned-ε ladder**
  (pre-registered, user-signed 2026-08-04) is judged as events land;
  the learning-balancer question re-opens ONLY if the tabular prior
  stops converging.
- **The 55pre-twin overperformance watch** (reach 0.575 vs 40–50 +
  ceiling +0.150 — the three standing board WARNs) re-reads at the
  closing pass.
- **New instruments this cluster**: the camps forced-engagement probe
  arm (the bot won't seek camps; camp tuning needs its own arm) and
  the event-ratio economy read (a fairly-even ratio halves combat
  density per run — income/XP/pool exposure all move).
- Standing law unchanged: every amendment re-runs the full board;
  paired same-seed deltas govern; n=80 floor for per-item signals;
  BALANCE §Caveats apply.

### Graphical — glyph alignment demoted from design round to targeted fix (APPROVED 2026-08-05)

The audit CONFIRMED the draft's suspicion mathematically: the quad
anchors to a world point 0.5 above the tile; at the 45° pitch that
lift is 0.354 view-up AND 0.354 toward the camera, and the depth
component becomes radial displacement after the perspective divide —
zero at center, maximal at the viewport edge, ~3× worse for 3×3
footprints. This exact family was already fixed twice (the J3
objective marker + the I2 hitsplat: world-Y offset moved onto the
camera-up axis), and TODO.md:81 parks this item with the diagnosis
pre-written. So: **targeted fix (camera-up offset for the sprite
anchor) + atlas-derived ink boxes for the click-box complaint
(TODO.md:79) + a native-browser eyeball — the billboarding design
round opens ONLY if the result still feels wrong.** Closes TODO
items 79 + 81 on success.

### Objective + Empower + Map View + Hand Density — resolutions

- Stop-never-highlighted + larger buttons: trivial, as drafted.
- Left=engage / right=focus: cheap, with TWO NAMED DECISION POINTS at
  the phase (does arming survive; does an armed mode outrank the
  default mapping) — the current right-click is an unarmed fast-path,
  so this is a semantics choice, not a swap.
- HUD-card objective clicks: ENEMY cards map cleanly
  (`{kind:'enemy', unitId}` engage/focus; needs `ObjectiveControls`
  widened with a `setOn(mode, target)`). **Player-card clicks are
  incoherent under the team-wide objective model** — DECISION POINT at
  the phase: drop them, or define a real meaning (per-unit objectives
  are a sim-model change and are NOT in this cluster's scope).
- Empower: the hover bug is CONFIRMED and lives in the data —
  `empowerMagnitudes` collapses five buff keys (Mars / Minerva / three
  packets) to one integer per slot. The fix widens four event payloads
  + `Run` + six test sites to a per-slot per-key breakdown — the one
  NON-cheap UI item, and the prerequisite for color-coding (key→color
  map extends the `statusDisplay` precedent) and for in-battle markers
  (cheap after: `unit.effects` already carries the keys in battle;
  `HUD.refreshStatuses` walks every card with the live unit).
- Sector-map overlay: cheap — `MapScreen` is already a pure view;
  wrap it in a page-lifetime overlay (the `CacheOverlay` pattern), a
  `readOnly` flag, a new `toggleSectorMap` keybind action
  (subscribed at the GAME layer, not scene-scoped — hotkeys currently
  die outside battles), `M` is free.
- Hand density at 10: a REAL shipped bug — the Fight ▸ button, fire
  strip, and packet row scroll below the fold at 10 cards. Fix =
  PortScreen's pinned-button pattern + a max-width on the hand row
  (balanced 5+5 wrap, not 9+1). Proposed as an early quick fix; the
  user's native eyeball rider follows it.

### Pre-commit hook — measured, direction set

Measured at HEAD on the 32-core box: typecheck 11s · main 162s · fuzz
161s ≈ 5.6 min. The main suite does only ~19s of real test CPU — the
rest is per-file module re-import of the zod config graph under worker
isolation. Levers in payoff order: (1) `isolate: false` / shared-
registry pool for the main suite (touches no test code), (2) split the
unbalanced fuzz files (`harness.test.ts` is the long pole; fuzz runs
at 5.5× concurrency on 32 cores), (3) `vitest related` for the main
suite on staged paths. Typecheck stays unconditional (11s, and green
vitest ≠ green tsc). Exact configuration is phase work. Housekeeping:
AGENTS' "fuzz:smoke # 22 passed" is stale ~18× (386 tests / 39 files)
— fix in the same phase.

### Miscellaneous investigations — feasibility facts locked in

- **Sounds**: the ability/status half is mechanically cheap
  (FX_REGISTRY is a closed table; note its boot asserts check
  authored-keys-RESOLVE, not coverage — `fx: null` passes silently).
  The event half is the structural gap: ~30 hand-written `bus.on`
  closures across 17 files, no table. The audit's natural OUTPUT is an
  event-keyed sound registry mirroring FX_REGISTRY (known reuses to
  disposition: `sector:cleared`=win [already flagged in-code],
  `healtick` ×3).
- **Music**: needs Web Audio (fades/crossfades — explicitly named as
  the upgrade path in AudioPlayer's header) + a music bus (master
  volume is single-axis) + a volume/mute UI (none exists; the methods
  have zero call sites). Planning doc only.
- **Telemetry**: no server, no network code, no CI/deploy pipeline in
  the repo (Pages deploy is by hand). The bus-subscriber-that-never-
  emits pattern is PROVEN in-tree (`TelemetryAccumulator`,
  `TraceRecorder`); the new work is transport, consent, and a DEV/PROD
  split. Planning doc only.
- **Achievements**: blocked on a persistent local store that doesn't
  exist — the same store META-ROADMAP already names as Cluster 6's
  save/load prerequisite. Plan = confirm the dependency, design
  nothing yet.
- **Tutorial**: friendlier (keybindings registry, centralized scene
  swap, plain-DOM UI all ready) but needs a settings surface + a
  seen-flags store — same Cluster-6 dependency. Planning doc only.

### Scope guards — NOT doing this cluster

- No music / achievements / tutorial / telemetry IMPLEMENTATION —
  audits and planning docs only (some are explicitly Cluster 6).
- No save/load UI (Cluster 6; `devLoadRun`'s map-phase limit stands).
- No per-unit objectives; no fourth team value; no aura stacking
  policy; no constitution auras; no cross-turn camp persistence; no
  event-grammar recursion; `enemyPullChance` ships at 0.
- The demo catalogs (events, camps, new archetypes) and all balance
  CONSTANTS are design rounds at their phases — this spec locks
  shapes, not numbers.

