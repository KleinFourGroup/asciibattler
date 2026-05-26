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
import { MovementBehavior } from './behaviors/MovementBehavior';
import { AttackBehavior } from './behaviors/AttackBehavior';
import { SpawnAction } from './actions/SpawnAction';
import { SPAWN } from '../config/spawn';
import { FIRE_TICKS_PER_DAMAGE, HEALING_TICKS_PER_HEAL } from '../config/tiles';
import type { SpawnRegion } from './layouts';

/**
 * Schema history:
 *   2 — C1a added tileGrid.
 *   3 — D3 replaced single `gridSize` with `gridW` + `gridH`.
 *   4 — D5.C added per-team `spawnQueue` (overflow UnitTemplate[]) +
 *       `spawnRegions` (each team's authoritative spawn region).
 *   5 — D6 added per-unit `blocksLineOfSight` (defaults `true` for
 *       combatants + walls; half-cover sets `false`).
 */
const WORLD_SCHEMA_VERSION = 5;

/**
 * Deterministic team iteration order for the post-death overflow scan.
 * Neutrals never appear in the queue (walls don't have templates), so
 * skipping them here is a deliberate scope.
 */
const QUEUE_TEAMS: readonly Team[] = ['player', 'enemy'];

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
  blocksLineOfSight: boolean;
  behaviors: string[];
  actionCooldowns: [string, number][];
  activeAction: ActiveActionSnapshot | null;
}

export interface SpawnQueueSnapshot {
  team: Team;
  templates: UnitTemplate[];
}

export interface SpawnRegionAssignment {
  team: Team;
  region: SpawnRegion;
}

export interface WorldSnapshot {
  schemaVersion: typeof WORLD_SCHEMA_VERSION;
  gridW: number;
  gridH: number;
  tickCount: number;
  ended: boolean;
  nextUnitId: number;
  rng: RNGSnapshot;
  units: UnitSnapshot[];
  pendingCommands: WorldCommand[];
  tileGrid: TileGridSnapshot;
  spawnQueues: SpawnQueueSnapshot[];
  spawnRegions: SpawnRegionAssignment[];
}

/**
 * Battle state: grid, units, current tick. Owns the battle's RNG (forked from
 * the run RNG at Step 4.3) so combat rolls don't perturb the run stream.
 *
 * JSON-serializable end-to-end via `toJSON()` / `World.fromJSON()`. The bus
 * is intentionally NOT part of the snapshot — callers provide one at
 * rehydrate time, so a replay or a headless harness can attach its own
 * recorder.
 *
 * D3: grid is rectangular. `gridW` and `gridH` are independent;
 * pre-D3 callers passed a single `gridSize` and got a square — those
 * call sites have been updated to pass both dimensions. Default
 * constructor still produces a square `GRID_SIZE × GRID_SIZE` for the
 * fuzz harness and the headful tests that don't care about the
 * dimensions.
 */
export class World {
  readonly gridW: number;
  readonly gridH: number;
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
  /**
   * D5.C overflow queue. Templates pushed here when battleSetup runs
   * out of region tiles; drained at end-of-tick by `runOverflowScan`
   * as tiles vacate (combatant deaths). Per-team FIFO so the layout
   * author's roster order is preserved.
   */
  private readonly spawnQueues: Map<Team, UnitTemplate[]> = new Map();
  /**
   * D5.C: each team's authoritative spawn region. `runOverflowScan`
   * walks `region.tiles` in stored order to find the first free cell,
   * so determinism is `queue FIFO × region tile order`.
   */
  private readonly spawnRegions: Map<Team, SpawnRegion> = new Map();

