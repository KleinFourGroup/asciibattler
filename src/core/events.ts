/**
 * The canonical event catalog. Adding a new event? Add it here first so the
 * type system can guide every emitter and subscriber. Naming convention:
 * `subject:verbed` (past tense, lowercase, colon-separated).
 *
 * Mirrors ARCHITECTURE.md "Event catalog". When the two drift, this file
 * wins — but please update the doc in the same commit.
 *
 * A2: imperative inputs (player wants to enter a node, pick a recruit,
 * reset the run) moved off the bus and onto the `RunCommand` channel in
 * `src/run/Command.ts`. The bus carries only outputs ("X just happened")
 * — that's why every name here is past-tense.
 */

import type { GridCoord } from './types';
import type { Team, UnitStats, UnitTemplate } from '../sim/Unit';
import type { Archetype } from '../sim/archetypes';
import type { ActionPhaseName } from '../sim/Action';
import type { ObjectiveTeam, TeamObjective } from '../sim/objective';
import type { WorldCommand } from '../sim/Command';
import type { MoveDecisionKind } from '../sim/moveDecision';
import type { TurnGrantView } from '../run/daemon';
import type { RewardPortion } from '../run/rewards';
import type { Theme } from '../sim/layouts';
import type { EncounterKind } from '../config/encounters';
import type { UseContext } from '../config/packets';

export interface GameEvents extends Record<string, unknown> {
  tick: { tick: number };

  'battle:started': { worldSeed: number };
  /**
   * E4: payload extended with `xpAwards` — one entry per player roster unit
   * (survivor OR fallen) that earned XP this battle. `damageDealt` is the raw
   * HP-loss tally the World accumulated for that unit; `xpGained` is the
   * `LEVELING`-resolved value (`xpFlatPerSurvivor`/`xpFlatPerFallen` +
   * `xpPerDamage × damageDealt`). Run banks it into the persistent roster.
   *
   * H4: awards are computed on EVERY battle end regardless of `winner` (the
   * old player-win-only gate is gone), because an encounter is now many turns
   * and each turn's damage banks into the per-encounter XP total — a unit that
   * dealt damage on a turn the player didn't win still earned it. (Empty only
   * when no roster unit dealt damage or qualified for a flat slice.)
   *
   * Including damageDealt + xpGained lets PromotionScene surface
   * "you dealt X damage, earned Y XP" without re-querying the World.
   */
  'battle:ended': {
    /**
     * E4: 'player' / 'enemy' on a decisive end (one team wiped). H4 adds
     * 'draw' for a tick-capped (or mutual-wipe) turn — the driver's
     * `World.resolveAsDraw` — where BOTH sides' survivors chip the opposing
     * health pool.
     */
    winner: 'player' | 'enemy' | 'draw';
    xpAwards: readonly {
      unitId: number;
      /**
       * Index into `Run.team` for the surviving player unit. Null for
       * the rare test fixture that spawned a player unit directly via
       * `World.spawnUnit` without threading rosterIndex; Run skips
       * those.
       */
      rosterIndex: number | null;
      damageDealt: number;
      xpGained: number;
    }[];
    /**
     * H4: Σ`power` over each team's living **on-grid** units at battle end —
     * the amount each side chips the OPPOSING health pool by. Deliberately
     * EXCLUDES the spawn queue (a queued/overflow unit never reached the grid
     * and contributed no power, even though `checkBattleEnd` counts a
     * non-empty queue as "alive"). Optional only so test fakes can drive
     * Run's phase machine without a real World; every real emit
     * (`World.emitBattleEnded`) sets it.
     */
    survivorPower?: { player: number; enemy: number };
    /**
     * 47f: battle-earned run resources (the World's serialized tally —
     * accumulated by battle-domain daemon rules, spec §"the seam
     * crossings"). Run settles `bits` through `gainBits` (the `bitsGain`
     * fold applies at the settle). Optional on the `survivorPower`
     * rationale — test fakes omit it; every real emit sets it.
     */
    tallies?: { bits: number };
  };

