import type { GridCoord } from '../core/types';
// Type-only — World imports Unit too, but TS resolves type-only cycles fine.
import type { World } from './World';
import type { ActionProposal, ActiveAction } from './Action';
import type { Ability } from './abilities/Ability';
// Value imports: `stats.ts` / `statusEffects.ts` only TYPE-import Unit, so this
// is a type-only cycle at runtime (these are pure functions called lazily from
// methods, never at module init) — no initialization-order hazard.
import { deriveStats } from './stats';
import { foldEffects, combineMagnitude, cloneEffect } from './statusEffects';
import type { StatusEffect } from './statusEffects';

/**
 * Combatant alignment. `'neutral'` is for environment entities (walls,
 * future healing shrines, hazards) — Targeting ignores neutrals when
 * picking enemies, HUD doesn't list them in either roster, and
 * `World.checkBattleEnd` doesn't count them toward either side's
 * "alive?" check. See HANDOFF `src/sim/Unit.ts` notes on C1a.
 */
export type Team = 'player' | 'enemy' | 'neutral';

/**
 * E1 — combatant archetype tag, the same closed set the UnitTemplate
 * + archetype config carry. The extra `'environment'` variant covers
 * walls + half-cover (neutrals with no abilities) so a single
 * `unit.archetype` lookup answers "which stat drives a basic strike?"
 * without needing the caller to branch on team first.
 *
 * I5 — the single `'melee'` archetype (renamed `'mercenary'`) split into a
 * family of melee subclasses (`mercenary` = the old melee baseline, `adventurer` =
 * dodge bruiser, `ronin` = crit duelist, `bandit` = low-growth enemy
 * fodder), now that the I1/I2 dodge stats can differentiate them. All
 * four carry `melee_strike`; they diverge only in stats. `bandit` is the
 * default melee *enemy* (the player/enemy-symmetry break the brief wanted).
 */
export type Archetype =
  | 'mercenary'
  | 'adventurer'
  | 'ronin'
  | 'bandit'
  | 'ranged'
  | 'rogue'
  | 'healer'
  | 'mage'
  | 'catapult';
export type UnitArchetype = Archetype | 'environment';

/**
 * E1 — per-unit base stat block. Replaces the MVP `{maxHp, attackDamage,
 * attackRange, attackCooldownTicks, moveCooldownTicks}` shape. These
 * are the values that grow via level-up (E3); battle-time numbers
 * (maxHp, cooldown ticks, crit chance) live on `UnitDerived` and
 * recompute from this block via `deriveStats` in `src/sim/stats.ts`.
 *
 * Closed set of named fields, not a `Map<string, number>`: adding a
 * stat is one schema bump, and the type system surfaces every consumer
 * that needs to react.
 */
export interface UnitStats {
  readonly constitution: number;
  readonly strength: number;
  readonly ranged: number;
  readonly magic: number;
  readonly luck: number;
  /** GP2: flat damage mitigation. Subtractive with a floor — an incoming hit
   *  lands `max(STATS.minDamage, rawDamage − defense)` (post-crit, post-cover),
   *  applied in `World.applyDamage`. Consumed raw (no derived layer).
   *  Nonnegative; environmental fire/chasm damage is UNMITIGATED. (I1 reordered
   *  it up next to `luck` so the direct-combat stats group before dodge/cadence.) */
  readonly defense: number;
  /** I1: dodge — the hit-chance numerator. A unit's `precision` raises the
   *  chance its attacks land (weighed against the target's `evasion`), rolled in
   *  `World.applyDamage`. Behavior-NEUTRAL until I2 wires the hit/miss roll.
   *  Nonnegative. */
  readonly precision: number;
  /** I1: dodge — the hit-chance denominator. A unit's `evasion` lowers the
   *  chance an incoming attack lands (weighed against the attacker's
   *  `precision`). Behavior-NEUTRAL until I2. Nonnegative. */
  readonly evasion: number;
  /** I1: per-ability attack-cadence dial (GP1 had named it `agility`; reverted
   *  here because `agility` read as "dodge chance" once the real dodge stats
   *  arrived). Higher → faster swings/shots/casts, via `attackCooldownTicksFor`.
   *  Nonnegative. */
  readonly speed: number;
  /** GP1: move-cadence dial (was `endurance`). SIGNED — 0 is the universal
   *  move-CD baseline, positive is faster, negative is slower (heavy units
   *  around −7). Drives `moveCooldownTicks` via `deriveStats`. */
  readonly mobility: number;
  /** H1: Phase-H pool-chip stat. A turn's surviving units chip the *opposing*
   *  health pool by their Σ`power` (player pool / encounter enemy pool). Levels
   *  like any other stat (additive growth). Behavior-NEUTRAL until H4 wires the
   *  turn/encounter loop — no `deriveStats`/damage path reads it yet. */
  readonly power: number;
}

