import type { GridCoord } from '../core/types';
// Type-only — World imports Unit too, but TS resolves type-only cycles fine.
import type { World } from './World';
import type { ActionProposal, ActiveAction } from './Action';
import type { Ability } from './abilities/Ability';
// Value imports: `stats.ts` and `statusEffects.ts` only type-import Unit, so
// the cycle is type-only at runtime (pure functions, called from methods,
// never at module init): no initialization-order hazard.
import { deriveStats } from './stats';
import { foldEffects, cloneEffect, mergeEffectInto } from './statusEffects';
import type { StatusEffect } from './statusEffects';

/** The shared empty return for `expireEffects` when nothing expired, so the
 *  common path allocates nothing. */
const NO_EFFECTS: readonly StatusEffect[] = [];

/**
 * A unit's side. `neutral` is what belongs to neither team: scenery (walls,
 * half-cover, rubble) and camp members (`campId`). `World.checkBattleEnd`
 * counts no neutral toward either side.
 */
export type Team = 'player' | 'enemy' | 'neutral';

/**
 * An archetype id: any id in the unit catalog (`config/units.json`),
 * combatant or neutral (a wall's is `'wall'`), so `unit.archetype` answers
 * config questions for every unit. A string, not a union: the catalog is
 * validated at load (`src/config/units.ts`, which also asserts the ids the
 * game names), so a new unit kind is a JSON entry with no code edit
 * (`tools/archetype-editor/`).
 */
export type Archetype = string;
/** The archetype tag a `Unit` and its snapshot store, an alias of
 *  `Archetype`. The accessors in `archetypes.ts` answer an id the combatant
 *  catalog lacks with the neutral default (targeting `nearest`, a minimum
 *  range of 0, rarity `common`, the id as its name). */
export type UnitArchetype = Archetype;

/**
 * Whether a unit is a camp member: a neutral with a `campId`, which wanders,
 * aggroes, fights and earns its killer XP. Structural, so a `Unit` and a
 * `UnitSnapshot` both qualify. Only its test calls it; the sim asks
 * `isInertNeutral` or reads `campId`.
 */
export function isActiveNeutral(unit: { team: Team; campId: number | null }): boolean {
  return unit.team === 'neutral' && unit.campId !== null;
}

/**
 * Whether a unit is scenery: a neutral without a `campId` (a wall,
 * half-cover, rubble), which every spatial query treats as a hard blocker.
 * A camp member is not, so its body prices as a moving unit's (a soft
 * cost), not as terrain.
 */
export function isInertNeutral(unit: { team: Team; campId: number | null }): boolean {
  return unit.team === 'neutral' && unit.campId === null;
}

/**
 * A unit's base stats, the values that grow with its level. The battle's
 * derived numbers (maxHp, the move cooldown, the engagement range) are on
 * `UnitDerived`, computed from these by `deriveStats` (`stats.ts`). A
 * closed set of named fields, not a map: adding a stat is one schema bump,
 * and the type checker finds every reader that must react.
 */
export interface UnitStats {
  readonly constitution: number;
  readonly strength: number;
  readonly ranged: number;
  readonly magic: number;
  readonly luck: number;
  /** Flat mitigation: a hit lands `max(STATS.minDamage, rawDamage − defense)`
   *  after the crit (`World.dealDamage`); damage with `bypassDefense` skips
   *  it. Read raw, with no derived layer. At least 0. */
  readonly defense: number;
  /** Raises the chance this unit's evadable hits land, against the target's
   *  `evasion` (`hitChanceFor`, rolled in `World.applyDamage`). At least 0. */
  readonly precision: number;
  /** Lowers the chance an evadable hit on this unit lands, against the
   *  attacker's `precision`. At least 0. */
  readonly evasion: number;
  /** The attack cadence: higher is faster swings, shots and casts, through
   *  `attackCooldownTicksFor` on each ability's cooldown. At least 0. */
  readonly speed: number;
  /** The move cadence, signed: 0 is the baseline, positive faster, negative
   *  slower (the slowest units ship at −14). Drives `moveCooldownTicks`
   *  through `deriveStats`. */
  readonly mobility: number;
  /** What the unit counts for in a turn's chip of a health pool, as one of
   *  the fallen, or as a survivor of a capped turn (`run/chipRule.ts`).
   *  Levels like any stat; no damage path reads it. */
  readonly power: number;
}

