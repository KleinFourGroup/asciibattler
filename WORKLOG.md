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

