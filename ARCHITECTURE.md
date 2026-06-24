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
  main.ts                    # Entry point: bootstraps Game, mounts canvas, kicks off run
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

  config/                    # A4: zod-validated wrappers around config/*.json
    archetypes.ts            #   glyph + baseStats + growthRates (E1/E3); attackRange moved to abilities (E5)
    abilities.ts             #   Loads config/abilities.json into the AbilityDef catalog (src/sim/effects schema); abilityDef(id) + the damageOpOf/healOpOf op accessors. Y5e consolidated this (was abilityDefs.ts) atop the retired legacy AbilityConfig
    statuses.ts              #   27a: loads config/statuses.json into the StatusDef catalog; statusDef(id) + assertStatusRefsResolve (boot-checks every applyStatus statusId, wired into abilities/registry.ts)
    difficulty.ts            #   G4: enemy level-budget knobs (budgetFactor/offset, swarm, K2 enemyArcherRatio) + A/B/C presets
    recruitment.ts           #   starting team + offer size + startingLevel + recruitBonusChance (G4)
    leveling.ts              #   E4: xp curve + half-cover mult + restXp (G3) + xpPerHealing (F6)
    nodemap.ts               #   hop count + width bands + degree cap + restChance/restMinSpacing (G2/G3)
    terrain.ts               #   C1a: wall + water density
    layouts.ts               #   C1d.A: hand-authored layout array (incl. spawns, halfCovers, chasms, fires, healings, theme)
    sectors.ts               #   T1: the Sector schema — run container (id/title/desc/length/theme/hop-gated layout pool); V0: + hop-gated ENCOUNTER pool (sector-owns-both); procedural = reserved sentinel
    sectorMap.ts             #   T2: the sector-selection meta-DAG schema (nodes hold sector lists; sources/sinks; acyclic, non-sink-has-outgoing guards)
    encounters.ts            #   U3: the Encounter schema (id/name/healthPool/layouts? fit-filter/kind enum/rewards?/waves) + the recursive U2 waves grammar (zod); V0: placement moved to the sector pool; V1: catalog ships Brigands/Highwaymen/Deserters
    selection.ts             #   V1: the SELECTION policy (strategy: encounterFirst|layoutFirst) — config/selection.json
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
                             # Serializable; WorldSnapshot v24 (bumped E1 through Phase K; I1 = agility→speed + precision/evasion; I5 = melee→mercenary rename + subclasses; I6 = removed UnitDerived.critChance, crit is per-ability now; J1 = added the shared objective; K1 = added per-unit status effects)
                             # K1: registerTrigger/fireTrigger — combat/lifecycle trigger dispatch (the L daemon seam; NOT bus events)
                             # E1: combatRng (forked from rng); E4/F6: damageDealt + utilityDone XP ledgers
                             # J1: objective (player-team shared steering, tile|enemy) — set via WorldCommand, auto-clears on enemy death
                             # GP2: applyDamage() — the single combat-damage chokepoint (HP -= + ledger
                             #      + unit:attacked emit + subtractive defense mitigation); tile damage bypasses it
                             # I2/I6: applyDamage(evadable, accuracy) rolls accuracy-vs-evasion to-hit off combatRng (crit→miss order);
                             #     a miss emits unit:missed + 0 dmg. Only single-target strikes opt in; AoE/catapult/tile unmissable
                             # K1: applyDamage reads effectiveStats (prc/eva/def) + fires dealHit/takeHit/dealMiss/evade/kill triggers (post-resolution)
    Unit.ts                  # Unit + UnitTemplate + UnitStats (GP1 vocab + GP2 defense) + UnitDerived + Team + Behavior
                             # archetype: mercenary|adventurer|ronin|bandit|ranged|rogue|healer|mage|catapult|environment (I5 split melee→the 4-class melee family)
                             # level (E3) + xp/rosterIndex (E4); actionCooldowns Map + activeAction (A1)
                             # blocksLineOfSight (D6)
                             # K1: effects[] (status effects) + effectiveStats (cached fold; === stats when empty) + addEffect/expireEffects/refreshDerived
    statusEffects.ts         # K1: generic status-effect system — StatusEffect (per-stat add/mul mods + lifetime + merge policy) + foldEffects + combineMagnitude
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
    movement.ts              # J2: shared movement seam — MovementIntent + advance (the dash hook) + routeToward (cache boundary)
    actingPosition.ts        # GP4: nearestActingCell — bounded BFS to nearest firing cell in [minRange,range](+LOS) (O4 band)
    Targeting.ts             # findTarget + currentTarget stickiness + updateTarget (E5) w/ objective branches (engage/hold/focus + updateTargetDefault); lowestWoundedAlly (E7.B)
                             # dispatches the seeker's targeting strategy; ties by HP then id; skips neutrals
    targetingStrategies.ts   # per-archetype target-pick registry (nearest / weakest); Unit.targeting resolved at spawn
    archetypes.ts            # ALL_ARCHETYPES pool (F1), rollUnit, glyphForArchetype, targetingForArchetype, range/minRangeForArchetype (O4)
    environment.ts           # spawnWall + spawnHalfCover (D6) — neutral-team env factories
    terrainGen.ts            # Per-encounter terrain dispatch: procedural (proceduralMap.ts) vs layout library
    proceduralMap.ts         # M6: crossbar+divider+noise map generator + sampleProceduralParams (config→params)
    layouts.ts               # Thin re-export of validated config (LAYOUT_IDS for Run's roll)
    battleSetup.ts           # Shared applyTerrain/spawnTeam/spawnEncounter
    actions/                 # Non-verb actions only — every combat verb is now the data-driven effects/EffectAction (Y5c retired the hand-coded AttackAction/Heal/MagicBolt/Catapult/Gambit/Dash classes)
      MoveAction.ts          # Logical position update + unit:moved event
      SpawnAction.ts         # Pure-lockout action seated on D5.C overflow-queue spawns
      SwapAction.ts          # GP5: healer chokepoint yield — two units trade cells
      registry.ts            # Action factories keyed by Action.id (move/spawn/swap); every other id falls through to EffectAction.fromData (A2/Y5c)
    abilities/               # E2: generic Ability layer (retired AttackBehavior)
      Ability.ts             # Ability interface + propose() + ignoresLineOfSight flag (E7.D)
      registry.ts            # Ability factories; routes every id to EffectAbility (Y3–Y4 migration complete; the hand-coded classes retired in Y5)
    behaviors/
      MovementBehavior.ts    # J2: thin goal-selector → MovementIntent + advance (movement.ts); boids sidestep (E5.B)
                             # splits neutrals into pathBlockers + losBlockers (D6); LOS-optional abstain (E7.D)
      AbilityBehavior.ts     # E2: walks the unit's Ability[] (replaced AttackBehavior)
      SupportMovementBehavior.ts  # E7.B: healer idle / panic / approach / centroid-trail
      registry.ts            # createMovementBehavior + behavior factories keyed by kind (A2)
    effects/                 # Y1–Y3: data-driven attack/effect model (Cluster 1 keystone) — replacing the hand-coded ability/action classes
      schema.ts              #   Y1: EffectOp/TargetSelector/AbilityDef vocabulary (zod, closed discriminated unions) + inferred types; 27a: PeriodicOp (damage|heal subset for status ticks)
      statusSchema.ts        #   27a: StatusDef vocabulary (zod) — durationSeconds/merge/periodic{everySeconds,op}/fx; the periodic (DoT/HoT) axis of the K1 status system
      timeline.ts            #   Y1: seconds→ticks phase conversion: speed-scaled cadence + the single 'fill' elastic phase
      targeting.ts           #   Y2: unitsInCells (the Cluster-2 footprint seam) + aoe victim resolution + the affects filter
      reposition.ts          #   Y2: retreatCell — the caster-reposition primitive (the gambit's move-retreat op, via interpreter executeMove)
      interpreter.ts         #   Y2: executeOp — the switch over op.kind (damage/heal/move; reserved arms throw)
      EffectAction.ts        #   Y2: the single generic Action that fires a def's effects over the F2 timeline (start/applyEffect)
      propose.ts             #   Y3: the propose-time bridge — AbilityDef + caster → EffectAction + ActionProposal (cast-time scalar capture)
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
    redraw.ts                # K3: pure redraw rules — redrawRejection / redrawAvailability (config injected, both L modes provable)
    empower.ts               # K4: pure empower rules — empowerRejection / empowerAvailability / empowerEffect (config injected)
    daemon.ts                # L1: pure daemon rules — rollDaemon (uniform run-start roll) + resolveTurnGates
                             # (daemon → effective Redraw/EmpowerConfigs; chance gates draw only when 0<c<1)
    fatigue.ts               # H6c→K1: fatigueEffect — the Fatigued status debuff (null/inert at the default rate)
    RunConfig.ts             # G1: RunConfig + parseRunConfigFromURL (shared by browser/CLI/GUI); L1: daemon override (?daemon=<id|none>)
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
                             # J3: objective X marker (objective:set/cleared; camera-up lift) + enemyBillboards (pick candidates)
    fxRegistry.ts            # §Z: pure-data FxKey→FxDescriptor map (sound/projectile/burst/shake/shove/tracer) + assertFxKeysResolve boot check (headless-testable)
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
    PromotionScene.ts        #   E4.4: DOM-only level-up summary; M1: pops at each turn boundary (mid-encounter, or before recruit on the final turn)
    PreTurnScene.ts          #   H4b: DOM-only, wraps PreTurnScreen (the turn-intro gate)
    PostTurnScene.ts         #   H4b: DOM-only, wraps PostTurnScreen (the turn-outcome gate)
    GameOverScene.ts         #   DOM-only, wraps GameOverScreen

  ui/
    ui.css
    fade.ts                  # fadeIn / fadeOutAndRemove — shared screen transitions
    HUD.ts                   # In-battle HUD: the hop·turn chip (top-left) + location banner (top-center) + the four card/control panes below. unit:* events drive the card panes (addCard/refreshHp/removeUnit over one cards map)
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
    PreTurnScreen.ts         # H4b: turn N + pools + the drawn hand (H5b; P3: shared full UnitCard — all stats + abilities + XP bar, screen scrolls); K3 redraw + K4 empower selection + ▲ badge ride on the card; K3.5 map label; L1 idol banner; R1/R2: roster (top-right) + draw/discard pile (bottom corners) CardListButtons; the piles ride turn:starting/turn:handRedrawn (recruitment order)
    PostTurnScreen.ts        # H4b: turn outcome (winner / pool chips / gauges); M3: Continue-only (auto-timer removed)
    RecruitScreen.ts         # recruit offer cards (P1: shared UnitCard, recruit skin) → dispatch chooseRecruit; R1: top-right roster CardListButton
    CardListModal.ts         # R1/R2: shared card-list modal (CardListModal overlay + CardListButton) — full UnitCards in a dimmed, scrollable overlay (Esc/backdrop/✕ dismiss); R1 roster view (top-right, Map/Recruit/PreTurn) + R2 draw/discard pile views (PreTurn bottom corners)
    rosterOrder.ts           # R1: pure card-ordering seam (orderRoster: recruited[default]/archetype/level, stable on recruitment order) — only recruited wired to the UI, others switchable
    PromotionScreen.ts       # E4.4: per-unit level-up cards (P1: shared UnitCard, promotion skin); M2: two-phase reveal (all cards pop in, then gains tick green card-by-card + +N chip; click-anywhere skips) — the screen owns the timeline, driving the card via UnitCard's levelValue/statRows handles
    GameOverScreen.ts        # defeat / complete variants → dispatch resetRun
    statLabels.ts            # GP3: shared STAT_LABELS map (card + HUD + PromotionScreen)
    UnitCard.ts              # P1: shared unit-card builder — one DOM/CSS source for recruit + promotion (+ P3 pre-turn, Q4/Q5 HUD player+enemy cards, R1/R2 card-list modal). compact/full modes × recruit/promotion/preturn/hud/roster skins; compact (Q4) = glyph + Lv(TL)/POW(TR) + glyph-width HP bar, via unitCardFromUnit adapter + the hpFill handle; Q5 team coloring via the `team` opt → unit-card--enemy (red glyph + HP, vs the green player default); carries the "card can't disagree with the unit" ability readings (was RecruitScreen); rarity-accent seam (unit-card--rarity-*, default common = today's look)

  audio/
    AudioPlayer.ts           # B6: 4-deep clone ring per sound; per-key volume + pitch jitter; + magicboom (E7.C)

