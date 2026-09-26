# ARCHITECTURE.md

How the code is organized and why. The companion to `DESIGN.md` (what we're building) and `ROADMAP.md` (in what order).

## Tech stack

- **Language:** TypeScript (strict mode)
- **Renderer:** three.js
- **Build/dev server:** Vite
- **Lint/format:** ESLint + Prettier
- **Tests:** Vitest (shares Vite config; covers `core`, `sim`, `run` only — render/UI are eyeball-verified). See `TESTING.md` for conventions and the determinism contract.
- **Dependencies (runtime):** `three`, `simplex-noise` (for terrain + map gen)
- **Dependencies (dev):** `vite`, `vitest`, `typescript`, `@types/three`, `eslint`, `prettier`

No frameworks beyond that. UI is plain HTML/CSS overlaid on the canvas via absolutely positioned DOM. No React, no state-management library.

## Guiding principles

1. **Simulation and rendering are separate.** The simulation is a pure, deterministic state machine driven by ticks. The renderer reads from simulation state and animates. The simulation never imports from the renderer; the renderer subscribes via the event bus and reads from world snapshots.

2. **Determinism is structural.** Anything that consumes randomness takes an `RNG` instance as an argument. There is no global `Math.random()` in simulation code. This is enforced by lint where practical and by review otherwise.

3. **Composition over inheritance for units.** A `Unit` has a `behaviors: Behavior[]` array. Each `Behavior` implements `proposeAction(unit, world)`, polled by the per-tick action selector (A1). New unit kinds are new behavior combinations, not new subclasses. Keeps unit definitions data-shaped and trivial to serialize later.

4. **The renderer hides three.js details from gameplay.** Gameplay code calls `spriteRenderer.addSprite(...)` and gets back an opaque handle. It never touches `InstancedMesh`, `BufferAttribute`, or shader uniforms directly. This is the contract that lets us swap the renderer implementation (e.g. to WebGPU) without touching simulation.

5. **Loose coupling via events for outputs; a command channel for inputs.** Notifications of what *happened* (`unit:died`, `battle:started`, `battle:ended`, `tick`) flow through the typed `EventBus`. Player intent — entering a node, picking a recruit, resetting the run, future in-battle commands — flows through a separate typed `Command` channel (`RunCommand` on `Run`, `WorldCommand` on `World`). The bus is fire-and-forget pub/sub; the channel is a deterministic apply-point. Mixing the two breaks both replay-trace stability and the past-tense reading of bus events.

6. **Serializable world state.** The `World` (battle state) and `Run` (meta state) are JSON-serializable end-to-end. `World.toJSON` / `World.fromJSON` and `Run.toJSON` / `Run.fromJSON` capture every field that affects determinism (RNG state, tick count, per-unit HP/cooldowns/activeAction, pending command queue, NodeMap, team, phase, encounter, offer, visited set). The snapshot-roundtrip test in `tests/integration/snapshot-roundtrip.test.ts` asserts that a deserialized World continues to produce a byte-identical event trace compared to the un-roundtripped baseline.

## Top-level structure

```
src/
  main.ts                    # Entry point: bootstraps Game, mounts canvas, kicks off run; DEV: window.__game + 28's __game.applyStatus(id, team|unitId) dev hook
  Game.ts                    # Top-level orchestrator: owns Renderer/Bus/Run; scene swapper (A5); 100e2: creates the `.screen-host` div FIRST inside #ui and hands it to the scenes as `uiMount` (every Screen + the HUD mount in it), so the chrome column + the tooltip host follow every screen in DOM order — the Firefox Tab walk reaches the chips before the browser's own UI
                             # builds Run from parseRunConfigFromURL() (G1)
  config.ts                  # Engine constants: TICK_RATE=20, GRID_SIZE=12, secondsToTicks
                             # (balance lives in config/*.json — see src/config/)

  core/
    EventBus.ts              # Tiny typed pub/sub; on() returns unsub
    fnv1a.ts                 # 95e: 32-bit FNV-1a → 8 hex chars, PERMANENT — the 53b trace fingerprint (dev/configHash.ts re-exports it) and the i18n provenance `source` hash share it; a change would fuzzy every shipped locale at once
    RNG.ts                   # Mulberry32 PRNG; .next/.int/.pick/.fork
    sampling.ts              # M6: deterministic RNG samplers — weightedPick + sampleRange (triangular bias)
    Clock.ts                 # Fixed-timestep tick loop separated from render loop
    events.ts                # GameEvents catalog (typed event payloads)
    types.ts                 # Shared primitives: Vec2, GridCoord

  dev/                       # 53b: DEV-only surfaces (main.ts's import.meta.env.DEV block is the sole app entry; the gauntlet harness may import headless)
    TraceRecorder.ts         #   53b: passive battle-trace assembler — bus subscriber (battle:started encounter + the 53a command:applied stream + outcome) → BattleTrace {version, configHash, encounter, commands, outcome}; storage-agnostic (onTrace callback); tested
    configHash.ts            #   53b: fnv1a fingerprint over the RAW config/*.json registry (plain JSON imports — tsx-compatible, NOT import.meta.glob); the trace-invalidation key; drift-guard test walks config/
    traceStore.ts            #   53b: localStorage ring (last 80 traces; 53f bumped 40→80 for the 53g session) + __game.dumpTraces()/clearTraces() console surface; DOM-zone glue, untested
    replayTrace.ts           #   53c: headless byte-identical trace replay — strict version+configHash refusal; reconstruction ≡ both production battle-construction sites; commands injected before their stamped effective tick; the fidelity keystone test lives beside it
    devKeys.ts               #   53f: the Ctrl+Alt dev-key window listener (NOT the Keybindings registry — bare-code dispatch would co-fire chords on bound codes): S = export Run.toJSON download / L = file-picker → Game.devLoadRun (map-phase only) / D = dump the trace ring (D not T — KeyT is bound) / K = cycle the loss-fx shake policy (96.5b2) / G = the 98a GRAYSCALE AUDIT toggle (`filter: grayscale(1)` on the root — canvas + DOM together; the Round 7 "never color alone" lint, dev-only) / A = the 99a REDUCED-MOTION override cycle (OS → reduced → full; src/render/motion.ts — the browser read for the §99 surface, since the pane can't emulate the media query; A not R — Firefox owns Ctrl+Alt+R as Reader View, gotcha #134: a chord must clear the BROWSERS' Ctrl+Alt set too) / C = the 100a CAMERA MODE toggle (fit ↔ scroll via `Renderer.toggleCameraMode` — the D4 Backquote keydown was a shipped hotkey with no click route; the pan keys + edge-scroll attach only under DEV) / P = the 105b BOARD EXPLORER toggle (dev/boardPanel); DOM-zone glue, untested
    boardPanel/              #   105b: THE BOARD EXPLORER — Round 7.5's projection spike (§105), a dev-only render-only panel of live dials over the battle board (Ctrl+Alt+P; `__game.boardPanel`). SPIKE CODE: the seed of the build or reverted at §106's close. state.ts = the DIALS table (one row = one dial: the panel control, the typed state and the `?bp=` bookmark all derive from it) + the URL codec (`yaw-30_pose-row`; non-defaults only; `spliceBookmark` leaves every other query pair byte-for-byte) + `barLift`, THE bar-line rule — tested (state.test.ts, expectations off tests/board/inkCensus.json) · seams.ts = how a dial reaches the renderer with ZERO production touch: runtime patches on `BattleRenderer.prototype.inkTopLiftFor` and `SpriteRenderer.sortByDepth` (instance — the pre-render frame hook); each falls through to the original at the default dial and logs a loud `seam moved` if its name-keyed reach breaks · **105c THE FIXTURES:** fixtures.ts (pure, tested — fixtures.test.ts drives the real `Run` + a real `World`) = the BOARDS table (`open15` the pose host · `quarry` · `corridors` · `big24` by seed hunt · `live` · `wade`, 108c's icebergs fight where units wade diagonally past the floes; each a set of SHIPPED run dials + the board they must open) + `fixtureSearch` (the run pairs rewritten from the table, every other pair byte-for-byte) + the POSES (`placePose`: 105b's row · 105a's three clumps and its flyer, cell for cell · the edge units; a displaced group SAYS so) · posed.ts = the render-only posed set with REAL overlay bars (supersedes 105b's posedRow.ts), the flyer riding the `lift` dial along camera-up · boot.ts = straight to the battle: `applyBoardFixtureUrl` BEFORE `new Game` (Game parses the run dials in its constructor, so `bp=board-<id>` is the one source and a hand-typed `seed=` beside it cannot open another board) + `enterBoardFixture` after (root → Fight, the opened board CHECKED against the table, the countdown parked by an instance patch — Space still fights). ⚠ main.ts loads the whole module by a DEV-gated DYNAMIC import: the static import left ~200 bytes of the fixture table in `dist/` (tree-shaking could not prove template literals / spreads pure) · **105d THE PROJECTION DIALS** (`proj` · `fov` · `pitch` · `yaw`; their defaults pinned equal to `DEFAULT_CAMERA_VIEW`) go through the phase's ONE production seam, `Renderer.setCameraView` — seams.ts `applyCameraView` calls it and re-points `UnitOverlayLayer`'s captured camera; an untouched panel never calls it · **105e THE GLYPH SCALE** (`scale`, UNIT BODIES only — user-signed): `stampSizes` writes `footprint × scale` per frame onto every non-inert unit whose stamp differs (spawn's `footprint` is the assumed start, so an untouched dial writes nothing); `atlas.inkTopLift` / `inkCenterLift` patched × scale on the instance (every bar / hitsplat / marker-target / FX-endpoint consumer follows; `inkBottomLift` untouched — the marker's own glyph); `enemyBillboards` / `destructibleBillboards` wrapped, `size` × scale; `KNOWN_ARTEFACTS` = the panel's "not findings" list · **THE MARKS DIALS** (`marks` on/off · `plateCorner`, kept for organic scenery): typed calls on `TerrainRenderer.setGroundMarks` / `setMarkStyle`; the frame hook puts the posed set's marks on the terrain's table. 108f deleted the §106 mock (`groundCue.ts`, `conform.ts`) with its dials, the other look dials, and 108c's hop dial (its code at `d045497`; TODO "Movement polish") · **108d THE FRAME-COST BENCH** (the panel's `frame-cost bench` button, `__game.boardPanel.bench()`): bench.ts, pure and tested against a fake clock (bench.test.ts) = discarded warm-up rounds, then four blocks of A B B A rounds (marks off → on · an A/A control · a planted CPU spin that must read back at its size · the bins filled, which must read above the A/A spread), each leg the median of its chunk means, the report text; benchRig.ts = the live side: a bench frame is `BattleRenderer.update(0)`, the sort, `Renderer.renderTwoPass` and a one-pixel `readPixels` that waits for the GPU, with the spin calibrated per run and the clock's step measured · panel.ts = the DOM shell on `<body>` (not `#ui`, gotcha #137), its own injected <style>, keys typed inside stop there · index.ts = the glue. DOM / WebGL glue is browser-verified

  bot/                       # §54: the harness-only bot layer — nothing shipped imports it; Math.random ESLint-banned (backfilled here at 57f; the block was missing since §54)
    TrafficScriptDriver.ts   #   54a: TrafficScript {id, evaluate, 57e nominate?} + TRAFFIC_SCRIPTS (registry order = arbitration priority) + the fixed-priority per-battle driver (min-dwell, standing-order ownership) + sameObjective
    sensors.ts               #   54b: pure derived-state reads (jamRead / hazard+barrier / chokeCells / armyMinCut / armiesInContact / attritionRead / focusTargetFeatures) — no event history; rollout-compatible by construction
    scripts/                 #   54d–54h: the five traffic scripts (terrainEdgeHold / unjam / chokeHold / cohesionFocus / attritionStall), one file each, co-located tests; 57a: --scripts=<spec> subsets select from the registry
    rollout.ts               #   57d: cloneForRollout — the CLAIRVOYANCE GUARD (both RNG streams re-seeded at the wire level pre-fromJSON; fresh bus; live world untouched); the foresee-the-rolls test keeps the plain-clone control case
    evaluator.ts             #   57e: evaluateCandidate — K CRN rollouts × H ticks → terminal material differential (HP fractions) + dominant WIN_BONUS; winner inferred from terminal state (derived reads only)
    RolloutSearchDriver.ts   #   57f: the portfolio greedy searcher — nominate (evaluate()/nominate?) → CRN-evaluate → commit only past the null arm + ε; cadence + death/contact re-search; dials as ctor options (§57c v2 defaults — the 57g sensitivity seam)

  config/                    # A4: zod-validated wrappers around config/*.json
    units.ts                 #   §38 UnitDef catalog (was archetypes.ts): glyph + baseStats + growthRates + abilities/targeting (E1/E3) + inert §38 fields (footprint/layer/ignoresTerrain/susceptibility); attackRange moved to abilities (E5); 29d: assertSummonRefsResolve boot-checks every summon op's archetype id
    abilities.ts             #   Loads config/abilities.json into the AbilityDef catalog (src/sim/effects schema); abilityDef(id) + the damageOpOf/healOpOf op accessors. Y5e consolidated this (was abilityDefs.ts) atop the retired legacy AbilityConfig
    statuses.ts              #   27a: loads config/statuses.json into the StatusDef catalog; statusDef(id) + assertStatusRefsResolve (boot-checks every applyStatus statusId, wired into abilities/registry.ts)
    difficulty.ts            #   G4: enemy level-budget knobs (budgetFactor/offset, swarm, K2 enemyArcherRatio) + A/B/C presets; X1: per-run waveSize/levelBudget multipliers; 48f: bitsMultiplier (the economy lever — applies in Run.effectiveBits, never WaveContext)
    recruitment.ts           #   offer size + startingLevel + recruitBonusChance (G4); §61c rarityWeights (63c: roster composition moved to characters.json)
    characters.ts            #   §63a: loads config/characters.json — starting characters (roster/daemon/blacklist additions/weight overrides); characterById + DEFAULT_CHARACTER_ID ('soldier') + assertDefaultCharacter boot check
    leveling.ts              #   E4: xp curve + half-cover mult + restXp (G3) + xpPerHealing (F6)
    nodemap.ts               #   hop count + width bands + degree cap + restChance/restMinSpacing (G2/G3)
    terrain.ts               #   C1a: wall + water density
    layouts.ts               #   C1d.A: hand-authored layout array (incl. spawns, halfCovers, chasms, fires, healings, §40d rubble, theme)
    sectors.ts               #   T1: the Sector schema — run container (id/title/desc/length/theme/hop-gated layout pool); V0: + hop-gated ENCOUNTER pool (sector-owns-both); procedural = reserved sentinel
    sectorMap.ts             #   T2: the sector-selection meta-DAG schema (nodes hold sector lists; sources/sinks; acyclic, non-sink-has-outgoing guards)
    events.ts                #   74a: the event grammar — flat page map (pages → choices → weighted outcomes → effect ops + next: page-id | return-to-map | start-encounter{rewardOverride?}); the closed condition union + the ONE combinator `not` (74c-pre); the EVENTS-SIDE op union (shares gainBits/healPool sub-schemas with daemons.ts — the daemon surface never widened); FOUR boot asserts: terminate (74a, unconditioned-exit fixpoint) / reachable (74i, BFS from entry) / reserved-flags (74i — `visited:*` is engine-written, author-readable) / cross-catalog refs; repeatable? (74i, the no-repeat opt-out) + visitedFlagFor; (74f's describeEventCondition — the requirement phrases — lives in src/ui/eventConditionText.ts since 100e: no player-facing prose in a config module); §95a: name / pages.*.text / choices.*.label are prose() (→ src/i18n, addresses in locales/en/events.json) + choice `id?` = the locale address segment (unique per page; the editor stamps it at export) — config/events.json
    encounters.ts            #   U3: the Encounter schema (id/name/healthPool/layouts? fit-filter/kind enum/rewards?/waves) + the recursive U2 waves grammar (zod); V0: placement moved to the sector pool; V1: catalog ships Brigands/Highwaymen/Deserters
    selection.ts             #   V1: the SELECTION policy (strategy: encounterFirst|layoutFirst) — config/selection.json
    economy.ts               #   47e: the economy substrate (startingBits) — config/economy.json; grows with Cluster 3
    rewards.ts               #   48a: the reward-table registry (weighted bits{min,max}|packet|daemon|unit|poolHealth entries — unit/poolHealth 74c, first authored 74i: hostage-rescue) + the {table,trigger} encounter-ref schema + the daemon/packet/unit-ref boot asserts (49a activated the packet sibling; 74c the unit one) — config/rewards.json
    packets.ts               #   49a: the packet catalog (one effect op per packet: applyBuff|grantRedraws|injectRule|healPool) — the EXPORTED (op×target×context) matrix (PACKET_OP_TARGET/PACKET_OP_CONTEXTS: parse guard + the 49e engine + the 49g editor read ONE source; midBattle/tile = dormant vocabulary no op admits) + per-op duration restrictions + assertPacketStatusRefs — config/packets.json
    prices.ts                #   50a/f: the port price book — PricesSchema + assertPriceRefs (draftable coverage + packet/daemon key refs) + the PURE *For price cores (unitPriceFor/packetPriceFor/daemonPriceFor/sellPriceFor; PRICES-bound wrappers delegate — one formula for the game AND the 50f editor preview) — config/prices.json
    camps.ts                 #   75a: the camp catalog (CampDef: id/name/description + leashRadius + units[{archetype,count,level}] + rewards[EncounterRewardRef]) + CampsSchema (exported for the 75i editor's byte-faithful formatter) + the TWO boot asserts: assertCampRewardRefs (reward-table refs resolve — the assertEncounterRewardRefs sibling) + assertLayoutCampRefs (layout camp placements name real camps) — config/camps.json. 75j: the ⭐ CONTINUOUS-VALUE reward rule (always-on camps pay bits/packets ONLY — never a run-defining reward; spec §Camps)
    spawn.ts                 #   D5.C: SpawnAction lockout duration
    tiles.ts                 #   D7.B: fire/healing chip rates → tick cadences
    stats.ts                 #   E1: hpPerConstitution, crit cap + mult, base move cooldown;
                             #   GP1: per-axis mobility/speed CdPerStat + MinCdScale (I1: agility→speed); GP2: minDamage floor
    sim.ts                   #   E5: targeting + pathfinding knobs (retarget, occupiedCellPenalty, healer*)
    playback.ts              #   I3/Q1: speed steps {value,enabled}[] (0.5/1/2/3) + pauseEnabled; render-only (pause = speed 0)
    schemas.ts               #   shared zod helpers

  i18n/                      # §95 (Round 7): the locale layer — CONFIG prose via the SIDECAR (English inline in config/*.json; other locales derived), UI literals via an explicit-key table (95c)
    prose.ts                 #   95a: prose() — a zod .meta marker on a string field: THE DECLARATION IS THE MANIFEST; prosePatterns (the zod-4 def-tree walk, per-path cycle cut, throws on an unknown shape) + proseSites (the data walk: addresses `<family>.<id>.<path>`, arrays keyed by element id else index; collision + separator guards)
    locale.ts                #   95a: the runtime — activeLocale (en = the inline value by definition) · registerLocale(lang, family, file) · applyLocale(family, schema, data) resolves every site IN PLACE once at catalog load; a missing entry under a non-en locale THROWS. 95e: LocaleEntry = string | the provenance object; a FUZZY entry (its `source` ≠ the English's hash) falls back to the English with the DEV `⚠ ` marker (FUZZY_MARKER) and lands in the fuzzyEntries() census — an UNSTAMPED one resolves as-is (the pin gates it, not the runtime)
    families.ts              #   95a/b: PROSE_FAMILIES — the ten `<FAMILY>_PROSE` descriptors each loader exports from `loadProse(family, schema, data)` (locale.ts: apply + describe, right after the parse — BEFORE any normalize/map copies the fields); the extract + the en pins iterate it. Camps is not a family (nothing of it renders)
    extract.ts               #   95a: extractFamily → the flat address → English map; `npm run i18n:extract` (scripts/i18n-extract.ts) writes locales/en/<family>.json; tests/i18n-en-extract.test.ts pins it current (missing / orphan / stale — the derived-artifact tripwire shape)
    literalScan.ts           #   95d: THE LITERAL PIN's scanner — prose-shaped string literals in the presentation layer, over the TypeScript AST (compiler API; imported only by the test + script): two words with whitespace or one Capitalized word; structural exclusions (Error / console / fail·assert* callees · className, classList, querySelector, style.* · message / shader properties · types, case labels, property names) + `// i18n-ok` line and `i18n-ok-file` markers + KEYBOARD_CODES; 100e: SCAN_ROOTS = src/ui · src/scenes · src/render · Game.ts · main.ts (config/events.ts dropped with the describer) and the baseline (tests/i18n-literal-baseline.json) is EMPTY — every file at zero, the pin's absent-means-zero clause holds the layer
    literalBaseline.ts       #   95d: scanRepo over SCAN_ROOTS (src/ui · src/scenes · src/render · Game.ts · main.ts · config/events.ts) → the per-file counts; tests/i18n-literal-baseline.json is held EXACTLY by tests/i18n-literal-pin.test.ts (a ratchet to zero); `npm run i18n:baseline` regenerates, `--list` prints the worklist
    ui.ts                    #   95c: t(key, params) — the UI string table for literals that live in CODE (English is the SOURCE: locales/en/ui.json, explicit namespaced keys, always a string literal at the call site); plural entries by CLDR category via Intl.PluralRules on `count`, {placeholder} substitution, numbers via Intl.NumberFormat; registerUiLocale(lang, table); every miss THROWS. Pinned by the static key scan tests/i18n-ui-keys.test.ts (every literal key exists · every key referenced · no computed keys · non-en tables match the key set AND pass the 95e audit). 95e: a non-en entry may carry provenance (`text` = the string or the plural object); fuzzy → the English + the marker, censused as `ui.<key>`
    provenance.ts            #   95e: the per-entry authorship chain `{ text, source, translator: {who, on}, reviewer: {who, on} }` — sourceHash (fnv1a over the English; a plural object canonicalized with sorted keys) · currencyOf (current / unstamped / fuzzy) · auditLocale (missing / orphan / unstamped / fuzzy — the ONE function under both disk pins + the hand-drifted fixture) · translatorStamp (drops any reviewer) / reviewerStamp · creditsOf. English carries none (git is its authorship). Written only by `npm run i18n:review`
    credits.ts               #   95e: localeCredits() — creditsOf over the REGISTERED sidecars + UI tables (en skipped), browser-safe for the Round 8 credits screen

  sim/
    World.ts                 # Battle state: grid + units + tick. tick() runs the selector,
                             # phase timeline (F2), overflow scan, tile-effect pass, reapDead, checkBattleEnd.
                             # Serializable; WorldSnapshot (live version: HANDOFF 🧭; bumped E1 → 49e: I1 = agility→speed + precision/evasion; I5 = melee→mercenary rename + subclasses; I6 = removed UnitDerived.critChance, crit is per-ability now; J1 = added the shared objective; K1 = per-unit status effects; §31 = effect-scaling op-resolution slots; §36a = the in-flight claim registry; 47f = battleRules + tallies; 49e = the applyStatus applyTo axis)
                             # K1: registerTrigger/fireTrigger — combat/lifecycle trigger dispatch (the L daemon seam; NOT bus events)
                             # E1: combatRng (forked from rng); E4/F6: damageDealt + utilityDone XP ledgers
                             # J1: objective (player-team shared steering, tile|enemy) — set via WorldCommand, auto-clears on enemy death
                             # GP2: applyDamage() — the single combat-damage chokepoint (HP -= + ledger
                             #      + unit:attacked emit + subtractive defense mitigation); tile damage bypasses it
                             # I2/I6: applyDamage(evadable, accuracy) rolls accuracy-vs-evasion to-hit off combatRng (crit→miss order);
                             #     a miss emits unit:missed + 0 dmg. Only single-target strikes opt in; AoE/catapult/tile unmissable
                             # K1: applyDamage reads effectiveStats (prc/eva/def) + fires dealHit/takeHit/dealMiss/evade/kill triggers (post-resolution)
                             # 47f: installBattleRules (once per battle; data serialized, handlers re-registered on fromJSON)
                             #      + tallies {bits} (battle-earned run resources → the battle:ended payload, settled by Run.gainBits)
                             # 75b: the CAMP REGISTRY (v34→v35) — camps Map<id, CampInstance {defId, anchor, hostileTo per-faction, pending drip queue, killedBy}> + the presence-gated campRng (null on camp-free worlds — byte-identity is the exit gate; cloneForRollout carries it conditionally); installCamps (once per battle) / campById / campsList / markCampHostile / campHostileTo
                             # 91a1: the FALLEN LEDGER (v35→v36) — fallenPower {player, enemy} booked by recordFallen at BOTH reap sites (the step-1 death check + reapDead) before the splice, neutrals excluded, effectiveStats.power (the survivorPower stat); rides battle:ended with `reason` ('decisive' | 'mutualWipe' | 'cap' — resolveAsDraw is the only 'cap'); serialized (the dead are gone from `units`, so a v35 save is rejected)
                             # 75e: aggro + kill credit ride dealDamage (damage is hostility's SINGLE source — the whole camp marks hostile to the striking faction; the drip-aware killedBy stamp waits for pending+living empty); 75g: hasUnclearedHostileCamp gates checkBattleEnd's decisive path behind SIM.blockCampTurnEnd (shipped TRUE, the 75j verdict); runCampDripScan (75c: per-tick portal drip onto the anchor) + primeCampSpawns (75h2: the setup-time first-member prime)
                             # 76a: applyAuraStatuses — the aura pass (every live carrier with Ability.aura sustains its status on live units within Chebyshev radius, footprint-aware, via the 27d sustainStatus chokepoint — linger = the status's own lifetime; overlap tops up to one expiry; NO bump — aura state is refresh-lifetime statuses)
    battleRules.ts           # 47f: the battle-domain daemon/packet seam — BattleRule (plain compiled data) + registerBattleRules
                             # (evaluation at the K1 triggers: player-team acting only; filter-before-chance; chance off
                             # combatRng; gainBits → tallies, applyStatus → the ACTING unit by default, def-resolved at fire
                             # time; 49e: applyTo:'target' lands on the STRUCK unit — dealHit-only, corpse-guarded AFTER the
                             # chance draw so draw counts never depend on hp state)
    Unit.ts                  # Unit + UnitTemplate + UnitStats (GP1 vocab + GP2 defense) + UnitDerived + Team + Behavior
                             # archetype: mercenary|adventurer|ronin|bandit|archer|rogue|healer|mage|catapult|environment (I5 split melee→the 4-class melee family; §61a renamed ranged→archer — the STAT is still `ranged`)
                             # level (E3) + xp/rosterIndex (E4); actionCooldowns Map + activeAction (A1)
                             # blocksLineOfSight (D6)
                             # K1: effects[] (status effects) + effectiveStats (cached fold; === stats when empty) + addEffect/expireEffects/refreshDerived
                             # 75b/d: campId (null = the pre-75 world) + the isActiveNeutral/isInertNeutral predicate PAIR — the §75d/e widening's single vocabulary (an active neutral is a mobile combatant on team 'neutral'; inert = walls/cover/rubble; ~40 call sites gate on these, never on bare team checks)
    statusEffects.ts         # K1: generic status-effect system — StatusEffect (per-stat add/mul mods + lifetime + merge policy) + foldEffects + combineMagnitude
    statusBehavior.ts        # 28: behaviorFlags — the def-resolve fold turning a unit's effects[] into merged AI overrides (frozen/blind/panic/confusion) the selector/movement/targeting consumers read
    statusReadout.ts         # §32c: readUnitStatuses — pure projection of effects[] → per-status display facts (name/kind/stacks/remaining/durationFraction/potencyPerSec); feeds the board pip-strip + card row (sim truth only; color lives render-side)
    triggers.ts              # K1: TriggerContextMap (combat: dealHit/takeHit/dealMiss/evade/kill/death/spawn) + generic TriggerDispatcher<M,O> (shared by World + Run)
    stats.ts                 # deriveStats / inertDerived / ZERO_STATS + damage/heal/range/cadence helpers
                             # — pure functions; crit RNG rolls happen at AttackAction.start; K1: unit-taking helpers read effectiveStats
    leveling.ts              # E3: simulateLevelUps (player rolls) + scaleStats (enemies, deterministic)
    xp.ts                    # E4: xpToNext curve + computeXpAwards + displayLevel
    TileGrid.ts              # Tile kinds: floor | shallow_water | chasm | fire | healing
                             # Per-cell movement cost; chasm = Infinity (data-driven block)
    LineOfSight.ts           # Bresenham line walk for ranged-attack LOS (C1b)
    Action.ts                # Action / ActionProposal / phase-timeline interfaces (A1 → F2)
                             # + toData()/fromData for snapshot rehydration (A2); OrphanPolicy (F2)
    Command.ts               # WorldCommand union — drained at tick boundary (A2); J1: setObjective/clearObjective
    objective.ts             # O1/O2/O3: TeamObjective (atWill | engage{target} | hold | focus{target}) per team + ObjectiveTarget (tile | enemy); J3: objectiveAtCell (click cell → enemy/tile)
    focusTile.ts             # O3: the one keyed focus-TILE resolver (disallow | clearOnArrival | leashAtNearest), config-selected; directive + resolvedByArrival
    Pathfinding.ts           # A* king's-move, Chebyshev heuristic, optional CostFn (C1a); J2: pathfindingStats counter; J3: bestEffort (route to nearest reachable)
    movement.ts              # J2: shared movement seam — MovementIntent + advance (the dash hook) + routeToward (cache boundary); §42a: advance emits the mechanical unit:moveDecision
    moveDecision.ts          # §42a: the MoveDecisionKind taxonomy + emitMoveDecision — the per-poll movement decision record (observational only, never serialized)
    actingPosition.ts        # GP4: nearestActingCell — bounded BFS to nearest firing cell in [minRange,range](+LOS) (O4 band); §29d nearestFreeCells (summon placement)
    positioning.ts           # §44a: the WHERE knowledge — firingBandCell (44-pre-c, THE shared band+LOS gate) / collectLosBlockers·collectHalfCoverPositions / engagementDirective (hold|approach|pinned) / awayStep+passable+NEIGHBORS leaves; ⚠ must not import archetypes.ts (module-eval cycle, see its import note)
    occupancy.ts             # §35: the occupancy chokepoint — cellsOccupiedBy (footprint seam) / isFree·unitAt / occupiedCells / footprintFits / distanceBetween; OccupancyPlane (plane seam, ground-only)
    Targeting.ts             # findTarget + currentTarget stickiness + updateTarget (E5) w/ objective branches (engage/hold/focus + updateTargetDefault); lowestWoundedAlly (E7.B); 28: behavior preempt — confusion random-team pick / blind capped acquisition; §44a: the LOS pools + band gate moved to positioning.ts
                             # dispatches the seeker's targeting strategy; ties by HP then id; skips neutrals
                             # §75e: hostileCandidate — THE shared admit rule every hostile scan runs (passive camps are scenery; hostility per-faction, both directions); currentTarget honors an ordered PASSIVE camp mark (the first-blow guarantee)
                             # §40b/§75k/k2: the rubble auto-break pair — applyRubbleAutoTarget (atWill overlay: reachable hostile > nearest approachable rubble) + applyOrderedRubbleFallback (the ordered pursue arms: routeGateRubble's permeable A* names the ROUTE-gating rubble, first-on-route; null probe HOLDS the mark)
    targetingStrategies.ts   # per-archetype target-pick registry (nearest / weakest); Unit.targeting resolved at spawn
    archetypes.ts            # ALL_ARCHETYPES (full catalog) + DRAFTABLE_ARCHETYPES (§29-close draft pool, draftable-flag filtered), rollUnit, glyphForArchetype, targetingForArchetype, range/minRangeForArchetype (O4)
                             # §76c: engagementReach (non-engaging verbs — self leaps, ally-buff blasts, pure auras — are EXCLUDED from derived.attackRange, the in-range-abstain threshold; falls back to max rangeCells for pure-support kits)
    environment.ts           # spawnWall + spawnHalfCover (D6) — neutral-team env factories
    terrainGen.ts            # Per-encounter terrain dispatch: procedural (proceduralMap.ts) vs layout library; §81a threads the sector THEME to the procedural path (+ pairs rolled camp sites with the theme's pool)
    proceduralMap.ts         # M6: crossbar+divider+noise map generator + sampleProceduralParams (config→params); §81: the per-theme tile layer (deep-water pool deepening, hills/ice/sand/mud patch fields, volcanic fire scatter — deep water counts in the cap + carves to shallow) + camp-site placement (pair/midBand/rare-free, placed LAST so camp dose never perturbs terrain)
    layouts.ts               # Thin re-export of validated config (LAYOUT_IDS for Run's roll)
    battleSetup.ts           # Shared applyTerrain/spawnTeam/spawnEncounter (+ §40d spawnLayoutNeutrals — walls/cover/rubble from a GeneratedTerrain)
                             # 75c: spawnCamps — rolls each camp-spawn tile's camp (per-ENCOUNTER identity = the signed 75j verdict) + installCamps + spawnCampUnit (behavior slot 0 = CampWanderBehavior — the 75f landing note lives at the swap); §75j2: the enemy PULL (SIM.enemyPullChance) enqueues engage{neutral} on the pulled camp's primed member — NO pre-marked hostility, the ordered first blow aggros
                             # 77d3: every battle-setup stream KEYED off terrainSeed — 'terrain' / 'spawnSetup' / 'campSetup' (turn-free BY VERDICT) / 'enemyPull' (per-turn via the worldSeed index); the §75 burn fork + mixSeeds one-off retired (gotcha #125)
    actions/                 # Non-verb actions only — every combat verb is now the data-driven effects/EffectAction (Y5c retired the hand-coded AttackAction/Heal/MagicBolt/Catapult/Gambit/Dash classes)
      MoveAction.ts          # §36b NON-INSTANT: start() claims `to` + emits unit:moved; applyEffect() flips position + releases the claim at the 50% mark (SIM.moveFlipFraction)
      SpawnAction.ts         # Pure-lockout action seated on D5.C overflow-queue spawns
      SwapAction.ts          # GP5: healer chokepoint yield — two units trade cells
      WaitAction.ts          # §44b: the first-class deliberate hold — empty timeline + no applyEffect → World's instantaneous-action rule resolves it within the tick (never in activeAction, never serialized, NOT in the registry by design)
      registry.ts            # Action factories keyed by Action.id (move/spawn/swap — 'wait' deliberately absent, §44b); every other id falls through to EffectAction.fromData (A2/Y5c)
    abilities/               # E2: generic Ability layer (retired AttackBehavior)
      Ability.ts             # Ability interface + propose() + ignoresLineOfSight flag (E7.D)
      registry.ts            # Ability factories; routes every id to EffectAbility (Y3–Y4 migration complete; the hand-coded classes retired in Y5)
    behaviors/
      MovementBehavior.ts    # J2: thin goal-selector → MovementIntent + advance (movement.ts); boids sidestep (E5.B); 28: behavior override — frozen root / panic flee (retreatCell) / blind wander
                             # splits neutrals into pathBlockers + losBlockers (D6); LOS-optional abstain (E7.D)
      AbilityBehavior.ts     # E2: walks the unit's Ability[] (replaced AttackBehavior); 28: skips attack proposals when a status sets preventsAttack (frozen/panic)
      SupportMovementBehavior.ts  # E7.B: healer idle / panic / approach / centroid-trail
      CampWanderBehavior.ts  # 75f: the camp member's behavior slot 0 (spawnCampUnit swap) — PASSIVE = the leash-filtered anchor wander on campRng (campWanderChancePerSecond authored per-SECOND, loader-derived per-tick — the 75j verdict's tick-rate decoupling; anchor tile skips the chance gate so the drip portal vacates); HOSTILE (currentTarget resolves a mark) = wholesale delegate to MovementBehavior's engagement protocol
      registry.ts            # createMovementBehavior + behavior factories keyed by kind (A2)
    effects/                 # Y1–Y3: data-driven attack/effect model (Cluster 1 keystone) — replacing the hand-coded ability/action classes
      schema.ts              #   Y1: EffectOp/TargetSelector/AbilityDef vocabulary (zod, closed discriminated unions) + inferred types; 27a: PeriodicOp (damage|heal subset for status ticks)
      statusSchema.ts        #   27a: StatusDef vocabulary (zod) — durationSeconds/merge/periodic{everySeconds,op}/fx; 28: behavior{preventsAttack/preventsMove/movement/targeting/acquisitionRange/affects} (the AI decision-hook axis); 47f: statMods (the deferred stat-mod axis, first consumer = emboldened)
      statusRuntime.ts       #   27b: StatusDef → runtime StatusEffect bridge (buildStatusEffect + statusMergeToPolicy: brief merge vocab → K1 MergePolicy)
      timeline.ts            #   Y1: seconds→ticks phase conversion: speed-scaled cadence + the single 'fill' elastic phase
      targeting.ts           #   Y2: unitsInCells (the Cluster-2 footprint seam) + aoe victim resolution + the affects filter
      reposition.ts          #   Y2: retreatCell — the caster-reposition primitive (the gambit's move-retreat op, via interpreter executeMove)
      interpreter.ts         #   Y2: executeOp — the switch over op.kind (damage/heal/move; reserved arms throw); 28: a confused caster's aoe forces affects:'all' (live read)
      EffectAction.ts        #   Y2: the single generic Action that fires a def's effects over the F2 timeline (start/applyEffect)
      propose.ts             #   Y3: the propose-time bridge — AbilityDef + caster → EffectAction + ActionProposal (cast-time scalar capture)
      resolveScalars.ts      #   30c: the pure cast-time damage/heal/crit scalar kernel — shared by propose.ts AND the attack-editor's resolution-outline preview (one source of truth, never re-implemented)
      EffectAbility.ts       #   Y3: the single generic Ability wrapping an AbilityDef (replaces MeleeStrike/…; one class + data)

  run/
    Run.ts                   # State machine: map|turn-intro|battle|turn-outcome|promotion|recruit|
                             # reward (48b)|port (50c)|event (74b)|sectorCleared (67)|defeat|complete.
                             # H4 encounter loop (health pools + turns) + H5 card deck (draw/hand/discard
                             # + deckRng). rest/boss resolution (G3); XP banking; dispatch(RunCommand) +
                             # toJSON/fromJSON (A2). RUN_SCHEMA_VERSION: live value in the HANDOFF 🧭
                             # 74b: the event phase — {eventId,pageId} cursor + eventRng (the NINTH
                             #      construction fork) + the run-lifetime eventFlags store (chains);
                             #      74e: entry combat-resolves at a fold-routed chance, else the
                             #      sector-pool roll; 74i: `visited:<id>` marked at page open, the
                             #      no-repeat pool filter (repeatable opt-out), the firstNodeKind
                             #      dial exemption (a dial-stamped root draws the REGULAR pool)
                             # K1: encounterEffects store (endOfEncounter, re-seeded at deploy) + addEncounterEffect
                             # + run triggers (encounterStart/turnStart/deploy); beginTurn seeds fatigue + encounter effects
                             # K3: pre-turn redraw (handleRedrawCards at the turn-intro gate; per-turn budget, v13)
                             # K3.5: ONE map per encounter — rollEncounterMap in beginEncounter → Run.encounterMap (v14);
                             # beginTurn keeps only worldSeed + the wave re-roll per turn
                             # K4: pre-turn empower (handleEmpowerUnit → addEncounterEffect; per-turn budget, v15)
                             # L1: the daemon — rolled at construction off the dedicated daemonRng (or RunConfig-forced);
                             # turnGates re-resolved each startNextTurn = THE redraw/empower availability (daemon-only gates, v16)
                             # U3: beginEncounter SELECTS an Encounter (selectedEncounter, U3=reproductionEncounter) +
                             # seeds enemyHealth from its healthPool + resets waveCursor; beginTurn resolves the per-turn
                             # enemy team from the encounter's wave grammar (waveForTurn→resolveWave) NOT rollEnemyWave;
                             # encounterBudget retired; encounter.name → HUD enemy pane. RUN_SCHEMA_VERSION 21
                             # 47c–f: daemons re-authored to rules + multi-daemon by id + the bits substrate —
                             # bits (floor-at-zero via the addBits chokepoint → run:bitsChanged) + gainBits (the
                             # bitsGain fold at the grant site) + instant-op execution at the run trigger fire
                             # sites (turnStart via resolveTurnGrants; encounterStart/encounterEnd via
                             # resolveInstantHooks in beginEncounter/finishEncounter). 47f: BattleEncounter
                             # carries battleRulesFor(daemons); handleTurnEnded settles battle:ended tallies
                             # via gainBits (skip-on-lost, the XP mirror). 48b/f: the 'reward' run phase —
                             # rolled at the win boundary (rollRewards off two dedicated streams), spliced at
                             # the turn gate AHEAD of promotion; pendingRewards serializes BASE amounts and
                             # effectiveBits (base × bitsGain fold × 48f bitsMultiplier, one rounding) is the
                             # SHARED display/settle helper. 49b–e: the CACHE (packet ids, acquisition
                             # order; capacity DERIVED via the cacheSize fold, overflow = derived
                             # forced-keep state; addPacket/handleDiscardPacket → run:cacheChanged) +
                             # THE GRANT QUEUE (turnGrants: TurnGrant[] per-source, cursor DERIVED,
                             # passGrant + the passIsFinal strict default — flipped TRUE at 49f) +
                             # THE FIRE ENGINE (handleUsePacket: context from phase, validate-first,
                             # consume-on-fire → run:packetUsed; pendingEncounterEffects drained after
                             # the K1 reset at encounter start; injectedEncounterRules/injectedRunRules
                             # unioned into every beginTurn compile after the daemon rules; packet
                             # redraw grants INSERT AT THE CURSOR). Live version: HANDOFF 🧭
    redraw.ts                # K3→49d: pure redraw rules against ONE grant entry — redrawRejection / redrawAvailability (RedrawGrantState: used/budget/maxCards-per-ACTION)
    empower.ts               # K4→49d: pure empower rules against ONE grant entry — empowerRejection / empowerAvailability / empowerEffect(buff)
    daemon.ts                # L1→49d: pure daemon rules — resolveTurnGrants + hooks (63c retired rollDaemon: characters seed the starting daemon)
                             # (owned daemons' turnStart grant hooks → THE GRANT QUEUE: TurnGrant[] per-source in
                             # walk order, each {daemonId; effect(kind/budget/maxCards|buff); used; passed} +
                             # this turn's granted InstantOps; ownership-then-rule-order draws, chance draws only
                             # when 0<c<1) + activeGrantIndex/grantViews (the DERIVED cursor + payload views) +
                             # resolveInstantHooks (encounterStart/encounterEnd, filter-gates-before-chance) +
                             # battleRulesFor (47f: compiles battle-domain hooks → sim BattleRule[] data, riding
                             # BattleEncounter) + daemonRedrawHook/daemonEmpowerHook
    runStats.ts              # 47a: the run-stat vocabulary — RunStatKey + foldRunStats (foldEffects mirrored:
                             # adds→mults, identity-on-empty; NO rounding — read site rounds). 64a–c: keys are
                             # bitsGain, cacheSize, recruitOfferSize (64a — base CONFIG-DERIVED from recruitment
                             # .json), the four rarityWeight* tiers (64b — the no-commons mult-0 seam),
                             # portLegendaryOffers (64c — count of tier-forced port slots, base 0), and
                             # drawAmount (65a — per-turn draw, base = deck.json handSize; read clamped to
                             # [1, deck.json maxHandSize] — the 65d user-signed cap, one basis for deal + budget)
    fatigue.ts               # H6c→K1→91c: fatigueEffect — the Fatigued status debuff on CONSTITUTION (starting HP; stacks clamped at health.fatigueMaxStacks; null/inert at the default rate 0)
    chipRule.ts              # §91a2: THE CHIP RULE's arithmetic, pure + injectable — rulesForTurn(reason) (the set {chipMode} ∪ {capPenalty on 'cap'}) · turnCharges (survivors: each pool pays the OPPOSING standing power; casualties: its OWN fallen; uncapped × chipMultiplier) · 91d playerExposure (the pre-turn risk bound) · 96.5c2 enemyExposure (its mirror — the two partition the fielded power under either rule; the live bar's notch on each gauge, via Run.previewPoolsAtRisk); 96.5b1: THE LOSS-EVENT MODEL the live bar consumes — lossEventsForDeath (casualties: one immediate event at the death, the dead unit's side pays, cause = the unit) · lossEventsAtEnd (survivors: one 'end' event per standing unit to the OPPOSING pool; the cap surcharge's casualties rule over a survivors mode as team-cause events off the fallen totals) · bookedImmediateLoss (the mid-battle restore's opening ghost) · sumLossEvents; pinned: Σ stream = turnCharges under every rule pair × reason (chipLabels.ts owns the words)
    fallenStats.ts           # 102c: the run-end stats fold — summarizeFallen(ledger), PURE over FallenRecord[] (no Run, no bus, no config): the run totals, then one entry per encounter INSTANCE (sector + node, fought order), each per side / per archetype (first-death order) / per turn (ascending); every `rows` is a filtered view in death order (the GameOverScreen's glyph runs read it). The ledger is DEATHS only: a bloodless fight or turn left no row and has no entry
    RunConfig.ts             # G1: RunConfig + parseRunConfigFromURL (shared by browser/CLI/GUI); L1: daemon override (?daemon=<id|none>); 47e: starting-bits override (?bits=N); 48f: bitsMultiplier (programmatic-only, the X1 siblings' third axis); 68e/74b: ?firstNode=elite|event (the root stamp dial); 74b: forcedEventId + eventCatalog (programmatic-only — a bespoke catalog is in-memory, saves hard-reject); 74e: eventChance (the scatter dial, #121 slice)
    enemyBudget.ts           # G4 SEAM playerTeamLevel — H5 swapped it to avgLevel × min(roster, handSize)
                             # + affine budget + swarm count (K2: count basis ALSO min(roster, handSize))
    encounters/
      wave.ts                # U1: pure resolveWave(spec, ctx, rng) → UnitTemplate[] — budget/count/weight;
                             # optional per-wave levelCap (X: roster+Δ | fixed | absent=uncapped, resolved vs roster);
                             # distributeWeightedLevels generalizes distributeBudget (uniform weights → even split)
      sequencer.ts           # U2: pure waveForTurn(list, cursor, state, rng) — the wave-list GRAMMAR
                             # (wave | pick | loop{N|forever} | stages{until: enemyPoolAtOrBelow}) + a
                             # recursive plain-JSON cursor (resumable); terminal policy = last-wave-repeats
      selection.ts           # V1: selectEncounter(sector, ctx, rng, resolve) — the keyed (encounterFirst|
                             # layoutFirst) resolver picking an (encounter, layout) from the sector pools +
                             # assertSelectionCoverage boot guard (Brigands now authored in encounters.json)
    Command.ts               # RunCommand union + RunDispatcher interface (A2)
    NodeMap.ts               # the BRAID generator (77e — lanes as the primitive; replaced the G2 staircase): widths → split/merge ops (churn + rare 3-ops; seam rule holds instant-d2 rejoins ≤25%/map) → the quota kind layer (route-share targets; port cones = every first choice keeps shop access by h5; battle floor ≥1/hop; path-window spacing) — three keyed sub-streams + bounded attempt re-rolls; gates: tests/nodemap-metrics.test.ts (n=500, the signed 77c sheet). T2: per-sector length override; 74e: stampRootKind (pure post-gen transform, boss-wins on hopCount 1)
    sectorWalk.ts            # T2: pure RNG walk over the sector-DAG (pickStartSector/pickNextSector/isSectorSink); zero-draw singleton picks
    Recruitment.ts           # rollOffer (61c: per-slot tier-roll + weighted within-tier pick, 2 draws/slot,
                             # dupes legal; 63b/c: character pools + weight overrides; 64b: folded tier
                             # weights param; 64c: per-slot forcedTiers, empty-pool degrade) + per-card
                             # level (post-G5) + draftPoolsFor + recruitLevelBonus
    rewards.ts               # 48b: rollRewards — the pure reward roller (chance tests + weighted sampling w/ owned-daemon
                             # exclusion; bits {min,max} on the separate bits stream) + RewardPortion (49c: + the packet
                             # member — packets sample with NO exclusion, duplicates legal; a full cache resolves at ACCEPT;
                             # 74c: + unit — template PRE-ROLLED at offer time on the bits stream, port-stock shape — and
                             # poolHealth members, both exclusion-free)

  render/
    Renderer.ts              # WebGLRenderer + two EffectComposers (selective bloom, B1.1); the D4 camera modes fit ↔ scroll — 100a: `toggleCameraMode()` is the ONE entry (the Ctrl+Alt+C dev chord's; the Backquote keydown is gone) and the pan-key + edge-scroll listeners attach only under `import.meta.env.DEV` (the shipped bundle carries no camera keydown; gotchas #52/#54)
                             # + RAF loop + two camera modes (fit / scroll, D4). 105d: the camera's VIEW (projection · FOV · pitch · yaw) is state — BOTH a perspective and an orthographic camera stay alive and `camera` is a GETTER over the active one (read it per use; the two RenderPasses are re-pointed on a swap, `UnitOverlayLayer` takes a getter, 107a; the starting camera is picked from the view). `setCameraView` has ONE caller, the dev-only board explorer: players get `DEFAULT_CAMERA_VIEW` (orthographic · pitch 45 · yaw 45 since 107d)
    cameraFit.ts             # 105d: THE fit, pure (three.js as types only) — `fitCameraToBox(view, aspect, hx, hy, hz, margin)`: a basis-projection loop over the box's 8 corners, one function for fit + scroll mode and for both projections (an ortho branch: half-height instead of distance, plus the stand-off that keeps the near ground in front of the camera plane), and `applyCameraFit`, the one place a fit becomes a camera. Replaced `Renderer.computeCameraDistance` (no yaw, no ortho). 107c: `panToWorld`, the dev scroll pan turned by the yaw. cameraFit.test.ts = THE FIT ORACLE: bit-identical to the frozen pre-105d function at its view (perspective 50 · 45 · 0, the default until 107d) across boxes × aspects + failing controls + a fill-the-frame property read through three's own projection over the whole cross; tests/board/cameraFit.test.ts pins it to the 105a instrument's independent fit (same world point ⇒ same NDC)
                             # J3: pickCell (terrain raycast → grid cell) + pickInstance (billboard hit-test)
                             # §Z: shakeCamera(intensity,dur) — transient screen-aligned jitter applied/cleared around render
    groundMarks.ts           # 108a: the ground marks' table, THREE-free (spec D3) — `MarkTable`: one frame's marks (a combatant's side shape: circle yours · diamond enemy · triangle camp; a plate under scenery, dashed for a destructible wall or cover) packed into two RGBA32F arrays for the terrain shader, and binned per tile (plates first, `BIN_DEPTH` 16, a contact mark by its circumscribed circle + `BIN_MARGIN`, overflow counted, `maxBin` the peak); `DEFAULT_MARK_STYLE` = the signed §106 bookmark's numbers (+ 108b's `plateDashGap`). groundMarks.test.ts pins the bins against shapes re-derived by sampling
    slabAnchor.ts            # 107b: the N×N slab rule, pure (three.js as math) — `slabAnchor`: the footprint centre at its highest tile top, slid along the view ray until nearer than its own terrain and hill mounds (`HILL_MOUND_ENVELOPE`, TerrainRenderer); `BattleRenderer.unitAnchorPos`'s N×N branch. Pinned by tests/board/slab.test.ts through the 106a instrument's measures
    SpriteRenderer.ts        # InstancedBufferGeometry + dual mesh (layer 0 visible / layer 1
                             # bloom) + per-instance bloomIntensity attr (B1.1) + per-instance
                             # size attr (E6.B). Also hosts transient tracer/projectile sprites
                             # 108b: getAlpha — a body's ground mark reads it, so the mark fades with its glyph
    UnitOverlayLayer.ts      # E3.6: DOM per-unit overlays (HP bar + action progress + level
                             # badge), positioned via projectToCss. E6.C: spawnHitsplat floats
                             # transient damage/crit/heal/burn numbers via the same projector
                             # §32c: updateStatuses reconciles the status pip-strip (above the HP bar) — one depleting pip per active status (width=duration, opacity=stacks)
    TerrainRenderer.ts       # C1c: faceted low-poly prism-per-tile, heightAt is canonical; 98e: `animTypeFor(kind)` the ONE kind → `aAnim.x` branch map (fire 1 · healing 2 · DEEP WATER 3 — static diagonal bands in terrain.frag + apron.frag, the passable / impassable tell beside the hue; `DEEP_DRIFT` 0.0 = the §99 seam), pinned in TerrainRenderer.test.ts
                             # for sprite Y. D7.C: per-tile flicker/pulse + chasm sink + theme
                             # 108b: DRAWS THE GROUND MARKS (spec D3) — `groundMarkShaders()` splices shaders/terrainMarks.glsl into its shader pair (marks off = the two files, byte for byte); the MarkTable's two DataTextures ride uniforms SHARED with the mounds' material (a clone copies uniforms); `beginMarks` / `addMark` each frame, binned + uploaded at the first terrain draw (`onBeforeRender`); `setMarkStyle`, `setGroundMarks`, `markStats`
    ApronRenderer.ts         # M4: backdrop apron — non-playable fog-faded prism ring around the
                             # board (clamp-to-edge tile sampling; render-only, sim never sees it).
                             # APRON_TILES is the width knob; setDither flips smooth (default) vs
                             # stipple; near-black edge band outlines the playable boundary
    BackdropRenderer.ts      # M4: the mist floor — large noise-shaded plane at BOTTOM_Y the apron
                             # dissolves into (shared fogColorAt in shaders/fogcolor.glsl, TS-concat
                             # prepended to both frags); calms to flat background with distance
    BattleRenderer.ts        # Sim/render seam: subscribes to unit:* + action:phase (F3)
                             # tileWorldPos(coord) for per-tile sprite Y (C1c). E6/E7: melee shove,
                             # ranged/lobbed projectiles, explosion/dud/heal-sparkle VFX + hitsplats
                             # §Z: the FX driver (holds Renderer + AudioPlayer) — onActionPhase resolves def.fx via fxRegistry → projectile/burst/sound/shake/shove/tracer
                             # §76g2–g4: the aura-range FX (boundary-mote ring + radiating square wavefront, statusColor-tinted, sprite-anchored; carriers derived per shed from unit.abilities[].aura) + the __auraFx dev switch (track/fill/fixed — TODO: wider jury / possible graphics setting)
                             # Z3: the melee shove + bow tracer + their whoosh ride action:phase (fire on hit AND miss); unit:attacked/missed keep only the hitsplat+HP
                             # 27e/28: status-fx driver — status:ticked → tick cue; 28: status:applied/expired hold the `active` body-tint overlay (statusOverlays, restore team color on expiry)
                             # J3: objective X marker (objective:set/cleared; camera-up lift) + enemyBillboards (pick candidates)
                             # 108b: the ground marks' feed — `markSpecs` (each body's mark fixed at spawn: shape, colour, an N×N footprint centre), `updateGroundMarks` after the lerps: one mark per sprite in `handles`, the dying at their fading alpha
    fxRegistry.ts            # §Z: pure-data FxKey→FxDescriptor map (sound/projectile/burst/shake/shove/tracer; 27e sparkle/hitsplat; 28 overlay) + assertFxKeysResolve / assertStatusFxKeysResolve boot checks (headless-testable); 98d: ONE `HitsplatKind` union (normal / crit / miss + burn / bleed / poison / heal — the three DoTs were one `burn` kind until 98d), `HITSPLAT_PREFIX` (`~` / `‡` / `☠` / `+`, exhaustive by type) + the pure `hitsplatText(kind, amount)`, `isDotHitsplatKind` (the overlay draws a DoT number in `statusColor(kind)` — the kind IS the status id, one table for pip / swatch / number); fxRegistry.test.ts pins the DoT kinds distinct off the status catalog; 99c: `fxDescriptor(key, reduced)` — the ONE choke point strips `REDUCED_MOTION_STRIPS` (`shake` · `burst` · `sparkle`) via the pure `stripMotion` copy when the caller passes the motion gate's answer (BattleRenderer's four sites pass `reducedMotion()`); the informational channels (sound · hitsplat · overlay · projectile · tracer · shove) ride through — pinned over every key under both readings
    statusDisplay.ts         # §32c: render-side status→display-color map (presentation only; behavior statuses reuse their 28c tints, DoTs get distinct hues) — the palette half of readUnitStatuses; 78d: + EMPOWER_DISPLAY/empowerColor (the empower-buff key→color sibling; membership = the HUD marker-eligibility set; both tables coverage-pinned in statusDisplay.test.ts); 95f: each empower row also carries its LABEL from the UI string table (`buff.<key>`) — empowerLabel(key), the pin covers labels too; the Mars key is `honed` (was `empowered`)
    pick.ts                  # J3: pickInstanceAtNdc — pure screen-space billboard hit-test (replicates billboard.vert.glsl)
    FontAtlas.ts             # canvas2d glyph atlas → THREE.CanvasTexture (glyph set from glyphs.ts); 101a: draws + `fonts.load`s through FONT_STACK (both shipped faces), the DEV assert reads "came from a shipped face"; measures each cell's raw ink rect, which the click boxes (`getPaddedGlyphInk`) and the three lifts (`inkBottomLift` · `inkCenterLift` · `inkTopLift`) read
    fontSubset.ts            # §79-post: SUBSET_RANGES + subsetCovers (the shipped codepoint blocks, shared by gen:font + tests/font-coverage.test.ts); 101a: FACES (JetBrains Mono the primary · DejaVu Sans Mono the ONE fallback, keeping only what the primary lacks — assets/fonts/<dir>/ + README each) + FONT_STACK (the CSS/canvas font chain; ui.css --font-mono mirrors it); the test's third pin walks src/ + locales/ + config/ for every non-ASCII codepoint and requires it shipped
    glyphs.ts                # E7.A: THREE-free GLYPHS set (unit glyphs derived from the catalog + `NON_UNIT_GLYPHS`, within `ATLAS_CELL_BUDGET` 48; FontAtlas.test asserts archetype coverage; J3: 'X' = objective marker) + the ink chain (`inkRectFromRgba` · `padInk`) + `BASE_ANCHOR_Y` (every base sprite stands on its quad bottom) and `liftToCellY` (the lifts to an ink edge)
    PostProcess.ts           # SatClamp + Bloom + BloomMix factories (B1.1)
                             # Scanlines retained as dormant code; CRT lines now run via CSS (B5)
    shaders/                 # .glsl source files loaded via Vite ?raw imports (A4). billboard.vert.glsl: 107d-post UPRIGHT DEPTH, a base-anchored sprite takes the depth of a vertical card through its anchor, its screen position untouched (gotcha #139; pinned by tests/board/clip.test.ts). terrainMarks.glsl: 108b, the ground marks as shapes, evaluated by world XZ wherever terrain draws (tops, step faces, mounds), anti-aliased from derivatives taken once in uniform control flow; spliced into terrain.frag only while the marks are on
    palette.ts               # COLORS table — TERMINAL_STONE added for neutrals (C1a)
    motion.ts                # 99a: THE MOTION GATE — `reducedMotion()` = override ?? the OS `prefers-reduced-motion` query (the pure `resolveReducedMotion` pinned in motion.test.ts); `installMotionGate()` (main.ts, before the Game) stamps `html[data-motion="reduced"]` and follows the query's `change`; `setReducedMotionOverride` is Round 8's setting seam, `cycleReducedMotionOverride` the Ctrl+Alt+A dev read. ONE source for the CSS (99b keys off the attribute — no `@media` block, which a setting can't flip) and the JS (HUD's orb flight + end stagger, lossFx.shakeView, the tooltip's rise; 99c's fxDescriptor filter takes its answer as an argument). Lives in render because render never imports ui
    animation/
      SpriteAnimator.ts      # Lerps + fades (fromAlpha/toAlpha for D5.C) + E6.A shove channel; §81c2 startGroundLerp (climb-early/descend-late Y for ground relocations — kills the low→high terrain clip)
                             # + onComplete/arcHeight/targetProvider on lerp (E6.B/E7.D/F3)

  scenes/                    # A5: Scene system — single-active swap driven from Game
    Scene.ts                 #   Scene interface + SceneContext bundle (+ I3 playback, J3 keybindings, M4 apron)
    BattleScene.ts           #   World + Clock + BattleRenderer + HUD (its per-battle audio closures retired at §104 — audio/eventSounds.ts); 99d: `advanceShaderTime(dt)` — the ONE site the terrain / apron / backdrop `uTime`s advance (both the countdown and the running branch), fed 0 under `reducedMotion()` so every shader motion holds at once
                             #   I3/Q1: tick() scales dt by playback.current (fast-forward batches ticks; pause = 0 parks the sim)
                             #   Q2: opens with a PreBattleCountdown (sim parked, board shown) — playback.pause()'d; unpause = Fight now
                             #   J3: owns the ObjectiveController (canvas input + enemy-billboard provider)
    PreBattleCountdown.ts    #   Q2: the pre-battle countdown timer (real-dt; active/displaySeconds/advance/skip) — unit-testable
    MapScene.ts              #   DOM-only, wraps MapScreen
    RecruitScene.ts          #   DOM-only, wraps RecruitScreen
    RewardScene.ts           #   48c: DOM-only, wraps RewardScreen (no payload — the screen reads the live offer off ctx.run)
    PortScene.ts             #   50e: DOM-only, wraps PortScreen (RewardScene's shape — no payload, reads the live run.portStock); swapped in off port:entered
    EventScene.ts            #   74f: DOM-only, wraps EventScreen (the PortScene shape — no payload, reads the live active page); swapped in off event:entered; exits via the silent-transition catcher (return-to-map) or battle:started (start-encounter)
    PromotionScene.ts        #   E4.4: DOM-only level-up summary; M1: pops at each turn boundary (mid-encounter, or before recruit on the final turn); 48b: the reward gate interposes BEFORE it on a won final turn
    PreTurnScene.ts          #   H4b: DOM-only, wraps PreTurnScreen (the turn-intro gate)
    GameOverScene.ts         #   DOM-only, wraps GameOverScreen
    SectorClearedScene.ts    #   67b: DOM-only, wraps SectorClearedScreen — titles fixed at construction from the sector:cleared payload (the cleared sector is unnameable from Run getters by then)
    CharacterSelectScene.ts  #   63e: DOM-only, wraps CharacterSelectScreen — the ONE scene that mounts with ctx.run === null (the choice precedes Run construction); every other scene asserts via requireRun(ctx)

  ui/
    ui.css                   # 96a: `:root` holds the `--color-*` tokens — the palette thirteen mirror COLORS (src/render/palette.ts, the source of truth; tests/ui-tokens.test.ts pins them equal) + role names + the grays by level; zero raw hexes below :root, palette tints via relative color syntax `rgb(from var(--color-x) r g b / a)`; a Round 8 palette swap sets the tokens at runtime over the defaults. 96b: the 20 `--text-<px>` tokens in rem (exact 1:1 with the old px ladder; every `font-size` below :root is a token — a Round 8 text-scale setting sets the html font-size and the ladder follows). 99b: the §99 REDUCED-MOTION block at the END of the sheet, keyed off `:root[data-motion='reduced']` (the attribute src/render/motion.ts stamps — no `@media`): every `animation:` has its reduced form there (`-still` keyframes that only fade for the two something waits on — the hitsplat + the pre-turn exit ghost, same duration; `none` for the pops + the two infinite pulses; colour-only flashes for the chips); tests/ui-motion.test.ts pins it. 100b: THE FOCUS RING — every `X:hover` rule carries `X:focus-visible` in its selector list (the focus state IS the hover state) + ONE zero-specificity ring rule `:where(button, select, [role='button'], [tabindex='0']):focus-visible` (2px solid white, offset 2px; placed before the §99 block) + `.map-node:focus-visible` on box-shadow (98c owns the node's outline); `outline: none` only on the three CONTAINERS (the two 96f modals + `.screen-fade:focus`, 100e); tests/ui-focus.test.ts pins all four
    fade.ts                  # fadeIn / fadeOutAndRemove — shared screen transitions (96c: consumed by Screen.ts + the HUD's panes only)
    modal.ts                 # 96f: THE MODAL SHELL — `openModal(mount, {variant, title, panelClass, closeText, onCloseClick, onClose})` → a handle (content · setTitle · setDismissable · replaceBody · close); two variants reproducing the consumers' DOM exactly (`panel` = .roster-overlay › .roster-modal › header + ✕; `viewport` = .sector-map-overlay + the pinned ✕); ONE `dismissable` flag gates Esc + backdrop + ✕ together (the cache's forced-keep flow hides the ✕); `onClose` fires exactly once from any route (all consumer teardown lives there); the focus discipline is the NEW behavior — the container takes focus on open (tabindex=-1), Tab/Shift+Tab cycle inside, focus returns to the opener on close; role=dialog + aria-modal + aria-labelledby; sounds stay the consumer's (onCloseClick = the ✕ only). Consumers: CardListModal (R1/R2 + the 51c picker) · the cache modal (CacheOverlay) · the sector-map overlay
    chip.ts                  # 96e: THE CHIP BASE + THE CHROME COLUMN — `chipPulse(el)` (the one 450 ms `.is-pulsing` flash; was copy-pasted in three chips) + `createChromeColumn(mount)` (the Game-owned fixed flex column the four page-lifetime chips mount INTO — `.chip` is the shared plate in ui.css, each chip's class adds its layout/accent and a CSS `order` (bits · cache · map · pool) independent of construction order; a hidden chip COLLAPSES, the ones below move up — §96 decision D; the column passes pointer events through via `#ui > .chrome-column`, the chips take them); a chip's modal / overlay mounts on the PAGE (the column's z-index is a stacking context that would trap it)
    tooltip.ts               # 97a: THE TOOLTIP — `attachTooltip(el, content, {touch})` registers a trigger (content a string or a lazy getter → string | Node, read at every open; returns the detach); `installTooltipHost(mount)` mounts the ONE `.tooltip` (Game, beside the chrome column; role=tooltip, `aria-describedby` on the trigger while open); routes = hover (HOVER_DELAY_MS, none inside WARM_MS of a close) · focus when :focus-visible · `touch: 'tap'` (a tap toggles — text sites) | `'press'` (a PRESS_MS long-press opens pinned and swallows the trailing click — controls, and text nested in them) | `'none'` (the enemy card, whose contextmenu is the focus objective) · `toggleTooltipKey()` (97b: the `showTooltip` registry action, default Slash — pin / unpin / open pinned on the focused else hovered trigger); closes on Esc (a window CAPTURE listener, so the first Esc takes the tooltip and the next the modal), pointer-leave unless pinned, blur, an outside pointerdown, a disconnected or 0×0 trigger (a rAF poll while open, which also follows a moved trigger); `placeTooltip` is pure (above → flipped below → the roomier side; x clamped with the caret kept on the trigger — pinned in tooltip.test.ts); `keyedTooltip(text, key)` → `text [key]` with the amber `.tooltip__kbd`; `refreshTooltip(el)` re-reads an open one. The plate + `[data-tooltip-touch]` touch-action rules in ui.css; tests/ui-tooltips.test.ts pins zero native `title=` in src/ui + src/render
    button.ts                # 96d: THE BUTTON FACTORY — `button(label, {className, onClick, tooltip?})` (97d: `tooltip?` attaches the §97 tooltip with `touch: 'press'`) mints every `<button>` (type · class · label · click; the audio cue stays in the caller); `.btn--primary` in ui.css is the ONE primary-action look, with three look modifiers naming a deliberate per-site delta (`btn--dim` the recruit pass · `btn--exit` game over + sector cleared · `btn--corner` the port leave); a site's position stays on its own class (.preturn-continue, .port-leave); the nine primary sites + the port/reward action buttons + the character card ride it, the labels through the string table; the HUD / cache / card-list / sector-map / pre-turn chip buttons are their own phases' (touch-once)
    pressable.ts             # 100c1: THE PRESSABLE HELPER — `pressable(el, {pressed?})` gives a control that cannot be a `<button>` (the cards: interactive children — the 97d chips, the stat rows' tooltip sites — are invalid inside one) the button contract: role=button + a tab stop + Enter → `el.click()` now, Space → `el.click()` DEFERRED past the dispatch (`setTimeout 0`, never a microtask) and only if the Keybindings sink on window left the event unprevented (THE SPACE RULE: hotkeys WIN over a focused control in battle — gotcha #135); target-gated (a chip inside a card never fires the card); `pressed` = a toggle's initial aria-pressed (the site flips it beside is-selected); `pressableActivation(key, repeat)` is the pure rule, pinned with its premise derived from config/keybindings.json (Enter unbound, Space bound). Consumers: the hand cards (100c2, a toggle) · the recruit cards · the picker cards (a toggle) · the enemy compact cards
    reserveSlot.ts           # 101e: THE RESERVATION IDIOM — `reserveSlot(el)` = `.is-reserved` (visibility: hidden) + aria-hidden: a block that toggles ABOVE a click target keeps its layout slot, carrying its REAL content so the slot is sized by construction (the sibling rule lives in ui.css: a state badge WEARS the box of the button it replaces — `.reward-taken`, `.port-sold`). Consumers: PreTurnScreen (the arm hint + the emptied packet row) · CacheOverlay (the shrink banner) · EventScreen (the non-current pages of both `.event-stack` cells) · modal.ts toggles the class on the ✕ itself, and its focus trap skips `.is-reserved`
    Screen.ts                # 96c: the abstract Screen base — `protected container` + `present(el)` (mount + fade in) + `hide()` (fade out + remove); the eleven full-viewport screens extend it, each keeping its own show(...) signature with an EXPLICIT leading this.hide() (present never hides implicitly — PreTurnScreen seeds state between the two), overriding hide() only for its own teardown + super.hide(); the HUD (seven panes) and the modals are NOT Screens; 100e: `present` focuses the root (tabindex=-1, preventScroll; `.screen-fade:focus` is outline-free) so the next Tab enters THIS screen's controls
    HUD.ts                   # In-battle HUD: the hop·turn chip (top-left) + location banner (top-center) + the four card/control panes below. unit:* events drive the card panes (addCard/refreshHp/removeUnit over one cards map); §32c refreshStatuses (BattleScene-driven, per-tick gated) updates each compact card's status row; 96.5b1/b2 THE LIVE BAR — the two pool gauges are createPoolGauge handles; every loss event (unit:died → lossEventsForDeath; battle:ended → lossEventsAtEnd off world.survivorsByUnit + the payload's fallenPower) is DELIVERED as a lossFx orb from its cause's card to the paying gauge, and the ghost grows + the gauge pulses + the view shakes (by policy) ON THE LANDING (a team cause / no card / reduced motion lands at once); the end events launch at SURVIVOR_STAGGER_MS, then every orb in flight lands, the SETTLE_MS beat, the ghost COMMITS, and lossesSettled() resolves — BattleScene.outro() hands it to Game, whose outro = max(TURN_OUTRO_MS, that); show() opens the ghost at bookedImmediateLoss(world.fallenPowerSoFar()) for a mid-battle restore and sets each gauge's NOTCH (96.5c/c2: the pre-turn bound + its enemy mirror from Run.previewPoolsAtRisk — a breathing 2 px cut in the fill at pool − bound, cleared at the commit); dispose cancels orbs in flight; 100c2: the enemy compact cards are `pressable()` (role=button + Enter; Space defers to the pause hotkey) and their click HONOURS an armed pick (`this.armedMode ?? 'engage'` — the latent 78b miss: arm Focus, then click / tap / Enter the card = the focus objective's keyboard AND touch route; right-click stays the mouse's shortcut), a dead card leaves the Tab order (aria-disabled + tabIndex −1)
                             # Q1: speed-command pane (top-right): per-speed buttons 0.5/1/2/3 + pause toggle (hotkeyed via Keybindings)
                             # Q2: pre-battle countdown readout (show/hideCountdown) + Fight-now button (the pause toggle reads "Fight now" while held); positionCountdown() drops it below the enemy pane when the cards wrap
                             # Q3: objective-command pane (bottom-right): Engage/Focus/Hold/Stop on O's typed model (per-type arming; 78a fast paths: left-click quick-Engage / right-click quick-Focus)
                             # Q4: player unit pane (bottom-center): wrapping compact UnitCards (live HP on attacked/burned/healed, grayed on death) + the relocated run pool gauge
                             # Q5: enemy unit pane (top-center, below banner): enemy pool gauge above an analogous red-teamed compact-card grid (max-height+scroll caps a large swarm); 78b: enemy cards are objective click targets (left=engage / right=focus via ObjectiveControls.setOn; dead cards inert; player cards deliberately not clickable)
                             # Q6: dismantled the old monolithic side panel — both team rosters + per-unit stat lines + inline You/Foe pools all removed (HP/pools now live in the Q4/Q5 panes); the hop label relocated to the standalone top-left chip + folds in the per-turn counter
    PlaybackSpeed.ts         # I3/Q1: page-lifetime speed+pause model (current/selectedSpeed/setSpeed/togglePause/steps); current=0 while paused; hotkeys via Keybindings
    Keybindings.ts           # J3: runtime-rebindable hotkey registry (codeFor/actionFor/rebind/on + DOM-free handleKeyDown)
    ObjectiveController.ts   # J3/Q3: battle-scoped objective input — 78a left-click quick-Engage / right-click quick-Focus / arm(engage|focus)-then-click / hold / stop / setOn (78b: direct known-target set, the HUD enemy-card path) → World commands
    MapScreen.ts             # full-viewport node map (G2) + kind icons (G3); frontier click → enterNode; R1: top-right roster CardListButton; 78e: {readOnly} renders the same view with no dispatch + no roster button (the overlay's glance mode); 98c: node STATE is a SHAPE beside its hue (filled disc / double ring / dashed / dotted — ui.css, layout-free) + `buildMapLegend` (fixed bottom-left; KIND_LABEL / STATE_LABEL Records over literal `map.legend.*` keys; the swatches share the board's selectors so the key can never drift), carried by the read-only overlay too; 100c1: every node is a real `<button type=button>` (`.map-node` pins padding 0 + content-box) — an inert node (current / visited / locked, or all under readOnly) is `aria-disabled` + tabIndex −1, never `disabled` (a disabled button swallows the hover the boss node's 97f tooltip needs); the ring rides box-shadow (98c owns the outline)
    PreTurnScreen.ts         # 96.5d: + THE "LAST TURN" STRIP under the gauges from turn 2 (the post-turn screen's replacement: the skirmish result + each side's fallen as a glyph run with its loss, off the buffered turn:resolved; the loss hover = the rule wording via chipLineLabels); 96.5c: the risk line held + repainted from turn:handRedrawn / run:packetUsed through t('preturn.risk'); H4b: turn N + pools + the drawn hand (H5b; P3: shared full UnitCard — all stats + abilities + XP bar, screen scrolls); ▲ badge rides the card; K3.5 map label; L1 idol banner; R1/R2: roster (top-right) + draw/discard pile (bottom corners) CardListButtons; 49f: THE GUIDED FIRE STRIP (one chip per grant-queue entry in acquisition order; active auto-arms — empower fires on card click, redraw multi-selects + confirms ON the chip; Pass ▸ = passGrant; queued dim / spent fade / passed struck) + the at-will PACKET chip row (live cache thunk; target-none fires on click, hype arms pick-a-card) — refreshes off turn:handRedrawn/unitEmpowered/grantPassed + run:packetUsed/cacheChanged; 100c2: the hand cards are `pressable()` toggles while selectable (aria-pressed from the selection at each re-render)
    RecruitScreen.ts         # recruit offer cards (P1: shared UnitCard, recruit skin; 100c2: `pressable()`) → dispatch chooseRecruit; R1: top-right roster CardListButton
    CardListModal.ts         # R1/R2: shared card-list modal (CardListModal overlay + CardListButton) — full UnitCards in a dimmed, scrollable overlay (Esc/backdrop/✕ dismiss); R1 roster view (top-right, Map/Recruit/PreTurn) + R2 draw/discard pile views (PreTurn bottom corners); 100c2: the picker cards are `pressable()` toggles (toggleSelection flips aria-pressed beside is-selected; the 96f trap's FOCUSABLE selector already admits `[tabindex]`)
    rosterOrder.ts           # R1: pure card-ordering seam (orderRoster: recruited[default]/archetype/level, stable on recruitment order) — only recruited wired to the UI, others switchable
    PromotionScreen.ts       # E4.4: per-unit level-up cards (P1: shared UnitCard, promotion skin); M2: two-phase reveal (all cards pop in, then gains tick green card-by-card + +N chip; click-anywhere skips) — the screen owns the timeline, driving the card via UnitCard's levelValue/statRows handles; §76g: + the derived-delta block as the final beat (space reserved from card-land — visibility-gated, no layout shift)
    promotionDelta.ts        # §76g: pure promotionDeltaParts(old, new, archetype) — one "before → after" line per derived value that VISIBLY changed (Max HP / dodge / move cadence / per-ability via a positional abilityDetailParts diff); formatted-string compare = display-grade only; headless-tested
    RewardScreen.ts          # 48c: the reward offer — one row per portion, Accept (pickup blip) / Decline per row; bits rows render run.effectiveBits (the settle math, never the base) and re-derive after every resolution; 49c: packet rows (▤ + def-resolved name/description) + a live `▤ cache n/size` line while a packet portion pends + the full-cache SWAP picker (a select over held slots replacing Accept)
    PortScreen.ts            # 50e: the docked-port screen — five sections in one scroll (Units-for-hire on recruit-skin UnitCards with price footers / Packets / Daemons / Sell-packets / Crew-removal) + a viewport-PINNED Leave; full re-render after every own dispatch + off run:bitsChanged/cacheChanged (the cache modal stays usable while docked); prices render the serialized slot price / the shared book helpers (display honesty); unaffordable = disabled, sold = SOLD badge (50d flag-not-splice), removal disabled at last-unit
    EventScreen.ts           # 74f: the event page — name heading, page text, one button per choice (the PortScreen live-Run + full-re-render discipline, off event:pageChanged); conditioned choices list their requirement via describeEventCondition (src/ui/eventConditionText.ts since 100e) — failing ones SHOWN-DISABLED (the §74 shape-lock), met ones keep the line dimmed; chrome keyed to TERMINAL_BLUE (the ?-node accent)
    eventConditionText.ts    # 100e: `describeEventCondition(cond)` — the 74f requirement PHRASES as a `t()` per condition kind (`event.cond.*`, the `not` combinator through `event.cond.not`), moved out of src/config/events.ts so the config module carries no player-facing prose; the EventScreen and the 74h event editor (tools/event-editor) both read it — the same copy in both places
    BitsOverlay.ts           # 48d: the persistent top-left bits chip — the FIRST page-lifetime UI element (Game-owned, survives scene swaps); paints from run.bits + run:bitsChanged, hides at game-over, re-shows on run:started
    CacheOverlay.ts          # 49f: the persistent cache chip (▤ n/6, stacked below the bits chip) + the open-anywhere cache modal — the SECOND page-lifetime element (the gotcha #116 lifecycle verbatim); Discard always, Fire by the phase-derived context (mirrors the 49e engine derivation), overclock's inline roster picker, the forced-keep shrink flow (overflow force-opens discard-only, un-dismissable until resolved); 100c1: the chip is a `<button type=button class="chip">` (its sibling the map chip always was)
    SectorMapOverlay.ts      # 78e: the sector-map chip (⊞ map, third in the chrome column) + the read-only MapScreen overlay — the THIRD page-lifetime element; toggleSectorMap (`M`) subscribes at the GAME layer (the first page-lifetime keybind consumer); scene-derived availability pushed from Game.swap (hidden on MapScene / pre-run / game-over)
    poolGauge.ts             # H4b: the labeled pool gauge (name + `current / max` over a proportional bar) shared by the pre/post-turn screens + the HUD; 96.5b1: createPoolGauge → a live handle (set · setPending · commit) with THE GHOST — a hatched segment over the fill's leading edge for the loss the rule has made a fact of but Run has not booked (the readout `33 (−7) / 40`, pending clamped at the pool via poolValueParts); renderPoolGauge = the one-shot form the turn screens keep (a 0 ghost renders the H4b gauge exactly)
    lossFx.ts                # 96.5b2: THE ORB + THE SHAKE — flyOrb(mount, from, to, side, amount, max) → an OrbHandle (a `●` in the paying side's hue with a glow, sized by amount/max, flown card → gauge on a quadratic arc by the Web Animations API; `done` resolves on landing OR cancel, never rejects; a wall-clock BACKSTOP lands a stalled orb at ORB_FLIGHT_MS + grace — a throttled tab / a frozen pane must never strand Game's outro); shakeView(amount, max) jitters the canvas + #ui together (the scanlines glass stays still) above SHAKE_MIN_FRACTION of the max, SHAKE_MIN_PX → SHAKE_MAX_PX; THE SHAKE POLICY seam (player | enemy | both | none — `player` ships; the user's A/B hypothesis is `enemy`; Ctrl+Alt+K cycles it, src/dev/devKeys.ts); under the motion gate (src/render/motion.ts, 99a) no flight (HUD's check) and no shake (shakeView's own check — 99a's audit found the reduced branch still shaking). The pure parts (shakePx · orbSizePx · the policy) are pinned in lossFx.test.ts
    PoolOverlay.ts           # 94e: the persistent morale chip (fourth in the chrome column, display-only) — the FOURTH page-lifetime element; paints from the injected getter + run:poolChanged (pulse; .is-losing on a chip/damage, .is-low at ≤25 %); two hide flags under one class: run-hidden (pre-run / defeat / victory) and 96.5a scene-SUPPRESSED (pushed from Game.swap while a PreTurn / Battle scene is mounted — the full gauges are the one morale read there; the PostTurn entry left with the screen at 96.5d)
    GameOverScreen.ts        # defeat / complete variants → dispatch resetRun; 102d: THE RUN-END STATS BODY ("the fallen") — summarizeFallen(Run.fallenLedger) as the run totals + one row per encounter somebody fell in (where · name · yours · theirs), every cell GROUPED by archetype, the per-turn breakdown in the tooltip; the table scrolls inside its own box, the New Run button never moves
    SectorClearedScreen.ts   # 67b: the between-sector beat (gameover chrome, amber heading + green Next: line) → dispatch dismissSectorCleared
    CharacterSelectScreen.ts # 63e: the character-select cards (name/description/roster summary/idol per catalog entry) → dispatch chooseCharacter; the run's first screen unless ?character= pins
    statLabels.ts            # GP3: shared STAT_LABELS map (card + HUD + PromotionScreen)
    rarityDisplay.ts         # 98b: THE RARITY STARS — rarityStarParts / rarityStars (a fixed-width filled + hollow run, `★☆☆☆` common → `★★★★` legendary, length = RARITY_TIERS.length) + RARITY_LABEL (Record<UnitRarity, string>, one literal `rarity.<tier>` key each — a new tier fails tsc until it picks a label); the "never color alone" channel for rarity on every full-card header (UnitCard.buildRarityStars; the tier name a §97 tooltip on the run; the hue = the tier's §61e tint token in ui.css); pure, pinned against the tier order
    chipLabels.ts            # 91d: the chip rule's PLAYER-FACING words by rule set (post-turn chip lines / the risk-line title / the power tooltip) — pure, pinned headless; chipRule.ts owns the arithmetic
    fallenSide.ts            # 102d: ONE side's fallen as a cell (label · glyph run or "nobody fell" · the loss) — lifted from the pre-turn "last turn" strip when the GameOverScreen's run-end stats became its second consumer; the text helpers are pure + pinned headless: fallenGlyphRun / fallenLines (one per fallen — a single TURN fits) and archetypeGlyphRun / archetypeLines (grouped `M×5` — an encounter or a run does not); classes `.fallen-side*` / `.fallen-glyphs` / `.fallen-loss`
    UnitCard.ts              # P1: shared unit-card builder — one DOM/CSS source for recruit + promotion (+ P3 pre-turn, Q4/Q5 HUD player+enemy cards, R1/R2 card-list modal). compact/full modes × recruit/promotion/preturn/hud/roster skins; compact (Q4) = glyph + Lv(TL)/POW(TR) + glyph-width HP bar, via unitCardFromUnit adapter + the hpFill handle; Q5 team coloring via the `team` opt → unit-card--enemy (red glyph + HP, vs the green player default); carries the "card can't disagree with the unit" ability readings (was RecruitScreen); rarity-accent seam (unit-card--rarity-*, default common = today's look); §32c updateCardStatusRow reconciles the compact card's status row (a chip per active status: swatch + name + `×stacks · ±N/s · Ns`, the §31 scaled potency made literal); 78d updateCardEmpowerMarkers reconciles the empower-marker row below it (one ▲ chip per badge-eligible buff key, EMPOWER_DISPLAY-colored, hover = key + mods; buffKeyLabel/buffModsSummary shared with the pre-turn chips)

  audio/
    AudioPlayer.ts           # B6: 4-deep clone ring per sound; per-key volume + pitch jitter; + magicboom (E7.C); §32b: the status/afflicter/summon/catapult SoundKeys (8 generated by scripts/gen-sfx.mjs + the hand-made thud); 96.5b2-post: `moraleloss` (the user's hand-dropped chiptone placeholder, the live bar's landing cue) + the optional per-play SCALE `play(key, {gain, rate})` — gain × the table volume, rate × the jitter, both set on the node per play (lossFx.lossCue drives it); §104: `sectorwin` + `stattick` (gen-sfx recipes), `SOUND_SOURCES` exported for THE ASSET PIN (AudioPlayer.test.ts — every key has a non-empty file under public/, every file in public/audio/ is a key: `play` swallows a failed playback, so a missing sample is otherwise silent with no error)
    eventSounds.ts           # §104: THE EVENT-KEYED SOUND REGISTRY — `EVENT_SOUNDS` (event → SoundKey, optionally behind a NAMED predicate: `audibleDeath`, `positiveAmount`) + `SILENT_EVENTS` (every other event → its reason: `bookkeeping` · `fxChannel` · `uiChannel` · `candidate` — the last is the Round 11 feel sweep's worklist) + `attachEventSounds(bus, audio)`, the ONE generic subscriber (Game attaches it once, page-lifetime; `subscribe<K>` is generic over one key so a cue's predicate stays correlated with the bus payload). THE COVERAGE PIN, two layers — `GameEvents` has an index signature and no runtime keys, so: tsc via `GameEventKey` (the index signature stripped) + `SILENT_EVENTS`' annotation over the keys `EVENT_SOUNDS` lacks (missing / in-both / unknown each fail), and eventSounds.test.ts parsing the key set out of the events.ts SOURCE TEXT (a surface the registry does not consult). A new bus event fails `npm test` until it picks a table — a permanent gate. Two tables, two jobs: fxRegistry = what a MECHANIC sounds like; this = what a run-level MOMENT sounds like; UI interaction sounds (click · pickup · the promotion `stattick` · the HUD's scaled `moraleloss` landing) stay direct sites. Maps event → key ONLY — volume + jitter stay AudioPlayer's (plans/sound-registry.md)

locales/                     # §95a: the locale SIDECARS — one flat file per family per locale (address → entry). `en/` is a DERIVED extract of the inline English (`npm run i18n:extract`; tests/i18n-en-extract.test.ts pins it current); another locale is the translator's file, resolved at catalog load by src/i18n/locale.ts. 95e: a non-en entry is a plain string (UNSTAMPED) or `{ text, source, translator, reviewer }`; the pins fail a shipped `locales/<lang>/` on missing / orphan / unstamped / fuzzy, per family and for ui.json — `npm run i18n:review` writes the stamps
  en/ui.json                 #   95c: the UI string table — the SOURCE of the code-side English (67 keys at 96f — 45 at 95c, its commit said 49; 95f added the five `buff.<key>` labels + two pre-turn empower strings; 96d the eleven button labels/title that pass through the factory; 96f the four modal strings that pass through the shell. At 95c: stat labels · chip lines · pool names · game-over copy · HUD objective buttons · roster button · common Continue/Buy/Close · map.uncharted · three plural entries); NOT a derived extract — its pins are the key scan
  en/events.json             #   95a: 122 addresses (13 names · 44 page texts · 65 choice labels), catalog order
                             #   95b: + encounters / daemons / packets / characters / sectors / statuses / units / abilities / layouts .json — 133 more (19 · 22 · 16 · 6 · 2 · 10 · 23 · 24 · 11) = 255 in all; camps + the encounter/sector/layout descriptions are editor metadata, never rendered, NOT here

config/                      # A4: balance JSON source of truth (paired with src/config/*.ts)
  units.json                 # §38 UnitDef catalog (was archetypes.json) — per-unit-kind glyph + baseStats + growthRates + abilities/targeting (E1/E3/§38)
  abilities.json             # The AbilityDef catalog — one entry per combat verb (targeting / timeline / effect-ops / damage-heal profile). Y5e consolidated this (was abilityDefs.json) atop the retired legacy AbilityConfig json
  statuses.json              # 27a: the StatusDef catalog (burn/bleed/poison/rejuvenate) — empty until 27c authors content
  difficulty.json            # G4: enemy level-budget knobs + A/B/C presets
  recruitment.json           # starting team + offer size + startingLevel + recruitBonusChance
  leveling.json              # E4: xp curve + half-cover mult + restXp (G3) + xpPerHealing (F6)
  health.json                # H4: player/enemy health pools + maxTurns/maxTurnSeconds + chipMultiplier
  deck.json                  # H5: handSize (card-drawn hand; also the 2nd half of the playerTeamLevel seam)
                             # K3: redraw { enabled, redrawsPerTurn, maxCardsPerTurn } — the pre-turn redraw budget
                             # (L1: enabled ships FALSE — daemons own availability; the block stays as the type anchor)
                             # 49d/f: grantQueue { passIsFinal } — the strict acquisition-order dial (ships TRUE, the locked default; RunConfig.passIsFinal overrides for tests/fuzz)
  empower.json               # K4: empower { enabled, empowersPerTurn, buff } — the pre-turn unit buff (encounter-lived, via the K1 store)
                             # (L1: enabled ships FALSE — daemons carry their own buffs; the buff stays the K4-default shape)
  daemons.json               # L1→47c: the idol catalog, authored in the rule vocabulary — `rules: Rule[]`
                             # (modifier | hook; the shared daemon/packet effect pool; trigger×op×filter
                             # matrix parse-enforced). Mars/Minerva empower hooks; Mercury coin-flip full
                             # redraw; Janus guaranteed 2-card redraw — all `turnStart` grant hooks;
                             # Dis Pater on-kill bits tithe (88c — the daemonized miner)
  encounters.json            # U3a: the authored-fight catalog (name/healthPool/kind/fit-filter/waves grammar + 48a rewards refs) — ALL 13 encounters reference a reward table (48g)
  selection.json             # V1: the encounter-selection policy (strategy: encounterFirst|layoutFirst)
  economy.json               # 47e: startingBits — the economy substrate; grows with Cluster 3
  rewards.json               # 48a: the weighted reward tables (bits{min,max}|packet|daemon|unit|poolHealth entries — the last two 74c, first authored in 74i's hostage-rescue table); 49g: packet entries LIVE — every launch packet reachable
  packets.json               # 49a→g: the packet catalog (patch/hype/shield/reroute/venom/overclock/surge/discard-one), one effect op each; miner daemonized to dis-pater at 88c — no run-duration packets ship (fire-site horizon blindness; packets.test.ts guards)
  prices.json                # 50a→f: the port price book — unit base×levelGrowth^(lv−1)±jitter, packet/daemon byId-over-default, sellFraction, unitRemovalPrice, portStock counts; launch catalog user-authored at 50f (§52 tunes)
  nodemap.json               # hop count + width bands + degree cap + rest knobs (G2/G3)
  terrain.json
  layouts.json
  sectors.json               # T1: sector catalog — TWO since §67 ("The Start" + "The Deep End"); 74e/74i: per-sector `events` pools (both hold the full 12-event slate) + `startingEvents` (The Start opens on sector-1-start — the run-opening boon)
  sector-map.json            # T2: the sector-selection DAG — §67: two chained nodes (start → the-deep-end)
  events.json                # 74a→i: the event catalog — the 3 smoke events + the user-authored ten (§74i: the cadre flag-chain three-parter, the prodigy grant, hostage-trio + its rewardOverride, the sector-1-start boon; cheese-tax ships repeatable: true)
  camps.json                 # 75a→j: the camp catalog — the signed 5 (bandit-squatters / ghoul-nest / toll-post / …; bits/packet rewards only, the ⭐ continuous-value rule); placements live in layouts.json campSpawns + camps weighted lists (75j: labyrinth ×2 · fetidPond · icebergs · rubbleQuarry)
  spawn.json                 # D5.C: overflow (mid-battle reinforcement) spawn-in lockout/fade seconds (Q2 retired M3 turnIntroSeconds)
  tiles.json
  stats.json                 # E1: hpPerConstitution, crit cap/mult, base move cooldown;
                             #     GP1/I1: mobilityCdPerStat/speedCdPerStat + mobilityMinCdScale/speedMinCdScale;
                             #     GP2: minDamage (subtractive-defense floor)
  sim.json                   # E5: retargetCloserRatio + rangedRetargetLosSeconds + occupiedCellPenalty + healer knobs; GP4: actingCellSearchSlack
  objective.json             # J1: rangedLeashCells — objective engage-radius cap for long-range units
  playback.json              # I3/Q1: speed steps {value,enabled}[] (0.5/1/2/3) + pauseEnabled; Q2: countdownSeconds (pre-battle hold)
  keybindings.json           # J3/Q1/Q3: rebindable hotkey defaults — speedHalf/speed1/speed2/speed3/togglePause + engage/focus/hold/stopObjective (E/F/H/T)

public/
  audio/                     # B6: preloaded .wav files (click, melee, shoot, death, win, magicboom, ...)

tools/                       # Dev-only; not bundled into dist/ (index page at /tools/)
  layout-editor/             # C1d.B → D8: layout painter at /tools/layout-editor/ (75i: the camps layer — camp-spawn paint + per-layout weighted camp list)
  run-config/                # G1/G5: short-run CLI + GUI launcher at /tools/run-config/
  archetype-editor/          # I4: schema-driven units.json editor (live preview + save) at /tools/archetype-editor/
  attack-editor/             # Cluster 1: abilities.json editor (effect-op tree + live schema validation) at /tools/attack-editor/
  sector-editor/             # T3: sectors.json editor (layout + per-kind encounter pools, weighted-roll preview) at /tools/sector-editor/
  encounter-editor/          # V2: encounters.json editor (visual wave-grammar builder + live resolution preview; 48e adds the rewards-ref panel) at /tools/encounter-editor/
  reward-editor/             # 48e: rewards.json editor (weighted tables + draw-% preview + referenced-by pane; 49g: packet entries = a catalog select + the packet-ref assert) at /tools/reward-editor/
  event-editor/              # 74h: events.json editor (page-map builder + JSON fallback; live schema + termination + ref validation; 74f phrases in choice rows; byte-faithful formatEventsJson; sector-placement pane) at /tools/event-editor/
  camp-editor/               # 75i: camps.json editor (member rows + reward refs + leash radius; both boot asserts run live; byte-faithful formatCampsJson) at /tools/camp-editor/
  packet-editor/             # 49g: packets.json editor (matrix-driven per-op sub-forms, derived target, constrained contexts, fire summary + dropped-by pane; byte-faithful formatPacketsJson) at /tools/packet-editor/
  price-editor/              # 50f: prices.json editor (one document, no tabs — unit/packet/daemon books + economy knobs + stock counts; resolved-price preview through the *For price cores; byte-faithful formatPricesJson) at /tools/price-editor/
  sweep-gui/                 # command-builder GUI for the fuzz balance harness at /tools/sweep-gui/
  mapgen-prototype/          # M6: procedural node-map generator sandbox at /tools/mapgen-prototype/

scripts/                     # Dev-only Node utilities; not bundled into dist/
  gen-sfx.mjs                # §32b: deterministic, dependency-free SFX synth → public/audio/ (npm run gen:sfx)
  i18n-review.ts             # 95e: `npm run i18n:review -- --lang=<l> --who=<name> [--role=translator|reviewer] [--family=a,b,ui] [--address=…] [--on=…] [--dry]` — the ONLY writer of provenance stamps: translator stamps `source` + `translator` on unstamped/fuzzy entries (skips text still equal to its English; scaffolds missing addresses as plain English; never deletes), reviewer stamps CURRENT entries only and exits 1 on anything else; prints the locale's credits. Siblings: i18n-extract.ts (95a) · i18n-baseline.ts (95d)

tests/
  smoke.test.ts
  ui-tokens.test.ts          # 96a: the CSS token pins (palette.ts ⇄ ui.css :root at the same hex · zero raw hexes outside :root · zero palette-triplet rgba() · every role token referenced · 96b: every font-size a rem `--text-*` token, every token referenced) — the derived-artifact tripwire shape on the stylesheet
  ui-motion.test.ts          # 99b: the reduced-motion pins — every `animation:` selector in ui.css has its twin under `:root[data-motion='reduced']` (the selector derived from motion.ts), reduced keyframes carry no transform and never `infinite`, a non-`none` reduced form keeps the original duration (the `animationend` self-removers), no dead @keyframes, zero `@media (prefers-reduced-motion)` blocks
  ui-focus.test.ts           # 100b: the focus pins — every `:hover` selector in ui.css has its `:focus-visible` twin in the SAME selector list, the ONE ring rule at its pinned selector with a solid outline, `outline: none` only on the three containers (the two 96f modals + `.screen-fade:focus`) and never under `:focus-visible`, the map node's ring on box-shadow with no outline — a permanent gate
  cssBlocks.ts               # 100b: the stylesheet oracles' shared walker (`stripCssComments` · `blocksOf` · `styleRulesOf` descending @media · `selectorsOf`) — lifted from ui-motion.test.ts when ui-focus.test.ts needed the same walk
  integration/               # determinism, snapshot-roundtrip, variable-size, layout-deadlock,
                             # spawn-overflow, corridor-flow, per-archetype battle tests
  fuzz/                      # A3: headless balance harness (opt-in CLI)
  pathing/                   # §42b/c: movement-metrics harness (MovementMetricsCollector + fixture maps + runner + shipped-layout capture; `npm run pathing` → the PATHING.md tables; baseline.test.ts pins the fixture numbers) — the Pathfinding-Audit instrument; runs in the main suite

retro/
  scratchpad.md              # rolling process notes
  post-mvp-review.md         # CHECKPOINT 7 retrospective

process/                     # agent procedures read on a trigger (AGENTS.md "Before you… read…")
  planning.md                # kickoffs, closes, ROADMAP changes, the scratchpad sweep
  measurement.md             # batches, the measurement box, benchmarks, balance edits
  oracles.md                 # refactor oracles, failing controls, instrument self-checks
  welfare-and-efficacy.md    # reading the friction log, session reports, phase-stats, friction-scan
  browser-pane.md            # Claude Code's Browser pane: getting a live page, the hidden pane, fixtures

archive/                     # superseded roadmaps + feedback + phase worklogs

index.html                   # Mounts <canvas> + <div id="ui">
vite.config.ts
tsconfig.json
eslint.config.js             # Flat config; bans Math.random() in src/sim and src/run
.prettierrc
```

## Key abstractions

### `RNG`

```ts
class RNG {
  constructor(seed: number);
  next(): number;           // [0, 1)
  int(min: number, max: number): number;  // inclusive
  pick<T>(arr: T[]): T;
  fork(): RNG;              // positional child (LOCAL use only — see below)
}
// 77d1 — the keyed door (the sanctioned cross-seam mechanism):
function deriveSeed(root: number, key: RngStreamKey, ...ids: number[]): number;
function deriveRng(root: number, key: RngStreamKey, ...ids: number[]): RNG;
```

**`deriveRng` is the key mechanism since 77d2/77d3.** Every cross-seam stream (the Run ladder, battle setup, bot clones) derives per-occurrence from a root + a registry key ([src/core/rngStreams.ts](src/core/rngStreams.ts) — a closed union; keys and the hash are PERMANENT, gotcha #125) + the occurrence's stable ids (sectorIndex, nodeId, turnIndex, serialized counters). Order-free by construction: adding a stream, or a draw inside one occurrence, can never remap another. `Run` serializes only `streamRoot` + three counters; rollout clones diverge by replacing the root. `fork()` survives for LOCAL self-contained use (a tool/test forking off a fresh parent it owns end to end) — it advances the parent one step, so it must never be used across a seam.

### `EventBus`

```ts
class EventBus<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void;
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;
}
```

Typed events keyed by name. Returns an unsubscribe function. We define a single `GameEvents` type that enumerates every event in the system — keeps the catalog discoverable.

### `Clock`

Drives the simulation at a fixed tick rate (20Hz) decoupled from render framerate. Standard fixed-timestep accumulator pattern: render loop runs at requestAnimationFrame, accumulates real time, and calls `world.tick()` zero or more times per frame to catch up.

Gameplay code never hardcodes tick counts. Cooldowns, durations, and timers are authored *in seconds* and converted through `secondsToTicks(s)` / `ticksToSeconds(t)` in `src/config.ts`. Changing `TICK_RATE` is a one-line change that re-discretizes the sim without re-tuning balance.

**Playback (I3 + Q1)** is a *tick-batching multiplier on top of* this loop, not a `TICK_RATE` change. `BattleScene.tick` scales the real frame `dt` by the active `PlaybackSpeed.current` (0.5×/1×/2×/3×, or **0 while paused**) before feeding it to the `Clock`, the `BattleRenderer`, and the terrain shader — so the battle advances faster (or, at 0.5×, slower via the `Clock`'s fractional accumulator) while the `Clock` still fires *whole* fixed-timestep ticks. **Pause is speed 0**: `Clock.advance(0)` fires no ticks and freezes the board visuals too (everything downstream gets `dt × 0`). The sim is byte-identical (same `world.tick()` sequence + RNG order, just more/fewer ticks per rAF frame), so there is **no snapshot or fuzz impact** (the fuzz harness drives `World` directly and never sees `BattleScene`). Knobs in `config/playback.json` (per-step `enabled` flags + `pauseEnabled` are difficulty-system groundwork); the HUD owns the Q1 speed pane + per-speed/pause hotkeys, the speed + paused state persist across battles on the page-lifetime `PlaybackSpeed` (in `SceneContext`).

### `Unit` and `Behavior`

```ts
interface Behavior {
  readonly kind: string;     // registry key for snapshot rehydration (A2)
  proposeAction(unit: Unit, world: World): ActionProposal | null;
}