  /**
   * Fires once per unit appearing on the grid. `instant: true` for
   * setup-time spawns (battle start, initial team layout); `false` for
   * D5.C overflow-queue spawns that come in mid-battle and visually
   * lerp their alpha 0 → 1 over the SpawnAction lockout window.
   */
  'unit:spawned': { unitId: number; instant: boolean };
  'unit:moved': {
    unitId: number;
    from: GridCoord;
    to: GridCoord;
    durationTicks: number;
  };
  /**
   * GP5.1 — an atomic position SWAP (a `SwapAction`): `unitA` and `unitB`
   * exchange cells over `durationTicks` (unitA moves `cellA → cellB`, unitB
   * moves `cellB → cellA`). Distinct from two `unit:moved` events because a
   * swap is one event with shared timing, and because the mechanic is
   * non-obvious — keeping it first-class leaves a clean hook for a future
   * swap-specific cue / VFX / telemetry without conflating it with a normal
   * step. Today the healer (`SupportMovementBehavior`) is the only emitter and
   * the renderer the only consumer (it lerps both sprites from their live
   * positions). A degraded swap (partner gone after a snapshot) falls back to a
   * plain `unit:moved`.
   */
  'unit:swapped': {
    unitA: number;
    unitB: number;
    cellA: GridCoord;
    cellB: GridCoord;
    durationTicks: number;
  };
  /**
   * N1 — a `DashAbility` LEAP (a `DashAction`): the unit blinked from `from` to
   * `to` over `durationTicks`. A first-class event, mirroring `unit:swapped`'s
   * rationale — the dash is a movement VARIANT whose cue / VFX / telemetry must
   * not be inferred from a plain `unit:moved`: a dash that lands adjacent to an
   * enemy 2 cells away only moves ONE cell, indistinguishable from a normal step
   * by distance. Unlike a swap (two units, so it CAN'T reuse `unit:moved`), a
   * dash is one unit moving, so `DashAction` ALSO emits `unit:moved` and the
   * renderer lerps the slide via its normal one-unit path; THIS event is the
   * dash-specific signal layered on top. Today BattleScene's audio (the dash
   * whoosh) is the only consumer; the deferred dash VFX (afterimage/trail) is
   * the next.
   */
  'unit:dashed': {
    unitId: number;
    from: GridCoord;
    to: GridCoord;
    durationTicks: number;
  };
  /**
   * §35b — a relocation ABORTED at execution: the unit's selected move was a
   * clean no-op because its destination (`to`) was occupied or untraversable by
   * the time it ran (a stale proposal — an earlier-processed unit took the cell
   * this tick). The cooldown is NOT consumed; the unit retries next tick, still
   * at `from`. A first-class event (not a silent skip) so the renderer can react
   * — inert on today's instant moves (propose == execute atomically), but
   * load-bearing in §36: once the logical position flips partway through a move,
   * a mid-flight abort animates as a settle-back, and the renderer must SEE the
   * abort to reverse the lerp. §36c CONSUMER: BattleRenderer eases the sprite from
   * its live mid-slide position back to `from` (the unit never left logically). A
   * §35b selection-time abort (sprite still on `from`) settles in place — a no-op.
   */
  'unit:moveAborted': {
    unitId: number;
    from: GridCoord;
    to: GridCoord;
  };
  /**
   * §42a — the movement layer's per-poll DECISION record: why the unit moved,
   * or why it deliberately (or helplessly) didn't. Exactly ONE per
   * MovementBehavior / SupportMovementBehavior poll (a unit with an in-flight
   * action isn't polled and emits nothing that tick). Purely observational —
   * no world state, never serialized; the §42b metrics harness (decision-mix /
   * oscillation / queue counts) is the consumer. Records movement INTENT: the
   * proposal can still lose the selector to a higher-scoring ability —
   * cross-check `unit:moved` for actual motion. Kinds + full taxonomy doc:
   * `src/sim/moveDecision.ts`.
   */
  'unit:moveDecision': {
    unitId: number;
    kind: MoveDecisionKind;
  };
  /**
   * §44b — a unit EXECUTED a first-class wait: its `WaitAction` won the
   * selector (nothing better on offer this tick) and resolved within the tick
   * — a deliberate hold of its cell. Distinct from
   * `unit:moveDecision{kind:'wait'}`, which records the movement layer's
   * INTENT at propose time (emitted even when a ready attack outranks the
   * wait): THIS event fires only when the wait actually executes. Like the
   * decision record it is purely observational — no world state, never
   * serialized (the §44b instantaneous-action rule keeps waits out of
   * `activeAction`). No consumer yet; the §45 renderer "queued" stance is the
   * intended first.
   */
  'unit:waited': { unitId: number };
  /**
   * §35c — a unit was SHOVED off a cell it co-occupied: the occupancy backstop
   * relocated it from `from` to the nearest free cell `to` (deterministically),
   * lerped over `durationTicks`. Distinct from `unit:moved` because a shove is
   * FORCED, not chosen — it's the de-overlap safety net for a knockback / summon
   * / spawn landing on an occupied cell, and the primitive a future directional
   * `knockback` op wraps. First-classed (like swap / dash / moveAborted) so that
   * future cue / VFX / telemetry has a clean hook; no consumer yet (co-location
   * doesn't arise on today's instant model — the renderer lerps the slide via
   * its normal `to`/`durationTicks` path once a breach source exists).
   */
  'unit:shoved': {
    unitId: number;
    from: GridCoord;
    to: GridCoord;
    durationTicks: number;
  };
  /**
   * E1: `crit` flags whether AttackAction's start-time crit roll landed.
   * `damage` is the resolved post-crit value (already multiplied by
   * `STATS.critMult` when `crit === true`), so subscribers that only
   * care about HP change don't need to re-multiply. The dedicated flag
   * is what E6's hitsplats key off to render crits in red.
   */
  'unit:attacked': {
    attackerId: number;
    targetId: number;
    damage: number;
    crit: boolean;
  };
  /**
   * I2: a single-target strike (melee/ranged basic or the rogue gambit) rolled
   * to-hit at the `World.applyDamage` chokepoint and MISSED — the target's
   * `evasion` beat the attacker's `precision`. Distinct from a 0-damage
   * `unit:attacked` so consumers branch cleanly (no HP was touched, no
   * `recordDamage` entry, no crit). The attacker still swung/shot — but as of
   * Z3 that lunge/tracer + whoosh ride `action:phase` (which fires on hit AND
   * miss), so the render layer keys ONLY the "Miss" hitsplat off this event.
   * Only the evadable single-target actions emit it; the mage AoE, the catapult,
   * and environmental fire/chasm damage are unmissable and never do. */
  'unit:missed': { attackerId: number; targetId: number };
  /** Heal applied to a unit (an ability heal — `HealAction`). Emits AFTER
   *  currentHp is updated; healing is clamped at maxHp, so the emitted `amount`
   *  is the actual HP delta (0 when the unit is already full — we still emit so
   *  subscribers can debounce / log).
   *  F5: `healerId` tags the SOURCE — the casting unit's id for an ability heal,
   *  or `null` for a (currently hypothetical) environmental heal. Render-only
   *  metadata (not serialized): the F5 heal-sparkle fires only for ability heals.
   *  27d — the per-tick HEALING-TILE chip-heal moved off this event: a healing
   *  tile now sustains the `rejuvenate` HoT, which surfaces as `status:ticked`
   *  (the regen number + cue resolve from the status's `fx`), so `unit:healed`
   *  is the ability-heal cue only. */
  'unit:healed': { unitId: number; amount: number; healerId: number | null };
  /**
   * §29c — one ARC of a chain attack reached a target. Fires per hop (the §29c
   * chain op), on the tick that hop's damage lands — so with `hopDelaySeconds > 0`
   * the events stagger and the renderer draws the lightning travelling jump by
   * jump. `from`/`to` are the arc's grid endpoints (`from` = the caster for
   * `jumpIndex 0`, else the previous victim's cell); `targetId` is the unit this
   * hop struck (the live destination sprite). `casterId` tags the source (team
   * colour). Render-only — the damage itself rides the normal `unit:attacked`
   * each hop's inner damage op emits; this event carries only the arc geometry. */
  'unit:chained': {
    casterId: number;
    targetId: number;
    from: GridCoord;
    to: GridCoord;
    jumpIndex: number;
  };
  /**
   * Fires once per unit removal from the world. `team` is included so
   * subscribers can branch on combatant vs neutral (wall / environment)
   * deaths without re-querying the world — by the time this event fires
   * the unit has already been spliced out of `world.units` and is no
   * longer findable.
   */
  'unit:died': { unitId: number; team: Team };

