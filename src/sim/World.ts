import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG, type RNGSnapshot } from '../core/RNG';
import type { GridCoord } from '../core/types';
import { GRID_SIZE, secondsToTicks } from '../config';
import {
  Unit,
  isInertNeutral,
  type Archetype,
  type Behavior,
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
  type ActiveAction,
} from './Action';
import {
  abilityIdsForArchetype,
  rangeForArchetype,
  glyphForArchetype,
  targetingForArchetype,
  scaledUnit,
} from './archetypes';
import type { WorldCommand } from './Command';
import { AT_WILL } from './objective';
import type { ObjectiveTeam, TeamObjective } from './objective';
import type { StatusEffect } from './statusEffects';
import { cloneEffect } from './statusEffects';
import { STATUS_DEFS, statusDef } from '../config/statuses';
import type { StatusDef } from './effects/statusSchema';
import { buildStatusEffect } from './effects/statusRuntime';
import { TriggerDispatcher } from './triggers';
import type { TriggerContextMap, TriggerHandler, TriggerName } from './triggers';
import { assertBattleRuleStatusRefs, registerBattleRules, type BattleRule } from './battleRules';
import { createAction } from './actions/registry';
import { processChainHops, type PendingChainHop } from './effects/interpreter';
import { createBehavior, createMovementBehavior } from './behaviors/registry';
import { createAbility } from './abilities/registry';
import { updateTarget, validNeutralObjectiveTarget } from './Targeting';
import {
  GROUND,
  anchorFootprint,
  cellKey,
  claimantOf,
  isFree,
  unitAt,
  unitDistance,
  type Claim,
  type OccupancyPlane,
} from './occupancy';
import { affectsMatch } from './effects/targeting';
import { nearestFreeCells } from './actingPosition';
import { SIM } from '../config/sim';
import { TileGrid, type TileGridSnapshot } from './TileGrid';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { CampWanderBehavior } from './behaviors/CampWanderBehavior';
import { SpawnAction } from './actions/SpawnAction';
import { isReservedSwapPartner, preFlipSwap } from './actions/SwapAction';
/**
 * The statuses a tile sustains on the unit standing on it: `fire` sustains
 * `burn`, `healing` sustains `rejuvenate`. Resolved at module load, so a
 * catalog that lacks either fails at boot. The HP change is the status's
 * periodic tick (`applyPeriodicEffects`), so a tile's damage goes through
 * `dealDamage` like any other.
 */
const FIRE_STATUS = statusDef('burn');
const HEALING_STATUS = statusDef('rejuvenate');
import type { SpawnRegion } from './layouts';
import { ZERO_STATS, deriveStats, inertDerived } from './stats';
import { computeXpAwards } from './xp';
import { STATS } from '../config/stats';
import { LEVELING } from '../config/leveling';
import { NEUTRAL_DEFS, ALL_UNIT_DEFS } from '../config/units';
import { getCamp } from '../config/camps';

/**
 * The wire format's version. `fromJSON` refuses a snapshot of any other
 * version: there is no migration, because a missing field defaulted on load
 * would change the restored battle silently (a status dropped, a claim lost,
 * a side's fallen power under-charged). Bump it with any change to
 * `WorldSnapshot`'s shape or to what one of its fields means.
 */
const WORLD_SCHEMA_VERSION = 39;

/** The maxHp of a neutral whose def has no `hp` (indestructible), so its unit
 *  is alive and blocks pathing and line of sight. Never a damage target:
 *  `isCombatTargetable` asks whether the def has `hp`, not this value. */
const NOMINAL_NEUTRAL_MAXHP = 1;

/**
 * The two teams in a fixed order, for the queue scan and for `hostileTo` in
 * the snapshot. Neutrals never queue (scenery has no template) and never
 * enter a camp's `hostileTo`.
 */
const QUEUE_TEAMS: readonly Team[] = ['player', 'enemy'];

/** The teams that carry an objective (neutrals never do), for the per-team
 *  scan that reverts an objective whose target died. Typed as a tuple so it
 *  indexes the `objectives` record directly. */
const OBJECTIVE_TEAMS = ['player', 'enemy'] as const;

interface ActiveActionSnapshot {
  actionId: string;
  actionData: unknown;
  startTick: number;
  finishTick: number;
  /**
   * The in-flight action's phase timeline. Every phase boundary, the impact
   * tick among them, is derived from it on resume. Stored, because the
   * cadence-scaled tick counts can't be rebuilt from the action's `toData()`.
   */
  phases: readonly ActionPhase[];
}

/** A unit's wire form. A field named as one of `Unit`'s is that field,
 *  documented there. */
interface UnitSnapshot {
  id: number;
  team: Team;
  archetype: UnitArchetype;
  glyph: string;
  level: number;
  xp: number;
  rosterIndex: number | null;
  summonedBy: number | null;
  campId: number | null;
  stats: UnitStats;
  derived: UnitDerived;
  position: GridCoord;
  currentHp: number;
  blocksLineOfSight: boolean;
  targetId: number | null;
  outOfLosTicks: number;
  behaviors: string[];
  /** The registry ids of `Unit.abilities`, in its order, since
   *  `AbilityBehavior` breaks a score tie by it. Empty for walls and
   *  half-cover. */
  abilities: string[];
  actionCooldowns: [string, number][];
  activeAction: ActiveActionSnapshot | null;
  /** Every active status, `endOfTurn` ones included, so the effective stats
   *  and the lifetimes left resume as they were. */
  effects: StatusEffect[];
}

/** One camp member not yet dripped in: one of its roster entry's `count`.
 *  Its stats are derived from the catalog when it spawns (gotcha #114). */
export interface CampPendingUnit {
  archetype: UnitArchetype;
  level: number;
}

/**
 * One camp-spawn tile's camp for this battle.
 *
 * - `id` — the battle's key for the instance; `Unit.campId` points here.
 * - `defId` — the `config/camps.json` entry; its leash and rewards are read
 *   from the catalog when needed, never copied.
 * - `hostileTo` — the teams the whole camp fights: a team joins when it
 *   strikes a member (`markCampHostile`).
 * - `pending` — the members not yet dripped in, drained a tick at a time.
 * - `killedBy` — the team credited with clearing the camp, stamped when
 *   nothing is pending and no member lives (`campCleared`).
 */
export interface CampInstance {
  readonly id: number;
  readonly defId: string;
  readonly anchor: GridCoord;
  readonly hostileTo: Set<Team>;
  readonly pending: CampPendingUnit[];
  killedBy: Team | null;
}

/** The wire form of `CampInstance`; `hostileTo` flattens to a fixed-order
 *  array so the image is deterministic. */
interface CampInstanceSnapshot {
  id: number;
  defId: string;
  anchor: GridCoord;
  hostileTo: Team[];
  pending: CampPendingUnit[];
  killedBy: Team | null;
}

interface SpawnQueueSnapshot {
  team: Team;
  templates: UnitTemplate[];
}

interface SpawnRegionAssignment {
  team: Team;
  region: SpawnRegion;
}

/** The world's wire form. A field named as one of `World`'s is that field,
 *  documented there; a map travels as `[key, value]` pairs and a set as an
 *  array, so the image is plain JSON. */
export interface WorldSnapshot {
  schemaVersion: typeof WORLD_SCHEMA_VERSION;
  gridW: number;
  gridH: number;
  tickCount: number;
  ended: boolean;
  nextUnitId: number;
  rng: RNGSnapshot;
  combatRng: RNGSnapshot;
  units: UnitSnapshot[];
  pendingCommands: WorldCommand[];
  tileGrid: TileGridSnapshot;
  spawnQueues: SpawnQueueSnapshot[];
  spawnRegions: SpawnRegionAssignment[];
  damageDealt: [number, number][];
  playerRosterIds: [number, number][];
  utilityDone: [number, number][];
  objectives: { player: TeamObjective; enemy: TeamObjective };
  pendingChainHops: PendingChainHop[];
  claims: Claim[];
  battleRules: BattleRule[];
  tallies: { bits: number };
  fallenPower: { player: number; enemy: number };
  /** In ascending instance id, so the image doesn't depend on the map's
   *  insertion order. */
  camps: CampInstanceSnapshot[];
  campRng: RNGSnapshot | null;
}

/**
 * A battle: the grid, the units, the tick. Its RNG is the caller's, seeded
 * from the encounter, so the battle's rolls don't move the run's stream.
 *
 * Serializable whole through `toJSON()` and `World.fromJSON()`. The bus is
 * not in the snapshot: the caller passes one when it rehydrates, so a
 * replay or a headless harness can attach its own recorder.
 *
 * The grid is `gridW × gridH`; the constructor's default is a square of
 * `GRID_SIZE` for the tests and harnesses that don't care about its size.
 */
export class World {
  readonly gridW: number;
  readonly gridH: number;
  readonly rng: RNG;
  /**
   * The stream every roll in the battle but a camp's draws on: a damage
   * op's hit and crit, a battle rule's chance, a confused unit's target and
   * step. Forked from `rng` unless the constructor is given one, which no
   * shipped construction does, so it is seeded by the encounter's world seed
   * and stays apart from the spawn setup's stream (`setupRngFor`).
   */
  readonly combatRng: RNG;
  private readonly unitList: Unit[] = [];
  /** Read-only outside, so a unit enters only through `placeUnits`, which indexes it. */
  readonly units: readonly Unit[] = this.unitList;
  /**
   * The id → unit index over `units`, kept by `placeUnits` and
   * `removeUnit`, read by `findUnit`. Looked up by id and never iterated, so
   * its insertion order can't reach the sim.
   */
  private readonly unitsById: Map<number, Unit> = new Map();
  /**
   * The per-cell tile kinds. All floor when the constructor is given none,
   * the open arena tests use; battle setup fills it (`applyTerrain`).
   */
  readonly tileGrid: TileGrid;

  /**
   * The chain jumps waiting to fire on a later tick, queued by a chain with a
   * hop delay. `processChainHops`, run once a tick, fires the due ones and
   * reassigns the array to the rest, so it is not `readonly`.
   */
  pendingChainHops: PendingChainHop[] = [];

  /**
   * The cell claims, keyed by `cellKey(cell)`. A moving unit claims its
   * destination from the move's start to its flip (`MoveAction`), and the
   * pathing predicate treats a claimed cell as blocked, so two units never
   * converge on one free cell. Changed only through `claimCell`,
   * `releaseClaim` and `releaseClaimsBy`; read through `occupancy.ts`'s
   * claim queries.
   */
  readonly claims: Map<string, Claim> = new Map();