config/                      # A4: balance JSON source of truth (paired with src/config/*.ts)
  archetypes.json            # per-archetype glyph + baseStats + growthRates (E1/E3)
  abilities.json             # The AbilityDef catalog — one entry per combat verb (targeting / timeline / effect-ops / damage-heal profile). Y5e consolidated this (was abilityDefs.json) atop the retired legacy AbilityConfig json
  statuses.json              # 27a: the StatusDef catalog (burn/bleed/poison/rejuvenate) — empty until 27c authors content
  difficulty.json            # G4: enemy level-budget knobs + A/B/C presets
  recruitment.json           # starting team + offer size + startingLevel + recruitBonusChance
  leveling.json              # E4: xp curve + half-cover mult + restXp (G3) + xpPerHealing (F6)
  health.json                # H4: player/enemy health pools + maxTurns/maxTurnSeconds + chipMultiplier
  deck.json                  # H5: handSize (card-drawn hand; also the 2nd half of the playerTeamLevel seam)
                             # K3: redraw { enabled, redrawsPerTurn, maxCardsPerTurn } — the pre-turn redraw budget
                             # (L1: enabled ships FALSE — daemons own availability; the block stays as the type anchor)
  empower.json               # K4: empower { enabled, empowersPerTurn, buff } — the pre-turn unit buff (encounter-lived, via the K1 store)
                             # (L1: enabled ships FALSE — daemons carry their own buffs; the buff stays the K4-default shape)
  daemons.json               # L1: the idol catalog — per-daemon redraw/empower gates, each with a per-turn `chance`
                             # (Mars/Minerva empower; Mercury coin-flip full redraw; Janus guaranteed 2-card redraw)
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

