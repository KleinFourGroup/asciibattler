# WORKLOG — Cluster 4: Drafting & Identity

Per-round narrative log (AGENTS "The planning stack"): findings, decision
rationale, rejected alternatives, scope changes, playtest verdicts.
Write-mostly; sessions orient from the HANDOFF 🧭 Cursor + ROADMAP.
Prior round's log: [archive/post-52-worklog.md](archive/post-52-worklog.md).

## Kickoff (2026-07-21)

- Archive ritual done: `ROADMAP.md` / `WORKLOG.md` / `micro-round-spec.md`
  → [archive/post-52-roadmap.md](archive/post-52-roadmap.md) /
  [archive/post-52-worklog.md](archive/post-52-worklog.md) /
  [archive/micro-round-spec.md](archive/micro-round-spec.md).
- Scratchpad distillation sweep (third run) done: 5 entries dispositioned →
  [archive/retro-scratchpad-micro-round.md](archive/retro-scratchpad-micro-round.md)
  (per-entry disposition table in its header). Concrete promotions: the
  long-batch/orphan-recovery norm (AGENTS) · bounded-steps + window-interior
  test patterns (TESTING) · full-board-before-commit + probes-arbitrate +
  trace-mining caveats (BALANCE) · the pre-commit fuzz trigger now watches
  `src/bot/` + `tests/fuzz/` (the §54a gap, FIXED in the hook).

### The spec-vs-code-reality audit (2026-07-21, pre-design-conversation)

Spec: [cluster-4-spec.md](cluster-4-spec.md) (user-authored draft). Surveyed
the recruitment/daemon/run/scene/sector/editor/infra surfaces as they exist
at `48b988a`. Per-item findings:

**1. Unit rarity — the seams are already planted; the data model is net-new.**

- `UnitCard.ts` carries the P1 rarity-accent seam intact: `UnitRarity` is a
  single-member `'common'` union (UnitCard.ts:34), every card stamps
  `unit-card--rarity-${rarity}` (:183/:229), all three adapters hardcode
  `'common'`, zero CSS ships. Adding tiers = grow the union + thread the
  field + CSS blocks.
- `config/units.ts` has NO rarity field (Recruitment.ts:14 explicitly
  deferred it). 18 combatant archetypes; 13 draftable.
- The recruit pool: `rollOffer` (Recruitment.ts:42) samples DISTINCT
  archetypes UNIFORMLY from `DRAFTABLE_ARCHETYPES` via partial Fisher–Yates;
  offer count = `RECRUITMENT.defaultOfferSize` = 3.
- **Ports already reuse `rollOffer` verbatim** (Run.ts:1114) — the spec's
  "port pools follow the same mechanics" is ALREADY TRUE for composition;
  rarity weighting added inside `rollOffer` is inherited free. Open edge:
  port unit PRICING (`unitPrice` + jitter) is rarity-blind — does rarity
  carry a price multiplier? (Spec silent; price-against-REALIZED-value
  doctrine applies.)
- ⚠ Determinism: rarity-weighted sampling changes the NUMBER of RNG draws →
  shifts both the post-encounter ephemeral fork and the dedicated
  `portStockRng` sequence → full fuzz re-baseline (the code flags this at
  Recruitment.ts:29 / Run.ts:160).
- Palette: green/purple/gold map cleanly (TERMINAL_GREEN / NEON_PURPLE /
  TERMINAL_AMBER); **"blue" is actually cyan** (`FLOURESCENT_BLUE #15f4ee`)
  — no true blue in COLORS. Design-round item, as is the tier-4 name
  ("elite" collides with elite encounters — spec AN acknowledges).

**2. Starting characters — fills a seam the code literally names.**

- RunConfig.ts:82 comment: "a profile = a `startingRoster` + a `daemon`" —
  the planned starting-profile seam. `?roster=` and `?daemon=` URL params
  both exist and validate; `startingRoster` already round-trips through the
  Run constructor's team fork WITHOUT disturbing fork order.
