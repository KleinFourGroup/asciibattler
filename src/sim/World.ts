import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG, type RNGSnapshot } from '../core/RNG';
import type { GridCoord } from '../core/types';
import { GRID_SIZE, secondsToTicks } from '../config';
import {
  Unit,
  type Archetype,
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
  targetingForArchetype,
  scaledUnit,
} from './archetypes';
import type { WorldCommand } from './Command';
import { AT_WILL } from './objective';
import type { ObjectiveTeam, TeamObjective } from './objective';
import { focusTileResolvedByArrival } from './focusTile';
import type { StatusEffect } from './statusEffects';
import { cloneEffect } from './statusEffects';
import { STATUS_DEFS, statusDef } from '../config/statuses';
import type { StatusDef } from './effects/statusSchema';
import { buildStatusEffect } from './effects/statusRuntime';
import { TriggerDispatcher } from './triggers';
import type { TriggerContextMap, TriggerHandler, TriggerName } from './triggers';
import { createAction } from './actions/registry';
import { processChainHops, type PendingChainHop } from './effects/interpreter';
import { createBehavior, createMovementBehavior } from './behaviors/registry';
import { createAbility } from './abilities/registry';
import { updateTarget } from './Targeting';
import { unitAt } from './occupancy';
import { TileGrid, type TileGridSnapshot } from './TileGrid';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { SpawnAction } from './actions/SpawnAction';
import { SPAWN } from '../config/spawn';
/**
 * 27d — the tile→status map. A unit standing on a `fire` tile sustains `burn`;
 * a `healing` tile sustains `rejuvenate`. Resolved ONCE at module load via
 * `statusDef` (which throws loudly if 27c's catalog ever loses one), so a missing
 * tile status fails at boot rather than at the first fire-tile step. The actual
 * HP change is the status's periodic tick (`applyPeriodicEffects`), so all damage
 * now flows through the single `dealDamage`/`applyDamage` chokepoint — the D7.B
 * per-tile chip pass (with its own `currentHp -=` + `unit:burned`) is retired.
 */