  /**
   * Phase 27 — the status-effect lifecycle. A status (burn/bleed/poison/
   * rejuvenate, …) was applied to / ticked on / expired off a unit. These are
   * the in-battle status DISPLAY signal: the renderer (27e) resolves the status
   * def's `fx` keys through the §Z registry to drive the apply flash / per-tick
   * cue / expire fade / persistent overlay. `sourceUnitId` is the applier for
   * attribution (`null` = environmental, e.g. a fire-tile burn — mirroring
   * `unit:healed`'s `healerId: null`). Only status-DEF effects emit these; plain
   * K1 stat effects (empower / fatigue / dodge-buff) do not.
   *
   * `status:ticked` carries the per-tick `amount` (the DoT damage / HoT heal HP
   * delta, post-mitigation) so the renderer floats the number + flavor off this
   * ONE event — the periodic tick does NOT also emit `unit:attacked` /
   * `unit:healed` (no double-cue, no null-attacker dance). A refinement over the
   * roadmap's lean `{unitId, statusId, sourceUnitId}` sketch: the viz needs the
   * number, and threading it here keeps `status:ticked` the single tick signal.
   */
  'status:applied': { unitId: number; statusId: string; sourceUnitId: number | null };
  'status:ticked': {
    unitId: number;
    statusId: string;
    sourceUnitId: number | null;
    amount: number;
  };
  'status:expired': { unitId: number; statusId: string; sourceUnitId: number | null };

