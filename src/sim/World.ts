import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG, type RNGSnapshot } from '../core/RNG';
import type { GridCoord } from '../core/types';
import { GRID_SIZE } from '../config';
import { Unit, type Team, type UnitStats, type UnitTemplate } from './Unit';
import type { ActionProposal } from './Action';
import { glyphForArchetype } from './archetypes';
import type { WorldCommand } from './Command';
import { createAction } from './actions/registry';
import { createBehavior } from './behaviors/registry';
import { TileGrid, type TileGridSnapshot } from './TileGrid';

const WORLD_SCHEMA_VERSION = 2;

interface ActiveActionSnapshot {
  actionId: string;
  actionData: unknown;
  startTick: number;
  finishTick: number;
  effectTicks: readonly number[];
}

export interface UnitSnapshot {
  id: number;
  team: Team;
  glyph: string;
  stats: UnitStats;
  position: GridCoord;
  currentHp: number;
  behaviors: string[];
  actionCooldowns: [string, number][];
  activeAction: ActiveActionSnapshot | null;
}

export interface WorldSnapshot {
  schemaVersion: typeof WORLD_SCHEMA_VERSION;
  gridSize: number;
  tickCount: number;
  ended: boolean;
  nextUnitId: number;
  rng: RNGSnapshot;
  units: UnitSnapshot[];
  pendingCommands: WorldCommand[];
  tileGrid: TileGridSnapshot;
}

/**
 * Battle state: grid, units, current tick. Owns the battle's RNG (forked from
 * the run RNG at Step 4.3) so combat rolls don't perturb the run stream.
 *
 * JSON-serializable end-to-end via `toJSON()` / `World.fromJSON()`. The bus
 * is intentionally NOT part of the snapshot — callers provide one at
 * rehydrate time, so a replay or a headless harness can attach its own
 * recorder.
 */
export class World {
  readonly gridSize: number;
  readonly rng: RNG;
  readonly units: Unit[] = [];
  /**
   * Per-cell tile data (floor / shallow_water). Defaults to all-floor when
   * the World is constructed without one — preserves the pre-C1a "open
   * arena" behaviour for tests and the headless fuzz harness. Battle
   * setup calls `applyTerrain` to populate it from the encounter seed.
   */
  readonly tileGrid: TileGrid;

  private readonly bus: EventBus<GameEvents>;
  private tickCount = 0;
  private nextUnitId = 1;
  private _ended = false;
  /**
   * Commands waiting to be applied at the next tick boundary. UI and the
   * headless harness push via `enqueueCommand`; `tick()` drains the queue
   * before per-unit step so the apply-point is deterministic for replay.
   */
  private readonly commands: WorldCommand[] = [];