- Current starting roster (spec's "the current"): **6 mercenary + 4 ranged,
  all L5** (`config/recruitment.json` counts; archetypes hardcoded in
  `rollTeam`, Run.ts:3044). ⚠ Spec says "archer" — the archetype id is
  `ranged`; no `archer` exists.
- "Same blacklist as current global configs" = the **`draftable: false`
  flag set** (ice_mage, warlock, luminant, banshee, ghoul) — the single
  existing global exclusion mechanism; no blacklist config file exists. The
  spec's Global Blacklist Editor is functionally a UI over `draftable`.
- ⚠ **Characters KILL the run-start daemon roll**: today `Run` rolls ONE
  uniform daemon from the catalog (Run.ts:905) unless `?daemon=` overrides.
  Per-character fixed daemons replace that roll — a run-identity change
  touching every baseline arm (fuzz `--daemon` flags exist; the realistic-
  bot arm's grant-consumer dials were tuned against rolled daemons).
- No pre-run scene exists: `Game` constructs the Run BEFORE MapScene mounts
  (Game.ts:126→252). Character select must either interpose before
  `createRun` (Game holds the choice, constructs on confirm — cleaner) or
  add a pending-character Run state. RecruitScene (28 lines) is the
  cheapest scene precedent.
- Character identity must SERIALIZE (blacklist/weights govern all future
  recruit rolls) → **RunSnapshot v37→v38 predicted.**
- Weight overrides (default 1; Priest mage 0.25, Gambler rogue 3) =
  net-new weighted within-tier sampling.

**3. The three drafting daemons — one is plumbing, two need new vocabulary.**

- Pool 3→4: the run-stat fold mechanism is the exact precedent
  (`effectiveCacheSize`, Run.ts:1556) — add `recruitOfferSize` to
  `RUN_STAT_KEYS` (today only `bitsGain`/`cacheSize`), route Run.ts:2436
  through `effectiveRunStats()`. Clean.
- "No commons in draft" and "guaranteed elite port offering": NO existing
  rule vocabulary expresses pool-composition constraints. If rarity weights
  themselves become run-stats, "no commons" = a mult-0 modifier (elegant);
  a GUARANTEE is not a weight — needs a new op/flag. Design fork.
- ⚠ §60c grant-consumer doctrine: new drafting daemons are only measurable
  if the bot arm actually consumes the changed pools — check the shopper
  policy exercises them before reading any balance number.

**4. Hand/draw size — the enemy-budget coupling is the load-bearing fork.**

- `handSize: 6` lives in `config/deck.json` (not hardcoded); `drawHand`
  (Run.ts:2774) draws to it; K's drawPile/discardPile/hand model + redraw
  all present.
- ⚠ **Enemy budget ALREADY scales with hand size**: `playerTeamLevel = avg
  × min(team, DECK.handSize)` (enemyBudget.ts:42) and the wave count basis
  likewise — the spec's UNDECIDED "does enemy budget scale with draw?" has
  a code-reality answer: today it scales with the CONSTANT; a variable draw
  must decide which value feeds this seam (difficulty.ts:85 records a past
  desync bug). This is the full-design-session item, with data.
- A persistent draw-size modifier fits the run-stat fold (derived, NO
  snapshot bump); one-shot packet draws ("draw two") need a new shared op
  (`drawCards`) + fire-site handler; "discard one" likewise (no hand-
  discard op exists; `discardPacket` is cache-only — naming care). A
  per-turn additive counter would be new serialized state (v38 rider).
- Draw/discard animation: render/ui eyeball zone; PreTurnScreen is DOM.
- Max-hand-size UNDECIDED → A/B on the harness per spec.

**5. Boss forewarning — the one deliberate byte-identity break.**

- Today the boss encounter + layout are drawn at NODE ENTRY
  (`beginEncounter` forks `mapRng`, selects encounter + layout + terrain,
  Run.ts:1244–1279). Pre-rolling at sector start inserts forks EARLY in the
  parent stream → every downstream fork shifts → **every seed re-rolls**
  (spec acknowledges). Consequences: full fuzz re-baseline; seed-paired
  baselines die; the §60e re-anchor BANDS survive as distributions but the
  held-out vectors need a re-verify run after the change.
- Pre-rolled `{bossEncounterId, bossEncounterMap}` must serialize
  (portStock pending-offer precedent) → rides the same v38 bump.
- Map UI: no tooltip/per-node detail surface exists; node divs carry
  kind+id (the elite `*` precedent) and the sector banner is the only
  sector-level info surface. Net-new but small UI.
- "The Start" boss pool has TWO bosses (King/Queen — the §60e split made
  them deliberately distinct walls) — forewarning now reveals WHICH, which
  is exactly the point.

**6. Second sector — machinery built, content + one deferred UI item.**

- Multi-sector walk (`advanceSector`, DAG guards, carry-across) is BUILT
  and headless-tested, never reached in shipped play (single-node DAG,
  source==sink). A second sector = append to `config/sectors.json` (sector
  editor supports) + hand-edit `config/sector-map.json` (the DAG is
  explicitly NOT editor-owned) + satisfy the coverage guards.
- ⚠ Hidden cost: the deferred between-sector UI (banner/map re-render at
  sector transition, Run.ts:2451 comment) becomes REACHABLE for the first
  time — it's part of this item's real scope.

**7. Infra — box-setup.sh SURVIVED the box teardown; hcloud is greenfield.**

- `scripts/box-setup.sh` (provision: Node 25.5 pin + clone + npm ci) and
  `box-batch.sh` (launch/status/fetch/kill over SSH, parity guard) are both
  intact; NO hcloud usage exists anywhere in executable code. The launcher
  = a new `scripts/box-launch.sh` (or tools/-style CLI) wrapping `hcloud
  server create/delete` + chaining box-setup; API token + addresses stay
  out of the repo (standing rule). Education session for the user = spec
  item.

**Cross-cutting predictions** (the 48b/49c rule): RunSnapshot **v37→v38**
(character id + pre-rolled boss, possibly a turn-draw counter);
WorldSnapshot **v34 HOLDS** (everything is run-layer; battle sim untouched
unless the draw ops leak in). Two separate full fuzz re-baselines loom
(rarity draw-count shift; boss pre-roll stream shift) — sequencing them
into the SAME re-baseline window would pay once instead of twice.

### The design conversation (2026-07-21) — decisions locked

Full resolutions appended to [cluster-4-spec.md](cluster-4-spec.md)
§"Kickoff resolutions"; the reasoning worth keeping:

- **Tier-4 name = legendary.** Genre-standard beats clever; the
  graceful-degradation naming principle argues FOR the boring choice (no
  unix egg worth confusing players over). Colors green/cyan/purple/gold —
  cyan accepted (no true blue added to COLORS).
- **All-common start REJECTED (user, on reflection)** — a design round
  assigns initial tiers when the mechanics land; tuning at the round-end
  balance pass.
- **Duplicates ALLOWED in offers** (user prior + agent concurrence):
  rolled levels/growth differentiate; under weight overrides dupes ARE the
  character identity working (double-rogue Gambler offers); independent
  draws + renormalize-on-empty make the sampler trivial and un-wedgeable
  by the guarantee daemon. Named fallback (not pre-built): one resample
  per duplicate if playtest shows degenerate offers.
- **Characters kill the daemon roll — confirmed intended.** Harness gains
  `--character`; arms default to The Soldier. USER CALL: a dedicated
  balance-protocol-v2 step ("I just tripled the balance work" 😅), which
  also owns extending the bot arm to consume the new mechanics (the §60c
  lesson applied prospectively, agent catch).
- **Port rarity pricing: seam now, tune later** — per-tier multiplier
  table authored with the rarity field so pricing/editor code doesn't
  need a second pass; numbers at the balance pass.
- **Filed inputs absorbed:** port goods-vs-hop value + banshee-comp →
  the balance pass. **Riders absorbed:** rarity-accent CSS TODO +
  display-label layer + the internal `ranged`→`archer` rename (cost
  flagged: load-bearing id string — units/encounters/rollTeam/tests +
  the FROZEN instrument fixtures carry per-archetype keys; own cut line).
- **Save/load → Cluster 6** (original home; this round's v38 bump(s)
  would orphan earlier-built saves).
- **Synergies/traits: OUT** — the META-ROADMAP C4 conscious call, made
  with a sharpened rationale: **the daemon layer IS the synergy system**
  (Laverna = a working archetype-filtered build-around; §47 vocabulary
  makes more nearly free). Revisit trigger: drafting feels thin at the
  round-close playtest. Revisit shape: `tags` on UnitDef + tag-filtered
  hooks — an extension, not a new system.
- **Boss forewarning expectation confirmed:** identity + layout only;
  waves resolve at fight time. **Sector-transition UI:** a sector-cleared
  clone of the run-cleared screen.

### Roadmap authored (2026-07-21) — the kickoff CLOSES

- The 8-phase cut (§61 rarity → §62 infra (non-blocking) → §63 characters
  → §64 drafting daemons → §65 hand/draw → §66 forewarning → §67 second
  sector → §68 protocol v2 + balance pass) shape-locked with the user in
  one pass; the only redline discussed was §62-first, resolved KEEP-AT-62:
  §61 needs no box (headless distribution tests + local smoke), and
  infra-first would BLOCK the round on scheduling the user's education
  session — §62 floats instead.
- Caps re-sized 600→500 total (the demotion rule now does the structural
  work; authored size ~215 lines), per-phase HELD at 70.
- The overdue micro-round demotion done alongside: the giant §59/§60-era
  cursor cells collapsed; the micro round's condensed block added to
  HANDOFF §Closed rounds.

## Phase 61 — Rarity core

### The §61 kickoff code-reality audit (2026-07-21)

Surfaces surveyed at `97ed760` (same day as the cluster kickoff audit —
this pass verifies + deepens the five §61 surfaces for the cut):

- **The sampler:** `rollOffer` (Recruitment.ts:42) → `sampleDistinctArchetypes`
  (partial Fisher–Yates over `DRAFTABLE_ARCHETYPES`, 1 RNG draw/slot).
  Replacing it with tier-roll + within-tier-roll = **2 draws/slot** — the
  predicted draw-count break. Both call sites go through the ONE function
  (post-encounter Run.ts:2436, port stock Run.ts:1114), so ports inherit
  the weighting by construction, as the cluster audit found.
- **The schema:** `CombatantUnitDefSchema` (units.ts:134) has no rarity
  field; the §38 open-record catalog means adding `rarity` (z.enum, default
  `'common'`) is one schema line + JSON entries. Rarity is DEF-RESOLVED by
  archetype id (the `targetingForArchetype` convention) — `UnitTemplate`
  doesn't grow a field ⇒ **no RunSnapshot bump; v37 HOLDS through §61**
  (matches the roadmap's round-wide prediction). WorldSnapshot v34 holds.
- **The card seam:** `UnitRarity = 'common'` single-member union
  (UnitCard.ts:36); all three adapters hardcode `'common'`
  (:116/:134/:149); both builders already stamp `unit-card--rarity-*`
  (:183/:229); ui.css:468 reserves the hook, zero CSS ships. Growing the
  union + threading the def lookup through the adapters is the whole wire.
- **Port pricing:** `unitPriceFor` (prices.ts:133) is the pure core both
  the game and the §50f editor preview read — the per-tier multiplier
  threads through it once and can't drift (the display-honesty
  discipline). Seam shape: a `rarityMultiplier` record in `prices.json`
  validated exhaustive-over-tiers, seeds ~1/1.5/2/3, TUNED at §68.
- **Display labels:** ability names are ALREADY config
  (`AbilityDef.name`, required — the Yb QoL; schema.ts:414). The gap is
  archetype names: UnitCard renders the raw id in both headers
  (`data.archetype.toUpperCase()` :367, `Level N ${archetype}` :375).
  Rider = a `name` field on `CombatantUnitDefSchema` + a sweep of the id
  display sites, the AbilityDef precedent.
- **The rename (`ranged`→`archer`):** the quoted-`'ranged'` grep counts
  239 hits / 79 files but MOST are the stat (`baseStats.ranged`,
  `damageStat: 'ranged'`, growth rates) — **the stat does NOT rename**,
  only the archetype id. Real blast radius: the `units.json` key ·
  `encounters.json` comps (6) · `prices.json` baseByArchetype ·
  `Run.ts` rollTeam:3047 · `enemyBudget.ts` default comp ·
  `REQUIRED_UNIT_IDS` (units.ts:332) · ~20 test files · the FROZEN
  fixtures (tests/fuzz/fixtures/*.json ×10, 53g-human-traces.json),
  which carry per-archetype KEYED RECORDS — a mechanical key rename
  preserves their semantics (values untouched). An in-place key rename
  keeps `units.json` key order, so `ALL_ARCHETYPES` order — and every
  order-dependent stream — is preserved: **predicted byte-stream-NEUTRAL**
  (the absence of a re-pin is itself the H4-style check).
- **The draftable 13** (for the tier-assignment decision point):
  mercenary, adventurer, ronin, bandit, ranged(→archer), rogue, healer,
  mage, catapult, reaver, corrupter, stormcaller, shaman. (Non-draftable:
  ice_mage, warlock, luminant, banshee, ghoul.)

### Shape-lock (2026-07-21) — cut approved, three calls resolved

The 7-step cut (61a→61g, ROADMAP §61) approved as proposed, rename-first
so later §61 tests/fixtures are written with `archer` natively.

- **A — weights home: `recruitment.json`** gains a `rarityWeights` block
  (exhaustive over the tier enum). Rationale: recruitment.ts already owns
  offer-composition knobs; four numbers don't justify a new config file.
- **B — frozen fixtures: mechanical KEY rename** in the 61a commit
  (values byte-untouched, semantics preserved) over a load-time legacy
  alias — alias code would be permanent complexity for a one-time rename.
- **C — tier assignment: DATA FIRST** (the design round stays a mid-phase
  stop after 61c). The user's provisional guesses, on record for that
  round: common = mercenary / archer / rogue / healer · uncommon =
  adventurer / ronin / mage · rare = catapult / reaver / corrupter ·
  legendary = stormcaller / shaman. ⚠ **bandit unassigned** (12 of 13
  covered) — an explicit open item for the design round.

### 61a — the `ranged`→`archer` rename (2026-07-21)

Codemod with an explicit whitelist of archetype-context patterns (the
stat `ranged` shares the literal — blanket sed was never safe): 486
replacements + 14 hand edits. What the whitelist missed, and how each
was caught:

- Three `offerOf(…, 'ranged')` endings without a brace (pattern was
  `}, 'ranged')`) — caught by the per-file count check against the
  audit's hit list before any test ran.
- **UNQUOTED archetype-keyed property accesses** (`m.ranged`,
  `ARCHETYPE_CONFIG.ranged`, `UNIT_DEFS.ranged`, `{ bandit: 6,
  ranged: 2 }`) — invisible to a quoted-literal grep; 5 test failures
  in 3 files surfaced them, and a follow-up `\.ranged\b|ranged:` sweep
  found the rest, including **sweepReport.test.ts's synthetic
  `ranged_*` CSV** (fuzz-smoke-only — `sweepReport.ts` iterates
  `ALL_ARCHETYPES` to parse columns, so it WOULD have failed there;
  caught by reading the parser before running smoke). Lesson for any
  future id rename: grep quoted AND unquoted forms up front.
- CSV column `recruitedRanged` (reporters.ts header) deliberately KEPT
  — positional/name stability for CSV consumers; only the filter
  (`=== 'archer'`) renamed, else the column silently zeroes.
- Frozen fixtures: keyed-record KEY renames only (values
  byte-untouched) — the two archetype blocks per strategy vector
  (bandit-context regex), `"archetype":"archer"` ×339 in the 53g
  traces; stat blocks untouched.
- Docs kept honest in-commit: ARCHITECTURE archetype list, DESIGN
  archetype entry, fuzz CLI roster examples, sweep-gui placeholder.

**Verify: 2199 + 269 fuzz:smoke green, typecheck clean, ZERO pin
changes — the predicted byte-stream neutrality, proven** (the smoke
pins encode exact per-seed outcomes; any stream shift would have
re-pinned).

### 61b — the rarity field, inert (2026-07-21)

- `RARITY_TIERS` / `RaritySchema` / `UnitRarity` live in config/units.ts
  (ascending order is load-bearing — 61c's weights validate exhaustive
  over it); `rarity: RaritySchema.default('common')` on the combatant
  schema only (neutrals reject it via strict — pinned).
- Def-resolved by id: `rarityForArchetype` (optional-chain → common, the
  targetingForArchetype convention) + `DRAFTABLE_BY_TIER` (explicit-key
  record, NOT Object.fromEntries — fromEntries erases the key union and
  tripped TS2352; the exhaustive Record makes a future tier a compile
  error instead of a silent missing bucket). UnitCard's `UnitRarity`
  re-pointed to config; all three adapters read the def.
- **Editor stripping hazard closed in-step:** the archetype-editor
  formatter learned `rarity` (emit only when non-default, the
  `draftable` convention) so a post-61d Save can't strip assignments;
  round-trip pinned (emit + reparse; commons stay omitted so the
  pre-61d file is byte-identical). Editor UI got the schema-driven
  Rarity select (options enumerate RARITY_TIERS).
- Verify: 2207 green (+8), typecheck clean, fuzz:smoke via the commit
  hook; editor select verified in the dev preview by DOM eval (4 tiers,
  change wiring updates the working doc, zero console errors).

### 61c — rarityWeights + the weighted sampler (2026-07-22)

- `rarityWeights` (6/3/2/1 seeds, §68 tunes) in recruitment.json;
  schema exhaustive over the tiers with a compile-time coverage assert.
  Zero-per-tier is legal ("tier off" — and the §64 no-commons fold
  shape); all-zero over non-empty tiers throws at the roll site.
- `rollArchetypeByRarity` = the pure, config-parameterized core (the
  `unitPriceFor` discipline): weighted tier roll RENORMALIZED over
  non-empty tiers, then uniform within tier — **exactly 2 draws, always**
  (the tier roll fires even with one populated tier, so 61d's
  assignments shift WHICH archetypes appear, never draw counts — pinned
  by a stream-shape test). `rollOffer` binds live pools/weights, keeps
  the two-phase draw shape, drops F1's distinctness + pool-size cap
  (dupes by design, kickoff lock). Old Fisher–Yates sampler deleted;
  two F1-era tests (distinctness, pool cap) retired with it.
- Tests: synthetic-catalog distribution vs config-derived expected
  shares (N=20k seeded, ±0.02) · empty-tier renormalization · zero-
  weight-tier exclusion · all-zero throw · pigeonhole dupes · 2-draw
  stream pins (core + through rollOffer) · live-config boot sanity.
- **Finding — "smoke re-pins" turned out VACUOUS for this break:** 2212
  main + 269 smoke green with zero edits. The smoke/harness pins are
  INVARIANTS (same-seed-twice equality, outcome-in-set, CSV shape,
  occupancy/coverage guards), not per-seed content pins — same-seed
  equality survives any deterministic change by construction. The
  round-plan line "smoke pins re-pin per phase as mechanical fallout"
  overestimated this class of break; what the stream shift ACTUALLY
  invalidates is the measurement baselines (BALANCE §60e held-out
  vectors, best-strategy fixed-vector probes), and those re-anchor ONCE
  at §68 per plan (mid-round reads: paired same-seed A/Bs). Content
  change positively proven (not silently equivalent): dupes at
  size>pool + the 2-draws/slot pin are both impossible under the old
  sampler.

### 61d — the initial-tier assignment (2026-07-22, USER design round)

Evidence base: the two §60e held-out instrument vectors' archetype
preferences (robust where they agree — stormcaller strong in both;
ronin/adventurer/bandit/reaver negative in both; healer/catapult
posture-split) + the §33/§41 equilibrium reads; caveat stated that bot
preference ≠ human power.

**Assignment (USER-SIGNED):** common = mercenary / archer / rogue /
healer / **bandit** (the open item, resolved common) · uncommon =
adventurer / ronin / mage · rare = catapult / reaver / corrupter ·
legendary = stormcaller / shaman. Populated 5/3/3/2 → tier shares
50/25/16.7/8.3%, per-archetype ≈10/8.3/5.6/4.2% — felt rarity is mild
at the seed weights (a specific common ≈2.4× a specific legendary);
noted, tunes at §68.

**The ronin/reaver tension resolved FLAVOR-OVER-POWER (user):** both are
searcher-disliked in both postures (ronin worst in class, −0.89/−0.93)
but neither reads as a common; they KEEP uncommon/rare and **buffing
them is a named §68 goal** (added to the §68 charter's absorbed
threads). §60c rider: the arm may simply not field them, so the buff
read needs force-comp probes (the §60e per-boss force-isolate
precedent), not arm uptake.

Mechanics: 8 `"rarity"` lines hand-placed in units.json at the
formatter's emit position (commons stay absent per the
emit-only-when-non-default convention) — the editor byte-identity test
is the placement proof. One 61b test corrected in-step: it hardcoded
"exactly one rarity emission" against the then-all-common catalog;
now derives the count from the working set (the balance-proof rule
applied to a formatter test).

**The re-pin the stream break DID owe (refines the 61c "vacuous"
finding):** the port-canary NON-VACUOUSNESS pins (harnessPort "the
pinned seed docks and buys" + harnessEconomy's port-seam-LIVE, both
seed 12) are the one genuine content-pin class in smoke — they assert
a SPECIFIC seed exercises a behavior, and the 61c+61d content shift
un-bought seed 12. Re-scan per the tests' own documented contract:
seeds 0..30 → **2/10/15 buy** under the new stream; canary re-pinned
12→2 (both files); the seed-1 never-buys pin still holds. So the
per-phase re-pin expectation lands as: invariants survive free,
non-vacuousness canaries re-scan — minutes, not a re-baseline.

### 61e — the rarity-accent CSS (2026-07-22)

- Accent channel = the GLYPH (tier color + soft `text-shadow` CRT glow),
  NOT the border — borders carry skin identity + interaction states
  (recruit amber, hover/selected cyan) and rarity must not fight them.
  `common` gets NO rule: its color IS the default terminal green, so
  every pre-rarity surface renders unchanged (the P1 promise held
  structurally). Colors per the kickoff lock: cyan `#15f4ee` / purple
  `#9d00ff` / gold `#ffb000`.
- The Q5 enemy override survives by SPECIFICITY ((0,3,0) vs the
  accents' (0,2,0)), not rule order — enemy battle glyphs stay red.
- Player battle-HUD compact cards DO carry the tier tint (identity
  carry-over; team still reads from pane position) — deliberate,
  flagged for the user's native eyeball to veto. Board sprites are
  renderer-owned and untouched.
- Verified in the dev preview by computed style on a live mixed-tier
  pre-turn hand (ronin/mage cyan · reaver purple · stormcaller gold ·
  mercenary/archer green with NO shadow) and in-battle (player tints
  live, enemies `rgb(255,49,49)`). Screenshot unavailable (pane not
  compositing); computed-style reads are the stronger evidence per the
  browser-verify norms — the aesthetic eyeball is the user's test run.

**REWORKED same-day — the playtest verdict on glyph tints:** "absolutely
gorgeous, but it adds a moment of confusion" in the battle HUD (the
flagged veto, exercised). New design (user): glyphs revert to pure team
colors EVERYWHERE; the accent is the CARD BACKGROUND — all four tiers
tint now, commons subtly green (the "common = pixel-identical" promise
deliberately retired). Implementation: a uniform `background-image`
linear-gradient tint layer over each skin's own background-COLOR, so
full cards keep black, compacts keep their rgba(0,0,0,.7) HUD
darkening, and no background-color rule (skin/hover/selected) is
fought — the recruit hover's shorthand still clears the tint while
hovered (interaction affordance wins, deliberate). Alphas
luminosity-compensated per hue (green .07 / cyan .09 / purple .16 /
gold .10) — user tunes by native eyeball. One landmine defused:
`.unit-card--compact`'s `background:` SHORTHAND (later in file)
implicitly reset `background-image` and silently ate the tint on
battle cards — converted to `background-color` with a warning comment.
Re-verified by computed style (pre-turn + battle, player and enemy).
Watch-item for the user's next run: enemy cards carry the subtle tint
too (a faint GREEN wash on enemy commons — green is ally vocabulary);
scoping `.unit-card--enemy` out is one line if vetoed.

**Background verdict (user, native): APPROVED — "they look great on the
HUD cards too."** Named fallback on record: if the faint green on enemy
commons ever confuses, swap the COMMON wash to a neutral gray (user
suggestion) rather than scoping enemies out. One refinement from the
same read: **legendary gold read muted** → the wash bumped .10→.12 AND
an inset edge-glow added (`box-shadow: inset 0 0 16px rgba(gold,.25)` —
"lit from within"; structurally different, not just louder; interaction
states that set their own box-shadow still win). Options considered:
raw alpha raise (rejected — monochromes the amber skins), brighter-gold
hue (bends the palette lock), shimmer (off-brand). Computed-style
verified; the glow's native eyeball is still pending (the user approved
the approach, not yet the pixels).

### 61f — the per-tier price-multiplier seam (2026-07-22)

- `units.rarityMultiplier` in prices.json (seeds 1/1.5/2/3 — the
  kickoff lock; TUNED only at §68 against REALIZED value), schema
  exhaustive over tiers, applied inside `unitPriceFor` with the tier
  def-resolved from the archetype id (no tier parameter to drift).
  One formula ⇒ buy price, sell refund (fraction of buy — a legendary
  refunds proportionally), §50d port stock, and the price-editor
  preview all inherit; the display-honesty discipline holds free.
- Editor taught in-step (the 61b stripping lesson, now standard): the
  price-editor FORMATTER emits the block (required field, always
  present — unlike the per-entry `rarity` override convention) + four
  UI inputs on the levelGrowth/jitter pattern. Byte-identity test =
  the hand-placement proof; the empty-branches fixture gained the
  field with non-uniform values to exercise the emit.
- Tests: curve test now derives base × growth^(l−1) × mult-via-rarity
  from config · seam non-vacuousness (some active tier ≠ ×1 — the 47b
  lesson) · missing-tier schema rejection.
- NB uncommon+ port prices just rose 1.5–3× — greedy-arm buy decisions
  may shift (canary re-scan if smoke says so); the REAL price read is
  §68's. (Outcome: smoke green as-committed — seed 2 still buys; no
  re-scan needed.)

### 61g — archetype display names (2026-07-22)

- Required `name` on `CombatantUnitDefSchema` (the `AbilityDef.name`
  precedent — config-owned, no UI label map), emitted FIRST in the
  formatter (identity before mechanics); 18 names authored (`ice_mage`
  → "Ice Mage" the two-word case). Neutrals excluded (strict schema —
  walls don't card).
- `nameForArchetype` falls back to the RAW ID for neutral/unknown
  (graceful-degradation naming — a display path never throws).
- Display sweep: the two UnitCard headers + the CacheOverlay roster
  picker. Deliberately UNCHANGED: Game.ts dev console.warn +
  RunConfig URL serialization + error messages (the id IS the right
  surface there). Editor gained the Name input (empty name → schema
  validation surfaces it).
- Retired TODO #82 (the I5 "display label" item — this was its
  landing); TODO #83 re-scoped to its remaining half (ability
  DESCRIPTIONS — the name half turned out already live since Yb, the
  kickoff-audit finding).
- Browser-verified: pre-turn headers read "Level 5 Ice Mage" etc. (the
  two-word case proves config-name, not casing transform).

### Phase 61 CLOSED (2026-07-22)

All seven cuts landed (`67cd952`…`d2d5ccf`), every exit criterion met:
accents live (user-approved natively) · weights govern both offer
surfaces (config-derived tests; ports by construction) · empty-tier
renormalization proven · price seam authored · display labels shipped ·
full gauntlet green per-commit with the one owed content re-pin (port
canary 12→2) committed deliberately. Zero snapshot bumps (v37/v34 held
as predicted). ROADMAP §61 demoted to a stub per the §60f rule; cursor
moved to the §63 kickoff; memory updated at the boundary.

## Phase 62 — Infra: the hcloud box launcher

### 62a — the education session (2026-07-23, live with the user)

Kickoff audit re-verified finding #7 unchanged (box-setup.sh /
box-batch.sh intact, hcloud greenfield). Then the user drove the whole
Hetzner side themselves, per the phase's design:

- **Install:** winget `HetznerCloud.CLI` 1.66.0. Provenance checked
  before recommending (user asked): the winget manifest is
  community-repo, but the installer URL is hetznercloud/cli's official
  GitHub release zip with a pinned SHA256 — official binary,
  checksum-enforced pointer.
- **Auth:** user minted a Read+Write token in their console and pasted
  it into `hcloud context create asciibattler` themselves (agent never
  touched it). Clarified live: a context is a global user-config slot
  for one token (which is what binds to a Hetzner project) — not
  directory-scoped, nothing to do with the repo folder.
- **Key:** `mkilgore_desktop` SURVIVED the 57f2 round-close teardown
  (project keys outlive servers) — zero key work needed.
- **Type/price read (the June-hike check):** cx43 $0.0296/hr — the CPX
  line is the one that tripled (cpx42 = 4.4× for the same 8 cores);
  ARM cax31 rejected (box-setup hardcodes the linux-x64 Node tarball —
  not worth touching the proven provisioner for ~1¢/hr).

### 62b — scripts/box-launch.sh (`6cfe73a`)

**The availability doctrine (shape-locked; the user's question drove
it — 57f2 create had hit DC-availability flakiness):** LOCATION falls
back automatically (fsn1→nbg1→hel1 — same hardware, same price, no
bearing on the byte-identity contract, which is per commit+toolchain),
while SERVER TYPE fails LOUD (a substitution changes core count, the
`--jobs` sizing, and price 4× — always a human call, rerun with an
explicit `--type`). `--location=` pins and disables the fallback.

Implementation calls worth keeping:

- Provisioning stays **ssh-piped box-setup.sh**, not cloud-init
  user-data: one versioned provisioning truth, live output, loud
  failure (cloud-init would bury errors in a box-side log).
- Defaults `cx43`/`ubuntu-26.04` (the §57f2 pair, worklog line 1762) —
  boxes stay comparable to the proven baseline by default.
- ssh `accept-new` in the launcher (vs box-batch's bare BatchMode)
  deliberately seeds known_hosts so box-batch's stricter calls work
  unprompted after; `ssh-keygen -R <ip>` first, because Hetzner
  recycles IPs and a stale entry hard-fails before accept-new gets a
  say.
- ALL project ssh keys attach at create (key names are user-side
  config — none baked into the repo, the standing token/address rule
  extended to key names).
- `destroy` defaults to the single `abox-*` server; multiple → refuses
  and lists (never guess which box to kill).

### 62c — the user's cycle + CLOSE (2026-07-23)

The user ran the full lifecycle from Git Bash (a PowerShell-vs-bash
education detour: Git for Windows doesn't put `bash` on PATH — the
`& "C:\Program Files\Git\bin\bash.exe" …` call-operator form, or the
Git Bash app): `create` → fsn1 took it first try, box ready at
`6cfe73a` = local HEAD (parity by construction) · an 8-run smoke batch
via **box-batch.sh unchanged** (DONE exit 0, fetched with summary
sha256) · `destroy` → server deleted. ~15 min of billing, under a
cent. Every exit criterion met; TODO's hcloud item (filed 2026-07-17)
retired. ROADMAP §62 demoted to a stub; cursor to the §63 kickoff.


## Phase 63 — Starting characters

### 63-kickoff — the code-reality audit (2026-07-23)

Premise re-verified (step zero): the daemon roll is live
(`Run.ts:913`, the only production `rollDaemon` call), RunSnapshot
sits at v37 (`RUN_SCHEMA_VERSION`, Run.ts:381), no `character`
appears anywhere in RunConfig/Run, and no select scene exists — the
phase's work is all unbuilt. Findings, by surface:

- **The seams anticipated the phase.** `RunConfig.daemon`'s doc names
  itself "the future starting-profile seam (a profile = a
  `startingRoster` + a `daemon`)", and the §61c sampler comment
  pre-marks where character weight overrides layer ("WITHIN the
  tier"). Both landing sites are exactly where the spec points.
- **The byte-identity win (unlooked-for):** `RNG.pick` is
  `floor(next()·len)`; a cumulative-walk weighted pick over EQUAL
  weights selects the identical index off the identical single
  `next()` — so the weighted within-tier sampler is **byte-identical
  to today's uniform pick whenever no override applies** (default
  weight 1 exactly; integer cumulative sums, no float-drift edge).
  And offers ride `recruitRng` while the daemon roll rides the
  dedicated `daemonRng` fork, so killing the roll shifts NO offer
  content. Net: seed-pinned offer/content expectations survive §63
  for the no-override character; only daemonRng-downstream draws
  (grant chance flips) shift — the "every default-run baseline
  changes" prediction stays true for fuzz outcomes but the unit-pin
  blast radius is far smaller than budgeted.
- **The Game surgery is the real risk, confirmed.** `this.run` is
  constructed in the Game CONSTRUCTOR (Game.ts:126) and page-lifetime
  chrome assumes it lives: BitsOverlay's FIRST PAINT happens in its
  constructor reading `() => this.run.bits`; CacheOverlay's getters
  likewise; `buildContext()` hands `run` to every scene; boot swaps
  MapScene at constructor end (Game.ts:252); `resetRun` +
  `devLoadRun` swap MapScene directly. Deferring Run to
  select-confirm means `run: Run | null`, guarded overlay getters /
  deferred first paint, and a nullability decision on
  `SceneContext.run`.
- **The sampler wiring is two call sites.** `rollOffer` binds
  `DRAFTABLE_BY_TIER` + `RECRUITMENT.rarityWeights` internally; it
  needs pools+weights params. Its only callers are the recruit offer
  and `rollPortStock` (units roll via `rollOffer` verbatim,
  Run.ts:1114) — so the spec's "ports follow the same mechanics"
  lock is satisfied by construction once Run passes character-derived
  pools.
- **Serialization has an exact precedent.** Daemons serialize BY ID
  (`daemonIds`, def-resolved on load, unknown id throws —
  Run.ts:2823/2910). `characterId` follows the same pattern;
  blacklist/overrides stay def-resolved at read time
  (derive-don't-cache). v37→v38 as predicted.
- **Catalog reality checks out.** All spec'd archetypes exist
  (mercenary/archer/healer/ronin/rogue/mage/shaman); the current
  global blacklist = `draftable:false` on
  ice_mage/warlock/luminant/banshee/ghoul; shaman is draftable
  legendary (the Priest's ADDITIONAL blacklist entry). Daemon ids
  mars/minerva/mercury/janus all present. The current starting
  roster (config/recruitment.json): **6 mercenary + 4 archer at
  startingLevel 5** — the Soldier reproduces it; Priest/Gambler are
  one/two-slot swaps as spec'd.
- **Harness precedent is exact.** `tests/fuzz/daemonSelection.ts` is
  the template for a `characterSelection.ts` (`--character=<id>`,
  default `soldier` EXPLICIT per the exit criteria);
  `RUN_CONFIG_PARAMS` + `parseRunConfig` + `runConfigToQueryString`
  are the URL-side landing sites. NOTE: `--daemon=random`'s meaning
  ("the Run's own roll") dies with the roll — the flag stays valid
  but 'random' becomes "no override → the character's daemon"; doc
  + label updated at the harness cut.
- **Editor precedents:** `tools/encounter-editor/format.ts` for a
  byte-faithful `formatCharactersJson`; the Global Blacklist Editor
  is a UI over units.json `draftable` flags via the archetype-editor
  formatter (`ALL_UNIT_DEFS` iteration order).
- **Bare-constructor blast radius:** ~2200 tests construct
  `new Run(seed, bus)` with no config — Run must default the
  character internally (`?? soldier`) so headless callers keep
  working; their daemon expectations move from "rolled idol" to
  "Mars always."

Cut + micro-fork resolutions recorded on the shape-lock turn.

### 63-kickoff — shape-lock (2026-07-23, user-signed)

All five recommendations approved as proposed; the seven-cut plan is
in ROADMAP §63. The fork resolutions and their why:

1. **`SceneContext.run: Run | null`** (+ a `requireRun(ctx)` helper
   asserted at each run-dependent scene's mount). Chosen over a
   bespoke pre-run mount path: one uniform swap()/buildContext()
   pipeline, and the new permanent state ("a scene can exist before
   the Run does") lives in the types where the compiler enforces it,
   not in a runtime-throwing getter + comment.
2. **Explicit `RunConfig.startingRoster`/`daemon` overrides beat the
   character's** — measurement arms keep their isolation power
   (`--character=priest --daemon=none` = the Priest minus Minerva).
3. **`resetRun` returns to the select scene** when no `?character=`
   pins the choice; a pinned URL goes straight to map (a reset run
   re-reads the same RunConfig, same as every other param).
4. **Roster = a flat archetype-id list; its length IS the roster
   size** (non-empty is the only structural bound; hand draw and
   enemy budget both already take `min(roster, handSize)`). The
   three shipped characters stay at 10 per spec.
5. **`rollDaemon` is deleted at 63c** (with its describe block) —
   the roll dies by design; git history keeps the code.

### 63a-post — fork floated: retire `draftable` for blacklists? (2026-07-24)

At the 63a review the user floated eventually retiring the `draftable`
flag in favor of blacklist lists. Verdict: NOT NOW, agreed by both.
The flag marks a STRUCTURAL fact (summon-only/enemy-only units sit
outside the whole draft system — no rarity, no tier, no price
multiplier), while blacklists are CURATION; 63g's Global Blacklist
Editor already unifies the two at the UI layer, and retiring the flag
would force draft metadata onto units it means nothing for. Revisit
trigger: global-blacklisting becomes a FREQUENT tuning action in
practice — and the shape then is a curation list ALONGSIDE the
structural flag, not a replacement.

### 63c — Run gains the character; v37→v38; the daemon roll dies (2026-07-24)

The phase's big cut, landed as audited:

- `RunConfig.character` (resolved def, programmatic until 63d) →
  `Run.character` (public readonly); bare constructors default to the
  Soldier, so ~2200 existing `new Run(seed, bus)` call sites kept
  working untouched. Precedence per the kickoff fork: explicit
  `startingRoster`/`daemon` overrides beat the character's fields.
- The starting roster rolls from the character's list (the Soldier's
  reproduces the retired `rollTeam` sequence exactly — default team
  stream byte-identical); `rollTeam` + `startingMelee`/`startingRanged`
  (recruitment.json + schema) retired — roster composition now has ONE
  home, characters.json.
- The L1 run-start daemon roll DELETED (`rollDaemon` + its describe);
  the daemonRng FORK survives (grant flips ride it). Ownership seeds
  from the character def, override still wins (incl. `null` control).
- Draft pools: `draftPoolsFor(blacklist)` (Recruitment.ts, fast-path
  returns the shared table) + the character's `weightOverrides`, wired
  through BOTH `rollOffer` sites — recruit offer + port stock — so
  ports inherit by construction (the spec lock).
- v38: `characterId` serialized (daemonIds discipline — unknown id
  hard-rejects on load, never a silent Soldier fallback); ledger entry
  in the Run.ts version trail.

**Fallout, exactly as predicted plus two semantic catches:** the main
suite needed only 3 mechanical `schemaVersion` re-pins (37→38) — ZERO
offer-content re-pins, confirming the audit's byte-neutrality analysis
(offers ride recruitRng; the Soldier's equal-weight picks are
rng.pick-identical). Two fuzz:smoke tests failed on DEAD PREMISES, not
drift — both had silently depended on the run-start ROLL for their
spread: (1) harnessRedraw's liveness test (a default run now carries
Mars, which grants no redraws — the redraw policy could never fire; re-
anchored on a forced Janus in both arms), (2) harnessDaemon's
perDaemonStats bucketing (12 default runs are all-Mars now; re-anchored
on forced fixed arms, one bucket per idol). The §60c grant-consumer
lesson in miniature: a policy read needs a granter in the arm.

### 63d — the selectors (2026-07-24)

`--character=<id>` on the harness (characterSelection.ts — the
daemonSelection shape minus the random/none kinds: a run ALWAYS has a
character) with the EXPLICIT Soldier default resolved at the harness
layer (arm > caller runConfig > Soldier), threaded through all three
modes + the --jobs shard files (ShardJob/ShardedEvalParams/evalShard,
the daemon pattern verbatim) + the sweep config; run/search/sweep
banners print `character=<id>` unconditionally. `?character=` in
RunConfig parse/serialize (drop-don't-throw, the layout= discipline —
undefined = "no URL bypass", which is 63e's select-scene signal). The
`--daemon=random` RELABEL: docs at daemonSelection/args/harness/
RunConfig now say "no override → the character's daemon"; the
historical arm name survives for label continuity, and the
perDaemonStats doc records that a per-idol read now takes one forced
batch per idol (a random batch is all-Mars). run-config CLI help
gained both lines (the flag itself came free — RUN_CONFIG_KEYS derives
from RUN_CONFIG_PARAMS); the launcher GUI's missing character dropdown
is a filed TODO (fold into 63f). New tests: selection parse/resolve,
URL round-trip, and the harness arm's three guarantees
(absent ≡ explicit soldier byte-identity · forced-priest liveness ·
per-arm determinism).

### 63e — the CharacterSelectScene + the Game deferred-Run surgery (2026-07-24)

The risk cut, landed on the locked forks:

- `SceneContext.run: Run | null` + `requireRun(ctx)` (Scene.ts); the six
  run-dependent scenes assert at mount — typecheck came back clean on
  the FIRST pass, which is the nullable-types fork doing exactly what it
  was chosen for (the compiler ran the sweep).
- `chooseCharacter` joined RunCommand as the second GAME-handled command
  (the resetRun shape): Game.dispatch early-returns it +
  resetRun, then narrows a non-null `run` local for the whole forwarding
  switch — a run-level command arriving pre-select warns + drops (loud
  beats the silent-no-op discipline here: it's a sequencing bug).
- Game: `run: Run | null`; boot branches on `runConfig.character`
  (pinned → construct-now + MapScene, byte-identical to the old path;
  else → CharacterSelectScene). `confirmCharacter` constructs via
  `createRun(character)` (layered over the URL config) with the 48d/49f
  post-assignment refresh ordering; resetRun honors the locked fork
  (pin → map, else → select, choice is per-run). Late Run construction
  is ordering-safe: Game has no direct battle:ended listener and Run's
  follow-on events emit from within its own handler (the devLoadRun
  precedent, now load-bearing).
- The overlay chips gained `startHidden` (pre-run boot shows no stale
  chrome); the existing `run:started` re-show reveals them on confirm —
  zero new event wiring.
- CharacterSelectScreen: functional cards (name / description / roster
  summary via nameForArchetype / idol name), gameover-screen chrome
  vocabulary, canonical palette hexes.

Browser-verified (preview MCP, DOM/state reads — the authoritative
kind): un-pinned boot → select scene, run null, chips hidden · pre-run
command warns + drops · confirm(priest) → MapScene, minerva, 6/3/1
roster, chip revealed · `?character=gambler` bypass → straight to map,
janus · pinned reset → map (same character) · un-pinned reset → BACK to
select, run null · select-constructed run enters the root and lands on
the pre-turn gate normally · zero console errors across all flows.
Screenshot unavailable (backgrounded-pane compositing — the known
HANDOFF limitation); the subjective look goes to the user's native
browser per the standing norm.

### 63f — the Character Editor (2026-07-24)

`4fe8a06` — tools/character-editor/ on the price-editor affordance set
(live real-schema validation · display-honest preview · save-to-disk),
plus the encounter-editor's byte-faithful-formatter discipline:

- `formatCharactersJson` mirrors the committed file's leaf-inline /
  composite-expand split: `roster` expands one id per line (it IS the
  ten slots), `blacklist` stays inline (curation, not a roster),
  `weightOverrides` emits `{}` inline or one entry per line. Pinned
  verbatim against config/characters.json + schema round-trip
  (via the exported `normalizeCharacter`) + a synthetic multi-entry
  blacklist/overrides case the shipped catalog doesn't author yet.
- The editor validates through the REAL `CharactersSchema` +
  `assertDefaultCharacter` (Save gates on them, not the form's
  goodwill); the form is constrained anyway — blacklist⇄override
  disjointness is enforced at the row selects, the default character
  can't be deleted, a roster can't go below the schema minimum.
- Draft-pool preview derives through the real `draftPoolsFor` + the
  sampler's exact tier rule (rarityWeights renormalized over non-empty
  tiers × within-tier weight share) — the Priest reads mage 2.8%
  (25% × 0.25/2.25) and shaman gone from legendary, both correct.
- `/__save-config` allowlists `characters.json`. Browser-verified: a
  no-edit Save is a byte-level no-op on disk (`git status` clean after
  the write) — the exit criterion, proven end-to-end.
- TODO fold-in: the run-config launcher character dropdown (blank =
  the select scene; `?character=priest` round-trips through
  `parseRunConfig` with the summary line reading the resolved name).

### 63g — the Global Blacklist Editor (2026-07-24)

`59b310e` — tools/blacklist-editor/, the phase's last cut. A UI over
the `draftable` flags per the kickoff lock (NO new config file; the
63a-post verdict keeps the flag as the shared home for structural
exclusions + curation, unified at this UI layer):

- Saves through the ARCHETYPE editor's `formatArchetypesJson` — no
  second formatter to drift. The blacklist-specific contract is pinned
  in tests/tools/blacklist-editor.test.ts over node-safe toggle
  helpers (`draftable.ts`): one toggle off = EXACTLY one added
  `"draftable": false,` line (and back on restores the file verbatim);
  schema round-trip deep-equal; `poolsByTier` ≡ the live
  `DRAFTABLE_BY_TIER` grouping (the preview can't drift from the
  sampler's).
- Validation runs the REAL cross-config contracts a draftable change
  can break, not form goodwill: `assertPriceRefs` against the WORKING
  draftable set (toggling ghoul on trips the genuine "no base price"
  boot assert), the character catalog's dead-config guard as a
  Save-gating error (toggling shaman off names the priest's blacklist
  entry — the characters.test.ts pin), and an inert weight-override as
  a new non-gating `warn` level (legal, just dead weight).
- Browser-verified: all three checks fire and clear on restore; a
  no-edit Save is a byte-level no-op on disk (`git status` clean after
  the write through `/__save-config`).

Both editors now satisfy the phase exit criterion — "the editors write
byte-faithful config" — proven twice over: unit-pinned (verbatim +
round-trip) AND end-to-end (no-edit Save ⇒ zero diff on disk).

### 63 — phase close (2026-07-24)

User-signed after native verification of both editors. One catch on the
way out: the tier badges/headers used an invented gray/green/blue/purple
ramp — recolored to the §61e kickoff-lock palette (green/cyan/purple/
gold, the unit-card wash hues), computed-style-verified (`5341452`).
ROADMAP §63 demoted to a stub per the close rule; cursor → the §64
kickoff (own session — the guarantee/no-commons mechanism is its known
decision point).

## Phase 64 — The three drafting daemons

### 64-kickoff — the code-reality audit (2026-07-24)

Surfaces surveyed: `Recruitment.ts` (the §61c/63b sampler), `runStats.ts`
+ `Run.effectiveRunStats` (the fold), `config/daemons.ts` (the rule
vocabulary + parse matrix), `Run.rollPortStock` / the recruit-offer site,
`prices.json`, `rewards.json`. Findings:

- **The substrate is better than the roadmap assumed.** All three
  daemons can land as pure `modifier` rules over new run-stat keys —
  ZERO new rule kinds, no matrix rows, no hook ops. The §47 vocabulary
  absorbs the whole phase:
  - *Pool size* — `recruitOfferSize` run stat (the `effectiveCacheSize`
    precedent verbatim: fold at call time, floor at the read site). The
    recruit site already passes `size: undefined` → the config default;
    it just starts passing the folded value.
  - *No commons* — `rollArchetypeByRarity` ALREADY takes `weights` as a
    param and renormalizes over non-empty tiers; a zero-weight tier
    gets no probability mass and the all-zero guard already throws.
    Promoting the four tier weights to run stats (bases =
    `recruitment.json#rarityWeights`) makes "no commons" a `mult 0`
    fold — and buys future tier-shaping daemons for free.
  - *Port legendary* — a `portLegendaryOffers` count stat (base 0):
    `rollPortStock` forces the first ⌊fold⌋ unit slots' TIER to
    legendary. `portStockRng` draw counts are already
    ownership-dependent by design (the owned-daemon exclusion — the
    50d two-stream rationale), so the guarantee costs nothing
    determinism-wise; still keeping the consume-the-tier-draw shape
    (2 draws/slot always) for parity discipline.
- **One wrinkle:** `RUN_STAT_BASES` is a static record; the new stats'
  bases live in `recruitment.json`. Resolution: bases become
  config-derived (runStats → config/recruitment import is cycle-free —
  recruitment.ts touches only zod/json/units). Tests derive
  expectations from the config module (the balance-proof-tests norm).
- **Sampler edge found:** `rollArchetypeByRarity`'s fallback tier (the
  float-boundary catch) initializes to the last NON-EMPTY tier — under
  zero weights that could be a zero-weight tier. Hardened alongside
  64b: fallback = last positive-weight tier.
- **Acquisition surfaces:** port stock samples the daemon catalog
  automatically (new entries appear for free), but `rewards.json` lists
  daemon ids EXPLICITLY (both tables) — the cut must add the three ids
  deliberately. Prices are authored in `prices.json#daemons.byId`.
- **Snapshot prediction: NO bump.** Daemons serialize by id (v38's
  `daemonIds`); every new stat is derived at read time
  (derive-don't-cache). v38/v34 hold — the roadmap's round-wide
  prediction is unchanged.
- **Spec ambiguity for the shape-lock:** "guarantees an elite offering"
  predates the §61 tier rename — read as the LEGENDARY tier. Degrade
  question: a character blacklist could empty the legendary pool
  (not with shipped content, but legal config); proposed: guarantee
  degrades to the normal roll (graceful degradation), pinned by test.

### 64-kickoff — the shape-lock (2026-07-24)

User-signed, all items: **mechanism A** (weights-as-run-stats; the
vocabulary walk-through — modifiers are labeled numbers whose meaning
lives at the single read site, hooks are for momentary delivery; the
count-stat generalization gives the port guarantee stacking semantics
for free) · Cornucopia leaves the PORT unit count untouched (spec:
"post-encounter pool from three to four") · "elite offering" read as
the LEGENDARY tier (the word predates the §61 rename) with graceful
degrade on an empty pool (test-pinned) · seed prices 30/35/25 (tuned
§68) · all three added to both `rewards.json` daemon tables at
weight 1. **Names** (the user widened the frame beyond Roman idols):
**The Cornucopia** (pool size — a trinket) · **Patrician's Seal** (no
commons — patricians vs. plebeians) · **Idol of Portunus** (the actual
Roman god of ports). One trinket, one mark, one god — daemons aren't
all idols anymore, by design. Cut = ROADMAP §64 (64a–64d).

### 64a — The Cornucopia (2026-07-24)

`d310364` — the first drafting daemon, exactly as shape-locked: a pure
`modifier` rule on the new `recruitOfferSize` run stat.

- `RUN_STAT_KEYS` grows its first CONFIG-DERIVED base:
  `recruitment.json#defaultOfferSize` (the balance-proof-tests norm —
  the base pin asserts equality with the config module, no literal).
  The runStats → config/recruitment import is cycle-free as audited.
- `Run.effectiveOfferSize` = the `effectiveCacheSize` discipline
  verbatim (fold at call time, floor at the read site); the recruit
  site passes it where it passed `undefined`. The PORT unit count
  stays `PRICES.portStock.units` — the shape-lock scope call,
  test-pinned via `dockAtPort` with the daemon owned.
- Tests derive the +1 from the CATALOG rule (a §68 retune of the value
  keeps them honest): offer +1 with the daemon (× all three
  characters, blacklist-leak checked), default without, the fold
  getter both ways. One deliberate re-pin: daemon.test.ts's
  catalog-shape id list gains `cornucopia`.
- Test detail: the offer-drive helper DECLINES rewards — the accepted
  daemon portion could be the Cornucopia itself (it ships in both
  reward tables), which would pollute the offer-size read.
- 2265→2271 main; fuzz:smoke 278 green (invariant pins — no content
  re-pins needed, as §61c predicted for sampler-adjacent content).

### 64b — Patrician's Seal (2026-07-24)

`4f9a4db` — the no-commons daemon, the shape-lock's mechanism-A design
made real: the four global tier weights promoted to run stats (bases
config-derived from `recruitment.json`, the 64a discipline), the Seal a
one-line `mult 0` on `rarityWeightCommon`.

- `rollOffer` grew a trailing `rarityWeights` param (default = the raw
  config — every non-Run caller untouched, byte-identity pinned);
  `Run.effectiveRarityWeights()` derives the folded record per roll,
  with the no-modifier identity fast path returning the config record
  itself (foldRunStats's base-identity guarantee made useful).
- SCOPE contrast with 64a, deliberate: the Seal reads at BOTH offer
  sites (recruit + port stock) — "ports follow the same mechanics" —
  where the Cornucopia's count is recruit-only. Both pinned.
- The audit's sampler edge landed with it: the float-boundary fallback
  tier is now the last POSITIVE-weight tier (was: last non-empty —
  under zeroed weights that could hold no probability mass). Pinned
  via a deliberate out-of-contract stub rng (`next() => 1`) that
  forces the fallback path deterministically.
- Zero-weight-tier semantics are ABSOLUTE, not statistical: the walk
  subtracts 0 (can never flip the roll negative there) + the hardened
  fallback — so the no-commons tests assert zero leakage across seed
  scans, with a control test proving non-vacuousness.
- 2271→2283 main; fuzz:smoke 278 green; catalog-shape pin re-pinned
  deliberately (+patricians-seal).

### 64c — Idol of Portunus (2026-07-24)

`757b7b0` — the port-legendary guarantee, the shape-lock's count-stat
generalization made real: `portLegendaryOffers` (base 0 — a design
literal, the one new stat with no config base to track) folded by a
plain `add 1` modifier; `rollPortStock` tier-forces the first ⌊fold⌋
unit slots, clamped at the slot count.

- The sampler's forcing axis is PER SLOT (`rollOffer` takes a
  `forcedTiers` list; `rollArchetypeByRarity` an optional `forceTier`):
  the tier draw is consumed-and-overridden, so the 2-draws-per-slot
  shape is forcing-independent (the §61c discipline held a third time).
- Orthogonality proofs pinned: forcing bypasses tier WEIGHTS (a
  Seal-zeroed tier could still be forced — separate axes); character
  weight overrides still govern INSIDE the forced tier; and the
  Seal+Portunus composition test shows no-commons and slot-0-legendary
  holding simultaneously (addDaemon stacking — two Portunus sources
  force two slots, the count-stat payoff).
- Graceful degradation is BYTE-identical, not merely non-crashing: an
  empty forced pool falls through to the normal roll on the same
  draws (pinned stream-equal), proven at Run level with a synthetic
  no-legends character (the whole legendary tier blacklisted).
- One build stumble, caught by the scoped run: the new stat landed in
  RUN_STAT_BASES but not RUN_STAT_KEYS (the tuple is the type source);
  and the per-slot test's synthetic pools need REAL archetype ids
  (rollOffer materializes through the catalog — the §63b discipline).
- 2283→2295 main; fuzz:smoke 278 green; catalog-shape pin +portunus.

### 64d — the matrix close (2026-07-25)

`59c052e` — one test proves the whole phase composes: all three daemons
stacked (seed one via config, the rest through the REAL `addDaemon`
acquisition path) × all three characters, asserting simultaneously:
offer = default+bonus (64a, bonus catalog-derived) · no commons and
nothing character-blacklisted in the offer (64b × 63c) · port shelf
count untouched (the 64a scope pin) · slot 0 legendary (64c) · no
commons on the shelf (64b's port inheritance). Docs honesty: the
ARCHITECTURE runStats line now carries the 64a–c keys, and the
Recruitment.ts tree line was still describing F1's distinct sampler —
three sampler generations stale — rewritten to the 61c/63/64 shape.
2295→2296 main; fuzz:smoke 278 green.

**Phase verdict:** all four cuts landed as shape-locked; the audit's
central claim (zero new vocabulary — three pure modifier rules over
new run stats) survived contact with the code intact. Exit criteria:
purchasable ✅ (port stock automatic + both reward tables + prices) ·
functional per daemon × character ✅ (headless, incl. the matrix) ·
parse-time legality ✅ (modifier rules ride the existing
z.enum(RUN_STAT_KEYS) — no new matrix rows needed, which WAS the
design) · prices authored ✅ (30/35/25, tuned §68). No snapshot bump
(v38/v34 hold, as predicted round-wide).

## Phase 65 — Hand & draw size

### 65-kickoff — the code-reality audit (2026-07-25)

Surfaces surveyed as they exist post-§64: the deck config + draw path,
the enemy-budget seam (both lineages), the §64 run-stat/op-pool
substrate, the packet fire path, and the PreTurnScreen render tail.

- **The draw path is ONE read site.** `Run.drawHand()` loops to
  `DECK.handSize` (Run.ts ~2910); `drawCard()` is already factored out
  (K3) with the reshuffle inside it — so both the variable draw amount
  (65a) and a draw-N packet op (65c) land on existing seams. The
  per-turn cycle (`drawTurnHand`: discard prev hand → draw) and the
  redraw path never re-consult `handSize`.
- **The budget seam is TWO read sites, both static `DECK.handSize`:**
  `playerTeamLevel` (enemyBudget.ts:43 — the RANDOM lineage; production
  no longer routes here, only the fuzz arena + spawn-overflow) and
  `WaveContext.handSize` (Run.ts:1926 — the authored production path,
  recomputed PER TURN at `beginTurn`). The difficulty.ts "past desync"
  is the K2-exposed H5 bug: the count basis read the roster while the
  budget basis read the hand — the regression shape to pin at 65b is
  count-basis == budget-basis, whatever the basis becomes.
- **The daemon half is zero new vocabulary** — the §64 pattern
  verbatim: `drawAmount` joins `RUN_STAT_KEYS` (base config-derived
  from `DECK.handSize`, the 64a discipline) + a floored/clamped
  `effectiveDrawAmount` read site; the daemon `ModifierRuleSchema`
  rides `z.enum(RUN_STAT_KEYS)` automatically.
- **The packet ops are packet-ONLY pool extensions** (the
  ApplyBuff/InjectRule precedent — authored in packets.ts, not
  daemons.ts): `drawCards` (target `none`, preTurn) and `discardCards`
  (target `unit` via handIndex — the applyBuff preTurn targeting
  contract). A daemon-hook reading of draw makes no sense (the
  modifier IS the daemon channel), so the op×target×context matrices
  just grow two rows.
- **The hand-mutation UI path exists:** `turn:handRedrawn` already
  carries the full hand + both piles and `PreTurnScreen.updateHand`
  rebuilds in place — a grown/shrunk hand rides the same shape. The
  animation (65e) is a render tail on that rebuild.
- **Serialization prediction: NO snapshot bump** (v38/v34 hold). The
  hand + piles serialize since H5; the fold is derived
  (derive-don't-cache); a packet draw mutates the already-serialized
  hand directly. No per-turn transient draw state needs to persist
  under the proposed design — the roadmap's v39 rider stays §66's.
- **Risk flag for the max-hand A/B (65d):** the realistic bot arm does
  not fire packets (§60c prospective; §68 owns the arm extension), so
  a cap never binds under the default arm — the A/B needs a forced
  dial (forced draw amount or a forced packet-fire policy) to produce
  a read. Budgeted into the 65d cut.
- **Cosmetic non-action:** deck.json's `redraw.maxCardsPerTurn` (6) is
  documented as "= handSize", but daemon grants author their own
  budgets since L1 — no coupling to fix.

Budget-basis options + the cut proposed for shape-lock in the session
message; decision + rationale land here when the user calls it.

### 65-shape-lock — Option B + the transparency call (2026-07-25)

**Decision point 1 resolved (USER): Option B, the folded basis.** The
budget seam reads `min(roster, effectiveDrawAmount)` — the H5 doctrine
("budget tracks the expected fielded hand") extended to the fold.
Persistent daemon draw modifiers scale the opposition (draw daemons
become identity, not raw power); TRANSIENT packet draws are deliberately
excluded (a consumable stays pure advantage the turn it fires). Options
A (static — a +2-draw daemon at fixed budget is the K2 action-economy
lesson in reverse, unpriceable) and C (post-packet final hand — punishes
firing packets, and is exactly the desync geometry the seam's history
warns about) rejected.

**The transparency question (the user's stumble): resolved as a
two-part split.**

- The draw AMOUNT gets a first-class surface: a "Draw: N" chip beside
  the draw-pile button on the pre-turn screen (the R1/R2 CardListButton
  corner — where the player already reasons about the deck), reading
  `effectiveDrawAmount` at render time. Rides 65e.
- The budget COUPLING surfaces as authored daemon card text at the
  purchase decision ("Draw +1 each turn. Foes muster to match."), NOT
  as a HUD number — the game has never exposed the budget math (G4
  scaled opposition off avg level invisibly from day one); a raw
  budget readout would be a bigger transparency change than the
  mechanic itself.
- Happy accident of B: §65 ships no draw daemon (packets only, and
  packet draws don't touch the basis), so no shipped §65 content needs
  the coupling sentence. **Landing note:** the FIRST draw-daemon
  author owes the coupling sentence in its description — recorded here
  and as a comment at the `WaveContext` seam (65b lands it).

**Cut shape-locked as proposed** (65a fold → 65b seam → 65c packets →
65d cap A/B → 65e render tail), one amendment: 65e absorbs the
"Draw: N" chip. Kickoff prediction on record: NO snapshot bump.

### 65a — the drawAmount fold (2026-07-25)

`aa3c8c4` — the draw amount is a run stat: `drawAmount` joins
`RUN_STAT_KEYS` (base config-derived from `DECK.handSize`, the 64a
discipline), `Run.effectiveDrawAmount` floors at the read site AND
clamps ≥1 (the roster can't be emptied, so a pathological mult-0
modifier must not zero a hand into a soft-lock — a clamp the
`effectiveCacheSize` siblings don't need), and `drawHand()` targets
the fold instead of the raw config.

- Byte-identity proven the strong way: fuzz:smoke 278 green UNCHANGED
  — no daemon touches `drawAmount`, so the identity fast path hands
  every existing run the raw base and the deal streams verbatim.
- Tests (+5): the base-derivation pin (runStats.test.ts — deck.json is
  the one source), fold + floor + clamp reads, a synthetic +1 idol
  dealing a 7-card turn-1 hand against a same-seed 6-card baseline,
  and the overdraw contract (a +100 idol fields the whole roster and
  stops — the H5 exhaustion path, now the min(roster, ·) proof).
- No shipped content moves: §65 ships no draw daemon (the shape-lock's
  happy accident) — the stat waits for 65c's packets to bypass it and
  for future daemon content to fold it.
- 2296→2301 main; typecheck clean; ARCHITECTURE's runStats line grew
  the key in the same commit.

### 65b — Option B at the WaveContext seam (2026-07-25)

`ccb5270` — the one-line seam swap the shape-lock decided:
`WaveContext.handSize` is now `min(roster, effectiveDrawAmount)`
(was the static `DECK.handSize`). The landing-note comment for the
first draw-daemon author (the coupling sentence obligation) sits at
the seam, as promised in §65-shape-lock.

- **The desync pin is structural + consumer-side.** One `WaveContext`
  field feeds BOTH `resolveTotalCount` and `resolveLevelBudget`, so
  count-basis == budget-basis by construction — the K2 desync shape
  can only re-enter via a second supplier. The test pins it from the
  consumer side: a same-seed pair (no idol / +1 draw idol) against a
  catalog-derived hand-relative reference encounter (brigands' shape,
  found by filter — no hardcoded id), asserting BOTH the wave count
  and the level sum track the moved basis (expectations derived from
  the authored spec + the uncapped Σlevels = max(C, L) contract),
  plus the roster clamp under a +100 overdraw fold.
- One test-authoring stumble: every catalog encounter wraps its wave
  in the standard `loop{forever}` shell — the reference-encounter
  filter must unwrap `waves[0].body[0]`, not read `waves[0]`.
- The RANDOM lineage (`playerTeamLevel` — fuzz arena + spawn-overflow
  only) deliberately KEEPS the static basis: no Run, hence no fold, in
  scope there. Header note added same commit (wave.ts context doc too).
- Byte-identity: fuzz:smoke 278 green unchanged (the fold identity —
  no shipped daemon touches drawAmount). 2301→2303 main.
- **65c test obligation carried:** the transient-exclusion pin (a
  fired draw packet grows the hand but must NOT move the next wave's
  basis) lands with the packets — the real fire path is what should
  exercise it, not a synthetic hand mutation.

### 65c — the hand-op packets (2026-07-25)

`ce7ff15` — the shared pool grows its two chartered ops (packet-ONLY,
authored in packets.ts — the ApplyBuff/InjectRule precedent; the op
dropdown and legality matrices grew rows, no daemon-side change), and
the two packets ship: **Surge** (`draw-two`, drawCards count 2, target
none) and **Cull** (`discard-one`, discardCards, target unit — rides
the existing hype pick-a-card arming contract with zero UI wiring).

- `turn:handRedrawn` is now "the pre-turn hand changed": the emit
  factored to `Run.emitHandChanged()` (one emit site — redraw + both
  hand ops), payload unchanged; the hand length may now DIFFER from
  the drawn size (events.ts + ARCHITECTURE catalog updated).
- **Two design micro-calls made in-flight** (worth flagging): (1) the
  **last-card guard** — firing Cull on a 1-card hand rejects at the
  validation gate (an empty fielded team is a misclick-shaped instant
  loss, not a strategy); (2) **exhaustion semantics** — Surge on a
  fully dealt deck stops early but still consumes (the
  patch-at-full-health precedent: order of consumption IS effect).
- The Option-B **exclusion pin** landed through the REAL fire path:
  gated turn-intro → fire Surge → advanceTurn → the resolved wave
  prices against the FOLD basis (6), not the 8-card fielded hand.
- Acquisition wiring: prices 20/8 (byId, tuned §68), discard-one →
  bits-small, draw-two → bits-large; port shelf automatic (catalog).
  The editor learned both ops (defaultEffect/describeEffect/sub-form +
  format.ts lines); the byte-faithful round-trip pin passed against
  the hand-authored JSON first try.
- fuzz:smoke 278 green — the reward-table content shifts stay within
  the invariant pins (the §61c/§64 precedent). 2303→2309 main.

### 65d-dial — the forced-draw lever + the A/B launch (2026-07-25)

`4225c32` — `RunConfig.drawAmountAdd` (programmatic + the fuzz
`--draw-add=<n>`, run mode only — the 60c bitsMultiplier shape
verbatim): injected into `effectiveRunStats` as one extra `drawAmount`
add-modifier, so the deal AND the Option-B budget basis both move — a
FORCED persistent fold, deliberately unlike a transient packet draw.
0/absent = no injection (the identity fast path + byte-identity hold;
fuzz:smoke 279 green with the new drawAddArg pin). NOT persisted; the
65d test pins the rehydrate-resets-to-0 discipline.

- Harness audit finding: the §59 `pickPacketFire` seam is VECTOR-gated
  (only scored arms carrying `fireWeights` fire packets) — the
  realistic arm fires none, so a max-hand read via packet STACKING is
  §68's (the scope guard already says packet-economy tuning is). The
  65d A/B is therefore the SYMMETRIC question only: does a bigger
  persistent hand (fold + Option-B budget scaling together) move the
  band?
- Protocol: paired same-seed, seeds 1–40, `--strategy=greedy
  --searcher --audition --redraw=level:2 --empower=level:hi`, arms
  base / `--draw-add=2` / `--draw-add=4`, local (~36s/run → ~75 min).
  A DESIGN probe, not a §60e-grade balance read (the §60c interim-read
  label applies; §68 re-anchors everything).
- ⚠ 47e watch: arms 2–3 compile post-65e code (the 65e commit landed
  mid-batch). The 65e delta is event-layer only (emit order + a
  payload field, no RNG/stream touch) — PROVEN at collection time by
  re-running 2 base seeds at HEAD and diffing their summary rows.

### 65e — the render tail (2026-07-25)

`cb71b93` — the draw/discard motion + the "Draw: N" chip (the
shape-lock's transparency surface), landed while the A/B runs.

- The chip: `turn:starting` gained `drawAmount` (the folded
  `effectiveDrawAmount`); the screen anchors it above the Draw Pile
  button — fixed, non-interactive, dimmed amber. Correctly does NOT
  move on a packet draw (verified: Surge → hand 8, chip stays 6).
- The motion: enter = a rise/fade CSS animation with a 45ms stagger,
  applied via a ONE-SHOT enter set computed by identity diff (payload
  hand entries are references into `run.team` — a stable card key);
  exit = the outgoing card cloned at its screen rect, fixed-position,
  falling toward the discard corner (animationend + a 600ms safety
  timeout — backgrounded tabs throttle animations). Redraw = exit+
  enter per swapped slot; Surge = appended enters; Cull = the
  two-pointer walk finds the spliced-out card.
- **One real bug caught by browser-verify:** the enter animation was
  being WIPED — `run:cacheChanged`/`run:packetUsed` repaints landed
  after the hand swap and rebuilt the row without the (already
  consumed) enter set. Fix in Run: the hand emit goes LAST in
  `handleUsePacket` (`handChanged` flag), so the hand swap is the
  dispatch's final rebuild. Stream-neutral (fuzz:smoke 279 unchanged).
- Eval-verified end to end on the dev preview (chip text/position ·
  6 staggered deal delays · exactly 2 Surge enters · 1 fixed Cull exit
  clone · hand 8→7 · zero console errors). Screenshot unavailable
  (backgrounded-pane throttle — the known HANDOFF limitation); the
  SUBJECTIVE feel read is the user's, natively, per the render policy.

### 65d — the A/B verdict + the cap (2026-07-25)

The batch (3 arms × 40 paired seeds, local, ~2.5h wall — see the
process note below): **base 50.0% (avgHop 8.85) · +2 draw 67.5%
(9.53) · +4 draw 60.0% (9.32)**. Paired flips vs base: +2 = 6 w→l /
13 l→w (+7 net, borderline at this seed count) · +4 = 5 w→l / 9 l→w.
The 47e stream-neutrality check passed byte-identical (2 base seeds
re-run at HEAD after the mid-batch 65e commit — every column equal).

- **The finding:** bigger symmetric hands favor the player EVEN under
  the Option-B budget coupling (+10–17pts) — the action-economy
  density on a fixed board outruns the scaled wave. Design-probe
  grade (greedy arm, no packet fires, §60c interim-read label).
- **The open question (user):** +4 reading BELOW +2 (8 w→l / 5 l→w
  between them) — noise, or does fielding the whole roster genuinely
  underperform (draw variance dead, the deck mechanic disabled)?
  Filed as a §68 absorbed thread; re-read at protocol-v2 grade.
- **DECIDED (USER): cap = 8** (`deck.json maxHandSize`), the
  provisional-data call with a revisit rider on record. `ba3898e`:
  the cap clamps INSIDE `effectiveDrawAmount` (one basis for deal +
  budget — the K2 lesson), the `drawCards` op partial-draws to the
  cap and REJECTS at a full hand (the last-card-guard sibling,
  consuming nothing). Pre-cap tests reworked: the exhaustion-contract
  cases moved to a 5-unit roster (where exhaustion, not the cap,
  binds); the overdraw pins now saturate at the cap.
- fuzz:smoke 279 green — the cap is INERT for every existing run (no
  shipped fold exceeds 6; the bot arms fire no packets). 2310→2314
  main.
- **Process note (user-filed):** a batch this size belonged on the
  hcloud box (§62's launcher exists for exactly this) — local wall
  was ~2.5h vs the box's demonstrated ~18min at `--jobs=8` for
  comparable work. Crafting the RULE is subtle (this batch's estimate
  said 75min; draw-heavy arms fight longer battles, and concurrent
  pre-commit suites stole CPU) — filed to retro/scratchpad.md for the
  round-boundary distillation rather than legislated mid-phase.

### 65f — the deck-transaction feel (2026-07-25)

Inserted off the user's 65e playtest read: the hand motion helped but
the diagnosis moved — the PILE side is where card-game feel lives
(draw pulses per card, counts ticking serially; the reshuffle as its
own beat). Two commits, headless-core-first.

`7916e64` — **the cue stream**: `deck:cardDrawn` / `deck:cardDiscarded`
/ `deck:reshuffled`, emitted at the two chokepoints (`drawCard()` —
already THE single draw site since K3; a new `discardCard()` mirror
unifying the recycle/redraw/Cull pushes). The design call, argued and
user-signed: per-card EVENTS beat UI reconstruction (a shadow copy of
the deck cycle would silently lie the day the rules change — one
chokepoint, one truth) and beat one array-payload event (house
`subject:verbed` style; audio can ride per-pulse later). Contract:
**cue-not-truth** — the swap events stay authoritative; cues are
presentation feed. Reshuffle = ONE cue by design (a single distinct
pulse; serially ticking a 15-card flip would be dead air). Stream-
neutral (no RNG, nothing serialized; fuzz:smoke 279 unchanged). Five
sequence pins incl. the organic turn-2 story (recycle ×6 · draw ×4 ·
reshuffle · draw ×2) and the reshuffle interposing exactly where the
pile runs dry. 2314→2319 main.

`0e66ced` — **the serial player**: Game (page-lifetime) buffers cues
(the deal's fire before `turn:starting` mounts the scene — a
scene-scoped subscription can never see them; `battle:started` clears
the buffer), hands them to PreTurnScene at swap; gate-time cues
forward live. The screen plays the queue at a 130ms cadence: each
`drawn` reveals its card (animation-delay synced to the pulse) + the
draw chip pulses + the displayed count ticks; each `discarded`
releases its exit GHOST (clones now hold in place until their cue) +
the discard chip pulses; `reshuffled` = both chips, a distinct cyan
two-beat shake, counts flipping together. Counts ride displayed
OVERRIDES on the pile buttons' getCount thunks and reconcile to the
authoritative piles when the schedule drains. **Fight ▸ stays live**
(user-signed): advancing hides the screen, which clears timers and
sweeps ghosts — the fast-forward is free.

- **Browser-verify caught the real bug again** (the 65e sibling): the
  intermediate `run:cacheChanged`/`run:packetUsed` repaints consumed
  the cue queue early and the final hand-swap repaint CANCELLED the
  fresh schedule, stranding the count overrides. Fix:
  `playCuesOnNextRefresh` — only the hand-swap refresh (show /
  updateHand) consumes cues or touches the schedule.
- Eval-verified end to end: the deal at 0/130/…/650ms with the chip
  pre-seeded to the pre-sequence count (·10 on a 4-card pile — the
  narrative, not the truth, until it reconciles); the sampled
  reshuffle story (reshuffle flash + 0→4/4→0 flip, then 4→3→2 serial
  draw pulses, settling authoritative); zero console errors. The
  native feel read (65e + 65f together) is the user's.
- **Feel-read amendment (USER, same day): the recycle prefix is CUT
  from the playback.** Turn 2+ opened on the previous hand's discard
  ticks — the previous turn's epilogue narrated at the start of
  yours. Option A of three (drop it — the StS convention; the screen
  opens with the discard count already post-recycle) beat B (collapse
  to one beat — still someone else's ending) and C (play it on the
  post-turn screen — real scope, empty moment). Presentation policy
  only: `show()` drops the deal buffer's leading `discarded` run (the
  recycle is a strict prefix by construction); the Run's cue stream
  stays honest, no pin moves. Verified on a driven turn-2: opens
  straight on the deal (card 0 at 0ms, discard pre-seeded ·6), the
  mid-deal reshuffle keeps its beat (the 520ms gap), reconciles ·4/·0.
  `4ef20e9`; the user's native verdict on the whole tail: "It feels
  so good now."

**Phase verdict (2026-07-25, user-signed):** six cuts in one day, all
exit criteria met — both packets exercised headlessly ✅ (plus the
transient-exclusion pin through the REAL fire path) · the budget
decision implemented + pinned ✅ (Option B; count-basis==budget-basis
structural + consumer-side) · persistent modifiers via the fold,
derived and unserialized ✅ · NO per-turn draw state needed to
serialize — the kickoff's no-bump prediction HELD (v38/v34) · the
animation browser-verified ✅ (twice over: the eval loop caught two
real event-ordering bugs the headless layer structurally cannot see —
the enter-wipe and the cue-consumption race). Both decision points
resolved by the user on data (Option B at kickoff; cap 8 off the
A/B). One findings-driven insertion (65f — the user's playtest moved
the diagnosis from the hand to the PILE side; the instruments
working). Scope guards held: two packets, no economy tuning. Carried
out: the +2-vs-+4 non-monotonicity question + the ronin-sibling
threads (§68) · the batch-sizing rule (scratchpad, round boundary).
2296→2319 main · fuzz:smoke 278→279 (the drawAddArg pin) · every
mid-phase commit byte-identity-proven where it claimed to be.

## Phase 66 — Boss forewarning

### 66-kickoff — the code-reality audit (2026-07-26)

Surfaces surveyed as they exist post-§65: the selection resolver, the
two sector-entry seams, the fight-time consumption site, the snapshot
codec, and the map-screen UI hooks.

- **The selection resolver is already pure and injectable.**
  `selectEncounter(sector, {hop, nodeKind}, rng, resolve, forced?)`
  (selection.ts) takes everything as parameters — the pre-roll calls it
  at sector start with `{hop: length-1, nodeKind: 'boss'}` and ANY rng;
  zero resolver changes. The X2 `forcedEncounterId` short-circuit is a
  parameter too, so the dev isolation flag composes at the pre-roll
  site for free (one boss node per sector ⇒ pre-roll-time forcing is
  behaviorally identical to fight-time forcing).
- **Exactly two sector-entry seams, both already forking a
  `sectorRng`:** the Run constructor (~892: `pickStartSector` +
  `generateNodeMap`) and `advanceSector` (~2691, same pair). The
  pre-roll rides the SAME fork, drawing after the node-map draws —
  the one-fork-per-sector-entry shape is preserved and the stream
  break (accepted at the round kickoff) is confined to these seams.
- **`EncounterMap` is plain serializable JSON and already a snapshot
  field** (`{layoutId, gridW, gridH, terrainSeed, theme}`, in
  RunSnapshot since K3.5). Serializing `bossEncounterMap` is the same
  shape verbatim; `bossEncounterId` follows the `selectedEncounterId`
  def-resolved discipline (unknown id on load = hard reject). The
  charter's portStock pending-offer precedent confirms the pattern but
  the mechanics are even simpler here (no per-slot state).
- **The full map can be pre-built, not just the layout id** — reusing
  `buildEncounterMap` at the pre-roll site bakes terrainSeed + theme +
  the G1 `forcedLayoutId` override + the gotcha-#49 always-draw
  discipline in one call. Save/load then reproduces the exact BOARD,
  not merely the layout identity — exceeding the exit criterion at
  negative cost.
- **Fight-time consumption is one branch in `beginEncounter`** (~1354):
  at a boss node, skip the `mapRng` fork + selection + build and
  consume the stored pair. Branching on node kind is
  deterministic-safe (kind is serialized state, not a mid-path
  conditional draw — #49 does not apply across node kinds).
- **Migration is a non-event:** `fromJSON` hard-rejects any version
  mismatch (no ladder, ~3144) — v39 is a bump + the ledger comment.
  Save/load is deferred to Cluster 6 anyway (spec).
- **The UI hooks are exactly as the charter guessed.** MapScreen is a
  pure view fed by MapScene from Run getters (`currentSectorTitle`
  precedent); the boss node div already carries a `.boss` class + `!`
  glyph. A forewarning getter on Run (encounter name + layout name via
  `getLayout(id)?.name`; procedural = layoutId null needs a display
  label) + one new `show()` arg covers it. No event/command changes.
- **Fallout prediction:** every seed re-rolls (the sectorRng draw
  count changes at sector entry) — fuzz-smoke pins re-pin in the SAME
  commit as the core change (the pre-commit hook runs fuzz:smoke on
  `src/run/` edits, so the re-pin cannot trail). Determinism suite +
  save/load pins re-assert on the new stream. WorldSnapshot v34
  untouched (run-layer only), per the round prediction.

Cut + open UI questions proposed for shape-lock in the session
message; resolutions land here when the user calls them.

### 66-shape-lock — the three UI calls (2026-07-26, USER)

All three open questions resolved in one pass; the two-commit cut
approved as proposed.

- **Placement: the top-bar banner** — a forewarning line under the
  sector title ("exactly what I had in mind"), plus the boss-node
  hover title.
- **Procedural label: "Uncharted Ground"** (flavor over the literal).
- **Layout name: SHOWN.** Forewarning displays boss name + layout
  name from sector start. Named revisit trigger: if playtest feedback
  says it makes planning too easy, drop the layout name to
  boss-identity-only — the pre-roll bakes the board either way, so
  the revisit is a 66b-sized UI change, not a mechanics change.

### 66a — the pre-roll core (2026-07-26, `f9b44f7`)

As audited, with one finding that IMPROVED the round's prediction:

- **The stream break landed narrower than the roadmap predicted.** The
  pre-roll rides `sectorRng` after the node-map draws, and the boss
  node's `beginEncounter` no longer forks `this.rng` — but nothing
  consumes the parent stream after a terminal fight in the shipped
  single-sector world. Net: node maps, teams, offers, and ALL pre-boss
  content stay seed-identical; only the boss fight's content (and
  anything downstream, i.e. nothing shipped) shifts. Proven by the
  board, not argued: the full suite's only failures were the three
  literal `schemaVersion = 38` pins, and fuzz:smoke passed 279/279
  untouched — **zero re-pins needed** (the 61c lesson again: smoke
  pins are invariants, not content). The §68 measurement re-anchor
  cost just shrank accordingly — boss-wall reads shift per seed,
  everything upstream doesn't.
- **The force flags hoisted to the constructor head** (pure of RNG, so
  fork alignment is untouched) — `rollBossForSector` reuses
  `selectEncounter` + `buildEncounterMap` verbatim, so X2
  forced-encounter and G1 forced-layout semantics apply at pre-roll
  exactly as they did at fight time, and the #49 always-draw
  discipline comes along for free.
- **v39:** the pair serializes like `encounterMap` (plain JSON,
  by-reference); `fromJSON` re-validates the id against the catalog
  (hard reject — silently re-rolling would contradict a forewarning
  the player already saw). Ledger entry written.
- **Seven new pins** (Run.test.ts §66a): pre-roll shape ·
  seed-determinism · the fight consumes the pair · mid-sector
  save/load reproduces the exact boss + board · both shipped bosses
  X2-force at pre-roll · kind-mismatch fallthrough · unknown-id
  rejection. 2319→2326 main; 279 fuzz:smoke unchanged.

### 66b — the forewarning surface (2026-07-26, `d8d354f`; feel-read signed)

The shape-lock's three calls, rendered: `Run.bossForewarning` (the
display pair — catalog boss name + layout name, null = procedural; the
"Uncharted Ground" label deliberately lives in MapScreen, not Run —
flavor is view voice, the run reports identity) → the banner splits
into `.map-banner-title` + a NEON_RED `.map-banner-boss` sub-line
("BOSS: THE BANDIT KING — DESERT FORTRESS", 13px under the 22px amber,
0.85 opacity — a notice, not an alarm; red rhymes with the `!` node),
and the boss node names its fight on hover. MapScene feeds the getter
like `currentSectorTitle` (same always-available contract — the pair
exists from sector entry).

Verification split per TESTING.md: one run-layer pin (name from the
catalog; null layoutName on the G1 forced-procedural arm) headless;
the UI browser-verified on dev-preview via computed styles + DOM
(screenshots wouldn't composite in the backgrounded pane): both label
branches live ("Desert Fortress" named / "Uncharted Ground"
procedural — the latter seed incidentally rolling the OTHER boss,
demonstrating pre-roll variety), hover title set, zero console
errors, and the DOM line cross-checked against the live run's
`bossEncounterId`/`bossEncounterMap` — display provably matches
truth. Native feel-read signed same-day ("looks perfect").

### 66-close — the phase verdict (2026-07-26, user-signed)

All five exit criteria met: forewarning visible from sector start
(66b, feel-read) · mid-sector save/load reproduces the exact boss +
board (66a pin — the FULL board, exceeding the criterion) ·
determinism green on the new stream (the board + fuzz:smoke through
the hook, twice) · smoke re-pins dispositioned as ZERO NEEDED with
the narrowed-break proof on record (the deliberate-commitment
criterion satisfied by documentation rather than churn) · the v39
ledger entry written. Scope guards held: boss nodes only, no layout
preview. Two cuts, two commits, one day. Carried out: the 53g
human-fixture revisit (TODO, user-surfaced mid-phase — the standing
"1 skipped" needs a purpose decision if no human remeasurement
comes soon). 2319→2327 main (+1 66b getter pin) · 279 fuzz:smoke
untouched.

## Phase 67 — The second sector

### 67-kickoff — the code-reality audit (2026-07-26)

Surfaces surveyed: the sector walk + DAG config, the `advanceSector`
carry-across path, the Game-layer scene routing, the GameOverScene
clone precedent, the wave resolver's difficulty basis, and the
content catalogs sector 2 draws from.

- **The predicted first-reach bug is real, located, and worse than a
  cosmetic gap: the Game layer HANGS at the transition.**
  `advanceSector()` (Run.ts ~2807) swaps the sector state and lands
  on `phase = 'map'` with **no bus emit** — deliberate T2 deferral
  ("the live scene refresh … is deferred with the multi-sector
  content"). The Game layer's reward route relies on the now-false
  invariant "no silent-map path exists off a won encounter"
  (Game.ts ~427): a non-sink boss win whose LAST gate is a reward
  resolution strands the RewardScreen with the run silently on the
  new map. (The dismissPromotion route would catch it by accident
  via its `phase === 'map'` fallback — but skips any sector-cleared
  moment.) The transition machinery must land BEFORE the DAG edge
  makes it reachable.
- **The cleared-screen shape fork.** (a) *Presentation-only*: Run
  emits `sector:cleared {…}` at the end of `advanceSector` (payload:
  cleared + next sector titles); Game swaps to a SectorClearedScene
  (GameOverScene clone — variant-at-construction, screen +
  dispatcher + audio); its continue button swaps to MapScene locally
  (the run is already at 'map'/pre-root — no new command). **No
  serialized-union touch → RunSnapshot v39 HOLDS.** A save during
  the screen restores onto the new sector's map — acceptable,
  presentation-class. (b) *A real serialized gate* ('sectorCleared'
  phase + a command): buys a re-shown screen on restore at the cost
  of v39→v40 + command surface. Recommendation: (a).
- **The DAG edge is stream-neutral for sector-1 CONTENT but flips
  run OUTCOMES.** `pickOne`/`pickWeighted` zero-draw singletons
  (#111): `sources` stays the singleton `["start"]` and node sector
  lists stay singletons, so every existing draw is untouched —
  sector-1 content stays seed-identical. But moving `sinks` to the
  new node means the first boss win no longer ends the run: run
  length ~doubles, win rates drop. Fallout surface: any main-suite
  pin that exercises the SHIPPED sector map's victory path, and
  fuzz:smoke runtime/reads (smoke pins are invariants — the 61c/66a
  lesson — but the wall-clock cost roughly doubles per full run).
  The §68 re-anchor absorbs the measurement shift by charter.
- **Forewarning re-rolls per sector ALREADY** — 66a put the pre-roll
  on `advanceSector`'s fork, headless-pinned. That exit criterion is
  pre-met headlessly; only the native look remains.
- **Difficulty auto-scales on the enemy side.** Wave level budgets
  are `factor × roster central level × hand size` (wave.ts), so
  "same encounters" stay level-matched against the bigger sector-2
  roster. What does NOT scale: fixed health pools and the player's
  accrued daemons/bits/draft — sector 2 on identical content reads
  somewhat easier. A §68 concern by charter; new catalog ENTRIES
  (bigger pools, minHop re-gates) are the sanctioned in-phase lever.
- **Content surfaces:** sector 2 = one `sectors.json` entry (the T3
  sector editor authors it; the DAG stays hand-edited JSON by
  design). Available: 6 themes (grassland taken; barren / volcanic /
  tundra / desert / swamp free) · 12 layouts (all in the-start's
  pool today) · encounter catalog 8 normal + 3 elite + 2 boss, all
  currently pooled in the-start. Hops reset per sector, so minHop
  gates re-apply naturally. The kind-consistency + pool-coverage
  guards (sectors.ts load-time + config tests) run automatically on
  the new entry.

Design forks + the proposed cut posed for shape-lock in the session
message; the content design round (the charter's user decision
point) resolves here when called.

### 67-shape-lock — the gate flip, the identity lock, the content round (2026-07-26, USER)

Three conversations, all resolved same-day.

- **The transition-gate fork FLIPPED on the deeper look — (b), a real
  `sectorCleared` phase + continue command (v39→v40 predicted).** The
  kickoff summary undersold (b); the user pushed; the re-audit found
  two facts that reversed the recommendation: (1) option (a)'s
  synchronous `sector:cleared` emit gets CLOBBERED by the Game
  layer's `if (phase === 'map') swap(MapScene)` fallbacks — the fix
  would be the one place routing can't trust the phase; (2) the
  GameOverScene precedent actually supports (b): `run:defeated` /
  `run:victory` are backed by real phases (`'defeat'`/`'complete'`) —
  under (a) the clone would be the only full-screen beat with no
  phase. Supporting: the bump is nearly free pre-Cluster-6, restore
  re-shows the beat when save/load ships, the gate is the seam for
  any future between-sector mechanics, and the harness must consume
  the new command (the transition exercised headlessly forever).
- **The identity conversation (user-initiated): "dark fantasy on a
  haunted terminal," locked into DESIGN.md §Aesthetic.** The
  resolution: the terminal UI + fantasy cast is the roguelike
  heritage look, unified by the run layer's computing vocabulary
  (sector/port/packet/daemon/bits/cache — a voyage through a
  machine); the nautical register is a kept pun; the Lovecraft pull
  is honored as MOOD (sectors shade darker/occult) without period
  tech — the rifleman-class archetypes deferred to Cluster 5 as
  sector-identity content (a draftable archetype drags
  rarity/draft/price/§68 surface; even enemy-only was kept out of
  §67 to protect the round tail).
- **The content round: "The Deep End" (USER-signed), swamp theme,
  length 11** (kept equal to The Start). Strategy:
  author-new-plus-migrate BEAT copy-and-retune (a copied catalog is
  13 hand-applied per-sector difficulty knobs that drift forever +
  doubles the §68 isolation surface; content carries the difficulty
  instead — enemy LEVELS auto-scale, so the non-scaling knobs are
  pool/count/comp). The user authored FOUR encounters (Infernal
  Column · Plague Victims · Miscreants · Plague Spreaders — the
  plague storyline; Spreaders is the first non-boss stages-grammar
  content). Review caught two convention deviations, both confirmed
  mistakes and fixed: Plague Victims had NO rewards (→ bits-small
  @1, the normal convention); Spreaders paid bits-small@1 +
  daemon-cache@1 (→ bits-large@1 + cache@0.35 — a guaranteed cache
  would out-pay every elite faucet). Pools seeded 8→10 (user call:
  intent legible in the authored numbers; §68 still owns the tune).
  Migration: elementalTrio + plagueDoctors + darkMagicPosse move
  over at minHop 0; artillery + adventurer-with-guards SHARED by
  reference (pool entries are references — no copies);
  brigands/highwaymen stay behind as act-1 identity. Both bosses
  reused (forewarning already varies per sector); same 12-layout
  pool. Noted out loud: the migration kills the "sector-1 stays
  seed-identical" audit nicety at 67c — accepted, §68 re-anchors.
- The catalog entries + the manifest re-pin (+4 ids, Spreaders
  elite) land in the kickoff commit, unpooled-inert until 67c.
