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

export interface UnitStats {
  readonly maxHp: number;
  readonly attackDamage: number;
  readonly attackRange: number;
  /** Ticks between consecutive attacks. Authored in seconds, see archetypes.ts. */
  readonly attackCooldownTicks: number;
  /** Ticks between consecutive moves. Authored in seconds, see archetypes.ts. */
  readonly moveCooldownTicks: number;
}

/**
 * Pre-instantiation description of a unit: archetype + rolled stats. The
 * recruitment screen surfaces these as options; choosing one creates a `Unit`.
 */
export interface UnitTemplate {
  readonly archetype: 'melee' | 'ranged';
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
  readonly glyph: string;
  readonly stats: UnitStats;
  readonly position: GridCoord;
  /** D6: defaults to `true` so existing combatants + walls keep their
   *  LOS-blocking behavior. Half-cover sets this to `false`. */
  readonly blocksLineOfSight?: boolean;
}

export class Unit {
  readonly id: number;
  readonly team: Team;
  readonly glyph: string;
  readonly stats: UnitStats;
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
    this.glyph = init.glyph;
    this.stats = init.stats;
    this.position = init.position;
    this.currentHp = init.stats.maxHp;
    this.blocksLineOfSight = init.blocksLineOfSight ?? true;
  }
}
