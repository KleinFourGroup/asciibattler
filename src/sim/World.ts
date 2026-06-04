import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG, type RNGSnapshot } from '../core/RNG';
import type { GridCoord } from '../core/types';
import { GRID_SIZE } from '../config';
import {
  Unit,
  type Team,
  type UnitArchetype,
  type UnitDerived,
  type UnitStats,
  type UnitTemplate,
} from './Unit';
import {
  totalTicks,
  phasesBeginningAt,
  type Action,
  type ActionProposal,
  type ActionPhase,
  type ActionPhaseName,
} from './Action';
import {
  abilityIdsForArchetype,
  rangeForArchetype,
  glyphForArchetype,
} from './archetypes';
import type { WorldCommand } from './Command';
import { createAction } from './actions/registry';
import { createBehavior, createMovementBehavior } from './behaviors/registry';
import { createAbility } from './abilities/registry';
import { updateTarget } from './Targeting';
import { TileGrid, type TileGridSnapshot } from './TileGrid';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { SpawnAction } from './actions/SpawnAction';
import { SPAWN } from '../config/spawn';
import { FIRE_TICKS_PER_DAMAGE, HEALING_TICKS_PER_HEAL } from '../config/tiles';
import type { SpawnRegion } from './layouts';
import { ZERO_STATS, deriveStats, inertDerived } from './stats';
import { computeXpAwards } from './xp';
import { STATS } from '../config/stats';

/**
 * Schema history:
 *   2 — C1a added tileGrid.
 *   3 — D3 replaced single `gridSize` with `gridW` + `gridH`.
 *   4 — D5.C added per-team `spawnQueue` (overflow UnitTemplate[]) +
 *       `spawnRegions` (each team's authoritative spawn region).
 *   5 — D6 added per-unit `blocksLineOfSight` (defaults `true` for
 *       combatants + walls; half-cover sets `false`).
 *   6 — E1 rewrote `UnitSnapshot.stats` to the new vocabulary
 *       (constitution / strength / ranged / magic / luck / speed /
 *       endurance), added `UnitSnapshot.archetype` + `.derived`, and
 *       added a top-level `combatRng` channel for AttackAction's
 *       start-time crit roll.
 *   7 — E2 added per-unit `abilities: string[]` (registry ids) so the
 *       new `AbilityBehavior` rehydrates the right concrete classes
 *       after round-trip. AttackBehavior retired; v6 `behaviors`
 *       arrays referencing `'attack'` would throw on rehydrate, but
 *       the version bump already rejects v6 wholesale.
 *   8 — E3 added per-unit `level: number` (combatant display metadata;
 *       defaults to 1 for environment entities). Spawn-queue templates
 *       gained a `level` field on the same bump (UnitTemplate is now
 *       `{archetype, level, stats}`). v7 throws on load.
 *   9 — E4 added the battle-scoped damage ledger
 *       (`damageDealt: [attackerId, total][]`) so a mid-battle snapshot
 *       round-trip preserves the XP awarded on battle:ended. Without
 *       round-trip, restoring a mid-battle world would start the
 *       ledger empty and a finished restored battle would award less
 *       XP than the un-roundtripped baseline — failing the
 *       snapshot-roundtrip determinism contract. v8 throws on load.
 *  10 — E4 added per-unit `xp: number` (display data; banked on the
 *       roster side post-battle) and `rosterIndex: number | null`
 *       (set for player units only; carried into `xpAwards` so Run
 *       can bank into the right slot). Spawn-queue templates also
 *       carry `xp` now. v9 throws on load.
 *  11 — E4 follow-up added `playerRosterIds: [unitId, rosterIndex][]`
 *       so a player unit that died during the battle still earns
 *       its damage-share XP plus the new `xpFlatPerFallen` slice.
 *       Without this, the dead unit's tally was orphaned at battle
 *       end because the unit was already spliced from `world.units`.
 *       v10 throws on load.
 *  12 — E5 pre-work removed `attackCooldownTicks` from
 *       `UnitSnapshot.derived` (the `UnitDerived` shape is stored
 *       verbatim). Attack cadence moved to the Ability layer, resolved
 *       from `config/abilities.json` at propose time, so the field no
 *       longer exists to serialize. v11 throws on load.
 *  14 — F2 replaced `ActiveActionSnapshot.effectTicks: number[]` with a
 *       declared `phases: {phase, ticks}[]` timeline (the action phase
 *       system). The impact tick is derived from the timeline rather than
 *       stored as a raw offset list. v13 (and earlier) throw on load. (v13
 *       was E5.A's `targetId`/`outOfLosTicks` add — see UnitSnapshot.)
 *  15 — F6 added the utility-contribution ledger
 *       (`utilityDone: [unitId, total][]`) — effective HP healed by
 *       ability casts — so a mid-battle round-trip preserves the heal-XP
 *       awarded on `battle:ended`. Without it a restored mid-battle world
 *       would start the ledger empty and under-award a healer's XP,
 *       failing the snapshot-roundtrip determinism contract (same reason
 *       v9 added `damageDealt`). v14 throws on load.
 *  16 — GP1 renamed two `UnitStats` keys (`speed → agility`, `endurance →
 *       mobility`). Stats round-trip as a whole object by key, so a v15
 *       snapshot carries the old key names and would deserialize into an
 *       `agility`/`mobility`-less stat block; the version check rejects it
 *       outright (no migration — the rename also re-tuned the move-CD curve,
 *       so old derived cadences wouldn't be reproduced anyway). v15 throws
 *       on load.
 *  17 — GP2 added the `defense` key to `UnitStats` (flat subtractive damage
 *       mitigation). Stats round-trip as a whole object by key, so a v16
 *       snapshot carries a `defense`-less stat block; the version check
 *       rejects it outright (no migration — defaulting the missing key would
 *       silently mis-derive nothing today, but the version bump keeps the
 *       stat-shape contract honest, same as GP1). v16 throws on load.
 *  18 — H1 added the `power` key to `UnitStats` (Phase-H pool-chip stat).
 *       Stats round-trip as a whole object by key, so a v17 snapshot carries a
 *       `power`-less stat block; the version check rejects it outright (no
 *       migration — same stat-shape-contract rationale as GP1/GP2). v17 throws
 *       on load.
 */