  /**
   * partnerId → actorId for every action in flight that names a reserved
   * partner (`Action.reservedPartnerId`, which `SwapAction` implements), so
   * `isReservedSwapPartner` answers by lookup rather than by scanning every
   * unit's action each call. Kept only by `seatActiveAction`,
   * `clearActiveAction` and `removeUnit` (an actor leaving `units` ends its
   * reservation); `fromJSON` rebuilds it by seating through the same calls,
   * so it is not serialized. A removed partner's entry stays while the
   * actor's swap is in flight, and the flip degrades or aborts on its own.
   * A test recomputes it by scanning (`scanReservedSwapPartners`) and
   * compares.
   */
  private readonly swapReservedPartners: Map<number, number> = new Map();

  /**
   * The daemons' battle rules, as plain data (`battleRules.ts` says how they
   * fire). Set once a battle by `installBattleRules`, which also registers
   * their trigger handlers: the data is serialized, and `fromJSON` registers
   * the handlers again from it.
   */
  private battleRules: readonly BattleRule[] = [];

  /**
   * The run resources the battle earns: the battle rules add to it,
   * `battle:ended` carries it, and Run settles it through `gainBits`, where
   * the `bitsGain` fold applies.
   */
  private readonly tallies = { bits: 0 };

  /**
   * The camps, instance id → camp. A camp's facts live here, not on its
   * units: behaviours hold no state (`behaviors/registry.ts`), and a camp's
   * hostility outlives the member that was struck. Empty on a camp-free
   * layout.
   */
  private readonly camps: Map<number, CampInstance> = new Map();
  /**
   * The camps' own stream (a wander's rolls, a drip's placement), never
   * `rng` or `combatRng`. Null until `installCamps` stores one, which it
   * does only when the layout rolled camps, so a camp-free world draws what
   * it would with no camp code at all. The bot's rollout clone re-seeds it
   * (`cloneForRollout`), so a camp's dice are sampled, not foreseen.
   */
  private _campRng: RNG | null = null;