  /**
   * §Z — the ad-hoc `magic:detonated` / `catapult:fired` FX events (the Y4
   * strangler artifacts) were RETIRED here. Their VFX + SFX now resolve through
   * the renderer's FX registry (`src/render/fxRegistry.ts`), keyed off the
   * ability def's `fx` and driven by `BattleRenderer` on the action's phase
   * boundaries (the projectile on `release`, the burst + sound on `impact`).
   * The damage still rides `unit:attacked` per hit, so hitsplats / HP bars /
   * the XP ledger are unchanged.
   */

  /**
   * F2 — transient phase-boundary signal. Fires once per phase that BEGINS
   * on a tick, in declared order, for every in-flight action (zero-length
   * phases included — they share a boundary tick). Renderer-only consumer:
   * BattleRenderer's FX driver resolves the action's per-phase fx key through
   * the registry (Z1 the mage/catapult projectile@`release` + burst@`impact`;
   * Z2 the camera shake; Z3 the melee shove + bow tracer + their whoosh — on
   * `impact`, or `windup` for the gambit). Driving the strike cue off THIS event
   * is what plays it on a miss for free (the phase fires on hit AND miss).
   * Carries NO damage — that still rides `unit:attacked` / `unit:healed`.
   * `targetId` is set for homing actions (strikes, catapult), `targetCell` for
   * ground-target / fixed-cell actions (mage); both omitted for self / no-target
   * actions (dash, move, spawn). No sim/run subscriber exists, so emitting it
   * cannot perturb the deterministic sim or the fuzz baseline.
   */
  'action:phase': {
    unitId: number;
    actionId: string;
    phase: ActionPhaseName;
    targetId?: number | undefined;
    targetCell?: GridCoord | undefined;
  };

