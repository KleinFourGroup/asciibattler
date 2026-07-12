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
  Game.ts                    # Top-level orchestrator: owns Renderer/Bus/Run; scene swapper (A5)
                             # builds Run from parseRunConfigFromURL() (G1)
  config.ts                  # Engine constants: TICK_RATE=20, GRID_SIZE=12, secondsToTicks
                             # (balance lives in config/*.json — see src/config/)

  core/
    EventBus.ts              # Tiny typed pub/sub; on() returns unsub
    RNG.ts                   # Mulberry32 PRNG; .next/.int/.pick/.fork
    sampling.ts              # M6: deterministic RNG samplers — weightedPick + sampleRange (triangular bias)
    Clock.ts                 # Fixed-timestep tick loop separated from render loop
    events.ts                # GameEvents catalog (typed event payloads)
    types.ts                 # Shared primitives: Vec2, GridCoord

  dev/                       # 53b: DEV-only surfaces (main.ts's import.meta.env.DEV block is the sole app entry; the gauntlet harness may import headless)
    TraceRecorder.ts         #   53b: passive battle-trace assembler — bus subscriber (battle:started encounter + the 53a command:applied stream + outcome) → BattleTrace {version, configHash, encounter, commands, outcome}; storage-agnostic (onTrace callback); tested
    configHash.ts            #   53b: fnv1a fingerprint over the RAW config/*.json registry (plain JSON imports — tsx-compatible, NOT import.meta.glob); the trace-invalidation key; drift-guard test walks config/
    traceStore.ts            #   53b: localStorage ring (last 40 traces) + __game.dumpTraces()/clearTraces() console surface; DOM-zone glue, untested; the export KEY rides 53f
    replayTrace.ts           #   53c: headless byte-identical trace replay — strict version+configHash refusal; reconstruction ≡ both production battle-construction sites; commands injected before their stamped effective tick; the fidelity keystone test lives beside it

  config/                    # A4: zod-validated wrappers around config/*.json
    units.ts                 #   §38 UnitDef catalog (was archetypes.ts): glyph + baseStats + growthRates + abilities/targeting (E1/E3) + inert §38 fields (footprint/layer/ignoresTerrain/susceptibility); attackRange moved to abilities (E5); 29d: assertSummonRefsResolve boot-checks every summon op's archetype id
    abilities.ts             #   Loads config/abilities.json into the AbilityDef catalog (src/sim/effects schema); abilityDef(id) + the damageOpOf/healOpOf op accessors. Y5e consolidated this (was abilityDefs.ts) atop the retired legacy AbilityConfig
    statuses.ts              #   27a: loads config/statuses.json into the StatusDef catalog; statusDef(id) + assertStatusRefsResolve (boot-checks every applyStatus statusId, wired into abilities/registry.ts)
    difficulty.ts            #   G4: enemy level-budget knobs (budgetFactor/offset, swarm, K2 enemyArcherRatio) + A/B/C presets; X1: per-run waveSize/levelBudget multipliers; 48f: bitsMultiplier (the economy lever — applies in Run.effectiveBits, never WaveContext)
    recruitment.ts           #   starting team + offer size + startingLevel + recruitBonusChance (G4)
    leveling.ts              #   E4: xp curve + half-cover mult + restXp (G3) + xpPerHealing (F6)
    nodemap.ts               #   hop count + width bands + degree cap + restChance/restMinSpacing (G2/G3)
    terrain.ts               #   C1a: wall + water density
    layouts.ts               #   C1d.A: hand-authored layout array (incl. spawns, halfCovers, chasms, fires, healings, §40d rubble, theme)
    sectors.ts               #   T1: the Sector schema — run container (id/title/desc/length/theme/hop-gated layout pool); V0: + hop-gated ENCOUNTER pool (sector-owns-both); procedural = reserved sentinel
    sectorMap.ts             #   T2: the sector-selection meta-DAG schema (nodes hold sector lists; sources/sinks; acyclic, non-sink-has-outgoing guards)
    encounters.ts            #   U3: the Encounter schema (id/name/healthPool/layouts? fit-filter/kind enum/rewards?/waves) + the recursive U2 waves grammar (zod); V0: placement moved to the sector pool; V1: catalog ships Brigands/Highwaymen/Deserters
    selection.ts             #   V1: the SELECTION policy (strategy: encounterFirst|layoutFirst) — config/selection.json
    economy.ts               #   47e: the economy substrate (startingBits) — config/economy.json; grows with Cluster 3
    rewards.ts               #   48a: the reward-table registry (weighted bits{min,max}|packet|daemon entries) + the {table,trigger} encounter-ref schema + the daemon/packet-ref boot asserts (49a activated the packet sibling) — config/rewards.json
    packets.ts               #   49a: the packet catalog (one effect op per packet: applyBuff|grantRedraws|injectRule|healPool) — the EXPORTED (op×target×context) matrix (PACKET_OP_TARGET/PACKET_OP_CONTEXTS: parse guard + the 49e engine + the 49g editor read ONE source; midBattle/tile = dormant vocabulary no op admits) + per-op duration restrictions + assertPacketStatusRefs — config/packets.json
    prices.ts                #   50a/f: the port price book — PricesSchema + assertPriceRefs (draftable coverage + packet/daemon key refs) + the PURE *For price cores (unitPriceFor/packetPriceFor/daemonPriceFor/sellPriceFor; PRICES-bound wrappers delegate — one formula for the game AND the 50f editor preview) — config/prices.json
    spawn.ts                 #   D5.C: SpawnAction lockout duration
    tiles.ts                 #   D7.B: fire/healing chip rates → tick cadences
    stats.ts                 #   E1: hpPerConstitution, crit cap + mult, base move cooldown;
                             #   GP1: per-axis mobility/speed CdPerStat + MinCdScale (I1: agility→speed); GP2: minDamage floor
    sim.ts                   #   E5: targeting + pathfinding knobs (retarget, occupiedCellPenalty, healer*)
    playback.ts              #   I3/Q1: speed steps {value,enabled}[] (0.5/1/2/3) + pauseEnabled; render-only (pause = speed 0)
    schemas.ts               #   shared zod helpers

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
    battleRules.ts           # 47f: the battle-domain daemon/packet seam — BattleRule (plain compiled data) + registerBattleRules
                             # (evaluation at the K1 triggers: player-team acting only; filter-before-chance; chance off
                             # combatRng; gainBits → tallies, applyStatus → the ACTING unit by default, def-resolved at fire
                             # time; 49e: applyTo:'target' lands on the STRUCK unit — dealHit-only, corpse-guarded AFTER the
                             # chance draw so draw counts never depend on hp state)
    Unit.ts                  # Unit + UnitTemplate + UnitStats (GP1 vocab + GP2 defense) + UnitDerived + Team + Behavior
                             # archetype: mercenary|adventurer|ronin|bandit|ranged|rogue|healer|mage|catapult|environment (I5 split melee→the 4-class melee family)
                             # level (E3) + xp/rosterIndex (E4); actionCooldowns Map + activeAction (A1)
                             # blocksLineOfSight (D6)
                             # K1: effects[] (status effects) + effectiveStats (cached fold; === stats when empty) + addEffect/expireEffects/refreshDerived
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
    targetingStrategies.ts   # per-archetype target-pick registry (nearest / weakest); Unit.targeting resolved at spawn
    archetypes.ts            # ALL_ARCHETYPES (full catalog) + DRAFTABLE_ARCHETYPES (§29-close draft pool, draftable-flag filtered), rollUnit, glyphForArchetype, targetingForArchetype, range/minRangeForArchetype (O4)
    environment.ts           # spawnWall + spawnHalfCover (D6) — neutral-team env factories
    terrainGen.ts            # Per-encounter terrain dispatch: procedural (proceduralMap.ts) vs layout library
    proceduralMap.ts         # M6: crossbar+divider+noise map generator + sampleProceduralParams (config→params)
    layouts.ts               # Thin re-export of validated config (LAYOUT_IDS for Run's roll)
    battleSetup.ts           # Shared applyTerrain/spawnTeam/spawnEncounter (+ §40d spawnLayoutNeutrals — walls/cover/rubble from a GeneratedTerrain)
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
                             # defeat|complete (E4.4/H4b). H4 encounter loop (health pools + turns) +
                             # H5 card deck (draw/hand/discard + deckRng). rest/boss resolution (G3);
                             # XP banking; dispatch(RunCommand) + toJSON/fromJSON (A2). RUN_SCHEMA_VERSION 16
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
    daemon.ts                # L1→49d: pure daemon rules — rollDaemon (uniform run-start roll) + resolveTurnGrants
                             # (owned daemons' turnStart grant hooks → THE GRANT QUEUE: TurnGrant[] per-source in
                             # walk order, each {daemonId; effect(kind/budget/maxCards|buff); used; passed} +
                             # this turn's granted InstantOps; ownership-then-rule-order draws, chance draws only
                             # when 0<c<1) + activeGrantIndex/grantViews (the DERIVED cursor + payload views) +
                             # resolveInstantHooks (encounterStart/encounterEnd, filter-gates-before-chance) +
                             # battleRulesFor (47f: compiles battle-domain hooks → sim BattleRule[] data, riding
                             # BattleEncounter) + daemonRedrawHook/daemonEmpowerHook
    runStats.ts              # 47a: the run-stat vocabulary — RunStatKey (bitsGain, cacheSize) + foldRunStats
                             # (foldEffects mirrored: adds→mults, identity-on-empty; NO rounding — read site rounds)
    fatigue.ts               # H6c→K1: fatigueEffect — the Fatigued status debuff (null/inert at the default rate)
    RunConfig.ts             # G1: RunConfig + parseRunConfigFromURL (shared by browser/CLI/GUI); L1: daemon override (?daemon=<id|none>); 47e: starting-bits override (?bits=N); 48f: bitsMultiplier (programmatic-only, the X1 siblings' third axis)
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
    NodeMap.ts               # planar non-crossing DAG (G2) + NodeKind battle|rest|boss (G3)|elite (W2 scatter) + dump; T2: per-sector length override
    sectorWalk.ts            # T2: pure RNG walk over the sector-DAG (pickStartSector/pickNextSector/isSectorSink); zero-draw singleton picks
    Recruitment.ts           # rollOffer: distinct archetypes from the full pool (F1); per-card level (post-G5)
    rewards.ts               # 48b: rollRewards — the pure reward roller (chance tests + weighted sampling w/ owned-daemon
                             # exclusion; bits {min,max} on the separate bits stream) + RewardPortion (49c: + the packet
                             # member — packets sample with NO exclusion, duplicates legal; a full cache resolves at ACCEPT)

  render/
    Renderer.ts              # WebGLRenderer + two EffectComposers (selective bloom, B1.1)
                             # + RAF loop + two camera modes (fit / scroll, D4)
                             # J3: pickCell (terrain raycast → grid cell) + pickInstance (billboard hit-test)
                             # §Z: shakeCamera(intensity,dur) — transient screen-aligned jitter applied/cleared around render
    SpriteRenderer.ts        # InstancedBufferGeometry + dual mesh (layer 0 visible / layer 1
                             # bloom) + per-instance bloomIntensity attr (B1.1) + per-instance
                             # size attr (E6.B). Also hosts transient tracer/projectile sprites
    UnitOverlayLayer.ts      # E3.6: DOM per-unit overlays (HP bar + action progress + level
                             # badge), positioned via projectToCss. E6.C: spawnHitsplat floats
                             # transient damage/crit/heal/burn numbers via the same projector
                             # §32c: updateStatuses reconciles the status pip-strip (above the HP bar) — one depleting pip per active status (width=duration, opacity=stacks)
    TerrainRenderer.ts       # C1c: faceted low-poly prism-per-tile, heightAt is canonical
                             # for sprite Y. D7.C: per-tile flicker/pulse + chasm sink + theme
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
                             # Z3: the melee shove + bow tracer + their whoosh ride action:phase (fire on hit AND miss); unit:attacked/missed keep only the hitsplat+HP
                             # 27e/28: status-fx driver — status:ticked → tick cue; 28: status:applied/expired hold the `active` body-tint overlay (statusOverlays, restore team color on expiry)
                             # J3: objective X marker (objective:set/cleared; camera-up lift) + enemyBillboards (pick candidates)
    fxRegistry.ts            # §Z: pure-data FxKey→FxDescriptor map (sound/projectile/burst/shake/shove/tracer; 27e sparkle/hitsplat; 28 overlay) + assertFxKeysResolve / assertStatusFxKeysResolve boot checks (headless-testable)
    statusDisplay.ts         # §32c: render-side status→display-color map (presentation only; behavior statuses reuse their 28c tints, DoTs get distinct hues) — the palette half of readUnitStatuses
    pick.ts                  # J3: pickInstanceAtNdc — pure screen-space billboard hit-test (replicates billboard.vert.glsl)
    FontAtlas.ts             # canvas2d glyph atlas → THREE.CanvasTexture (glyph set from glyphs.ts)
    glyphs.ts                # E7.A: THREE-free GLYPHS set (FontAtlas.test asserts archetype coverage); J3: 'X' = objective marker (atlas now 32/32 FULL)
    PostProcess.ts           # SatClamp + Bloom + BloomMix factories (B1.1)
                             # Scanlines retained as dormant code; CRT lines now run via CSS (B5)
    shaders/                 # .glsl source files loaded via Vite ?raw imports (A4)
    palette.ts               # COLORS table — TERMINAL_STONE added for neutrals (C1a)
    animation/
      SpriteAnimator.ts      # Lerps + fades (fromAlpha/toAlpha for D5.C) + E6.A shove channel
                             # + onComplete/arcHeight/targetProvider on lerp (E6.B/E7.D/F3)

  scenes/                    # A5: Scene system — single-active swap driven from Game
    Scene.ts                 #   Scene interface + SceneContext bundle (+ I3 playback, J3 keybindings, M4 apron)
    BattleScene.ts           #   World + Clock + BattleRenderer + HUD + per-battle audio
                             #   I3/Q1: tick() scales dt by playback.current (fast-forward batches ticks; pause = 0 parks the sim)
                             #   Q2: opens with a PreBattleCountdown (sim parked, board shown) — playback.pause()'d; unpause = Fight now
                             #   J3: owns the ObjectiveController (canvas input + enemy-billboard provider)
    PreBattleCountdown.ts    #   Q2: the pre-battle countdown timer (real-dt; active/displaySeconds/advance/skip) — unit-testable
    MapScene.ts              #   DOM-only, wraps MapScreen
    RecruitScene.ts          #   DOM-only, wraps RecruitScreen
    RewardScene.ts           #   48c: DOM-only, wraps RewardScreen (no payload — the screen reads the live offer off ctx.run)
    PortScene.ts             #   50e: DOM-only, wraps PortScreen (RewardScene's shape — no payload, reads the live run.portStock); swapped in off port:entered
    PromotionScene.ts        #   E4.4: DOM-only level-up summary; M1: pops at each turn boundary (mid-encounter, or before recruit on the final turn); 48b: the reward gate interposes BEFORE it on a won final turn
    PreTurnScene.ts          #   H4b: DOM-only, wraps PreTurnScreen (the turn-intro gate)
    PostTurnScene.ts         #   H4b: DOM-only, wraps PostTurnScreen (the turn-outcome gate)
    GameOverScene.ts         #   DOM-only, wraps GameOverScreen

  ui/
    ui.css
    fade.ts                  # fadeIn / fadeOutAndRemove — shared screen transitions
    HUD.ts                   # In-battle HUD: the hop·turn chip (top-left) + location banner (top-center) + the four card/control panes below. unit:* events drive the card panes (addCard/refreshHp/removeUnit over one cards map); §32c refreshStatuses (BattleScene-driven, per-tick gated) updates each compact card's status row
                             # Q1: speed-command pane (top-right): per-speed buttons 0.5/1/2/3 + pause toggle (hotkeyed via Keybindings)
                             # Q2: pre-battle countdown readout (show/hideCountdown) + Fight-now button (the pause toggle reads "Fight now" while held); positionCountdown() drops it below the enemy pane when the cards wrap
                             # Q3: objective-command pane (bottom-right): Engage/Focus/Hold/Stop on O's typed model (per-type arming; right-click quick-Engage)
                             # Q4: player unit pane (bottom-center): wrapping compact UnitCards (live HP on attacked/burned/healed, grayed on death) + the relocated run pool gauge
                             # Q5: enemy unit pane (top-center, below banner): enemy pool gauge above an analogous red-teamed compact-card grid (max-height+scroll caps a large swarm)
                             # Q6: dismantled the old monolithic side panel — both team rosters + per-unit stat lines + inline You/Foe pools all removed (HP/pools now live in the Q4/Q5 panes); the hop label relocated to the standalone top-left chip + folds in the per-turn counter
    PlaybackSpeed.ts         # I3/Q1: page-lifetime speed+pause model (current/selectedSpeed/setSpeed/togglePause/steps); current=0 while paused; hotkeys via Keybindings
    Keybindings.ts           # J3: runtime-rebindable hotkey registry (codeFor/actionFor/rebind/on + DOM-free handleKeyDown)
    ObjectiveController.ts   # J3/Q3: battle-scoped objective input — right-click quick-Engage / arm(engage|focus)-then-click / hold / stop → World commands
    MapScreen.ts             # full-viewport node map (G2) + kind icons (G3); frontier click → enterNode; R1: top-right roster CardListButton
    PreTurnScreen.ts         # H4b: turn N + pools + the drawn hand (H5b; P3: shared full UnitCard — all stats + abilities + XP bar, screen scrolls); ▲ badge rides the card; K3.5 map label; L1 idol banner; R1/R2: roster (top-right) + draw/discard pile (bottom corners) CardListButtons; 49f: THE GUIDED FIRE STRIP (one chip per grant-queue entry in acquisition order; active auto-arms — empower fires on card click, redraw multi-selects + confirms ON the chip; Pass ▸ = passGrant; queued dim / spent fade / passed struck) + the at-will PACKET chip row (live cache thunk; target-none fires on click, hype arms pick-a-card) — refreshes off turn:handRedrawn/unitEmpowered/grantPassed + run:packetUsed/cacheChanged
    PostTurnScreen.ts        # H4b: turn outcome (winner / pool chips / gauges); M3: Continue-only (auto-timer removed)
    RecruitScreen.ts         # recruit offer cards (P1: shared UnitCard, recruit skin) → dispatch chooseRecruit; R1: top-right roster CardListButton
    CardListModal.ts         # R1/R2: shared card-list modal (CardListModal overlay + CardListButton) — full UnitCards in a dimmed, scrollable overlay (Esc/backdrop/✕ dismiss); R1 roster view (top-right, Map/Recruit/PreTurn) + R2 draw/discard pile views (PreTurn bottom corners)
    rosterOrder.ts           # R1: pure card-ordering seam (orderRoster: recruited[default]/archetype/level, stable on recruitment order) — only recruited wired to the UI, others switchable
    PromotionScreen.ts       # E4.4: per-unit level-up cards (P1: shared UnitCard, promotion skin); M2: two-phase reveal (all cards pop in, then gains tick green card-by-card + +N chip; click-anywhere skips) — the screen owns the timeline, driving the card via UnitCard's levelValue/statRows handles
    RewardScreen.ts          # 48c: the reward offer — one row per portion, Accept (pickup blip) / Decline per row; bits rows render run.effectiveBits (the settle math, never the base) and re-derive after every resolution; 49c: packet rows (▤ + def-resolved name/description) + a live `▤ cache n/size` line while a packet portion pends + the full-cache SWAP picker (a select over held slots replacing Accept)
    PortScreen.ts            # 50e: the docked-port screen — five sections in one scroll (Units-for-hire on recruit-skin UnitCards with price footers / Packets / Daemons / Sell-packets / Crew-removal) + a viewport-PINNED Leave; full re-render after every own dispatch + off run:bitsChanged/cacheChanged (the cache modal stays usable while docked); prices render the serialized slot price / the shared book helpers (display honesty); unaffordable = disabled, sold = SOLD badge (50d flag-not-splice), removal disabled at last-unit
    BitsOverlay.ts           # 48d: the persistent top-left bits chip — the FIRST page-lifetime UI element (Game-owned, survives scene swaps); paints from run.bits + run:bitsChanged, hides at game-over, re-shows on run:started
    CacheOverlay.ts          # 49f: the persistent cache chip (▤ n/6, stacked below the bits chip) + the open-anywhere cache modal — the SECOND page-lifetime element (the gotcha #116 lifecycle verbatim); Discard always, Fire by the phase-derived context (mirrors the 49e engine derivation), overclock's inline roster picker, the forced-keep shrink flow (overflow force-opens discard-only, un-dismissable until resolved)
    GameOverScreen.ts        # defeat / complete variants → dispatch resetRun
    statLabels.ts            # GP3: shared STAT_LABELS map (card + HUD + PromotionScreen)
    UnitCard.ts              # P1: shared unit-card builder — one DOM/CSS source for recruit + promotion (+ P3 pre-turn, Q4/Q5 HUD player+enemy cards, R1/R2 card-list modal). compact/full modes × recruit/promotion/preturn/hud/roster skins; compact (Q4) = glyph + Lv(TL)/POW(TR) + glyph-width HP bar, via unitCardFromUnit adapter + the hpFill handle; Q5 team coloring via the `team` opt → unit-card--enemy (red glyph + HP, vs the green player default); carries the "card can't disagree with the unit" ability readings (was RecruitScreen); rarity-accent seam (unit-card--rarity-*, default common = today's look); §32c updateCardStatusRow reconciles the compact card's status row (a chip per active status: swatch + name + `×stacks · ±N/s · Ns`, the §31 scaled potency made literal)

  audio/
    AudioPlayer.ts           # B6: 4-deep clone ring per sound; per-key volume + pitch jitter; + magicboom (E7.C); §32b: the status/afflicter/summon/catapult SoundKeys (8 generated by scripts/gen-sfx.mjs + the hand-made thud)

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
                             # redraw; Janus guaranteed 2-card redraw — all `turnStart` grant hooks
  encounters.json            # U3a: the authored-fight catalog (name/healthPool/kind/fit-filter/waves grammar + 48a rewards refs) — ALL 13 encounters reference a reward table (48g)
  selection.json             # V1: the encounter-selection policy (strategy: encounterFirst|layoutFirst)
  economy.json               # 47e: startingBits — the economy substrate; grows with Cluster 3
  rewards.json               # 48a: the weighted reward tables (bits{min,max}|packet|daemon entries); 49g: packet entries LIVE across all four tables — every launch packet reachable
  packets.json               # 49a→g: the packet catalog — the locked launch 7 (patch/hype/shield/reroute/venom/overclock/miner), one effect op each
  prices.json                # 50a→f: the port price book — unit base×levelGrowth^(lv−1)±jitter, packet/daemon byId-over-default, sellFraction, unitRemovalPrice, portStock counts; launch catalog user-authored at 50f (§52 tunes)
  nodemap.json               # hop count + width bands + degree cap + rest knobs (G2/G3)
  terrain.json
  layouts.json
  sectors.json               # T1: sector catalog — ships one ("The Start": all layouts + procedural, ungated, length 11)
  sector-map.json            # T2: the sector-selection DAG — ships a one-node graph (source == sink == "start", holding "the-start")
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
  layout-editor/             # C1d.B → D8: layout painter at /tools/layout-editor/
  run-config/                # G1/G5: short-run CLI + GUI launcher at /tools/run-config/
  archetype-editor/          # I4: schema-driven units.json editor (live preview + save) at /tools/archetype-editor/
  attack-editor/             # Cluster 1: abilities.json editor (effect-op tree + live schema validation) at /tools/attack-editor/
  sector-editor/             # T3: sectors.json editor (layout + per-kind encounter pools, weighted-roll preview) at /tools/sector-editor/
  encounter-editor/          # V2: encounters.json editor (visual wave-grammar builder + live resolution preview; 48e adds the rewards-ref panel) at /tools/encounter-editor/
  reward-editor/             # 48e: rewards.json editor (weighted tables + draw-% preview + referenced-by pane; 49g: packet entries = a catalog select + the packet-ref assert) at /tools/reward-editor/
  packet-editor/             # 49g: packets.json editor (matrix-driven per-op sub-forms, derived target, constrained contexts, fire summary + dropped-by pane; byte-faithful formatPacketsJson) at /tools/packet-editor/
  price-editor/              # 50f: prices.json editor (one document, no tabs — unit/packet/daemon books + economy knobs + stock counts; resolved-price preview through the *For price cores; byte-faithful formatPricesJson) at /tools/price-editor/
  sweep-gui/                 # command-builder GUI for the fuzz balance harness at /tools/sweep-gui/
  mapgen-prototype/          # M6: procedural node-map generator sandbox at /tools/mapgen-prototype/