  private readonly bus: EventBus<GameEvents>;
  private tickCount = 0;
  private nextUnitId = 1;
  private _ended = false;
  /**
   * A one-way latch, set on the first tick both teams field a living
   * combatant or a queued spawn. It tells a mutual wipe (both teams fielded
   * units and both are gone: a draw at once) from a board that never had
   * both (no units yet, or walls only: no result). Not serialized: it sets
   * again on the first tick after a restore that sees both teams, which must
   * come before any mutual wipe.
   */
  private _combatBegan = false;
  /**
   * Commands waiting to be applied at the next tick boundary. UI and the
   * headless harness push via `enqueueCommand`; `tick()` drains the queue
   * before per-unit step so the apply-point is deterministic for replay.
   */
  private readonly commands: WorldCommand[] = [];
  /**
   * Each team's units waiting for a spawn tile: battle setup queues the
   * ones its region has no tile for, and `runOverflowScan` seats them at the
   * tick's end as tiles empty. First in, first out, so the roster's order
   * holds.
   */
  private readonly spawnQueues: Map<Team, UnitTemplate[]> = new Map();
  /**
   * Each team's spawn region. `runOverflowScan` takes the first free cell
   * in `region.tiles`' stored order, so where a queued unit lands is fixed
   * by the queue's order and the tiles'.
   */
  private readonly spawnRegions: Map<Team, SpawnRegion> = new Map();
  /**
   * The damage dealt over the battle, attacker id → total, read once at
   * `battle:ended` for `xpAwards`. What counts is `recordDamage`'s rule.
   */
  private readonly damageDealt: Map<number, number> = new Map();
  /**
   * Every player unit spawned this battle with a roster slot, unit id →
   * `rosterIndex`, set in `addUnit`. An entry outlives its unit, so a
   * fallen unit is still paid at `battle:ended` (`computeXpAwards` says
   * how).
   */
  private readonly playerRosterIds: Map<number, number> = new Map();
  /**
   * The effective HP healed over the battle, healer id → total, read once
   * at `battle:ended` for the healing slice of `xpAwards`. Fed through
   * `recordHealing` by the heal op and by a periodic heal that has a
   * source; a healing tile's `rejuvenate` has none, so a tile earns nobody
   * XP.
   */
  private readonly utilityDone: Map<number, number> = new Map();
  /**
   * Each side's fallen power: the sum of `effectiveStats.power` over its
   * combatants reaped this battle, booked by `recordFallen` in `reapUnit`
   * before the splice. It reads the stat `survivorPower` reads, so for
   * every unit on the grid fielded = survivors + fallen. Neutrals, camp
   * members among them, are charged to neither side, and a summon is booked
   * at 0. The casualty chip rule's input, each side paying for its own dead
   * (`run/chipRule.ts`). Serialized, because the dead are gone from `units`.
   */
  private readonly fallenPower = { player: 0, enemy: 0 };
  /**
   * Each team's steering objective, always present. Changed mid-battle only
   * through the command channel (`applyCommand`), so a change lands at the
   * drain at the tick's top; read through `objectiveFor(team)` by
   * `updateTarget` and `MovementBehavior`, each steering by the acting
   * unit's team. In the game only the camp pull sets the enemy's
   * (`battleSetup.ts`). An objective whose target is gone reverts to
   * `atWill` (`clearResolvedObjectives`); a `tile` holds until replaced. The
   * record is fixed and only its slots are reassigned, so it is `readonly`.
   */
  private readonly objectives: { player: TeamObjective; enemy: TeamObjective } = {
    player: AT_WILL,
    enemy: AT_WILL,
  };
  /**
   * The trigger dispatch: the World fires a trigger, and its handlers run in
   * registration order. The battle rules register for `dealHit` and `kill`
   * (`battleRules.ts`); the other combat triggers are fire points kept for
   * the content that will handle them (`triggers.ts`). Not serialized: a
   * handler is behaviour, and `fromJSON` installs the battle rules again.
   */
  private readonly triggers = new TriggerDispatcher<TriggerContextMap, World>();

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
    this.combatRng = combatRng ?? rng.fork();
  }

  get currentTick(): number {
    return this.tickCount;
  }

  get ended(): boolean {
    return this._ended;
  }

  /** The team's objective. A neutral carries none and reads `atWill`. */
  objectiveFor(team: Team): TeamObjective {
    return team === 'neutral' ? AT_WILL : this.objectives[team];
  }

  /**
   * Sets a team's objective before the first tick, as a harness's battle
   * plan does (`tests/fuzz/campRaid.ts`). A direct write, as the rest of
   * spawn-time setup is (`spawnUnit`, `installCamps`, `primeCampSpawns`): an
   * order enqueued at setup drains after tick 0's driver has decided under
   * `atWill`, and the driver's own command replaces the plan in that drain.
   * Mid-battle, an objective changes only through the command channel, and
   * the throw holds that boundary.
   */
  setInitialObjective(team: ObjectiveTeam, objective: TeamObjective): void {
    if (this.currentTick > 0) {
      throw new Error(
        'setInitialObjective: setup-phase only (before the first tick) — mid-battle objectives go through the command channel',
      );
    }
    this.objectives[team] = objective;
    this.bus.emit('objective:set', { team, objective });
  }

  /**
   * Behaviors and actions call this to publish sim events (unit:moved,
   * unit:attacked, etc.) without holding a reference to the bus.
   */
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.bus.emit(event, payload);
  }

  /**
   * Registers a handler for a trigger; handlers fire in registration order.
   * They are not serialized, so their owner registers them again on a
   * rehydrated World, as `installBattleRules` does.
   */
  registerTrigger<K extends TriggerName>(name: K, handler: TriggerHandler<K>): void {
    this.triggers.register(name, handler);
  }

  /**
   * Installs the battle's daemon rules: stores the data for the snapshot and
   * registers their trigger handlers. The rules are fixed for the battle, so
   * a call after rules are installed throws. Their status ids are checked
   * here, so a bad one fails at setup, not mid-tick. An empty list stores
   * nothing.
   */
  installBattleRules(rules: readonly BattleRule[]): void {
    if (this.battleRules.length > 0) {
      throw new Error('World.installBattleRules: rules already installed');
    }
    if (rules.length === 0) return;
    assertBattleRuleStatusRefs(rules);
    this.battleRules = rules;
    registerBattleRules(this, rules);
  }

  /**
   * Installs the battle's camps and their stream (`battleSetup`, or
   * `fromJSON`). Camps are rolled once a battle, so a call after camps are
   * installed throws. An empty list stores nothing, the stream included, so
   * a camp-free world keeps `campRng` null.
   */
  installCamps(camps: readonly CampInstance[], campRng: RNG): void {
    if (this.camps.size > 0 || this._campRng !== null) {
      throw new Error('World.installCamps: camps already installed');
    }
    if (camps.length === 0) return;
    for (const camp of camps) {
      if (this.camps.has(camp.id)) {
        throw new Error(`World.installCamps: duplicate camp instance id ${camp.id}`);
      }
      this.camps.set(camp.id, camp);
      // A probe's dial (`SIM.campsStartHostile`, shipped 0): every camp starts
      // hostile to the player. Adding to a set is idempotent, so the
      // `fromJSON` and rollout-clone installs leave a restored set as it was.
      if (SIM.campsStartHostile > 0) camp.hostileTo.add('player');
    }
    this._campRng = campRng;
  }

  /** The camps' stream, null on a camp-free layout: the camp wander and the
   *  drip draw on it. */
  get campRng(): RNG | null {
    return this._campRng;
  }

  /** The camp with this instance id, or undefined. */
  campById(id: number): CampInstance | undefined {
    return this.camps.get(id);
  }

  /** Every camp in ascending id, the order the drip and the snapshot walk. */
  campsList(): readonly CampInstance[] {
    return Array.from(this.camps.values()).sort((a, b) => a.id - b.id);
  }

  /**
   * Makes the whole camp hostile to `team` for the rest of the battle;
   * `dealDamage` calls it when a team's unit damages a member. An unknown id
   * throws, since a hostility write without its camp is a wiring bug.
   */
  markCampHostile(campId: number, team: Team): void {
    const camp = this.camps.get(campId);
    if (camp === undefined) {
      throw new Error(`World.markCampHostile: unknown camp instance id ${campId}`);
    }
    camp.hostileTo.add(team);
  }

  /** Whether the camp is hostile to `team`. False for an unknown id, so a
   *  reader falls back to the passive default rather than throwing mid-tick. */
  campHostileTo(campId: number, team: Team): boolean {
    return this.camps.get(campId)?.hostileTo.has(team) ?? false;
  }

  /** Adds bits to the battle's tally; a battle rule's `gainBits` calls it. */
  tallyBits(amount: number): void {
    this.tallies.bits += amount;
  }

  /** Test-only read of the bits tally. */
  bitsTallied(): number {
    return this.tallies.bits;
  }

  /**
   * Fires a trigger to its handlers, in registration order. They run inside
   * the step that fired them and change state directly, so what they change
   * is seen from that point on.
   */
  private fireTrigger<K extends TriggerName>(name: K, ctx: TriggerContextMap[K]): void {
    this.triggers.fire(name, ctx, this);
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
   * Applies every queued command now, without advancing the sim. BattleScene
   * calls it while the sim is parked (the countdown before a battle, a pause),
   * so a player's order and its `objective:set` marker take effect at once
   * rather than after the resume. No unit acts while parked, so applying it
   * now or at the next tick's drain is the same to the sim.
   *
   * Each drained command emits `command:applied` stamped with its effective
   * tick, the first tick whose actions can see it: the current tick for the
   * drain inside `tick()`, which runs before the units step, and
   * `tickCount + 1` here, where tick `tickCount` has already run. So a replay
   * injects every command stamped E before tick E runs, parked or not
   * (`replayTrace.ts`). The emit follows `applyCommand`, so a subscriber sees
   * the state after it, and any `objective:set` it produced comes first.
   */
  drainCommands(): void {
    this.drain(this.tickCount + 1);
  }

  private drain(effectiveTick: number): void {
    if (this._ended || this.commands.length === 0) return;
    const drained = this.commands.splice(0, this.commands.length);
    for (const cmd of drained) {
      this.applyCommand(cmd);
      this.bus.emit('command:applied', { tick: effectiveTick, command: cmd });
    }
  }

  /**
   * Register the authoritative spawn region for a team. Battle setup
   * calls this once per team after picking regions; the overflow scan
   * uses the stored region to find free tiles. A second call for the same
   * team replaces its region.
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
   * Books damage to the XP ledger; `dealDamage` calls it after the HP
   * change. It filters here, so `damageDealt.get(id)` at the battle's end is
   * already the damage that earns XP:
   *
   * - damage to the attacker's own team is not booked (a confused unit's
   *   blast can hit its side);
   * - damage to an inert neutral (a wall, half-cover, rubble) is not booked,
   *   since XP rides on opposed combat; a camp member's is, so camp fights
   *   earn XP;
   * - a summon's damage is booked to its summoner (below).
   *
   * Overkill is booked as dealt, not clamped to the HP the target had.
   */
  recordDamage(attackerId: number, target: Unit, damage: number): void {
    if (damage <= 0) return;
    if (isInertNeutral(target)) return;
    const attacker = this.findUnit(attackerId);
    if (!attacker) return;
    if (attacker.team === target.team) return;
    // A summon has no roster slot, so an entry of its own would never be paid.
    // Its damage goes to the summoner's, scaled by `summonDamageXpShare`, so a
    // caster that only summons still levels. The credit stands after the
    // summon or the summoner dies (`playerRosterIds` keeps the dead); a share
    // of 0 books summon damage nowhere.
    if (attacker.summonedBy != null) {
      const credited = Math.round(damage * LEVELING.summonDamageXpShare);
      if (credited > 0) {
        this.damageDealt.set(
          attacker.summonedBy,
          (this.damageDealt.get(attacker.summonedBy) ?? 0) + credited,
        );
      }
      return;
    }
    this.damageDealt.set(attackerId, (this.damageDealt.get(attackerId) ?? 0) + damage);
  }

  /**
   * The one place HP falls: `defense` mitigation, the HP change, the XP
   * ledger, and the camp's hostility and kill credit. Every source of damage
   * comes here, a strike through `applyDamage` and a damage-over-time tick
   * from `applyPeriodicEffects`. The events and the combat triggers stay
   * with the callers, since each source has its own (a strike
   * emits `unit:attacked` and fires `dealHit`, `takeHit` and `kill`; a tick
   * emits `status:ticked`).
   *
   * A hit deals `max(STATS.minDamage, rawDamage − defense)`, so a
   * high-defense target can't cancel a hit outright; `bypassDefense` skips
   * the mitigation. Both operands are integers, so the result is too.
   * `attacker` is undefined for a hit whose attacker is gone or a tick with
   * no source, and then nothing is booked. Returns the damage dealt.
   */
  private dealDamage(
    attacker: Unit | undefined,
    target: Unit,
    rawDamage: number,
    opts: { bypassDefense: boolean },
  ): number {
    const final = opts.bypassDefense
      ? rawDamage
      : Math.max(STATS.minDamage, rawDamage - target.effectiveStats.defense);
    target.currentHp -= final;
    if (attacker) this.recordDamage(attacker.id, target, final);
    // Here, so a blast's splash and a tick with a living source count too: a
    // team that damages a camp member makes the whole camp hostile to it, and
    // the blow that clears the camp stamps `killedBy`. A neutral attacker (a
    // confused camp member) marks nothing.
    if (attacker && target.campId !== null && attacker.team !== 'neutral') {
      this.markCampHostile(target.campId, attacker.team);
      if (target.currentHp <= 0) this.recordCampKill(target.campId, attacker.team);
    }
    return final;
  }

  /**
   * Stamps `killedBy` when a lethal blow leaves the camp cleared
   * (`campCleared`), for `battle:ended.campKills`. The team is `dealDamage`'s
   * resolved attacker's, so a strike and a tick with a living source both
   * stamp; a tick whose source is dead has no team, and the stamp stays null.
   */
  private recordCampKill(campId: number, team: Team): void {
    const camp = this.camps.get(campId);
    if (camp === undefined || !this.campCleared(camp)) return;
    camp.killedBy = team;
  }

  /**
   * A camp is cleared when nothing is pending and no member lives, so there
   * is no credit while members are still dripping in. Read by the kill stamp,
   * the turn-end gate (`hasUnclearedHostileCamp`) and the camp-pull revert in
   * `clearResolvedObjectives`.
   */
  private campCleared(camp: CampInstance): boolean {
    if (camp.pending.length > 0) return false;
    for (const u of this.units) {
      if (u.campId === camp.id && u.currentHp > 0) return false;
    }
    return true;
  }

  /** Whether a camp hostile to `team` is still uncleared, which holds back
   *  `team`'s decisive win (`checkBattleEnd`). An OR over the camps, so their
   *  order doesn't matter. */
  private hasUnclearedHostileCamp(team: Team): boolean {
    for (const camp of this.camps.values()) {
      if (camp.hostileTo.has(team) && !this.campCleared(camp)) return true;
    }
    return false;
  }

  /**
   * Applies a strike: `dealDamage`, the event and the combat triggers. Every
   * strike lands; nothing is drawn here. The damage op calls it with
   * `rawDamage` already scaled by the crit and a blast's ring, and decides
   * whether a unit is hit at all.
   *
   * - `crit` — the flag the op rolled, carried to `unit:attacked`.
   * - `bypassDefense` — passed to `dealDamage`.
   *
   * Returns true. The `applyStatus` op reads it, so a status rides only a
   * strike that lands, which is every strike until there is a dodge.
   */
  applyDamage(
    attackerId: number,
    target: Unit,
    rawDamage: number,
    opts: { crit: boolean; bypassDefense?: boolean },
  ): boolean {
    // Looked up once, for the triggers; the lookup draws nothing.
    const attacker = this.findUnit(attackerId);
    // Landing note for the dodge planned as a passive special (Round 13): it
    // decides here, for a strike whose op is authored `evadable`, before any
    // HP moves. A dodged strike emits `unit:missed`, fires `dealMiss` (the
    // attacker's side) then `evade` (the dodger's), and returns false, so
    // the `applyStatus` op lays nothing. Each of those is kept, idle, for it;
    // a dodge that draws takes `combatRng` after the crit's draw.
    const final = this.dealDamage(attacker, target, rawDamage, {
      bypassDefense: opts.bypassDefense ?? false,
    });
    this.emit('unit:attacked', {
      attackerId,
      targetId: target.id,
      damage: final,
      crit: opts.crit,
    });
    // After the hit resolves, so a handler's change affects the next action,
    // not this one. `kill` fires on a lethal blow, here where the attacker is
    // known, before the reap. None fire with the attacker gone.
    if (attacker) {
      this.fireTrigger('dealHit', { attacker, target, damage: final, crit: opts.crit });
      this.fireTrigger('takeHit', { target, attacker, damage: final, crit: opts.crit });
      if (target.currentHp <= 0) this.fireTrigger('kill', { attacker, victim: target });
    }
    return true;
  }

  /** Test-only read of the damage ledger. */
  damageDealtBy(attackerId: number): number {
    return this.damageDealt.get(attackerId) ?? 0;
  }

  /**
   * Books healing to the XP ledger. `amount` is the HP the heal restored,
   * clamped at maxHp, so healing a full ally earns nothing. Called by the
   * interpreter's heal op and by a periodic heal that has a source.
   *
   * It has no team check, unlike `recordDamage`: heals target allies, and
   * `computeXpAwards` pays only ids in `playerRosterIds`, so an enemy
   * healer's entry is never paid.
   */
  recordHealing(healerId: number, amount: number): void {
    if (amount <= 0) return;
    this.utilityDone.set(healerId, (this.utilityDone.get(healerId) ?? 0) + amount);
  }

  /** Test-only read of the healing ledger. */
  utilityDoneBy(unitId: number): number {
    return this.utilityDone.get(unitId) ?? 0;
  }

  /**
   * Advances the battle one tick:
   *
   * 1. Drain the commands, so every unit sees them this tick, then revert
   *    the objectives whose target is resolved (`clearResolvedObjectives`).
   * 2. Step each unit, over a copy of `units` so a removal doesn't skip a
   *    neighbour:
   *    - reap it if it is dead;
   *    - decrement each action cooldown by one, to a floor of 0;
   *    - expire its timed statuses;
   *    - with an action in flight: re-check a move's destination before
   *      its flip, let the action hold fire, emit each phase that begins
   *      at this offset with `applyEffect` at `impact`, and clear the
   *      action at `finishTick`; a unit still busy stops here;
   *    - skip a unit reserved as a swap's partner;
   *    - refresh its target (`updateTarget`);
   *    - run the selector: poll every behaviour, drop the proposals still
   *      on cooldown, take the highest score, drop a move whose
   *      destination is blocked, then set the cooldown, seat the action,
   *      call `start` and emit its offset-0 phases.
   * 3. Seat the queued units and the camps' drip, fire the chain hops due,
   *    run the periodic statuses, the auras and the tiles, reap the dead,
   *    and check for the battle's end.
   *
   * Cooldowns decrement, then check: a proposal sets its cooldown to the
   * full cadence, not N−1, and the decrement runs before the selector
   * (gotchas #7, #8, #101).
   */
  tick(): void {
    if (this._ended) return;
    this.tickCount++;
    this.bus.emit('tick', { tick: this.tickCount });

    // The units step after this drain, so its effective tick is this one
    // (`drainCommands`).
    this.drain(this.tickCount);

    // After the drain, so an objective set this tick at a target already gone
    // reverts too, and before the units step, so `updateTarget` targets by
    // default this same tick.
    this.clearResolvedObjectives();

    for (const unit of this.units.slice()) {
      if (unit.currentHp <= 0) {
        this.reapUnit(unit);
        continue;
      }

      for (const [actionId, cd] of unit.actionCooldowns) {
        if (cd > 0) unit.actionCooldowns.set(actionId, cd - 1);
      }

      // Before the unit acts, so a status just run out can't shape this
      // tick's proposal. An `endOfTurn` effect lasts the battle and is never
      // expired here. A status with a def emits `status:expired`; a plain stat
      // effect expires silently.
      for (const e of unit.expireEffects(this.tickCount)) {
        if (e.key in STATUS_DEFS) {
          this.bus.emit('status:expired', {
            unitId: unit.id,
            statusId: e.key,
            sourceUnitId: e.sourceUnitId ?? null,
          });
        }
      }

      // An action in flight walks its phase timeline: each phase that begins
      // at this offset emits `action:phase`, in declared order (zero-length
      // phases share a boundary, so several can emit on one tick), and
      // `applyEffect` fires at `impact`.
      if (unit.activeAction !== null) {
        const aa = unit.activeAction;
        const offset = this.tickCount - aa.startTick;

        // A move holds its destination's claim until its flip
        // (`MoveAction.applyEffect`, at `impact`), so a held claim marks a unit
        // still on `from`. If the destination has become occupied or
        // untraversable since the move began, the move aborts here, before the
        // phase walk, rather than flip onto a bad cell: the unit stays on
        // `from`, the claim is released, the move's cooldown resets so it
        // retries next tick, and `unit:moveAborted` drives the renderer's
        // settle-back. A peer's move can't cause it, since the claim blocks
        // convergence; a knockback or a changed tile could.
        // `destinationBlocked` ignores the mover's own claim and body.
        // `moveAbortInflight.test.ts` exercises it.
        const dest = aa.action.destinationCell?.();
        if (dest !== undefined && claimantOf(this, dest) === unit.id && this.destinationBlocked(unit, dest)) {
          this.releaseClaim(dest);
          unit.actionCooldowns.set(aa.action.id, 0);
          this.clearActiveAction(unit);
          this.bus.emit('unit:moveAborted', { unitId: unit.id, from: unit.position, to: dest });
          continue;
        }

        // Before a phase boundary emits, the action may hold fire
        // (`holdCheck`: a def with a `releaseGate` whose target left the firing
        // band during the windup). The action then clears with nothing fired
        // (no phase event, no effect, no draw), and its cooldown is set to the
        // re-aim ticks returned rather than to 0: the crew shifts its aim, it
        // doesn't re-crank. `unit:actionHeld` drives the renderer's re-aim bar.
        let held = false;
        for (const phase of phasesBeginningAt(aa.phases, offset)) {
          const reaimTicks = aa.action.holdCheck?.(phase, unit, this) ?? null;
          if (reaimTicks !== null) {
            unit.actionCooldowns.set(aa.action.id, reaimTicks);
            this.clearActiveAction(unit);
            this.bus.emit('unit:actionHeld', {
              unitId: unit.id,
              actionId: aa.action.id,
              reaimTicks,
            });
            held = true;
            break;
          }
          this.emitActionPhase(unit, aa.action, phase);
          if (phase === 'impact' && aa.action.applyEffect) {
            aa.action.applyEffect(unit, this, offset, 'impact');
          }
        }
        if (held) continue;
        if (this.tickCount >= aa.finishTick) {
          this.clearActiveAction(unit);
        } else {
          continue;
        }
      }

      // A unit reserved as the partner of a swap in flight is skipped for the
      // swap's whole window. Before the flip it must not start an action the
      // flip would spoil (a move would break the exchange; an attack would
      // leave it mid-action as it is moved, which the swap's gates forbid).
      // After the flip the swap is still its action: the renderer is
      // mid-slide, and releasing at the flip let a half-moved unit act or be
      // taken by a second swap. Asked per unit, since a unit earlier in the
      // order may have started the swap this tick. The partner pays no
      // cooldown; the reserve ends with the actor's action (at `finishTick`,
      // or the flip's abort).
      if (unit.activeAction === null && isReservedSwapPartner(unit.id, this)) continue;

      // Once per free unit, before the behaviours poll: `MovementBehavior`
      // and the abilities read `unit.targetId` through `currentTarget`, and
      // refreshing it here moves the re-target decision and `outOfLosTicks`
      // on exactly once a tick.
      updateTarget(unit, this);

      let best: ActionProposal | null = null;
      for (const behavior of unit.behaviors) {
        const proposal = behavior.proposeAction(unit, this);
        if (proposal === null) continue;
        // An ability keys its cooldown by its own id, so two abilities that
        // build the same action keep separate cooldowns; without a key it is
        // the action's id.
        const cdKey = proposal.cooldownKey ?? proposal.action.id;
        const remainingCd = unit.actionCooldowns.get(cdKey) ?? 0;
        if (remainingCd > 0) continue;
        if (best === null || proposal.score > best.score) best = proposal;
      }
      if (best === null) continue;

      // A move whose destination is occupied, claimed by another unit or
      // untraversable as it would start is dropped: it spends no cooldown, so
      // the unit retries next tick from where it stands, and `unit:moveAborted`
      // tells the renderer.
      const dest = best.action.destinationCell?.();
      if (dest !== undefined && this.destinationBlocked(unit, dest)) {
        this.bus.emit('unit:moveAborted', { unitId: unit.id, from: unit.position, to: dest });
        continue;
      }

      const cdKey = best.cooldownKey ?? best.action.id;

      // An action with a zero-length timeline and no `applyEffect` resolves
      // within this tick: `start()` runs and the action is never seated.
      // `activeAction` is serialized, and a zero-length action seated here
      // would sit on the unit until the next tick's sweep, across the boundary
      // where snapshots are taken. A cooldown of 0 is not set either, since
      // `actionCooldowns` serializes 0 entries: a wait leaves the world's bytes
      // as an idle unit would. Only `WaitAction` matches (a move's cooldown is
      // at least 1, and moves and effects have `applyEffect`); its tests pin
      // that it leaves no state.
      if (totalTicks(best.phases) === 0 && !best.action.applyEffect) {
        if (best.cooldown > 0) unit.actionCooldowns.set(cdKey, best.cooldown);
        best.action.start(unit, this);
        for (const phase of phasesBeginningAt(best.phases, 0)) {
          this.emitActionPhase(unit, best.action, phase);
        }
        continue;
      }

      unit.actionCooldowns.set(cdKey, best.cooldown);
      const activeAction = this.seatAction(unit, best.action, best.phases);
      best.action.start(unit, this);
      // The offset-0 phases emit on the start tick, after `start()`, so the
      // renderer hears the first phase the tick the action begins, as an
      // action already in flight is handled above. An offset-0 `impact` with
      // an `applyEffect` fires it here: a one-tick move's or swap's flip lands
      // on its start tick.
      for (const phase of phasesBeginningAt(activeAction.phases, 0)) {
        this.emitActionPhase(unit, activeAction.action, phase);
        if (phase === 'impact' && activeAction.action.applyEffect) {
          activeAction.action.applyEffect(unit, this, 0, 'impact');
        }
      }
    }

    // After the tick's deaths and moves, seat the queued units whose region
    // has a free tile; before `checkBattleEnd`, so a wiped team with units
    // queued reinforces before the battle ends.
    this.runOverflowScan();

    // Each camp tries to seat its next pending member on its anchor.
    this.runCampDripScan();

    // The chain hops due this tick. A unit a hop kills is reaped by the
    // `reapDead()` below, on this tick, as a strike's victim would be.
    processChainHops(this);

    // The periodic statuses, the one pass for HP over time; the tiles feed it
    // through the statuses they sustain (`applyTileStatuses`). A unit a tick
    // kills is reaped below, on this tick.
    this.applyPeriodicEffects();

    // The auras, after the drip, so a member just dripped into an aura is
    // affected this tick, as a unit spawned onto a tile is below.
    this.applyAuraStatuses();

    // The tiles' statuses, after the queue is seated, so a unit spawned onto
    // fire or a healing tile is affected this tick. Then the reap, so a unit
    // killed this tick dies this tick.
    this.applyTileStatuses();
    this.reapDead();

    this.checkBattleEnd();
  }

  /**
   * Emits one `action:phase`, with the target the action reports through
   * `phaseTarget()` (a unit for a homing action, a cell for a ground target).
   * For the renderer; it changes no sim state.
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
   * Applies a status from its def, the one way a status with a def reaches a
   * unit: builds the `StatusEffect` (`buildStatusEffect`), merges it onto the
   * unit under the def's merge policy, and emits `status:applied`. Callers:
   * the `applyStatus` op, a battle rule, the tiles and the auras (through
   * `sustainStatus` and `applyTileEnterEffects`).
   *
   * - `sourceUnitId` — the applier, or null for a tile.
   * - `magnitude` — scales a periodic status's output, and stacks under the
   *   `add` policy.
   * - `durationSecondsOverride` — the op's own duration, in place of the def's.
   *
   * Two gates in the unit's def, read here so they hold for every source.
   * `statusSusceptibility` lists the only statuses the unit can receive (a
   * wall takes burn and frozen alone); absent, it takes all.
   * `statusImmunities` lists those it never receives (the healer's panic), on
   * either team. A gated status is dropped silently: nothing added, no event.
   * The defs are read at call time (gotcha #114).
   */
  applyStatusEffect(
    target: Unit,
    def: StatusDef,
    sourceUnitId: number | null,
    magnitude = 1,
    durationSecondsOverride?: number,
  ): void {
    const allow = ALL_UNIT_DEFS[target.archetype]?.statusSusceptibility;
    if (allow && !allow.includes(def.id)) return;
    const deny = ALL_UNIT_DEFS[target.archetype]?.statusImmunities;
    if (deny?.includes(def.id)) return;
    target.addEffect(
      buildStatusEffect(def, this.tickCount, magnitude, sourceUnitId, durationSecondsOverride),
    );
    this.bus.emit('status:applied', { unitId: target.id, statusId: def.id, sourceUnitId });
  }

  /**
   * Strips a status from a unit, if it carries it: water putting out a burn
   * (`applyTileEnterEffects`). A status with a def emits `status:expired`, as
   * one that runs out does, so the renderer clears its tint; a plain stat
   * effect is stripped silently.
   */
  removeStatusEffect(target: Unit, statusId: string): void {
    const removed = target.removeEffect(statusId);
    if (removed && statusId in STATUS_DEFS) {
      this.bus.emit('status:expired', {
        unitId: target.id,
        statusId,
        sourceUnitId: removed.sourceUnitId ?? null,
      });
    }
  }

  /**
   * A unit's entering a tile, called at a move's or a swap's flip, when the
   * unit is on its new cell: strips the tile's `statusRemovedOnEnter` (water
   * puts out a burn) and applies its `statusOnEnter` (mud poisons, with no
   * source).
   *
   * Once per entry, unlike `applyTileStatuses`, which sustains a status every
   * tick a unit stands on a tile: a step onto mud poisons once, and the
   * cleanse comes only with the move that lands in water. A spawn, a shove or
   * a summon's placement is not an entry.
   */
  applyTileEnterEffects(unit: Unit): void {
    const def = this.tileGrid.defAt(unit.position);
    if (def.statusRemovedOnEnter) {
      this.removeStatusEffect(unit, def.statusRemovedOnEnter);
    }
    if (def.statusOnEnter) {
      this.applyStatusEffect(unit, statusDef(def.statusOnEnter), null);
    }
  }

  /**
   * A periodic op's base: `might`, plus the applier's scaling stat, read live,
   * when the op scales and the applier is still in `units`. Every shipped
   * periodic op is `scaling: 'none'`.
   */
  private periodicOpBase(
    op: { might: number; scaling: 'strength' | 'ranged' | 'magic' | 'none' },
    sourceUnitId: number | null | undefined,
  ): number {
    if (op.scaling === 'none') return op.might;
    const source = sourceUnitId != null ? this.findUnit(sourceUnitId) : undefined;
    return op.might + (source ? source.effectiveStats[op.scaling] : 0);
  }

  /**
   * Queues a chain hop for a later tick; the interpreter's chain pushes here
   * and `processChainHops` fires the due ones. The queue is plain data, and
   * the firing stays in the interpreter.
   */
  scheduleChainHop(hop: PendingChainHop): void {
    this.pendingChainHops.push(hop);
  }

  /**
   * The periodic statuses. For each live unit's effect whose def has a
   * `periodic` block, fire its op when the effect's `nextTickAt` comes due,
   * then move the cursor on by one interval. The cadence is anchored at the
   * first apply, so a top-up extends the duration without shifting the
   * ticks. Damage goes through `dealDamage` under the op's `bypassDefense`;
   * a heal clamps at maxHp. Both emit `status:ticked` with the HP change, not
   * `unit:attacked` or `unit:healed`, so nothing is cued twice. A unit a tick
   * kills ticks none of its other effects, and `reapDead` takes it.
   *
   * In `units` order, then each unit's effect order.
   */
  private applyPeriodicEffects(): void {
    for (const unit of this.units) {
      if (unit.currentHp <= 0) continue;
      for (const effect of unit.effects) {
        const def = STATUS_DEFS[effect.key];
        if (!def?.periodic) continue;
        if (effect.nextTickAt === undefined || this.tickCount < effect.nextTickAt) continue;

        const op = def.periodic.op;
        const base = this.periodicOpBase(op, effect.sourceUnitId);
        const magnitude = Math.round(base * effect.magnitude);
        let amount = 0;
        if (op.kind === 'damage') {
          if (magnitude > 0) {
            const source =
              effect.sourceUnitId != null ? this.findUnit(effect.sourceUnitId) : undefined;
            amount = this.dealDamage(source, unit, magnitude, { bypassDefense: op.bypassDefense });
          }
        } else {
          // HoT — clamp at maxHp; credit the ledger only for a real source.
          const before = unit.currentHp;
          unit.currentHp = Math.min(unit.derived.maxHp, before + magnitude);
          amount = unit.currentHp - before;
          if (amount > 0 && effect.sourceUnitId != null) {
            this.recordHealing(effect.sourceUnitId, amount);
          }
        }
        this.bus.emit('status:ticked', {
          unitId: unit.id,
          statusId: def.id,
          sourceUnitId: effect.sourceUnitId ?? null,
          amount,
        });
        effect.nextTickAt += Math.max(1, secondsToTicks(def.periodic.everySeconds));
        if (unit.currentHp <= 0) break; // dead — don't tick its remaining effects
      }
    }
  }

  /**
   * The tiles' statuses: every live unit on a `fire` tile sustains `burn`,
   * on a `healing` tile `rejuvenate`, with no source. The HP change is the
   * status's periodic tick (`applyPeriodicEffects`).
   *
   * Every tick, so a unit catches fire the tick it steps in; the status's
   * own `everySeconds` paces the damage. In `units` order.
   */
  private applyTileStatuses(): void {
    for (const unit of this.units) {
      // Scenery stands on no tile (a wall burns only from an `applyStatus`);
      // a camp member is a body on a tile like any combatant.
      if (isInertNeutral(unit)) continue;
      if (unit.currentHp <= 0) continue;
      const kind = this.tileGrid.kindAt(unit.position);
      if (kind === 'fire') this.sustainStatus(unit, FIRE_STATUS);
      else if (kind === 'healing') this.sustainStatus(unit, HEALING_STATUS);
    }
  }

  /**
   * The auras: every live carrier (`Ability.aura`) sustains its aura's status
   * on every live unit within `aura.radius` by `unitDistance`, filtered by
   * `affects` relative to the carrier's team; scenery is skipped. The carrier
   * itself is in range when `affects` admits its team. A unit that leaves
   * keeps the status until its own `durationSeconds` runs out, and two auras
   * of one status don't stack, since a sustain only tops up
   * (`sustainStatus`; `aura.test.ts` pins it).
   *
   * In `units` order for both loops. Overlapping auras of one status top up
   * to the same `expiresAtTick`, so the carriers' order changes nothing.
   *
   * Not filtered by camp: `affects` knows teams only, so a camp member's
   * `allies` aura would reach every neutral. No camp unit carries an aura.
   */
  private applyAuraStatuses(): void {
    for (const carrier of this.units) {
      if (carrier.currentHp <= 0) continue;
      for (const ability of carrier.abilities) {
        const aura = ability.aura;
        if (!aura) continue;
        const def = statusDef(aura.statusId);
        for (const unit of this.units) {
          if (unit.currentHp <= 0) continue;
          if (isInertNeutral(unit)) continue;
          if (!affectsMatch(aura.affects, unit.team, carrier.team)) continue;
          if (unitDistance(carrier, unit) > aura.radius) continue;
          this.sustainStatus(unit, def, carrier.id);
        }
      }
    }
  }

  /**
   * Sustains a status from a standing source, a tile underfoot or an aura in
   * range. While the unit lacks the status it is applied through
   * `applyStatusEffect`, which emits `status:applied` once (the renderer's
   * flash) and records the source (an aura's carrier, or null for a tile).
   * After that each tick tops up the duration directly, with no event, so a
   * sustained unit never flashes again and the status never lapses, and the
   * periodic cursor `nextTickAt` is left as it was, so a damage tick keeps its
   * cadence. When the source goes the top-up stops, and the status runs out
   * its `durationSeconds`.
   *
   * The top-up ignores the merge policy and the def's gates: only the first
   * apply is gated, and a unit gated out never carries the status to top up.
   * So a sustained status never stacks, whatever its `merge`.
   */
  private sustainStatus(unit: Unit, def: StatusDef, sourceUnitId: number | null = null): void {
    const existing = unit.effects.find((e) => e.key === def.id);
    if (existing) {
      existing.lifetime = {
        kind: 'ticks',
        expiresAtTick: this.tickCount + Math.max(1, secondsToTicks(def.durationSeconds)),
      };
    } else {
      this.applyStatusEffect(unit, def, sourceUnitId);
    }
  }

  /**
   * Reaps every unit at 0 HP or below at the tick's end: a periodic status's
   * or a chain hop's kill, and a strike's victim that stepped before its
   * killer in the order. A sweep over every unit, which is simpler than a
   * reap at every source of damage.
   */
  private reapDead(): void {
    for (const unit of this.units.slice()) {
      if (unit.currentHp <= 0) {
        this.reapUnit(unit);
      }
    }
  }

  /**
   * Seats queued units: for each team with a queue, walks its region's
   * tiles in stored order and spawns the next template on each free,
   * unclaimed one. A spawn emits `unit:spawned` with `instant: false`, so the
   * renderer fades it in, and is seated with a `SpawnAction`, which keeps it
   * busy for `SIM.spawnDurationTicks`. The order is `QUEUE_TEAMS`, then the
   * queue's, then the tiles'.
   */
  private runOverflowScan(): void {
    for (const team of QUEUE_TEAMS) {
      const queue = this.spawnQueues.get(team);
      if (!queue || queue.length === 0) continue;
      const region = this.spawnRegions.get(team);
      if (!region) continue;

      for (const tile of region.tiles) {
        if (queue.length === 0) break;
        // A unit seated on a moving unit's claimed destination would collide
        // with it at its flip.
        if (this.isOccupied(tile) || claimantOf(this, tile) !== undefined) continue;
        const template = queue.shift()!;
        this.spawnFromQueue(template, team, tile);
      }
    }
  }

  private isOccupied(coord: GridCoord): boolean {
    return unitAt(this, coord) !== undefined;
  }

  /**
   * Whether a move's destination is invalid as it runs: untraversable (an
   * infinite-cost tile), occupied by another unit, or claimed by another
   * unit. The mover is never on `dest` yet, since it is still on `from`; its
   * id is excluded anyway.
   */
  private destinationBlocked(unit: Unit, dest: GridCoord): boolean {
    if (!isFinite(this.tileGrid.costAt(dest))) return true;
    const occupant = unitAt(this, dest);
    if (occupant !== undefined && occupant.id !== unit.id) return true;
    // A proposal made stale by a peer's claim on its cell aborts.
    const claimant = claimantOf(this, dest);
    return claimant !== undefined && claimant !== unit.id;
  }

  /**
   * Claims `cell` for `unitId` as a move's destination (`MoveAction.start`).
   * Until it is released, at the flip or an abort, the pathing predicate
   * treats the cell as blocked for every other unit, so a second unit
   * routes around it rather than converging. One claim a cell: a second
   * write replaces the first.
   */
  claimCell(cell: GridCoord, unitId: number, plane: OccupancyPlane = GROUND): void {
    this.claims.set(cellKey(cell), { cell: { x: cell.x, y: cell.y }, unitId, plane });
  }

  /** Releases the claim on `cell`, at the flip or an abort; nothing if unclaimed. */
  releaseClaim(cell: GridCoord): void {
    this.claims.delete(cellKey(cell));
  }

  /**
   * Releases every claim `unitId` holds. The reap calls it, so a unit that
   * dies mid-move leaves no block on the destination it never reached.
   */
  releaseClaimsBy(unitId: number): void {
    for (const [key, claim] of this.claims) {
      if (claim.unitId === unitId) this.claims.delete(key);
    }
  }

  /**
   * Moves `unit` off its cell to the nearest free cell (`nearestFreeCells`),
   * emitting `unit:moved` for the slide, as a dash does, and `unit:shoved`.
   * Returns false, and moves nothing, when no free cell is within
   * `SIM.shoveSearchRadiusCells`, rather than send the unit across the map.
   * Only tests call it.
   */
  shove(unit: Unit): boolean {
    const [dest] = nearestFreeCells(unit.position, 1, SIM.shoveSearchRadiusCells, this);
    if (dest === undefined) return false;
    const from = unit.position;
    const durationTicks = unit.derived.moveCooldownTicks;
    unit.position = dest;
    this.bus.emit('unit:moved', { unitId: unit.id, from, to: dest, durationTicks });
    this.bus.emit('unit:shoved', { unitId: unit.id, from, to: dest, durationTicks });
    return true;
  }

  /**
   * The camps' drip: each camp with members pending tries to seat the next
   * one on its anchor this tick (`dripCampMember`), in ascending camp id.
   */
  private runCampDripScan(): void {
    if (this.camps.size === 0 || this._campRng === null) return;
    for (const camp of this.campsList()) {
      this.dripCampMember(camp, false);
    }
  }

  /**
   * Seats each camp's first member at once, at battle setup, so it is
   * present and targetable during the countdown as the two teams are; the
   * rest drip in, since they share the anchor. `spawnCamps` calls it after
   * `installCamps`.
   */
  primeCampSpawns(): void {
    if (this.camps.size === 0 || this._campRng === null) return;
    for (const camp of this.campsList()) {
      this.dripCampMember(camp, true);
    }
  }

  /**
   * Seats one camp's next pending member on a footprint that covers its
   * anchor, for the drip and the setup prime. The candidates are scanned in
   * a fixed order (`random-intersect`), drawing on `campRng` only when more
   * than one placement fits (gotcha #111). A blocked anchor waits: a member
   * on the anchor always steps off (`CampWanderBehavior`), which is what
   * keeps the queue moving. `instant` (the prime) skips the `SpawnAction`
   * lockout and the fade; a drip keeps both.
   */
  private dripCampMember(camp: CampInstance, instant: boolean): void {
    const next = camp.pending[0];
    if (next === undefined) return;
    const size = ALL_UNIT_DEFS[next.archetype]?.footprint ?? 1;
    const cells = anchorFootprint(
      camp.anchor,
      size,
      this,
      (c) =>
        isFinite(this.tileGrid.costAt(c)) &&
        isFree(this, c) &&
        claimantOf(this, c) === undefined,
      'random-intersect',
      this._campRng!,
    );
    if (cells === null) return;
    camp.pending.shift();
    // The minimum corner comes first, and it is the unit's `position`.
    this.spawnCampUnit(camp, next, cells[0]!, instant);
  }

  /**
   * Spawns one camp member, its stats from the catalog through `scaledUnit`
   * (no draw), wired by `wireSpawned`. Unlike `spawnFromQueue`, it is
   * `neutral` with a `campId`, and its movement is `CampWanderBehavior`: a
   * wander inside the leash while the camp is passive, `MovementBehavior`'s
   * engagement once the camp's hostility admits a target. It is built here,
   * not by `createMovementBehavior`, because a camp bandit shares the enemy
   * bandit's catalog def, so the catalog's `movementBehavior` can't say it is
   * a camp's. `instant` as in `dripCampMember`.
   */
  private spawnCampUnit(
    camp: CampInstance,
    spec: CampPendingUnit,
    position: GridCoord,
    instant: boolean,
  ): Unit {
    const template = scaledUnit(spec.archetype, spec.level);
    const attackRange = rangeForArchetype(spec.archetype);
    const derived = deriveStats(template.stats, attackRange);
    const unit = this.addUnit(
      {
        team: 'neutral',
        archetype: spec.archetype,
        glyph: glyphForArchetype(spec.archetype),
        stats: template.stats,
        derived,
        position,
        level: spec.level,
        xp: template.xp,
        campId: camp.id,
      },
      instant,
    );
    return this.wireSpawned(unit, new CampWanderBehavior(), instant);
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
        // A player's queued template keeps its roster slot; an enemy's is
        // null.
        rosterIndex: template.rosterIndex ?? null,
        // The statuses the run stamps on the template (`Run.beginTurn`), as
        // an initial spawn carries them.
        ...(template.effects ? { effects: template.effects } : {}),
      },
      false,
    );
    return this.wireSpawned(unit, createMovementBehavior(template.archetype), false);
  }

  /**
   * Applies a drained command, one case per kind. `setObjective` and
   * `clearObjective` change a team's objective; `noop` exercises the channel
   * in the snapshot tests. `setObjective` doesn't check its target: one
   * already gone is reverted by `clearResolvedObjectives`, which runs right
   * after the drain.
   */
  private applyCommand(command: WorldCommand): void {
    switch (command.kind) {
      case 'noop':
        return;
      case 'setObjective':
        this.objectives[command.team] = command.objective;
        this.bus.emit('objective:set', { team: command.team, objective: command.objective });
        return;
      case 'clearObjective':
        this.setObjectiveAtWill(command.team);
        return;
    }
  }

  /**
   * Reverts to `atWill` each team's `engage` or `focus` whose target is
   * resolved:
   *
   * - an `enemy` target that is no longer a living enemy of the team (it
   *   died, was removed, or the id was never valid);
   * - a `neutral` target Targeting no longer admits
   *   (`validNeutralObjectiveTarget`): destroyed, or no longer destructible
   *   or a camp's;
   * - an `engage` on a camp's anchor tile, once that camp is cleared.
   *
   * Any other tile target holds until replaced. Both teams are scanned, and
   * the test is relative to the objective's team. `setObjectiveAtWill`
   * keeps a second revert silent.
   */
  private clearResolvedObjectives(): void {
    for (const team of OBJECTIVE_TEAMS) {
      const obj = this.objectives[team];
      // Only the targeted modes can resolve; atWill/hold carry no target.
      if (obj.mode !== 'engage' && obj.mode !== 'focus') continue;
      if (obj.target.kind === 'enemy') {
        const target = this.findUnit(obj.target.unitId);
        const alive =
          target !== undefined &&
          target.team !== team &&
          target.team !== 'neutral' &&
          target.currentHp > 0;
        if (!alive) this.setObjectiveAtWill(team);
      } else if (obj.target.kind === 'neutral') {
        if (validNeutralObjectiveTarget(this, obj.target.unitId) === null) {
          this.setObjectiveAtWill(team);
        }
      } else if (obj.mode === 'engage' && this.camps.size > 0) {
        // An `engage` on a camp's anchor, the order that pulls a team into
        // the camp, reverts once the camp is cleared, so the team doesn't
        // guard the remains for the rest of the battle.
        for (const camp of this.camps.values()) {
          if (
            camp.anchor.x === obj.target.cell.x &&
            camp.anchor.y === obj.target.cell.y &&
            this.campCleared(camp)
          ) {
            this.setObjectiveAtWill(team);
            break;
          }
        }
      }
    }
  }

  /** Reverts a team to `atWill` and emits `objective:cleared`, only when the
   *  objective was something else; a redundant clear is silent. */
  private setObjectiveAtWill(team: ObjectiveTeam): void {
    if (this.objectives[team].mode === 'atWill') return;
    this.objectives[team] = AT_WILL;
    this.bus.emit('objective:cleared', { team });
  }

  private checkBattleEnd(): void {
    // An empty board before combat began is no battle yet (the ticks before
    // the spawns). After it began, both teams' last units died together and
    // nothing is left: a draw now, rather than a wait of a minute or more for
    // the driver's tick cap.
    if (this.units.length === 0 && this.spawnQueues.size === 0) {
      if (this._combatBegan) this.emitBattleEnded('draw', 'mutualWipe');
      return;
    }
    let playerAlive = false;
    let enemyAlive = false;
    for (const u of this.units) {
      if (u.team === 'player') playerAlive = true;
      else if (u.team === 'enemy') enemyAlive = true;
      // Neutrals (walls, environment entities) don't count toward either
      // side — a battlefield of just walls + corpses isn't a victory.
      if (playerAlive && enemyAlive) {
        this._combatBegan = true;
        return;
      }
    }
    // A team with units queued isn't wiped: they are seated as tiles empty.
    if ((this.spawnQueues.get('player')?.length ?? 0) > 0) playerAlive = true;
    if ((this.spawnQueues.get('enemy')?.length ?? 0) > 0) enemyAlive = true;
    if (playerAlive && enemyAlive) {
      this._combatBegan = true;
      return;
    }
    // Neither team has a combatant. After combat began it is a mutual wipe
    // with scenery left on the board, a draw at once; a board that never had
    // both teams (walls only, or before the spawns) has no result. The
    // `_combatBegan` latch tells them apart.
    if (!playerAlive && !enemyAlive) {
      if (this._combatBegan) this.emitBattleEnded('draw', 'mutualWipe');
      return;
    }
    // A decisive end waits while the winner still has an uncleared camp
    // fight open, and the battle runs on until the camp is cleared: with no
    // way to disengage from a half-fought camp, a win landing mid-fight felt
    // bad, not merciful. Checked here, not in the loop above, whose early
    // return would cut the scan short, and only on the decisive path: after a
    // mutual wipe nobody is left to fight the camp, and the driver's tick cap
    // still ends a stalemate as a draw, so a battle stays bounded.
    if (this.hasUnclearedHostileCamp(playerAlive ? 'player' : 'enemy')) {
      return;
    }
    this.emitBattleEnded(playerAlive ? 'player' : 'enemy', 'decisive');
  }

  /**
   * Ends a battle that reached no decisive end as a draw at the tick cap.
   * The driver calls it (Run's per-turn tick budget, through BattleScene or a
   * harness); a mutual wipe ends earlier, in `checkBattleEnd`. Nothing once
   * ended.
   */
  resolveAsDraw(): void {
    this.emitBattleEnded('draw', 'cap');
  }

  /**
   * The one emit of `battle:ended`, for `checkBattleEnd` and `resolveAsDraw`.
   * Nothing once ended, so a tick cap racing a natural end can't emit twice.
   * Every battle's awards are paid, win or lose, to survivors and fallen
   * alike (`computeXpAwards`), since the roster outlives a battle.
   */
  private emitBattleEnded(
    winner: 'player' | 'enemy' | 'draw',
    reason: 'decisive' | 'mutualWipe' | 'cap',
  ): void {
    if (this._ended) return;
    this._ended = true;
    const livingPlayerIds = new Set<number>();
    for (const u of this.units) {
      if (u.team === 'player' && u.currentHp > 0) livingPlayerIds.add(u.id);
    }
    const xpAwards = computeXpAwards(
      this.playerRosterIds,
      livingPlayerIds,
      this.damageDealt,
      this.utilityDone,
    );
    // The camps cleared, in id order; omitted when there are none.
    const campKills: { defId: string; killedBy: 'player' | 'enemy' }[] = [];
    for (const camp of this.campsList()) {
      if (camp.killedBy === 'player' || camp.killedBy === 'enemy') {
        campKills.push({ defId: camp.defId, killedBy: camp.killedBy });
      }
    }
    this.bus.emit('battle:ended', {
      winner,
      // Why it ended, beside who won: a draw is a mutual wipe
      // (`checkBattleEnd`) or the tick cap (`resolveAsDraw`), and the chip
      // rule's survivors surcharge keys on the cap alone (a mutual wipe is
      // the heaviest casualty turn there is, never a stall).
      reason,
      xpAwards,
      survivorPower: this.survivorPower(),
      // Copies, so the payload shares nothing with the live accumulators.
      fallenPower: { ...this.fallenPower },
      tallies: { ...this.tallies },
      ...(campKills.length > 0 ? { campKills } : {}),
    });
  }

  /**
   * The sum of `power` over each team's living units on the grid. A queued
   * unit never reached the grid and counts nothing, though `checkBattleEnd`
   * counts a queue as alive.
   */
  private survivorPower(): { player: number; enemy: number } {
    let player = 0;
    let enemy = 0;
    // Summed off `survivorsByUnit`, so the two can't drift: the live bar's
    // survivor events at the battle's end are one row each of the units this
    // sum counts.
    for (const u of this.survivorsByUnit()) {
      if (u.team === 'player') player += u.power;
      else enemy += u.power;
    }
    return { player, enemy };
  }

  /**
   * The living combatants on the grid, one row each: `survivorPower`'s
   * per-unit form, under the same filter. The live bar reads it at
   * `battle:ended` for its end sequence (`HUD`, through `run/chipRule.ts`'s
   * loss events); the sim never does.
   */
  survivorsByUnit(): { unitId: number; team: 'player' | 'enemy'; power: number }[] {
    const out: { unitId: number; team: 'player' | 'enemy'; power: number }[] = [];
    for (const u of this.units) {
      if (u.currentHp <= 0) continue;
      // `effectiveStats.power`, so a status that moves power counts at the
      // turn's end; it equals `stats.power` on a unit with no effects.
      if (u.team === 'player' || u.team === 'enemy') {
        out.push({ unitId: u.id, team: u.team, power: u.effectiveStats.power });
      }
    }
    return out;
  }

  /** A copy of the fallen power booked so far this battle: a reader that
   *  attaches mid-battle (a restore) opens its ghost from it. For display. */
  fallenPowerSoFar(): { player: number; enemy: number } {
    return { ...this.fallenPower };
  }

  /**
   * Books a reaped combatant's power to its side's fallen total. `reapUnit`
   * calls it before the splice, while the unit's effects still fold, so the
   * fallen read the `effectiveStats.power` the survivors do. A neutral
   * charges nobody: a camp member's death is no side's loss, while a player
   * unit a camp kills is the player's (the team is booked, not the killer).
   * A summon (`summonedBy`) is booked at 0 whatever its archetype's power:
   * a conjured body is not a loss its side paid for. The catalog can't say
   * it with a power of 0, since encounters and camps field ghouls, and a
   * fielded ghoul is a body like any other.
   */
  private recordFallen(unit: Unit): number {
    if (unit.summonedBy != null) return 0;
    if (unit.team === 'player' || unit.team === 'enemy') {
      const booked = unit.effectiveStats.power;
      this.fallenPower[unit.team] += booked;
      return booked;
    }
    return 0;
  }

  /**
   * The one death path, for the step's check and `reapDead`: fires `death`
   * while the unit is still on the grid, so a handler can read its position
   * and team; books its fallen power (`recordFallen`); removes it; and puts
   * its identity and the power booked on `unit:died`, since nothing
   * downstream can look the unit up once it is spliced out.
   */
  private reapUnit(unit: Unit): void {
    this.fireTrigger('death', { unit, team: unit.team });
    const power = this.recordFallen(unit);
    this.removeUnit(unit.id);
    this.bus.emit('unit:died', {
      unitId: unit.id,
      team: unit.team,
      campId: unit.campId,
      archetype: unit.archetype,
      level: unit.level,
      power,
      summoned: unit.summonedBy != null,
      tick: this.tickCount,
    });
  }

  /**
   * Seats `action` starting now, its `finishTick` now plus its phases'
   * ticks, as the selector, the spawn lockouts and most test fixtures do,
   * and keeps the reserved-partner index. Returns the seated action, whose
   * offset-0 phases the tick then fires.
   */
  seatAction(unit: Unit, action: Action, phases: readonly ActionPhase[]): ActiveAction {
    const aa: ActiveAction = {
      action,
      startTick: this.tickCount,
      finishTick: this.tickCount + totalTicks(phases),
      phases,
    };
    this.seatActiveAction(unit, aa);
    return aa;
  }

  /**
   * Seats a built `ActiveAction` with its own ticks (`fromJSON`'s rehydrate,
   * a test's backdated action); every seat goes through here, which keeps
   * `swapReservedPartners`. Seating over an action is legal (a fixture
   * re-seats a copy with another `startTick`): the old reservation is
   * unindexed first, so nothing counts twice. Throws if the action reserves
   * a partner another actor has reserved: every proposer's
   * `isSwappablePartner` gate rules that out, so reaching it means a gate
   * was bypassed.
   */
  seatActiveAction(unit: Unit, aa: ActiveAction): void {
    this.unindexReservation(unit);
    const pid = aa.action.reservedPartnerId?.();
    if (pid !== undefined) {
      const holder = this.swapReservedPartners.get(pid);
      if (holder !== undefined && holder !== unit.id) {
        throw new Error(
          `seatActiveAction: unit ${pid} is already the reserved partner of ${holder}; ` +
            `unit ${unit.id} may not reserve it too (the isSwappablePartner gate was bypassed)`,
        );
      }
      this.swapReservedPartners.set(pid, unit.id);
    }
    unit._setActiveAction(aa);
  }

  /**
   * Clears the unit's action in flight (at `finishTick`, an abort, a test
   * shedding a spawn lockout) and drops its partner reservation, if any.
   * Nothing on an idle unit.
   */
  clearActiveAction(unit: Unit): void {
    this.unindexReservation(unit);
    unit._setActiveAction(null);
  }

  /** Drops the partner reservation `unit`'s action holds, if any. */
  private unindexReservation(unit: Unit): void {
    const pid = unit.activeAction?.action.reservedPartnerId?.();
    if (pid === undefined) return;
    const holder = this.swapReservedPartners.get(pid);
    if (holder !== unit.id) {
      throw new Error(
        `swapReservedPartners desync: clearing unit ${unit.id}'s reservation of ${pid} ` +
          `but the index holds ${holder === undefined ? 'no entry' : `actor ${holder}`}`,
      );
    }
    this.swapReservedPartners.delete(pid);
  }

  /** Whether `unitId` is a swap's reserved partner. The sim asks through
   *  `isReservedSwapPartner` (`SwapAction.ts`), which reads this. */
  isSwapReservedPartner(unitId: number): boolean {
    return this.swapReservedPartners.has(unitId);
  }

  /** The whole index, for the test that recomputes it by scanning
   *  (`scanReservedSwapPartners`) and compares. */
  get swapReservedPartnerIndex(): ReadonlyMap<number, number> {
    return this.swapReservedPartners;
  }

  removeUnit(id: number): void {
    const i = this.units.findIndex((u) => u.id === id);
    // A removed actor's swap before its flip will never land, but both
    // sprites began their slides at `start`, so the abort is told to the
    // renderer and the pathing metrics as the two-body fact it is; otherwise
    // the partner's sprite finishes a slide the sim never made and rests on
    // the wrong tile until it next moves. `SwapAction.applyEffect`'s abort is
    // the other site. A partner removed before the flip needs nothing here,
    // since the actor's flip degrades or aborts when it fires; after the flip
    // the exchange has landed.
    if (i >= 0) {
      const swap = preFlipSwap(this.units[i]!.activeAction, this.tickCount);
      if (swap !== null) {
        const d = swap.toData();
        this.bus.emit('unit:swapAborted', {
          unitA: id,
          unitB: d.otherId,
          cellA: d.from,
          cellB: d.to,
        });
      }
      // An actor leaving `units` takes its reservation with it. A removed
      // partner's entry stays: the actor's swap is still seated, and its flip
      // degrades or aborts on its own.
      this.unindexReservation(this.units[i]!);
      this.unitList.splice(i, 1);
    }
    this.unitsById.delete(id);
    // A unit that dies mid-move leaves no block on the destination it never
    // reached.
    this.releaseClaimsBy(id);
  }

  /**
   * Places a unit from a template, instantly, as battle setup does. The
   * glyph comes from the archetype, the colour from the team in the
   * renderer. The template carries base stats only; the battle's derived
   * numbers (maxHp, the move cooldown) are computed here (`deriveStats`), so
   * no template carries a stale one. The caller wires it (`wireSpawned`).
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
        // The statuses the run stamps on the template (`Run.beginTurn`).
        ...(template.effects ? { effects: template.effects } : {}),
      },
      true,
    );
  }

  /**
   * Spawns a summon for the `summon` op: one `archetype` unit at `level`, on
   * `team`, at `position`, stamped with `summonerId` so `liveSummonCount`
   * holds the caster to its `maxLive`. Its stats are `scaledUnit`'s, which
   * draw nothing, so a summon moves no stream; `wireSpawned` gives it the
   * lockout and the fade, so it joins as a queued spawn does.
   *
   * A camp member's summon joins the camp: it takes the summoner's `campId`
   * and the camp's movement (`CampWanderBehavior`) in place of the catalog's.
   * A neutral without a camp is scenery (`isInertNeutral`): drawn as a wall,
   * with no hostility to act on, and untargetable, since only destructibles
   * and camp members are legal neutral targets. As a member it counts toward
   * clearing the camp (`campCleared`). A team's summon has no `campId` and
   * the catalog's movement.
   */
  spawnSummon(
    archetype: Archetype,
    level: number,
    team: Team,
    position: GridCoord,
    summonerId: number,
  ): Unit {
    const template = scaledUnit(archetype, level);
    const attackRange = rangeForArchetype(archetype);
    const derived = deriveStats(template.stats, attackRange);
    const campId = this.findUnit(summonerId)?.campId ?? null;
    const unit = this.addUnit(
      {
        team,
        archetype,
        glyph: glyphForArchetype(archetype),
        stats: template.stats,
        derived,
        position,
        level: template.level,
        xp: 0,
        rosterIndex: null,
        summonedBy: summonerId,
        campId,
      },
      false,
    );
    return this.wireSpawned(
      unit,
      campId !== null ? new CampWanderBehavior() : createMovementBehavior(archetype),
      false,
    );
  }

  /**
   * How many of `summonerId`'s summons are alive. The `summon` op's
   * `maxLive` reads it, at propose to abstain at the ceiling and at fire to
   * clamp, so a summoner holds at most `maxLive` and summons again only as
   * they die. Counted from `units`, so there is no ledger to keep.
   */
  liveSummonCount(summonerId: number): number {
    let n = 0;
    for (const u of this.units) {
      if (u.summonedBy === summonerId && u.currentHp > 0) n++;
    }
    return n;
  }

  /**
   * Spawns scenery: a wall, half-cover, rubble, anything on the grid as a
   * unit that is not a combatant. It is `neutral`, which `checkBattleEnd`
   * doesn't count, and has no behaviours, so the selector never runs for it.
   * `archetype` names a neutral def (`NEUTRAL_DEFS`), which gives the glyph,
   * the HP and whether it blocks line of sight; `maxHp` overrides the def's
   * HP, as a layout coord's `hp` does (`environment.ts`). Whether it can be
   * hit is the def's (`isCombatTargetable`).
   */
  spawnEnvironment(opts: {
    archetype: string;
    position: GridCoord;
    maxHp?: number;
  }): Unit {
    const def = NEUTRAL_DEFS[opts.archetype];
    if (!def) {
      throw new Error(
        `spawnEnvironment: '${opts.archetype}' is not a neutral UnitDef (config/units.json)`,
      );
    }
    return this.addUnit(
      {
        team: 'neutral',
        archetype: opts.archetype,
        glyph: def.glyph,
        stats: ZERO_STATS,
        derived: inertDerived(opts.maxHp ?? def.hp ?? NOMINAL_NEUTRAL_MAXHP),
        position: opts.position,
        blocksLineOfSight: def.blocksLineOfSight,
      },
      true,
    );
  }

  /**
   * Wires a unit that has just taken the field: its movement behaviour, then
   * `AbilityBehavior`, then its archetype's abilities, and, unless the spawn
   * is instant, the spawn lockout, a `SpawnAction` whose one `impact` phase
   * only times the busy window. The first deployment, an overflow spawn, a
   * camp member and a summon all come through here. The movement behaviour's
   * `kind` is snapshotted and rehydrated by `createBehavior`, so it
   * round-trips.
   */
  wireSpawned(unit: Unit, movement: Behavior, instant: boolean): Unit {
    unit.behaviors.push(movement, new AbilityBehavior());
    for (const id of abilityIdsForArchetype(unit.archetype)) {
      unit.abilities.push(createAbility(id));
    }
    if (!instant) {
      this.seatAction(unit, new SpawnAction(), [{ phase: 'impact', ticks: SIM.spawnDurationTicks }]);
    }
    return unit;
  }

  /**
   * Adds a unit to `units` and the index, books a player unit's roster
   * slot, emits `unit:spawned` and fires `spawn`. `instant` tells a setup
   * spawn (the layout, a camp's first member), which the renderer shows at
   * once, from a unit joining a battle under way (a queued spawn, a drip, a
   * summon), which it fades in over the `SpawnAction` lockout. It rides
   * `unit:spawned`, so a subscriber need not ask the world.
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
      summonedBy?: number | null;
      campId?: number | null;
      effects?: readonly StatusEffect[];
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
      targeting: targetingForArchetype(init.archetype),
      level: init.level ?? 1,
      xp: init.xp ?? 0,
      rosterIndex: init.rosterIndex ?? null,
      summonedBy: init.summonedBy ?? null,
      campId: init.campId ?? null,
      ...(init.effects && init.effects.length > 0 ? { effects: init.effects } : {}),
    });
    this.placeUnits(unit);
    // Booked before any death can reap it. Only a player unit with a roster
    // slot earns XP, the filter `computeXpAwards` pays by.
    if (unit.team === 'player' && unit.rosterIndex !== null) {
      this.playerRosterIds.set(unit.id, unit.rosterIndex);
    }
    this.bus.emit('unit:spawned', { unitId: unit.id, instant });
    // For every unit entering the grid, scenery included; a handler filters
    // by team.
    this.fireTrigger('spawn', { unit });
    return unit;
  }

  /**
   * Puts built units in `units` and the index as they are, with no event or
   * trigger. A repeated id throws, since the index would keep only the last.
   */
  placeUnits(...units: Unit[]): void {
    for (const u of units) {
      if (this.unitsById.has(u.id)) {
        throw new Error(`World.placeUnits: unit id ${u.id} is already placed`);
      }
      this.unitsById.set(u.id, u);
    }
    this.unitList.push(...units);
  }

  findUnit(id: number): Unit | undefined {
    return this.unitsById.get(id);
  }

  /**
   * The whole state as plain JSON: everything that affects determinism, the
   * streams, the tick, each unit's HP, cooldowns and action, the queued
   * commands. The bus is left out; a rehydrate takes a fresh one.
   */
  toJSON(): WorldSnapshot {
    const spawnQueues: SpawnQueueSnapshot[] = [];
    for (const [team, templates] of this.spawnQueues) {
      // Copies, so a push after the snapshot doesn't change it.
      spawnQueues.push({
        team,
        templates: templates.map((t) => {
          // `rosterIndex` only when set, for `exactOptionalPropertyTypes`.
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
      // A copy of the record, whose slots are reassigned; the objectives
      // themselves are immutable, so they are shared.
      objectives: { player: this.objectives.player, enemy: this.objectives.enemy },
      // Each hop's mutable parts (`fromPos`, `hitIds`) are copied; `op` and
      // `resolution`, fixed at the cast, are shared.
      pendingChainHops: this.pendingChainHops.map((h) => ({
        ...h,
        fromPos: { ...h.fromPos },
        hitIds: h.hitIds.slice(),
      })),
      // A flat list, since the key is derived from `cell`; each cell is
      // copied.
      claims: Array.from(this.claims.values()).map((c) => ({
        cell: { x: c.cell.x, y: c.cell.y },
        unitId: c.unitId,
        plane: c.plane,
      })),
      // The rules are fixed for the battle, so they are shared; the tally and
      // the fallen power are live, so they are copied.
      battleRules: this.battleRules.slice(),
      tallies: { ...this.tallies },
      fallenPower: { ...this.fallenPower },
      // `hostileTo` in `QUEUE_TEAMS`' order, so the image doesn't depend on
      // the order the hostility came in. The mutable parts are copied, so a
      // later drip doesn't reach the snapshot.
      camps: this.campsList().map((c) => ({
        id: c.id,
        defId: c.defId,
        anchor: { ...c.anchor },
        hostileTo: QUEUE_TEAMS.filter((t) => c.hostileTo.has(t)),
        pending: c.pending.map((p) => ({ ...p })),
        killedBy: c.killedBy,
      })),
      campRng: this._campRng === null ? null : this._campRng.toJSON(),
    };
  }

  /**
   * Rebuilds a World from a snapshot, in two phases: the units without their
   * actions, then the actions in flight, once every unit exists, since an
   * action may name another unit by id (a swap's partner, a strike's target).
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
        // Re-derived from archetype (static per archetype, not snapshotted).
        targeting: targetingForArchetype(us.archetype),
        level: us.level,
        xp: us.xp,
        rosterIndex: us.rosterIndex,
        summonedBy: us.summonedBy,
        campId: us.campId,
        // The constructor folds `effectiveStats` and `refreshDerived` from
        // them again, and the restored `derived` is the same under that.
        effects: us.effects,
      });
      unit.currentHp = us.currentHp;
      unit.targetId = us.targetId;
      unit.outOfLosTicks = us.outOfLosTicks;
      for (const [actionId, cd] of us.actionCooldowns) {
        unit.actionCooldowns.set(actionId, cd);
      }
      for (const kind of us.behaviors) unit.behaviors.push(createBehavior(kind));
      for (const id of us.abilities) unit.abilities.push(createAbility(id));
      world.placeUnits(unit);
    }

    // Phase 2: in-flight actions, now that every unit exists for id lookup.
    for (let i = 0; i < snap.units.length; i++) {
      const us = snap.units[i]!;
      const unit = world.units[i]!;
      if (us.activeAction) {
        // Through `seatActiveAction`, which rebuilds the reserved-partner
        // index.
        world.seatActiveAction(unit, {
          action: createAction(us.activeAction.actionId, us.activeAction.actionData, world),
          startTick: us.activeAction.startTick,
          finishTick: us.activeAction.finishTick,
          phases: us.activeAction.phases.map((p) => ({ ...p })),
        });
      }
    }

    for (const cmd of snap.pendingCommands) world.commands.push(cmd);

    for (const entry of snap.spawnQueues) {
      world.spawnQueues.set(entry.team, entry.templates.slice());
    }
    for (const entry of snap.spawnRegions) {
      world.spawnRegions.set(entry.team, entry.region);
    }

    // The ledgers, so `battle:ended` pays what the battle unrestored would.
    for (const [attackerId, total] of snap.damageDealt) {
      world.damageDealt.set(attackerId, total);
    }
    // `addUnit` doesn't run on a rehydrate (phase 1 calls `placeUnits`), so
    // the roster ids come back from the snapshot alone.
    for (const [unitId, rosterIndex] of snap.playerRosterIds) {
      world.playerRosterIds.set(unitId, rosterIndex);
    }
    for (const [unitId, total] of snap.utilityDone) {
      world.utilityDone.set(unitId, total);
    }

    world.objectives.player = snap.objectives.player;
    world.objectives.enemy = snap.objectives.enemy;

    // Each hop's mutable parts are copied.
    for (const h of snap.pendingChainHops) {
      world.pendingChainHops.push({ ...h, fromPos: { ...h.fromPos }, hitIds: h.hitIds.slice() });
    }

    // Keyed again by cell.
    for (const c of snap.claims) {
      world.claims.set(cellKey(c.cell), { cell: { x: c.cell.x, y: c.cell.y }, unitId: c.unitId, plane: c.plane });
    }

    // Installing the rules registers their handlers again.
    world.installBattleRules(snap.battleRules);
    world.tallies.bits = snap.tallies.bits;
    // The dead are gone from `units`, so their power comes back from the
    // snapshot alone.
    world.fallenPower.player = snap.fallenPower.player;
    world.fallenPower.enemy = snap.fallenPower.enemy;

    // Every `defId` must be in the catalog: the leash and the rewards are read
    // from the def when needed, so a missing one would fail far from here,
    // mid-tick. The mutable parts are copied.
    for (const c of snap.camps) {
      if (getCamp(c.defId) === undefined) {
        throw new Error(`World.fromJSON: unknown camp def "${c.defId}"`);
      }
      world.camps.set(c.id, {
        id: c.id,
        defId: c.defId,
        anchor: { ...c.anchor },
        hostileTo: new Set(c.hostileTo),
        pending: c.pending.map((p) => ({ ...p })),
        killedBy: c.killedBy,
      });
    }
    world._campRng = snap.campRng === null ? null : RNG.fromJSON(snap.campRng);
    // A camp member whose instance isn't in the registry is a corrupt save —
    // hostility reads would fall back to passive (`campHostileTo` answers
    // false for an unknown id), the quiet mis-decode the version check
    // exists to prevent.
    for (const u of world.units) {
      if (u.campId !== null && !world.camps.has(u.campId)) {
        throw new Error(
          `World.fromJSON: unit ${u.id} references unknown camp instance ${u.campId}`,
        );
      }
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
    summonedBy: unit.summonedBy,
    campId: unit.campId,
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
    // Copies, since a merge changes a live unit's effects in place.
    effects: unit.effects.map(cloneEffect),
  };
}