  /**
   * O1 — a team's steering objective was set (or replaced) on the battle, via
   * the `setObjective` `WorldCommand`. Carries the team + the new
   * `TeamObjective` (mode + optional target) so the J3 UI can render its marker
   * (the marker tracks the PLAYER team's objective only). Sim-side an `engage`
   * objective only steers a unit when it's not already engaged (see
   * `Targeting.ts`).
   */
  'objective:set': { team: ObjectiveTeam; objective: TeamObjective };
  /**
   * O1 — a team's objective reverted to `atWill`, either explicitly (the
   * `clearObjective` command) or automatically when an `engage` enemy target
   * died (`World.clearResolvedObjectives`). A `tile` target never auto-reverts
   * (persist-until-cleared). The idempotent emit guard on the World side means
   * this fires only on a real non-`atWill` → `atWill` transition.
   */
  'objective:cleared': { team: ObjectiveTeam };

  /**
   * 53a — a drained `WorldCommand` took effect. Emitted once per command at
   * the drain site, AFTER `applyCommand` ran, stamped with the tick it took
   * effect (`World.currentTick`; a PARKED drain — countdown/pause, Q2 —
   * stamps the current frozen tick, which is exactly when the command
   * applied). This is the trace recorder's substrate: unlike
   * `objective:set`/`objective:cleared`, it fires ONLY for real drained
   * commands (an auto-revert via `clearResolvedObjectives` emits
   * `objective:cleared` but never this) and carries the whole command, so a
   * replay can re-enqueue it verbatim. Determinism already guarantees
   * `worldSeed` + this stream → a byte-identical battle. No sim/run
   * subscriber exists, so emitting it cannot perturb the deterministic sim
   * or the fuzz baseline.
   */
  'command:applied': { tick: number; command: WorldCommand };

  'run:started': { seed: number };
  'run:victory': Record<string, never>;
  'run:defeated': Record<string, never>;

  /**
   * 47e — the run's bits balance changed. `bits` is the new balance
   * (authoritative — a consumer never needs to accumulate deltas); `delta`
   * is the applied signed change AFTER the floor-at-zero clamp. Emitted
   * only on a real change, from the single `Run.addBits` chokepoint (earns
   * via `Run.gainBits` today — daemon hooks + the coming §48 reward
   * settles; spends arrive with §50 ports). The §48 persistent top-left
   * overlay is the intended consumer; no sim/run subscriber exists.
   */
  'run:bitsChanged': { bits: number; delta: number };

  /**
   * 49b — the run's cache changed: a packet was added (`Run.addPacket` —
   * reward accepts at 49c, port buys at §50) or discarded (the
   * `discardPacket` command), or daemon ownership moved the DERIVED
   * capacity (`Run.addDaemon` emits too — a size-modifier idol can shrink
   * the cache into the forced-keep overflow without touching the list).
   * `packetIds` is an authoritative copy (ids — defs resolve via
   * `packetById`); `size` is the folded effective capacity. The 49f cache
   * chip + modal are the intended consumers; no sim/run subscriber exists.
   */
  'run:cacheChanged': { packetIds: string[]; size: number };

  /**
   * 49e — a `usePacket` command fired a held packet (consume-on-fire; the
   * paired `run:cacheChanged` already carried the shrunk cache). `context`
   * is where it fired; `playerHealth` is post-effect (patch heals it);
   * `grants` + `empowerMagnitudes` are the re-derived pre-turn state (a
   * reroute INSERTS a grant at the cursor, a hype re-badges the hand) —
   * both derived-empty outside `turn-intro`. The 49f fire strip + cache
   * modal are the intended consumers; no sim/run subscriber exists.
   */
  'run:packetUsed': {
    packetId: string;
    context: UseContext;
    playerHealth: number;
    grants: TurnGrantView[];
    empowerMagnitudes: number[];
  };

  /**
   * 50c — the player docked at a port node (spec §Ports): `enterNode` on a
   * `port`-kind node consumed the hop and the run entered the serialized
   * `port` phase (it holds there until a `leavePort` command). `nodeId` is
   * the docked node. §50e's PortScene swap is the intended consumer (the
   * 50c interim Game stub undocks immediately instead); no sim/run
   * subscriber exists. §50d rolls the stock at this same entry point.
   */
  'port:entered': { nodeId: number };

