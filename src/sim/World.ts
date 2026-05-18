import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import { GRID_SIZE } from '../config';
import { Unit, type Team, type UnitTemplate } from './Unit';
import type { ActionProposal } from './Action';
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
  private _ended = false;

  constructor(bus: EventBus<GameEvents>, rng: RNG, gridSize: number = GRID_SIZE) {
    this.bus = bus;
    this.rng = rng;
    this.gridSize = gridSize;
  }

  get currentTick(): number {
    return this.tickCount;
  }

  get ended(): boolean {
    return this._ended;
  }

  /**
   * Behaviors and actions call this to publish sim events (unit:moved,
   * unit:attacked, etc.) without holding a reference to the bus.
   */
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.bus.emit(event, payload);
  }

  /**
   * Advance the simulation by one tick. Per-unit step (in snapshot
   * iteration order, so DeathBehavior-style splicing doesn't skip
   * neighbours):
   *
   *   1. Death short-circuit. `currentHp <= 0` → emit unit:died, remove
   *      from world, continue. Used to live in DeathBehavior; folded in
   *      here at A1 because a dead unit can't choose to do anything else.
   *   2. Decrement per-action cooldown counters by 1 (capped at 0).
   *   3. If an action is in flight (`activeAction != null`): fire any
   *      `applyEffect` calls due at the current tick offset; if
   *      `currentTick >= finishTick`, clear `activeAction`; otherwise
   *      skip the selector (unit is busy).
   *   4. Otherwise run the selector: poll every behavior, filter
   *      proposals whose action is still on cooldown, pick the highest
   *      score. Apply: set per-action cooldown to the proposal's value,
   *      set activeAction with `startTick`/`finishTick`/`effectTicks`,
   *      call `action.start(unit, world)`.
   *
   * Cooldown semantics are still decrement-then-check: behaviors set the
   * proposal's cooldown to the *full* value (not N-1), and World
   * decrements once per tick before the selector runs.
   */
  tick(): void {
    if (this._ended) return;
    this.tickCount++;
    this.bus.emit('tick', { tick: this.tickCount });

    for (const unit of this.units.slice()) {
      // 1. Death.
      if (unit.currentHp <= 0) {
        this.removeUnit(unit.id);
        this.bus.emit('unit:died', { unitId: unit.id });
        continue;
      }

      // 2. Decrement per-action cooldowns.
      for (const [actionId, cd] of unit.actionCooldowns) {
        if (cd > 0) unit.actionCooldowns.set(actionId, cd - 1);
      }

      // 3. In-flight action.
      if (unit.activeAction !== null) {
        const offset = this.tickCount - unit.activeAction.startTick;
        if (
          unit.activeAction.effectTicks.includes(offset) &&
          unit.activeAction.action.applyEffect
        ) {
          unit.activeAction.action.applyEffect(unit, this, offset);
        }
        if (this.tickCount >= unit.activeAction.finishTick) {
          unit.activeAction = null;
        } else {
          continue;
        }
      }

      // 4. Selector.
      let best: ActionProposal | null = null;
      for (const behavior of unit.behaviors) {
        const proposal = behavior.proposeAction(unit, this);
        if (proposal === null) continue;
        const remainingCd = unit.actionCooldowns.get(proposal.action.id) ?? 0;
        if (remainingCd > 0) continue;
        if (best === null || proposal.score > best.score) best = proposal;
      }
      if (best === null) continue;

      unit.actionCooldowns.set(best.action.id, best.cooldown);
      unit.activeAction = {
        action: best.action,
        startTick: this.tickCount,
        finishTick: this.tickCount + best.duration,
        effectTicks: best.effectTicks ?? [],
      };
      best.action.start(unit, this);
    }

    this.checkBattleEnd();
  }

  private checkBattleEnd(): void {
    // Empty world isn't "battle over" — it's "no battle yet." Guards the
    // pre-spawn ticks and the (currently impossible, but theoretical)
    // mutual-annihilation case where both teams hit 0 in the same tick.
    if (this.units.length === 0) return;
    let playerAlive = false;
    let enemyAlive = false;
    for (const u of this.units) {
      if (u.team === 'player') playerAlive = true;
      else enemyAlive = true;
      if (playerAlive && enemyAlive) return;
    }
    const winner: Team = playerAlive ? 'player' : 'enemy';
    this._ended = true;
    this.bus.emit('battle:ended', { winner });
  }

  removeUnit(id: number): void {
    const i = this.units.findIndex((u) => u.id === id);
    if (i >= 0) this.units.splice(i, 1);
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