scripts/                     # Dev-only Node utilities; not bundled into dist/
  gen-sfx.mjs                # §32b: deterministic, dependency-free SFX synth → public/audio/ (npm run gen:sfx)

tests/
  smoke.test.ts
  integration/               # determinism, snapshot-roundtrip, variable-size, layout-deadlock,
                             # spawn-overflow, corridor-flow, per-archetype battle tests
  fuzz/                      # A3: headless balance harness (opt-in CLI)
  pathing/                   # §42b/c: movement-metrics harness (MovementMetricsCollector + fixture maps + runner + shipped-layout capture; `npm run pathing` → the PATHING.md tables; baseline.test.ts pins the fixture numbers) — the Pathfinding-Audit instrument; runs in the main suite

retro/
  scratchpad.md              # rolling process notes
  post-mvp-review.md         # CHECKPOINT 7 retrospective

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
  fork(): RNG;              // returns a new RNG seeded deterministically from this one
}
```

`fork()` is the key method. When we generate a battle, we fork an RNG for that battle from the run's RNG. That way the battle's randomness doesn't perturb later run-level randomness, and we can re-run a single battle without re-running the whole sequence.

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

Bridges simulation and rendering. Subscribes to `unit:moved` events and starts a lerp from the old cell to the new cell over the move-cooldown duration. Per frame, it interpolates every active lerp and pushes positions to the `SpriteRenderer`. Owns visual transient state (in-flight lerps, fade-outs) that has no place in the simulation.

## Event catalog (outputs)

```
tick                    { tick: number }
battle:started          { worldSeed: number; encounter: BattleEncounter }          # 53b: + the full self-contained fixture (the trace recorder's begin-marker; only Run emits, no sim/run reader)
battle:ended            { winner: 'player' | 'enemy' | 'draw'; xpAwards: { unitId; rosterIndex; damageDealt; xpGained }[]; survivorPower?; tallies? }   # E4: per-roster XP; H4: draw + pool chips; 47f: tallies {bits} — the battle-earned settle (Run.gainBits)
unit:spawned            { unitId: number; instant: boolean }                       # instant=false → D5.C overflow-queue spawn (fade-in)
unit:moved              { unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }
unit:dashed             { unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }   # N1: a dash LEAP (also emits unit:moved for the slide) — audio/VFX cue, fires even on a 1-cell dash
unit:moveAborted        { unitId: number; from: GridCoord; to: GridCoord }            # §35b: a relocation aborted at execution (dest occupied/untraversable) — clean no-op, cooldown not consumed; inert on instant moves, §36's settle-back hook
unit:shoved             { unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }   # §35c: the de-overlap backstop relocated a co-located unit to the nearest free cell (also emits unit:moved for the slide); the future-knockback primitive
unit:moveDecision       { unitId: number; kind: MoveDecisionKind }                  # §42a: the movement layer's per-poll decision record (exactly one per Movement/SupportMovement poll) — purely observational, never serialized; taxonomy in src/sim/moveDecision.ts; the §42b metrics harness is the consumer
unit:waited             { unitId: number }                                          # §44b: a WaitAction EXECUTED (won the selector, resolved within the tick — the instantaneous-action rule keeps it out of activeAction/serialization); vs moveDecision{wait} = propose-time intent; no consumer yet (§45 "queued" stance is the intended first)
unit:attacked           { attackerId: number; targetId: number; damage: number; crit: boolean }   # E1: damage post-crit; GP2: post-defense (via world.applyDamage)
unit:missed             { attackerId: number; targetId: number }                   # I2: a single-target strike dodged (precision-vs-evasion roll); 0 dmg, no HP/ledger touch
unit:healed             { unitId: number; amount: number; healerId: number | null }   # healerId: caster (ability heal, F5) or null (hypothetical env heal); 27d: the healing-TILE chip moved to the rejuvenate status
unit:died               { unitId: number; team: Team }                             # team carried because the unit is already spliced out (C1b)
status:applied          { unitId; statusId; sourceUnitId: number | null }          # 27: a status-def effect applied (sourceUnitId null = environmental, e.g. a fire/healing tile, 27d); the viz lifecycle, only status-def effects emit
status:ticked           { unitId; statusId; sourceUnitId: number | null; amount }   # 27: a periodic DoT/HoT fired (the fire→burn / healing→rejuvenate chip, 27d) — amount = post-mitigation HP delta (no unit:attacked/healed double-cue)
status:expired          { unitId; statusId; sourceUnitId: number | null }          # 27: a status-def effect dropped off (expireEffects)
action:phase            { unitId; actionId; phase; targetId?; targetCell? }         # F2: phase-boundary signal; §Z FX driver resolves actionId→def.fx[phase]→FX_REGISTRY (retired magic:detonated/catapult:fired)
run:started             { seed: number }
run:victory             { }
run:defeated            { }
run:bitsChanged         { bits: number; delta: number }                             # 47e: the balance moved (bits = new total, delta = post-clamp change); emitted only on a real change from Run.addBits; the §48 overlay's feed
run:cacheChanged        { packetIds: string[]; size: number }                       # 49b: the cache changed — a packet added/discarded, OR addDaemon moved the DERIVED capacity (size = the folded effectiveCacheSize); the 49f chip+modal's feed
run:packetUsed          { packetId; context; playerHealth; grants; empowerMagnitudes }  # 49e: a usePacket fired (consume-on-fire; the paired run:cacheChanged carries the shrunk cache) — post-effect health + the re-derived queue/badge column for the 49f strip