  constructor(
    bus: EventBus<GameEvents>,
    rng: RNG,
    gridW: number = GRID_SIZE,
    gridH: number = GRID_SIZE,
    tileGrid?: TileGrid,
  ) {
    this.bus = bus;
    this.rng = rng;
    this.gridW = gridW;
    this.gridH = gridH;
    this.tileGrid = tileGrid ?? new TileGrid(gridW, gridH);
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
   * Register the authoritative spawn region for a team. Battle setup
   * calls this once per team after picking regions; the overflow scan
   * uses the stored region to find free tiles. Calling a second time
   * for the same team replaces the prior region (also serves rehydrate
   * from snapshot).
   */
  setTeamSpawnRegion(team: Team, region: SpawnRegion): void {
    this.spawnRegions.set(team, region);
  }

  /**
   * Push a template onto a team's overflow queue. Used by battleSetup
   * when a team's roster has more units than its region has tiles —
   * the extras spawn in as tiles vacate, in queue (FIFO) order.
   */
  queueUnit(team: Team, template: UnitTemplate): void {
    let q = this.spawnQueues.get(team);
    if (!q) {
      q = [];
      this.spawnQueues.set(team, q);
    }
    q.push(template);
  }

  /** Test/debug read of the queue depth for a team. */
  queueLength(team: Team): number {
    return this.spawnQueues.get(team)?.length ?? 0;
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

    // D5.C — after deaths + movements settle for the tick, drain any
    // overflow templates whose team's spawn region has free tiles.
    // Runs before checkBattleEnd so a wiped team with units still in
    // queue gets a chance to reinforce before victory triggers.
    this.runOverflowScan();

    // D7.B — per-tile chip damage/heal. Runs AFTER the overflow scan
    // so freshly-spawned units take immediate effect if they land on
    // a fire/healing tile during a cadence tick. Followed by a reap
    // pass so a unit killed by fire dies on the SAME tick (matches
    // combat-kill ordering — without the reap, a fire-kill would
    // linger one tick before checkBattleEnd notices).
    this.applyTileEffects();
    this.reapDead();

    this.checkBattleEnd();
  }

  /**
   * D7.B — global-cadence tile-effect pass. Every `FIRE_TICKS_PER_DAMAGE`
   * ticks (5 @ 2 HP/sec, TICK_RATE=10), iterate live combatant units
   * and apply 1 HP fire damage to any standing on a `fire` tile.
   * Symmetric for `HEALING_TICKS_PER_HEAL` (10 @ 1 HP/sec). The
   * cadences are independent — a fire-tick and a heal-tick can coincide
   * (every 10 ticks for the default rates).
   *
   * Neutrals (walls, half-cover) are skipped per the D7 "combatants
   * only" decision. Already-dead units (currentHp <= 0, awaiting reap)
   * also skipped so a fire pass doesn't double-burn a corpse.
   *
   * Iteration order is `this.units` insertion order (deterministic by
   * spawn sequence), so the event stream is replay-stable for fuzz.
   */
  private applyTileEffects(): void {
    const fireTick = this.tickCount % FIRE_TICKS_PER_DAMAGE === 0;
    const healTick = this.tickCount % HEALING_TICKS_PER_HEAL === 0;
    if (!fireTick && !healTick) return;

    for (const unit of this.units) {
      if (unit.team === 'neutral') continue;
      if (unit.currentHp <= 0) continue;
      const kind = this.tileGrid.kindAt(unit.position);
      if (kind === 'fire' && fireTick) {
        const damage = 1;
        unit.currentHp -= damage;
        this.bus.emit('unit:burned', { unitId: unit.id, damage });
      } else if (kind === 'healing' && healTick) {
        const before = unit.currentHp;
        unit.currentHp = Math.min(unit.stats.maxHp, before + 1);
        const amount = unit.currentHp - before;
        this.bus.emit('unit:healed', { unitId: unit.id, amount });
      }
    }
  }

  /**
   * D7.B — reap any unit whose currentHp has dropped to 0 (or below)
   * after the tile-effect pass. Combat kills are already reaped inside
   * the per-unit loop's step-1 death check, so in practice this pass
   * only matches fire-kills. Kept as an unconditional sweep because
   * O(N) on a small N is cheaper than auditing every damage source
   * for an inline reap.
   */
  private reapDead(): void {
    for (const unit of this.units.slice()) {
      if (unit.currentHp <= 0) {
        this.removeUnit(unit.id);
        this.bus.emit('unit:died', { unitId: unit.id, team: unit.team });
      }
    }
  }

  /**
   * D5.C overflow scan. For each team with a non-empty queue, walks
   * its spawn region tiles in stored order and instantiates queued
   * templates onto free cells (no living unit currently occupies the
   * cell). Each spawn fires `unit:spawned` with `instant: false` so
   * the renderer fades the sprite in, and seats the unit with a
   * `SpawnAction` activeAction so the selector keeps it busy for
   * `SPAWN.durationTicks` ticks.
   *
   * Determinism: team order is `QUEUE_TEAMS`, queue order is FIFO,
   * tile order is the region's stored tile array.
   */
  private runOverflowScan(): void {
    for (const team of QUEUE_TEAMS) {
      const queue = this.spawnQueues.get(team);
      if (!queue || queue.length === 0) continue;
      const region = this.spawnRegions.get(team);
      if (!region) continue;

      for (const tile of region.tiles) {
        if (queue.length === 0) break;
        if (this.isOccupied(tile)) continue;
        const template = queue.shift()!;
        this.spawnFromQueue(template, team, tile);
      }
    }
  }

  private isOccupied(coord: GridCoord): boolean {
    for (const u of this.units) {
      if (u.position.x === coord.x && u.position.y === coord.y) return true;
    }
    return false;
  }

  private spawnFromQueue(template: UnitTemplate, team: Team, position: GridCoord): Unit {
    const unit = this.addUnit(
      {
        team,
        glyph: glyphForArchetype(template.archetype),
        stats: template.stats,
        position,
      },
      false,
    );
    unit.behaviors.push(new MovementBehavior(), new AttackBehavior());
    unit.activeAction = {
      action: new SpawnAction(),
      startTick: this.tickCount,
      finishTick: this.tickCount + SPAWN.durationTicks,
      effectTicks: [],
    };
    return unit;
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
    if (this.units.length === 0 && this.spawnQueues.size === 0) return;
    let playerAlive = false;
    let enemyAlive = false;
    for (const u of this.units) {
      if (u.team === 'player') playerAlive = true;
      else if (u.team === 'enemy') enemyAlive = true;
      // Neutrals (walls, environment entities) don't count toward either
      // side — a battlefield of just walls + corpses isn't a victory.
      if (playerAlive && enemyAlive) return;
    }
    // D5.C — a team with units still in queue isn't wiped; the overflow
    // scan will reinforce as tiles vacate. Treat them as alive so the
    // battle doesn't end prematurely.
    if ((this.spawnQueues.get('player')?.length ?? 0) > 0) playerAlive = true;
    if ((this.spawnQueues.get('enemy')?.length ?? 0) > 0) enemyAlive = true;
    if (playerAlive && enemyAlive) return;
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
    return this.addUnit(
      {
        team,
        glyph: glyphForArchetype(template.archetype),
        stats: template.stats,
        position,
      },
      true,
    );
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
    /** D6: defaults to `true` (wall semantics). Half-cover passes `false`. */
    blocksLineOfSight?: boolean;
  }): Unit {
    return this.addUnit(
      {
        team: opts.team ?? 'neutral',
        glyph: opts.glyph,
        stats: makeInertStats(opts.maxHp ?? 1),
        position: opts.position,
        blocksLineOfSight: opts.blocksLineOfSight ?? true,
      },
      true,
    );
  }

