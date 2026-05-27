import type { GridCoord } from '../core/types';
// Type-only — World imports Unit too, but TS resolves type-only cycles fine.
import type { World } from './World';
import type { ActionProposal, ActiveAction } from './Action';

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
 * archetype context (attackRange is a per-archetype primitive, not
 * computed from any stat). Treated as a snapshot — recompute via
 * `deriveStats` when stats change (level-up, future status effects).
 * Crit RNG rolls happen at action-start in AttackAction, NOT here;
 * `critChance` is just the probability that gets fed into that roll.
 */
export interface UnitDerived {
  readonly maxHp: number;
  /** Probability in `[0, STATS.critCap]` that a basic strike crits. */
  readonly critChance: number;
  readonly attackCooldownTicks: number;
  readonly moveCooldownTicks: number;
  /** Per-archetype primitive, plumbed through `deriveStats`. */
  readonly attackRange: number;
}

/**
 * Pre-instantiation description of a unit: archetype + base stats. The
 * recruitment screen surfaces these as options; choosing one creates a `Unit`.
 * Derived values are NOT carried on the template — they're recomputed at
 * spawn time via `deriveStats` so future per-encounter modifiers can
 * fold in cleanly without a stale-template footgun.
 */
export interface UnitTemplate {
  readonly archetype: Archetype;
  readonly stats: UnitStats;
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
}

export class Unit {
  readonly id: number;
  readonly team: Team;
  readonly archetype: UnitArchetype;
  readonly glyph: string;
  readonly stats: UnitStats;
  readonly derived: UnitDerived;
  position: GridCoord;
  currentHp: number;
  readonly behaviors: Behavior[] = [];
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
  }
}