port:entered            { nodeId: number }                                          # 50c: docked at a port node — the run holds in the serialized port phase until leavePort; §50e's PortScene feed (the 50c interim stub undocks immediately)
recruit:offered         { units: UnitTemplate[] }
reward:offered          { rewards: readonly RewardPortion[] }                       # 48b: a won encounter's rolled reward offer — the run entered the reward phase (battle → rewards → promotion → recruit)
promotion:pending       { promotions: PromotionInfo[] }                             # E4: roster level-ups → PromotionScene
objective:set           { team; objective: TeamObjective }                          # O1: a team set/replaced its steering objective (marker tracks player only)
objective:cleared       { team }                                                    # O1: a team reverted to atWill (explicit, or engage-target died)
command:applied         { tick; command: WorldCommand }                             # 53a/53c: a drained WorldCommand took effect, stamped with its EFFECTIVE tick — the first tick that can observe it (in-tick drain = current tick; a parked drain = the NEXT tick, the frozen tick's units already acted). Replay rule: inject stamped-E commands before tick E. Fires ONLY for real drained commands (an auto-revert emits objective:cleared, never this)
turn:starting           { turn; hop; pools; hand; drawPile; discardPile; grants; empowerMagnitudes; daemons; map }  # H4b/H5b/K3/K3.5/K4/L1/R2/49d: pre-turn gate cue (gated only); hand + the other two piles (R2, recruitment order) + the GRANT QUEUE (TurnGrantView[] — per-source redraw+empower in acquisition order, `active` = the cursor) + per-card empower stacks + the OWNED daemons [{id;name;description;redrawGate;empowerGate}] + the ENCOUNTER's map
turn:resolved           { turn; winner; pool chips; result; pools }                 # H4b: post-turn outcome cue (gated path only)
turn:handRedrawn        { hand; drawPile; discardPile; grants; empowerMagnitudes }  # K3/49d: a redrawCards command landed — full new hand + the re-derived queue (K4: + re-derived badge column; R2: + refreshed draw/discard piles)
turn:unitEmpowered      { handIndex; grants; empowerMagnitudes }                    # K4/49d: an empowerUnit command landed — the re-derived queue + per-card empower stacks
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
  buyPortUnit             { index: number }   # 50d: buy the stocked unit — spends the jittered price, appends via the recruit path (appendRosterUnit); sold/broke/bad-index = silent no-op
  buyPortPacket           { index: number; swapCacheIndex?: number }   # 50d: buy the stocked packet; a FULL cache takes the 49c swap contract (affordability validated BEFORE the swap discard)
  buyPortDaemon           { index: number }   # 50d: buy the stocked daemon (stock owned-excluded at roll)
  sellPacket              { cacheIndex: number }   # 50d: sell one held packet while docked — refund = ⌊price × sellFraction⌋ via RAW addBits (NEVER gainBits — the fold-loop mint)
  payToRemoveUnit         { rosterIndex: number }   # 50d: pay the flat unitRemovalPrice, remove through the removeRosterUnit chokepoint (all six roster-parallel structures); last unit irremovable
  dismissPromotion        { }     # E4: dismiss the PromotionScene
  acceptReward            { index: number; swapCacheIndex?: number }   # 48b: accept ONE pending reward portion (bits settle via gainBits; a daemon joins ownership immediately); 49c: swapCacheIndex = the slot to discard when a packet portion meets a FULL cache
  declineReward           { index: number }   # 48b: decline ONE pending reward portion (declinable-per-portion, passRecruit's sibling)
  advanceTurn             { }     # H4b: resume from a turn gate (pre/post-turn screen)
  redrawCards             { handIndices: number[]; grantIndex: number }   # K3/49d: redraw selected hand positions at the pre-turn gate; grantIndex targets ONE redraw grant in the queue (per-source — the 47d summed budget retired; strict mode requires the ACTIVE grant)
  empowerUnit             { handIndex: number; grantIndex: number }   # K4/49d: buff one drawn card for the rest of the encounter (grantIndex → the grant QUEUE; strict mode requires the active grant)
  passGrant               { }     # 49d: finalize the ACTIVE grant unspent (the strip's Pass) — engine-enforced finality; a no-op with passIsFinal off
  discardPacket           { cacheIndex: number }   # 49b: drop one cache slot (at-will + the forced-keep shrink instrument); ANY phase — pure run-level state
  usePacket               { cacheIndex: number; handIndex?: number; rosterIndex?: number }   # 49e: fire one held packet (consume-on-fire, validate-first); context from PHASE (turn-intro→preTurn, map→outOfBattle); unit targets: handIndex (preTurn) / rosterIndex (outOfBattle)
  resetRun                { }

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
