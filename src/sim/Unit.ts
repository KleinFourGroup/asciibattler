import type { GridCoord } from '../core/types';
// Type-only — World imports Unit too, but TS resolves type-only cycles fine.
import type { World } from './World';

export type Team = 'player' | 'enemy';

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
 * Behaviors run in order on every tick. For MVP, every unit will end up with
 * [MovementBehavior, AttackBehavior, DeathBehavior] (Steps 3.5–3.8); new unit
 * kinds post-MVP add or swap behaviors rather than subclassing.
 */
export interface Behavior {
  update(unit: Unit, world: World): void;
}

export interface UnitInit {
  readonly id: number;
  readonly team: Team;
  readonly glyph: string;
  readonly stats: UnitStats;
  readonly position: GridCoord;
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
   * Shared cooldown across all action behaviors (movement, attack, …). Each
   * behavior sets it to its own stat-driven value after acting, so a unit
   * can only take one action per "decision" — no move-and-attack in the
   * same tick. World.tick() decrements it once per tick before behaviors
   * run.
   */
  actionCooldown = 0;

  constructor(init: UnitInit) {
    this.id = init.id;
    this.team = init.team;
    this.glyph = init.glyph;
    this.stats = init.stats;
    this.position = init.position;
    this.currentHp = init.stats.maxHp;
  }
}
