/**
 * The run's state machine: the state that outlives a battle (the roster and
 * its deck, the pools, the map and the run's place on it, the daemons,
 * packets and bits, the phase) and the rules that move it. The phases are
 * listed on `RunPhase`.
 *
 * A run walks a sequence of sectors (`sectorWalk.ts`), each a node map with
 * its own pools and theme. Clearing a sector's terminal moves the run to a
 * successor sector, or wins it at a sink of the sector map; the shipped map
 * is two sectors (`config/sectorMap.ts`).
 *
 * `Run` does not build the World. It builds the turn's `BattleEncounter`
 * (the seeds, the board, both teams, the battle rules) and emits
 * `battle:started`; the battle scene builds the World from
 * `run.currentEncounter`.
 *
 * Inputs come in as commands through `dispatch` (`Command.ts`, whose header
 * holds the rule for a command that does not apply); what happened goes out
 * on the bus.
 *
 * Determinism: every draw comes from a stream derived per occurrence from
 * the run's `streamRoot`, a key and stable ids (`streamRng`;
 * `src/core/rngStreams.ts` holds the keys, which are permanent), so one
 * occurrence's draws never shift another's. The contract is in TESTING.md.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents, PoolChangeReason, PromotionInfo } from '../core/events';
import { glyphForArchetype, ALL_ARCHETYPES } from '../sim/archetypes';
import { RNG, deriveRng } from '../core/RNG';
import type { RngStreamKey } from '../core/rngStreams';
import type { UnitTemplate } from '../sim/Unit';
import { rollUnit } from '../sim/archetypes';
import { generate as generateNodeMap, stampRootKind, PRE_ROOT_NODE_ID, type NodeMap, type NodeKind } from './NodeMap';
import { FORCE_PROCEDURAL, sectorAdvanceConfig, type RunConfig } from './RunConfig';
import { getSector, eventPoolAtHop, type SectorDef } from '../config/sectors';
import { SECTOR_MAP, type SectorMap } from '../config/sectorMap';
import { pickStartSector, pickNextSector, isSectorSink, remainingSectorHops } from './sectorWalk';
import { rollOffer, recruitLevelBonus, draftPoolsFor } from './Recruitment';
import {
  characterById,
  DEFAULT_CHARACTER_ID,
  type CharacterConfig,
} from '../config/characters';
import type { UnitRarity } from '../config/units';
import { avgTeamLevel } from './enemyBudget';
import { fatigueEffect } from './fatigue';
import {
  turnCharges,
  playerExposure,
  enemyExposure,
  type SidePower,
  type TurnEndReason,
} from './chipRule';
import { redrawRejection } from './redraw';
import { empowerRejection, empowerEffect, type EmpowerStackView } from './empower';
import {
  resolveTurnGrants,
  resolveInstantHooks,
  battleRulesFor,
  battleBitsDaemonIds,
  disabledTurnGrants,
  daemonRedrawHook,
  daemonEmpowerHook,
  activeGrantIndex,
  grantViews,
  type TurnGrant,
  type TurnGrants,
  type TurnGrantView,
  type InstantOp,
} from './daemon';
import type { BattleRule } from '../sim/battleRules';
import { foldRunStats, RUN_STAT_BASES, type RunStatKey, type RunStatModifier } from './runStats';
import { cloneEffect, mergeEffectInto, type StatusEffect } from '../sim/statusEffects';
import type { RunCommand } from './Command';
import { RECRUITMENT } from '../config/recruitment';
import { TERRAIN } from '../config/terrain';
import { HEALTH } from '../config/health';
import { DECK } from '../config/deck';
import {
  DIFFICULTY,
  resolveDifficultyMultipliers,
  scaledEnemyPool,
  type DifficultyMultipliers,
} from '../config/difficulty';
import { ESCALATION_MAX, isEscalationLevel, withEscalation } from '../config/escalation';
import { getEncounter, type Encounter, type EncounterKind } from '../config/encounters';
import { resolveWave, type WaveContext } from './encounters/wave';
import { waveForTurn, type WaveCursor, type EncounterState } from './encounters/sequencer';
import { selectEncounter } from './encounters/selection';
import { DAEMONS, daemonById, type DaemonConfig } from '../config/daemons';
import { packetById, PACKETS, type UseContext } from '../config/packets';
import { rewardTableById, type EncounterRewardRef } from '../config/rewards';
import { getCamp } from '../config/camps';
import {
  EVENTS,
  visitedFlagFor,
  type EventDef,
  type EventPage,
  type EventCondition,
  type EventEffectOp,
  type EventNext,
  type EventFlagValue,
} from '../config/events';
import { rollRewards, type RewardPortion } from './rewards';
import { PRICES, unitPrice, packetPrice, daemonPrice, sellPrice } from '../config/prices';
import { LAYOUT_IDS, getLayout, type Theme } from '../sim/layouts';
import { LEVELING } from '../config/leveling';
import { xpToNext } from '../sim/xp';
import { simulateLevelUps } from '../sim/leveling';
import { growthRatesForArchetype } from '../sim/archetypes';
import type { Archetype } from '../sim/archetypes';

/**
 * Where the run stands, saved with it. Every full-screen beat is a phase, so
 * `Game` routes on the phase and a save restores the screen (`resume`).
 * - `map` — choosing the next node from the frontier; a run and each new
 *   sector start here.
 * - `port` — docked at a port node, its stock rolled on entry; `leavePort`
 *   returns to `map`.
 * - `event` — an event node's page; an outcome returns to `map`, opens a
 *   fight (`battle`), or ends the run (`defeat`).
 * - `rest` — a rest node's gate; `chooseRestOption` applies the rest, then
 *   `promotion` if a unit leveled, else `map`.
 * - `turn-intro` — the pre-turn gate, entered only with `pauseAtTurnGates`;
 *   `advanceTurn` starts the battle. The headless loop goes straight to
 *   `battle`.
 * - `battle` — a turn being fought.
 * - `turn-outcome` — the post-turn gate, entered only with
 *   `pauseAtTurnGates`; `advanceTurn` runs the gate chain.
 * - `reward` — an offer from a turn that did not lose the run: its bits
 *   tally, a wiped camp's loot, a won encounter's loot.
 * - `promotion` — units leveled, at a turn's end or a rest.
 * - `recruit` — the offer after a won encounter that was not the sector's
 *   terminal; `chooseRecruit` or `passRecruit` returns to `map`.
 * - `sectorCleared` — a sector's terminal won with the sector map going on;
 *   the next sector is already in place, and `dismissSectorCleared` returns
 *   to its `map`.
 * - `defeat`, `complete` — the run's ends.
 *
 * After a turn the gate chain is reward, then promotion, then the next turn
 * or the encounter's end (`continueFromTurnGate`), on the gated and the
 * headless path alike.
 */
export type RunPhase =
  | 'map'
  | 'port'
  | 'event'
  | 'rest'
  | 'turn-intro'
  | 'battle'
  | 'turn-outcome'
  | 'reward'
  | 'promotion'
  | 'recruit'
  | 'sectorCleared'
  | 'defeat'
  | 'complete';

/**
 * A port's stock: rolled once on docking (`rollPortStock`), saved while
 * docked so a save keeps it, and dropped on `leavePort`, since a port is
 * never re-entered. A slot is marked `sold` rather than spliced out, so the
 * buy commands' indices stay put and the port screen shows the slot sold.
 *
 * A unit slot holds the whole rolled template, as a recruit offer does, at a
 * jittered price; a packet or daemon slot holds a catalog id at the price
 * book's price.
 */
interface PortUnitSlot {
  readonly template: UnitTemplate;
  readonly price: number;
  sold: boolean;
}
interface PortPacketSlot {
  readonly packetId: string;
  readonly price: number;
  sold: boolean;
}
interface PortDaemonSlot {
  readonly daemonId: string;
  readonly price: number;
  sold: boolean;
}
export interface PortStock {
  readonly units: PortUnitSlot[];
  readonly packets: PortPacketSlot[];
  readonly daemons: PortDaemonSlot[];
}

/**
 * Up to `count` distinct entries of `pool`, uniformly, by a partial
 * Fisher–Yates on a copy. It draws `min(count, pool.length)` ints, so its
 * draw count follows the pool's size, which the port's owned-daemon filter
 * changes; the daemon sample is the last draw on the port's stock stream.
 */
function sampleDistinct<T>(pool: readonly T[], count: number, rng: RNG): T[] {
  const copy = [...pool];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const j = rng.int(i, copy.length - 1);
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy.slice(0, n);
}

/** One cumulative-weight draw over `items`: exactly one `next()`, a list
 *  of one included, unlike `sectorWalk`'s `pickWeighted` (gotcha #111), and
 *  the last item if rounding runs past the sum. The event's pick and a
 *  choice's outcome both use it. */
function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number, rng: RNG): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  const draw = rng.next() * total;
  let acc = 0;
  for (const item of items) {
    acc += weightOf(item);
    if (draw < acc) return item;
  }
  return items[items.length - 1]!;
}

/** Whether a command's number is an index into a list of `length`: given,
 *  an integer, and in `[0, length)`. */
function isIndex(i: number | undefined, length: number): i is number {
  return i !== undefined && Number.isInteger(i) && i >= 0 && i < length;
}

export interface BattleEncounter {
  readonly worldSeed: number;
  /**
   * The board generator's seed (`generateTerrain`, `src/sim/terrainGen.ts`),
   * apart from `worldSeed` so the board's draws and the units' never shift
   * each other.
   */
  readonly terrainSeed: number;
  /** A hand-authored layout's id, which `generateTerrain` loads in place of
   *  a procedural board; `null` for a procedural one. */
  readonly layoutId: string | null;
  /**
   * The board's size: a procedural board is square, its side drawn in
   * `[TERRAIN.proceduralMinSize, TERRAIN.proceduralMaxSize]` off the
   * encounter's map stream; a layout gives its own `gridW` and `gridH`.
   */
  readonly gridW: number;
  readonly gridH: number;
  /**
   * The terrain palette, cosmetic only. A layout gives its own theme; a
   * procedural board takes the current sector's, so a sector reads as one
   * place.
   */
  readonly theme: Theme;
  readonly playerTeam: readonly UnitTemplate[];
  readonly enemyTeam: readonly UnitTemplate[];
  /**
   * The battle rules the World installs at construction: the owned daemons'
   * battle hooks (`battleRulesFor`), then the packets' injected rules, as
   * plain data (their meaning is in `src/sim/battleRules.ts`). Riding the
   * encounter, they reach every place that builds a World from one: the
   * battle scene, the fuzz harness, the replays. Optional so a test's
   * hand-built encounter can leave it out (none); `beginTurn` always sets it.
   */
  readonly battleRules?: readonly BattleRule[];
  /**
   * The authored encounter's kind. Battle setup reads it for the camp pull,
   * which a boss board goes without: the boss's wave defends the pool rather
   * than detour onto a camp (`spawnCamps`). Optional so a test's hand-built
   * encounter can leave it out (no boss); `beginTurn` always sets it.
   */
  readonly kind?: EncounterKind;
}

/**
 * The save format's version. A save at any other version is rejected, with
 * no migration: the store's run slot is stamped with this number and
 * refuses a save at another before `fromJSON` sees it
 * (`src/store/runSlot.ts`), and `fromJSON` refuses one too. A change to
 * `RunSnapshot`'s structure, a new member of a union it saves such as
 * `RunPhase` included, fails `npm test` until this number moves
 * (`tests/save-fingerprint.test.ts`, then `npm run save:fingerprint`).
 */
export const RUN_SCHEMA_VERSION = 49;

/**
 * One row of the fallen ledger: a combatant that fell, where and when.
 * `sector` and `node` name the encounter's instance, since an encounter id
 * can recur across sectors; `turn` is 1-based, the turn being fought when
 * the unit fell; `power` is what the casualty rule booked
 * (`unit:died.power`), so a side's rows over a battle sum to its
 * `battle:ended.fallenPower`.
 */
export interface FallenRecord {
  readonly sector: number;
  readonly node: number;
  readonly hop: number;
  readonly encounterId: string;
  readonly turn: number;
  readonly side: 'player' | 'enemy';
  readonly archetype: string;
  readonly level: number;
  readonly power: number;
  readonly tick: number;
}

/** The sector-cleared gate's two facts that the Run can't re-derive
 *  once the next sector has replaced the cleared one: which sector was
 *  cleared (by id; its title resolves from the catalog) and the pool before
 *  the seam's heal. */
interface ClearedSector {
  readonly sectorId: string;
  readonly poolBefore: number;
}

/** The active encounter's last resolved turn, as `turn:resolved`
 *  reported it. Who fell in it is already in the fallen ledger. */
interface LastTurn {
  readonly winner: 'player' | 'enemy' | 'draw';
  readonly reason: TurnEndReason;
}

/** A copy of one battle rule, so the injected-rule stores and their saved
 *  images never share an object with the packet catalog or each other. The
 *  rules are flat data, never mutated once made. */
function cloneBattleRule(rule: BattleRule): BattleRule {
  const copy: BattleRule = { on: rule.on, effect: { ...rule.effect } };
  if (rule.chance !== undefined) copy.chance = rule.chance;
  if (rule.filter !== undefined) copy.filter = { ...rule.filter };
  return copy;
}

/** One packet-injected battle rule and the packet it came from. The sim
 *  never sees the wrapper, since the battle compile strips it to the rule,
 *  but the run keeps the source so a rule's earnings can be credited (the
 *  bits tally's label). No shipped packet injects a run-duration rule
 *  (`src/config/packets.test.ts`); `venom` injects an encounter-duration
 *  one. */
interface InjectedRule {
  rule: BattleRule;
  sourceId: string;
}

function cloneInjectedRule(entry: InjectedRule): InjectedRule {
  return { rule: cloneBattleRule(entry.rule), sourceId: entry.sourceId };
}

/** A saved `selectedEncounterId`'s encounter from the catalog: `null` for no
 *  encounter, and for an id the catalog no longer holds. */
function resolveSelectedEncounter(id: string | null): Encounter | null {
  if (id === null) return null;
  return getEncounter(id) ?? null;
}

/** The state a gate's payload is built from, which the phase guarantees; a
 *  save that breaks that throws by name at `resume()`. */
function gateState<T>(value: T | null, phase: RunPhase, field: string): T {
  if (value === null) throw new Error(`Run.resume: the '${phase}' phase with no ${field}`);
  return value;
}

/**
 * An encounter's battlefield, built once for the whole encounter: in
 * `beginEncounter`, or for a boss at the sector's entry with the boss's
 * pick. One board an encounter, so the pre-turn redraw is chosen knowing
 * the field, and an encounter reads as one fight on one field; what changes
 * a turn is the enemy wave and the world seed. `gridW` and `gridH` are kept
 * because a procedural board's side can't be recovered from `layoutId:
 * null`.
 */
interface EncounterMap {
  readonly layoutId: string | null;
  readonly gridW: number;
  readonly gridH: number;
  readonly terrainSeed: number;
  readonly theme: Theme;
}

export interface RunSnapshot {
  schemaVersion: typeof RUN_SCHEMA_VERSION;
  /** The run's randomness root. Every stream derives per occurrence as
   *  `deriveRng(streamRoot, key, ...stableIds)` (`src/core/rngStreams.ts`
   *  holds the keys), so no stream's state is saved: each occurrence
   *  finishes between saves and derives again from this root and the ids
   *  and counters below. A live run's is its seed as an unsigned integer; a
   *  rollout clone replaces it (`cloneRunForRollout`), so every occurrence
   *  after the clone differs and the rollout cannot see the real run's
   *  draws. */
  streamRoot: number;
  /** Sectors entered so far, 0 for the starting sector: the first stable id
   *  of every sector-scoped stream key. */
  sectorIndex: number;
  /** Pile shuffles so far, the `'deck'` stream's occurrence counter, since a
   *  shuffle has no node of its own: the encounter-start shuffle and a
   *  mid-encounter reshuffle of the discards both count. */
  deckShuffleIndex: number;
  /** Event occurrences resolved so far (a node's entry, or one choice), the
   *  `'event'` stream's occurrence counter, since a page can be visited
   *  again and has no id to key on. */
  eventStep: number;
  /** The docked port's stock, `null` when not docked; a save restores the
   *  stock, prices and sold flags. Its packet and daemon ids are checked
   *  against the catalogs on load, an unknown one rejected. */
  portStock: PortStock | null;
  /** The open event and page, `null` outside the `event` phase; a save
   *  restores the page. Both ids are checked on load against the catalog the
   *  load passes (`RunConfig.eventCatalog`, else the shipped one), an unknown
   *  one rejected. */
  activeEvent: { eventId: string; pageId: string } | null;
  /** The event flags, for the run's whole life: written by `setFlag` ops and
   *  by a page opening (its event's visited flag, `visitedFlagFor`), read by
   *  `flagSet` and `flagIs` conditions and the event pool's filter. A sector
   *  advance leaves them, so a chain of events can span sectors. */
  eventFlags: Record<string, EventFlagValue>;
  /** A start-encounter outcome's reward refs, which replace the fought
   *  encounter's own at its won turn; each ref's table is checked on load.
   *  `null` for none, and cleared when the encounter ends either way, so it
   *  applies only to the fight the event opened. */
  pendingRewardOverride: readonly EncounterRewardRef[] | null;
  /** The owned daemons by id, in the order gained, each resolved from the
   *  catalog on load; an unknown id rejects. A daemon built in memory for a
   *  test does not survive a save. Empty, the run holds no daemon, so no
   *  pre-turn grant comes from one. */
  daemonIds: string[];
  /** The run's character by id, resolved from the catalog on load; an
   *  unknown id rejects. Its pools and weights are read from the def, never
   *  saved. */
  characterId: string;
  /** The run's Escalation level, 0 (off) to `ESCALATION_MAX`
   *  (`config/escalation.ts`); a level off the ladder rejects on load. The
   *  difficulty multipliers are derived from it, never saved. It is saved,
   *  and not only among the run's dials, because a rollout clone loads the
   *  snapshot with no config. */
  escalation: number;
  /** The current turn's grant queue (`resolveTurnGrants`, with each entry's
   *  `used` and `passed`), saved so a save at the gate restores the same
   *  chance flips and the same cursor. */
  turnGrants: TurnGrants;
  /** The run's place on the sector map: the chosen sector, whose length,
   *  theme and pools drive the active node map, and the sector-map node it
   *  was chosen at, which the walk advances from when the sector's terminal
   *  is cleared. The `SectorMap` itself is not saved (`RunConfig.sectorMap`;
   *  a load falls back to the shipped map). */
  currentSectorId: string;
  currentSectorNodeId: string;
  nodeMap: NodeMap;
  /** The sector's boss, picked at the sector's entry so it can be shown
   *  ahead: the encounter by id, resolved on load (an unknown id rejects),
   *  and its built battlefield. Drawn on its own stream, keyed to the
   *  sector (`'boss'`); never null, since every sector's terminal is a boss. */
  bossEncounterId: string;
  bossEncounterMap: EncounterMap;
  team: UnitTemplate[];
  /** Each roster slot's deployment count, parallel to `team`. */
  deploymentCounts: number[];
  /** Each roster slot's encounter-scoped status effects, parallel to `team`:
   *  added by `addEncounterEffect` (an empower, a drained out-of-battle
   *  buff), put on the unit at each turn's deploy, and cleared at an
   *  encounter's start. */
  encounterEffects: StatusEffect[][];
  /** The encounter's card deck, as roster indices in three piles: `drawPile`
   *  is the shuffled draw stack, drawn from its end; `discardPile` collects
   *  fought hands; `hand` is this turn's cards. Rebuilt from the roster at
   *  each encounter's start. */
  drawPile: number[];
  discardPile: number[];
  hand: number[];
  /** The run's bits, an integer floored at 0, kept for the whole run. */
  bits: number;
  /** The cache: owned packet ids in the order gained, each checked against
   *  the catalog on load (an unknown id rejects). It may hold more than the
   *  derived `cacheSize`, when a daemon shrinks the cache under what it
   *  holds; the overflow is derived, never saved (`Run.cacheOverflow`). */
  cache: string[];
  /** Out-of-battle `applyBuff` fires (overclock), per roster slot like
   *  `encounterEffects`, held until the next encounter's start and moved
   *  into `encounterEffects` right after that store is cleared. */
  pendingEncounterEffects: StatusEffect[][];
  /** Packet-injected battle rules with their sources, in fire order.
   *  `encounter`-duration ones are dropped at the next encounter's start;
   *  `run`-duration ones last the run. Both join each turn's `battleRules`
   *  after the daemon rules. */
  injectedEncounterRules: InjectedRule[];
  injectedRunRules: InjectedRule[];
  /** The player's pool, kept for the whole run. */
  playerHealth: number;
  /** The active encounter's enemy pool, filled at each encounter's start. */
  enemyHealth: number;
  /** Turns resolved in the active encounter; the max-turns cap reads it. */
  turnIndex: number;
  /** The active encounter's catalog id, `null` outside an encounter;
   *  `fromJSON` resolves the encounter from it. */
  selectedEncounterId: string | null;
  /** The wave sequencer's cursor, `null` before the encounter's first wave;
   *  saved so a resumed encounter continues the same waves. */
  waveCursor: WaveCursor | null;
  /** The active encounter's battlefield, which every turn fights on; `null`
   *  outside an encounter. */
  encounterMap: EncounterMap | null;
  currentNodeId: number;
  phase: RunPhase;
  currentEncounter: BattleEncounter | null;
  /** The run's fallen ledger, in death order. */
  fallenLedger: FallenRecord[];
  currentOffer: UnitTemplate[] | null;
  visitedNodes: number[];
  /** The promotions waiting to be shown: set at the turn boundary or rest
   *  that leveled a unit, through the `reward` phase that may come first,
   *  until `dismissPromotion`. Saved so a resumed `promotion` shows the same
   *  deltas. */
  pendingPromotions: PromotionInfo[] | null;
  /** The reward offer not yet resolved, as `currentOffer` is for a recruit:
   *  built once at the turn boundary (the bits tally first at any turn that
   *  did not lose the run, then a wiped camp's loot, then a won encounter's
   *  roll), each accept or decline removing its portion. Saved so a resumed
   *  offer is the same offer. */
  pendingRewards: RewardPortion[] | null;
  /** Set only in the `sectorCleared` phase; the cleared sector's id is
   *  checked against the catalog on load. */
  clearedSector: ClearedSector | null;
  /** The active encounter's last resolved turn; `null` before its first
   *  turn resolves and outside an encounter. */
  lastTurn: LastTurn | null;
}

/** The starting level, bound to a local for its call sites. */
const { startingLevel: STARTING_LEVEL } = RECRUITMENT;