/**
 * E1 — values derived once at construction time from `UnitStats` plus
 * archetype context (attackRange is the max over the unit's abilities'
 * ranges, not computed from any stat). Treated as a snapshot — recompute via
 * `deriveStats` when stats change (level-up, future status effects).
 *
 * I6 — `critChance` left this block: crit is now resolved PER-ABILITY at
 * attack time (`critChanceFor(ability.critBase, unit.stats.luck)`, gated on
 * `ability.critable`), so there's no single per-unit crit probability to
 * derive. Removing the field changed the serialized `UnitSnapshot.derived`
 * shape → WorldSnapshot v20→v21 (same kind of derived-field removal as E5's
 * v12 `attackCooldownTicks`).
 */
export interface UnitDerived {
  readonly maxHp: number;
  readonly moveCooldownTicks: number;
  /**
   * E5 — effective engagement range: the MAX attack range over the
   * unit's abilities (range moved off the archetype onto each ability in
   * `config/abilities.json`). MovementBehavior's in-range abstain plus
   * the HUD/audio readers consult this; per-ability range gates ("can
   * THIS strike reach?") live in `proposeBasicStrike`. Computed at spawn
   * via `rangeForArchetype` and plumbed through `deriveStats`.
   */
  readonly attackRange: number;
  // E5 pre-work: attack cadence is no longer a per-unit derived value —
  // it lives on each Ability (resolved via `attackCooldownTicksFor` from
  // `config/abilities.json`) so multi-ability units can carry several
  // independent timings.
}

/**
 * Pre-instantiation description of a unit: archetype + leveled stat
 * snapshot + level metadata. The recruitment screen surfaces these as
 * options; choosing one creates a `Unit`. Derived values are NOT
 * carried on the template — they're recomputed at spawn time via
 * `deriveStats` so future per-encounter modifiers can fold in cleanly
 * without a stale-template footgun.
 *
 * E3: `stats` is the *post-level-up* block (already advanced via
 * `simulateLevelUps` for player recruits or `scaleStats` for enemies);
 * `level` is display metadata and round-trip continuity, not a runtime
 * modifier — the unit's stats already reflect its level. Level 1
 * templates carry baseStats verbatim.
 */
export interface UnitTemplate {
  readonly archetype: Archetype;
  readonly level: number;
  readonly stats: UnitStats;
  /**
   * E4 — banked XP toward the next level. Persists across battles on
   * the roster side (`Run.team`); enemies always carry 0 (they never
   * level via XP, only via `scaleStats` in `buildEnemyTeam`). New
   * recruits + the starting team begin at 0.
   */
  readonly xp: number;
  /**
   * E4 — opaque roster slot id for player units. `null` for enemies +
   * fresh roster entries that haven't been linked yet. `Run.handleEnterNode`
   * stamps each player template with its array index in `run.team`
   * when building the encounter; spawn queues round-trip the stamp so
   * overflow-queue spawns carry the same rosterIndex as their initial-
   * spawn siblings. The field stays optional so existing inline
   * `{ archetype, level, stats, xp }` callers don't have to thread a
   * null through.
   */
  readonly rosterIndex?: number | null;
}

/**
 * Decision-making component. Each tick the selector polls every behavior
 * for an `ActionProposal`; the highest-scoring valid proposal wins. A
 * behavior returns `null` to abstain (precondition unmet, target dead,
 * etc.) — the selector treats null as "this behavior has no opinion this
 * tick," not as a vote against.
 *
 * Cooldown gating is handled by the selector via `unit.actionCooldowns`,
 * not by the behavior — behaviors don't need to read cooldown state at
 * all. Behaviors are stateless across ticks; safe to share an instance
 * across units (though Game still creates one per unit for symmetry with
 * future stateful behaviors).
 *
 * `kind` is the registry key used by `World` snapshots to rehydrate a
 * unit's behaviors after JSON round-trip. New Behavior implementations
 * declare a unique string `kind` and register a factory in
 * `src/sim/behaviors/registry.ts`.
 */
export interface Behavior {
  readonly kind: string;
  proposeAction(unit: Unit, world: World): ActionProposal | null;
}