class Unit {
  readonly id: number;
  readonly team: 'player' | 'enemy' | 'neutral';   // 'neutral' for env entities (C1a)
  readonly glyph: string;
  readonly stats: UnitStats;
  position: GridCoord;
  currentHp: number;
  readonly behaviors: Behavior[];
  readonly blocksLineOfSight: boolean;             // D6 — true for combatants/walls; false for half-cover
  readonly actionCooldowns: Map<string, number>;   // A1 — per-action, keyed by Action.id
  activeAction: ActiveAction | null;               // A1 — set while in flight; F2 — carries the phase timeline
}
```

Color is *not* on `Unit` — that's a renderer-side concern. `BattleRenderer` maps `team` → palette color so the simulation has no opinions about visuals.

Each `World.tick()` runs an **action selector** (A1): polls every behavior's `proposeAction`, filters proposals whose action is still on cooldown (`unit.actionCooldowns.get(id) > 0`), and picks the highest-scoring valid proposal. The chosen `Action` runs its lifecycle (`start` → effect ticks → finish), and while `unit.activeAction != null` the selector short-circuits. For single-tick actions (move, attack) the cooldown and duration coincide — preserving the MVP feel — but charge-ups and channels diverge them. Behaviors are stateless across ticks. New unit kinds add or swap behaviors rather than subclassing.

Death is handled inline at the top of `World.tick`'s per-unit loop (no `DeathBehavior` — folded into the tick itself at A1). A separate `reapDead()` pass runs after the D7.B tile-effect pass so fire-kills end the battle on the same tick.

### `World`

The battle state. Owns the grid, the unit list, the current tick, and the RNG for this battle. Exposes `tick()` which advances simulation by one tick and emits events. Serializable to JSON.

### `SpriteRenderer`

```ts
class SpriteRenderer {
  addSprite(glyph: string, color: Color, position: Vec3): SpriteHandle;
  updateSprite(handle: SpriteHandle, opts: { position?: Vec3; color?: Color; glyph?: string; alpha?: number; size?: number; bloomIntensity?: number }): void;
  removeSprite(handle: SpriteHandle): void;
}
```

Internally manages a single `InstancedMesh` with instanced attributes for `position`, `glyphIndex`, `color`, `alpha`. Adding/removing sprites updates the instance buffers and the active count. The shader handles billboarding and atlas sampling.

### `SpriteAnimator`

Bridges simulation and rendering. Subscribes to `unit:moved` events and starts a lerp from the old cell to the new cell over the move-cooldown duration. Per frame, it interpolates every active lerp and pushes positions to the `SpriteRenderer`. Owns visual transient state (in-flight lerps, fade-outs) that has no place in the simulation. §81c2: unit GROUND relocations (moves/swaps/settle-backs) go through `startGroundLerp`, which re-times Y only — climbs complete by the 50% mark and descents start there (matching the §36 logical-position flip) — so an anchor never sits below the surface of the cell it's visually over; projectiles keep the plain linear lerp.

## Event catalog (outputs)

```
tick                    { tick: number }
battle:started          { worldSeed: number; encounter: BattleEncounter }          # 53b: + the full self-contained fixture (the trace recorder's begin-marker; only Run emits, no sim/run reader)
battle:ended            { winner: 'player' | 'enemy' | 'draw'; reason?: 'decisive' | 'mutualWipe' | 'cap'; xpAwards: { unitId; rosterIndex; damageDealt; xpGained }[]; survivorPower?; fallenPower?; tallies?; campKills? }   # E4: per-roster XP; H4: draw + pool chips; 91a1: reason (WHY it ended — the cap penalty keys on 'cap' only) + fallenPower (Σ power of each side's REAPED combatants, both death sites — the casualty rule's input; fielded = survivors + fallen); 47f: tallies {bits} — the battle-earned settle (Run.gainBits); 75g: campKills [{defId, killedBy}] — the wiped camps (player-killed roll rewards into the turn offer win-or-lose; enemy-killed = credit denial; omitted camp-free — byte-identical payloads)
unit:spawned            { unitId: number; instant: boolean }                       # instant=false → D5.C overflow-queue spawn (fade-in)
unit:moved              { unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }
unit:dashed             { unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }   # N1: a dash LEAP (also emits unit:moved for the slide) — audio/VFX cue, fires even on a 1-cell dash
unit:moveAborted        { unitId: number; from: GridCoord; to: GridCoord }            # §35b: a relocation aborted at execution (dest occupied/untraversable) — clean no-op, cooldown not consumed; inert on instant moves, §36's settle-back hook
unit:actionHeld         { unitId: number; actionId: string; reaimTicks: number }      # 82e: a releaseGate def HELD FIRE at its release boundary (target dead / left the [min,max] band mid-windup) — nothing fired, cooldown set to the (speed-scaled) re-aim window; consumer: BattleRenderer's amber drain bar
unit:swapped            { unitA; unitB; cellA; cellB; durationTicks }                  # GP5: the atomic pair exchange (dual lerp; logical flip at impact since 56c2); emitters generalized at §56 (yield/swap-through/flee-swap); (row added 56e-pre2 — was missing since GP5)
unit:swapAborted        { unitA; unitB; cellA; cellB }                                 # 56e-pre2: a swap ended WITHOUT its flip (abort at impact, or actor removed pre-flip) — the TWO-body settle: renderer eases both sprites to their true cells; pathing metrics reverts both committed steps
unit:shoved             { unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }   # §35c: the de-overlap backstop relocated a co-located unit to the nearest free cell (also emits unit:moved for the slide); the future-knockback primitive
unit:moveDecision       { unitId: number; kind: MoveDecisionKind }                  # §42a: the movement layer's per-poll decision record (exactly one per Movement/SupportMovement poll) — purely observational, never serialized; taxonomy in src/sim/moveDecision.ts; the §42b metrics harness is the consumer
unit:waited             { unitId: number }                                          # §44b: a WaitAction EXECUTED (won the selector, resolved within the tick — the instantaneous-action rule keeps it out of activeAction/serialization); vs moveDecision{wait} = propose-time intent; no consumer yet (§45 "queued" stance is the intended first)
unit:attacked           { attackerId: number; targetId: number; damage: number; crit: boolean }   # E1: damage post-crit; GP2: post-defense (via world.applyDamage)
unit:missed             { attackerId: number; targetId: number }                   # I2: a single-target strike dodged (precision-vs-evasion roll); 0 dmg, no HP/ledger touch
unit:healed             { unitId: number; amount: number; healerId: number | null }   # healerId: caster (ability heal, F5) or null (hypothetical env heal); 27d: the healing-TILE chip moved to the rejuvenate status
unit:chained            { casterId: number; targetId: number; from: GridCoord; to: GridCoord; jumpIndex: number }   # §29c: one ARC of a chain attack, per hop, on the tick that hop's damage lands (render-only geometry — the damage rides each hop's own unit:attacked); missing from this catalog until the §104 key diff found it
unit:died               { unitId; team; campId; archetype; level; power; summoned; tick }  # team carried because the unit is already spliced out (C1b); 75h: campId on the same rationale — the death SFX plays for a camp member but not crumbling masonry; 94d: the identity + the BOOKED power (what the casualty rule charged — 0 for a summon/neutral) so the Run fallen ledger can record who fell
status:applied          { unitId; statusId; sourceUnitId: number | null }          # 27: a status-def effect applied (sourceUnitId null = environmental, e.g. a fire/healing tile, 27d); the viz lifecycle, only status-def effects emit
status:ticked           { unitId; statusId; sourceUnitId: number | null; amount }   # 27: a periodic DoT/HoT fired (the fire→burn / healing→rejuvenate chip, 27d) — amount = post-mitigation HP delta (no unit:attacked/healed double-cue)
status:expired          { unitId; statusId; sourceUnitId: number | null }          # 27: a status-def effect dropped off (expireEffects)
action:phase            { unitId; actionId; phase; targetId?; targetCell? }         # F2: phase-boundary signal; §Z FX driver resolves actionId→def.fx[phase]→FX_REGISTRY (retired magic:detonated/catapult:fired)
run:started             { seed: number }
run:victory             { }
run:defeated            { }
sector:cleared          { clearedSectorTitle; nextSectorTitle; poolBefore; poolAfter } # 67a: a non-sink sector terminal cleared — emitted from advanceSector AFTER the state swap (phase lands on sectorCleared); the cleared title rides the payload, the next mirrors currentSectorTitle. §90: poolBefore = the pre-floor pool the act ended on (the harness records THIS as poolAtSectorClears), poolAfter = after health.seamHealFloor lifted it
run:bitsChanged         { bits: number; delta: number }                             # 47e: the balance moved (bits = new total, delta = post-clamp change); emitted only on a real change from Run.addBits; the §48 overlay's feed
run:poolChanged        { before; after; max; reason }                                 # 94e: the run-wide player pool moved — from the ONE Run.setPlayerHealth chokepoint (chip · heal · damage · rest · seam), on a real change; the persistent PoolOverlay is the consumer (pools:chipped stays the telemetry's turn-boundary source)
run:cacheChanged        { packetIds: string[]; size: number }                       # 49b: the cache changed — a packet added/discarded, OR addDaemon moved the DERIVED capacity (size = the folded effectiveCacheSize); the 49f chip+modal's feed
run:packetUsed          { packetId; context; playerHealth; grants; empowerStacks; poolAtRisk }  # 49e: a usePacket fired (consume-on-fire; the paired run:cacheChanged carries the shrunk cache) — post-effect health + the re-derived queue/badge column for the 49f strip; 96.5c: + the risk bound re-derived (a pool move moves its cap) — at the turn-intro gate only, 0 elsewhere (the preview rolls the encounter's wave)