export class Run {
  /** The run's randomness root (`RunSnapshot.streamRoot`); every stream
   *  derives from it per occurrence (`streamRng`), so one occurrence's draws
   *  never move another's. */
  readonly streamRoot: number;
  /** Sectors entered, 0 for the start (`RunSnapshot.sectorIndex`). */
  private sectorIndex: number;
  /** The `'deck'` stream's occurrence counter (`RunSnapshot`). */
  private deckShuffleIndex: number;
  /** The `'event'` stream's occurrence counter (`RunSnapshot`). */
  private eventStep: number;
  /** The docked port's stock (`PortStock`), `null` when not docked: rolled
   *  in `handleEnterNode`, dropped at `leavePort`. */
  portStock: PortStock | null = null;
  /** The open event and page, `null` outside the `event` phase: set in
   *  `enterEventNode`, moved by an outcome's page `next`, cleared by every
   *  outcome that leaves the event and by a defeat inside it. */
  activeEvent: { eventId: string; pageId: string } | null = null;
  /** The event flags (`RunSnapshot.eventFlags`), read through `eventFlag()`;
   *  written by the `setFlag` op and by a page opening (its visited flag). */
  private eventFlags: Record<string, EventFlagValue> = {};
  /** A start-encounter outcome's reward refs (`RunSnapshot`): read at the
   *  won turn's boundary, cleared in `finishEncounter`. */
  private pendingRewardOverride: readonly EncounterRewardRef[] | null = null;
  /** The event catalog this run draws from: `RunConfig.eventCatalog`, else
   *  the shipped `EVENTS`. A load takes it from the config it is passed, as
   *  it does every dial below that the snapshot does not hold (`RunConfig`'s
   *  header says which a save keeps). */
  private readonly eventCatalog: readonly EventDef[];
  /** The forced event (`RunConfig.forcedEventId`), checked at construction. */
  private readonly forcedEventId: string | null;
  /** Whether the root's `event` kind was stamped by the dial
   *  (`firstNodeKind: 'event'`) rather than by the sector's starting events.
   *  A dial-stamped root draws from the regular event pool, so the dial
   *  still isolates the pool's draw when a sector authors starting events
   *  (`enterEventNode`). */
  private readonly rootStampedByDial: boolean;
  /** The owned daemons in the order gained: the starting one first (the
   *  character's, or `RunConfig.daemon`'s, or none), then any a reward, a
   *  port or an event adds (`addDaemon`), with no cap. The pre-turn grants
   *  come from these and from a packet's `grantRedraws`. Saved by id. */
  readonly daemons: DaemonConfig[];
  /** The run's character, fixed for the run's life: it gives the starting
   *  roster and daemon, and the draft pools (its blacklist and weights) at
   *  every recruit offer and port stock, both read from the def as each is
   *  rolled, never saved. Saved by id. */
  readonly character: CharacterConfig;
  /** The run's Escalation level, 0 (off) to `ESCALATION_MAX`
   *  (`config/escalation.ts`), fixed for the run's life;
   *  `difficultyMultipliers` carries what it does. */
  readonly escalation: number;
  /** The current turn's grant queue, resolved from the daemons' grant hooks
   *  at each turn's start (`startNextTurn`, where a chance hook flips its
   *  coin), in walk order; a packet's grant goes in at the cursor
   *  (`handleUsePacket`). Each entry carries its own `used` and `passed` and
   *  changes in place as commands land, so a save copies them. The cursor
   *  (the active grant) is derived (`activeGrantIndex`), never stored. */
  private turnGrants: TurnGrants;
  /** The finality toggle: `RunConfig.passIsFinal`, else
   *  `config/deck.json`'s `grantQueue`. On, grants fire strictly in order
   *  (only the active one, and `passGrant` finalizes it); off, any pending
   *  grant fires and `passGrant` does nothing. */
  private readonly passIsFinal: boolean;
  /** The forced-draw dial (`RunConfig.drawAmountAdd`), folded into
   *  `effectiveRunStats` as one more `drawAmount` add; 0 adds no modifier,
   *  so the fold's no-modifier path holds. */
  private readonly drawAmountAdd: number;
  /** The sector map the run walks: `RunConfig.sectorMap`, for tests, else
   *  the shipped `SECTOR_MAP`. */
  private sectorMap: SectorMap;
  /** The active sector, and the sector-map node it was chosen at; both
   *  change only when a sector's terminal is cleared (`advanceSector`). */
  currentSectorId: string;
  currentSectorNodeId: string;
  /** The active sector's node map, generated again at each sector. */
  nodeMap: NodeMap;
  team: UnitTemplate[];
  /**
   * Each roster slot's deployment count in the current encounter, parallel
   * to `team`: cleared at an encounter's start (`resetDeploymentCounts`),
   * raised for each turn a unit is dealt (`recordDeployment`). The fatigue
   * debuff reads it at deploy (`fatigueEffect`). A recruit adds a `0`.
   */
  deploymentCounts: number[];
  /**
   * Each roster slot's encounter-scoped status effects (`RunSnapshot`),
   * parallel to `team`: added by `addEncounterEffect`, put on the fielded
   * unit at each turn's deploy as `endOfTurn` effects, cleared at an
   * encounter's start. A recruit adds an empty list.
   */
  encounterEffects: StatusEffect[][];
  /**
   * The card deck, as roster indices (`RunSnapshot`). Each turn draws up to
   * `effectiveDrawAmount` cards into `hand`, since only the hand fights,
   * reshuffling `discardPile` into `drawPile` when the draw pile is empty;
   * the fought hand goes to `discardPile` at the next turn's start. Rebuilt
   * and shuffled from the roster at each encounter's start, so no deck state
   * crosses encounters. Public so the turn loop and tests can read the piles.
   */
  drawPile: number[];
  discardPile: number[];
  hand: number[];
  /**
   * The run's bits, an integer floored at 0, changed only through `addBits`,
   * which clamps and emits `run:bitsChanged`. Earnings go through `gainBits`,
   * which applies the folded `bitsGain` stat and the bits multiplier; spending
   * through `spendBits`. Starts at `RunConfig.startingBits`, else
   * `config/difficulty.json`'s.
   */
  bits: number;
  /**
   * The cache: owned packet ids in the order gained, resolved from the
   * catalog as read. Its capacity is not stored but folded from the
   * `cacheSize` stat when read (`effectiveCacheSize`), so a daemon that
   * changes it applies at once. The list may hold more than that capacity
   * when a daemon shrinks it under what it holds; the overflow
   * (`cacheOverflow`) stands until the forced discards resolve it. Changed by
   * `addPacket`, `handleDiscardPacket` (a sale and an event's removal go
   * through it) and `handleUsePacket`, each emitting `run:cacheChanged`, and
   * at construction by a granted packet.
   */
  cache: string[];
  /**
   * Out-of-battle `applyBuff` fires (overclock), per roster slot like
   * `encounterEffects`. Such a buff can't go into `encounterEffects`
   * directly, since the next encounter's start clears that store, so it
   * waits here and `beginEncounter` moves it in right after the clear. A
   * pre-turn `applyBuff` goes straight onto the live encounter. A recruit
   * adds an empty list.
   */
  pendingEncounterEffects: StatusEffect[][];
  /**
   * Packet-injected battle rules, in fire order: where the `injectRule` op
   * lands. `encounter`-duration rules last through the encounter's end and
   * are dropped at the next encounter's start; `run`-duration rules last the
   * run. Each turn's `battleRules` takes the daemons' rules, then the
   * run-duration ones, then the encounter-duration ones, each in its own
   * order, so the evaluation order is fixed.
   */
  injectedEncounterRules: InjectedRule[];
  injectedRunRules: InjectedRule[];
  /**
   * The player's pool, kept for the whole run and never refilled between
   * encounters except by a heal (a rest, the sector seam's floor, a heal op).
   * At 0 or below the run is lost. Starts at, and is capped by,
   * `HEALTH.playerHealthMax`. Each turn charges it by the chip rule
   * (`chipRule.ts`).
   */
  playerHealth: number;
  /**
   * The active encounter's enemy pool: filled at each encounter's start
   * (`enemyPoolOf`, the encounter's `healthPool` under the enemy-morale
   * multiplier) and charged each turn by the chip rule; at 0 or below the
   * encounter is won.
   */
  enemyHealth: number;
  /** Turns resolved in the active encounter: raised once a resolved turn,
   *  read by the `HEALTH.maxTurns` cap, cleared at an encounter's start. */
  turnIndex: number;
  /**
   * The active encounter, held for the whole fight: `rollTurnWave` walks its
   * `waves` each turn, and its pool comes from its `healthPool`
   * (`enemyPoolOf`). `null` outside an encounter (cleared in
   * `finishEncounter`). Saved as `selectedEncounterId`, which `fromJSON`
   * resolves from the catalog.
   */
  selectedEncounter: Encounter | null = null;
  /** The wave sequencer's cursor, `null` before the encounter's first wave;
   *  each turn's walk returns the next. */
  waveCursor: WaveCursor | null = null;
  /**
   * The active encounter's battlefield, built once (`EncounterMap`); every
   * turn fights on it. `null` outside an encounter: cleared in
   * `finishEncounter`, and never set at a rest, so `handleDismissPromotion`
   * reads it to tell a turn's promotion from a rest's.
   */
  encounterMap: EncounterMap | null;
  /**
   * The sector's boss and its built battlefield (`RunSnapshot`), picked at
   * the sector's entry (`rollBossForSector`) and taken by the boss node's
   * `beginEncounter` in place of a draw, so the fight is the forewarned one.
   * Never null: every sector's terminal is a boss, and the selection
   * coverage guard holds a boss pool at every hop.
   */
  bossEncounterId: string;
  bossEncounterMap: EncounterMap;
  currentNodeId: number;
  phase: RunPhase = 'map';
  /**
   * Whether the encounter loop pauses at the turn gates: `turn-intro` before
   * each turn (emitting `turn:starting`) and `turn-outcome` after it
   * (emitting `turn:resolved`), each left by an `advanceTurn` command. `Game`,
   * the fuzz harness and the journal replay turn it on; off, the default,
   * the loop runs straight through. Not saved: whoever loads a run sets it.
   */
  pauseAtTurnGates = false;
  currentEncounter: BattleEncounter | null = null;
  /** The run's fallen ledger (`FallenRecord`), appended to and never cut;
   *  read through `fallenForTurn` or the snapshot. */
  fallenLedger: FallenRecord[] = [];
  /** The recruit offer after a won encounter, cleared on a choice or a pass. */
  currentOffer: UnitTemplate[] | null = null;
  /**
   * The promotions waiting to be shown (`RunSnapshot`): set in
   * `handleTurnEnded` when `bankXpAwards` reports level-ups, or by a rest;
   * cleared by `handleDismissPromotion`, which re-enters the encounter loop
   * or, after a rest, returns to the map.
   */
  pendingPromotions: PromotionInfo[] | null = null;
  /**
   * The reward offer not yet resolved (`RunSnapshot`): built once in
   * `handleTurnEnded` at a turn that did not lose the run.
   * `continueFromTurnGate` holds the `reward` phase while it is set; each
   * accept or decline removes its portion, and resolving the last re-enters
   * the gate chain.
   */
  pendingRewards: RewardPortion[] | null = null;
  /** Set in `advanceSector`, cleared at `dismissSectorCleared`; the
   *  `sector:cleared` payload is built from it (`ClearedSector`). */
  private clearedSector: ClearedSector | null = null;
  /** Set at every turn boundary, cleared at an encounter's start and end;
   *  `turn:starting` carries it with the turn's fallen rows (`LastTurn`). */
  private lastTurn: LastTurn | null = null;
  /**
   * The nodes the player has left behind, which `MapScene` draws as the
   * trail. A node is added when the next is entered, the root among them;
   * the pre-root start never is.
   */
  readonly visitedNodes: Set<number>;

  /**
   * The forced layout (`RunConfig.forcedLayoutId`): every battle's board is
   * this layout, or with `FORCE_PROCEDURAL` a fresh procedural board, in
   * place of the sector pool's roll; `null` for the roll.
   */
  private readonly forcedLayoutId: string | null;

  /**
   * The forced encounter (`RunConfig.forcedEncounterId`), taken at every
   * node whose kind matches its own (`selectEncounter`); `null` for the
   * sector pool's draw.
   */
  private readonly forcedEncounterId: string | null;

  /**
   * The run's difficulty multipliers, resolved at construction and again on
   * a load: `RunConfig`'s overrides, else `config/difficulty.json`'s
   * defaults (1, no scaling), times the Escalation level's factors
   * (`withEscalation`; level 0 changes nothing). The wave pair applies to
   * every authored wave through `WaveContext` (`rollTurnWave`), `bits` in
   * `effectiveBits`, `enemyMorale` in `enemyPoolOf`. Not saved: a load takes
   * the overrides from the config it is passed and the level from the
   * snapshot.
   */
  private readonly difficultyMultipliers: DifficultyMultipliers;

  /**
   * The two run-shape dials; construction throws when both are set.
   * - `singleSectorRun` (`RunConfig.hopCount`) — the first sector's terminal
   *   is the run's, and the sector walk never advances: the bounded probe.
   * - `sectorHopsOverride` (`RunConfig.sectorHops`) — every sector's node
   *   map is exactly this many hops, while the sector walk still runs to a
   *   sink: a short full run.
   */
  private readonly singleSectorRun: boolean;
  private readonly sectorHopsOverride: number | undefined;
  /** The scatter dials, passed again at every sector advance
   *  (`sectorAdvanceConfig`, gotcha #121); `undefined` when none is set. */
  private readonly sectorScatterConfig: RunConfig | undefined;

  private readonly bus: EventBus<GameEvents>;
  private subscriptions: Array<() => void> = [];

  constructor(seed: number, bus: EventBus<GameEvents>, config?: RunConfig) {
    this.bus = bus;
    // Every stream derives per occurrence off this root (`streamRng`), so
    // there is no draw order across streams to keep.
    this.streamRoot = seed >>> 0;
    this.sectorIndex = 0;
    this.deckShuffleIndex = 0;
    this.eventStep = 0;
    // The character first. Unset, the default (the Soldier), so a bare
    // headless construction works; the catalog's boot check makes the
    // default resolve, and a miss still throws.
    const character = config?.character ?? characterById(DEFAULT_CHARACTER_ID);
    if (character === undefined) {
      throw new Error(`Run: default character '${DEFAULT_CHARACTER_ID}' missing from the catalog`);
    }
    this.character = character;
    // Every config input the run reads after construction resolves in one
    // place, which `fromJSON` shares (`resolveRunInputs`). None draws; the
    // boss pick below reads the forced ids.
    const inputs = resolveRunInputs(config);
    this.sectorMap = inputs.sectorMap;
    this.forcedLayoutId = inputs.forcedLayoutId;
    this.forcedEncounterId = inputs.forcedEncounterId;
    this.eventCatalog = inputs.eventCatalog;
    this.forcedEventId = inputs.forcedEventId;
    this.singleSectorRun = inputs.singleSectorRun;
    this.sectorHopsOverride = inputs.sectorHopsOverride;
    this.sectorScatterConfig = inputs.sectorScatterConfig;
    this.rootStampedByDial = inputs.rootStampedByDial;
    this.passIsFinal = inputs.passIsFinal;
    this.drawAmountAdd = inputs.drawAmountAdd;
    // The Escalation level: unset is 0, off. A level off the ladder is a
    // caller's mistake and throws; the URL parser drops one before it gets
    // here. Pure of RNG, and at level 0 the multipliers are the resolved ones
    // themselves, so a run with Escalation off is the run it was before.
    const escalation = config?.escalation ?? 0;
    if (!isEscalationLevel(escalation)) {
      throw new Error(`Run: escalation=${String(escalation)} is not a level (0 to ${ESCALATION_MAX})`);
    }
    this.escalation = escalation;
    this.difficultyMultipliers = withEscalation(inputs.difficultyMultipliers, escalation);
    // The sector pick, the node map and the boss pick each draw on their
    // own sector-keyed stream, so a change to one's draws moves no other.
    const start = pickStartSector(this.sectorMap, this.streamRng('sector', 0));
    this.currentSectorNodeId = start.sectorNodeId;
    this.currentSectorId = start.sectorId;
    this.nodeMap = generateNodeMap(this.streamRng('nodemap', 0), config, this.currentSectorLength());
    // The sector's starting events stamp the root `event`, with no draw;
    // the `firstNodeKind` dial wins when set, and its root draws from the
    // regular pool (`rootStampedByDial`).
    if (config?.firstNodeKind === undefined) this.stampStartingEventRoot();
    // The sector's boss, picked now so it can be shown ahead.
    const bossRoll = this.rollBossForSector(this.streamRng('boss', 0));
    this.bossEncounterId = bossRoll.bossEncounterId;
    this.bossEncounterMap = bossRoll.bossEncounterMap;
    const teamRng = this.streamRng('team');
    // The starting roster is the character's list; `startingRoster` wins.
    this.team = config?.startingRoster
      ? config.startingRoster.map((e) => rollUnit(e.archetype, teamRng, e.level))
      : this.character.roster.map((a) => rollUnit(a, teamRng, STARTING_LEVEL));
    // One deployment count and one encounter-effect list per roster unit.
    this.deploymentCounts = new Array(this.team.length).fill(0);
    this.encounterEffects = this.team.map(() => []);
    // The deck is empty until an encounter builds and shuffles it
    // (`beginEncounter`); between encounters the piles mean nothing.
    this.drawPile = [];
    this.discardPile = [];
    this.hand = [];
    // Clamped, so an override can't start a run below the floor of 0.
    this.bits = Math.max(0, config?.startingBits ?? DIFFICULTY.startingBits);
    // Packets arrive by rewards, ports, events and grants; the cache starts
    // empty.
    this.cache = [];
    this.pendingEncounterEffects = this.team.map(() => []);
    this.injectedEncounterRules = [];
    this.injectedRunRules = [];
    // The player's pool starts full; the encounter's state is set when one
    // begins (`beginEncounter`).
    this.playerHealth = HEALTH.playerHealthMax;
    this.enemyHealth = 0;
    this.turnIndex = 0;
    this.encounterMap = null;
    // The character's daemon, unless `config.daemon` is set (`null` for
    // none), which keeps the fuzz's control and fixed arms what they say.
    // The character's daemon id was checked at parse; a miss still throws.
    this.daemons =
      config?.daemon !== undefined
        ? config.daemon === null
          ? []
          : [config.daemon]
        : [this.resolveCharacterDaemon()];
    this.turnGrants = disabledTurnGrants();
    // The grants go last, once every store they add to exists. A daemon or
    // packet grant draws nothing; a unit grant draws its level off the
    // `'team'` stream after the roster, so no grant moves another stream.
    for (const id of config?.grants ?? []) this.applyGrant(id, teamRng);
    // The run begins at the pre-root position, with no node entered; the
    // root is the only frontier node, chosen like any other.
    this.currentNodeId = PRE_ROOT_NODE_ID;
    this.visitedNodes = new Set<number>();
    this.subscribe();
    bus.emit('run:started', { seed });
  }

  /**
   * One occurrence's stream: `deriveRng(streamRoot, key, ...ids)`. The ids
   * are the occurrence's stable identifiers, as the key's entry in
   * `src/core/rngStreams.ts` gives them, never a draw position. Each call
   * returns a fresh stream; an occurrence resolves in one synchronous step,
   * so no stream state is saved, and a resumed run derives each stream
   * again from the root and the ids.
   */
  private streamRng(key: RngStreamKey, ...ids: readonly number[]): RNG {
    return deriveRng(this.streamRoot, key, ...ids);
  }

  /**
   * Apply one construction grant (`RunConfig.grants`): find the id in the
   * catalogs, daemon, then packet, then unit archetype, and add it to the
   * store a real acquisition uses. Daemons and packets are pushed directly
   * rather than through `addDaemon` and `addPacket`, whose events mean
   * nothing while the run is being built; a unit goes through
   * `appendRosterUnit`, which keeps the parallel lists in step. A full cache
   * and an unknown id both throw, since a silently missing arm would spoil
   * a paired batch.
   */
  private applyGrant(id: string, unitLevelRng: RNG): void {
    const daemon = daemonById(id);
    if (daemon !== undefined) {
      this.daemons.push(daemon);
      return;
    }
    if (packetById(id) !== undefined) {
      if (!this.cacheHasRoom) {
        throw new Error(`Run: grant '${id}' overflows the cache (size ${this.effectiveCacheSize})`);
      }
      this.cache.push(id);
      return;
    }
    if ((ALL_ARCHETYPES as readonly string[]).includes(id)) {
      this.appendRosterUnit(rollUnit(id as Archetype, unitLevelRng, STARTING_LEVEL));
      return;
    }
    throw new Error(`Run: grant id '${id}' is not a daemon, packet, or unit archetype`);
  }

  /** The character's starting daemon from the catalog. The parse checked
   *  the id, so a miss means the catalogs changed after load, and throws. */
  private resolveCharacterDaemon(): DaemonConfig {
    const daemon = daemonById(this.character.daemon);
    if (daemon === undefined) {
      throw new Error(
        `Run: character '${this.character.id}' names unknown daemon '${this.character.daemon}'`,
      );
    }
    return daemon;
  }

  /** The character's draft pools, derived at each roll (an empty blacklist
   *  returns the shared table). The recruit offer and the port stock both
   *  draw through it, so a port follows the character's pools as a recruit
   *  does. */
  private draftPools(): Readonly<Record<UnitRarity, readonly Archetype[]>> {
    return draftPoolsFor(this.character.blacklist);
  }

  /** The rarity weights as the run-stat fold gives them (Patrician's Seal's
   *  ×0 on common lands here), derived at each roll. A fold with no
   *  modifier returns its base block itself, so the path with none hands
   *  back the config's own record. Both the recruit offer and the port stock
   *  read it, where the offer's size is the recruit offer's alone. */
  private effectiveRarityWeights(): Readonly<Record<UnitRarity, number>> {
    const stats = this.effectiveRunStats();
    if (stats === RUN_STAT_BASES) return RECRUITMENT.rarityWeights;
    return {
      common: stats.rarityWeightCommon,
      uncommon: stats.rarityWeightUncommon,
      rare: stats.rarityWeightRare,
      legendary: stats.rarityWeightLegendary,
    };
  }

  private subscribe(): void {
    this.subscriptions.push(
      // A `battle:ended` ends a turn, not the node. `winner` does not route
      // the outcome, the pools do (charged by the chip rule off
      // `survivorPower`, `fallenPower` and `reason`), but `turn:resolved`
      // carries it, so it is passed through.
      this.bus.on(
        'battle:ended',
        ({ winner, reason, xpAwards, survivorPower, fallenPower, tallies, campKills }) =>
          this.handleTurnEnded(winner, xpAwards, survivorPower, tallies, campKills, reason, fallenPower),
      ),
      // The fallen ledger takes every combatant's death in a battle; the
      // event carries who it was, since the unit is already gone.
      this.bus.on('unit:died', (death) => this.recordFallen(death)),
    );
  }

  /**
   * Append one ledger row for a combatant that fell in the live battle. The
   * exclusions follow what the casualty rule books (`World.recordFallen`):
   * a neutral charges nobody, and a summon is booked at 0, a body its side
   * did not pay for. Outside a battle nothing is recorded.
   */
  private recordFallen(death: GameEvents['unit:died']): void {
    if (this.phase !== 'battle' || this.selectedEncounter === null) return;
    if (death.team !== 'player' && death.team !== 'enemy') return;
    if (death.summoned) return;
    this.fallenLedger.push({
      sector: this.sectorIndex,
      node: this.currentNodeId,
      hop: this.currentHop,
      encounterId: this.selectedEncounter.id,
      turn: this.turnIndex + 1,
      side: death.team,
      archetype: death.archetype,
      level: death.level,
      power: death.power,
      tick: death.tick,
    });
  }

  /**
   * The ledger rows of the encounter being fought (this sector and node),
   * and those of `turn` (1-based): copies, in death order. Called at the
   * turn boundary after `turnIndex` has advanced, so the completed turn's
   * number is `turnIndex`.
   */
  fallenForTurn(turn: number): GameEvents['turn:resolved']['fallen'] {
    const encounter = this.fallenLedger
      .filter((r) => r.sector === this.sectorIndex && r.node === this.currentNodeId)
      .map((r) => ({ ...r }));
    return { thisTurn: encounter.filter((r) => r.turn === turn), encounter };
  }

  /**
   * Detach every bus subscription. Required when replacing a Run on reset —
   * otherwise the dead Run keeps responding to `battle:ended` events and
   * the new one races against it.
   */
  dispose(): void {
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
  }