/**
 * The values derived from `UnitStats` and the archetype (`deriveStats`):
 * computed at spawn, and again by `Unit.refreshDerived` when a status
 * changes a stat behind them. Neither crit nor the attack cadence is here:
 * each is per ability (`critChanceFor`, `attackCooldownTicksFor`).
 */
export interface UnitDerived {
  readonly maxHp: number;
  readonly moveCooldownTicks: number;
  /**
   * The engagement range: the largest reach among the unit's engaging
   * abilities (`rangeForArchetype`), passed through `deriveStats`.
   * `MovementBehavior`'s in-range abstain and the HUD and audio read it;
   * whether one ability can reach is that ability's own range, checked as
   * it proposes (`effects/propose.ts`).
   */
  readonly attackRange: number;
}

/**
 * A unit before it is placed: archetype, levelled stats and level. The
 * recruit screen offers these; placing one makes a `Unit`. Derived values
 * are not carried: they are computed at spawn (`deriveStats`), so no
 * template carries a stale one.
 *
 * `stats` is the block after the level-ups (`simulateLevelUps` for a
 * player's unit, `scaleStats` for an enemy's), so `level` is for display
 * and the round trip, not a modifier. A level-1 template carries the base
 * stats as they are.
 */
export interface UnitTemplate {
  readonly archetype: Archetype;
  readonly level: number;
  readonly stats: UnitStats;
  /**
   * XP banked toward the next level, kept on the roster across battles
   * (`Run.team`). An enemy carries 0: it levels by `scaleStats`
   * (`scaledUnit`), never by XP. A recruit and the starting team begin
   * at 0.
   */
  readonly xp: number;
  /**
   * A player unit's roster slot, its index in `run.team`, stamped on the
   * turn's template copy by `Run.beginTurn`; null or absent for an enemy.
   * The spawn queue keeps it, so a queued unit carries its slot. Optional,
   * so an inline `{ archetype, level, stats, xp }` needn't pass a null.
   */
  readonly rosterIndex?: number | null;
  /**
   * The statuses the unit spawns with (fatigue, an encounter's buff),
   * stamped on the turn's template copy by `Run.beginTurn`, never on the
   * roster (`Run.team`), so they stay out of the RunSnapshot's roster: the
   * roster carries no battle state.
   */
  readonly effects?: readonly StatusEffect[];
}

/**
 * A unit's decision component. Each tick the selector polls every behaviour
 * for an `ActionProposal` and the highest score wins; `null` is an
 * abstention (a precondition unmet, a target gone), not a vote against.
 *
 * The selector gates cooldowns through `unit.actionCooldowns`, so a
 * behaviour needn't read them. A behaviour holds no state across ticks, so
 * one instance could serve every unit; each unit gets its own all the same
 * (`World.wireSpawned`).
 *
 * `kind` is the registry key a snapshot rehydrates the unit's behaviours
 * by: a new behaviour declares a unique `kind` and registers a factory in
 * `behaviors/registry.ts`.
 */
export interface Behavior {
  readonly kind: string;
  proposeAction(unit: Unit, world: World): ActionProposal | null;
}

/** What `Unit`'s constructor takes. A field named as one of `Unit`'s is that
 *  field. The optional ones default to no effects, `blocksLineOfSight`
 *  true, `targeting` `'nearest'`, `level` 1, `xp` 0, and null for
 *  `rosterIndex`, `summonedBy` and `campId`. */
interface UnitInit {
  readonly id: number;
  readonly team: Team;
  readonly archetype: UnitArchetype;
  readonly glyph: string;
  readonly stats: UnitStats;
  readonly derived: UnitDerived;
  readonly position: GridCoord;
  readonly effects?: readonly StatusEffect[];
  readonly blocksLineOfSight?: boolean;
  readonly targeting?: string;
  readonly level?: number;
  readonly xp?: number;
  readonly rosterIndex?: number | null;
  readonly summonedBy?: number | null;
  readonly campId?: number | null;
}