  constructor(
    bus: EventBus<GameEvents>,
    rng: RNG,
    gridSize: number = GRID_SIZE,
    tileGrid?: TileGrid,
  ) {
    this.bus = bus;
    this.rng = rng;
    this.gridSize = gridSize;
    this.tileGrid = tileGrid ?? new TileGrid(gridSize, gridSize);
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
   * Queue a command for the next tick. Commands drain at the top of
   * `tick()`, before any per-unit step, so order is `tick N enqueued
   * commands → tick N per-unit step`. Calling this on an ended world is a
   * no-op (matches `tick()`'s short-circuit).
   */
  enqueueCommand(command: WorldCommand): void {
    if (this._ended) return;
    this.commands.push(command);
  }

  /**
   * Advance the simulation by one tick. Per-unit step (in snapshot
   * iteration order, so DeathBehavior-style splicing doesn't skip
   * neighbours):
   *
   *   0. Drain `commands` queue and apply each at a deterministic point
   *      (before per-unit step) so command-affected state is visible to
   *      every unit on the same tick.
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

    if (this.commands.length > 0) {
      const drained = this.commands.splice(0, this.commands.length);
      for (const cmd of drained) this.applyCommand(cmd);
    }

    for (const unit of this.units.slice()) {
      // 1. Death.
      if (unit.currentHp <= 0) {
        this.removeUnit(unit.id);
        this.bus.emit('unit:died', { unitId: unit.id, team: unit.team });
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

  /**
   * Currently a no-op switch — the WorldCommand union is a placeholder
   * pending C5. Kept here (rather than inlined in tick) so adding new
   * command kinds is one explicit case statement, not a tick rewrite.
   */
  private applyCommand(_command: WorldCommand): void {
    // C5 fills this in. The 'noop' kind exists so the channel can be
    // exercised by snapshot tests without coupling to gameplay yet.
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
      else if (u.team === 'enemy') enemyAlive = true;
      // Neutrals (walls, environment entities) don't count toward either
      // side — a battlefield of just walls + corpses isn't a victory.
      if (playerAlive && enemyAlive) return;
    }
    // No combatants left = mutual annihilation OR walls-only post-clear.
    // Either way, don't synthesize a winner.
    if (!playerAlive && !enemyAlive) return;
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
    return this.addUnit({
      team,
      glyph: glyphForArchetype(template.archetype),
      stats: template.stats,
      position,
    });
  }

  /**
   * Spawn an environment entity — a wall, future shrine, hazard, anything
   * that lives on the grid as a unit but isn't a combatant. Defaults to
   * the `'neutral'` team (Targeting skips, HUD ignores, checkBattleEnd
   * doesn't count) and a single-HP degenerate stat block. Has no
   * `behaviors`, so the selector never fires for it. Renderer-side
   * suppresses bloom + bars for the neutral team.
   *
   * For destructible variants (future C1b+), pass a non-trivial `maxHp`;
   * Targeting still ignores neutrals by team, so destructibility would
   * need a separate "damage walls" hook (out of scope for C1a).
   */
  spawnEnvironment(opts: {
    glyph: string;
    position: GridCoord;
    maxHp?: number;
    team?: Team;
  }): Unit {
    return this.addUnit({
      team: opts.team ?? 'neutral',
      glyph: opts.glyph,
      stats: makeInertStats(opts.maxHp ?? 1),
      position: opts.position,
    });
  }

  private addUnit(init: {
    team: Team;
    glyph: string;
    stats: UnitStats;
    position: GridCoord;
  }): Unit {
    const unit = new Unit({
      id: this.nextUnitId++,
      team: init.team,
      glyph: init.glyph,
      stats: init.stats,
      position: init.position,
    });
    this.units.push(unit);
    this.bus.emit('unit:spawned', { unitId: unit.id });
    return unit;
  }

  findUnit(id: number): Unit | undefined {
    return this.units.find((u) => u.id === id);
  }

  /**
   * Capture the World's full state as plain JSON. Every field that
   * affects determinism — RNG state, tick count, every unit's HP /
   * cooldowns / activeAction, pending command queue — is included. The
   * bus is excluded; rehydration takes a fresh bus.
   */
  toJSON(): WorldSnapshot {
    return {
      schemaVersion: WORLD_SCHEMA_VERSION,
      gridSize: this.gridSize,
      tickCount: this.tickCount,
      ended: this._ended,
      nextUnitId: this.nextUnitId,
      rng: this.rng.toJSON(),
      units: this.units.map(snapshotUnit),
      pendingCommands: this.commands.slice(),
      tileGrid: this.tileGrid.toJSON(),
    };
  }

  /**
   * Reconstruct a World from a snapshot. Two-phase: units are
   * instantiated first (no `activeAction`), then `activeAction`s are
   * resolved once all units exist (an in-flight `AttackAction` may
   * reference another unit by id, which has to be present first).
   */
  static fromJSON(snap: WorldSnapshot, bus: EventBus<GameEvents>): World {
    if (snap.schemaVersion !== WORLD_SCHEMA_VERSION) {
      throw new Error(
        `World.fromJSON: unsupported schema version ${snap.schemaVersion}`,
      );
    }
    const rng = RNG.fromJSON(snap.rng);
    const world = new World(bus, rng, snap.gridSize, TileGrid.fromJSON(snap.tileGrid));
    world.tickCount = snap.tickCount;
    world._ended = snap.ended;
    world.nextUnitId = snap.nextUnitId;

    // Phase 1: bare units.
    for (const us of snap.units) {
      const unit = new Unit({
        id: us.id,
        team: us.team,
        glyph: us.glyph,
        stats: us.stats,
        position: us.position,
      });
      unit.currentHp = us.currentHp;
      for (const [actionId, cd] of us.actionCooldowns) {
        unit.actionCooldowns.set(actionId, cd);
      }
      for (const kind of us.behaviors) unit.behaviors.push(createBehavior(kind));
      world.units.push(unit);
    }

    // Phase 2: in-flight actions, now that every unit exists for id lookup.
    for (let i = 0; i < snap.units.length; i++) {
      const us = snap.units[i]!;
      const unit = world.units[i]!;
      if (us.activeAction) {
        unit.activeAction = {
          action: createAction(us.activeAction.actionId, us.activeAction.actionData, world),
          startTick: us.activeAction.startTick,
          finishTick: us.activeAction.finishTick,
          effectTicks: us.activeAction.effectTicks.slice(),
        };
      }
    }

    for (const cmd of snap.pendingCommands) world.commands.push(cmd);
    return world;
  }
}

/**
 * Stat block for env entities that don't act and don't fight back. Damage
 * / range / cooldowns are all zero — if a future destructible-wall mode
 * lets attacks target them, they'll just take damage and die without
 * retaliation.
 */
function makeInertStats(maxHp: number): UnitStats {
  return {
    maxHp,
    attackDamage: 0,
    attackRange: 0,
    attackCooldownTicks: 0,
    moveCooldownTicks: 0,
  };
}

function snapshotUnit(unit: Unit): UnitSnapshot {
  return {
    id: unit.id,
    team: unit.team,
    glyph: unit.glyph,
    stats: unit.stats,
    position: unit.position,
    currentHp: unit.currentHp,
    behaviors: unit.behaviors.map((b) => b.kind),
    actionCooldowns: Array.from(unit.actionCooldowns.entries()),
    activeAction: unit.activeAction
      ? {
          actionId: unit.activeAction.action.id,
          actionData: unit.activeAction.action.toData(),
          startTick: unit.activeAction.startTick,
          finishTick: unit.activeAction.finishTick,
          effectTicks: unit.activeAction.effectTicks.slice(),
        }
      : null,
  };
}