  /**
   * Apply a command synchronously. Run isn't tick-driven (its lifecycle is
   * event-driven), so commands are applied immediately rather than queued
   * for a drain point. `resetRun` isn't handled here — Game intercepts it
   * because resetting requires disposing this Run and constructing a new
   * one, which the Run itself can't do for itself.
   */
  dispatch(command: RunCommand): void {
    switch (command.kind) {
      case 'enterNode':
        this.handleEnterNode(command.nodeId);
        break;
      case 'chooseRecruit':
        this.handleChooseRecruit(command.unitTemplate);
        break;
      case 'passRecruit':
        this.handlePassRecruit();
        break;
      case 'leavePort':
        this.handleLeavePort();
        break;
      case 'chooseEventOption':
        this.handleChooseEventOption(command.choiceIndex);
        break;
      case 'buyPortUnit':
        this.handleBuyPortUnit(command.index);
        break;
      case 'buyPortPacket':
        this.handleBuyPortPacket(command.index, command.swapCacheIndex);
        break;
      case 'buyPortDaemon':
        this.handleBuyPortDaemon(command.index);
        break;
      case 'sellPacket':
        this.handleSellPacket(command.cacheIndex);
        break;
      case 'payToRemoveUnit':
        this.handlePayToRemoveUnit(command.rosterIndex);
        break;
      case 'dismissPromotion':
        this.handleDismissPromotion();
        break;
      case 'dismissSectorCleared':
        this.handleDismissSectorCleared();
        break;
      case 'acceptReward':
        this.handleAcceptReward(command.index, command.swapCacheIndex);
        break;
      case 'declineReward':
        this.handleDeclineReward(command.index);
        break;
      case 'advanceTurn':
        this.handleAdvanceTurn();
        break;
      case 'redrawCards':
        this.handleRedrawCards(command.handIndices, command.grantIndex);
        break;
      case 'empowerUnit':
        this.handleEmpowerUnit(command.handIndex, command.grantIndex);
        break;
      case 'passGrant':
        this.handlePassGrant();
        break;
      case 'discardPacket':
        this.handleDiscardPacket(command.cacheIndex);
        break;
      case 'usePacket':
        this.handleUsePacket(command.cacheIndex, command.handIndex, command.rosterIndex);
        break;
      case 'chooseRestOption':
        this.handleChooseRestOption(command.optionIndex);
        break;
      case 'resetRun':
      case 'chooseCharacter':
        // No-ops at this layer — Game handles both (reset disposes this Run;
        // chooseCharacter CONSTRUCTS one, so a live Run can only see it
        // misrouted). Fall through silently rather than throwing so a
        // misrouted command doesn't crash a battle.
        break;
    }
  }

  /**
   * Move onto a frontier node from `map`. The node left is marked visited;
   * then by the new node's kind: a rest opens its gate (`rest`, until
   * `chooseRestOption`), a port rolls its stock and docks (`port`, until
   * `leavePort`), an event node rolls for a fight or a page
   * (`enterEventNode`), and a battle, elite or boss node starts its encounter
   * (`beginEncounter`).
   */
  private handleEnterNode(nodeId: number): void {
    if (this.phase !== 'map') return;
    if (!this.isFrontier(nodeId)) return;

    // The pre-root start is no node, so it is never marked (`visitedNodes`).
    if (this.currentNodeId !== PRE_ROOT_NODE_ID) {
      this.visitedNodes.add(this.currentNodeId);
    }
    this.currentNodeId = nodeId;

    if (this.kindOf(nodeId) === 'rest') {
      // No counter moves here or in the option's handler, so a rest leaves
      // every other draw of the run where it was. A level-up it gives draws
      // on the `'levelup'` stream keyed to its node (`bankXpAwards`).
      this.phase = 'rest';
      this.bus.emit('rest:entered', { nodeId });
      return;
    }
    if (this.kindOf(nodeId) === 'port') {
      this.phase = 'port';
      // The stock is rolled once, on entry, and saved with the run.
      this.portStock = this.rollPortStock(nodeId);
      this.bus.emit('port:entered', { nodeId });
      return;
    }
    if (this.kindOf(nodeId) === 'event') {
      this.enterEventNode(nodeId);
      return;
    }

    this.phase = 'battle';
    this.beginEncounter();
  }

  /**
   * Leave the port for the map. Entering moved `currentNodeId` onto the
   * port, so the frontier is already the port's successors. Emits nothing:
   * `Game` mounts the map when the phase lands on `map`.
   */
  private handleLeavePort(): void {
    if (this.phase !== 'port') return;
    // The stock goes with the visit: the map's edges run one hop forward,
    // so a port is never entered twice.
    this.portStock = null;
    this.phase = 'map';
  }

  // ── the event phase ───────────────────────────────────────────────────────

  /**
   * Enter an event node. The fight roll comes first, before any event is
   * picked, so event definitions hold no chance, and daemons bend it through
   * the fold (`effectiveEventCombatChance`). The roll is drawn on every
   * entry, whatever the chance, and the pick draws after it on the same
   * stream. A fight, or no eligible event (flag-gated chains can empty the
   * pool), makes the node a normal fight, an event node's encounter kind
   * (`encounters/selection.ts`).
   *
   * On a sector's root with `startingEvents`, the event comes from that list
   * and the fight roll is drawn and ignored, so an authored opening is never
   * lost to it. With no eligible starting event the node still becomes a
   * fight.
   */
  private enterEventNode(nodeId: number): void {
    const sector = this.currentSector();
    // With the `firstNodeKind` dial at `event`, a root draws from the
    // sector's regular pool, so the dial can test that pool at hop 0. The
    // flag is the run's, so a later sector's root is exempted too.
    const fromStartingPool =
      nodeId === this.nodeMap.rootId &&
      sector.startingEvents.length > 0 &&
      !this.rootStampedByDial;
    // One stream for the entry, keyed by the saved `eventStep`, which moves
    // whether or not a page opens.
    const entryRng = this.streamRng('event', this.eventStep++);
    const roll = entryRng.next();
    const combatResolved = roll < this.effectiveEventCombatChance() && !fromStartingPool;
    const eventDef = combatResolved ? null : this.rollEventForNode(fromStartingPool, entryRng);
    if (eventDef === null) {
      this.phase = 'battle';
      this.beginEncounter();
      return;
    }
    this.activeEvent = { eventId: eventDef.id, pageId: eventDef.entry };
    // The visit is marked when the page opens; an entry that became a fight
    // was never seen. A `repeatable` event is marked too, since the flag is
    // history other events may read; only the pool's filter reads
    // `repeatable`.
    this.eventFlags[visitedFlagFor(eventDef.id)] = true;
    this.phase = 'event';
    this.bus.emit('event:entered', { nodeId, eventId: eventDef.id });
  }

  /**
   * Pick the node's event from the sector's weighted pool: `events`, or
   * `startingEvents` on its root (`enterEventNode`). The `forcedEventId`
   * dial returns its event first; its id is checked when the run's inputs
   * resolve. Pool entries open at their hop (`minHop`), resolve against the
   * run's catalog (an entry a bespoke `eventCatalog` lacks is skipped; the
   * sector loader checks the shipped one), drop an event already visited
   * unless it is `repeatable`, and keep those whose `eligibility` holds.
   * One draw over the survivors, weight 1 when absent and a single survivor
   * included (`pickWeighted` above); none when forced or when none
   * survives, which returns `null` and the caller makes the node a fight.
   */
  private rollEventForNode(fromStartingPool: boolean, entryRng: RNG): EventDef | null {
    if (this.forcedEventId !== null) {
      const forced = this.eventCatalog.find((e) => e.id === this.forcedEventId);
      if (forced === undefined) {
        throw new Error(`Run: forcedEventId '${this.forcedEventId}' left the catalog mid-run`);
      }
      return forced;
    }
    const sector = this.currentSector();
    const pool = fromStartingPool
      ? sector.startingEvents.filter((e) => (e.minHop ?? 0) <= this.currentHop)
      : eventPoolAtHop(sector, this.currentHop);
    const eligible: Array<{ def: EventDef; weight: number }> = [];
    for (const entry of pool) {
      const def = this.eventCatalog.find((e) => e.id === entry.eventId);
      if (def === undefined) continue;
      // Once a run: an event whose `visited:` flag is set drops out unless
      // it is `repeatable`, with `flagSet`'s reading of a flag. A forced
      // event, returned above, is never filtered.
      if (def.repeatable !== true) {
        const seen = this.eventFlags[visitedFlagFor(def.id)];
        if (seen !== undefined && seen !== false) continue;
      }
      if (!(def.eligibility ?? []).every((c) => this.evaluateEventCondition(c))) continue;
      eligible.push({ def, weight: entry.weight ?? 1 });
    }
    if (eligible.length === 0) return null;
    return pickWeighted(eligible, (e) => e.weight, entryRng).def;
  }

  /**
   * Take one choice on the active page, if it may be taken (a choice that
   * may not is a no-op, `Command.ts`): draw its weighted outcome, one draw
   * with a single outcome included (`pickWeighted` above), carry out the
   * outcome's effects in authored order, then route its `next`. An effect
   * can end the run (`damagePool`), and routing stops there.
   */
  private handleChooseEventOption(choiceIndex: number): void {
    if (this.phase !== 'event' || this.activeEvent === null) return;
    const page = this.currentEventPage();
    if (page === null) return;
    if (!isIndex(choiceIndex, page.choices.length)) return;
    const choice = page.choices[choiceIndex]!;
    if (choice.condition !== undefined && !this.evaluateEventCondition(choice.condition)) return;
    // One choice is one occurrence: the outcome and every effect draw on one
    // stream, keyed by the saved `eventStep`, so a save lands between
    // choices and never inside one.
    const choiceRng = this.streamRng('event', this.eventStep++);
    // Weight 1 when absent; the schema makes weights positive, so the sum
    // is above 0.
    const outcome = pickWeighted(choice.outcomes, (o) => o.weight ?? 1, choiceRng);
    for (const op of outcome.effects ?? []) {
      this.executeEventOp(op, choiceRng);
      if (this.phase !== 'event') return; // damagePool killed the run
    }
    this.resolveEventNext(outcome.next);
  }

  /**
   * Carry out one event effect op. An authored effect is always carried out,
   * cut down rather than dropped where it cannot be in full: a spend floors
   * at the balance, a packet past a full cache overflows it, and removing
   * what is not there does nothing (authors gate with conditions). It throws
   * only on an id outside the catalogs, which only a bespoke `eventCatalog`
   * can hold, since the loader checks the shipped one (`assertEventRefs`).
   */
  private executeEventOp(op: EventEffectOp, choiceRng: RNG): void {
    switch (op.op) {
      case 'gainBits':
        // An earn, as a reward is, so the `bitsGain` and difficulty folds
        // apply (`gainBits`).
        this.gainBits(op.amount);
        break;
      case 'spendBits':
        // Floors at the balance: authors gate a real cost with
        // `bitsAtLeast`, and an ungated spend takes what there is.
        this.spendBits(Math.min(op.amount, this.bits));
        break;
      case 'healPool':
        this.setPlayerHealth(Math.min(HEALTH.playerHealthMax, this.playerHealth + op.amount), 'heal');
        break;
      case 'damagePool':
        this.setPlayerHealth(this.playerHealth - op.amount, 'damage');
        if (this.playerHealth === 0) {
          // An event can end the run: the defeat as `finishEncounter` makes
          // it, with no encounter state to clear.
          this.activeEvent = null;
          this.phase = 'defeat';
          this.bus.emit('run:defeated', {});
        }
        break;
      case 'setFlag':
        this.eventFlags[op.flag] = op.value ?? true;
        break;
      case 'addPacket':
        // The grant is kept: a full cache goes over its size, and the
        // overflow (`cacheOverflow`) asks for discards. `addPacket` throws on
        // an unknown id.
        this.addPacket(op.packetId);
        break;
      case 'removePacket': {
        // The first slot holding the id, through `handleDiscardPacket`; an
        // absent id does nothing (authors gate with `hasPacket`).
        const cacheIndex = this.cache.indexOf(op.packetId);
        if (cacheIndex !== -1) this.handleDiscardPacket(cacheIndex);
        break;
      }
      case 'addDaemon': {
        // Skipped when owned: rewards and port stock leave owned daemons out,
        // so a second copy would be the game's only one and would apply its
        // folds twice. Authors gate with `not hasDaemon`.
        if (this.daemons.some((d) => d.id === op.daemonId)) break;
        const daemon = daemonById(op.daemonId);
        if (daemon === undefined) {
          throw new Error(`Run: event op addDaemon names unknown daemon id '${op.daemonId}'`);
        }
        this.addDaemon(daemon);
        break;
      }
      case 'removeDaemon':
        this.removeDaemon(op.daemonId);
        break;
      case 'grantUnit': {
        if (!(ALL_ARCHETYPES as readonly string[]).includes(op.archetype)) {
          // Thrown here, by name, rather than inside `rollUnit` on a missing
          // config.
          throw new Error(`Run: event op grantUnit names unknown archetype '${op.archetype}'`);
        }
        // The level-ups draw on the choice's stream; level 1 draws nothing.
        this.appendRosterUnit(rollUnit(op.archetype as Archetype, choiceRng, op.level ?? 1));
        break;
      }
      case 'removeUnit': {
        // The roster cannot be emptied, so on a roster of 1 this does
        // nothing (authors gate with `rosterSizeAtLeast`). `random` draws one
        // index on the choice's stream; `weakest` and `strongest` go by
        // level, a tie to the lowest roster index, and draw nothing.
        if (this.team.length <= 1) break;
        const pick = op.pick ?? 'random';
        let index: number;
        if (pick === 'random') {
          index = choiceRng.int(0, this.team.length - 1);
        } else {
          index = 0;
          for (let i = 1; i < this.team.length; i++) {
            const contender = this.team[i]!.level;
            const incumbent = this.team[index]!.level;
            if (pick === 'weakest' ? contender < incumbent : contender > incumbent) index = i;
          }
        }
        this.removeRosterUnit(index);
        break;
      }
    }
  }

  /** Route a resolved outcome's `next`: a page id moves to that page
   *  (`event:pageChanged`), and a terminal closes the event.
   *  `return-to-map` lands on `map` with no event, so `Game` mounts the map;
   *  `start-encounter` opens the named fight, with its reward refs in place
   *  of the encounter's own when it gives them. */
  private resolveEventNext(next: EventNext): void {
    if (typeof next === 'string') {
      this.activeEvent = { eventId: this.activeEvent!.eventId, pageId: next };
      this.bus.emit('event:pageChanged', { eventId: this.activeEvent.eventId, pageId: next });
      return;
    }
    this.activeEvent = null;
    if (next.kind === 'return-to-map') {
      this.phase = 'map';
      return;
    }
    this.pendingRewardOverride = next.rewardOverride ?? null;
    this.phase = 'battle';
    this.beginEncounter(next.encounterId);
  }

  /** One condition against the run as it stands. `flagSet` is a flag set
   *  and not `false`; `flagIs` is strict equality. */
  private evaluateEventCondition(cond: EventCondition): boolean {
    switch (cond.kind) {
      case 'bitsAtLeast':
        return this.bits >= cond.amount;
      case 'poolHealthAtLeast':
        return this.playerHealth >= cond.amount;
      case 'poolHealthAtMost':
        return this.playerHealth <= cond.amount;
      case 'hasDaemon':
        return this.daemons.some((d) => d.id === cond.daemonId);
      case 'hasPacket':
        return this.cache.includes(cond.packetId);
      case 'cacheHasRoom':
        return this.cacheHasRoom;
      case 'rosterSizeAtLeast':
        return this.team.length >= cond.count;
      case 'rosterSizeAtMost':
        return this.team.length <= cond.count;
      case 'characterIs':
        return this.character.id === cond.characterId;
      case 'flagSet':
        return this.eventFlags[cond.flag] !== undefined && this.eventFlags[cond.flag] !== false;
      case 'flagIs':
        return this.eventFlags[cond.flag] === cond.value;
      case 'not':
        // The one combinator; it nests as deep as an author writes it.
        return !this.evaluateEventCondition(cond.condition);
    }
  }

  /** The active event's current page, `null` outside the `event` phase. The
   *  event screen reads it, and the fuzz bot's arbitrated strategy. */
  currentEventPage(): EventPage | null {
    if (this.activeEvent === null) return null;
    const def = this.eventCatalog.find((e) => e.id === this.activeEvent!.eventId);
    return def?.pages[this.activeEvent.pageId] ?? null;
  }

  /** Every page of the active event, in authored order, `[]` outside the
   *  phase. For layout only: the event screen sizes its text and choice
   *  slots to the tallest page, so a page turn moves nothing. The objects
   *  are the catalog's own, so the screen finds `currentEventPage` among
   *  them by identity. */
  activeEventPages(): readonly EventPage[] {
    if (this.activeEvent === null) return [];
    const def = this.eventCatalog.find((e) => e.id === this.activeEvent!.eventId);
    return def === undefined ? [] : Object.values(def.pages);
  }

  /** The active event's name, `null` outside the phase, for the event
   *  screen's heading, so the catalog itself stays private. */
  get activeEventName(): string | null {
    if (this.activeEvent === null) return null;
    const def = this.eventCatalog.find((e) => e.id === this.activeEvent!.eventId);
    return def?.name ?? this.activeEvent.eventId;
  }

  /** Whether the active page's choice at `index` can be taken now. The
   *  event screen shows one that cannot, disabled, with its requirement, so
   *  the player can plan. */
  eventChoiceEnabled(index: number): boolean {
    const choice = this.currentEventPage()?.choices[index];
    if (choice === undefined) return false;
    return choice.condition === undefined || this.evaluateEventCondition(choice.condition);
  }

  /** The indices of the active page's choices that can be taken now, the
   *  fuzz bots' legal moves. Never empty on a live page, since every page
   *  has an unconditioned choice (`assertEventPagesTerminate`). */
  enabledEventChoices(): number[] {
    const page = this.currentEventPage();
    if (page === null) return [];
    return page.choices.map((_, i) => i).filter((i) => this.eventChoiceEnabled(i));
  }

  /** One chain flag, `undefined` when never set. */
  eventFlag(flag: string): EventFlagValue | undefined {
    return this.eventFlags[flag];
  }

  /** The chance an event node's entry becomes a fight, through the run-stat
   *  fold, where a daemon's `modifier` rule on `eventCombatChance` bends it;
   *  read it here, never raw. The fold floors it at 0 and a multiplier can
   *  take it past 1, so this caps it at 1. */
  effectiveEventCombatChance(): number {
    return Math.min(1, this.effectiveRunStats().eventCombatChance);
  }

  /**
   * Roll a port's stock, on its two streams, both keyed to the sector and
   * the node: the draws do not depend on the route taken there, while what
   * they make does, through the team's level and the daemons owned.
   * - `units` — the recruit offer (`rollOffer`), a recruit's in every way:
   *   the character's pools and weights, the folded tier weights, levels
   *   from the team's average with the level bonus. Each card is priced by
   *   `unitPrice`, jittered by `±units.jitter` on the `'portPrice'` stream
   *   and floored at 1.
   * - `packets` — distinct packets at the price book's prices.
   * - `daemons` — distinct daemons not owned, at the price book's prices;
   *   fewer than the count when fewer are unowned, none when all are.
   * The three draw on the `'portStock'` stream in that order. The units'
   * draws vary in number (the level bonus, then each card's level-ups), so
   * a change to them moves the packets and daemons drawn after them.
   */
  private rollPortStock(nodeId: number): PortStock {
    const stockRng = this.streamRng('portStock', this.sectorIndex, nodeId);
    const priceRng = this.streamRng('portPrice', this.sectorIndex, nodeId);
    const counts = PRICES.portStock;
    const baseLevel = Math.round(avgTeamLevel(this.team));
    // The Idol of Portunus forces the first slots' tier to legendary, as
    // many as its fold gives (`effectivePortLegendaryOffers`), up to the
    // slot count. Forcing changes no draw (`rollOffer`).
    const forcedTiers: readonly UnitRarity[] = Array.from(
      { length: Math.min(counts.units, this.effectivePortLegendaryOffers) },
      () => 'legendary' as const,
    );
    const units: PortUnitSlot[] = rollOffer(
      stockRng,
      counts.units,
      (cardRng) =>
        Math.min(
          LEVELING.levelCap,
          baseLevel + recruitLevelBonus(cardRng, RECRUITMENT.recruitBonusChance),
        ),
      this.draftPools(),
      this.character.weightOverrides,
      this.effectiveRarityWeights(),
      forcedTiers,
    ).map((template) => {
      const { jitter } = PRICES.units;
      const factor = 1 - jitter + priceRng.next() * 2 * jitter;
      return {
        template,
        price: Math.max(1, Math.round(unitPrice(template.archetype, template.level) * factor)),
        sold: false,
      };
    });
    const packets: PortPacketSlot[] = sampleDistinct(
      PACKETS.map((p) => p.id),
      counts.packets,
      stockRng,
    ).map((packetId) => ({ packetId, price: packetPrice(packetId), sold: false }));
    const owned = new Set(this.daemons.map((d) => d.id));
    const daemons: PortDaemonSlot[] = sampleDistinct(
      DAEMONS.map((d) => d.id).filter((id) => !owned.has(id)),
      counts.daemons,
      stockRng,
    ).map((daemonId) => ({ daemonId, price: daemonPrice(daemonId), sold: false }));
    return { units, packets, daemons };
  }

  /**
   * Buy a stocked unit: pay its price, then add it as a recruit is added
   * (`appendRosterUnit`); the deck takes it at the next encounter's
   * rebuild. A sold slot is a no-op, as is a buy out of phase or unpaid
   * (`Command.ts`).
   */
  private handleBuyPortUnit(index: number): void {
    if (this.phase !== 'port' || this.portStock === null) return;
    const slot = this.portStock.units[index];
    if (slot === undefined || slot.sold) return;
    if (!this.spendBits(slot.price)) return;
    slot.sold = true;
    this.appendRosterUnit(slot.template);
  }

  /**
   * Buy a stocked packet. With the cache full, `swapCacheIndex` names the
   * held packet to discard, as a reward's accept takes it; the price is
   * checked before that discard, so a buy that cannot be paid for loses
   * nothing.
   */
  private handleBuyPortPacket(index: number, swapCacheIndex?: number): void {
    if (this.phase !== 'port' || this.portStock === null) return;
    const slot = this.portStock.packets[index];
    if (slot === undefined || slot.sold) return;
    if (!this.cacheHasRoom) {
      if (!isIndex(swapCacheIndex, this.cache.length)) return;
      if (this.bits < slot.price) return;
      this.handleDiscardPacket(swapCacheIndex);
    }
    if (!this.spendBits(slot.price)) return;
    slot.sold = true;
    this.addPacket(slot.packetId);
  }

  /** Buy a stocked daemon. The stock leaves owned daemons out, so the buy
   *  cannot duplicate one. */
  private handleBuyPortDaemon(index: number): void {
    if (this.phase !== 'port' || this.portStock === null) return;
    const slot = this.portStock.daemons[index];
    if (slot === undefined || slot.sold) return;
    const daemon = daemonById(slot.daemonId);
    if (daemon === undefined) {
      // The stock is sampled from the catalog and a load checks its ids, so
      // a miss is corruption, and throws rather than lose the purchase.
      throw new Error(`Run.handleBuyPortDaemon: unknown daemon id '${slot.daemonId}'`);
    }
    if (!this.spendBits(slot.price)) return;
    slot.sold = true;
    this.addDaemon(daemon);
  }

  /**
   * Sell a held packet at a port: the slot is discarded, and the refund
   * (`sellPrice` of the price book's buy price) lands through `addBits`,
   * never `gainBits`, since a refund is not an earn: through `gainBits`, a
   * `bitsGain` fold above 1/`sellFraction` would make each buy and sell a
   * profit.
   */
  private handleSellPacket(cacheIndex: number): void {
    if (this.phase !== 'port') return;
    if (!Number.isInteger(cacheIndex)) return;
    const packetId = this.cache[cacheIndex];
    if (packetId === undefined) return;
    this.handleDiscardPacket(cacheIndex);
    this.addBits(sellPrice(packetPrice(packetId)));
  }

  /**
   * The removal service: pay `unitRemovalPrice`, then remove the unit
   * through `removeRosterUnit`. That method throws on a wrong phase, a bad
   * index and the last unit, for callers that are wrong; a command meeting
   * them is a no-op, so this handler checks all three first.
   */
  private handlePayToRemoveUnit(rosterIndex: number): void {
    if (this.phase !== 'port') return;
    if (!isIndex(rosterIndex, this.team.length)) return;
    if (this.team.length <= 1) return;
    if (!this.spendBits(PRICES.unitRemovalPrice)) return;
    this.removeRosterUnit(rosterIndex);
  }

