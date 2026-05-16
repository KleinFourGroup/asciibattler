import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { RNG } from '../core/RNG';
import { GRID_SIZE } from '../config';

/**
 * Battle state: grid, units, current tick. Owns the battle's RNG (forked from
 * the run RNG at Step 4.3) so combat rolls don't perturb the run stream.
 * Serializable.
 *
 * Step 3.1 ships only the tick counter + event emission; units and behaviors
 * land in 3.2+.
 */
export class World {
  readonly gridSize: number;
  readonly rng: RNG;
  // TODO(3.2): retype as Unit[] once Unit.ts is fleshed out.
  readonly units: unknown[] = [];

  private readonly bus: EventBus<GameEvents>;
  private tickCount = 0;

  constructor(bus: EventBus<GameEvents>, rng: RNG, gridSize: number = GRID_SIZE) {
    this.bus = bus;
    this.rng = rng;
    this.gridSize = gridSize;
  }

  get currentTick(): number {
    return this.tickCount;
  }

  /** Advance the simulation by one tick. Emits `tick` with the new counter. */
  tick(): void {
    this.tickCount++;
    this.bus.emit('tick', { tick: this.tickCount });
  }
}