port:entered            { nodeId: number }                                          # 50c: docked at a port node — the run holds in the serialized port phase until leavePort; §50e's PortScene feed (the 50c interim stub undocks immediately)
event:entered           { nodeId: number; eventId: string }                         # 74b: landed on an event node that didn't combat-resolve — the run holds in the serialized event phase with the {eventId,pageId} cursor; the EventScene swap's feed (74f; event nodes scatter naturally since §74e — the fourth NodeMap tail pass + the sector `events`/`startingEvents` pools)
event:pageChanged       { eventId: string; pageId: string }                         # 74b: the active event's cursor moved (a choice's page-id next); the EventScreen (74f) re-renders off this — terminals emit nothing here (return-to-map = silent transition; start-encounter fires battle:started)
recruit:offered         { units: UnitTemplate[] }
reward:offered          { rewards: readonly RewardPortion[] }                       # 48b: a won encounter's rolled reward offer — the run entered the reward phase (battle → rewards → promotion → recruit)
promotion:pending       { promotions: PromotionInfo[] }                             # E4: roster level-ups → PromotionScene
objective:set           { team; objective: TeamObjective }                          # O1: a team set/replaced its steering objective (marker tracks player only)
objective:cleared       { team }                                                    # O1: a team reverted to atWill (explicit, or engage-target died)
command:applied         { tick; command: WorldCommand }                             # 53a/53c: a drained WorldCommand took effect, stamped with its EFFECTIVE tick — the first tick that can observe it (in-tick drain = current tick; a parked drain = the NEXT tick, the frozen tick's units already acted). Replay rule: inject stamped-E commands before tick E. Fires ONLY for real drained commands (an auto-revert emits objective:cleared, never this)
turn:starting           { turn; hop; pools; hand; drawPile; discardPile; grants; empowerStacks; daemons; map; poolAtRisk }  # H4b/H5b/K3/K3.5/K4/L1/R2/49d/89e: pre-turn gate cue (gated only); poolAtRisk = the player's chip bound under health.chipMode (91d: survivors → the fielded wave's Σ power, previewed off the keyed battle stream; casualties → the HAND's Σ power), capped at the pool (display-only); hand + the other two piles (R2, recruitment order) + the GRANT QUEUE (TurnGrantView[] — per-source redraw+empower in acquisition order, `active` = the cursor) + per-card empower stacks + the OWNED daemons [{id;name;description;redrawGate;empowerGate}] + the ENCOUNTER's map
turn:resolved           { turn; winner; reason; pool chips; result; pools; fallen }  # H4b: the turn-outcome cue (gated path only); 96.5d: no screen consumes it any more — Game buffers it for the NEXT pre-turn screen's "last turn" strip and dispatches the advance itself after the battle's outro (the live bar carried the moment); 91a2: the chips are the APPLIED losses (not a re-derivation of the rule); 91d: reason (decisive | mutualWipe | cap) so the screen labels the chips by the rule set the turn paid; 94d: fallen = {thisTurn, encounter} rows off Run.fallenLedger (the rows add up to the chips)
pools:chipped           { turn; playerBefore; playerAfter; enemyBefore; enemyAfter; playerCharge; enemyCharge } # 89a: the pools as resolveTurn APPLIED them (both paths) — the fuzz telemetry's trajectory source; 91a2: + the rule's UNCAPPED charge per side (src/run/chipRule.ts turnCharges — health.chipMode survivors | casualties, + health.capPenalty on a 'cap' turn; the overkill read's pre-clamp number)
turn:handRedrawn        { hand; drawPile; discardPile; grants; empowerStacks; poolAtRisk }  # K3/49d: the pre-turn hand CHANGED (redraw, or 65c packet draw/discard — hand length may differ from the drawn size) — full new hand + the re-derived queue (K4: + re-derived badge column; R2: + refreshed draw/discard piles); 96.5c: + the risk bound re-derived for the NEW hand (the pre-turn risk line repaints from it — it painted once at turn start and went stale after a redraw); gate-only, 0 elsewhere
deck:cardDrawn          { drawPile; discardPile }                # 65f: ONE card left the draw pile (the drawCard chokepoint — deal/redraw/Surge); a presentation CUE, never authoritative (the swap events above are) — the serial pile-pulse feed
deck:cardDiscarded      { drawPile; discardPile }                # 65f: ONE card hit the discard (recycle/redraw send-off/Cull; the discardCard chokepoint) — same cue-not-truth contract
deck:reshuffled         { drawPile; discardPile }                # 65f: the discard flipped back into the draw pile — ONE cue for the whole flip (a single distinct pulse by design, not a serial tick)
turn:unitEmpowered      { handIndex; grants; empowerStacks }                    # K4/49d: an empowerUnit command landed — the re-derived queue + per-card empower stacks
turn:grantPassed        { grants }                                                  # 49d: a passGrant finalized the active grant (strict finality mode only) — the re-derived queue for the strip's auto-arm
```

`action:phase` (F2): every action declares an ordered phase timeline (`windup → release → travel → impact → recovery`, all optional/zero-length); `World.tick` fires this event at each boundary that begins on a tick (zero-length phases share one), and runs the action's effect (`applyEffect`) at `impact`. It carries no damage — that still rides `unit:attacked` / `unit:healed`. Renderer-only consumer (F3/F4). The "target died mid-flight" handling is a declared per-action `OrphanPolicy` (`commit-at-cast` / `fizzle` / `ground-target` / `re-home`).

`src/core/events.ts` is the authoritative type definition — when these drift, the source file wins. Naming convention: `subject:verbed`, past-tense. Bus events are past-tense notifications only; anything imperative goes through the command channel below.

## Command catalog (inputs)

Two channels, both typed unions defined in their respective `Command.ts`:

```
RunCommand (synchronous; Run.dispatch / RunDispatcher)
  enterNode               { nodeId: number }
  chooseRecruit           { unitTemplate: UnitTemplate }
  passRecruit             { }     # H6b: decline the recruit offer
  leavePort               { }     # 50c: undock from a port node back to the map (the hop was consumed on entry); clears the rolled stock (50d)
  chooseEventOption       { choiceIndex: number }   # 74b: resolve one choice on the active event page — one eventRng outcome roll, effects, then next-routing (page hop / return-to-map / start-encounter); wrong phase/index/condition = silent no-op
  buyPortUnit             { index: number }   # 50d: buy the stocked unit — spends the jittered price, appends via the recruit path (appendRosterUnit); sold/broke/bad-index = silent no-op
  buyPortPacket           { index: number; swapCacheIndex?: number }   # 50d: buy the stocked packet; a FULL cache takes the 49c swap contract (affordability validated BEFORE the swap discard)
  buyPortDaemon           { index: number }   # 50d: buy the stocked daemon (stock owned-excluded at roll)
  sellPacket              { cacheIndex: number }   # 50d: sell one held packet while docked — refund = ⌊price × sellFraction⌋ via RAW addBits (NEVER gainBits — the fold-loop mint)
  payToRemoveUnit         { rosterIndex: number }   # 50d: pay the flat unitRemovalPrice, remove through the removeRosterUnit chokepoint (all six roster-parallel structures); last unit irremovable
  dismissPromotion        { }     # E4: dismiss the PromotionScene
  dismissSectorCleared    { }     # 67a: release the sectorCleared gate back to 'map' (the sector already advanced — state-first, the defeat/complete shape); silent no-op outside the gate
  acceptReward            { index: number; swapCacheIndex?: number }   # 48b: accept ONE pending reward portion (bits settle via gainBits; a daemon joins ownership immediately); 49c: swapCacheIndex = the slot to discard when a packet portion meets a FULL cache
  declineReward           { index: number }   # 48b: decline ONE pending reward portion (declinable-per-portion, passRecruit's sibling)
  advanceTurn             { }     # H4b: resume from a turn gate (pre/post-turn screen)
  redrawCards             { handIndices: number[]; grantIndex: number }   # K3/49d: redraw selected hand positions at the pre-turn gate; grantIndex targets ONE redraw grant in the queue (per-source — the 47d summed budget retired; strict mode requires the ACTIVE grant)
  empowerUnit             { handIndex: number; grantIndex: number }   # K4/49d: buff one drawn card for the rest of the encounter (grantIndex → the grant QUEUE; strict mode requires the active grant)
  passGrant               { }     # 49d: finalize the ACTIVE grant unspent (the strip's Pass) — engine-enforced finality; a no-op with passIsFinal off
  discardPacket           { cacheIndex: number }   # 49b: drop one cache slot (at-will + the forced-keep shrink instrument); ANY phase — pure run-level state
  usePacket               { cacheIndex: number; handIndex?: number; rosterIndex?: number }   # 49e: fire one held packet (consume-on-fire, validate-first); context from PHASE (turn-intro→preTurn, map→outOfBattle); unit targets: handIndex (preTurn) / rosterIndex (outOfBattle)
  resetRun                { }     # 63e: with ?character= pinned → fresh run + map; else → back to the CharacterSelectScene (the choice is per-run)
  chooseCharacter         { characterId: string }   # 63e: GAME-handled (the resetRun shape) — CONSTRUCTS the Run from the select scene's confirm; a live Run only ever sees it misrouted (no-op)