  /**
   * Start the encounter at the current node: pick it and its battlefield,
   * reset the encounter's state (the enemy pool full, the turn count 0, the
   * deck rebuilt and shuffled, the deployment counts and the effect store
   * cleared), land the pending buffs, fire the daemons' `encounterStart`
   * hooks, and start the first turn. `playerHealth` carries over, since the
   * pool is the run's.
   *
   * `eventForcedEncounterId` is an event's `start-encounter` fight. It wins
   * over `forcedEncounterId` for this encounter, and `selectEncounter` takes
   * it past the sector's pools when its kind is `normal`, an event node's;
   * a fight of another kind is passed over for the pool's draw.
   */
  private beginEncounter(eventForcedEncounterId?: string): void {
    // A boss node takes the boss and board picked at the sector's entry
    // (`rollBossForSector`), so the fight is the one forewarned, and draws
    // nothing here. The id resolves now and throws on a catalog miss;
    // `fromJSON` checks it on a load.
    if (this.kindOf(this.currentNodeId) === 'boss') {
      const boss = getEncounter(this.bossEncounterId);
      if (boss === undefined) {
        throw new Error(
          `Run.beginEncounter: pre-rolled boss "${this.bossEncounterId}" not in the catalog`,
        );
      }
      this.selectedEncounter = boss;
      this.encounterMap = this.bossEncounterMap;
    } else {
      // Any other node picks its encounter from the sector's pools, then
      // builds its board, both on the `'map'` stream keyed to the node.
      const mapRng = this.streamRng('map', this.sectorIndex, this.currentNodeId);
      const selection = selectEncounter(
        this.currentSector(),
        { hop: this.currentHop, nodeKind: this.kindOf(this.currentNodeId) },
        mapRng,
        getEncounter,
        eventForcedEncounterId ?? this.forcedEncounterId ?? undefined,
      );
      this.selectedEncounter = selection.encounter;
      // The board's draws follow the selection's on the same stream.
      this.encounterMap = this.buildEncounterMap(selection.layoutId, mapRng);
    }
    // Both branches set the encounter: the enemy's pool fills from it, and
    // its waves start from the top.
    this.waveCursor = null;
    this.enemyHealth = this.enemyPoolOf(this.selectedEncounter!);
    this.turnIndex = 0;
    this.lastTurn = null;
    // The draw pile is rebuilt from the roster as it is now, so a new
    // recruit is in it, and shuffled; the hand and discard start empty.
    this.drawPile = this.team.map((_, i) => i);
    this.streamRng('deck', this.deckShuffleIndex++).shuffle(this.drawPile);
    this.discardPile = [];
    this.hand = [];
    // Deployment counts are the encounter's; `beginTurn` adds each turn's
    // hand (`recordDeployment`).
    this.resetDeploymentCounts();
    this.resetEncounterEffects();
    // The buffs a packet put on a unit away from battle land now, after the
    // reset that would clear them, and the last encounter's injected rules
    // expire; a rule injected for the run stays.
    this.drainPendingEncounterEffects();
    this.injectedEncounterRules = [];
    // The daemons' `encounterStart` hooks, on the `'daemon'` stream's site
    // 0 for this node. No shipped daemon has one.
    this.executeInstantOps(
      resolveInstantHooks(
        this.daemons,
        'encounterStart',
        {},
        this.streamRng('daemon', this.sectorIndex, this.currentNodeId, 0, 0),
      ),
    );
    this.startNextTurn();
  }

  /**
   * Pick the sector's boss and build its board at the sector's entry, so the
   * map can forewarn of both (`bossForewarning`). The pick is
   * `selectEncounter`'s, as a fight would make it, at the terminal hop
   * (`nodeMap.hops.length - 1`, which follows a `hopCount` dial where the
   * sector's `length` would not), and the board is `buildEncounterMap`'s,
   * the forced-layout dial included. `sectorRng` is the sector's `'boss'`
   * stream, which the two sector entries, the constructor and
   * `advanceSector`, pass. `forcedEncounterId` applies as at a fight: a
   * forced boss is taken, and one of another kind leaves the pool's draw.
   */
  private rollBossForSector(sectorRng: RNG): {
    bossEncounterId: string;
    bossEncounterMap: EncounterMap;
  } {
    const bossHop = this.nodeMap.hops.length - 1;
    const selection = selectEncounter(
      this.currentSector(),
      { hop: bossHop, nodeKind: 'boss' },
      sectorRng,
      getEncounter,
      this.forcedEncounterId ?? undefined,
    );
    return {
      bossEncounterId: selection.encounter.id,
      bossEncounterMap: this.buildEncounterMap(selection.layoutId, sectorRng),
    };
  }

  /**
   * Make the active sector's root an `event` node when the sector has
   * `startingEvents`, with no draw (`stampRootKind`). The constructor skips
   * it when the `firstNodeKind` dial is set; `advanceSector` always calls
   * it, since that dial shapes the first sector only.
   */
  private stampStartingEventRoot(): void {
    if (this.currentSector().startingEvents.length > 0) {
      this.nodeMap = stampRootKind(this.nodeMap, 'event');
    }
  }

  /**
   * The active sector's definition. Throws on an id the catalog does not
   * hold: the sector map's loader checks the ids it names, but a load does
   * not check the saved one.
   */
  private currentSector(): SectorDef {
    const sector = getSector(this.currentSectorId);
    if (!sector) throw new Error(`Run: active sector "${this.currentSectorId}" not found`);
    return sector;
  }

  /** The length the active sector's node map is generated at, at both
   *  sector entries: `sectorHops` when set, else the sector's `length`. A
   *  `hopCount` dial wins over both inside `NodeMap.generate`. */
  private currentSectorLength(): number {
    return this.sectorHopsOverride ?? this.currentSector().length;
  }

  /**
   * The active sector's title. Defined at the pre-root start too, where
   * `currentHop` throws, since a run always has a sector.
   */
  get currentSectorTitle(): string {
    return this.currentSector().title;
  }

  /**
   * The sector's boss as the map forewarns of it: the boss's name and its
   * board's layout name, `null` for a procedural board, which the map labels
   * itself. Defined from the sector's entry, before any node is entered.
   * Read from the catalogs at each call: a boss id the catalog does not hold
   * throws, as in `beginEncounter`, while a layout id it does not hold shows
   * as the id here (the fight would throw building its terrain,
   * `generateTerrain`).
   */
  get bossForewarning(): { name: string; layoutName: string | null } {
    const boss = getEncounter(this.bossEncounterId);
    if (boss === undefined) {
      throw new Error(
        `Run.bossForewarning: pre-rolled boss "${this.bossEncounterId}" not in the catalog`,
      );
    }
    const layoutId = this.bossEncounterMap.layoutId;
    return {
      name: boss.name,
      layoutName: layoutId === null ? null : (getLayout(layoutId)?.name ?? layoutId),
    };
  }

  /**
   * The active encounter's enemy pool at full (`enemyPoolOf`), which the
   * battle scene's gauge, the turn payloads and a capped turn's result read;
   * `HEALTH.enemyHealthMax` outside an encounter, where none of them reads
   * it.
   */
  get enemyHealthPoolMax(): number {
    return this.selectedEncounter === null
      ? HEALTH.enemyHealthMax
      : this.enemyPoolOf(this.selectedEncounter);
  }

  /**
   * An encounter's enemy pool in this run: its authored `healthPool` under
   * the run's enemy-morale multiplier. The one read of `healthPool` in the
   * Run. The pool a fight starts with, the maximum the gauges and payloads
   * carry and the stage condition's denominator all come from here; a
   * multiplier on one of them alone would flip a staged encounter at the
   * wrong fraction of its pool.
   */
  private enemyPoolOf(encounter: Encounter): number {
    return scaledEnemyPool(encounter.healthPool, this.difficultyMultipliers.enemyMorale);
  }

  /**
   * The active encounter's name, for the battle HUD's enemy pane; `null`
   * outside an encounter.
   */
  get currentEncounterName(): string | null {
    return this.selectedEncounter?.name ?? null;
  }

  /**
   * Build the encounter's battlefield for `selectedLayoutId`, which
   * `selectEncounter` picked from the sector's layout pool at the hop, kept
   * to the encounter's fit (`null` is procedural). The terrain seed and the
   * procedural side are drawn on every branch, the forced-layout dial
   * included (gotcha #49). A procedural board takes the sector's theme, and
   * a hand-authored layout its own.
   */
  private buildEncounterMap(selectedLayoutId: string | null, mapRng: RNG): EncounterMap {
    const sector = this.currentSector();
    const terrainSeed = Math.floor(mapRng.next() * 0x1_0000_0000);
    // `forcedLayoutId`: `null` takes the selection's, `FORCE_PROCEDURAL` a
    // procedural board, and any other id that layout.
    const layoutId =
      this.forcedLayoutId === null
        ? selectedLayoutId
        : this.forcedLayoutId === FORCE_PROCEDURAL
          ? null
          : this.forcedLayoutId;
    const proceduralSide = rollProceduralSide(mapRng);
    const { gridW, gridH } = layoutId === null
      ? { gridW: proceduralSide, gridH: proceduralSide }
      : layoutDimensions(layoutId);
    const theme = layoutId === null
      ? sector.theme
      : (getLayout(layoutId)?.theme ?? sector.theme);
    return { layoutId, gridW, gridH, terrainSeed, theme };
  }

  /**
   * H4b — enter the next turn through the (optional) pre-turn gate. With
   * `pauseAtTurnGates` on, pause on `turn-intro` + emit `turn:starting` so the
   * pre-turn screen shows (it resumes via `advanceTurn`); off, fall straight
   * into the turn's battle (the H4a path — phase stays `battle`).
   *
   * H5b — the hand is DRAWN here (before the gate), so `turn:starting` can carry
   * it for the pre-turn screen and `beginTurn` simply fields the already-drawn
   * hand. The draw runs on both paths, so the headless loop is unchanged.
   */
  private startNextTurn(): void {
    this.drawTurnHand();
    // L1→47c — resolve this turn's daemon grants (the `turnStart` grant
    // hooks). A chance hook (Mercury) flips its coin off the isolated
    // `daemonRng` exactly HERE, once per turn, on both the gated + headless
    // paths (path-independent draw count). 49d: the resolution IS the fresh
    // queue — per-grant `used`/`passed` start clean, so no counter resets.
    // 77d2 — site 1 of the 'daemon' key: one occurrence per turn's grant
    // resolution (the per-turn chance flips ride it).
    const resolution = resolveTurnGrants(
      this.daemons,
      this.streamRng('daemon', this.sectorIndex, this.currentNodeId, 1, this.turnIndex),
    );
    this.turnGrants = resolution.grants;
    // 47e — the walk's granted instant ops (gainBits/healPool) execute NOW,
    // at the fire site — their coins already flipped in the walk above (one
    // walk, one draw; never re-resolve). Applied before the `turn:starting`
    // emit so the gate screen reads post-effect state.
    this.executeInstantOps(resolution.instants);
    if (this.pauseAtTurnGates) {
      this.phase = 'turn-intro';
      this.bus.emit('turn:starting', this.turnStartingPayload());
    } else {
      this.phase = 'battle';
      this.beginTurn();
    }
  }

