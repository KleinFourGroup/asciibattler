import type { GridCoord } from '../core/types';
// Type-only — World imports Unit too, but TS resolves type-only cycles fine.
import type { World } from './World';
import type { ActionProposal, ActiveAction } from './Action';
import type { Ability } from './abilities/Ability';

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
 */
export type Archetype = 'melee' | 'ranged';
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
  readonly speed: number;
  readonly endurance: number;
}

/**
 * E1 — values derived once at construction time from `UnitStats` plus
 * archetype context (attackRange is the max over the unit's abilities'
 * ranges, not computed from any stat). Treated as a snapshot — recompute via
 * `deriveStats` when stats change (level-up, future status effects).
 * Crit RNG rolls happen at action-start in AttackAction, NOT here;
 * `critChance` is just the probability that gets fed into that roll.
 */
export interface UnitDerived {
  readonly maxHp: number;
  /** Probability in `[0, STATS.critCap]` that a basic strike crits. */
  readonly critChance: number;
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
   * level via XP, only via `scaleStats` on rollEnemyTeam). New
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
  /** D6: defaults to `true` so existing combatants + walls keep their
   *  LOS-blocking behavior. Half-cover sets this to `false`. */
  readonly blocksLineOfSight?: boolean;
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
  readonly stats: UnitStats;
  readonly derived: UnitDerived;
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
    this.level = init.level ?? 1;
    this.xp = init.xp ?? 0;
    this.rosterIndex = init.rosterIndex ?? null;
  }
}