WorldCommand (queued; drained at top of tick)
  noop                    { }                                # snapshot-test channel exerciser
  setObjective            { team; objective: TeamObjective } # O1: set/replace a team's always-present objective (mode + optional tile/enemy target)
  clearObjective          { team }                           # O1: revert a team to atWill (alias for setObjective with mode atWill)
```

UI screens hold a `RunDispatcher` (Game implements it) and call `dispatcher.dispatch(cmd)`. The headless harness (A3) and any future replay system call the same entry points, so a saved input stream replays identically. Pending `WorldCommand`s are part of the `WorldSnapshot` — a save mid-battle preserves intent.

## Rendering pipeline

1. `Renderer` drives `requestAnimationFrame`. Each frame:
   - Compute real `dt` since last frame
   - Pass `dt` to `Clock`, which calls `world.tick()` zero or more times to keep sim time aligned with real time
   - Call `SpriteAnimator.update(dt)` to advance in-flight visual lerps + fades
   - Render scene through two `EffectComposer`s (selective bloom, B1.1)
2. The scene contains:
   - One faceted-prism terrain mesh (`TerrainRenderer`, C1c) — also the canonical source of per-tile Y via `heightAt`
   - One `InstancedMesh` for all sprites (`SpriteRenderer`) — actually two meshes sharing one geometry: layer 0 visible, layer 1 bloom (B1.1)
   - Per-unit HP / level / action-progress overlays are DOM elements positioned
     via a world→screen projector (`UnitOverlayLayer`, E3.6) — the old instanced
     `BarRenderer` mesh is retired
   - No per-unit `Object3D`s. Ever. This is the performance contract.
3. **Bloom** is selective via two composers (B1.1): `bloomComposer` renders the layer-1 bloom mesh through `UnrealBloomPass` (max-channel high-pass, not Rec.709 — gotcha #29) into an offscreen RT; `mainComposer` renders the layer-0 visible mesh, then folds the bloom RT in additively via `MixPass`. Sat-clamp + `OutputPass` finish the chain. Per-instance `bloomIntensity` decouples halo strength from visible color: 0 suppresses, 1 is natural, >1 forces.
4. **CRT scanlines** are a CSS `<div>` overlay (`#scanlines`), not a post-process pass (B5). One source of truth across the canvas/DOM seam.
5. **Palette quantization is GONE** (retired at B1). The `COLORS` table is art-direction discipline now, not shader enforcement. Gotchas #1/#3/#4 retired as a consequence.

## What's deliberately not abstracted yet

A few things would be over-engineering at the current scope; flagging them so we know what we're choosing not to build:

- **No ECS library.** Behaviors-on-units is enough structure for the foreseeable game. If the unit count explodes or behaviors get genuinely many-to-many, we revisit.
- **No asset loader.** The font atlas is generated at startup synchronously; audio preloads from `public/audio/` via `AudioPlayer`'s constructor.
- **No save/load UI yet.** A2 lays the JSON serialization plumbing (`World.toJSON` / `Run.toJSON`); UI for choosing a save slot and resuming a run waits until runs are long enough that save matters.
- ~~**No generic status-effect system.**~~ The concrete need arrived and K1 built it: `src/sim/statusEffects.ts` (fold-over-base stat mods + merge policies + lifetimes) with the Run-side encounter store; fatigue is the proof consumer. D7.B's per-tick tile effects remain separate (tile chip, not a stat mod).