  /**
   * H4b → 115a — the `turn:starting` payload, built from the Run's state
   * alone, so `resume()` rebuilds the one the live run emitted. Only valid
   * at the pre-turn gate (mid-encounter).
   */
  private turnStartingPayload(): GameEvents['turn:starting'] {
    // K3.5 — the pre-turn gate is only reached mid-encounter, so the map is set.
    const { layoutId, gridW, gridH, theme } = this.encounterMap!;
    // Wb1 — the selected encounter is held for the whole encounter, so it's
    // always set here (mid-encounter, same as the map above).
    const encounter = this.selectedEncounter!;
    return {
      turn: this.turnIndex + 1,
      hop: this.currentHop,
      playerHealth: this.playerHealth,
      playerHealthMax: HEALTH.playerHealthMax,
      enemyHealth: this.enemyHealth,
      enemyHealthMax: this.enemyHealthPoolMax,
      hand: this.hand.map((idx) => this.team[idx]!),
      // R2 — the other two piles for the pre-turn pile views (recruitment
      // order; see resolvePileForDisplay).
      drawPile: this.resolvePileForDisplay(this.drawPile),
      discardPile: this.resolvePileForDisplay(this.discardPile),
      // 49d — the grant queue (per-source, walk order; `active` = the
      // cursor the strict mode enforces).
      grants: this.grantViews(),
      empowerStacks: this.empowerStacks(),
      // 47d — the owned-daemon list (stacked banners). `redrawGate`/
      // `empowerGate` = "does this idol EVER grant it" (authored hooks,
      // not this turn's resolution) — the screen tells "denied this turn"
      // from "never grants it".
      daemons: this.daemons.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        redrawGate: daemonRedrawHook(d) !== undefined,
        empowerGate: daemonEmpowerHook(d) !== undefined,
      })),
      encounter: { name: encounter.name, kind: encounter.kind },
      map: { layoutId, gridW, gridH, theme },
      // 65e — the folded draw amount for the "Draw: N" chip (the §65
      // transparency surface; derived, so a draw daemon moves it live).
      drawAmount: this.effectiveDrawAmount,
      // 89e — the risk line ("at risk this turn: up to N"): the wave this
      // turn will field, previewed off the same keyed stream `beginTurn`
      // rolls it from (see `rollTurnWave`), summed to its chip bound.
      poolAtRisk: this.previewPoolAtRisk(),
      // 115a — the previous turn of this encounter, for the strip; the
      // completed turn's number is `turnIndex` (resolveTurn advanced it).
      lastTurn:
        this.lastTurn === null
          ? null
          : { ...this.lastTurn, fallen: this.fallenForTurn(this.turnIndex).thisTurn },
    };
  }

  /**
   * H5b — discard the previous turn's hand and draw the next, run once per turn
   * from `startNextTurn` (BEFORE the pre-turn gate, so `turn:starting` carries
   * the hand). Split out of `beginTurn` so the draw happens once per turn on
   * both the gated + headless paths. Determinism is unchanged: the deck's
   * only draw (a possible recycle shuffle) rides its own counter-keyed
   * occurrence, independent of every other stream — moving the deck draw
   * earlier in wall-clock can't shift anything (structural, 77d2).
   */
  private drawTurnHand(): void {
    // 65f — per-card through the discard chokepoint (the recycle cues fire
    // with no gate screen up — harmless, and honest at the one emit site).
    for (const idx of this.hand) this.discardCard(idx);
    this.hand = this.drawHand();
  }

  /**
   * 47e — the effective run stats: `RUN_STAT_BASES` folded with every owned
   * daemon's `modifier` rules, derived AT CALL TIME (derive-don't-cache —
   * ownership changes, §49 packet modifiers, and future removal all stay
   * correct for free). Today's only consumer is `gainBits` (`bitsGain`);
   * §49's cache reads `cacheSize` from here.
   */
  private effectiveRunStats(): Readonly<Record<RunStatKey, number>> {
    const mods: RunStatModifier[] = [];
    // 65d — the forced-draw A/B dial folds like a daemon modifier, so the
    // deal AND the Option-B budget basis both see it. 0 = no injection —
    // the identity fast path (and byte-identity) hold.
    if (this.drawAmountAdd !== 0) {
      mods.push({ stat: 'drawAmount', op: 'add', value: this.drawAmountAdd });
    }
    for (const daemon of this.daemons) {
      for (const rule of daemon.rules ?? []) {
        if (rule.kind === 'modifier') mods.push(rule);
      }
    }
    return foldRunStats(RUN_STAT_BASES, mods);
  }

  /**
   * 48b/48f — the settle math for a bits earn: `base` × the folded `bitsGain`
   * multiplier × the per-run `bitsMultiplier` difficulty lever (48f — the
   * shape-lock's Option B: inside the settle, so reward rolls, battle
   * tallies, and daemon hooks all scale uniformly and the §52 dial reads
   * clean), ROUNDED once to an integer (the runStats.ts contract — the fold
   * itself never rounds). Public and SHARED with the reward screen's display
   * derivation (the shape-lock rider: the screen must show exactly what the
   * settle grants — one code path, drift-impossible; accepting a bits-fold
   * daemon mid-offer visibly re-derives the remaining portions).
   */
  effectiveBits(base: number): number {
    return Math.round(base * this.effectiveRunStats().bitsGain * this.difficultyMultipliers.bits);
  }

  /**
   * 47e — earn bits: the `effectiveBits` settle math, then through the
   * floor-at-zero chokepoint. Every earn surface routes here (daemon hooks,
   * the 48b reward settle — which, since 51a, is also how the 47f battle
   * tally lands: as an accepted offer portion), so a bits-gain modifier
   * daemon applies uniformly without per-surface bookkeeping.
   * NB for §50: port SELL proceeds are a refund, not income — they must
   * take the raw `addBits` path, never this one, or a bits fold above
   * 1/sellFraction mints an infinite buy-sell loop (worklog §48).
   */
  gainBits(base: number): void {
    this.addBits(this.effectiveBits(base));
  }

  /**
   * 50a — the spend chokepoint: every §50d buy/removal surface routes here.
   * The affordability guard lives HERE (not at call sites) because `addBits`
   * CLAMPS at zero — a raw negative delta would silently under-charge when
   * the balance is short. Returns whether the spend happened; an
   * unaffordable spend is a clean refusal (no emit, no partial deduction).
   * No fold applies in either direction: prices are what they say (the
   * `bitsGain` fold is an EARN modifier), and sell proceeds are a refund
   * through raw `addBits` — see the `gainBits` NB above.
   */
  spendBits(amount: number): boolean {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error(`spendBits: amount must be a nonnegative integer (got ${amount})`);
    }
    if (amount > this.bits) return false;
    this.addBits(-amount);
    return true;
  }

  /**
   * 47e — the single bits mutation chokepoint: clamps the balance at ZERO
   * (spec §Bits — integer, floor at zero) and emits `run:bitsChanged` with
   * the post-clamp applied delta. Emits only on a real change, so a clamped
   * no-op spend or a ×0 grant stays silent. §50's spend surfaces will call
   * this with negative deltas.
   */
  /**
   * 94e — the ONE write to the run-wide player pool after construction:
   * floors at 0 and emits `run:poolChanged` on a real change, whatever
   * moved it — the chip, a rest, the seam refill, an event's heal or damage
   * op. Each site keeps its OWN cap (the heals and the rest clamp at max,
   * the seam only floors — a pool above the floor carries untouched, the
   * §90 rule the T2 sentinel pins), so every write is byte-identical to the
   * pre-94e one; the chokepoint adds the event, nothing else. The §94
   * kickoff audit found four of the five writes emitting nothing, which is
   * how a persistent pool chip would have gone stale on a rest; this is
   * what makes "the pool shown everywhere" true rather than mostly true.
   * `pools:chipped` (89a) still rides the chip site beside it — that event
   * carries the encounter pool + the uncapped charges the telemetry reads.
   * `max` is read at call time (the fuzz `--set` arm mutates HEALTH in place).
   */
  private setPlayerHealth(next: number, reason: PoolChangeReason): void {
    const after = Math.max(0, next);
    const before = this.playerHealth;
    this.playerHealth = after;
    if (after !== before) {
      this.bus.emit('run:poolChanged', { before, after, max: HEALTH.playerHealthMax, reason });
    }
  }

  private addBits(delta: number): void {
    const next = Math.max(0, this.bits + delta);
    if (next === this.bits) return;
    const applied = next - this.bits;
    this.bits = next;
    this.bus.emit('run:bitsChanged', { bits: this.bits, delta: applied });
  }

  /**
   * 49b — the effective cache capacity: the `cacheSize` run-stat fold read
   * at call time and FLOORED here (the runStats.ts contract — the fold never
   * rounds; the read site does). Derive-don't-cache: a size-modifier daemon
   * joining is correct with zero bookkeeping.
   */
  get effectiveCacheSize(): number {
    return Math.floor(this.effectiveRunStats().cacheSize);
  }

  /**
   * 64a — the effective post-battle recruit-offer size: the
   * `recruitOfferSize` run-stat fold (base = recruitment.json's
   * defaultOfferSize) read at call time and FLOORED here (the
   * `effectiveCacheSize` discipline). The Cornucopia's +1 lands through
   * this; the PORT unit count deliberately does not read it (spec scope:
   * post-encounter only).
   */
  get effectiveOfferSize(): number {
    return Math.floor(this.effectiveRunStats().recruitOfferSize);
  }

  /**
   * 64c — how many port unit slots are TIER-FORCED to legendary (Idol of
   * Portunus). The count-stat shape-lock: a second source is +1 more —
   * stacking needs no design work; `rollPortStock` clamps at the slot
   * count. Floored at the read site (the fold contract).
   */
  get effectivePortLegendaryOffers(): number {
    return Math.floor(this.effectiveRunStats().portLegendaryOffers);
  }

  /**
   * 65a — the per-turn draw amount: the `drawAmount` run-stat fold (base =
   * `DECK.handSize`, config-derived) read at call time and FLOORED here (the
   * fold contract — the fold never rounds; the read site does). Clamped ≥1:
   * the roster can't be emptied (see `removeRosterUnit`), so a turn always
   * fields at least one card — a pathological mult-0 modifier must not zero
   * the hand into a soft-lock. Transient packet draws (65c) bypass this fold
   * by design (the Option-B split, worklog §65-shape-lock).
   * 65d — clamped ABOVE by `DECK.maxHandSize` (user-signed at 8 off the
   * A/B). The cap lives HERE, not in `drawHand`, so the deal and the
   * Option-B budget basis move together under a capped fold (the K2
   * desync lesson: one basis, every reader).
   */
  get effectiveDrawAmount(): number {
    return Math.max(
      1,
      Math.min(DECK.maxHandSize, Math.floor(this.effectiveRunStats().drawAmount)),
    );
  }

  /**
   * 49b — packets held beyond the derived capacity (0 = none). Non-zero only
   * after a SHRINK (a cacheSize-lowering daemon landing under current
   * holdings — since 74c also via event `removeDaemon`) or an event
   * `addPacket` landing on a full cache (74c honor-the-grant, user-signed)
   * — the INTERACTIVE acquisition surfaces still gate on `cacheHasRoom`.
   * DERIVED, never serialized: a save mid-shrink round-trips the
   * cache + daemons and this recomputes (derive-don't-cache). While > 0 the
   * 49f forced-keep flow demands discards.
   */
  get cacheOverflow(): number {
    return Math.max(0, this.cache.length - this.effectiveCacheSize);
  }

  /** 49b — room for one more packet (the acquisition gate: 49c reward
   *  accepts, §50 port buys). */
  get cacheHasRoom(): boolean {
    return this.cache.length < this.effectiveCacheSize;
  }

  /**
   * 49b — append a packet to the cache (the 49c reward / §50 port
   * acquisition seam — `addDaemon`'s sibling). Takes the ID: the cache
   * serializes ids, so a non-catalog packet can never legally exist here
   * (unlike bespoke in-memory daemons) — an unknown id throws, loud beats a
   * poisoned save. Fullness is the CALLER's concern (the addDaemon duplicate
   * discipline): acquisition surfaces gate on `cacheHasRoom` upstream, and
   * the 49c swap flow discards before adding. Duplicate ids are legal — no
   * stacking means one SLOT each, not one copy each (spec §Cache).
   */
  addPacket(packetId: string): void {
    if (packetById(packetId) === undefined) {
      throw new Error(`Run.addPacket: unknown packet id '${packetId}'`);
    }
    this.cache.push(packetId);
    this.emitCacheChanged();
  }

  /**
   * 49b — discard one cache slot (the `discardPacket` command: the at-will
   * discard, and the instrument of the 49f forced-keep shrink flow).
   * Out-of-range / fractional = the silent no-op discipline. Deliberately
   * NOT phase-guarded: the cache is pure run-level state with no sim seam,
   * the modal opens on any screen (49f), and a shrink must be resolvable
   * wherever it landed (the reward phase today, ports at §50).
   */
  private handleDiscardPacket(cacheIndex: number): void {
    if (!isIndex(cacheIndex, this.cache.length)) return;
    this.cache.splice(cacheIndex, 1);
    this.emitCacheChanged();
  }

  /**
   * 49e — fire one held packet (the `usePacket` command): the consume side
   * of the earn-store-use loop. The contract, all shape-locked (worklog §49e):
   *
   * - **Context derives from the phase** — `turn-intro` → `preTurn`, `map` →
   *   `outOfBattle`, anything else rejects. The packet's authored `usableIn`
   *   must admit the derived context (the parse-time matrix already
   *   guarantees op×context legality, so the engine only re-checks the
   *   authored subset).
   * - **Validation before ANY mutation** (the acceptReward discipline):
   *   every reject is a silent no-op that consumes nothing.
   * - **Consume-on-fire, irrevocable** (the §49 kickoff lock): the effect
   *   executes, then the slot splices — no batching, no undo. Order of
   *   consumption IS order of effect.
   * - **Op landing sites**: `applyBuff` → the live encounter store (preTurn,
   *   on the targeted hand card's roster slot) or the pending-until-start
   *   store (outOfBattle, on the roster slot directly); `grantRedraws` →
   *   a `TurnGrant` INSERTED AT THE CURSOR (immediately active — the packet
   *   buys back the flexibility the strict idol order takes; the queue
   *   resumes behind it); `injectRule` → the duration's injected-rules
   *   store; `healPool` → the instant-op executor (capped at max).
   */
  private handleUsePacket(cacheIndex: number, handIndex?: number, rosterIndex?: number): void {
    const context: UseContext | null =
      this.phase === 'turn-intro' ? 'preTurn' : this.phase === 'map' ? 'outOfBattle' : null;
    if (context === null) return;
    if (!isIndex(cacheIndex, this.cache.length)) return;
    // The cache holds catalog-validated ids (addPacket/fromJSON both hard-
    // reject unknowns), so a miss here is unreachable — guarded anyway.
    const packet = packetById(this.cache[cacheIndex]!);
    if (packet === undefined) return;
    if (!packet.usableIn.includes(context)) return;
    // Resolve the unit target per context BEFORE mutating anything: preTurn
    // targets a HAND position (the redraw/empower click contract), out-of-
    // battle a roster slot. Target-less packets ignore both fields.
    let targetSlot: number | null = null;
    // 65c — hand ops need the POSITION, not just the slot (discard splices
    // the hand). Set only on the preTurn unit-target path.
    let targetHandIndex: number | null = null;
    if (packet.target === 'unit') {
      if (context === 'preTurn') {
        if (!isIndex(handIndex, this.hand.length)) return;
        targetSlot = this.hand[handIndex]!;
        targetHandIndex = handIndex;
      } else {
        if (!isIndex(rosterIndex, this.team.length)) return;
        targetSlot = rosterIndex;
      }
    }
    const effect = packet.effect;
    // 65c — validate-first: discarding the LAST hand card would field an
    // empty team at beginTurn (a self-inflicted instant loss shaped like a
    // misclick) — reject like any other illegal target, consuming nothing.
    if (effect.op === 'discardCards' && this.hand.length <= 1) return;
    // 65d — validate-first, the sibling guard: a draw fired at a FULL hand
    // (≥ the cap) can deal nothing — reject rather than consume a dead
    // packet. A mid-draw cap arrival still partial-draws (below).
    if (effect.op === 'drawCards' && this.hand.length >= DECK.maxHandSize) return;
    let handChanged = false;
    switch (effect.op) {
      case 'applyBuff':
        // The same builder as the empower path (magnitude 1, endOfTurn seed
        // lifetime — the encounter store's re-seed contract, deep-copied
        // mods). The pending store merges by key too, so double-firing
        // overclock on one unit stacks exactly like double-empowering.
        if (context === 'preTurn') {
          this.addEncounterEffect(targetSlot!, empowerEffect(effect.buff));
        } else {
          mergeEffectInto(this.pendingEncounterEffects[targetSlot!]!, empowerEffect(effect.buff));
        }
        break;
      case 'grantRedraws': {
        // Insert AT the derived cursor (or append to a spent queue) so the
        // packet's redraw is the active grant NOW under strict finality —
        // the previously-active idol grant resumes right behind it. The
        // entry's source id is the PACKET id (grantViews resolves names
        // from either catalog).
        const entry: TurnGrant = {
          daemonId: packet.id,
          effect: {
            kind: 'redraw',
            budget: effect.redrawsPerTurn,
            maxCards: effect.maxCardsPerTurn,
          },
          used: 0,
          passed: false,
        };
        const cursor = activeGrantIndex(this.turnGrants);
        this.turnGrants.splice(cursor ?? this.turnGrants.length, 0, entry);
        break;
      }
      case 'injectRule':
        // Push a COPY so the store never aliases the catalog object (rules
        // are never mutated, but the store serializes — keep it independent).
        // 51f — the entry carries its source packet id (the tally label).
        (effect.duration === 'run' ? this.injectedRunRules : this.injectedEncounterRules).push({
          rule: cloneBattleRule(effect.rule),
          sourceId: packet.id,
        });
        break;
      case 'healPool':
        this.executeInstantOps([effect]);
        break;
      case 'drawCards':
        // 65c — the TRANSIENT draw: cards join the hand directly, the
        // `drawAmount` fold (and with it the enemy-budget basis) untouched
        // by design (the Option-B split, worklog §65-shape-lock). Stops
        // early on a fully dealt deck (the H5 exhaustion contract) —
        // consume-on-fire stands regardless (the patch-at-full-health
        // precedent: order of consumption IS order of effect).
        for (let i = 0; i < effect.count; i++) {
          if (this.hand.length >= DECK.maxHandSize) break; // 65d — the cap
          const card = this.drawCard();
          if (card === undefined) break;
          this.hand.push(card);
        }
        handChanged = true;
        break;
      case 'discardCards':
        // 65c — send the targeted card to the discard; the hand SHRINKS
        // (no refill — that's what distinguishes it from a redraw). The
        // discarded card recycles via the normal H5 reshuffle.
        this.discardCard(this.hand[targetHandIndex!]!);
        this.hand.splice(targetHandIndex!, 1);
        handChanged = true;
        break;
    }
    // Consume + repaint: the splice emits the shrunk cache; run:packetUsed
    // carries the re-derived pre-turn state for the 49f strip.
    this.cache.splice(cacheIndex, 1);
    this.emitCacheChanged();
    this.bus.emit('run:packetUsed', {
      packetId: packet.id,
      context,
      playerHealth: this.playerHealth,
      grants: this.grantViews(),
      empowerStacks: this.empowerStacks(),
      // 96.5c — a packet that moved the pool moved the bound's cap. The
      // preview rolls the turn's wave, which exists only inside an encounter
      // — at the map (a patch heal) there is no bound to re-derive: 0.
      poolAtRisk: this.phase === 'turn-intro' ? this.previewPoolAtRisk() : 0,
    });
    // 65e — the hand emit goes LAST: the cache/packet repaints above
    // rebuild the pre-turn card row WITHOUT enter animations (the screen's
    // enter set is one-shot), so the hand swap that carries them must be
    // the final rebuild of the dispatch.
    if (handChanged) this.emitHandChanged();
  }

  /** 49b — the one `run:cacheChanged` emit site: an authoritative copy of
   *  the ids + the derived capacity, so consumers repaint from the payload
   *  without re-deriving. */
  private emitCacheChanged(): void {
    this.bus.emit('run:cacheChanged', {
      packetIds: this.cache.slice(),
      size: this.effectiveCacheSize,
    });
  }

  /**
   * 47e — execute a firing's resolved instant run-ops at the fire site:
   * `gainBits` through the fold + chokepoint; `healPool` onto the run-wide
   * player pool, capped at max (the rest-node discipline). The resolution
   * (coin flips, filters) already happened in the daemon walk — this only
   * applies effects, so it draws nothing.
   */
  private executeInstantOps(ops: readonly InstantOp[]): void {
    for (const op of ops) {
      // 74c hygiene — the untagged else became an exhaustive switch so a
      // future InstantOp widening is a compile error here, never a silent
      // heal. (The events-side union deliberately did NOT widen this one —
      // events have their own executor, `executeEventOp`.)
      switch (op.op) {
        case 'gainBits':
          this.gainBits(op.amount);
          break;
        case 'healPool':
          this.setPlayerHealth(Math.min(HEALTH.playerHealthMax, this.playerHealth + op.amount), 'heal');
          break;
        default:
          op satisfies never;
      }
    }
  }

  /**
   * H4 — spin up one turn: roll this turn's battlefield + a fresh enemy wave at
   * the encounter's fixed budget, field this turn's already-drawn hand (H5b
   * draws it in `startNextTurn`), record the deployed hand, publish the per-turn
   * `currentEncounter`, and emit `battle:started` for the driver (BattleScene /
   * the headless harness) to build a World.
   *
   * Determinism (77d2): each turn's stream derives from `streamRoot` +
   * (sectorIndex, nodeId, turnIndex) — never looked ahead / stashed — so a
   * mid-encounter save/resume re-derives every future turn's wave from the
   * root and counters alone.
   */
  /**
   * 89e — roll the turn's world seed + enemy wave off the keyed `battle`
   * stream WITHOUT touching run state: a pure function of the serialized
   * state at the turn boundary (stream root, sector/node/turn, the wave
   * cursor, the pools, the roster + fold). `beginTurn` commits its result
   * (assigns the cursor, fields the team); the pre-turn RISK PREVIEW calls
   * it before the gate and discards everything but Σ power. Both get the
   * identical wave because `streamRng` is hash-DERIVED per occurrence
   * (`deriveRng`, no parent consumption — gotcha #125), so a preview
   * derive is byte-neutral for every other stream, and nothing between the
   * gate and the fight can change an input: `removeRosterUnit` is
   * map-only, packet draws mutate `hand` not the fold, `healPool` touches
   * the PLAYER pool only (the stage condition reads the enemy pool).
   * Pinned by the preview==fielded test in Run.test.ts.
   *
   * 77d2 — one turn = one 'battle' occurrence, keyed (sectorIndex, nodeId,
   * turnIndex): worldSeed + the wave rolls ride it, and a prior encounter's
   * LENGTH can no longer shift a later turn's stream (the old per-turn
   * positional fork did exactly that). U3 — the per-turn enemy team comes
   * from the selected ENCOUNTER, not the random `rollEnemyWave`: advance the
   * wave-list grammar one turn (`waveForTurn`, U2) to get this turn's spec +
   * cursor, then resolve it to a team (`resolveWave`, U1). Both draw
   * `battleRng` — the last consumer, so their variable draw count stays
   * downstream-safe. The stage condition reads the live pool fraction at
   * this turn boundary.
   */
  private rollTurnWave(): { worldSeed: number; cursor: WaveCursor | null; enemyTeam: UnitTemplate[] } {
    const battleRng = this.streamRng('battle', this.sectorIndex, this.currentNodeId, this.turnIndex);
    const worldSeed = Math.floor(battleRng.next() * 0x1_0000_0000);
    const encounter = this.selectedEncounter;
    if (encounter === null) {
      throw new Error('Run.rollTurnWave: no selected encounter — outside an encounter');
    }
    const enemyPool = this.enemyPoolOf(encounter);
    const encounterState: EncounterState = {
      poolFraction: enemyPool > 0 ? this.enemyHealth / enemyPool : 0,
    };
    const { spec, cursor } = waveForTurn(encounter.waves, this.waveCursor, encounterState, battleRng);
    const waveContext: WaveContext = {
      roster: this.team,
      // 65b — the count/budget basis is the FIELDED hand: min(roster,
      // effectiveDrawAmount) — Option B, the FOLDED basis (worklog
      // §65-shape-lock). Persistent daemon draw modifiers scale the
      // opposition with the hand they grant; TRANSIENT packet draws (65c)
      // deliberately never reach this seam — they mutate `hand` directly,
      // not the fold. This ONE field feeds BOTH resolveTotalCount and
      // resolveLevelBudget, so count-basis == budget-basis by construction
      // (the K2 desync shape can only re-enter via a second supplier).
      // ⚠ Landing note (worklog §65-shape-lock): the FIRST draw-daemon's
      // authored description owes the coupling sentence ("Foes muster to
      // match") — the budget consequence is surfaced nowhere else.
      // The per-instance level cap is authored per wave (`spec.levelCap`)
      // and resolved against `roster`, so it's no longer computed here.
      handSize: Math.min(this.team.length, this.effectiveDrawAmount),
      // X1 — the per-run difficulty lever, applied to every wave at resolve time.
      waveSizeMultiplier: this.difficultyMultipliers.waveSize,
      levelBudgetMultiplier: this.difficultyMultipliers.levelBudget,
    };
    const enemyTeam = resolveWave(spec, waveContext, battleRng);
    return { worldSeed, cursor, enemyTeam };
  }

  /**
   * 89e → §91d — the pre-turn RISK line's number: the most pool this turn can
   * cost the player, capped at the pool (you can't lose what you don't have):
   * every unit in the HAND falls → Σ the hand's `power` × `chipMultiplier` —
   * the player's own numbers, known at the gate for free. It reads BASE
   * template power (the number the player can add up from the cards);
   * in-battle power buffs and the cap-turn SURCHARGE (the stall path) sit
   * outside the bound — an upper bound on the ORDINARY turn is the point
   * (`playerExposure`).
   * Display-only: consumed by `turn:starting` (and, 96.5c, re-derived on
   * `turn:handRedrawn` / `run:packetUsed`, and read by the BattleScene for
   * the live bar's ceiling tick — public for that one reader), never
   * serialized, never read by the sim. Pure: `rollTurnWave` is keyed, so a
   * second call previews the same wave.
   */
  previewPoolAtRisk(): number {
    return this.previewPoolsAtRisk().player;
  }

  /** 96.5c2 — both bounds at once (the live bar's notch on EACH gauge): the
   *  player's (`playerExposure`, capped at the player pool) and the enemy's
   *  mirror (`enemyExposure`, capped at the enemy pool), which reads the wave
   *  previewed off the keyed stream `beginTurn` rolls it from. Display-only;
   *  never serialized; never read by the sim. */
  previewPoolsAtRisk(): { player: number; enemy: number } {
    const { enemyTeam } = this.rollTurnWave();
    const fielded = {
      player: this.hand.reduce((sum, idx) => sum + this.team[idx]!.stats.power, 0),
      enemy: enemyTeam.reduce((sum, t) => sum + t.stats.power, 0),
    };
    return {
      player: Math.min(this.playerHealth, playerExposure(fielded)),
      enemy: Math.min(this.enemyHealth, enemyExposure(fielded)),
    };
  }

  private beginTurn(): void {
    // K3.5 — the battlefield is the ENCOUNTER's (rolled once in
    // `beginEncounter`); only the world seed and the enemy wave (both from
    // `rollTurnWave`) stay per-turn. The pre-K3.5 per-turn layout/terrain/
    // theme rolls lived right here — see `rollEncounterMap`.
    if (this.encounterMap === null) {
      throw new Error('Run.beginTurn: no encounterMap — beginTurn outside an encounter');
    }
    const { layoutId, gridW, gridH, terrainSeed, theme } = this.encounterMap;
    const encounter = this.selectedEncounter;
    if (encounter === null) {
      throw new Error('Run.beginTurn: no selected encounter — beginTurn outside an encounter');
    }
    const { worldSeed, cursor, enemyTeam } = this.rollTurnWave();
    this.waveCursor = cursor;

    // E4/H5 — the hand was drawn in `startNextTurn` (`drawTurnHand`) so the
    // pre-turn screen could show it; here we just field it. Stamp each drawn
    // card with its `Run.team` index so `xpAwards` can carry it back at battle
    // end (the stamp is applied at handoff time, never on `this.team`).
    //
    // H6c → K1 — spawn-time fatigue is now a status effect (`fatigueEffect`),
    // seeded onto the fielded unit alongside any persistent encounter effects
    // for its slot. The Fatigued stack count is `deploymentCounts[idx]` PRIOR
    // deployments this encounter (read BEFORE the recordDeployment bump below,
    // so a debut unit reads 0 stacks → no effect). INERT at the shipped knob
    // (`fatigueEffect` returns null) — no effect seeded, byte-identical. The
    // encounter effects are re-seeded each turn as `endOfTurn` (the
    // `endOfEncounter` store). `this.team`'s canonical templates are never
    // touched (the stamp is a transient per-turn copy).
    const stampedPlayerTeam = this.hand.map((idx) => {
      const t = this.team[idx]!;
      const seedEffects: StatusEffect[] = this.encounterEffects[idx]!.map(cloneEffect);
      const fatigue = fatigueEffect(this.deploymentCounts[idx]!);
      if (fatigue) seedEffects.push(fatigue);
      return {
        ...t,
        rosterIndex: idx,
        ...(seedEffects.length > 0 ? { effects: seedEffects } : {}),
      };
    });
    // H3 — record this turn's deployment (the drawn hand). The deployment
    // counter finally varies per turn here (pre-H5 it was the whole roster).
    this.recordDeployment(this.hand);
    const battleEncounter: BattleEncounter = {
      worldSeed,
      terrainSeed,
      layoutId,
      gridW,
      gridH,
      theme,
      // 83d — the pull's boss gate rides the encounter (see the interface note).
      kind: encounter.kind,
      playerTeam: stampedPlayerTeam,
      enemyTeam,
      // 47f — the owned daemons' battle hooks, compiled fresh each turn
      // (ownership can grow mid-encounter via addDaemon: a §48 reward daemon
      // fights from the NEXT turn, matching the grant-resolution rule).
      // 49e — packet-injected rules union in AFTER the daemon rules
      // (daemons → run-injected → encounter-injected, fire order within
      // each); a pre-turn injection is live this very turn (beginTurn runs
      // after the gate).
      // 51f — the injected entries strip to their plain rules at the seam
      // (the sim never sees the provenance wrapper).
      battleRules: [
        ...battleRulesFor(this.daemons),
        ...this.injectedRunRules.map((e) => e.rule),
        ...this.injectedEncounterRules.map((e) => e.rule),
      ],
    };
    this.currentEncounter = battleEncounter;
    // 53b — the payload carries the whole fixture for the trace recorder.
    this.bus.emit('battle:started', { worldSeed, encounter: battleEncounter });
  }

  /**
   * Hop index of the current node. Public so UI surfaces (HUD) can label
   * the active battle's depth without duplicating the node-lookup logic.
   */
  get currentHop(): number {
    return this.hopOf(this.currentNodeId);
  }

  /**
   * 84b — node entries still AHEAD of the run. The rest of the current
   * sector's node-map (every node is one entry — hops 0..L−1, so a
   * pre-root run has all L ahead and a run at hop h has L−1−h; read off
   * the LIVE map, so a `hopCount` probe's shortened map counts as built)
   * plus the shortest remaining path over the sector DAG, each future
   * sector at its full length (`sectorHops` overrides every sector's;
   * a `hopCount` probe's terminal IS the run terminal, so it adds
   * nothing). DERIVED, never serialized (derive-don't-cache): the §84
   * instrument's per-remaining-hop normalization and the §85 prior's
   * state scaling read it. Pre-root-safe by construction (gotcha #110).
   */
  get hopsRemaining(): number {
    const length = this.nodeMap.hops.length;
    const inSector =
      this.currentNodeId === PRE_ROOT_NODE_ID ? length : length - 1 - this.currentHop;
    if (this.singleSectorRun) return inSector;
    return (
      inSector +
      remainingSectorHops(this.sectorMap, this.currentSectorNodeId, (id) => {
        const sector = getSector(id);
        if (!sector) throw new Error(`Run.hopsRemaining: sector "${id}" not found`);
        return this.sectorHopsOverride ?? sector.length;
      })
    );
  }

  private hopOf(nodeId: number): number {
    const node = this.nodeMap.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Run.hopOf: no node ${nodeId} in map`);
    return node.hop;
  }

  /** G3 — node kind, for the rest/battle dispatch + the post-promotion route. */
  private kindOf(nodeId: number): NodeKind {
    const node = this.nodeMap.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Run.kindOf: no node ${nodeId} in map`);
    return node.kind;
  }

  /**
   * H4 — a turn's tactical battle just ended (`battle:ended`). Resolve the turn
   * into the health pools, then either start the next turn or finish the
   * encounter. Replaces the pre-H4 single-battle handler: a `battle:ended` no
   * longer ends the node — it ends a TURN.
   */
  private handleTurnEnded(
    winner: GameEvents['battle:ended']['winner'],
    xpAwards: GameEvents['battle:ended']['xpAwards'],
    survivorPower: GameEvents['battle:ended']['survivorPower'],
    tallies: GameEvents['battle:ended']['tallies'],
    campKills?: GameEvents['battle:ended']['campKills'],
    reason?: GameEvents['battle:ended']['reason'],
    fallenPower?: GameEvents['battle:ended']['fallenPower'],
  ): void {
    if (this.phase !== 'battle') return;
    this.currentEncounter = null;
    // `survivorPower` / `fallenPower` / `reason` are absent only from test
    // fakes that drive the phase machine without a real World (every real
    // emit sets all three, §91a1): absent power is 0/0 (no charge on that
    // half); an absent reason maps the way pre-§91a1 emitters meant it — a
    // fake 'draw' was the driver's cap, anything else decisive.
    const sp = survivorPower ?? { player: 0, enemy: 0 };
    const fp = fallenPower ?? { player: 0, enemy: 0 };
    const why: TurnEndReason = reason ?? (winner === 'draw' ? 'cap' : 'decisive');
    const applied = this.resolveTurn(why, sp, fp);
    // 115a — on both paths, so a gated and a headless run save the same state.
    this.lastTurn = { winner, reason: why };
    const result = this.turnResult();
    // M1 — bank THIS turn's XP at the boundary (pre-M1: accrued across the
    // encounter, banked once at the end), so a mid-encounter level-up fields
    // a stronger unit on the very next turn. A losing turn skips the bank:
    // defeat is terminal, so the levels would be dead state, and a level-up
    // pause in front of the defeat screen would be noise.
    if (result !== 'lost') {
      const promotions = this.bankXpAwards(xpAwards);
      if (promotions.length > 0) this.pendingPromotions = promotions;
      const portions: RewardPortion[] = [];
      // 47f→51a — the turn's battle-earned bits (the World's serialized
      // tally, the XP pattern) become a DECLINABLE reward portion instead of
      // settling directly (the §51 user call): the offer rides the existing
      // turn-gate seam, so a mid-encounter tally now interposes the reward
      // phase between turns. The settle moved with it — `gainBits` fires at
      // ACCEPT time (`handleAcceptReward`), so the `bitsGain` fold still
      // applies and Laverna still stacks with Moneta. SOURCE-LABELED when
      // exactly one owned daemon authors battle-bits hooks (the aggregate
      // tally can't split across several earners). The tally portion leads
      // the offer — earned in the fight, ahead of the rolled loot. Mirrors
      // the XP bank's skip-on-lost: a defeat's loot is dead state.
      if (tallies !== undefined && tallies.bits > 0) {
        // 51f — the earner pool spans BOTH rule sources: daemon battle-bits
        // hooks (dis-pater, laverna) and packet-injected gainBits rules
        // (no shipped instance since 88c). Dedup by id — two copies of the
        // same idol are still ONE earner; two distinct ids are two, and the
        // label drops (the aggregate tally can't attribute).
        const earners = new Set(battleBitsDaemonIds(this.daemons));
        for (const entry of [...this.injectedRunRules, ...this.injectedEncounterRules]) {
          if (entry.rule.effect.op === 'gainBits') earners.add(entry.sourceId);
        }
        portions.push(
          earners.size === 1
            ? { kind: 'bits', base: tallies.bits, source: [...earners][0]! }
            : { kind: 'bits', base: tallies.bits },
        );
      }
      // §75g — camp-kill loot: every camp the PLAYER wiped this turn pays
      // its def's reward refs at the boundary REGARDLESS of the battle's
      // winner (the shape-lock's 51a-precedent call: withholding would
      // double-punish the detour that caused a lost battle); only the
      // run-terminal `result === 'lost'` skips, like the XP bank above. An
      // enemy-killed camp pays nothing — credit denial IS the player's
      // loss (the payload's killedBy filter). Rolls ride the two existing
      // reward streams (no new fork — a camp-free turn draws nothing), and
      // sit between the tally and the win roll: earned in the fight, ahead
      // of the encounter loot.
      // 77d2 — ONE turn-boundary reward occurrence: camp-kill loot + the
      // won-branch encounter loot ride the same two derived streams, keyed
      // (sectorIndex, nodeId, turnIndex) — the boundary is atomic.
      const rewardRng = this.streamRng('reward', this.sectorIndex, this.currentNodeId, this.turnIndex);
      const rewardBitsRng = this.streamRng('rewardBits', this.sectorIndex, this.currentNodeId, this.turnIndex);
      for (const kill of campKills ?? []) {
        if (kill.killedBy !== 'player') continue;
        const refs = getCamp(kill.defId)?.rewards;
        if (refs === undefined || refs.length === 0) continue;
        portions.push(
          ...rollRewards(refs, rewardTableById, this.ownedDaemonIds(), rewardRng, rewardBitsRng),
        );
      }
      // 48b — the winning boundary rolls the encounter's rewards, alongside
      // the XP/tally banking above (rolled HERE, not at the gate, so a save
      // on the turn-outcome screen already carries the exact offer). Empty
      // offer → null → `continueFromTurnGate` skips the phase entirely (the
      // `promotions.length > 0` shape). Draws ride the two dedicated reward
      // streams, so a rewards-less win perturbs nothing.
      if (result === 'won') {
        // 74b — an event's start-encounter terminal can pin the fight's
        // loot: the override refs REPLACE the encounter's own refs
        // wholesale (the spec's "predetermined reward"; 82c — the refs
        // carry their own triggers now, so a pinned fight rolls the same
        // multi-table chance mix a catalog encounter does). Cleared at
        // finishEncounter, so it can only ever apply to the fight the
        // event opened.
        const rewardRefs: readonly EncounterRewardRef[] =
          this.pendingRewardOverride ?? this.selectedEncounter?.rewards ?? [];
        portions.push(
          ...rollRewards(rewardRefs, rewardTableById, this.ownedDaemonIds(), rewardRng, rewardBitsRng),
        );
      }
      this.pendingRewards = portions.length > 0 ? portions : null;
    }
    if (this.pauseAtTurnGates) {
      // Pause at the turn-outcome gate (96.5d: no screen — Game dispatches
      // the advance itself after the battle's outro; the fuzz bot dispatches
      // it directly — the phase and the event are unchanged); the `advanceTurn`
      // resumes into the promotion pause (if any units leveled) and then
      // `continueAfterTurn`.
      this.phase = 'turn-outcome';
      this.bus.emit('turn:resolved', {
        turn: this.turnIndex,
        winner,
        // §91d — WHY the turn ended, so the outcome screen labels the chip
        // lines by the rule set the turn actually paid (`rulesForTurn`).
        reason: why,
        // §91a2 — the APPLIED losses (what each pool actually lost), not a
        // re-derivation of the rule's arithmetic (the kickoff audit's
        // second-copy finding); the uncapped charges ride pools:chipped.
        enemyPoolChip: applied.enemy,
        playerPoolChip: applied.player,
        result,
        playerHealth: this.playerHealth,
        playerHealthMax: HEALTH.playerHealthMax,
        enemyHealth: this.enemyHealth,
        enemyHealthMax: this.enemyHealthPoolMax,
        // 94d — who fell this turn + the encounter's record (turnIndex has
        // already advanced in resolveTurn: it IS the completed turn).
        fallen: this.fallenForTurn(this.turnIndex),
      });
    } else {
      // 48b headless — the gate chain (reward → promotion → continue)
      // interposes between the resolved turn and the loop continuing (the
      // gated path enters the same chain from `handleAdvanceTurn`). The
      // harness/test loop resolves each gate and re-enters.
      this.continueFromTurnGate();
    }
  }

  /**
   * 48b — the post-turn gate chain, the shape-locked ordering: reward (loot
   * while the win is fresh) → promotion → `continueAfterTurn` (next turn /
   * finishEncounter → recruit/victory). Every gate resolution re-enters this
   * chain, so the ordering holds regardless of which gate a save/reload (or
   * the gated vs headless path) lands on. `turnResult` is pure — the pools
   * don't change across the pauses — so re-reading it here routes exactly as
   * the original boundary would have (the H4b `continueAfterTurn` contract).
   * 51a: `pendingRewards` can be non-null at ANY non-lost boundary now (a
   * battle-tally portion), so the reward gate DOES interpose mid-encounter —
   * resolving it re-enters here and `continueAfterTurn('ongoing')` starts
   * the next turn as before.
   */
  private continueFromTurnGate(): void {
    if (this.pendingRewards !== null) {
      this.phase = 'reward';
      this.bus.emit('reward:offered', { rewards: this.pendingRewards.slice() });
      return;
    }
    if (this.pendingPromotions !== null) {
      this.phase = 'promotion';
      this.bus.emit('promotion:pending', { promotions: this.pendingPromotions });
      return;
    }
    this.continueAfterTurn(this.turnResult());
  }

  /**
   * H4 → §91a2 — fold one turn's outcome into the pools by the CHIP RULE
   * (`turnCharges`, src/run/chipRule.ts): each pool pays its OWN fallen
   * Σ`power` (× `chipMultiplier`), and a tick-capped turn (`reason ===
   * 'cap'`) also pays the OPPOSING side's survivors. The per-turn winner is
   * irrelevant to the charge. XP
   * banking is the caller's job (M1 — at the turn boundary, right after this
   * resolves). Returns the APPLIED loss per pool (clamped — what each pool
   * actually lost) for the post-turn screen; the uncapped charges ride
   * `pools:chipped` for the telemetry (the 89d rider).
   * Decision + continuation are split out (`turnResult`/`continueAfterTurn`) so
   * H4b's post-turn screen can show the result before the loop acts on it.
   */
  private resolveTurn(
    reason: TurnEndReason,
    survivorPower: SidePower,
    fallenPower: SidePower,
  ): { player: number; enemy: number } {
    // Unconditional, at the top: even a 0/0 mutual-wipe turn must advance the
    // counter so the max-turns safety cap can terminate the encounter.
    this.turnIndex += 1;
    const charges = turnCharges(reason, survivorPower, fallenPower);
    const playerBefore = this.playerHealth;
    const enemyBefore = this.enemyHealth;
    this.enemyHealth = Math.max(0, this.enemyHealth - charges.enemy);
    this.setPlayerHealth(this.playerHealth - charges.player, 'chip');
    // 89a — report the APPLIED deltas from the one site that applies them
    // (both paths; the telemetry's trajectory source — see events.ts), and
    // §91a2 the uncapped charges beside them.
    this.bus.emit('pools:chipped', {
      turn: this.turnIndex,
      playerBefore,
      playerAfter: this.playerHealth,
      enemyBefore,
      enemyAfter: this.enemyHealth,
      playerCharge: charges.player,
      enemyCharge: charges.enemy,
    });
    return { player: playerBefore - this.playerHealth, enemy: enemyBefore - this.enemyHealth };
  }

  /**
   * H4 — the encounter's status after the just-resolved turn, WITHOUT acting on
   * it. Precedence is fixed:
   *   1. `playerHealth <= 0` → `lost` (run-loss is terminal — checked FIRST, so
   *      a turn that zeroes BOTH pools is a defeat, not a win).
   *   2. `enemyHealth <= 0` → `won`.
   *   3. `turnIndex >= maxTurns` → safety cap: resolve by remaining pool
   *      fraction (player loses ties). Bounds an all-mutual-wipe encounter that
   *      would otherwise chip 0/0 forever.
   *   4. otherwise → `ongoing`.
   * Pure: re-reads the pools, which don't change across the turn-outcome pause,
   * so `continueAfterTurn` can recompute it at `advanceTurn` time identically.
   */
  private turnResult(): 'won' | 'lost' | 'ongoing' {
    if (this.playerHealth <= 0) return 'lost';
    if (this.enemyHealth <= 0) return 'won';
    if (this.turnIndex >= HEALTH.maxTurns) {
      const playerFrac = this.playerHealth / HEALTH.playerHealthMax;
      const enemyFrac = this.enemyHealth / this.enemyHealthPoolMax;
      return playerFrac > enemyFrac ? 'won' : 'lost';
    }
    return 'ongoing';
  }

  /**
   * H4 — act on a turn result: end the encounter (win / defeat) or roll into
   * the next turn (through the pre-turn gate). Called synchronously in the
   * headless path, or from `advanceTurn` (the post-turn screen) when gated.
   */
  private continueAfterTurn(result: 'won' | 'lost' | 'ongoing'): void {
    if (result === 'lost') {
      this.finishEncounter('defeat');
    } else if (result === 'won') {
      this.finishEncounter('win');
    } else {
      this.startNextTurn();
    }
  }

  /**
   * H4b — resume from a turn gate (the `advanceTurn` command). From
   * `turn-intro` start the turn's battle; from `turn-outcome` continue the
   * encounter (or end it). A no-op in any other phase, so a stray dispatch (a
   * double-click or a fired-then-disposed screen timer) can't corrupt state.
   */
  private handleAdvanceTurn(): void {
    if (this.phase === 'turn-intro') {
      this.phase = 'battle';
      this.beginTurn();
    } else if (this.phase === 'turn-outcome') {
      // 48b — the gate chain (reward → promotion → continue) runs AFTER the
      // outcome screen, so the result is read first (the M1 discipline,
      // generalized from the single promotion gate).
      this.continueFromTurnGate();
    }
  }

  /**
   * 49d — the grant queue as the payloads/fuzz/UI read it: one view per
   * queue entry (index = the command key), with remaining budget + the
   * derived cursor flag (`active` = first pending). Derived at call time.
   */
  grantViews(): TurnGrantView[] {
    // 49e — a grant's source id can be a PACKET now (a reroute fire inserts
    // its own entry), so the name lookup falls through to the packet catalog.
    return grantViews(
      this.turnGrants,
      (sourceId) =>
        this.daemons.find((d) => d.id === sourceId)?.name ??
        packetById(sourceId)?.name ??
        sourceId,
    );
  }

  /**
   * 49d — the strict-mode ordering guard, shared by redraw/empower: resolve
   * the targeted grant or null-reject. Legality: the entry exists, its
   * effect kind matches the command, it isn't passed, and — with
   * `passIsFinal` ON — it IS the active (first-pending) grant. Free mode
   * accepts any pending grant in any order (the shape-lock's loosened
   * fallback). Budget itself is the pure validators' check.
   */
  private targetableGrant(
    grantIndex: number,
    kind: TurnGrant['effect']['kind'],
  ): TurnGrant | null {
    const grant = this.turnGrants[grantIndex];
    if (grant === undefined || grant.effect.kind !== kind) return null;
    if (grant.passed) return null;
    if (this.passIsFinal && grantIndex !== activeGrantIndex(this.turnGrants)) return null;
    return grant;
  }

  /**
   * K3 — redraw selected hand cards at the pre-turn gate (the `redrawCards`
   * command): send them to the discard, draw replacements into the SAME hand
   * positions. 49d: the command targets ONE redraw grant (`grantIndex` into
   * the queue — strict mode requires the active one); budget validation
   * lives in the pure `redrawRejection`. Any reject is a silent no-op that
   * consumes no budget (mirrors the other phase-guarded handlers).
   *
   * Order contract: positions are processed in ASCENDING hand order, so the
   * selection's click/dispatch order never changes the outcome (determinism
   * for the fuzz redraw policy). The selected cards are discarded BEFORE the
   * draws, so the piles always hold enough to refill every selected position
   * (the reshuffle cycle may hand a just-discarded card straight back when
   * the draw pile runs dry — the deck's normal H5 recycle, accepted) and the
   * hand size is preserved.
   *
   * The deployment-counter rule (a redrawn-away unit accrues NO deployment
   * count / fatigue stack) needs no code here: `beginTurn` records only the
   * FINAL fielded hand, and this runs strictly before it.
   */
  private handleRedrawCards(handIndices: readonly number[], grantIndex: number): void {
    if (this.phase !== 'turn-intro') return;
    const grant = this.targetableGrant(grantIndex, 'redraw');
    if (grant === null || grant.effect.kind !== 'redraw') return;
    const rejection = redrawRejection(handIndices, this.hand.length, {
      used: grant.used,
      budget: grant.effect.budget,
      maxCards: grant.effect.maxCards,
    });
    if (rejection !== null) return;
    const positions = [...handIndices].sort((a, b) => a - b);
    for (const pos of positions) this.discardCard(this.hand[pos]!);
    for (const pos of positions) this.hand[pos] = this.drawCard()!;
    grant.used += 1;
    this.emitHandChanged();
  }

  /**
   * The one `turn:handRedrawn` emit site — the full re-derived hand state
   * (hand + both piles + grants + the K4 badge column), so the pre-turn
   * screen swaps everything in place from the payload. Fired by the K3
   * redraw and (65c) the packet hand ops — any pre-turn hand mutation.
   * R2 — the piles re-send because the mutation moved cards between them.
   * K4 — the badge column re-derives: a refill may seat an already-empowered
   * card, and old positions no longer line up after a splice.
   */
  private emitHandChanged(): void {
    this.bus.emit('turn:handRedrawn', {
      hand: this.hand.map((idx) => this.team[idx]!),
      drawPile: this.resolvePileForDisplay(this.drawPile),
      discardPile: this.resolvePileForDisplay(this.discardPile),
      grants: this.grantViews(),
      empowerStacks: this.empowerStacks(),
      // 96.5c — the bound moves with the hand (casualties reads the hand's
      // Σ power); re-derived off the same pure preview as turn:starting.
      // Gate-only: the preview needs the encounter's wave (a hand-changing
      // packet fired anywhere else reads 0 — no risk line is up to repaint).
      poolAtRisk: this.phase === 'turn-intro' ? this.previewPoolAtRisk() : 0,
    });
  }

  /**
   * 49d — finalize the ACTIVE grant unspent (the `passGrant` command, the
   * guided strip's Pass). Meaningful ONLY under `passIsFinal` — free mode is
   * a deliberate no-op (a "pass" there is pure UI navigation; marking state
   * would make it final by the back door). Fight ▸ needs no pass-all: the
   * queue is rebuilt at every turn start, so unspent grants simply expire.
   */
  private handlePassGrant(): void {
    if (this.phase !== 'turn-intro') return;
    if (!this.passIsFinal) return;
    const cursor = activeGrantIndex(this.turnGrants);
    if (cursor === null) return;
    this.turnGrants[cursor]!.passed = true;
    this.bus.emit('turn:grantPassed', { grants: this.grantViews() });
  }

  /**
   * K4→78c — the per-hand-position empower stack column (parallel to `hand`,
   * empty = unbuffed): each card's badge-eligible buffs on its roster slot's
   * encounter store, ONE ENTRY PER KEY (78c widened the K4 summed integer,
   * which collapsed distinct buff keys into an anonymous count and merged
   * their hover text). Derived (never stored) so it stays correct across
   * redraws and re-draws of an earlier turn's empowered card. L1: the
   * buff key comes from the DAEMON's authored empower hook (not the
   * resolved turn gate, so a chance-denied turn still badges existing
   * stacks); no empower daemon → no key → nothing badges from idols.
   */
  private empowerStacks(): EmpowerStackView[][] {
    // 47d — one badge column across ALL owned empower idols' buff keys
    // (keys are distinct per idol by authoring convention).
    const buffKeys = new Set<string>();
    for (const d of this.daemons) {
      const hook = daemonEmpowerHook(d);
      if (hook !== undefined) buffKeys.add(hook.buff.key);
    }
    // 49e — packet `applyBuff` keys badge too (a hyped/overclocked card
    // shows its stacks). Catalog-wide is safe: a key with no store presence
    // contributes nothing.
    for (const p of PACKETS) {
      if (p.effect.op === 'applyBuff') buffKeys.add(p.effect.buff.key);
    }
    // Entry order = store order (acquisition). Copies, not references — the
    // store merges IN PLACE, so an aliased entry in a retained payload would
    // silently drift (cloneEffect = the seeding path's own deep copy).
    return this.hand.map((idx) =>
      (this.encounterEffects[idx] ?? [])
        .filter((effect) => buffKeys.has(effect.key))
        .map((effect) => {
          const { key, magnitude, mods } = cloneEffect(effect);
          return { key, magnitude, mods };
        }),
    );
  }

  /**
   * R2 — resolve a deck pile (`rosterIndex` values) to templates for the
   * pre-turn pile views, in RECRUITMENT order (ascending index) rather than the
   * stored draw order, so a view shows the pile's CONTENTS without revealing the
   * next-draw sequence (the resolved "contents only, unordered" decision).
   */
  private resolvePileForDisplay(pile: readonly number[]): UnitTemplate[] {
    return [...pile].sort((a, b) => a - b).map((idx) => this.team[idx]!);
  }

  /**
   * K4 — empower one drawn card at the pre-turn gate (the `empowerUnit`
   * command): its roster slot gains the granting source's buff in the K1
   * encounter-effect store, so the buff lasts the rest of the ENCOUNTER
   * (re-seeded onto the unit each turn at deploy — `beginTurn` runs after
   * this gate, so the buff is live on the very turn it's granted). The store
   * merges by key per the buff's policy: at the shipped `merge: "add"`,
   * re-empowering the same unit on a later turn STACKS (magnitude 2 → double
   * the mods). It lands on the SLOT, not the fielded copy, so it survives
   * the card being redrawn away or benched on later turns.
   *
   * 49d: `grantIndex` targets the QUEUE (strict mode requires the active
   * grant — `targetableGrant`); budget validation lives in the pure
   * `empowerRejection`. Any reject is a silent no-op that consumes no
   * budget (mirrors `handleRedrawCards`).
   */
  private handleEmpowerUnit(handIndex: number, grantIndex: number): void {
    if (this.phase !== 'turn-intro') return;
    const grant = this.targetableGrant(grantIndex, 'empower');
    if (grant === null || grant.effect.kind !== 'empower') return;
    const rejection = empowerRejection(handIndex, this.hand.length, {
      used: grant.used,
      budget: grant.effect.budget,
    });
    if (rejection !== null) return;
    this.addEncounterEffect(this.hand[handIndex]!, empowerEffect(grant.effect.buff));
    grant.used += 1;
    this.bus.emit('turn:unitEmpowered', {
      handIndex,
      grants: this.grantViews(),
      empowerStacks: this.empowerStacks(),
    });
  }

  /**
   * 47d — append a daemon to the ownership list (the §48 reward / §50 port
   * acquisition seam). Takes effect at the NEXT turn's grant resolution —
   * a mid-turn acquisition never retro-grants the current turn. Uncapped
   * (the locked design); duplicates are the CALLER's concern (reward tables
   * + port stock exclude owned ids upstream).
   */
  addDaemon(daemon: DaemonConfig): void {
    this.daemons.push(daemon);
    // 49b — ownership feeds the cacheSize fold: a size-modifier idol changes
    // the DERIVED capacity (possibly into overflow — the forced-keep state)
    // without touching the cache list, so the cache surfaces repaint off
    // this emit too.
    this.emitCacheChanged();
  }

  /**
   * 74c — `addDaemon`'s inverse (daemons were push-only until the event
   * `removeDaemon` op). Removes by ID — duplicates can't exist (every
   * acquisition surface excludes or dedupes upstream), so first-match is
   * whole-match. Absent id = silent no-op (the caller gates with
   * `hasDaemon` when it matters). The fold side is free — every
   * `effectiveRunStats` read re-derives from `this.daemons` — but the same
   * 49b emit applies: losing a size-modifier idol can shrink the DERIVED
   * cache capacity (possibly into the 49f forced-keep state).
   */
  removeDaemon(daemonId: string): void {
    const index = this.daemons.findIndex((d) => d.id === daemonId);
    if (index === -1) return;
    this.daemons.splice(index, 1);
    this.emitCacheChanged();
  }

  /**
   * 48b — the ids the run currently owns, derived at call time (the only
   * pre-48b expression was `toJSON`'s inline map). The exclusion input for
   * reward-table sampling (and §50's port stock after it).
   */
  ownedDaemonIds(): ReadonlySet<string> {
    return new Set(this.daemons.map((d) => d.id));
  }

  /**
   * 48b — accept one pending reward portion (an index into `pendingRewards`).
   * Bits settle through `gainBits` (the fold applies NOW, at accept time —
   * so a daemon accepted earlier in this same offer already counts); a
   * daemon joins the ownership list immediately, which also means the
   * just-won encounter's `encounterEnd` hooks (fired later, in
   * `finishEncounter`) include it — accepted behavior, the loot fires for
   * the fight it dropped from (worklog §48). Outside the reward phase or
   * out-of-range: the silent no-op discipline (a double-click can't corrupt
   * state). Resolving the last portion re-enters the gate chain.
   *
   * 49c — a packet portion settles via `addPacket`, gated by the
   * DECLINE-OR-SWAP contract (spec §Cache): with room it just accepts
   * (`swapCacheIndex` ignored — the gesture doesn't exist while roomy); with
   * a FULL cache it accepts only by naming a held slot to discard first, and
   * anything else (absent / fractional / out-of-range swap index) is the
   * silent no-op — THE OFFER STAYS INTACT, so validation runs before the
   * splice. The swap's discard routes through `handleDiscardPacket` (the
   * single-mutator discipline), so a swap emits two `run:cacheChanged`
   * repaints — idempotent by payload design.
   */
  private handleAcceptReward(index: number, swapCacheIndex?: number): void {
    if (this.phase !== 'reward' || this.pendingRewards === null) return;
    const peeked = this.pendingRewards[index];
    if (peeked === undefined) return;
    if (peeked.kind === 'packet' && !this.cacheHasRoom) {
      if (!isIndex(swapCacheIndex, this.cache.length)) return;
      this.handleDiscardPacket(swapCacheIndex);
    }
    const portion = this.takePendingReward(index);
    if (portion === null) return; // unreachable after the peek — belt over suspenders
    if (portion.kind === 'bits') {
      this.gainBits(portion.base);
    } else if (portion.kind === 'daemon') {
      const daemon = daemonById(portion.daemonId);
      if (daemon === undefined) {
        // The roller only emits catalog ids (boot-asserted tables) — a miss
        // here is corruption, and loud beats a silently vanished reward.
        throw new Error(`Run.handleAcceptReward: unknown daemon id '${portion.daemonId}'`);
      }
      this.addDaemon(daemon);
    } else if (portion.kind === 'unit') {
      // 74c — the template was rolled at offer time (the port-stock shape);
      // the settle is the one roster-append chokepoint.
      this.appendRosterUnit(portion.template);
    } else if (portion.kind === 'poolHealth') {
      // 74c — the instant-op executor owns the clamp-at-max.
      this.executeInstantOps([{ op: 'healPool', amount: portion.amount }]);
    } else {
      // 49c — addPacket owns the unknown-id throw (same corruption logic).
      this.addPacket(portion.packetId);
    }
    this.afterRewardResolved();
  }

  /** 48b — decline one pending reward portion (the declinable-per-portion
   *  spec lock, `passRecruit`'s sibling). Same no-op guards as accept. */
  private handleDeclineReward(index: number): void {
    if (this.takePendingReward(index) === null) return;
    this.afterRewardResolved();
  }

  /** 48b — pop portion `index` out of the pending offer, or null when the
   *  command is stray (wrong phase / no offer / out-of-range index). */
  private takePendingReward(index: number): RewardPortion | null {
    if (this.phase !== 'reward' || this.pendingRewards === null) return null;
    const portion = this.pendingRewards[index];
    if (portion === undefined) return null;
    this.pendingRewards.splice(index, 1);
    return portion;
  }

  /** 48b — after a portion resolves: wait for the rest, or (offer drained)
   *  clear it and re-enter the gate chain (promotion next, then the
   *  recruit/victory fork via `continueAfterTurn` → `finishEncounter`). */
  private afterRewardResolved(): void {
    if (this.pendingRewards !== null && this.pendingRewards.length > 0) return;
    this.pendingRewards = null;
    this.continueFromTurnGate();
  }

  /**
   * H4 — end the encounter. On a win, bank the encounter's accrued XP ONCE
   * (so a single PromotionScene pops for the whole encounter) then take the
   * existing post-battle path (promotion → recruit, or run:victory at the
   * terminal). On defeat, the pending XP is discarded (the run is over) and we
   * route to game-over.
   *
   * E4 — banking BEFORE rolling the next step means the post-victory screens
   * already reflect updated levels/stats. Level-up rolls ride their own
   * occurrence stream; the recruit offer's is independent (77d2).
   */
  private finishEncounter(outcome: 'win' | 'defeat'): void {
    // 47e — daemon `encounterEnd` instant hooks fire FIRST, on both
    // outcomes, with the outcome as the `won` filter context (the 47b
    // matrix pins `won` to this trigger). A defeat-path heal can leave a
    // lost run with a positive pool — harmless, the run is already over.
    this.executeInstantOps(
      resolveInstantHooks(
        this.daemons,
        'encounterEnd',
        { won: outcome === 'win' },
        // 77d2 — site 2 of the 'daemon' key (end; turn slot 0).
        this.streamRng('daemon', this.sectorIndex, this.currentNodeId, 2, 0),
      ),
    );
    // K3.5 — the battlefield is encounter-scoped; drop it with the encounter.
    this.encounterMap = null;
    // U3 — the selected encounter + its wave cursor are encounter-scoped too.
    this.selectedEncounter = null;
    this.waveCursor = null;
    this.lastTurn = null;
    // 74b — an event-pinned reward table dies with its encounter (the won
    // boundary already consumed it; clearing on BOTH outcomes keeps a
    // defeat from leaking the override into a later fight).
    this.pendingRewardOverride = null;
    if (outcome === 'defeat') {
      this.phase = 'defeat';
      this.bus.emit('run:defeated', {});
      return;
    }
    // M1 — nothing left to bank here: each turn's XP (including the winning
    // turn's) was banked at its own boundary, and any final-turn promotion
    // already paused before `continueAfterTurn` routed into this win.
    this.advancePastBattle();
  }

  /**
   * E4 — common tail for "battle just resolved in player's favor and
   * the PromotionScene (if any) is done." Splits run:victory from
   * recruit:offered the same way handleBattleEnded used to.
   */
  private advancePastBattle(): void {
    if (this.currentNodeId === this.nodeMap.terminalId) {
      // T2 — a sector terminal was cleared. At a sector-DAG sink the run is WON;
      // otherwise advance to a successor sector (carrying the player pool +
      // roster — a sector is a chapter of one run, not a fresh run). 67c: the
      // shipped DAG is start → deep-end, so the non-sink branch is live play.
      // A `hopCount`-bounded probe treats ITS terminal as the run terminal
      // (the single-sector semantic) — the walk never advances.
      if (isSectorSink(this.sectorMap, this.currentSectorNodeId) || this.singleSectorRun) {
        this.phase = 'complete';
        this.bus.emit('run:victory', {});
      } else {
        this.advanceSector();
      }
    } else {
      this.phase = 'recruit';
      // G4 — recruit level tracks the TEAM (round avg + geometric bonus), not
      // the hop, so a fresh draft stays useful on a leveled roster. Post-G5:
      // the geometric bonus is drawn INDEPENDENTLY per card over a shared
      // `round(avgTeamLevel)` base, so a lucky offer shows one over-leveled
      // standout rather than boosting all cards together. Each card's level is
      // clamped to the level cap.
      const offerRng = this.streamRng('offer', this.sectorIndex, this.currentNodeId);
      const baseLevel = Math.round(avgTeamLevel(this.team));
      // 63c — offers draw from the character-governed pools + weights.
      // 64a — the slot count is the folded run stat (The Cornucopia's +1).
      this.currentOffer = rollOffer(
        offerRng,
        this.effectiveOfferSize,
        (cardRng) =>
          Math.min(
            LEVELING.levelCap,
            baseLevel + recruitLevelBonus(cardRng, RECRUITMENT.recruitBonusChance),
          ),
        this.draftPools(),
        this.character.weightOverrides,
        // 64b — the folded tier weights (the Seal's no-commons fold).
        this.effectiveRarityWeights(),
      );
      this.bus.emit('recruit:offered', { units: this.currentOffer });
    }
  }

  /**
   * T2 — advance to the next sector after clearing a (non-sink) sector terminal.
   * Picks a successor DAG node + a sector there, regenerates the node-map for
   * the new sector, and returns the run to the pre-root start so the new sector's
   * root is the next pick. The player pool + roster + deck carry across
   * unchanged (the carry-across decision); only the map + sector cursor reset.
   *
   * 67a — lands on the `sectorCleared` gate (emitting `sector:cleared`), not
   * silently on 'map': state swaps FIRST (the defeat/complete shape — the
   * screen shows a settled run), then the gate holds until
   * `dismissSectorCleared` releases to the new sector's map. The cleared
   * sector is captured pre-swap — by emit time the run only knows the
   * successor — and kept in `clearedSector` (115a) for a resumed gate.
   */
  private advanceSector(): void {
    const clearedSectorId = this.currentSectorId;
    // §90 — the seam floor: the pool is lifted to `seamHealFloor × max` at
    // the act boundary (the independent-acts frame — each act opens on a
    // known entry pool; 1.0 = a full heal, 0 = the pre-§90 carry). Applied
    // BEFORE the emit so the payload carries both sides of the seam:
    // `poolBefore` (the pre-floor value the seam-hazard instrument records)
    // and `poolAfter` (what act two opens on). `max`, never `min`: a pool
    // above the floor carries untouched. Read from HEALTH at call time — the
    // fuzz `--set` probe arm mutates the config object in place.
    const poolBefore = this.playerHealth;
    this.setPlayerHealth(
      Math.max(this.playerHealth, HEALTH.seamHealFloor * HEALTH.playerHealthMax),
      'seam',
    );
    // 77d2 — the new sector claims the next index FIRST; its three
    // sector-scoped streams key on it (the constructor's index-0 triple).
    this.sectorIndex++;
    const next = pickNextSector(
      this.sectorMap,
      this.currentSectorNodeId,
      this.streamRng('sector', this.sectorIndex),
    );
    this.currentSectorNodeId = next.sectorNodeId;
    this.currentSectorId = next.sectorId;
    this.nodeMap = generateNodeMap(
      this.streamRng('nodemap', this.sectorIndex),
      this.sectorScatterConfig,
      this.currentSectorLength(),
    );
    // 74e — the new sector's startingEvents stamp (the scatter slice never
    // carries `firstNodeKind` — that dial is first-sector-only by design).
    this.stampStartingEventRoot();
    // 66a — the NEW sector's boss pre-rolls on its own sector-scoped stream
    // (forewarning is sector-scoped: it re-rolls at every sector entry).
    const bossRoll = this.rollBossForSector(this.streamRng('boss', this.sectorIndex));
    this.bossEncounterId = bossRoll.bossEncounterId;
    this.bossEncounterMap = bossRoll.bossEncounterMap;
    // Back to the pre-root start: the new sector's root is selected like any
    // first encounter. visitedNodes are node ids from the OLD map — clear them.
    this.currentNodeId = PRE_ROOT_NODE_ID;
    this.visitedNodes.clear();
    this.phase = 'sectorCleared';
    this.clearedSector = { sectorId: clearedSectorId, poolBefore };
    this.bus.emit('sector:cleared', this.sectorClearedPayload());
  }

  /** 115a — the `sector:cleared` payload from the gate's saved facts. Nothing
   *  moves the pool while the gate holds (packets fire only pre-turn and on
   *  the map), so `poolAfter` is the live pool. */
  private sectorClearedPayload(): GameEvents['sector:cleared'] {
    const cleared = this.clearedSector!;
    return {
      clearedSectorTitle: getSector(cleared.sectorId)!.title,
      nextSectorTitle: this.currentSectorTitle,
      poolBefore: cleared.poolBefore,
      poolAfter: this.playerHealth,
    };
  }

  /**
   * 67a — release the sector-cleared gate back to the (new) sector's map. The
   * sector state already swapped in `advanceSector`; this only flips the
   * phase (the leavePort shape — Game's `phase === 'map'` fallback swaps the
   * scene). A silent no-op outside the gate.
   */
  private handleDismissSectorCleared(): void {
    if (this.phase !== 'sectorCleared') return;
    this.clearedSector = null;
    this.phase = 'map';
  }

  /**
   * Take one option at the rest gate. A rest has one option today, index 0,
   * which is the rest itself (`resolveRest`); the index is the seam for the
   * options a later round adds. Outside the `rest` phase, or with any other
   * index, a silent no-op.
   */
  private handleChooseRestOption(optionIndex: number): void {
    if (this.phase !== 'rest') return;
    if (optionIndex !== 0) return;
    this.resolveRest();
  }

  /** The pool after a rest: healed by `restHealFraction` of its max, capped
   *  at the max. `resolveRest` sets it and `restPreview` reports it. */
  private restedPool(): number {
    return Math.min(
      HEALTH.playerHealthMax,
      this.playerHealth + HEALTH.restHealFraction * HEALTH.playerHealthMax,
    );
  }

  /** What taking the rest would do now, for the rest page's effect line:
   *  how far the pool would rise (0 at a full pool) and the XP each unit
   *  banks. Null outside the `rest` phase. */
  restPreview(): { readonly heal: number; readonly xp: number } | null {
    if (this.phase !== 'rest') return null;
    return { heal: this.restedPool() - this.playerHealth, xp: LEVELING.restXp };
  }

  /**
   * G3 — apply a rest (the rest gate's option; no battle). Synthesize a flat
   * `LEVELING.restXp` award per roster slot and feed the SAME `bankXpAwards`
   * pipeline a battle win uses (it reads only `rosterIndex` + `xpGained`), so
   * a rest can legitimately level units and pop PromotionScene — no parallel
   * leveling path. A rest never offers a recruit: with promotions we pause on
   * PromotionScene (the dismiss routes back to map via `kindOf`), otherwise we
   * return to the map silently (Game swaps MapScene on `phase === 'map'`).
   */
  private resolveRest(): void {
    // H6a — a rest also heals the run-wide player pool (capped at max).
    // Unconditional + ahead of the XP/promotion branch so a rest that ALSO
    // levels a unit still heals. §90 — a FRACTION of max (0.25 × 20 = the
    // old absolute 5), so the heal tracks a pool-max move; packet heals stay
    // absolute (`healPool` ops).
    this.setPlayerHealth(this.restedPool(), 'rest');
    const awards = this.team.map((_, i) => ({
      unitId: i,
      rosterIndex: i,
      damageDealt: 0,
      xpGained: LEVELING.restXp,
    }));
    const promotions = this.bankXpAwards(awards);
    if (promotions.length > 0) {
      this.phase = 'promotion';
      this.pendingPromotions = promotions;
      this.bus.emit('promotion:pending', { promotions });
    } else {
      this.phase = 'map';
    }
  }

  private handleDismissPromotion(): void {
    if (this.phase !== 'promotion') return;
    this.pendingPromotions = null;
    // M1 — a battle-sourced promotion fires at the TURN boundary, while the
    // encounter is still live (`encounterMap` set — cleared only in
    // `finishEncounter`, and rest nodes never set it, so it cleanly
    // discriminates the turn loop from the G3 rest path below). Re-enter the
    // loop: the recomputed `turnResult` routes to the next turn or into
    // `finishEncounter` (a won final turn → recruit/victory as before).
    if (this.encounterMap !== null) {
      this.continueAfterTurn(this.turnResult());
      return;
    }
    // G3 — a rest-node promotion returns to the map (no recruit). A battle's
    // promotion is dismissed inside its encounter (above), so no other node
    // reaches here.
    if (this.kindOf(this.currentNodeId) !== 'rest') {
      throw new Error('Run.handleDismissPromotion: a promotion outside an encounter, on a node that is not a rest');
    }
    this.phase = 'map';
  }

  /**
   * E4 — apply an award batch to `this.team`, returning any promotion
   * deltas for PromotionScene. For each award:
   *   1. Find the roster template via `rosterIndex` (skip if null — a
   *      test fixture spawn that didn't stamp the field).
   *   2. Add `xpGained` to the template's banked XP.
   *   3. While banked >= `xpToNext(level)` AND level < cap: spend the
   *      threshold, level up, roll new stats via `simulateLevelUps(1)`
   *      against the call's 'levelup' occurrence stream. At cap, drain any
   *      remaining banked XP (no infinite-grind overflow).
   *   4. Write the new template back into the roster slot.
   *
   * Deterministic ordering: awards are iterated as received from the
   * event payload, which World produces in unit-iteration order. RNG
   * draws come off the occurrence stream in that same order, and the
   * whole batch is synchronous (atomic between snapshots).
   */
  private bankXpAwards(
    awards: GameEvents['battle:ended']['xpAwards'],
  ): PromotionInfo[] {
    // 77d2 — one banking call = one 'levelup' occurrence, keyed
    // (sectorIndex, nodeId, turnIndex): award iteration order is
    // deterministic (World's unit-iteration order), and the whole batch is
    // synchronous — a snapshot can't land inside it.
    const levelupRng = this.streamRng('levelup', this.sectorIndex, this.currentNodeId, this.turnIndex);
    const promotions: PromotionInfo[] = [];
    for (const award of awards) {
      if (award.rosterIndex === null) continue;
      const idx = award.rosterIndex;
      const template = this.team[idx];
      if (!template) continue;
      const oldLevel = template.level;
      const oldStats = template.stats;
      let xp = template.xp + award.xpGained;
      let level = template.level;
      let stats = template.stats;
      // `xpToNext` returns Infinity at the cap, so the loop naturally
      // exits there — the explicit cap drain below covers the
      // "leftover xp at cap" edge case.
      while (level < LEVELING.levelCap && xp >= xpToNext(level)) {
        xp -= xpToNext(level);
        level += 1;
        stats = simulateLevelUps(
          stats,
          growthRatesForArchetype(template.archetype as Archetype),
          1,
          levelupRng,
        );
      }
      if (level >= LEVELING.levelCap) xp = 0;
      this.team[idx] = { ...template, xp, level, stats };
      if (level > oldLevel) {
        promotions.push({
          rosterIndex: idx,
          archetype: template.archetype,
          glyph: glyphForArchetype(template.archetype),
          oldLevel,
          newLevel: level,
          oldStats,
          newStats: stats,
        });
      }
    }
    return promotions;
  }

  private handleChooseRecruit(unitTemplate: UnitTemplate): void {
    if (this.phase !== 'recruit') return;
    // 115c — only a card of the offer joins; anything else is a silent
    // no-op, like every other illegal command (any template used to be
    // accepted). Compared by value: a journal's replay and a resumed
    // screen send copies of the offer's templates, not the objects.
    const chosen = JSON.stringify(unitTemplate);
    if (!(this.currentOffer ?? []).some((t) => JSON.stringify(t) === chosen)) return;
    this.appendRosterUnit(unitTemplate);
    this.currentOffer = null;
    this.phase = 'map';
  }

  /**
   * 50d — THE roster-append chokepoint, `removeRosterUnit`'s inverse: every
   * way a unit joins the roster (post-battle recruit, port buy) pushes the
   * unit AND its slot in each parallel structure here, in one place.
   * (Extracted from `handleChooseRecruit` when port buys became the second
   * caller.)
   */
  private appendRosterUnit(unitTemplate: UnitTemplate): void {
    this.team.push(unitTemplate);
    // H3 — keep the deployment counter parallel to the roster. A fresh
    // recruit hasn't been deployed in the current encounter yet.
    this.deploymentCounts.push(0);
    // K1 — keep the encounter-effect store synced with `team` (fresh slot, no
    // effects). Parallel to the deploymentCounts append above.
    this.encounterEffects.push([]);
    // 49e — the pending store stays parallel to `team` too.
    this.pendingEncounterEffects.push([]);
  }

  /**
   * H6b — decline the offer. `handleChooseRecruit`'s sibling MINUS the
   * roster/deck mutation: drop the offer and return to the map, leaving the
   * team (and its parallel `deploymentCounts`) untouched.
   */
  private handlePassRecruit(): void {
    if (this.phase !== 'recruit') return;
    this.currentOffer = null;
    this.phase = 'map';
  }

  /**
   * 50b — THE roster-shrink chokepoint (spec §Ports): the only code allowed
   * to remove a roster unit, inverting `handleChooseRecruit`'s appends in
   * one place. The roster has only ever GROWN before this; SIX structures
   * are keyed by / aligned with roster indices (the §50 kickoff audit — the
   * spec's five plus 49e's `pendingEncounterEffects`), so a removal must:
   *
   * - splice the three parallel arrays (`deploymentCounts`,
   *   `encounterEffects`, `pendingEncounterEffects`) in lockstep with
   *   `team`;
   * - renumber the three deck piles (they hold rosterIndex VALUES): drop
   *   the removed index, shift every higher value down one. Renumbering is
   *   UNCONDITIONAL even though map-phase piles are semantically dead
   *   (rebuilt at the next `beginEncounter`) — the serialized invariant
   *   (every pile value < team.length) must not depend on call-site phase
   *   (worklog §50).
   *
   * Map-, port- or event-phase-only (50d widened it for the pay-to-remove
   * service; 74c for the event `removeUnit` op — gotcha #118's guard, third
   * window): outside those windows roster indices are live in places a
   * splice can't reach (a battle's `playerRosterIds` stamp, un-banked
   * `xpAwards`, `pendingPromotions`) — throwing beats a silent desync. The
   * event window is as safe as the map's: no encounter state exists
   * mid-event, and effects run BEFORE a start-encounter terminal routes.
   * `pendingPromotions` is structurally null here (non-null only during
   * 'promotion'). The roster can't be emptied — a zero-unit run has no deck
   * to draw. Emits nothing: the command wrapper owns eventing, and roster
   * UI re-derives from the live roster on render.
   */
  removeRosterUnit(index: number): void {
    if (this.phase !== 'map' && this.phase !== 'port' && this.phase !== 'event') {
      throw new Error(
        `removeRosterUnit: only legal at the map, a port or an event (phase '${this.phase}')`,
      );
    }
    if (!isIndex(index, this.team.length)) {
      throw new Error(
        `removeRosterUnit: index ${index} out of range (roster size ${this.team.length})`,
      );
    }
    if (this.team.length <= 1) {
      throw new Error('removeRosterUnit: cannot remove the last roster unit');
    }
    this.team.splice(index, 1);
    this.deploymentCounts.splice(index, 1);
    this.encounterEffects.splice(index, 1);
    this.pendingEncounterEffects.splice(index, 1);
    const renumber = (pile: number[]): number[] =>
      pile.filter((v) => v !== index).map((v) => (v > index ? v - 1 : v));
    this.hand = renumber(this.hand);
    this.drawPile = renumber(this.drawPile);
    this.discardPile = renumber(this.discardPile);
  }

  private isFrontier(nodeId: number): boolean {
    // S2 — at the pre-root start the root is the sole frontier; thereafter the
    // frontier is the current node's outgoing edges.
    if (this.currentNodeId === PRE_ROOT_NODE_ID) return nodeId === this.nodeMap.rootId;
    for (const e of this.nodeMap.edges) {
      if (e.from === this.currentNodeId && e.to === nodeId) return true;
    }
    return false;
  }

  /**
   * H3 — zero every deployment count. Called at encounter start. Public
   * because it's the seam the H4 encounter loop drives (reset once per
   * encounter, before the first turn).
   */
  resetDeploymentCounts(): void {
    this.deploymentCounts.fill(0);
  }

  /**
   * K1 — clear every slot's encounter-effect store. Called at encounter start
   * (alongside `resetDeploymentCounts`) so `endOfEncounter` effects don't leak
   * into the next encounter. A fresh `[]` per slot keeps the array length
   * synced with `team`.
   */
  resetEncounterEffects(): void {
    for (let i = 0; i < this.encounterEffects.length; i++) this.encounterEffects[i] = [];
  }

  /**
   * 49e — land the pending out-of-battle buffs (overclock fires) on the live
   * encounter store, then clear the pending slots. Called from
   * `beginEncounter` RIGHT AFTER `resetEncounterEffects` (the pending-until-
   * start ordering — the buff must survive the K1 wipe, not precede it).
   * The instances MOVE into the live store (merge-by-key applies), so no
   * clone is needed — the pending slot is emptied in the same pass.
   */
  private drainPendingEncounterEffects(): void {
    for (let i = 0; i < this.pendingEncounterEffects.length; i++) {
      for (const effect of this.pendingEncounterEffects[i]!) {
        this.addEncounterEffect(i, effect);
      }
      this.pendingEncounterEffects[i] = [];
    }
  }

  /**
   * H3 — bump the deployment count for each deployed roster slot. Called
   * once per turn with the slots that were actually deployed (pre-H5 that's
   * the whole roster; H5 passes the drawn hand). Out-of-range indices are
   * ignored so a stale hand can't write past the array. Public for the
   * same reason as `resetDeploymentCounts` — the H4 turn loop calls it.
   */
  recordDeployment(rosterIndices: readonly number[]): void {
    for (const idx of rosterIndices) {
      if (idx >= 0 && idx < this.deploymentCounts.length) {
        this.deploymentCounts[idx]! += 1;
      }
    }
  }

  /**
   * K1 — add an encounter-scoped status effect to a roster slot (the
   * `endOfEncounter` authoring lifetime). It persists for the rest of the
   * encounter, re-seeded onto the fielded unit each turn at deploy, merged by
   * key per its policy. Pass an `endOfTurn`-lifetime effect (the store re-seeds
   * it per turn). Out-of-range slots are ignored. The daemon / empower seam
   * (K4 / L); reset at encounter start (`resetEncounterEffects`).
   */
  addEncounterEffect(rosterIndex: number, effect: StatusEffect): void {
    const list = this.encounterEffects[rosterIndex];
    if (list === undefined) return;
    mergeEffectInto(list, effect);
  }

  /**
   * H5 — draw the turn's hand from the deck. Pulls from the end of
   * `drawPile`; when it empties mid-draw, the `discardPile` is shuffled back in
   * and drawing continues. Stops early only when BOTH piles are exhausted (a
   * roster smaller than the draw amount simply fields everyone). Returns the
   * drawn `rosterIndex` values; the caller seats them in `this.hand`.
   * 65a — the target is `effectiveDrawAmount` (the fold; base = the H5
   * `DECK.handSize`), so persistent daemon modifiers move it.
   */
  private drawHand(): number[] {
    const hand: number[] = [];
    while (hand.length < this.effectiveDrawAmount) {
      const card = this.drawCard();
      if (card === undefined) break; // deck fully dealt this turn
      hand.push(card);
    }
    return hand;
  }

  /**
   * 65f — discard ONE card (the `drawCard` mirror): push to the discard
   * pile + the per-card cue, so every discard route (the turn-start hand
   * recycle, a redraw send-off, a Cull) emits from one site. Cue-not-truth
   * (the events.ts contract); draws no RNG.
   */
  private discardCard(rosterIndex: number): void {
    this.discardPile.push(rosterIndex);
    this.bus.emit('deck:cardDiscarded', {
      drawPile: this.drawPile.length,
      discardPile: this.discardPile.length,
    });
  }

  /**
   * K3 — draw ONE card (factored out of `drawHand`, byte-identical pop +
   * reshuffle order, so the turn draw is unchanged): pop from `drawPile`,
   * reshuffling the discard back in when it's empty (the only RNG draw in the
   * deck cycle, off a fresh counter-keyed 'deck' occurrence). `undefined` only when BOTH piles
   * are exhausted. Shared by the turn draw and the redraw refill.
   */
  private drawCard(): number | undefined {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length === 0) return undefined;
      this.drawPile = this.discardPile;
      this.discardPile = [];
      this.streamRng('deck', this.deckShuffleIndex++).shuffle(this.drawPile);
      // 65f — the reshuffle cue (one event for the whole flip; post-flip,
      // pre-pop counts). Cue-not-truth: see the events.ts contract.
      this.bus.emit('deck:reshuffled', {
        drawPile: this.drawPile.length,
        discardPile: 0,
      });
    }
    // The pile is guaranteed non-empty here (the guard above returned or
    // reshuffled), so the pop always yields a card.
    const card = this.drawPile.pop()!;
    // 65f — the per-card draw cue (post-pop counts; cue-not-truth).
    this.bus.emit('deck:cardDrawn', {
      drawPile: this.drawPile.length,
      discardPile: this.discardPile.length,
    });
    return card;
  }

  /**
   * 115a — re-emit the gate event of the phase the run is in, so a run
   * loaded from a save mounts the screen it was saved at: Game mounts every
   * screen from these events. The payload is the one the live run emitted
   * on arriving at the gate, rebuilt from saved state. `map` has no event
   * (Game routes it by the phase). `battle` and `turn-outcome` are not gates
   * a run is saved at, and throw.
   */
  resume(): void {
    switch (this.phase) {
      case 'map':
        return;
      case 'port':
        this.bus.emit('port:entered', { nodeId: this.currentNodeId });
        return;
      case 'event':
        this.bus.emit('event:entered', {
          nodeId: this.currentNodeId,
          eventId: gateState(this.activeEvent, 'event', 'activeEvent').eventId,
        });
        return;
      case 'rest':
        this.bus.emit('rest:entered', { nodeId: this.currentNodeId });
        return;
      case 'turn-intro':
        this.bus.emit('turn:starting', this.turnStartingPayload());
        return;
      case 'reward':
        this.bus.emit('reward:offered', {
          rewards: gateState(this.pendingRewards, 'reward', 'pendingRewards').slice(),
        });
        return;
      case 'promotion':
        this.bus.emit('promotion:pending', {
          promotions: gateState(this.pendingPromotions, 'promotion', 'pendingPromotions'),
        });
        return;
      case 'recruit':
        this.bus.emit('recruit:offered', { units: gateState(this.currentOffer, 'recruit', 'currentOffer') });
        return;
      case 'sectorCleared':
        gateState(this.clearedSector, 'sectorCleared', 'clearedSector');
        this.bus.emit('sector:cleared', this.sectorClearedPayload());
        return;
      case 'defeat':
        this.bus.emit('run:defeated', {});
        return;
      case 'complete':
        this.bus.emit('run:victory', {});
        return;
      case 'battle':
      case 'turn-outcome':
        throw new Error(`Run.resume: the '${this.phase}' phase is not a gate a run resumes at`);
    }
  }

  toJSON(): RunSnapshot {
    return {
      schemaVersion: RUN_SCHEMA_VERSION,
      // 77d2 (v42) — the keyed-derivation root + the three occurrence
      // counters replace the ten serialized RNG states (see RunSnapshot).
      streamRoot: this.streamRoot,
      sectorIndex: this.sectorIndex,
      deckShuffleIndex: this.deckShuffleIndex,
      eventStep: this.eventStep,
      // 50d — the docked stock's slots MUTATE in place (`sold`), so the wire
      // image copies each slot (the turnGrants discipline; templates stay by
      // reference — never mutated after the roll).
      portStock:
        this.portStock === null
          ? null
          : {
              units: this.portStock.units.map((s) => ({ ...s })),
              packets: this.portStock.packets.map((s) => ({ ...s })),
              daemons: this.portStock.daemons.map((s) => ({ ...s })),
            },
      // 74b — the event cursor (copied: plain flat object), the flag record
      // (copied: mutated in place by setFlag), and the pinned reward refs
      // (82c: copied per ref — the field can alias authored catalog
      // objects, and a wire image never shares structure with them).
      activeEvent: this.activeEvent === null ? null : { ...this.activeEvent },
      eventFlags: { ...this.eventFlags },
      pendingRewardOverride:
        this.pendingRewardOverride === null
          ? null
          : this.pendingRewardOverride.map((ref) => ({
              table: ref.table,
              trigger: { chance: ref.trigger.chance },
            })),
      // 47d — daemons serialize BY ID (def-resolved on load). 49d: the
      // queue's entries MUTATE in place (`used`/`passed`), so the wire image
      // copies each entry (buffs stay by reference — never mutated;
      // `empowerEffect` deep-copies mods at apply time).
      daemonIds: this.daemons.map((d) => d.id),
      // 63c — the character serializes BY ID (def-resolved on load).
      characterId: this.character.id,
      // 117b — the level; the multipliers it gives are derived on load.
      escalation: this.escalation,
      turnGrants: this.turnGrants.map((g) => ({ ...g })),
      currentSectorId: this.currentSectorId,
      currentSectorNodeId: this.currentSectorNodeId,
      nodeMap: this.nodeMap,
      // 66a — the forewarning pair: plain JSON, never mutated after the
      // roll, so it rides by reference (the encounterMap discipline).
      bossEncounterId: this.bossEncounterId,
      bossEncounterMap: this.bossEncounterMap,
      team: this.team.slice(),
      deploymentCounts: this.deploymentCounts.slice(),
      // K1 — deep-copy each slot's effect list (effects are mutated in place on
      // merge, so the wire image must not share references with the live store).
      encounterEffects: this.encounterEffects.map((slot) => slot.map(cloneEffect)),
      drawPile: this.drawPile.slice(),
      discardPile: this.discardPile.slice(),
      hand: this.hand.slice(),
      bits: this.bits,
      cache: this.cache.slice(),
      // 49e — the fire engine's stores: pending effects deep-copy like the
      // live store (merge mutates in place); rules copy per entry (never
      // mutated, but the wire image stays independent of the live arrays).
      pendingEncounterEffects: this.pendingEncounterEffects.map((slot) => slot.map(cloneEffect)),
      injectedEncounterRules: this.injectedEncounterRules.map(cloneInjectedRule),
      injectedRunRules: this.injectedRunRules.map(cloneInjectedRule),
      playerHealth: this.playerHealth,
      enemyHealth: this.enemyHealth,
      turnIndex: this.turnIndex,
      selectedEncounterId: this.selectedEncounter?.id ?? null,
      waveCursor: this.waveCursor,
      encounterMap: this.encounterMap,
      currentNodeId: this.currentNodeId,
      phase: this.phase,
      currentEncounter: this.currentEncounter,
      // 94d — row copies (flat objects; the wire image stays independent of
      // the live append-only array).
      fallenLedger: this.fallenLedger.map((r) => ({ ...r })),
      currentOffer: this.currentOffer ? this.currentOffer.slice() : null,
      visitedNodes: Array.from(this.visitedNodes),
      pendingPromotions: this.pendingPromotions
        ? this.pendingPromotions.slice()
        : null,
      // 48b — copy each portion (flat objects, mutated only by splice — the
      // copies keep the wire image independent of the live offer).
      pendingRewards: this.pendingRewards
        ? this.pendingRewards.map((p) => ({ ...p }))
        : null,
      // 115a — flat objects, copied.
      clearedSector: this.clearedSector === null ? null : { ...this.clearedSector },
      lastTurn: this.lastTurn === null ? null : { ...this.lastTurn },
    };
  }

  /**
   * Rehydrate a Run from a snapshot. Bypasses the constructor (no
   * `run:started` emit, no nodeMap regeneration) and assigns each field
   * from the snapshot, then subscribes to the bus for the live
   * `battle:ended` event. Caller supplies the bus — typically a fresh one
   * for replay-trace comparison, or the active game bus for save/load.
   *
   * 115a — `config` is the RunConfig the run was created with: the snapshot
   * doesn't carry the inputs a config sets (a run input, not state), so a
   * save of a dialed run reloads with its dials. Absent, those inputs are
   * the shipped defaults, as before (what a rollout clone wants). Only the
   * inputs read after construction apply (`resolveRunInputs`); the ones
   * that shaped construction (roster, daemon, bits, character, the
   * Escalation level, grants) are in the snapshot already, which wins.
   */
  static fromJSON(snap: RunSnapshot, bus: EventBus<GameEvents>, config?: RunConfig): Run {
    if (snap.schemaVersion !== RUN_SCHEMA_VERSION) {
      throw new Error(`Run.fromJSON: unsupported schema version ${snap.schemaVersion}`);
    }
    const run = Object.create(Run.prototype) as Run;
    type Mut = { -readonly [K in keyof Run]: Run[K] } & {
      bus: EventBus<GameEvents>;
      subscriptions: Array<() => void>;
      forcedLayoutId: string | null;
      forcedEncounterId: string | null;
      singleSectorRun: boolean;
      sectorHopsOverride: number | undefined;
      sectorScatterConfig: RunConfig | undefined;
      clearedSector: ClearedSector | null;
      lastTurn: LastTurn | null;
      difficultyMultipliers: DifficultyMultipliers;
      turnGrants: TurnGrants;
      passIsFinal: boolean;
      drawAmountAdd: number;
      sectorMap: SectorMap;
      eventFlags: Record<string, EventFlagValue>;
      pendingRewardOverride: readonly EncounterRewardRef[] | null;
      eventCatalog: readonly EventDef[];
      forcedEventId: string | null;
      rootStampedByDial: boolean;
      // 77d2 — the private occurrence counters (streamRoot is public).
      sectorIndex: number;
      deckShuffleIndex: number;
      eventStep: number;
    };
    const m = run as unknown as Mut;
    m.bus = bus;
    m.subscriptions = [];
    // Not in the save: a restore starts with the gates off, as a new run does.
    run.pauseAtTurnGates = false;
    // 115a — the config inputs, as the constructor resolves them. With no
    // config: normal procedural rolls and encounter selection, unbounded
    // full-length sectors on the shipped DAG, the shipped event catalog,
    // finality toggle and difficulty lever, no forced draw.
    const inputs = resolveRunInputs(config);
    m.sectorMap = inputs.sectorMap;
    m.forcedLayoutId = inputs.forcedLayoutId;
    m.forcedEncounterId = inputs.forcedEncounterId;
    m.eventCatalog = inputs.eventCatalog;
    m.forcedEventId = inputs.forcedEventId;
    m.singleSectorRun = inputs.singleSectorRun;
    m.sectorHopsOverride = inputs.sectorHopsOverride;
    m.sectorScatterConfig = inputs.sectorScatterConfig;
    m.rootStampedByDial = inputs.rootStampedByDial;
    m.passIsFinal = inputs.passIsFinal;
    m.drawAmountAdd = inputs.drawAmountAdd;
    // 117b — the level is the SNAPSHOT's, whatever the config says (a
    // rollout clone loads with none), and the multipliers are derived from
    // it over the config's overrides. A level off the ladder is a hard
    // reject, the daemonIds discipline: a silent fall to 0 would hand back
    // an easier run than the one saved.
    if (!isEscalationLevel(snap.escalation)) {
      throw new Error(
        `Run.fromJSON: escalation level ${String(snap.escalation)} is not on the ladder (0 to ${ESCALATION_MAX})`,
      );
    }
    m.escalation = snap.escalation;
    m.difficultyMultipliers = withEscalation(inputs.difficultyMultipliers, snap.escalation);
    // 77d2 (v42) — the root + counters restore; streams re-derive at their
    // occurrence sites (nothing else to restore — occurrences are atomic).
    m.streamRoot = snap.streamRoot;
    m.sectorIndex = snap.sectorIndex;
    m.deckShuffleIndex = snap.deckShuffleIndex;
    m.eventStep = snap.eventStep;
    // 47d — re-resolve owned daemons BY ID from the shipped catalog; an
    // unknown id (retired entry / bespoke daemon) is a hard reject, never a
    // silent drop. The CURRENT turn's resolved grants restore as-is (a save
    // at the pre-turn gate keeps its Mercury flip — never re-rolled).
    m.daemons = snap.daemonIds.map((id) => {
      const daemon = daemonById(id);
      if (daemon === undefined) {
        throw new Error(`Run.fromJSON: unknown daemon id '${id}' (not in the catalog)`);
      }
      return daemon;
    });
    // 63c — re-resolve the character BY ID (the daemonIds discipline: a
    // retired catalog entry is a hard reject, never a silent fallback —
    // silently swapping to the Soldier would rewrite the run's draft pools).
    const character = characterById(snap.characterId);
    if (character === undefined) {
      throw new Error(
        `Run.fromJSON: unknown character id '${snap.characterId}' (not in the catalog)`,
      );
    }
    m.character = character;
    // 49d — copy each queue entry (the live entries mutate in place); the
    // finality toggle is a config input (above).
    m.turnGrants = snap.turnGrants.map((g) => ({ ...g }));
    // T2 — the sector map is a config input (above). 67c: a snapshot taken
    // under a FIXTURE map and loaded without it lands on sector-node ids the
    // shipped map doesn't know (`currentSectorNodeId` isn't re-validated
    // here); shipped play's saves always come from SECTOR_MAP.
    m.currentSectorId = snap.currentSectorId;
    m.currentSectorNodeId = snap.currentSectorNodeId;
    m.nodeMap = snap.nodeMap;
    // 66a — re-validate the pre-rolled boss id against the catalog (the
    // daemonIds discipline: an unknown id is a hard reject, never a silent
    // re-roll — silently re-rolling would contradict the forewarning the
    // player already saw). The board restores as-is (plain JSON).
    if (getEncounter(snap.bossEncounterId) === undefined) {
      throw new Error(
        `Run.fromJSON: unknown boss encounter id '${snap.bossEncounterId}' (not in the catalog)`,
      );
    }
    m.bossEncounterId = snap.bossEncounterId;
    m.bossEncounterMap = snap.bossEncounterMap;
    m.team = snap.team.slice();
    m.deploymentCounts = snap.deploymentCounts.slice();
    // K1 — restore the encounter-effect store (deep copy).
    m.encounterEffects = snap.encounterEffects.map((slot) => slot.map(cloneEffect));
    m.drawPile = snap.drawPile.slice();
    m.discardPile = snap.discardPile.slice();
    m.hand = snap.hand.slice();
    // 47e — re-clamp on load: the zero floor is an invariant, not a trust
    // in the wire image (a hand-edited save can't restore a negative balance).
    m.bits = Math.max(0, snap.bits);
    // 49b — re-resolve each cached packet id against the catalog (the
    // daemonIds discipline: unknown = hard reject, never a silent drop). An
    // over-capacity cache is legal — the shrink overflow re-derives.
    m.cache = snap.cache.map((id) => {
      if (packetById(id) === undefined) {
        throw new Error(`Run.fromJSON: unknown packet id '${id}' (not in the catalog)`);
      }
      return id;
    });
    // 49e — restore the fire engine's stores (same copy discipline as
    // toJSON). Injected rules are plain data; their status refs re-validate
    // at battle setup (World.installBattleRules), never mid-tick.
    m.pendingEncounterEffects = snap.pendingEncounterEffects.map((slot) => slot.map(cloneEffect));
    m.injectedEncounterRules = snap.injectedEncounterRules.map(cloneInjectedRule);
    m.injectedRunRules = snap.injectedRunRules.map(cloneInjectedRule);
    m.playerHealth = snap.playerHealth;
    m.enemyHealth = snap.enemyHealth;
    m.turnIndex = snap.turnIndex;
    // V1 — re-resolve the held Encounter from its persisted id (the authored
    // catalog), and restore the wave cursor as-is (plain JSON, never mutated).
    m.selectedEncounter = resolveSelectedEncounter(snap.selectedEncounterId);
    m.waveCursor = snap.waveCursor;
    m.encounterMap = snap.encounterMap;
    m.currentNodeId = snap.currentNodeId;
    m.phase = snap.phase;
    m.currentEncounter = snap.currentEncounter;
    m.fallenLedger = snap.fallenLedger.map((r) => ({ ...r }));
    m.currentOffer = snap.currentOffer ? snap.currentOffer.slice() : null;
    m.visitedNodes = new Set(snap.visitedNodes);
    m.pendingPromotions = snap.pendingPromotions
      ? snap.pendingPromotions.slice()
      : null;
    // 48b — restore the pending offer, validating daemon portions against
    // the catalog (the daemonIds discipline: an unknown id is a hard reject,
    // never a silently unacceptable reward). 49c — packet portions get the
    // same treatment against the packet catalog. 74c — `unit` portions'
    // templates pass through like `team` (the port-stock rule below);
    // `poolHealth` carries only its amount.
    m.pendingRewards = snap.pendingRewards
      ? snap.pendingRewards.map((p) => {
          if (p.kind === 'daemon' && daemonById(p.daemonId) === undefined) {
            throw new Error(
              `Run.fromJSON: pending reward references unknown daemon id '${p.daemonId}'`,
            );
          }
          if (p.kind === 'packet' && packetById(p.packetId) === undefined) {
            throw new Error(
              `Run.fromJSON: pending reward references unknown packet id '${p.packetId}'`,
            );
          }
          return { ...p };
        })
      : null;
    // 74b — the event-phase state (the streams themselves re-derive — 77d2).
    // The cursor's ids re-validate against the run's catalog (the daemonIds
    // discipline; a bespoke `eventCatalog` loads only with the config that
    // names it, like bespoke daemons never); the pinned reward table
    // re-validates against the tables.
    if (snap.activeEvent !== null) {
      const eventId = snap.activeEvent.eventId;
      const eventDef = inputs.eventCatalog.find((e) => e.id === eventId);
      if (eventDef === undefined) {
        throw new Error(
          `Run.fromJSON: unknown event id '${snap.activeEvent.eventId}' (not in the catalog)`,
        );
      }
      if (!(snap.activeEvent.pageId in eventDef.pages)) {
        throw new Error(
          `Run.fromJSON: event '${snap.activeEvent.eventId}' has no page '${snap.activeEvent.pageId}'`,
        );
      }
    }
    m.activeEvent = snap.activeEvent === null ? null : { ...snap.activeEvent };
    m.eventFlags = { ...snap.eventFlags };
    for (const ref of snap.pendingRewardOverride ?? []) {
      if (rewardTableById(ref.table) === undefined) {
        throw new Error(
          `Run.fromJSON: pendingRewardOverride references unknown reward table '${ref.table}'`,
        );
      }
    }
    m.pendingRewardOverride =
      snap.pendingRewardOverride === null
        ? null
        : snap.pendingRewardOverride.map((ref) => ({
            table: ref.table,
            trigger: { chance: ref.trigger.chance },
          }));
    // 50d — the docked stock (its streams re-derive — 77d2). Packet/daemon
    // slot ids re-validate against the catalogs (the pendingRewards
    // discipline); unit templates pass through like `team`.
    m.portStock =
      snap.portStock === null
        ? null
        : {
            units: snap.portStock.units.map((s) => ({ ...s })),
            packets: snap.portStock.packets.map((s) => {
              if (packetById(s.packetId) === undefined) {
                throw new Error(
                  `Run.fromJSON: port stock references unknown packet id '${s.packetId}'`,
                );
              }
              return { ...s };
            }),
            daemons: snap.portStock.daemons.map((s) => {
              if (daemonById(s.daemonId) === undefined) {
                throw new Error(
                  `Run.fromJSON: port stock references unknown daemon id '${s.daemonId}'`,
                );
              }
              return { ...s };
            }),
          };
    // 115a — the two gate facts; the cleared sector re-validates against the
    // catalog (its title is resolved from it at the gate).
    if (snap.clearedSector !== null && getSector(snap.clearedSector.sectorId) === undefined) {
      throw new Error(
        `Run.fromJSON: cleared sector id '${snap.clearedSector.sectorId}' is not in the catalog`,
      );
    }
    m.clearedSector = snap.clearedSector === null ? null : { ...snap.clearedSector };
    m.lastTurn = snap.lastTurn === null ? null : { ...snap.lastTurn };
    run['subscribe']();
    return run;
  }
}