const FIRE_STATUS = statusDef('burn');
const HEALING_STATUS = statusDef('rejuvenate');
import type { SpawnRegion } from './layouts';
import { ZERO_STATS, deriveStats, hitChanceFor, inertDerived } from './stats';
import { computeXpAwards } from './xp';
import { STATS } from '../config/stats';
import { LEVELING } from '../config/leveling';

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
 *  19 — I1 reverted the GP1 `agility → speed` rename and added two dodge keys
 *       (`precision`, `evasion`) to `UnitStats` (canonical order CON·STR·RNG·
 *       MAG·LCK·DEF·PRC·EVA·SPD·MOB·POW). Stats round-trip as a whole object by
 *       key, so a v18 snapshot carries an `agility`-keyed, dodge-less stat
 *       block; the version check rejects it outright (no migration — same
 *       stat-shape-contract rationale as GP1/GP2/H1). v18 throws on load.
 *  20 — I5 split the `melee` archetype into a family, RENAMING the key
 *       `melee → mercenary` (+ new `adventurer`/`ronin`/`bandit`). Unlike the
 *       prior bumps this is NOT a stat-shape change: a v19 snapshot carries
 *       units tagged `archetype: 'melee'`, which no longer resolves to a config
 *       — rehydrating one would crash deriving its abilities/glyph/stats. Reject
 *       outright (no migration; the renamed key has no automatic mapping). v19
 *       throws on load.
 *  21 — I6 removed `critChance` from `UnitSnapshot.derived` (the `UnitDerived`
 *       shape is stored verbatim). Crit is now resolved PER-ABILITY at attack
 *       time (`critChanceFor(ability.critBase, luck)`, gated on
 *       `ability.critable`), so the per-unit field no longer exists to
 *       serialize — the same kind of derived-field removal as E5's v12
 *       (`attackCooldownTicks`). The evadable strike actions also thread a new
 *       `accuracy` (+ `evadable`) into their serialized `actionData`; a v20
 *       mid-action snapshot would lack them. Reject v20 outright (no migration).
 *  22 — I6 commit 2 split the basic-strike ability ids: `melee_strike` → the
 *       per-subclass weapons `sword`/`club`/`katana`/`whip`, and `ranged_shot`
 *       → `bow`. `UnitSnapshot.abilities` stores the resolved id list, so a v21
 *       save carries `['melee_strike']`/`['ranged_shot']` that no longer resolve
 *       in the ability registry → `createAbility` would throw on rehydrate.
 *       Reject v21 outright (no migration; the renamed ids have no automatic
 *       mapping — same rationale as I5's archetype-key rename at v20). RunSnapshot
 *       is unaffected: roster templates carry only `archetype`, and abilities are
 *       re-resolved from the (updated) archetype config at spawn.
 *  23 — J1 added the player team's shared `objective` (a tile or an enemy unit;
 *       see `src/sim/objective.ts`) to WorldSnapshot — a mid-battle save must
 *       restore the active steering objective. A v22 save has no `objective`
 *       field; rather than default it (silently dropping a saved objective is a
 *       behavior change, not a missing-field nicety), reject v22 outright per
 *       the established no-migration contract. RunSnapshot is unaffected — the
 *       objective is World-side + transient per battle.
 *  24 — K1 added per-unit `effects` (the generic status-effect list) to
 *       `UnitSnapshot`. A v23 save has no `effects` field; defaulting it to
 *       `[]` would silently drop a saved buff/debuff (a behavior change), so
 *       reject v23 outright per the established no-migration contract. The
 *       fold is name-keyed and the base `stats` block is unchanged, so this is
 *       a purely additive per-unit field. RunSnapshot is NOT bumped by this
 *       commit — the World-side effect list is the only new state (the
 *       Run-side encounter store + fatigue migration land in K1 commit 2).
 *  25 — O1 (Phase O) replaced the single nullable player `objective`
 *       (v23's `objective: BattleObjective | null`) with a per-team,
 *       always-present typed objective (`objectives: { player, enemy }`, each a
 *       `TeamObjective` = mode + optional target; see `src/sim/objective.ts`). A
 *       v24 save carries the old `objective` field and lacks `objectives`;
 *       defaulting it would silently drop a saved steering objective (a behavior
 *       change), so reject v24 outright per the established no-migration
 *       contract. RunSnapshot is unaffected — the objective is World-side +
 *       transient per battle.
 *  26 — Y5 (the data-driven attack/effect migration) retired the per-verb action
 *       classes: a combat verb's in-flight `activeAction` now serializes as the
 *       generic `EffectActionData` (def id + cast-time ctx) instead of the legacy
 *       per-class payloads (`AttackActionData` / `MagicBoltActionData` / …), and
 *       the colliding `attack`/`heal` action-factory entries are gone. A v25 save
 *       with an in-flight melee/heal/magic/catapult/gambit/dash carries the OLD
 *       payload under the OLD action id; rehydrating it now would mis-decode (an
 *       `attack`/`heal` id throws in `abilityDef`, and gambit/dash/magic/catapult
 *       route to `EffectAction.fromData` expecting the new shape). Reject v25
 *       outright per the no-migration contract. RunSnapshot is unaffected —
 *       roster abilities are ids re-resolved at spawn, not serialized actions.
 *  27 — Phase 27 (statuses, periodic axis) added the per-unit periodic runtime
 *       state to `StatusEffect`: `nextTickAt` (the DoT/HoT tick cursor) +
 *       `sourceUnitId` (attribution). A v26 save's `effects[]` carry neither, so
 *       a mid-tick burn/bleed/poison/rejuvenate would resume with no cursor and
 *       silently stop ticking. Reject v26 outright per the no-migration contract
 *       (a pre-27 save has no periodic statuses anyway — the feature didn't
 *       exist). RunSnapshot is unaffected — statuses are World-side + transient.
 *  28 — §29c follow-up (the chain per-hop delay) added `pendingChainHops`: the
 *       queue of chain jumps waiting to fire on a future tick. A v27 save has no
 *       such field, so a mid-arc chain would resume with its remaining hops lost
 *       (the lightning stops halfway). Reject v27 outright per the no-migration
 *       contract — a pre-28 chain resolved all-at-once, so a v27 save never has a
 *       hop in flight. RunSnapshot is unaffected (the queue is World-side +
 *       transient).
 *  29 — §29d (summon) added `summonedBy` to every unit (the id of the caster whose
 *       `summon` op spawned it, or `null`). A v28 save's units carry no such field,
 *       so a restored summoned minion couldn't be attributed to its summoner and
 *       the per-caster `maxLive` cap would mis-count (re-summon past the ceiling).
 *       Reject v28 outright per the no-migration contract — a pre-29 save has no
 *       summons anyway (the op didn't exist). RunSnapshot is unaffected (summons
 *       are World-side combatants, never on the roster).
 *  30 — §31b (effect scaling) routes the `applyStatus` op's magnitude + duration
 *       through cast-time-captured `OpResolution` slots (`statusMagnitude` /
 *       `statusDurationSeconds`, + the reserved `summonLevel` 31c fills), instead
 *       of the interpreter reading the live op fields. A v29 save with an in-flight
 *       applyStatus (a mid-windup afflicter, or a queued chain hop carrying an
 *       applyStatus inner op) serialized its resolution as `{}` — so under v30 the
 *       status would resume at default magnitude 1 / def-duration, silently
 *       dropping even a bare-number-authored magnitude. Reject v29 outright per the
 *       no-migration contract. RunSnapshot is unaffected (the captured scalars are
 *       World-side + transient on the in-flight action).
 */
const WORLD_SCHEMA_VERSION = 30;

/**
 * Deterministic team iteration order for the post-death overflow scan.
 * Neutrals never appear in the queue (walls don't have templates), so
 * skipping them here is a deliberate scope.
 */
const QUEUE_TEAMS: readonly Team[] = ['player', 'enemy'];

/** O1 — the teams that carry an objective (neutrals never do). Iterated by the
 *  per-team revert-on-death scan; narrower than `QUEUE_TEAMS` so it indexes the
 *  `objectives` record directly. */
const OBJECTIVE_TEAMS = ['player', 'enemy'] as const;

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
  /** §29d — the summoning caster's id (null = not a summon). v29. */
  summonedBy: number | null;
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
   * E2 — registry ids for the unit's abilities (e.g. `['sword']`,
   * `['bow']`; I6 renamed the basic-strike ids). Order is preserved across the round-trip since
   * AbilityBehavior uses array order to break score ties. Environment
   * units (walls, half-cover) have no behaviors and no abilities, so
   * this serializes as an empty array.
   */
  abilities: string[];
  actionCooldowns: [string, number][];
  activeAction: ActiveActionSnapshot | null;
  /**
   * K1 — active status effects (stat modifiers + lifetime + merge policy). A
   * mid-battle save must restore them so the effective stat block + the
   * remaining lifetimes resume identically. Empty for the no-effect common
   * case. `endOfTurn` effects round-trip too (they're cleared by World
   * teardown, not the tick loop, so a resumed battle keeps them).
   */
  effects: StatusEffect[];
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
  /** O1: the per-team, always-present steering objective (replaces J1's single
   *  nullable `objective`). The enemy team is fixed at `atWill` today; the
   *  storage is structural for future enemy strategies. Restored so a
   *  mid-battle save resumes both teams' objectives. */
  objectives: { player: TeamObjective; enemy: TeamObjective };
  /** §29c: chain jumps waiting to fire on a future tick (the per-hop delay). A
   *  chain caught mid-arc by a save resumes its remaining hops from here. Empty
   *  for every non-chain battle and for an instant (`hopDelaySeconds: 0`) chain. */
  pendingChainHops: PendingChainHop[];
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

  /**
   * §29c — chain jumps waiting to fire on a future tick (the per-hop delay). A
   * staggered chain enqueues its next hop here; `processChainHops` (driven once per
   * `tick`, alongside the periodic-status pass) fires the due ones. Reassigned in
   * place by the processor (drops the fired hops, keeps the not-yet-due tail), so
   * it's mutable, not `readonly`. Serialized in the WorldSnapshot (v28) so a chain
   * caught mid-arc by a save resumes its remaining hops.
   */
  pendingChainHops: PendingChainHop[] = [];

  private readonly bus: EventBus<GameEvents>;
  private tickCount = 0;
  private nextUnitId = 1;
  private _ended = false;
  /**
   * 34a — one-way latch, set the first tick BOTH teams field a living combatant
   * (or a queued spawn). It tells a GENUINE mutual wipe (both teams had units
   * and both are now gone → resolve as a draw immediately) apart from the
   * pre-spawn / walls-only board (never had both teams → stay silent). NOT
   * serialized: it re-latches on the first post-restore tick that sees both
   * teams alive — which necessarily precedes any mutual wipe — so a snapshot
   * round-trip is unaffected and no version bump is needed.
   */
  private _combatBegan = false;
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
   * contribution) — the 27d `rejuvenate` HoT a healing tile applies carries
   * `sourceUnitId: null`, which `applyPeriodicEffects` skips for the ledger.
   * Read once at `battle:ended`
   * alongside `damageDealt`; snapshotted so a mid-battle round-trip
   * preserves the heal-XP awarded on win.
   */
  private readonly utilityDone: Map<number, number> = new Map();
  /**
   * O1: the per-team, always-present steering objective (the Phase-O refactor of
   * J1's single nullable player objective). Set/cleared only through the command
   * channel (`applyCommand`) so the mutation point is the deterministic
   * top-of-tick drain; read by `updateTarget` + `MovementBehavior` (tile
   * pursuit) via `objectiveFor(team)` — behaviors steer off the ACTING unit's
   * team objective. The ENEMY team is fixed at `atWill` today (nothing sets it),
   * so enemy AI is unchanged; the storage is real so a future enemy strategy is
   * a data change, not a refactor. An `engage` enemy target that dies reverts
   * its team to `atWill` (`clearResolvedObjectives`); a `tile` target persists
   * until replaced. Snapshotted (v25). The field reference is fixed; only the
   * per-team slots are reassigned, so it's `readonly`.
   */
  private readonly objectives: { player: TeamObjective; enemy: TeamObjective } = {
    player: AT_WILL,
    enemy: AT_WILL,
  };
  /**
   * K1 — combat/lifecycle trigger dispatch. Handlers apply status effects when
   * the World fires a trigger; the Phase-L daemon system is the production
   * consumer (K1 ships the dispatch + fire points + tests). NOT snapshotted —
   * handlers are behaviour, re-attached at construction by their owner; in K1
   * production nothing registers for the combat triggers, so a mid-battle
   * resume has none to re-attach.
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
   * O1 — the acting team's always-present objective. Neutrals (walls) never
   * carry one → `atWill` (defensive; they never reach the objective-reading
   * paths). Behaviors call this with the acting unit's team.
   */
  objectiveFor(team: Team): TeamObjective {
    return team === 'neutral' ? AT_WILL : this.objectives[team];
  }

  /**
   * Behaviors and actions call this to publish sim events (unit:moved,
   * unit:attacked, etc.) without holding a reference to the bus.
   */
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.bus.emit(event, payload);
  }

  /**
   * K1 — register a handler for a trigger. Multiple handlers fire in
   * registration order. The owner (a daemon layer in L; a test fixture in K1)
   * is responsible for re-registering on a fresh/rehydrated World — handlers
   * are not snapshotted.
   */
  registerTrigger<K extends TriggerName>(name: K, handler: TriggerHandler<K>): void {
    this.triggers.register(name, handler);
  }

  /**
   * K1 — fire a trigger to its registered handlers (deterministic, in
   * registration order). Handlers run synchronously inside the sim step that
   * fired them — they mutate unit effects directly, so the change is visible to
   * subsequent ticks.
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
   * Apply every queued command now, WITHOUT advancing the sim. `tick()` calls
   * this at its top-of-tick drain; BattleScene also calls it while the sim is
   * PARKED (Q2: the pre-battle countdown / a mid-battle pause) so a player order
   * — and its `objective:set` marker — takes effect immediately instead of
   * waiting for the first tick after resume. Determinism holds: no unit acts
   * while parked, so applying an objective now vs. at the next tick is
   * observably identical (the next tick's drain then finds the queue empty).
   * No-op once ended or when the queue is empty.
   */
  drainCommands(): void {
    if (this._ended || this.commands.length === 0) return;
    const drained = this.commands.splice(0, this.commands.length);
    for (const cmd of drained) this.applyCommand(cmd);
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
    // §33 — a SUMMONED unit has no roster slot, so its own ledger entry is never
    // banked at battle end (only `playerRosterIds` get paid). Redirect its damage
    // to the SUMMONER's tally, scaled by `summonDamageXpShare`, so a summon-only
    // caster levels with its minions' performance. The summoner keeps the credit
    // even after the minion (or the summoner itself) dies — `playerRosterIds`
    // persists the dead. `share = 0` disables the credit (summon damage banks
    // nowhere, the pre-§33 behaviour).
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
   * Environmental DoTs (the `burn` a fire tile applies, 27d) don't route through
   * THIS to-hit wrapper — the periodic tick calls `dealDamage` directly with
   * `bypassDefense: true`, so they stay unmissable and the GP2 `defense`
   * mitigation never touches them, while still flowing through the one HP/ledger
   * core (no bespoke `currentHp -=` anymore).
   *
   * GP2.2 — subtractive `defense` mitigation lands on the single `final` line:
   * a confirmed hit deals `max(STATS.minDamage, rawDamage − target.defense)`,
   * applied to the already crit/cover-resolved `rawDamage`. Both operands are
   * integers, so `final` stays integral (no re-round). The `minDamage` floor
   * keeps a high-defense target from fully negating chip/AoE.
   *
   * I2 — `opts.evadable` opts a call into the dodge to-hit roll. The caller
   * has ALREADY drawn the crit roll (in its `start`/`applyEffect`), so the
   * `combatRng` draw order is fixed at **crit → miss**: a missed strike simply
   * discards the pre-rolled crit. Only single-target strikes (melee/ranged
   * basic + the rogue gambit) pass `evadable: true`; the mage AoE, the
   * catapult, the direct-`applyDamage` tests, and environmental fire/chasm
   * damage (which bypasses this method entirely) are all unmissable — they omit
   * it (default `false`) and draw nothing here. On a miss: deal 0, emit
   * `unit:missed` (no HP mutation, no `recordDamage`, no `unit:attacked`), and
   * return before mitigation.
   *
   * I6 — `opts.accuracy` is the firing ability's per-weapon base hit chance
   * (from `config/abilities.json`), threaded by the evadable strike actions and
   * fed to `hitChanceFor` in place of the retired global `hitChanceBase`. It is
   * only consumed when `evadable` (and a live attacker exists); a missing
   * accuracy on the evadable degraded path is treated as unmissable, the same
   * as a missing attacker.
   *
   * 29 — RETURNS whether the blow LANDED: `true` on a confirmed hit (incl. the
   * unmissable / degraded paths), `false` only on an evade miss. The status-on-hit
   * `applyStatus` op reads this so a status rides a landed hit and skips a missed
   * swing (the interpreter records the miss into the per-fire scratch). Callers
   * that don't care (the legacy damage paths) ignore the value — byte-identical.
   */
  /**
   * 27 — the shared damage CORE: subtractive `defense` mitigation (skipped when
   * `bypassDefense`, the DoT path), the HP deduction, and the XP-ledger credit.
   * Returns the final damage dealt. This is the single mitigation chokepoint —
   * every HP-reducing source routes through it (the combat `applyDamage` wrapper
   * below, and `applyPeriodicEffects`' DoT ticks), so future shields/resistances
   * slot in ONE place. Event emission + the to-hit roll + the combat triggers
   * stay with the callers (a strike emits `unit:attacked` + dealHit/takeHit/kill;
   * a DoT tick emits `status:ticked`), so the per-source semantics don't leak in
   * here. `attacker` is the resolved Unit (or undefined: a degraded combat hit or
   * an environmental DoT) — no `recordDamage` credit without one.
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
    return final;
  }

  applyDamage(
    attackerId: number,
    target: Unit,
    rawDamage: number,
    opts: { crit: boolean; evadable?: boolean; accuracy?: number; bypassDefense?: boolean },
  ): boolean {
    // K1 — looked up once: a live attacker is the runtime invariant (the strike
    // is cast by it), and the combat triggers below need the Unit. `findUnit`
    // is an O(1) `unitsById` hit and draws no RNG, so hoisting it off the
    // evadable-only path is byte-identical.
    const attacker = this.findUnit(attackerId);
    if (opts.evadable && opts.accuracy !== undefined) {
      // The guard only covers a degraded path (attacker gone) — treat it as an
      // unmissable hit there rather than drawing combatRng against no precision.
      if (attacker) {
        // M6 — bog-down: a unit wading in shallow water fights with docked
        // precision (clumsy footing → "miss more"), the combat half of the
        // water tile's effect alongside its cost-2 move slow. Live tile read
        // like the fire/heal pass; occupant-attacker only (shooting INTO water
        // from dry land is unaffected). Only the to-hit THRESHOLD shifts — the
        // combatRng draw below is unchanged, so a dry-land strike stays
        // byte-identical and the `hitChanceFloor` clamp protects a now-negative
        // effective precision.
        const wading = this.tileGrid.kindAt(attacker.position) === 'shallow_water';
        const precision = wading
          ? attacker.effectiveStats.precision - STATS.waterPrecisionPenalty
          : attacker.effectiveStats.precision;
        const hitChance = hitChanceFor(
          opts.accuracy,
          precision,
          target.effectiveStats.evasion,
        );
        if (this.combatRng.next() >= hitChance) {
          this.emit('unit:missed', { attackerId, targetId: target.id });
          // K1 — the evade pair fires post-resolution (no HP touched). The
          // attacker side (`dealMiss`) and the target/dodger side (`evade`,
          // the L dodge-buff hook). Skipped on the degraded no-attacker path.
          this.fireTrigger('dealMiss', { attacker, target });
          this.fireTrigger('evade', { target, attacker });
          return false; // 29 — the miss the status-on-hit gate reads.
        }
      }
    }
    const final = this.dealDamage(attacker, target, rawDamage, {
      bypassDefense: opts.bypassDefense ?? false,
    });
    this.emit('unit:attacked', {
      attackerId,
      targetId: target.id,
      damage: final,
      crit: opts.crit,
    });
    // K1 — combat triggers fire AFTER the hit resolves, so a handler's stat
    // changes affect the next action, not this one. `kill` fires when the blow
    // is lethal (clean attacker attribution here, before the death reap). All
    // skipped on the degraded no-attacker path.
    if (attacker) {
      this.fireTrigger('dealHit', { attacker, target, damage: final, crit: opts.crit });
      this.fireTrigger('takeHit', { target, attacker, damage: final, crit: opts.crit });
      if (target.currentHp <= 0) this.fireTrigger('kill', { attacker, victim: target });
    }
    return true; // 29 — landed (incl. the unmissable / degraded paths).
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

    this.drainCommands();

    // O1 — revert any team whose `engage` enemy target died (e.g. last tick) to
    // `atWill`, so the per-unit `updateTarget` below sees the reverted objective
    // and uses default targeting this same tick. Also catches a just-enqueued
    // objective that points at an already-dead/invalid enemy. Runs after the
    // command drain so a set-then-resolve in one tick is consistent.
    this.clearResolvedObjectives();

    for (const unit of this.units.slice()) {
      // 1. Death.
      if (unit.currentHp <= 0) {
        // K1 — `death` fires while the unit is still on the grid (before the
        // splice), so a handler can read its position/team.
        this.fireTrigger('death', { unit, team: unit.team });
        this.removeUnit(unit.id);
        this.bus.emit('unit:died', { unitId: unit.id, team: unit.team });
        continue;
      }

      // 2. Decrement per-action cooldowns.
      for (const [actionId, cd] of unit.actionCooldowns) {
        if (cd > 0) unit.actionCooldowns.set(actionId, cd - 1);
      }

      // 2.5. K1 — expire timed (`ticks`) status effects before the unit acts,
      // so a just-expired buff can't influence this tick's proposal. A no-op
      // (no array touch) for the no-effect common case. `endOfTurn` effects
      // are never removed here — they live for the whole battle.
      // 27 — fire `status:expired` for each removed status-DEF effect (the viz
      // lifecycle); plain K1 stat effects (not in STATUS_DEFS) stay silent.
      for (const e of unit.expireEffects(this.tickCount)) {
        if (e.key in STATUS_DEFS) {
          this.bus.emit('status:expired', {
            unitId: unit.id,
            statusId: e.key,
            sourceUnitId: e.sourceUnitId ?? null,
          });
        }
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

    // 29c — fire any chain hops that came due this tick (the per-hop delay). Sits
    // beside the periodic pass — both are scheduled over-time HP changes routed
    // through `dealDamage`, and the shared `reapDead()` below reaps a hop-kill on
    // the SAME tick (combat-kill ordering).
    processChainHops(this);

    // 27 — per-unit periodic status ticks (DoT/HoT). The fire/healing tiles
    // feed this via `applyTileStatuses` below (a unit standing on fire carries
    // `burn`, on healing carries `rejuvenate`), so this is the single HP-over-
    // time pass; the shared `reapDead()` reaps a DoT-kill on the SAME tick.
    this.applyPeriodicEffects();

    // 27d — refresh the tile-sourced statuses AFTER the overflow scan so a
    // freshly-spawned unit that lands on a fire/healing tile is afflicted the
    // same tick. Replaces the D7.B per-tile chip pass: the HP change is now the
    // status's periodic tick (above), routed through `dealDamage`/the HoT clamp,
    // not an ad-hoc `currentHp -=` here. A `reapDead()` sweep follows so a unit
    // killed by a burn tick dies on the SAME tick (combat-kill ordering).
    this.applyTileStatuses();
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
   * 27 — apply a status to `target` from its `StatusDef` (the single apply
   * chokepoint for status-DEF effects). Builds the runtime `StatusEffect`
   * (merge-mapped, periodic cursor seeded), merges it onto the unit honouring
   * the merge policy, and fires `status:applied`. `sourceUnitId` = the applier
   * (the §29 caster) or `null` (environmental, the §27d fire tile). `magnitude`
   * scales the periodic output + stacks under the `add` policy (default 1);
   * `durationSecondsOverride` (29) lets an `applyStatus` op override the def's
   * base duration. Callers: §27d (fire/healing tiles) and §29 (the `applyStatus`
   * op — the status-on-hit production applier).
   */
  applyStatusEffect(
    target: Unit,
    def: StatusDef,
    sourceUnitId: number | null,
    magnitude = 1,
    // 29 — the `applyStatus` op's optional per-application duration override.
    durationSecondsOverride?: number,
  ): void {
    target.addEffect(
      buildStatusEffect(def, this.tickCount, magnitude, sourceUnitId, durationSecondsOverride),
    );
    this.bus.emit('status:applied', { unitId: target.id, statusId: def.id, sourceUnitId });
  }

  /**
   * 27 — the flat base of a periodic op: `might` + the scaling stat. §27 content
   * is all `scaling:'none'` (flat `might`); the live-source scaling branch is a
   * forward seam (a poison scaling off its applier's stat), contributing 0 when
   * the op is flat or the source is gone/dead.
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
   * 27 — per-unit PERIODIC status pass (DoT/HoT). Each tick, for every live
   * unit's effects whose def carries a `periodic` block, fire its op when the
   * per-unit `nextTickAt` cursor comes due, then advance the cursor by one
   * interval (a fixed cadence anchored at first apply — reapply tops up duration
   * without shifting the tick phase). A DoT routes its damage through the shared
   * `dealDamage` chokepoint (honouring `bypassDefense`); a HoT clamps at maxHp.
   * Both emit `status:ticked` (the single viz event, carrying the HP delta) —
   * NOT `unit:attacked` / `unit:healed`, so there's no double-cue. A unit killed
   * by a DoT stops ticking its remaining effects (and is reaped by `reapDead`).
   *
   * Iteration order is `this.units` insertion order then effect-array order —
   * deterministic, replay-stable for fuzz (mirrors `applyTileStatuses`). A unit
   * with no periodic effect is a cheap per-effect no-op; the fire/healing tiles
   * (27d) are the first in-battle source that seeds one.
   */
  /**
   * §29c — enqueue a chain jump to fire on a future tick (the per-hop delay). The
   * interpreter's `executeChain` / `advanceChainHop` push here; `processChainHops`
   * (driven in `tick`) fires the due ones. Thin by design — the queue is plain data
   * the snapshot round-trips, and all the firing logic stays in the interpreter.
   */
  scheduleChainHop(hop: PendingChainHop): void {
    this.pendingChainHops.push(hop);
  }

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
   * 27d — the tile-effect pass (replaces the D7.B per-tile chip). Each tick,
   * every live combatant standing on a `fire` tile sustains `burn`, on a
   * `healing` tile sustains `rejuvenate` — environmental, so `sourceUnitId` is
   * `null` (the §27 default, mirroring the old chip's `healerId: null`). The
   * actual HP change is the status's periodic tick (`applyPeriodicEffects`), so
   * fire/healing now route through the same `dealDamage` / HoT-clamp path as
   * every other source — no bespoke `currentHp -=` here.
   *
   * Runs every tick (not on a cadence) so a unit catches fire the instant it
   * steps in; the burn DoT's own `everySeconds` paces the damage. Neutrals
   * (walls, half-cover) are skipped per the D7 "combatants only" rule; dead
   * units (awaiting reap) too. Iteration is `this.units` insertion order —
   * deterministic, so the `status:applied` stream is replay-stable for fuzz.
   */
  private applyTileStatuses(): void {
    for (const unit of this.units) {
      if (unit.team === 'neutral') continue;
      if (unit.currentHp <= 0) continue;
      const kind = this.tileGrid.kindAt(unit.position);
      if (kind === 'fire') this.sustainTileStatus(unit, FIRE_STATUS);
      else if (kind === 'healing') this.sustainTileStatus(unit, HEALING_STATUS);
    }
  }

  /**
   * 27d — sustain a tile's status on a standing unit. On ENTER (the status not
   * yet present) it routes through `applyStatusEffect`, which fires
   * `status:applied` once (→ the renderer's apply flash). On every subsequent
   * tick it tops up the duration DIRECTLY (no event), so a standing unit never
   * re-flashes yet the `refresh` status never lapses — and, critically, the
   * periodic `nextTickAt` cursor is left untouched, so the DoT cadence keeps
   * running on its original anchor (a per-tick `applyStatusEffect` re-apply
   * would also preserve the cursor, but would spam `status:applied`). Stepping
   * off stops the top-up, so the status lingers its remaining `durationSeconds`
   * then expires — the "lingers after stepping off" feel.
   */
  private sustainTileStatus(unit: Unit, def: StatusDef): void {
    const existing = unit.effects.find((e) => e.key === def.id);
    if (existing) {
      existing.lifetime = {
        kind: 'ticks',
        expiresAtTick: this.tickCount + Math.max(1, secondsToTicks(def.durationSeconds)),
      };
    } else {
      this.applyStatusEffect(unit, def, null);
    }
  }

  /**
   * D7.B / 27 — reap any unit whose currentHp dropped to 0 (or below) during the
   * end-of-tick passes. Combat kills are already reaped inside the per-unit
   * loop's step-1 death check, so in practice this matches PERIODIC-status kills
   * (a `burn`/`bleed`/`poison` DoT tick, including the fire-tile burn). Kept as
   * an unconditional sweep because O(N) on a small N is cheaper than auditing
   * every damage source for an inline reap.
   */
  private reapDead(): void {
    for (const unit of this.units.slice()) {
      if (unit.currentHp <= 0) {
        // K1 — fire `death` before the splice (mirrors the step-1 death check).
        this.fireTrigger('death', { unit, team: unit.team });
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
    // §35 — the overflow scan routes through the occupancy chokepoint. Byte-
    // identical to the old inline scan at one plane / single-cell footprints.
    return unitAt(this, coord) !== undefined;
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
        // K1 — overflow spawns carry the same seed effects as their
        // initial-spawn siblings (the stamped template round-trips them).
        ...(template.effects ? { effects: template.effects } : {}),
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
   * O1 — apply a drained `WorldCommand`. One explicit case per kind (kept here
   * rather than inlined in `tick` so a new kind is one branch, not a tick
   * rewrite). The `setObjective` / `clearObjective` kinds drive a team's
   * always-present steering objective; `noop` is the snapshot-test channel
   * exerciser. `setObjective` does NOT validate the target here — an `engage`
   * objective pointing at a dead/invalid unit is reverted on the next
   * `clearResolvedObjectives` (called right after this drain).
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
   * O1 — revert any team whose `engage`/`focus` ENEMY target is no longer a
   * living enemy (it died, was removed, or the objective was set on an invalid
   * id) back to `atWill`. An `engage` `tile` target never auto-reverts
   * (persist-until-cleared); a `focus` `tile` target reverts per its switchable
   * resolution strategy (O3 — `disallow` reverts at once, `clearOnArrival` on
   * first arrival, `leashAtNearest` never). Both teams are scanned (the enemy
   * team is inert today but the storage is structural). Idempotent via
   * `setObjectiveAtWill`'s guard. The "alive enemy" test is team-relative (the
   * target must be an enemy OF the objective owner), so it generalizes to a
   * future enemy-team objective; for the player team it's the J1
   * `target.team === 'enemy'` check exactly.
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
      } else if (obj.mode === 'focus') {
        // O3 — a focus TILE reverts when its strategy says it's resolved. (An
        // engage TILE falls through here untouched — it persists, the J1 rule.)
        if (focusTileResolvedByArrival(team, obj.target.cell, this)) {
          this.setObjectiveAtWill(team);
        }
      }
    }
  }

  /** O1 — revert a team to `atWill` + emit `objective:cleared`, but only on a
   *  real non-`atWill` → `atWill` transition (a redundant clear is silent — the
   *  J1 guard, now per team). */
  private setObjectiveAtWill(team: ObjectiveTeam): void {
    if (this.objectives[team].mode === 'atWill') return;
    this.objectives[team] = AT_WILL;
    this.bus.emit('objective:cleared', { team });
  }

  private checkBattleEnd(): void {
    // Empty world isn't "battle over" — it's "no battle yet." Guards the
    // pre-spawn ticks. 34a: once combat has BEGUN, an empty board IS a battle
    // over — a genuine mutual wipe where both teams' last units died together
    // with no walls left behind — so resolve it as a DRAW now rather than
    // leaving it to the driver's tick cap (a minute+ static wait).
    if (this.units.length === 0 && this.spawnQueues.size === 0) {
      if (this._combatBegan) this.emitBattleEnded('draw');
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
        this._combatBegan = true; // 34a — both teams fielded a combatant.
        return;
      }
    }
    // D5.C — a team with units still in queue isn't wiped; the overflow
    // scan will reinforce as tiles vacate. Treat them as alive so the
    // battle doesn't end prematurely.
    if ((this.spawnQueues.get('player')?.length ?? 0) > 0) playerAlive = true;
    if ((this.spawnQueues.get('enemy')?.length ?? 0) > 0) enemyAlive = true;
    if (playerAlive && enemyAlive) {
      this._combatBegan = true; // 34a — both teams present (queued spawns count).
      return;
    }
    // No combatants left = mutual annihilation OR walls-only / pre-spawn.
    // 34a: a GENUINE mutual wipe (combat began, both teams now gone but walls
    // remain so the board is non-empty) resolves as a DRAW immediately. A
    // walls-only / pre-spawn board (combat never began) must NOT trip the
    // condition — the `_combatBegan` latch tells them apart, replacing the old
    // "leave it to the per-turn tick cap" silent return.
    if (!playerAlive && !enemyAlive) {
      if (this._combatBegan) this.emitBattleEnded('draw');
      return;
    }
    this.emitBattleEnded(playerAlive ? 'player' : 'enemy');
  }

  /**
   * H4 — the DRIVER (Run's per-turn tick budget, via BattleScene or the
   * headless test harness) force-resolves a battle that hasn't reached a
   * decisive end as a DRAW: both sides' surviving units chip the opposing
   * health pool by their Σ`power`. (34a moved the mutual-wipe draw INTO
   * `checkBattleEnd` — a genuine double-KO now ends immediately, so this is
   * the generic timeout terminator, no longer the only mutual-wipe path.)
   * No-op once `_ended`.
   */
  resolveAsDraw(): void {
    this.emitBattleEnded('draw');
  }

  /**
   * H4 — single battle-end emit path shared by the natural decisive end
   * (`checkBattleEnd`) and the forced draw (`resolveAsDraw`). Idempotent: a
   * no-op once `_ended`, so a tick-cap that races a natural end can't
   * double-emit.
   *
   * E4 follow-up: the roster persists across battles, so a "dead" player unit
   * isn't really gone — `computeXpAwards` pays survivors AND fallen units
   * (the latter their damage share + an `xpFlatPerFallen` slice). H4 drops the
   * old `winner === 'player'` gate so every turn's damage banks into the
   * encounter's XP total.
   */
  private emitBattleEnded(winner: 'player' | 'enemy' | 'draw'): void {
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
    this.bus.emit('battle:ended', { winner, xpAwards, survivorPower: this.survivorPower() });
  }

  /**
   * H4 — Σ`power` over each team's living on-grid units (the chip each side
   * deals the opposing pool). Excludes the spawn queue: a queued unit never
   * reached the grid, so it contributed no power even though `checkBattleEnd`
   * treats a non-empty queue as "alive" for end-detection.
   */
  private survivorPower(): { player: number; enemy: number } {
    let player = 0;
    let enemy = 0;
    for (const u of this.units) {
      if (u.currentHp <= 0) continue;
      // K1 — pool chip reads `effectiveStats.power` so a power buff/debuff (the
      // fatigue migration's target) shows up at the turn boundary. Identity-
      // equal to `stats.power` when the unit has no effects.
      if (u.team === 'player') player += u.effectiveStats.power;
      else if (u.team === 'enemy') enemy += u.effectiveStats.power;
    }
    return { player, enemy };
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
        // K1 — seed the template's transient effects (fatigue / encounter
        // buffs from Run.beginTurn) onto the unit at spawn.
        ...(template.effects ? { effects: template.effects } : {}),
      },
      true,
    );
  }

  /**
   * §29d — spawn a SUMMONED minion (the `summon` op): one `archetype` unit at
   * `level`, on `team`, at `position`, attributed to `summonerId` (so
   * `liveSummonCount` can enforce the caster's `maxLive` cap). Mirrors
   * `spawnFromQueue` — the deterministic `scaledUnit` stats (no RNG draw, so a
   * summon never perturbs the combat / spawn streams), the shared
   * `createMovementBehavior` + `AbilityBehavior` + archetype abilities, and the
   * `SpawnAction` lockout + `unit:spawned{instant:false}` fade (the minion appears
   * mid-battle and joins next tick, like a D5.C overflow spawn).
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
      },
      false,
    );
    unit.behaviors.push(createMovementBehavior(archetype), new AbilityBehavior());
    for (const id of abilityIdsForArchetype(archetype)) {
      unit.abilities.push(createAbility(id));
    }
    unit.activeAction = {
      action: new SpawnAction(),
      startTick: this.tickCount,
      finishTick: this.tickCount + SPAWN.durationTicks,
      phases: [{ phase: 'impact', ticks: SPAWN.durationTicks }],
    };
    return unit;
  }

  /**
   * §29d — how many of `summonerId`'s summoned minions are currently ALIVE. The
   * `summon` op's `maxLive` gate reads this (at propose, to abstain at the ceiling;
   * at fire, to clamp), so a summoner holds ≤ `maxLive` minions and re-summons only
   * as they die. Dead minions leave `units` via `reapDead`, so the count drops
   * automatically — no ledger to maintain.
   */
  liveSummonCount(summonerId: number): number {
    let n = 0;
    for (const u of this.units) {
      if (u.summonedBy === summonerId && u.currentHp > 0) n++;
    }
    return n;
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
      summonedBy?: number | null;
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
      // K1 — seed transient spawn-time effects (fatigue / encounter buffs).
      ...(init.effects && init.effects.length > 0 ? { effects: init.effects } : {}),
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
    // K1 — `spawn` fires for every unit entering the grid (initial layout +
    // D5.C overflow; walls included — handlers filter by team). The effect-seed
    // path that applies fatigue at deploy lands in commit 2.
    this.fireTrigger('spawn', { unit });
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
      // O1 — copy the record (its slots are reassigned on set/revert); the
      // per-team `TeamObjective` values are immutable, so referencing them is
      // safe; callers JSON-serialize the snapshot anyway.
      objectives: { player: this.objectives.player, enemy: this.objectives.enemy },
      // 29c — copy each pending hop's MUTABLE per-hop state (`fromPos`/`hitIds`);
      // `op`/`resolution` are immutable cast-time data, safe to reference (the
      // caller JSON-serializes the snapshot anyway).
      pendingChainHops: this.pendingChainHops.map((h) => ({
        ...h,
        fromPos: { ...h.fromPos },
        hitIds: h.hitIds.slice(),
      })),
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
        // Re-derived from archetype (static per archetype, not snapshotted).
        targeting: targetingForArchetype(us.archetype),
        level: us.level,
        xp: us.xp,
        rosterIndex: us.rosterIndex,
        // §29d — restore the summon attribution so the `maxLive` cap re-counts
        // a resumed summoner's live minions (v28 saves rejected above, so a v29
        // unit always carries the field).
        summonedBy: us.summonedBy,
        // K1 — restore status effects; the constructor re-folds `effectiveStats`
        // + `refreshDerived` from them. `us.derived` (also restored) is
        // idempotent under that recompute.
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

    // O1 — restore both teams' steering objectives (the version check above
    // already rejected any v24 save that lacks the `objectives` field).
    world.objectives.player = snap.objectives.player;
    world.objectives.enemy = snap.objectives.enemy;

    // 29c — restore the pending chain hops (copy the mutable per-hop bits; the
    // version check above rejected any v27 save that lacks the field).
    for (const h of snap.pendingChainHops) {
      world.pendingChainHops.push({ ...h, fromPos: { ...h.fromPos }, hitIds: h.hitIds.slice() });
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
    // K1 — deep-copy so the wire image never shares a mutable instance with the
    // live unit (merge mutates effects in place).
    effects: unit.effects.map(cloneEffect),
  };
}
