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
import type { BattleObjective } from '../sim/objective';
import type { StatusEffect } from '../sim/statusEffects';
import type { RedrawAvailability } from '../run/redraw';
import type { EmpowerAvailability } from '../run/empower';
import type { Theme } from '../sim/layouts';

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
   * `recordDamage` entry, no crit). The attacker still swung/shot, so the
   * render layer plays the same `triggerAttackVisual` lunge/tracer it does for
   * a hit, then floats a "Miss" hitsplat instead of a damage number. Only the
   * evadable single-target actions emit it; the mage AoE, the catapult, and
   * environmental fire/chasm damage are unmissable and never do. */
  'unit:missed': { attackerId: number; targetId: number };
  /**
   * D7.B: per-tick chip damage from standing on a `fire` tile. Separate
   * event from `unit:attacked` so consumers can branch cleanly without
   * an `attackerId: null` / sentinel dance — fire damage has no
   * attacker. Subscribers that need to refresh visible HP state should
   * subscribe to all three of `unit:attacked` / `unit:burned` /
   * `unit:healed`. Emits AFTER currentHp is updated and BEFORE
   * `unit:died` if the damage kills.
   */
  'unit:burned': { unitId: number; damage: number };
  /** D7.B: per-tick chip heal from standing on a `healing` tile. Emits
   *  AFTER currentHp is updated; healing is clamped at maxHp, so the
   *  emitted `amount` is the actual HP delta (0 when the unit is
   *  already full — we still emit so subscribers can debounce / log).
   *  F5: `healerId` tags the SOURCE — the casting unit's id for an
   *  ability heal (HealAction), or `null` for an environment chip-heal
   *  (a healing tile). Render-only metadata (not serialized): the F5
   *  heal-sparkle fires only for ability heals so the per-tick tile chip
   *  stays just its `+N`. A future healer→target beam / heal-XP ledger
   *  is the other consumer this anticipates. */
  'unit:healed': { unitId: number; amount: number; healerId: number | null };
  /**
   * Fires once per unit removal from the world. `team` is included so
   * subscribers can branch on combatant vs neutral (wall / environment)
   * deaths without re-querying the world — by the time this event fires
   * the unit has already been spliced out of `world.units` and is no
   * longer findable.
   */
  'unit:died': { unitId: number; team: Team };

  /**
   * E7.C — a mage's `magic_bolt` detonated at `center` (the ground-targeted
   * blast cell). Fires exactly ONCE per cast from `MagicBoltAction.applyEffect`,
   * regardless of how many units the blast hit — including zero (a whiff) —
   * carrying the caster + center so the render + audio layers can play a
   * single impact (one projectile → explosion + one cast sound) instead of
   * keying off the per-target `unit:attacked` stream, which fires once per
   * victim (reads as multishot) and not at all on a miss. The damage itself
   * still rides `unit:attacked` per hit, so hitsplats / HP bars / the XP
   * ledger are unchanged.
   */
  'magic:detonated': { casterId: number; center: GridCoord };

  /**
   * E7.D — a catapult's `catapult_shot` completed its wind-up. Fires exactly
   * ONCE per shot from `CatapultShotAction.applyEffect`, ALWAYS — including
   * when the locked target died mid-charge (`hit: false`, an aborted shot).
   * `impact` is the cell the lobbed boulder lands on (the live target's cell
   * on a hit; its last-known cell — or the cast cell after a snapshot that
   * dropped the target — on an abort). The render + audio layers drive the
   * single arcing projectile off this (so an aborted shot still shows a
   * lobbed dud instead of nothing), mirroring `magic:detonated`. The damage
   * itself still rides `unit:attacked` on a hit, so hitsplats / HP bars / the
   * XP ledger are unchanged.
   */
  'catapult:fired': { casterId: number; impact: GridCoord; hit: boolean };

  /**
   * F2 — transient phase-boundary signal. Fires once per phase that BEGINS
   * on a tick, in declared order, for every in-flight action (zero-length
   * phases included — they share a boundary tick). Renderer-only consumer
   * (F3 launches projectiles on `release` + moves impact VFX to `impact`;
   * F4 sequences the rogue gambit). Carries NO damage — that still rides
   * `unit:attacked` / `unit:healed`. `targetId` is set for homing actions
   * (strikes, catapult), `targetCell` for ground-target / fixed-cell actions
   * (mage); both omitted for self / no-target actions (heal-self, move,
   * spawn). No sim/run subscriber exists in F2, so emitting it cannot perturb
   * the deterministic sim or the fuzz baseline.
   */
  'action:phase': {
    unitId: number;
    actionId: string;
    phase: ActionPhaseName;
    targetId?: number | undefined;
    targetCell?: GridCoord | undefined;
  };

  /**
   * J1 — the player team's shared objective was set (or replaced) on the
   * battle, via the `setObjective` `WorldCommand`. Carries the new objective
   * (a tile or an enemy unit) so the J3 UI can render its marker. Sim-side
   * the objective only steers player units when they're not already engaged
   * (see `Targeting.ts`).
   */
  'objective:set': { objective: BattleObjective };
  /**
   * J1 — the shared objective was cleared, either explicitly (the
   * `clearObjective` command) or automatically when an `enemy` objective's
   * target died (`World.clearObjectiveIfResolved`). A `tile` objective never
   * auto-clears (persist-until-cleared). Idempotent emit guard on the World
   * side means this fires only on a real null transition.
   */
  'objective:cleared': Record<string, never>;

  'run:started': { seed: number };
  'run:victory': Record<string, never>;
  'run:defeated': Record<string, never>;

  'recruit:offered': { units: UnitTemplate[] };

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
   * K3 — also carries `redraw`: this turn's redraw availability (actions +
   * cards remaining, 0/0 when the config disables it), so the screen renders
   * the redraw control without a follow-up Run query.
   *
   * K3.5 — also carries `map`: the ENCOUNTER's battlefield (one map per
   * encounter as of K3.5, rolled at encounter start), so the redraw decision
   * is made knowing the field. Inline structural shape rather than the Run
   * `EncounterMap` type to keep core → run imports type-light (the terrain
   * seed is deliberately omitted — presentation needs name/size/theme only).
   *
   * K4 — also carries `empower` (this turn's empower availability) +
   * `empowerMagnitudes` (parallel to `hand`: each card's accumulated empower
   * stack on its roster slot, 0 = unbuffed), so the screen can badge a card
   * that was empowered on an EARLIER turn of the encounter and drawn back.
   */
  'turn:starting': {
    turn: number; // 1-based, within the current encounter
    floor: number;
    playerHealth: number;
    playerHealthMax: number;
    enemyHealth: number;
    enemyHealthMax: number;
    hand: UnitTemplate[];
    redraw: RedrawAvailability;
    empower: EmpowerAvailability;
    /** K4 — per-hand-position empower stacks (0 = none), see `turn:starting`. */
    empowerMagnitudes: number[];
    /** L1 — the run's daemon (null = daemon-less), for the pre-turn banner.
     *  Inline structural shape (the `map` convention). Per-turn grant state is
     *  NOT a separate field — it's what `redraw`/`empower` availability
     *  already say (a denied Mercury flip reads as 0/0); `redrawGate`/
     *  `empowerGate` say whether the daemon HAS each gate at all, so the
     *  screen can tell "denied this turn" (gate exists, fresh budget 0) from
     *  "this idol never grants it". `empowerBuff` is the daemon's OWN buff
     *  mods for the hint/badge text (payload-carried so a bespoke non-catalog
     *  daemon renders correctly — the events-only discipline). */
    daemon: {
      id: string;
      name: string;
      description: string;
      redrawGate: boolean;
      empowerGate: boolean;
      empowerBuff: StatusEffect['mods'] | null;
    } | null;
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
    redraw: RedrawAvailability;
    empowerMagnitudes: number[];
  };

  /**
   * K4 — an `empowerUnit` command landed at the pre-turn gate: the selected
   * card's roster slot gained the configured buff for the rest of the
   * encounter. Carries the decremented availability + the full per-hand
   * stack column (`empowerMagnitudes`, parallel to the unchanged hand) so
   * the pre-turn screen updates its badge + control state in place. Only
   * ever fires during `turn-intro` (the command is phase-gated).
   */
  'turn:unitEmpowered': {
    handIndex: number;
    empower: EmpowerAvailability;
    empowerMagnitudes: number[];
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