/**
 * G1 — validate a `RunConfig.forcedLayoutId` against the layout library at
 * construction (loud throw, mirroring `layoutDimensions`), so a typo'd layout
 * fails fast at run start rather than silently per-battle. Undefined → null
 * (normal procedural/layout roll); the `FORCE_PROCEDURAL` sentinel passes
 * through (M6 — force a fresh procedural map every battle).
 */
function resolveForcedLayoutId(id: string | undefined): string | null {
  if (id === undefined) return null;
  if (id === FORCE_PROCEDURAL) return FORCE_PROCEDURAL;
  if (!LAYOUT_IDS.includes(id)) {
    throw new Error(`Run: unknown forcedLayoutId="${id}" (not in LAYOUT_IDS)`);
  }
  return id;
}

/**
 * X2 — validate a `RunConfig.forcedEncounterId` against the authored catalog at
 * construction (loud throw, mirroring `resolveForcedLayoutId`), so a typo'd id
 * fails fast at run start rather than mid-run inside selection. Undefined → null
 * (normal sector-pool selection). The balance harness (`--encounter=<id>`) sets
 * it to force one encounter at every matching-kind node.
 */
function resolveForcedEncounterId(id: string | undefined): string | null {
  if (id === undefined) return null;
  if (getEncounter(id) === undefined) {
    throw new Error(`Run: unknown forcedEncounterId="${id}" (not in the encounter catalog)`);
  }
  return id;
}