  'recruit:offered': { units: UnitTemplate[] };

  /**
   * 48b: a won encounter's reward offer is ready — the run just entered the
   * `reward` phase (interposed BEFORE any promotion: battle → rewards →
   * promotion → recruit, the shape-locked ordering). The payload is a copy
   * of the rolled portions; the screen resolves them one at a time via the
   * `acceptReward` / `declineReward` commands and should re-read
   * `run.pendingRewards` (and derive bits displays via `run.effectiveBits`)
   * after each — the live offer shrinks as portions resolve.
   */
  'reward:offered': { rewards: readonly RewardPortion[] };

  /**
   * E4: one or more player roster units crossed an XP threshold during
   * battle-end banking. Game swaps to PromotionScene which renders the
   * deltas; dismiss → recruit offer (existing flow) or run:victory at
   * terminal. The payload is the closed set of "what changed" snapshots
   * the scene needs — no follow-up world query required.
   */
  'promotion:pending': { promotions: readonly PromotionInfo[] };

  /**
   * H4b — a turn is about to begin (the pre-turn screen's cue). Fired only
   * when `Run.pauseAtTurnGates` is on (the interactive/live path); the headless
   * loop runs straight through and never emits it. Carries the turn number +
   * the current health pools so the screen can show "Turn N" + both gauges
   * before the tactical battle spins up. The screen dismisses with the
   * `advanceTurn` command.
   *
   * H5b — also carries `hand`: this turn's drawn cards (the roster templates
   * that will fight, in draw order), so the pre-turn screen shows WHO was
   * drawn. The hand is drawn before this fires (Run.startNextTurn), so it's
   * authoritative — the same templates `beginTurn` then sends to the World.
   *
   * K3.5 — also carries `map`: the ENCOUNTER's battlefield (one map per
   * encounter as of K3.5, rolled at encounter start), so the redraw decision
   * is made knowing the field. Inline structural shape rather than the Run
   * `EncounterMap` type to keep core → run imports type-light (the terrain
   * seed is deliberately omitted — presentation needs name/size/theme only).
   *
   * K3/K4→49d — also carries `grants`: this turn's GRANT QUEUE (one view
   * per granted idol effect in acquisition order — the §49 per-source
   * re-model; the old summed `redraw` + `empowers` list retired with it).
   * `active` marks the derived cursor the strict finality mode enforces.
   * Plus `empowerMagnitudes` (parallel to `hand`: each card's accumulated
   * empower stack on its roster slot, 0 = unbuffed), so the screen can badge
   * a card that was empowered on an EARLIER turn and drawn back.
   */
  'turn:starting': {
    turn: number; // 1-based, within the current encounter
    hop: number;
    playerHealth: number;
    playerHealthMax: number;
    enemyHealth: number;
    enemyHealthMax: number;
    hand: UnitTemplate[];
    /** R2 — the encounter deck's other two piles, resolved to templates for the
     *  pre-turn pile views. Carried in RECRUITMENT order (not draw order), so
     *  the views show contents-only without revealing the next-draw sequence.
     *  `hand` ∪ `drawPile` ∪ `discardPile` is the whole fielded roster. */
    drawPile: UnitTemplate[];
    discardPile: UnitTemplate[];
    /** 49d — the grant queue views (`Run.grantViews()`): a command names its
     *  grant by `grantIndex`; strict mode fires only the `active` one. */
    grants: TurnGrantView[];
    /** K4 — per-hand-position empower stacks (0 = none; 47d: summed across
     *  every owned empower idol's buff key), see `turn:starting`. */
    empowerMagnitudes: number[];
    /** L1→47d — the run's OWNED daemons in acquisition order (empty =
     *  daemon-less), for the stacked pre-turn banners. Inline structural
     *  shape (the `map` convention). Per-turn grant state is NOT here — it's
     *  what `grants` already says (a denied Mercury flip reads as a missing
     *  queue entry); `redrawGate`/`empowerGate` say whether an idol HAS each
     *  hook at all, so the screen can tell "denied this turn" from "this
     *  idol never grants it". */
    daemons: Array<{
      id: string;
      name: string;
      description: string;
      redrawGate: boolean;
      empowerGate: boolean;
    }>;
    /** Wb1 — the active encounter's identity, so the pre-turn screen can NAME
     *  the fight (otherwise the player guesses turn 1). `name` mirrors the HUD
     *  enemy-pane title; `kind` lets the screen badge an elite/boss. */
    encounter: {
      name: string;
      kind: EncounterKind;
    };
    map: {
      layoutId: string | null;
      gridW: number;
      gridH: number;
      theme: Theme;
    };
  };