const WORLD_SCHEMA_VERSION = 18;

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
  /**
   * F2 — the in-flight action's declared phase timeline. Replaces the pre-F2
   * `effectTicks` offset list: the impact tick (and every other boundary) is
   * derived from this on resume, so a mid-`windup` snapshot picks up on the
   * right phase. MUST be stored — the cadence-scaled tick counts aren't
   * reconstructable from the action's `toData()`.
   */
  phases: readonly ActionPhase[];
}

export interface UnitSnapshot {
  id: number;
  team: Team;
  archetype: UnitArchetype;
  glyph: string;
  /** E3 — combatant level (1 for environment entities + level-1 units). */
  level: number;
  /** E4 — display-only banked XP at spawn time. */
  xp: number;
  /** E4 — index into Run.team for player units; null otherwise. */
  rosterIndex: number | null;
  stats: UnitStats;
  derived: UnitDerived;
  position: GridCoord;
  currentHp: number;
  blocksLineOfSight: boolean;
  /** E5 — sticky target id (null = uncommitted). */
  targetId: number | null;
  /** E5 — consecutive out-of-LOS ticks for the ranged re-target timeout. */
  outOfLosTicks: number;
  behaviors: string[];
  /**
   * E2 — registry ids for the unit's abilities (e.g. `['melee_strike']`,
   * `['ranged_shot']`). Order is preserved across the round-trip since
   * AbilityBehavior uses array order to break score ties. Environment
   * units (walls, half-cover) have no behaviors and no abilities, so
   * this serializes as an empty array.
   */
  abilities: string[];
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
  /** E1: independent RNG for AttackAction's crit roll. Forked at battle
   *  setup from a parent the spawn-setup stream also forks off, so
   *  combat noise stays out of the spawn-pick + intra-region shuffle. */
  combatRng: RNGSnapshot;
  units: UnitSnapshot[];
  pendingCommands: WorldCommand[];
  tileGrid: TileGridSnapshot;
  spawnQueues: SpawnQueueSnapshot[];
  spawnRegions: SpawnRegionAssignment[];
  /** E4: battle-scoped per-attacker damage tally (damage dealt to the
   *  opposing team only; neutral hits ignored). Read once at
   *  battle:ended to build `xpAwards`. Serialized as `[attackerId,
   *  total]` pairs so the wire format stays plain JSON. */
  damageDealt: [number, number][];
  /** E4 follow-up: every player unit ever spawned this battle, mapped
   *  unitId → rosterIndex. Populated on spawn (initial + overflow) for
   *  player team only; entries persist even after the unit dies so
   *  fallen damage-dealers still earn their damage-share XP. */
  playerRosterIds: [number, number][];
  /** F6: battle-scoped utility-contribution ledger (effective HP healed
   *  by ability casts), mapped unitId → total. Serialized as `[unitId,
   *  total]` pairs alongside `damageDealt` so a mid-battle round-trip
   *  preserves the heal-XP awarded at battle:ended. */
  utilityDone: [number, number][];
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
  /**
   * E1 — dedicated RNG for combat rolls (currently just AttackAction's
   * crit decision; E2's Ability resolvers + E5's pathfinding nudges
   * may join). Lives on its own stream so adding/removing combat
   * sources doesn't perturb the spawn-setup stream that pathfinding /
   * region-pick fuzz tests pin. Default forks from `rng` when the
   * constructor caller doesn't provide one (preserves the behaviour
   * tests that build a naked `new World(bus, rng)` rely on).
   */
  readonly combatRng: RNG;
  readonly units: Unit[] = [];
  /**
   * O(1) id → unit index over `units`, maintained in `addUnit` /
   * `removeUnit` / `fromJSON`. `findUnit` reads it (with a linear-scan
   * fallback for fixtures that push directly to `units`). Read-only by id
   * — never iterated — so its insertion order can't leak into the
   * deterministic sim. Added in F2: the phase system + AoE targeting call
   * `findUnit` far more often than the old O(n) scan could afford.
   */
  private readonly unitsById: Map<number, Unit> = new Map();
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
  /**
   * E4: battle-scoped damage tally. Key = attacker unit id, value =
   * total HP-of-damage dealt to opposing-team combatants over the
   * battle's lifetime. Damage to walls, half-cover, or same-team
   * (currently impossible) units is NOT counted — see
   * `recordDamage`. Read once at `battle:ended` to compute
   * `xpAwards`; the map is otherwise opaque to callers. Snapshotted
   * so a mid-battle round-trip preserves XP outcomes.
   */
  private readonly damageDealt: Map<number, number> = new Map();
  /**
   * E4 follow-up: per-battle "every player unit that ever spawned"
   * record. Key = unitId, value = rosterIndex. Populated in `addUnit`
   * for player-team spawns whose rosterIndex is non-null; entries
   * stick around even after the unit dies + is spliced from
   * `world.units`, so `checkBattleEnd` can pay XP to the dead.
   *
   * Combined with `damageDealt` (also persistent through deaths) +
   * `livingPlayerIds = units.filter(team === 'player' && hp > 0)`,
   * the award generator can produce four cases cleanly:
   *   survivor + dealt damage  → flatSurvivor + share
   *   survivor + no damage     → flatSurvivor only
   *   fallen + dealt damage    → flatFallen + share
   *   fallen + no damage       → flatFallen only (0 at default knobs)
   */
  private readonly playerRosterIds: Map<number, number> = new Map();
  /**
   * F6 — battle-scoped utility-contribution ledger. Key = the acting
   * unit's id, value = total *effective* utility credited over the
   * battle. Today the only contributor is HP healed by ability casts
   * (`recordHealing`, fed from `HealAction`); a future buff/shield axis
   * adds here so it rides the same `xpPerHealing` slice + snapshot field
   * without another schema bump. Deliberately NOT fed by the per-tick
   * regen-tile chip-heal (that's the tile's output, not a unit's
   * contribution) — see `applyTileEffects`. Read once at `battle:ended`
   * alongside `damageDealt`; snapshotted so a mid-battle round-trip
   * preserves the heal-XP awarded on win.
   */
  private readonly utilityDone: Map<number, number> = new Map();