/**
 * 74b — validate a `RunConfig.forcedEventId` against the run's ACTIVE event
 * catalog at construction (loud throw, mirroring `resolveForcedEncounterId`).
 * Checked against the resolved catalog — not the shipped one — so a bespoke
 * `eventCatalog` test can force its own defs.
 */
function resolveForcedEventId(id: string | undefined, catalog: readonly EventDef[]): string | null {
  if (id === undefined) return null;
  if (!catalog.some((e) => e.id === id)) {
    throw new Error(`Run: unknown forcedEventId="${id}" (not in the event catalog)`);
  }
  return id;
}

/** 115a — the config inputs a Run reads after construction. A snapshot
 *  doesn't carry them (a RunConfig is a run input), so a load takes them
 *  from the same config the run was created with. */
interface RunInputs {
  readonly sectorMap: SectorMap;
  readonly forcedLayoutId: string | null;
  readonly forcedEncounterId: string | null;
  readonly eventCatalog: readonly EventDef[];
  readonly forcedEventId: string | null;
  readonly singleSectorRun: boolean;
  readonly sectorHopsOverride: number | undefined;
  readonly sectorScatterConfig: RunConfig | undefined;
  readonly rootStampedByDial: boolean;
  readonly passIsFinal: boolean;
  readonly drawAmountAdd: number;
  readonly difficultyMultipliers: DifficultyMultipliers;
}