  /**
   * `instant` distinguishes setup-time spawns (initial battle layout —
   * renderer pops the sprite in at full alpha, matching the screen-fade
   * lifecycle) from D5.C overflow-queue spawns (renderer lerps alpha
   * 0 → 1 over the SpawnAction lockout window). Threaded into the
   * `unit:spawned` payload so every subscriber can branch without
   * re-querying world state.
   */
  private addUnit(
    init: {
      team: Team;
      glyph: string;
      stats: UnitStats;
      position: GridCoord;
      blocksLineOfSight?: boolean;
    },
    instant: boolean,
  ): Unit {
    const unit = new Unit({
      id: this.nextUnitId++,
      team: init.team,
      glyph: init.glyph,
      stats: init.stats,
      position: init.position,
      blocksLineOfSight: init.blocksLineOfSight ?? true,
    });
    this.units.push(unit);
    this.bus.emit('unit:spawned', { unitId: unit.id, instant });
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
    const spawnQueues: SpawnQueueSnapshot[] = [];
    for (const [team, templates] of this.spawnQueues) {
      // Deep copy templates so a post-snapshot push doesn't mutate the wire image.
      spawnQueues.push({ team, templates: templates.map((t) => ({ ...t, stats: { ...t.stats } })) });
    }
    const spawnRegions: SpawnRegionAssignment[] = [];
    for (const [team, region] of this.spawnRegions) {
      // SpawnRegion tile arrays are immutable in practice but a defensive
      // slice keeps the snapshot independent of the live region reference.
      spawnRegions.push({
        team,
        region: { tiles: region.tiles.map((t) => ({ ...t })), availability: region.availability },
      });
    }
    return {
      schemaVersion: WORLD_SCHEMA_VERSION,
      gridW: this.gridW,
      gridH: this.gridH,
      tickCount: this.tickCount,
      ended: this._ended,
      nextUnitId: this.nextUnitId,
      rng: this.rng.toJSON(),
      units: this.units.map(snapshotUnit),
      pendingCommands: this.commands.slice(),
      tileGrid: this.tileGrid.toJSON(),
      spawnQueues,
      spawnRegions,
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
    const world = new World(bus, rng, snap.gridW, snap.gridH, TileGrid.fromJSON(snap.tileGrid));
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
        blocksLineOfSight: us.blocksLineOfSight,
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

    // D5.C — restore overflow queues + regions BEFORE the next tick so
    // the post-death scan and checkBattleEnd both see consistent state.
    for (const entry of snap.spawnQueues) {
      world.spawnQueues.set(entry.team, entry.templates.slice());
    }
    for (const entry of snap.spawnRegions) {
      world.spawnRegions.set(entry.team, entry.region);
    }

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
    blocksLineOfSight: unit.blocksLineOfSight,
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