  constructor(
    bus: EventBus<GameEvents>,
    rng: RNG,
    gridW: number = GRID_SIZE,
    gridH: number = GRID_SIZE,
    tileGrid?: TileGrid,
    combatRng?: RNG,
  ) {
    this.bus = bus;
    this.rng = rng;
    this.gridW = gridW;
    this.gridH = gridH;
    this.tileGrid = tileGrid ?? new TileGrid(gridW, gridH);
    // E1: default fork keeps unit tests that build a naked World working;
    // battleSetup passes an explicit forked combatRng so its determinism
    // is anchored on `encounter.terrainSeed`, not `rng`.
    this.combatRng = combatRng ?? rng.fork();
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
   * E4: tally a damage event for the XP ledger. Called from
   * `AttackAction.start` after the HP deduction. Filters here (not at
   * the consumer) so a single `damageDealt.get(id)` at battle end is
   * already the "damage to enemies" number:
   *
   *   - Damage to the attacker's own team is ignored (currently
   *     impossible; future friendly-fire abilities still won't earn
   *     XP for it).
   *   - Damage to neutrals (walls, half-cover) is ignored — half-cover
   *     destruction will surface its own progression later if needed,
   *     but XP rides on opposed combat.
   *
   * Overkill damage is recorded as-is (not clamped to the victim's
   * pre-hit HP). Flat-XP dominates at the values we ship and a 1-tick
   * AttackAction can't double-hit a corpse, so the simpler unclamped
   * path stays.
   */
  recordDamage(attackerId: number, target: Unit, damage: number): void {
    if (damage <= 0) return;
    if (target.team === 'neutral') return;
    const attacker = this.findUnit(attackerId);
    if (!attacker) return;
    if (attacker.team === target.team) return;
    this.damageDealt.set(attackerId, (this.damageDealt.get(attackerId) ?? 0) + damage);
  }