/**
 * 115a — resolve a RunConfig into the inputs the constructor and `fromJSON`
 * both assign, so a run loaded with its config reads what the live run read.
 * No config gives the shipped defaults. Pure of RNG. Throws on a forced id
 * the catalogs don't hold, and on `hopCount` with `sectorHops`: one says "a
 * bounded single-sector probe", the other "walk the full DAG on shortened
 * sectors", so together they contradict (67c).
 */
function resolveRunInputs(config: RunConfig | undefined): RunInputs {
  // 74b — the forced event validates against the ACTIVE catalog, so a
  // bespoke-catalog test can force its own defs.
  const eventCatalog = config?.eventCatalog ?? EVENTS;
  const inputs: RunInputs = {
    sectorMap: config?.sectorMap ?? SECTOR_MAP,
    forcedLayoutId: resolveForcedLayoutId(config?.forcedLayoutId),
    forcedEncounterId: resolveForcedEncounterId(config?.forcedEncounterId),
    eventCatalog,
    forcedEventId: resolveForcedEventId(config?.forcedEventId, eventCatalog),
    singleSectorRun: config?.hopCount !== undefined,
    sectorHopsOverride: config?.sectorHops,
    sectorScatterConfig: sectorAdvanceConfig(config),
    rootStampedByDial: config?.firstNodeKind === 'event',
    passIsFinal: config?.passIsFinal ?? DECK.grantQueue.passIsFinal,
    drawAmountAdd: config?.drawAmountAdd ?? 0,
    difficultyMultipliers: resolveDifficultyMultipliers({
      waveSize: config?.waveSizeMultiplier,
      levelBudget: config?.levelBudgetMultiplier,
      bits: config?.bitsMultiplier,
      enemyMorale: config?.enemyMoraleMultiplier,
    }),
  };
  if (config?.hopCount !== undefined && config.sectorHops !== undefined) {
    throw new Error(
      'Run: hopCount (single-sector probe) and sectorHops (shortened full walk) are mutually exclusive',
    );
  }
  return inputs;
}

/**
 * D3: pick the procedural arena's side length, uniformly in
 * `[TERRAIN.proceduralMinSize, TERRAIN.proceduralMaxSize]`. Always
 * consumes one RNG step — including on layout encounters that ignore
 * the result — so the stream advances identically regardless of
 * branch. That mirrors the gotcha #49 byte-continuity invariant the
 * sector-pool roll maintains for the layout pick.
 */
function rollProceduralSide(rng: RNG): number {
  return rng.int(TERRAIN.proceduralMinSize, TERRAIN.proceduralMaxSize);
}

function layoutDimensions(layoutId: string): { gridW: number; gridH: number } {
  const layout = getLayout(layoutId);
  if (!layout) {
    throw new Error(`Run.handleEnterNode: unknown layoutId="${layoutId}"`);
  }
  return { gridW: layout.gridW, gridH: layout.gridH };
}