export interface UnitInit {
  readonly id: number;
  readonly team: Team;
  readonly archetype: UnitArchetype;
  readonly glyph: string;
  readonly stats: UnitStats;
  readonly derived: UnitDerived;
  readonly position: GridCoord;
  /** K1: status effects the unit spawns with (the fatigue / encounter-buff
   *  seed channel, and the snapshot-rehydrate path). Defaults to none, so
   *  direct-construction fixtures + the no-effect common case are unchanged. */
  readonly effects?: readonly StatusEffect[];
  /** D6: defaults to `true` so existing combatants + walls keep their
   *  LOS-blocking behavior. Half-cover sets this to `false`. */
  readonly blocksLineOfSight?: boolean;
  /** Target-selection strategy id (see `src/sim/targetingStrategies.ts`).
   *  Resolved at spawn from the archetype (`targetingForArchetype`) and
   *  threaded in like `glyph`/`derived`. Defaults to `'nearest'` so direct-
   *  construction test fixtures + environment entities need not pass it. */
  readonly targeting?: string;
  /** E3: defaults to `1`. Environment entities (walls, half-cover)
   *  ignore the field entirely — it's combatant display metadata. */
  readonly level?: number;
  /** E4: defaults to `0`. The banked XP the unit spawned with — display
   *  only during the battle. Run banks new XP from `xpAwards` into the
   *  roster after `battle:ended`, not back into Unit.xp. */
  readonly xp?: number;
  /** E4: defaults to `null`. Set for player-team units only — the index
   *  into `run.team` that this unit was spawned from. Carried into
   *  `xpAwards` so Run can bank XP into the right roster slot without
   *  reverse-mapping unit ids. */
  readonly rosterIndex?: number | null;
}

export class Unit {
  readonly id: number;
  readonly team: Team;
  readonly archetype: UnitArchetype;
  readonly glyph: string;
  /**
   * E1 — the unit's BASE stat block (the leveled-but-unmodified values).
   * Status effects are layered on top via `effectiveStats`; `stats` itself is
   * never mutated, so it stays the canonical snapshot/display value.
   */
  readonly stats: UnitStats;
  /**
   * K1 — derived block is no longer strictly construction-time-final: a status
   * effect that modifies `constitution` / `mobility` triggers `refreshDerived`,
   * which recomputes it from `effectiveStats`. (No K1 effect does so, so in
   * practice it's recomputed to an identical block; the seam is live for the
   * eventual temp-maxHp / temp-move-speed consumers.)
   */
  derived: UnitDerived;
  /**
   * E3 — combatant level. The unit's `stats` already reflect this
   * level (post-`simulateLevelUps` / post-`scaleStats`); the field is
   * preserved for display in the HUD + recruit card and for snapshot
   * round-trip continuity. Environment entities carry `1` as a no-op
   * default — they don't level.
   */
  readonly level: number;
  /**
   * E4 — banked XP at spawn time. Display-only during battle (HUD
   * roster reads this); new XP from a battle's `xpAwards` is banked
   * into the roster-side template, not back here.
   */
  readonly xp: number;
  /**
   * E4 — index into `Run.team` for player units; `null` for enemies
   * + environment entities. Plumbed into `xpAwards` so Run can bank
   * XP into the right roster slot at `battle:ended` without
   * maintaining its own unitId-to-rosterIndex map.
   */
  readonly rosterIndex: number | null;
  position: GridCoord;
  currentHp: number;
  readonly behaviors: Behavior[] = [];
  /**
   * E2 — per-unit ability list. `AbilityBehavior` walks this each tick
   * to pick its proposal; array order is the tiebreaker when two
   * abilities return the same score (first proposer wins). Populated
   * at spawn time from `ARCHETYPE_CONFIG[archetype].abilities`,
   * snapshotted as a `string[]` of ids and rehydrated via
   * `src/sim/abilities/registry.ts#createAbility`.
   */
  readonly abilities: Ability[] = [];
  /**
   * D6: when `false`, ranged attacks see THROUGH this unit (the
   * half-cover archetype). Pathfinding still treats it as a blocker via
   * the existing "every Unit blocks" rule — half-cover is shoot-over,
   * not walk-through. Combatants + walls default `true`.
   */
  readonly blocksLineOfSight: boolean;
  /**
   * Target-selection strategy id, resolved at spawn from the archetype (see
   * `src/sim/targetingStrategies.ts`). `Targeting.ts` reads it to pick + stick
   * to targets. Static per archetype, so it is NOT snapshotted — `fromJSON`
   * re-derives it from `archetype`. Defaults to `'nearest'`.
   */
  readonly targeting: string;
  /**
   * Per-action cooldown counters keyed by `Action.id`. Decremented once per
   * tick by World; selector filters out proposals whose remaining cooldown
   * is > 0. Missing key = 0 (never proposed before, or fully recharged).
   */
  readonly actionCooldowns = new Map<string, number>();
  /**
   * Set while an action is in flight. Locks out the selector — no new
   * proposal can fire until `currentTick >= activeAction.finishTick`. Null
   * means the unit is free to choose its next action.
   */
  activeAction: ActiveAction | null = null;
  /**
   * E5 — target stickiness. The id of the enemy this unit is currently
   * committed to. `updateTarget` (Targeting.ts, run once per free unit in
   * the selector) sets it; MovementBehavior + the strike abilities read
   * it via `currentTarget` instead of re-running nearest-enemy every
   * tick, which was the source of the corridor target-thrash combat-
   * feedback flagged. `null` = no commitment yet (resolves to nearest on
   * the next update). Snapshotted (WorldSnapshot v13).
   */
  targetId: number | null = null;
  /**
   * E5 — consecutive ticks the current target has been out of line of
   * sight. Drives the ranged re-target timeout (`updateTarget`); reset to
   * 0 whenever LOS holds or the target changes. Only ranged units read
   * it, but it's snapshotted uniformly for replay determinism.
   */
  outOfLosTicks = 0;
  /**
   * K1 — active status effects. Mutated in place by `addEffect` (merge) /
   * `expireEffects`; folded into `effectiveStats` (cached) and snapshotted.
   * Empty for the no-effect common case (then `effectiveStats === stats`).
   */
  readonly effects: StatusEffect[] = [];
  /**
   * Cached fold of `stats` + `effects`. `null` means "no effects" — the getter
   * returns the base `stats` object itself (identity-equal), keeping the
   * no-effect path byte-identical and zero-cost. Recomputed eagerly whenever
   * the effect set changes.
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
    // K1 — seed spawn-time effects (fatigue / encounter buffs / rehydrate).
    // `currentHp` was just set to the base maxHp above; no K1 effect modifies
    // `constitution`, so the recompute below leaves maxHp unchanged and that
    // currentHp stays valid (the maxHp↔currentHp clamp policy is deferred to
    // the first real temp-HP consumer).
    if (init.effects && init.effects.length > 0) {
      for (const effect of init.effects) this.effects.push(cloneEffect(effect));
      this.recomputeEffective();
    }
  }

  /**
   * K1 — the unit's stats with active effects folded in. Identity-equal to the
   * base `stats` when there are no effects (the byte-identical fast path).
   * Every combat/cadence/crit read site consults this, not `stats`.
   */
  get effectiveStats(): UnitStats {
    return this._effectiveStats ?? this.stats;
  }