export class Unit {
  readonly id: number;
  readonly team: Team;
  readonly archetype: UnitArchetype;
  readonly glyph: string;
  /**
   * The base stats, levelled but unmodified. Statuses fold over them in
   * `effectiveStats`; `stats` itself never changes, so it is the value the
   * snapshot and the display take.
   */
  readonly stats: UnitStats;
  /**
   * Recomputed from `effectiveStats` by `refreshDerived` when a status
   * changes a stat behind it: Fatigued lowers constitution at spawn, and the
   * officer's `inspired` raises mobility mid-battle.
   */
  derived: UnitDerived;
  /**
   * The level, which `stats` already reflects; kept for the HUD, the
   * recruit card and the round trip. Scenery carries 1.
   */
  readonly level: number;
  /**
   * The XP banked when the unit spawned, for the HUD during the battle; a
   * battle's `xpAwards` are banked on the roster's template, not here.
   */
  readonly xp: number;
  /**
   * The index in `Run.team` for a player unit; null for an enemy or
   * scenery. Carried into `xpAwards`, so Run banks into the right slot at
   * `battle:ended` without a map of its own.
   */
  readonly rosterIndex: number | null;
  /**
   * The id of the caster whose `summon` op spawned this unit, or null.
   * `World.liveSummonCount` reads it for the caster's `maxLive`. A dead
   * summoner's summons live out their lifetimes: the count filters by
   * living units, and a dead caster proposes nothing.
   */
  readonly summonedBy: number | null;
  /**
   * The camp this unit belongs to, or null. A neutral with one is a camp
   * member, a neutral without one is scenery (`isInertNeutral`). The camp's
   * own state (hostility, anchor, pending members) lives in the World's
   * camps, keyed by this id, never on the unit.
   */
  readonly campId: number | null;
  position: GridCoord;
  currentHp: number;
  readonly behaviors: Behavior[] = [];
  /**
   * The unit's abilities, from its archetype (`abilityIdsForArchetype`) at
   * spawn. `AbilityBehavior` walks them each tick, and on a tied score the
   * earlier wins. Snapshotted as ids, rehydrated by `createAbility`
   * (`abilities/registry.ts`).
   */
  readonly abilities: Ability[] = [];
  /**
   * When false, a shot sees through the unit (half-cover). Pathing still
   * treats it as a blocker, since every unit blocks: half-cover is
   * shoot-over, not walk-through. True for combatants and walls.
   */
  readonly blocksLineOfSight: boolean;
  /**
   * Target-selection strategy id, resolved at spawn from the archetype (see
   * `src/sim/targetingStrategies.ts`). `Targeting.ts` reads it to pick + stick
   * to targets. Static per archetype, so it is not snapshotted: `fromJSON`
   * re-derives it from `archetype`. Defaults to `'nearest'`.
   */
  readonly targeting: string;
  /**
   * The cooldowns, keyed by a proposal's `cooldownKey` (an ability's id) or
   * else its action's id. World decrements them once a tick, and the
   * selector drops a proposal whose cooldown is above 0. A missing key is 0.
   */
  readonly actionCooldowns = new Map<string, number>();
  /**
   * The action in flight, which locks out the selector until
   * `currentTick >= finishTick`; null when the unit is free. Read-only from
   * outside: every write goes through World's `seatAction`,
   * `seatActiveAction` and `clearActiveAction`, which keep the
   * reserved-partner index in step, so a direct assignment fails to compile.
   */
  private _activeAction: ActiveAction | null = null;
  get activeAction(): ActiveAction | null {
    return this._activeAction;
  }
  /**
   * @internal The raw write behind World's seat and clear. Only they may
   * call it, since they keep the reserved-partner index; a call anywhere
   * else desyncs it, which the test's rescan (`scanReservedSwapPartners`)
   * would catch.
   */
  _setActiveAction(aa: ActiveAction | null): void {
    this._activeAction = aa;
  }
  /**
   * The unit this one is committed to targeting, or null (it takes one at
   * the next update). `updateTarget` sets it, once a tick per free unit;
   * `MovementBehavior` and the abilities read it through `currentTarget`
   * rather than finding the nearest enemy every tick, which made units
   * thrash between targets in corridors.
   */
  targetId: number | null = null;
  /**
   * Consecutive ticks the target has been out of line of sight, for the
   * ranged re-target timeout (`updateTarget`); reset when sight holds or
   * the target changes. Only ranged units read it, but every unit's is
   * snapshotted, for replay.
   */
  outOfLosTicks = 0;
  /**
   * The active statuses, changed in place by `addEffect` (a merge),
   * `removeEffect` and `expireEffects`, folded into `effectiveStats` and
   * snapshotted. Empty in the common case, and then `effectiveStats` is
   * `stats`.
   */
  readonly effects: StatusEffect[] = [];
  /**
   * The cached fold of `stats` and `effects`, recomputed whenever the
   * effects change. Null when there are none, and the getter returns `stats`
   * itself, so the common path costs nothing.
   */
  private _effectiveStats: UnitStats | null = null;