  /**
   * GP2 — the single chokepoint for COMBAT damage: HP mutation + XP ledger +
   * the `unit:attacked` emit, which the four combat actions
   * (`AttackAction` / `GambitStrikeAction` / `MagicBoltAction` /
   * `CatapultShotAction`) used to each do inline. Callers pre-compute
   * `rawDamage` with the crit factor, half-cover multiplier, and AoE
   * `cellMult` already baked in, and decide WHETHER a hit happens at all (the
   * per-action `rawDamage <= 0` / team / radius skip guards stay caller-side —
   * they decide if a cell is a victim; this method only applies a confirmed
   * hit). `opts.crit` is the already-rolled flag, forwarded to the event for
   * E6.C's red hitsplats.
   *
   * Environmental damage (fire chip in `applyTileEffects`) deliberately does
   * NOT route through here — it keeps its own `currentHp -=` + `unit:burned`
   * emit, so the GP2 `defense` mitigation never touches it.
   *
   * GP2.2 — subtractive `defense` mitigation lands on the single `final` line:
   * a confirmed hit deals `max(STATS.minDamage, rawDamage − target.defense)`,
   * applied to the already crit/cover-resolved `rawDamage`. Both operands are
   * integers, so `final` stays integral (no re-round). The `minDamage` floor
   * keeps a high-defense target from fully negating chip/AoE.
   */
  applyDamage(attackerId: number, target: Unit, rawDamage: number, opts: { crit: boolean }): void {
    const final = Math.max(STATS.minDamage, rawDamage - target.stats.defense);
    target.currentHp -= final;
    this.recordDamage(attackerId, target, final);
    this.emit('unit:attacked', {
      attackerId,
      targetId: target.id,
      damage: final,
      crit: opts.crit,
    });
  }