  /**
   * K3 — a `redrawCards` command landed at the pre-turn gate: the selected
   * cards went to the discard and fresh draws took their hand positions.
   * Carries the FULL new hand (same draw-order contract as `turn:starting`)
   * plus the decremented redraw availability, so the pre-turn screen swaps
   * its card row + control state in place. Only ever fires during
   * `turn-intro` (the command is phase-gated), i.e. only on the live path.
   *
   * K4 — also carries `empowerMagnitudes` (the K4 badge column, parallel to
   * the NEW hand): a refill can seat an already-empowered card, and the old
   * positions no longer line up after a redraw.
   */
  'turn:handRedrawn': {
    hand: UnitTemplate[];
    /** R2 — the post-redraw draw/discard piles (recruitment order), so the
     *  pre-turn pile views reflect the swap. Same contract as `turn:starting`. */
    drawPile: UnitTemplate[];
    discardPile: UnitTemplate[];
    /** 49d — the full queue re-derived (the fired grant's budget moved,
     *  possibly the cursor too). */
    grants: TurnGrantView[];
    empowerMagnitudes: number[];
  };

  /**
   * K4 — an `empowerUnit` command landed at the pre-turn gate: the selected
   * card's roster slot gained the configured buff for the rest of the
   * encounter. Carries the re-derived queue + the full per-hand stack column
   * (`empowerMagnitudes`, parallel to the unchanged hand) so the pre-turn
   * screen updates its badge + control state in place. Only ever fires
   * during `turn-intro` (the command is phase-gated).
   */
  'turn:unitEmpowered': {
    handIndex: number;
    /** 49d — the full queue re-derived (same shape as `turn:starting`). */
    grants: TurnGrantView[];
    empowerMagnitudes: number[];
  };

  /**
   * 49d — a `passGrant` command finalized the active grant unspent (strict
   * finality mode only — free mode never emits this). Carries the re-derived
   * queue so the strip advances its auto-arm to the new cursor.
   */
  'turn:grantPassed': {
    grants: TurnGrantView[];
  };

  /**
   * H4b — a turn just resolved into the pools (the post-turn outcome screen's
   * cue). Fired only under `pauseAtTurnGates`. `winner` is the tactical winner
   * of the turn; `enemyPoolChip`/`playerPoolChip` are the Σ`power` each side's
   * survivors dealt the opposing pool; `result` is the encounter's status after
   * this turn (`ongoing` → the next turn's `turn:starting` follows the
   * `advanceTurn`; `won`/`lost` → the encounter ends instead). Pools are the
   * post-chip values.
   */
  'turn:resolved': {
    turn: number;
    winner: 'player' | 'enemy' | 'draw';
    enemyPoolChip: number;
    playerPoolChip: number;
    result: 'won' | 'lost' | 'ongoing';
    playerHealth: number;
    playerHealthMax: number;
    enemyHealth: number;
    enemyHealthMax: number;
  };
}

/**
 * E4 — one roster slot's level-up details. Mirrors what PromotionScene
 * renders: glyph + archetype + old→new level + per-stat deltas. Stats
 * before/after are kept whole (not just the deltas) so the scene can
 * show "STR 6 → 7" rather than just "+1 STR".
 */
export interface PromotionInfo {
  rosterIndex: number;
  archetype: Archetype;
  glyph: string;
  oldLevel: number;
  newLevel: number;
  oldStats: UnitStats;
  newStats: UnitStats;
}