tools/                       # Dev-only; not bundled into dist/
  layout-editor/             # C1d.B → D8: layout painter at /tools/layout-editor/
  run-config/                # G1/G5: short-run CLI + GUI launcher at /tools/run-config/
  archetype-editor/          # I4: schema-driven archetypes.json editor (live preview + save) at /tools/archetype-editor/

tests/
  smoke.test.ts
  integration/               # determinism, snapshot-roundtrip, variable-size, layout-deadlock,
                             # spawn-overflow, corridor-flow, per-archetype battle tests
  fuzz/                      # A3: headless balance harness (opt-in CLI)

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
battle:started          { worldSeed: number }
battle:ended            { winner: 'player' | 'enemy'; xpAwards: { unitId; rosterIndex; damageDealt; xpGained }[] }   # E4: per-roster XP
unit:spawned            { unitId: number; instant: boolean }                       # instant=false → D5.C overflow-queue spawn (fade-in)
unit:moved              { unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }
unit:dashed             { unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }   # N1: a dash LEAP (also emits unit:moved for the slide) — audio/VFX cue, fires even on a 1-cell dash
unit:attacked           { attackerId: number; targetId: number; damage: number; crit: boolean }   # E1: damage post-crit; GP2: post-defense (via world.applyDamage)
unit:missed             { attackerId: number; targetId: number }                   # I2: a single-target strike dodged (precision-vs-evasion roll); 0 dmg, no HP/ledger touch
unit:burned             { unitId: number; damage: number }                         # D7.B: per-tick chip from fire tile (no attacker)
unit:healed             { unitId: number; amount: number; healerId: number | null }   # healerId: caster (ability heal, F5) or null (D7.B tile chip, amount=0 at maxHp)
unit:died               { unitId: number; team: Team }                             # team carried because the unit is already spliced out (C1b)
action:phase            { unitId; actionId; phase; targetId?; targetCell? }         # F2: phase-boundary signal; §Z FX driver resolves actionId→def.fx[phase]→FX_REGISTRY (retired magic:detonated/catapult:fired)
run:started             { seed: number }
run:victory             { }
run:defeated            { }
recruit:offered         { units: UnitTemplate[] }
promotion:pending       { promotions: PromotionInfo[] }                             # E4: roster level-ups → PromotionScene
objective:set           { team; objective: TeamObjective }                          # O1: a team set/replaced its steering objective (marker tracks player only)
objective:cleared       { team }                                                    # O1: a team reverted to atWill (explicit, or engage-target died)
turn:starting           { turn; hop; pools; hand; drawPile; discardPile; redraw; empower; empowerMagnitudes; daemon; map }  # H4b/H5b/K3/K3.5/K4/L1/R2: pre-turn gate cue (gated only); hand + the other two piles (R2, recruitment order) + daemon-resolved redraw/empower budgets + per-card empower stacks + the run's daemon {id;name;description;redrawGate;empowerGate;empowerBuff} + the ENCOUNTER's map
turn:resolved           { turn; winner; pool chips; result; pools }                 # H4b: post-turn outcome cue (gated path only)
turn:handRedrawn        { hand; drawPile; discardPile; redraw; empowerMagnitudes }  # K3: a redrawCards command landed — full new hand + decremented budget (K4: + re-derived badge column; R2: + refreshed draw/discard piles)
turn:unitEmpowered      { handIndex; empower; empowerMagnitudes }                   # K4: an empowerUnit command landed — decremented budget + per-card empower stacks
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
  dismissPromotion        { }     # E4: dismiss the PromotionScene
  advanceTurn             { }     # H4b: resume from a turn gate (pre/post-turn screen)
  redrawCards             { handIndices: number[] }   # K3: redraw selected hand positions at the pre-turn gate (L1: budget = the daemon-resolved turnGates.redraw)
  empowerUnit             { handIndex: number }        # K4: buff one drawn card for the rest of the encounter (L1: buff + budget = the daemon-resolved turnGates.empower)
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