  /**
   * K1 — apply a status effect, honouring its merge policy. A non-`independent`
   * effect whose `key` is already present combines magnitudes per the policy
   * (`replace` / `add` / `multiply`) and refreshes the lifetime; otherwise the
   * effect is added as a fresh instance. Recomputes `effectiveStats` after.
   */
  addEffect(effect: StatusEffect): void {
    if (effect.merge !== 'independent') {
      const existing = this.effects.find((e) => e.key === effect.key);
      if (existing) {
        existing.magnitude = combineMagnitude(effect.merge, existing.magnitude, effect.magnitude);
        existing.lifetime = { ...effect.lifetime };
        existing.mods = cloneEffect(effect).mods;
        existing.merge = effect.merge;
        this.recomputeEffective();
        return;
      }
    }
    this.effects.push(cloneEffect(effect));
    this.recomputeEffective();
  }

  /**
   * K1 — drop any `ticks` effect whose `expiresAtTick` has been reached.
   * `endOfTurn` effects are never removed here (they die with the World).
   * Recomputes `effectiveStats` only when something actually expired.
   */
  expireEffects(currentTick: number): void {
    let removed = false;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const lifetime = this.effects[i]!.lifetime;
      if (lifetime.kind === 'ticks' && currentTick >= lifetime.expiresAtTick) {
        this.effects.splice(i, 1);
        removed = true;
      }
    }
    if (removed) this.recomputeEffective();
  }

  /**
   * K1 — recompute the derived block from `effectiveStats`. A no-op in practice
   * for every K1 effect (none touch `constitution` / `mobility`, the only
   * stats that feed `derived`), but the seam is live for future temp-maxHp /
   * temp-move-speed effects — at which point this gains the currentHp clamp.
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