  constructor(init: UnitInit) {
    this.id = init.id;
    this.team = init.team;
    this.archetype = init.archetype;
    this.glyph = init.glyph;
    this.stats = init.stats;
    this.derived = init.derived;
    this.position = init.position;
    this.currentHp = init.derived.maxHp;
    this.blocksLineOfSight = init.blocksLineOfSight ?? true;
    this.targeting = init.targeting ?? 'nearest';
    this.level = init.level ?? 1;
    this.xp = init.xp ?? 0;
    this.rosterIndex = init.rosterIndex ?? null;
    this.summonedBy = init.summonedBy ?? null;
    this.campId = init.campId ?? null;
    // The spawn statuses, or a rehydrate's. `currentHp` was set to the base
    // maxHp above, and the recompute derives maxHp from the folded stats, so
    // a status that lowers constitution (Fatigued) would leave the unit
    // spawning over its max without the clamp. A rehydrate overwrites
    // `currentHp` after construction anyway.
    if (init.effects && init.effects.length > 0) {
      for (const effect of init.effects) this.effects.push(cloneEffect(effect));
      this.recomputeEffective();
      this.currentHp = Math.min(this.currentHp, this.derived.maxHp);
    }
  }

  /**
   * The stats with the statuses folded in; `stats` itself when there are
   * none. Every combat, cadence and crit read takes this, not `stats`.
   */
  get effectiveStats(): UnitStats {
    return this._effectiveStats ?? this.stats;
  }

  /**
   * Applies a status effect under its merge policy. A non-`independent`
   * effect whose `key` is already present combines magnitudes per the policy
   * (`replace` / `add` / `multiply`) and refreshes the lifetime; otherwise the
   * effect is added as a fresh instance. Recomputes `effectiveStats` after.
   */
  addEffect(effect: StatusEffect): void {
    mergeEffectInto(this.effects, effect);
    this.recomputeEffective();
  }

  /**
   * Removes the first effect with `key` and returns it, or undefined: a
   * removal that isn't a lifetime's end, such as water putting out a burn.
   * Recomputes only when something went. The caller
   * (`World.removeStatusEffect`) emits `status:expired`.
   */
  removeEffect(key: string): StatusEffect | undefined {
    const i = this.effects.findIndex((e) => e.key === key);
    if (i === -1) return undefined;
    const [removed] = this.effects.splice(i, 1);
    this.recomputeEffective();
    return removed;
  }

  /**
   * Drops every `ticks` effect whose `expiresAtTick` has come; an
   * `endOfTurn` effect is never dropped here, since it lives as long as the
   * World. Recomputes only when something expired. Returns what it dropped,
   * so `World.tick` can emit `status:expired` for those with a def; when
   * nothing expired, a shared empty array, so a tick allocates nothing.
   */
  expireEffects(currentTick: number): readonly StatusEffect[] {
    let removed: StatusEffect[] | null = null;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const lifetime = this.effects[i]!.lifetime;
      if (lifetime.kind === 'ticks' && currentTick >= lifetime.expiresAtTick) {
        (removed ??= []).push(this.effects[i]!);
        this.effects.splice(i, 1);
      }
    }
    if (removed) this.recomputeEffective();
    return removed ?? NO_EFFECTS;
  }

  /**
   * Recomputes `derived` from `effectiveStats`. A status that leaves
   * constitution and mobility alone, the only stats behind `derived`,
   * changes nothing. Only Fatigued changes constitution, seeded at spawn
   * (`endOfTurn`), and the constructor clamps `currentHp` after it; a status
   * applied mid-battle that lowered constitution would need the clamp here
   * too.
   */
  refreshDerived(): void {
    this.derived = deriveStats(this.effectiveStats, this.derived.attackRange);
  }

  /** Re-fold `stats` + `effects` into the cache and refresh derived. Empty
   *  effect set → cache cleared to `null` so the getter returns base `stats`. */
  private recomputeEffective(): void {
    this._effectiveStats = this.effects.length > 0 ? foldEffects(this.stats, this.effects) : null;
    this.refreshDerived();
  }
}
