import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import { GRID_SIZE } from '../config';
import { Unit, type Team, type UnitTemplate } from './Unit';
import { glyphForArchetype } from './archetypes';

/**
 * Battle state: grid, units, current tick. Owns the battle's RNG (forked from
 * the run RNG at Step 4.3) so combat rolls don't perturb the run stream.
 * Serializable.
 */
export class World {
  readonly gridSize: number;
  readonly rng: RNG;
  readonly units: Unit[] = [];

  private readonly bus: EventBus<GameEvents>;
  private tickCount = 0;
  private nextUnitId = 1;

  constructor(bus: EventBus<GameEvents>, rng: RNG, gridSize: number = GRID_SIZE) {
    this.bus = bus;
    this.rng = rng;
    this.gridSize = gridSize;
  }

  get currentTick(): number {
    return this.tickCount;
  }

  /**
   * Behaviors call this to publish sim events (unit:moved, unit:attacked,
   * etc.) without holding a reference to the bus. The signature is the
   * EventBus.emit one — the World is just a passthrough.
   */
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.bus.emit(event, payload);
  }

  /**
   * Advance the simulation by one tick. Emits `tick` with the new counter,
   * then runs every unit's behaviors in insertion order.
   */
  tick(): void {
    this.tickCount++;
    this.bus.emit('tick', { tick: this.tickCount });
    for (const unit of this.units) {
      if (unit.actionCooldown > 0) unit.actionCooldown--;
      for (const behavior of unit.behaviors) {
        behavior.update(unit, this);
      }
    }
  }

  /**
   * Instantiate a unit from a rolled template and place it on the grid.
   * Glyph is derived from archetype; color is a renderer-side concern keyed
   * off `team` (see render/BattleRenderer.ts).
   */
  spawnUnit(template: UnitTemplate, team: Team, position: GridCoord): Unit {
    const unit = new Unit({
      id: this.nextUnitId++,
      team,
      glyph: glyphForArchetype(template.archetype),
      stats: template.stats,
      position,
    });
    this.units.push(unit);
    this.bus.emit('unit:spawned', { unitId: unit.id });
    return unit;
  }

  findUnit(id: number): Unit | undefined {
    return this.units.find((u) => u.id === id);
  }
}