  /** Test-only read of the damage ledger. */
  damageDealtBy(attackerId: number): number {
    return this.damageDealt.get(attackerId) ?? 0;
  }

  /**
   * F6 — feed the utility-contribution ledger. `amount` is the *effective*
   * (clamped, non-overheal) delta the action actually applied; a 0 (full-HP
   * target, no-op) contributes nothing, which kills the heal-a-full-ally
   * spam-XP case. Called from `HealAction` after it computes the delta —
   * the analogue of `recordDamage`'s call from `AttackAction`.
   *
   * Deliberately leaner than `recordDamage` (no `target` / `findUnit` team
   * guard): heals only ever target allies, and `computeXpAwards` reads this
   * ledger only for ids in `playerRosterIds`, so an enemy-healer or
   * self-heal entry is harmless and never paid out. Skipping the lookup
   * also keeps this off the O(n) `findUnit` path.
   */
  recordHealing(healerId: number, amount: number): void {
    if (amount <= 0) return;
    this.utilityDone.set(healerId, (this.utilityDone.get(healerId) ?? 0) + amount);
  }

  /** Test-only read of the utility-contribution ledger. */
  utilityDoneBy(unitId: number): number {
    return this.utilityDone.get(unitId) ?? 0;
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
   *      set activeAction with `startTick`/`finishTick`/`phases` (F2: the
   *      declared phase timeline), call `action.start(unit, world)`, then
   *      emit the offset-0 `action:phase` boundary(ies).
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

      // 3. In-flight action. F2 — walk the declared phase timeline: emit an
      // `action:phase` event for every phase that BEGINS at the current
      // offset (zero-length phases share a boundary, so several can fire on
      // one tick, in declared order), and fire `applyEffect` at `impact`.
      // Behavior-preserving vs pre-F2: a multi-tick action's `impact` sits at
      // offset == duration == finishTick (exactly where `effectTicks:[D]`
      // fired before), then the finish check clears it on the same tick.
      if (unit.activeAction !== null) {
        const aa = unit.activeAction;
        const offset = this.tickCount - aa.startTick;
        for (const phase of phasesBeginningAt(aa.phases, offset)) {
          this.emitActionPhase(unit, aa.action, phase);
          if (phase === 'impact' && aa.action.applyEffect) {
            aa.action.applyEffect(unit, this, offset, 'impact');
          }
        }
        if (this.tickCount >= aa.finishTick) {
          unit.activeAction = null;
        } else {
          continue;
        }
      }

      // 3.5. E5 — refresh the sticky target ONCE per free unit, before
      // behaviors poll. Both MovementBehavior and the strike abilities
      // read `unit.targetId` via `currentTarget`; updating here (not
      // inside each behavior) keeps the re-target decision + outOfLosTicks
      // counter advancing exactly once per tick.
      updateTarget(unit, this);

      // 4. Selector.
      let best: ActionProposal | null = null;
      for (const behavior of unit.behaviors) {
        const proposal = behavior.proposeAction(unit, this);
        if (proposal === null) continue;
        // E2: cooldownKey defaults to action.id (the pre-E2 behavior).
        // Abilities override with their own id so a multi-ability unit
        // gets independent cooldowns even when two abilities wrap the
        // same Action class.
        const cdKey = proposal.cooldownKey ?? proposal.action.id;
        const remainingCd = unit.actionCooldowns.get(cdKey) ?? 0;
        if (remainingCd > 0) continue;
        if (best === null || proposal.score > best.score) best = proposal;
      }
      if (best === null) continue;

      const cdKey = best.cooldownKey ?? best.action.id;
      unit.actionCooldowns.set(cdKey, best.cooldown);
      const activeAction = {
        action: best.action,
        startTick: this.tickCount,
        finishTick: this.tickCount + totalTicks(best.phases),
        phases: best.phases,
      };
      unit.activeAction = activeAction;
      best.action.start(unit, this);
      // F2 — emit the offset-0 phase boundary(ies) on the start tick, AFTER
      // start(), so the renderer hears `windup` (or `impact` for a strike)
      // the instant the action begins — mirroring step 3's per-tick handling
      // for actions already in flight at tick top. No migrated action has
      // BOTH an offset-0 `impact` AND an `applyEffect` (a strike's effect is
      // in `start()`, which already ran), so the guarded `applyEffect` call
      // never fires here in F2 — no effect or combatRng draw moves.
      for (const phase of phasesBeginningAt(activeAction.phases, 0)) {
        this.emitActionPhase(unit, activeAction.action, phase);
        if (phase === 'impact' && activeAction.action.applyEffect) {
          activeAction.action.applyEffect(unit, this, 0, 'impact');
        }
      }
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
   * F2 — emit a single `action:phase` boundary event, pulling optional
   * target info from the action's `phaseTarget()` (a homing action surfaces
   * `targetId`, a ground-target surfaces `targetCell`) without exposing the
   * action's internals. Transient + renderer-only; no sim state is touched.
   */
  private emitActionPhase(unit: Unit, action: Action, phase: ActionPhaseName): void {
    const { targetId, targetCell } = action.phaseTarget?.() ?? {};
    this.bus.emit('action:phase', {
      unitId: unit.id,
      actionId: action.id,
      phase,
      targetId,
      targetCell,
    });
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
        unit.currentHp = Math.min(unit.derived.maxHp, before + 1);
        const amount = unit.currentHp - before;
        // F5: `healerId: null` marks this as an environment chip-heal (no
        // casting unit) so the renderer keeps it to just the `+N` hitsplat.
        this.bus.emit('unit:healed', { unitId: unit.id, amount, healerId: null });
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
    const attackRange = rangeForArchetype(template.archetype);
    const derived = deriveStats(template.stats, attackRange);
    const unit = this.addUnit(
      {
        team,
        archetype: template.archetype,
        glyph: glyphForArchetype(template.archetype),
        stats: template.stats,
        derived,
        position,
        level: template.level,
        xp: template.xp,
        // E4: queue templates retain the same rosterIndex they were
        // pushed onto the queue with (player overflow carries through
        // from encounter.playerTeam; enemy queue templates carry null).
        rosterIndex: template.rosterIndex ?? null,
      },
      false,
    );
    // E7.B — archetype-aware movement (healer → SupportMovementBehavior,
    // else MovementBehavior), shared with battleSetup's initial-team spawn
    // via `createMovementBehavior` so the two paths can't drift. The chosen
    // behavior's `kind` is snapshotted per-unit and rehydrated via
    // `createBehavior`, so the choice round-trips with no schema bump.
    unit.behaviors.push(createMovementBehavior(template.archetype), new AbilityBehavior());
    for (const id of abilityIdsForArchetype(template.archetype)) {
      unit.abilities.push(createAbility(id));
    }
    unit.activeAction = {
      action: new SpawnAction(),
      startTick: this.tickCount,
      finishTick: this.tickCount + SPAWN.durationTicks,
      // F2 — a single lockout phase spanning the spawn window; SpawnAction
      // has no `applyEffect`, so `impact` here only times the busy window
      // (matches the pre-F2 `effectTicks:[]` + `duration` lockout exactly).
      phases: [{ phase: 'impact', ticks: SPAWN.durationTicks }],
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
    // E4 follow-up: roster persists across battles, so a "dead" player
    // unit isn't really gone — they're just sidelined for this
    // battle's flat-survivor slice. Pay them their damage share plus
    // an explicit `xpFlatPerFallen` slice so the suicide-DPS trade
    // isn't punished, just slightly under-rewarded vs. survivors.
    const livingPlayerIds = new Set<number>();
    for (const u of this.units) {
      if (u.team === 'player' && u.currentHp > 0) livingPlayerIds.add(u.id);
    }
    const xpAwards =
      winner === 'player'
        ? computeXpAwards(
            this.playerRosterIds,
            livingPlayerIds,
            this.damageDealt,
            this.utilityDone,
          )
        : [];
    this.bus.emit('battle:ended', { winner, xpAwards });
  }

  removeUnit(id: number): void {
    const i = this.units.findIndex((u) => u.id === id);
    if (i >= 0) this.units.splice(i, 1);
    this.unitsById.delete(id);
  }

  /**
   * Instantiate a unit from a rolled template and place it on the grid.
   * Glyph is derived from archetype; color is a renderer-side concern keyed
   * off `team` (see render/BattleRenderer.ts).
   *
   * E1: derives the unit's `UnitDerived` snapshot from the template's
   * stats + archetype attackRange. The template carries baseStats only;
   * battle-time numbers (maxHp, cooldowns, crit chance) are computed
   * here so the same template can be respawned with a different per-
   * encounter modifier without a stale-template footgun.
   */
  spawnUnit(
    template: UnitTemplate,
    team: Team,
    position: GridCoord,
    rosterIndex: number | null = null,
  ): Unit {
    const attackRange = rangeForArchetype(template.archetype);
    const derived = deriveStats(template.stats, attackRange);
    return this.addUnit(
      {
        team,
        archetype: template.archetype,
        glyph: glyphForArchetype(template.archetype),
        stats: template.stats,
        derived,
        position,
        level: template.level,
        xp: template.xp,
        rosterIndex,
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
        archetype: 'environment',
        glyph: opts.glyph,
        stats: ZERO_STATS,
        derived: inertDerived(opts.maxHp ?? 1),
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
      archetype: UnitArchetype;
      glyph: string;
      stats: UnitStats;
      derived: UnitDerived;
      position: GridCoord;
      blocksLineOfSight?: boolean;
      level?: number;
      xp?: number;
      rosterIndex?: number | null;
    },
    instant: boolean,
  ): Unit {
    const unit = new Unit({
      id: this.nextUnitId++,
      team: init.team,
      archetype: init.archetype,
      glyph: init.glyph,
      stats: init.stats,
      derived: init.derived,
      position: init.position,
      blocksLineOfSight: init.blocksLineOfSight ?? true,
      level: init.level ?? 1,
      xp: init.xp ?? 0,
      rosterIndex: init.rosterIndex ?? null,
    });
    this.units.push(unit);
    this.unitsById.set(unit.id, unit);
    // E4 follow-up: stash the unit's roster slot before any death can
    // reap it from `units`. Player units with a rosterIndex are the
    // only ones that earn XP, so the filter is symmetric with the
    // award-generation path in `checkBattleEnd`.
    if (unit.team === 'player' && unit.rosterIndex !== null) {
      this.playerRosterIds.set(unit.id, unit.rosterIndex);
    }
    this.bus.emit('unit:spawned', { unitId: unit.id, instant });
    return unit;
  }

  findUnit(id: number): Unit | undefined {
    const hit = this.unitsById.get(id);
    if (hit !== undefined) return hit;
    // Fallback for test fixtures that push directly onto `units` (bypassing
    // `addUnit`, so they never populate the index). Production add paths
    // (`addUnit` / `fromJSON`) always set the map, so this is a test-only
    // safety net, not a hot path — and it keeps the map authoritative
    // wherever it IS populated. A post-F2 chore can migrate fixtures to
    // `addUnit` and drop this.
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
      spawnQueues.push({
        team,
        templates: templates.map((t) => {
          // E4: include rosterIndex only when set, to keep
          // exactOptionalPropertyTypes happy and the wire image clean.
          const tpl: UnitTemplate = {
            archetype: t.archetype,
            level: t.level,
            stats: { ...t.stats },
            xp: t.xp,
            ...(t.rosterIndex !== undefined && t.rosterIndex !== null
              ? { rosterIndex: t.rosterIndex }
              : {}),
          };
          return tpl;
        }),
      });
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
      combatRng: this.combatRng.toJSON(),
      units: this.units.map(snapshotUnit),
      pendingCommands: this.commands.slice(),
      tileGrid: this.tileGrid.toJSON(),
      spawnQueues,
      spawnRegions,
      damageDealt: Array.from(this.damageDealt.entries()),
      playerRosterIds: Array.from(this.playerRosterIds.entries()),
      utilityDone: Array.from(this.utilityDone.entries()),
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
    const combatRng = RNG.fromJSON(snap.combatRng);
    const world = new World(
      bus,
      rng,
      snap.gridW,
      snap.gridH,
      TileGrid.fromJSON(snap.tileGrid),
      combatRng,
    );
    world.tickCount = snap.tickCount;
    world._ended = snap.ended;
    world.nextUnitId = snap.nextUnitId;

    // Phase 1: bare units.
    for (const us of snap.units) {
      const unit = new Unit({
        id: us.id,
        team: us.team,
        archetype: us.archetype,
        glyph: us.glyph,
        stats: us.stats,
        derived: us.derived,
        position: us.position,
        blocksLineOfSight: us.blocksLineOfSight,
        level: us.level,
        xp: us.xp,
        rosterIndex: us.rosterIndex,
      });
      unit.currentHp = us.currentHp;
      unit.targetId = us.targetId;
      unit.outOfLosTicks = us.outOfLosTicks;
      for (const [actionId, cd] of us.actionCooldowns) {
        unit.actionCooldowns.set(actionId, cd);
      }
      for (const kind of us.behaviors) unit.behaviors.push(createBehavior(kind));
      for (const id of us.abilities) unit.abilities.push(createAbility(id));
      world.units.push(unit);
      world.unitsById.set(unit.id, unit);
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
          phases: us.activeAction.phases.map((p) => ({ ...p })),
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

    // E4 — restore damage ledger so battle:ended's xpAwards match the
    // un-roundtripped baseline.
    for (const [attackerId, total] of snap.damageDealt) {
      world.damageDealt.set(attackerId, total);
    }
    // E4 follow-up — restore player roster ids. addUnit's auto-populate
    // doesn't fire on rehydrate (we push directly onto `world.units`
    // in Phase 1 above), so the only path back is the snapshot copy.
    for (const [unitId, rosterIndex] of snap.playerRosterIds) {
      world.playerRosterIds.set(unitId, rosterIndex);
    }
    // F6 — restore the utility-contribution ledger (mirror of damageDealt)
    // so a mid-battle restore awards the same heal-XP at battle:ended.
    for (const [unitId, total] of snap.utilityDone) {
      world.utilityDone.set(unitId, total);
    }

    return world;
  }
}

function snapshotUnit(unit: Unit): UnitSnapshot {
  return {
    id: unit.id,
    team: unit.team,
    archetype: unit.archetype,
    glyph: unit.glyph,
    level: unit.level,
    xp: unit.xp,
    rosterIndex: unit.rosterIndex,
    stats: unit.stats,
    derived: unit.derived,
    position: unit.position,
    currentHp: unit.currentHp,
    blocksLineOfSight: unit.blocksLineOfSight,
    targetId: unit.targetId,
    outOfLosTicks: unit.outOfLosTicks,
    behaviors: unit.behaviors.map((b) => b.kind),
    abilities: unit.abilities.map((a) => a.id),
    actionCooldowns: Array.from(unit.actionCooldowns.entries()),
    activeAction: unit.activeAction
      ? {
          actionId: unit.activeAction.action.id,
          actionData: unit.activeAction.action.toData(),
          startTick: unit.activeAction.startTick,
          finishTick: unit.activeAction.finishTick,
          phases: unit.activeAction.phases.map((p) => ({ ...p })),
        }
      : null,
  };
}
