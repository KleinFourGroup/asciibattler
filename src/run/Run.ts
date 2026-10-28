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
import { avgTeamLevel, rollOffer, recruitLevelBonus, draftPoolsFor } from './Recruitment';
import {
  characterById,
  DEFAULT_CHARACTER_ID,
  type CharacterConfig,
} from '../config/characters';
import type { UnitRarity } from '../config/units';
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
 *  of one included, and the last item if rounding runs past the sum. The
 *  event's pick and a choice's outcome both use it. `sectorWalk`'s
 *  `pickWeighted` draws nothing for a list of one (gotcha #111), hence the
 *  name. */
function pickWeightedOneDraw<T>(items: readonly T[], weightOf: (item: T) => number, rng: RNG): T {
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
   * included (`pickWeightedOneDraw` above); none when forced or when none
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
    return pickWeightedOneDraw(eligible, (e) => e.weight, entryRng).def;
  }

  /**
   * Take one choice on the active page, if it may be taken (a choice that
   * may not is a no-op, `Command.ts`): draw its weighted outcome, one draw
   * with a single outcome included (`pickWeightedOneDraw` above), carry out
   * the outcome's effects in authored order, then route its `next`. An
   * effect can end the run (`damagePool`), and routing stops there.
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
    const outcome = pickWeightedOneDraw(choice.outcomes, (o) => o.weight ?? 1, choiceRng);
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
   * Start the next turn: draw its hand, resolve its grants, then with
   * `pauseAtTurnGates` on enter `turn-intro` and emit `turn:starting` for
   * the pre-turn screen (`advanceTurn` goes on), or with it off enter
   * `battle` and begin the turn. The hand is drawn before the gate so
   * `turn:starting` carries it and `beginTurn` fields it; both paths draw.
   */
  private startNextTurn(): void {
    this.drawTurnHand();
    // The daemons' `turnStart` hooks, on the `'daemon'` stream's site 1 for
    // this turn, on both paths. A chance hook (Mercury) flips its coin here.
    // The resolution is the turn's new queue, so no grant's `used` or
    // `passed` carries over.
    const resolution = resolveTurnGrants(
      this.daemons,
      this.streamRng('daemon', this.sectorIndex, this.currentNodeId, 1, this.turnIndex),
    );
    this.turnGrants = resolution.grants;
    // The walk's instant ops, executed here from its resolution: resolving
    // again would flip each coin twice (gotcha #115). Before the emit, so the
    // pre-turn screen reads their effect.
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
   * The `turn:starting` payload, whose fields `events.ts` documents, built
   * from the run's state alone, so `resume()` rebuilds the one the live run
   * emitted. Only valid at the pre-turn gate, inside an encounter, where the
   * map and the encounter are set.
   */
  private turnStartingPayload(): GameEvents['turn:starting'] {
    const { layoutId, gridW, gridH, theme } = this.encounterMap!;
    const encounter = this.selectedEncounter!;
    return {
      turn: this.turnIndex + 1,
      hop: this.currentHop,
      playerHealth: this.playerHealth,
      playerHealthMax: HEALTH.playerHealthMax,
      enemyHealth: this.enemyHealth,
      enemyHealthMax: this.enemyHealthPoolMax,
      hand: this.hand.map((idx) => this.team[idx]!),
      drawPile: this.resolvePileForDisplay(this.drawPile),
      discardPile: this.resolvePileForDisplay(this.discardPile),
      grants: this.grantViews(),
      empowerStacks: this.empowerStacks(),
      // A gate is whether the daemon has the hook at all, not this turn's
      // resolution.
      daemons: this.daemons.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        redrawGate: daemonRedrawHook(d) !== undefined,
        empowerGate: daemonEmpowerHook(d) !== undefined,
      })),
      encounter: { name: encounter.name, kind: encounter.kind },
      map: { layoutId, gridW, gridH, theme },
      drawAmount: this.effectiveDrawAmount,
      poolAtRisk: this.previewPoolAtRisk(),
      // The completed turn's number is `turnIndex`, which `resolveTurn`
      // advanced.
      lastTurn:
        this.lastTurn === null
          ? null
          : { ...this.lastTurn, fallen: this.fallenForTurn(this.turnIndex).thisTurn },
    };
  }

  /**
   * Discard the last turn's hand and draw this one, once a turn from
   * `startNextTurn`. The deck's one draw, a reshuffle, is keyed by its own
   * counter, so when the hand is drawn moves no other stream.
   */
  private drawTurnHand(): void {
    // Each card through `discardCard`, the one discard site, which cues it.
    for (const idx of this.hand) this.discardCard(idx);
    this.hand = this.drawHand();
  }

  /**
   * The run stats: `RUN_STAT_BASES` folded with the `drawAmountAdd` dial and
   * every owned daemon's `modifier` rules, at each call, so a daemon gained
   * or removed counts at once. The fold never rounds (`runStats.ts`); its
   * readers are the bits settle and the cache, offer, port and draw getters
   * below, which round or floor, the rarity weights and the event's fight
   * chance.
   */
  private effectiveRunStats(): Readonly<Record<RunStatKey, number>> {
    const mods: RunStatModifier[] = [];
    // The dial folds as a daemon's modifier would, so the hand dealt and the
    // wave's basis (`rollTurnWave`) both see it; at 0 nothing is added.
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
   * The bits an earn of `base` grants: `base` times the folded `bitsGain`
   * and the run's `bits` difficulty multiplier, rounded once. The multiplier
   * sits inside the settle, so every earn scales alike. Public because the
   * reward screen prices its bits rows with it, so what it shows is what the
   * settle grants, and a bits daemon taken from the offer reprices the rows
   * left.
   */
  effectiveBits(base: number): number {
    return Math.round(base * this.effectiveRunStats().bitsGain * this.difficultyMultipliers.bits);
  }

  /**
   * Earn bits: `effectiveBits`, then `addBits`. Every earn comes through
   * here (a daemon's instant op, an event's `gainBits`, a reward's bits
   * portion, which is how a battle's tally lands), so a `bitsGain` daemon
   * applies to all of them. A port sale's proceeds are a refund and take the
   * raw `addBits`: through this fold, a `bitsGain` above `1 / sellFraction`
   * would make every buy and sale a profit.
   */
  gainBits(base: number): void {
    this.addBits(this.effectiveBits(base));
  }

  /**
   * Spend bits: the port's buys, the unit removal and an event's bits loss
   * come through here. The affordability check is here, not at the call
   * sites, because `addBits` floors at 0, so a raw negative delta would
   * under-charge a short balance. Returns whether the spend happened; a
   * spend the balance cannot cover changes nothing and emits nothing. No
   * fold applies: a price is what it says, and `bitsGain` scales earns only.
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
   * Every write to the player's pool after construction and load: floors at
   * 0 and emits `run:poolChanged` when the value moves, whatever moved it
   * (the chip, a heal, an event's damage, a rest, the sector seam). Each
   * caller applies its own cap: a heal and a rest stop at the maximum, and
   * the seam raises a pool below its floor and leaves one above it. The chip
   * also emits `pools:chipped`, with the enemy pool and the uncapped charges.
   * `max` is read at each call, since the fuzz sweep's `--set` writes
   * `HEALTH` in place.
   */
  private setPlayerHealth(next: number, reason: PoolChangeReason): void {
    const after = Math.max(0, next);
    const before = this.playerHealth;
    this.playerHealth = after;
    if (after !== before) {
      this.bus.emit('run:poolChanged', { before, after, max: HEALTH.playerHealthMax, reason });
    }
  }

  /**
   * Every change to `bits` after construction and load: floors the balance
   * at 0 and emits `run:bitsChanged` with the delta applied after the floor,
   * only when the balance moves, so a spend of 0 or a grant rounded to 0 is
   * silent.
   */
  private addBits(delta: number): void {
    const next = Math.max(0, this.bits + delta);
    if (next === this.bits) return;
    const applied = next - this.bits;
    this.bits = next;
    this.bus.emit('run:bitsChanged', { bits: this.bits, delta: applied });
  }

  /** The packet cache's slots: the `cacheSize` fold, floored. */
  get effectiveCacheSize(): number {
    return Math.floor(this.effectiveRunStats().cacheSize);
  }

  /** The post-battle recruit offer's slots: the `recruitOfferSize` fold,
   *  floored. A port's unit count does not read it. */
  get effectiveOfferSize(): number {
    return Math.floor(this.effectiveRunStats().recruitOfferSize);
  }

  /** The port unit slots forced to legendary: the `portLegendaryOffers`
   *  fold, floored; `rollPortStock` caps it at the slot count. */
  get effectivePortLegendaryOffers(): number {
    return Math.floor(this.effectiveRunStats().portLegendaryOffers);
  }

  /**
   * The cards a turn draws: the `drawAmount` fold, floored, at most
   * `DECK.maxHandSize` (`deck.ts` says why the cap sits here) and at least
   * 1. The roster is never empty (`removeRosterUnit`), so no modifier can
   * deal an empty hand.
   */
  get effectiveDrawAmount(): number {
    return Math.max(
      1,
      Math.min(DECK.maxHandSize, Math.floor(this.effectiveRunStats().drawAmount)),
    );
  }

  /**
   * The packets held beyond the cache's size, 0 when none. An event's
   * `addPacket` on a full cache makes one, as would a fold that shrinks the
   * size (no shipped daemon moves `cacheSize`). Derived, never saved: a load
   * restores the cache and the daemons, and this follows. While it is above
   * 0 the cache overlay asks for discards.
   */
  get cacheOverflow(): number {
    return Math.max(0, this.cache.length - this.effectiveCacheSize);
  }

  /** Room for one more packet. The reward accept, the port buy, a
   *  construction grant and an event's `cacheHasRoom` condition read it. */
  get cacheHasRoom(): boolean {
    return this.cache.length < this.effectiveCacheSize;
  }

  /**
   * Add a packet to the cache. The cache saves ids, so an id not in the
   * catalog throws rather than poison a save. Fullness is the caller's: the
   * reward accept and the port buy check `cacheHasRoom` first (the reward's
   * swap discards a slot), and an event's `addPacket` keeps its grant over a
   * full cache (`cacheOverflow`). One id may fill several slots.
   */
  addPacket(packetId: string): void {
    if (packetById(packetId) === undefined) {
      throw new Error(`Run.addPacket: unknown packet id '${packetId}'`);
    }
    this.cache.push(packetId);
    this.emitCacheChanged();
  }

  /**
   * Discard one cache slot (the `discardPacket` command), at will or to
   * clear an overflow. A bad index is a no-op (`Command.ts`). Allowed in any
   * phase: the cache touches no battle, the overlay opens on any screen, and
   * an overflow must be cleared wherever it arose.
   */
  private handleDiscardPacket(cacheIndex: number): void {
    if (!isIndex(cacheIndex, this.cache.length)) return;
    this.cache.splice(cacheIndex, 1);
    this.emitCacheChanged();
  }

  /**
   * Fire one held packet (the `usePacket` command).
   *
   * - The context comes from the phase: `turn-intro` is `preTurn`, `map` is
   *   `outOfBattle`, and any other phase refuses. The packet's `usableIn`
   *   must hold it; which contexts each op allows is checked at parse
   *   (`PACKET_OP_CONTEXTS`).
   * - Every check runs before anything changes, so a refusal is a no-op that
   *   spends nothing (`Command.ts`).
   * - The effect runs, then the slot is spent, with no undo, so packets take
   *   effect in the order they are fired.
   */
  private handleUsePacket(cacheIndex: number, handIndex?: number, rosterIndex?: number): void {
    const context: UseContext | null =
      this.phase === 'turn-intro' ? 'preTurn' : this.phase === 'map' ? 'outOfBattle' : null;
    if (context === null) return;
    if (!isIndex(cacheIndex, this.cache.length)) return;
    // Every write to the cache checks the id against the catalog, as a load
    // does, so a miss here cannot happen; it is guarded anyway.
    const packet = packetById(this.cache[cacheIndex]!);
    if (packet === undefined) return;
    if (!packet.usableIn.includes(context)) return;
    // The unit target, before anything changes: before a turn a hand
    // position (as a redraw or an empower names a card), at the map a roster
    // slot. A packet with no target ignores both.
    let targetSlot: number | null = null;
    // A hand op needs the position as well as the slot, since a discard
    // splices the hand. Set only for a unit target before a turn.
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
    // Discarding the hand's last card would field an empty team, a loss
    // that looks like a misclick, so it is refused as a bad target is.
    if (effect.op === 'discardCards' && this.hand.length <= 1) return;
    // A draw at a full hand could deal nothing, so it is refused rather than
    // spent. A draw that reaches the cap partway still deals what fits.
    if (effect.op === 'drawCards' && this.hand.length >= DECK.maxHandSize) return;
    let handChanged = false;
    switch (effect.op) {
      case 'applyBuff':
        // The empower's builder (`empowerEffect`). Before a turn the buff
        // goes on the encounter's store; at the map it waits in the pending
        // store until the next encounter starts. Both merge by key, so a
        // second fire on one unit stacks as a second empower does.
        if (context === 'preTurn') {
          this.addEncounterEffect(targetSlot!, empowerEffect(effect.buff));
        } else {
          mergeEffectInto(this.pendingEncounterEffects[targetSlot!]!, empowerEffect(effect.buff));
        }
        break;
      case 'grantRedraws': {
        // Put in at the cursor, or at the end of a spent queue, so under
        // strict finality the packet's redraw is the active grant at once
        // and the grant it displaced comes next. Its source id is the
        // packet's (`grantViews` names a source from either catalog).
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
        // A copy, so the saved store shares nothing with the catalog. The
        // entry keeps its packet's id, which labels a bits tally the rule
        // earns (`handleTurnEnded`).
        (effect.duration === 'run' ? this.injectedRunRules : this.injectedEncounterRules).push({
          rule: cloneBattleRule(effect.rule),
          sourceId: packet.id,
        });
        break;
      case 'healPool':
        this.executeInstantOps([effect]);
        break;
      case 'drawCards':
        // This turn's draw: the cards join the hand, and the `drawAmount`
        // fold, and with it the wave's basis, is untouched (`runStats.ts`).
        // It stops at the cap or when the deck is dealt out, and the packet
        // is spent either way, as a heal at a full pool is.
        for (let i = 0; i < effect.count; i++) {
          if (this.hand.length >= DECK.maxHandSize) break;
          const card = this.drawCard();
          if (card === undefined) break;
          this.hand.push(card);
        }
        handChanged = true;
        break;
      case 'discardCards':
        // The targeted card goes to the discard and the hand shrinks, with no
        // refill as a redraw has.
        this.discardCard(this.hand[targetHandIndex!]!);
        this.hand.splice(targetHandIndex!, 1);
        handChanged = true;
        break;
    }
    // Spend the slot; `run:packetUsed` carries the pre-turn state derived
    // again.
    this.cache.splice(cacheIndex, 1);
    this.emitCacheChanged();
    this.bus.emit('run:packetUsed', {
      packetId: packet.id,
      context,
      playerHealth: this.playerHealth,
      grants: this.grantViews(),
      empowerStacks: this.empowerStacks(),
      // A packet that moved the pool moved the bound's cap. The preview
      // rolls the turn's wave, which exists only inside an encounter, so at
      // the map there is no bound: 0.
      poolAtRisk: this.phase === 'turn-intro' ? this.previewPoolAtRisk() : 0,
    });
    // The hand's emit goes last: the repaints above rebuild the pre-turn
    // card row without enter animations, and the screen plays its enter set
    // once, so the hand change that carries them must be the dispatch's
    // last rebuild.
    if (handChanged) this.emitHandChanged();
  }

  /** The one `run:cacheChanged` emit: a copy of the ids and the size, so a
   *  reader repaints from the payload alone. */
  private emitCacheChanged(): void {
    this.bus.emit('run:cacheChanged', {
      packetIds: this.cache.slice(),
      size: this.effectiveCacheSize,
    });
  }

  /**
   * Execute resolved instant ops: `gainBits` through `gainBits`, `healPool`
   * onto the player's pool up to its maximum. The callers resolve them (a
   * daemon walk's coins, a packet's use, a reward's heal), so this draws
   * nothing.
   */
  private executeInstantOps(ops: readonly InstantOp[]): void {
    for (const op of ops) {
      // Exhaustive, so a new `InstantOp` fails to compile here. An event's
      // ops have their own executor, `executeEventOp`.
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
   * Roll the turn's world seed and enemy wave without changing the run: the
   * turn's `'battle'` stream, keyed (sectorIndex, nodeId, turnIndex), draws
   * the seed and then the wave, the selected encounter's waves advanced one
   * turn (`waveForTurn`) and resolved to a team (`resolveWave`). The seed is
   * drawn first, so the wave's varying draw count moves nothing else. A
   * wave's stage condition reads the enemy pool's fraction as it stands.
   *
   * What it reads is saved state at the turn's boundary (the stream root,
   * the counters, the wave cursor, the enemy pool, the roster and the
   * fold), so a load rolls the same turns. `beginTurn` commits the result;
   * the risk preview rolls it before the gate and keeps only the power. The
   * two get the same wave, since a keyed stream consumes nothing from a
   * parent (gotcha #125) and nothing at the gate moves an input:
   * `removeRosterUnit` is refused there, a packet's draw changes `hand`
   * and not the fold, and a heal moves the player's pool, not the enemy's.
   * Run.test.ts pins that a preview moves nothing ("the preview derive
   * perturbs nothing") and that the gate's preview is the fielded wave's.
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
      // The basis of the wave's count and its level budget is the hand the
      // fold deals, `min(roster, effectiveDrawAmount)`, one number for
      // both, so they cannot disagree. A lasting draw modifier grows the
      // opposition with the hand; a packet's draw changes `hand` and never
      // reaches it. A daemon that moves `drawAmount` owes its description
      // the coupling ("Foes muster to match"), since nothing else tells the
      // player.
      handSize: Math.min(this.team.length, this.effectiveDrawAmount),
      waveSizeMultiplier: this.difficultyMultipliers.waveSize,
      levelBudgetMultiplier: this.difficultyMultipliers.levelBudget,
    };
    const enemyTeam = resolveWave(spec, waveContext, battleRng);
    return { worldSeed, cursor, enemyTeam };
  }

  /**
   * The pre-turn risk line: the most this turn can cost the player's pool,
   * the whole hand falling at its base power (`playerExposure`, which says
   * what the bound leaves out), capped at the pool. Carried by
   * `turn:starting`, `turn:handRedrawn` and `run:packetUsed`; display only,
   * never saved, never read by the sim.
   */
  previewPoolAtRisk(): number {
    return this.previewPoolsAtRisk().player;
  }

  /**
   * Both bounds, for the notch on each of the battle HUD's gauges: the
   * player's (`playerExposure`, capped at its pool) and the enemy's
   * (`enemyExposure` over the turn's wave, capped at its pool). In battle
   * the wave is the fielded one; before it, the one `rollTurnWave` rolls,
   * since a roll after `beginTurn` has committed the wave cursor would be
   * the next wave. Display only, never saved, never read by the sim.
   */
  previewPoolsAtRisk(): { player: number; enemy: number } {
    const enemyTeam = this.currentEncounter?.enemyTeam ?? this.rollTurnWave().enemyTeam;
    const fielded = {
      player: this.hand.reduce((sum, idx) => sum + this.team[idx]!.stats.power, 0),
      enemy: enemyTeam.reduce((sum, t) => sum + t.stats.power, 0),
    };
    return {
      player: Math.min(this.playerHealth, playerExposure(fielded)),
      enemy: Math.min(this.enemyHealth, enemyExposure(fielded)),
    };
  }

  /**
   * Begin one turn's battle: roll its world seed and wave (`rollTurnWave`)
   * and commit the wave's cursor, field the hand `startNextTurn` drew,
   * record the deployment, set `currentEncounter`, and emit
   * `battle:started`, on which `Game` mounts the battle scene and a headless
   * driver builds its World. The battlefield is the encounter's, built once
   * before its first turn.
   */
  private beginTurn(): void {
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

    // Each fielded card is a copy, never `this.team`'s template: stamped with
    // its roster index, which `xpAwards` carries back at the battle's end,
    // and seeded with its slot's encounter effects and its fatigue. Fatigue
    // counts the earlier deployments this encounter, read before this
    // turn's is recorded (`fatigue.ts`).
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
    this.recordDeployment(this.hand);
    const battleEncounter: BattleEncounter = {
      worldSeed,
      terrainSeed,
      layoutId,
      gridW,
      gridH,
      theme,
      kind: encounter.kind,
      playerTeam: stampedPlayerTeam,
      enemyTeam,
      // Compiled each turn, so a daemon taken from a turn's reward fights
      // from the next. In fire order: the daemons' rules, then the run's
      // injected rules, then the encounter's; a rule a packet injects before
      // the turn fights in it. The injected entries lose their source ids
      // here, which the sim never sees.
      battleRules: [
        ...battleRulesFor(this.daemons),
        ...this.injectedRunRules.map((e) => e.rule),
        ...this.injectedEncounterRules.map((e) => e.rule),
      ],
    };
    this.currentEncounter = battleEncounter;
    // The whole fixture rides the payload, for the trace recorder and the
    // journal's replay.
    this.bus.emit('battle:started', { worldSeed, encounter: battleEncounter });
  }

  /**
   * The current node's hop, for the battle HUD, the payloads, and the
   * encounter's and the event's picks. It throws before the first node is
   * entered (gotcha #110).
   */
  get currentHop(): number {
    return this.hopOf(this.currentNodeId);
  }

  /**
   * The node entries still ahead of the run: the rest of the current
   * sector's map (each hop one entry, so before the root all L are ahead
   * and at hop h, L − 1 − h), read off the live map, so a `hopCount` dial's
   * shorter map counts as built; plus the shortest path left over the
   * sector graph, each sector at its length (`sectorHops` overrides every
   * one). Under `hopCount` the first sector's terminal ends the run, so
   * nothing is added. Derived, never saved, and safe before the root
   * (gotcha #110). The fuzz instruments record it with each decision and
   * divide a decision's margin by it, and a run-length rollout sizes its
   * hop bound from it.
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

  /** A node's kind, for the entry's dispatch, the encounter's pick and the
   *  promotion's return. */
  private kindOf(nodeId: number): NodeKind {
    const node = this.nodeMap.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Run.kindOf: no node ${nodeId} in map`);
    return node.kind;
  }

  /**
   * A turn's battle ended (`battle:ended`), which ends the turn, not the
   * node. Charge the pools, bank the turn's XP and roll its rewards unless
   * the encounter is lost, then pause at the turn-outcome gate, or with the
   * gates off go straight on through the gate chain.
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
    // Only a test's fake leaves out `survivorPower`, `fallenPower` or
    // `reason`; the World always sets them. Absent power charges nothing,
    // and an absent reason reads a 'draw' as the cap and anything else as
    // decisive.
    const sp = survivorPower ?? { player: 0, enemy: 0 };
    const fp = fallenPower ?? { player: 0, enemy: 0 };
    const why: TurnEndReason = reason ?? (winner === 'draw' ? 'cap' : 'decisive');
    const applied = this.resolveTurn(why, sp, fp);
    // On both paths, so a gated and a headless run save the same state.
    this.lastTurn = { winner, reason: why };
    const result = this.turnResult();
    // The turn's XP banks at its boundary, so a unit that levels fights
    // stronger from the next turn. A turn that loses the encounter banks
    // nothing and rolls nothing: the defeat ends the run, so its levels and
    // loot would be dead state, and a level-up pause before the defeat
    // screen noise.
    if (result !== 'lost') {
      const promotions = this.bankXpAwards(xpAwards);
      if (promotions.length > 0) this.pendingPromotions = promotions;
      const portions: RewardPortion[] = [];
      // The bits the battle earned (the World's tally) are a reward portion
      // the player may decline, so a tally puts the reward gate between
      // turns. It settles at the accept through `gainBits`, so the
      // `bitsGain` fold applies (Laverna stacks with Moneta). It leads the
      // offer, ahead of the rolled loot.
      if (tallies !== undefined && tallies.bits > 0) {
        // The earners are the daemons with battle-bits hooks (Dis Pater,
        // Laverna) and the injected `gainBits` rules' packets (no shipped
        // packet injects one), by id: two copies of a daemon are one earner.
        // With exactly one the portion names it; with more the tally cannot
        // be split, and it names none.
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
      // A camp's loot: each camp the player wiped this turn pays its rewards
      // whoever won the battle, since withholding it would punish twice the
      // detour that lost the fight. A camp the enemy killed pays nothing,
      // which is the player's loss. Camp loot comes after the tally and
      // before the win's roll. One turn's boundary is one occurrence of the
      // two reward streams, keyed (sectorIndex, nodeId, turnIndex), which
      // the camps and the win share.
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
      // A won encounter rolls its rewards here, at the boundary rather than
      // at the gate, so the state saved at the gate holds the offer. An
      // empty offer is null, and the gate chain skips the reward phase.
      if (result === 'won') {
        // An event's `start-encounter` can name the fight's loot: its refs
        // replace the encounter's, each with its own trigger, as a catalog
        // encounter's are. Cleared at `finishEncounter`, so it applies only
        // to the fight the event opened.
        const rewardRefs: readonly EncounterRewardRef[] =
          this.pendingRewardOverride ?? this.selectedEncounter?.rewards ?? [];
        portions.push(
          ...rollRewards(rewardRefs, rewardTableById, this.ownedDaemonIds(), rewardRng, rewardBitsRng),
        );
      }
      this.pendingRewards = portions.length > 0 ? portions : null;
    }
    if (this.pauseAtTurnGates) {
      // The turn-outcome gate. No screen shows it: `Game` sends
      // `advanceTurn` after the battle's outro, and the fuzz bot at once;
      // the advance goes on through the gate chain.
      this.phase = 'turn-outcome';
      this.bus.emit('turn:resolved', {
        turn: this.turnIndex,
        winner,
        reason: why,
        // The losses applied, as each pool took them, not the rule's
        // arithmetic again; the uncapped charges ride `pools:chipped`.
        enemyPoolChip: applied.enemy,
        playerPoolChip: applied.player,
        result,
        playerHealth: this.playerHealth,
        playerHealthMax: HEALTH.playerHealthMax,
        enemyHealth: this.enemyHealth,
        enemyHealthMax: this.enemyHealthPoolMax,
        // `resolveTurn` has advanced `turnIndex`, so it is the completed
        // turn.
        fallen: this.fallenForTurn(this.turnIndex),
      });
    } else {
      // With the gates off, the gate chain runs at once; the headless loop
      // resolves each gate it stops at, which re-enters the chain.
      this.continueFromTurnGate();
    }
  }

  /**
   * The gate chain after a turn, in order: the reward (the loot while the
   * win is fresh), the promotion, then `continueAfterTurn` (the next turn,
   * or the encounter's end). Any boundary the encounter does not lose can
   * offer a reward (a tally, a camp's loot), so the reward gate can stand
   * between two turns. The reward's last resolution re-enters here and the
   * promotion's dismissal goes on to `continueAfterTurn`, so the order holds
   * on both paths and whichever gate a load lands on. `turnResult` is read
   * again here: a pause can only raise the player's pool (a `poolHealth`
   * reward), which cannot change the route, so it routes as the boundary
   * did.
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
   * Charge one turn to the pools by the chip rule (`turnCharges`, whose
   * header gives the rule), each pool floored at 0; the turn's winner does
   * not enter the charge. Returns the loss each pool took, after the floor;
   * `pools:chipped` carries those and the uncapped charges. Deciding and
   * acting on the result are apart (`turnResult`, `continueAfterTurn`) so
   * the turn-outcome gate can stand between them.
   */
  private resolveTurn(
    reason: TurnEndReason,
    survivorPower: SidePower,
    fallenPower: SidePower,
  ): { player: number; enemy: number } {
    // First and always, so a turn that charges nothing still counts toward
    // the turn cap.
    this.turnIndex += 1;
    const charges = turnCharges(reason, survivorPower, fallenPower);
    const playerBefore = this.playerHealth;
    const enemyBefore = this.enemyHealth;
    this.enemyHealth = Math.max(0, this.enemyHealth - charges.enemy);
    this.setPlayerHealth(this.playerHealth - charges.player, 'chip');
    // On both paths, from the one site that charges the pools.
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
   * The encounter's state after the turn just charged, without acting on
   * it. In order: the player's pool at 0 loses, so a turn that empties both
   * is a defeat; the enemy's at 0 wins; at `HEALTH.maxTurns` turns the
   * larger fraction of pool left wins and the player loses a tie, which
   * ends an encounter whose turns charge nothing; otherwise it goes on. It
   * reads only the pools and the turn count, so the gate chain can read it
   * again.
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
   * Act on a turn's result: end the encounter, won or lost, or start the
   * next turn. The gate chain's last step, once the reward and the
   * promotion are clear.
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
   * Go on from a turn gate (the `advanceTurn` command): from `turn-intro`
   * begin the turn's battle, from `turn-outcome` run the gate chain. A
   * no-op in any other phase (`Command.ts`), so a stray dispatch, a double
   * click or a timer that outlived its screen, changes nothing.
   */
  private handleAdvanceTurn(): void {
    if (this.phase === 'turn-intro') {
      this.phase = 'battle';
      this.beginTurn();
    } else if (this.phase === 'turn-outcome') {
      this.continueFromTurnGate();
    }
  }

  /**
   * The grant queue as the payloads, the fuzz and the screens read it: one
   * view per entry, whose index is the one a command names, with the budget
   * left and `active` on the first pending grant. Derived at each call.
   */
  grantViews(): TurnGrantView[] {
    // A source may be a packet (Reroute puts in its own grant), so the name
    // falls through to the packet catalog.
    return grantViews(
      this.turnGrants,
      (sourceId) =>
        this.daemons.find((d) => d.id === sourceId)?.name ??
        packetById(sourceId)?.name ??
        sourceId,
    );
  }

  /**
   * The grant a redraw or an empower names, or null when it may not be
   * used: the entry exists, its kind is the command's, it is not passed,
   * and with `passIsFinal` on it is the active grant. With it off any grant
   * not passed may be used, in any order. The budget is the validators'
   * check (`redrawRejection`, `empowerRejection`).
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
   * Redraw chosen hand cards at the pre-turn gate (the `redrawCards`
   * command): discard them and draw replacements into the same positions,
   * spending one use of the redraw grant `grantIndex` names
   * (`targetableGrant`). A refusal is a no-op that spends nothing
   * (`Command.ts`).
   *
   * Positions are taken in ascending order, so the order they were chosen
   * in never changes the outcome. The cards are discarded before any draw,
   * so the piles always hold enough to refill every position and the hand
   * keeps its size; when the draw pile runs dry the reshuffle may hand a
   * discarded card straight back.
   *
   * A unit redrawn away takes no deployment and no fatigue, with no code
   * here: `beginTurn` records only the hand it fields, and runs after this.
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
   * The one `turn:handRedrawn` emit, for every change to the hand before a
   * turn (a redraw, a packet's draw or discard): the hand, both piles, the
   * grants and the badges derived again, so the pre-turn screen swaps them
   * in place. The piles go again because cards moved between them, and the
   * badges because a refill may seat an empowered card and a discard moves
   * the positions.
   */
  private emitHandChanged(): void {
    this.bus.emit('turn:handRedrawn', {
      hand: this.hand.map((idx) => this.team[idx]!),
      drawPile: this.resolvePileForDisplay(this.drawPile),
      discardPile: this.resolvePileForDisplay(this.discardPile),
      grants: this.grantViews(),
      empowerStacks: this.empowerStacks(),
      // The risk bound moves with the hand. Every hand change happens at the
      // gate, where the preview has its wave; elsewhere 0.
      poolAtRisk: this.phase === 'turn-intro' ? this.previewPoolAtRisk() : 0,
    });
  }

  /**
   * Close the active grant unspent (the `passGrant` command, the pre-turn
   * strip's Pass). Only under `passIsFinal`: with it off a pass is the
   * screen's navigation, and marking the grant would make it final by the
   * back door. Starting the fight needs no pass of the rest: the queue is
   * built anew each turn, so a grant left unspent lapses.
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
   * The badge column, parallel to `hand`, whose shape `turn:starting`'s
   * doc gives. Derived at each call, so it stays right across redraws and
   * an empowered card drawn again. A daemon's buff key comes from its
   * authored empower hook, not the turn's resolution, so a turn whose coin
   * denied the grant still badges the stacks it has.
   */
  private empowerStacks(): EmpowerStackView[][] {
    // Every owned empower daemon's key; each daemon authors its own.
    const buffKeys = new Set<string>();
    for (const d of this.daemons) {
      const hook = daemonEmpowerHook(d);
      if (hook !== undefined) buffKeys.add(hook.buff.key);
    }
    // A packet's `applyBuff` key badges too. The whole catalog's, which is
    // safe: a key the store does not hold adds nothing.
    for (const p of PACKETS) {
      if (p.effect.op === 'applyBuff') buffKeys.add(p.effect.buff.key);
    }
    // In store order, which is the order gained. Copies: the store merges in
    // place, so an entry shared with a payload someone keeps would drift.
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
   * A deck pile's roster indices as templates for the pre-turn pile views,
   * in recruitment order (ascending index) rather than draw order, so a
   * view shows what the pile holds without revealing the next draw.
   */
  private resolvePileForDisplay(pile: readonly number[]): UnitTemplate[] {
    return [...pile].sort((a, b) => a - b).map((idx) => this.team[idx]!);
  }

  /**
   * Empower one hand card at the pre-turn gate (the `empowerUnit` command),
   * spending one use of the empower grant `grantIndex` names
   * (`targetableGrant`): its roster slot gains the grant's buff in the
   * encounter's store, so the buff lasts the encounter, put on the unit at
   * each turn's deploy, this turn's included, since `beginTurn` runs after
   * the gate. The store merges by key per the buff's policy: at the shipped
   * `merge: "add"`, empowering the unit again on a later turn stacks. The
   * buff is on the slot, not the fielded copy, so it outlasts the card
   * being redrawn away or left out of a later hand. A refusal is a no-op
   * that spends nothing (`Command.ts`).
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
   * Add a daemon (a reward, a port buy, an event's `addDaemon`). Its stat
   * modifiers count at once; its grant hooks from the next turn's
   * resolution and its battle rules from the next turn's battle, so an
   * acquisition never grants the turn in hand. No cap on how many. Keeping
   * out a second copy is the caller's: the reward tables and the port stock
   * leave owned daemons out, and the event op skips an owned one.
   */
  addDaemon(daemon: DaemonConfig): void {
    this.daemons.push(daemon);
    // The cache's size is a fold over the daemons, so it can move (into an
    // overflow, even) with the cache untouched; the cache repaints.
    this.emitCacheChanged();
  }

  /**
   * Remove the first daemon with `daemonId` (an event's `removeDaemon`);
   * an id not owned is a no-op, and an event gates with `hasDaemon` where
   * it matters. In play there is one copy at most; only a construction
   * grant can add a second (`RunConfig.grants`). The folds follow at once,
   * and the cache repaints, as for `addDaemon`.
   */
  removeDaemon(daemonId: string): void {
    const index = this.daemons.findIndex((d) => d.id === daemonId);
    if (index === -1) return;
    this.daemons.splice(index, 1);
    this.emitCacheChanged();
  }

  /** The owned daemons' ids, derived at each call: what the reward rolls
   *  leave out. */
  ownedDaemonIds(): ReadonlySet<string> {
    return new Set(this.daemons.map((d) => d.id));
  }

  /**
   * Accept one pending reward portion (an index into `pendingRewards`).
   * Bits settle through `gainBits` at the accept, so a daemon taken earlier
   * in the same offer counts. A daemon joins at once, so the won
   * encounter's `encounterEnd` hooks, which run later in `finishEncounter`,
   * include it: the loot works for the fight it dropped from. Out of phase
   * or a bad index is a no-op (`Command.ts`). The last portion's resolution
   * re-enters the gate chain.
   *
   * A packet portion with room in the cache is taken, `swapCacheIndex`
   * ignored. With the cache full it is taken only by naming a held slot to
   * discard first, and anything else is a no-op that leaves the offer
   * whole, so the check comes before the splice. The discard goes through
   * `handleDiscardPacket`, so a swap emits `run:cacheChanged` twice, which
   * the payload makes harmless.
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
    if (portion === null) return; // cannot happen after the peek; guarded anyway
    if (portion.kind === 'bits') {
      this.gainBits(portion.base);
    } else if (portion.kind === 'daemon') {
      const daemon = daemonById(portion.daemonId);
      if (daemon === undefined) {
        // The reward tables' daemon ids are checked at load, so a miss is
        // corruption, and throws rather than lose the reward.
        throw new Error(`Run.handleAcceptReward: unknown daemon id '${portion.daemonId}'`);
      }
      this.addDaemon(daemon);
    } else if (portion.kind === 'unit') {
      // The template was rolled with the offer, as a port's is.
      this.appendRosterUnit(portion.template);
    } else if (portion.kind === 'poolHealth') {
      // The instant ops cap the heal at the maximum.
      this.executeInstantOps([{ op: 'healPool', amount: portion.amount }]);
    } else {
      // `addPacket` throws on an unknown id.
      this.addPacket(portion.packetId);
    }
    this.afterRewardResolved();
  }

  /** Decline one pending reward portion; each portion is declined or taken
   *  alone. The same no-op checks as the accept. */
  private handleDeclineReward(index: number): void {
    if (this.takePendingReward(index) === null) return;
    this.afterRewardResolved();
  }

  /** Take portion `index` out of the pending offer, or null for a stray
   *  command (out of phase, no offer, a bad index). */
  private takePendingReward(index: number): RewardPortion | null {
    if (this.phase !== 'reward' || this.pendingRewards === null) return null;
    const portion = this.pendingRewards[index];
    if (portion === undefined) return null;
    this.pendingRewards.splice(index, 1);
    return portion;
  }

  /** After a portion resolves: wait for the rest, or with the offer empty
   *  clear it and re-enter the gate chain (the promotion, then the next
   *  turn or the encounter's end). */
  private afterRewardResolved(): void {
    if (this.pendingRewards !== null && this.pendingRewards.length > 0) return;
    this.pendingRewards = null;
    this.continueFromTurnGate();
  }

  /**
   * End the encounter: run the daemons' `encounterEnd` hooks, clear the
   * encounter's state, then on a defeat enter `defeat` and on a win go on
   * (`advancePastBattle`). No XP is left to bank: each turn's, the last
   * included, banked at its boundary, and a promotion it brought has
   * already paused.
   */
  private finishEncounter(outcome: 'win' | 'defeat'): void {
    // First, on both outcomes, with the outcome as the `won` filter, which
    // the parse allows only on this trigger; on the `'daemon'` stream's site
    // 2 for this node. A heal here can leave a lost run a pool above 0,
    // which changes nothing: the run is over.
    this.executeInstantOps(
      resolveInstantHooks(
        this.daemons,
        'encounterEnd',
        { won: outcome === 'win' },
        this.streamRng('daemon', this.sectorIndex, this.currentNodeId, 2, 0),
      ),
    );
    // The battlefield, the encounter and its wave cursor end with it.
    this.encounterMap = null;
    this.selectedEncounter = null;
    this.waveCursor = null;
    this.lastTurn = null;
    // An event's reward override too, on either outcome, so it never
    // outlives the fight it was for.
    this.pendingRewardOverride = null;
    if (outcome === 'defeat') {
      this.phase = 'defeat';
      this.bus.emit('run:defeated', {});
      return;
    }
    this.advancePastBattle();
  }

  /**
   * After a won encounter: at the sector's terminal, win the run at a sink
   * of the sector graph or go on to the next sector; anywhere else, offer
   * a recruit.
   */
  private advancePastBattle(): void {
    if (this.currentNodeId === this.nodeMap.terminalId) {
      // A sector is a chapter of one run, so the next carries the roster and
      // the pool (raised to the seam's floor). Under the `hopCount` dial the
      // first sector's terminal ends the run.
      if (isSectorSink(this.sectorMap, this.currentSectorNodeId) || this.singleSectorRun) {
        this.phase = 'complete';
        this.bus.emit('run:victory', {});
      } else {
        this.advanceSector();
      }
    } else {
      this.phase = 'recruit';
      // A recruit's level follows the team, not the hop, so a draft stays
      // useful to a leveled roster: the team's rounded mean level, plus a
      // geometric bonus drawn for each card on its own, so a lucky offer
      // shows one standout rather than lifting every card; each capped at
      // the level cap. The pools and weights are the character's, the slot
      // count and the tier weights the folds'.
      const offerRng = this.streamRng('offer', this.sectorIndex, this.currentNodeId);
      const baseLevel = Math.round(avgTeamLevel(this.team));
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
        this.effectiveRarityWeights(),
      );
      this.bus.emit('recruit:offered', { units: this.currentOffer });
    }
  }

  /**
   * Go on to the next sector after a terminal that is not a sink: raise the
   * pool to the seam's floor, pick the successor on the sector graph and a
   * sector there, build its map, roll its boss, and return to the pre-root
   * start, so its root is the next pick. The roster carries over; the deck
   * is built again at the next encounter, as at every one.
   *
   * It lands on the `sectorCleared` gate, not on `map`: the state swaps
   * first, so the screen shows a settled run, as at a defeat or a win, and
   * the gate holds until `dismissSectorCleared`. The cleared sector is
   * taken before the swap, since after it the run knows only the successor,
   * and kept in `clearedSector` for a resumed gate.
   */
  private advanceSector(): void {
    const clearedSectorId = this.currentSectorId;
    // The seam's floor (`seamHealFloor` in `health.ts`), applied before the
    // emit so the payload has both sides: `poolBefore`, which the fuzz
    // harness records at each seam, and `poolAfter`, what the next sector
    // opens on.
    const poolBefore = this.playerHealth;
    this.setPlayerHealth(
      Math.max(this.playerHealth, HEALTH.seamHealFloor * HEALTH.playerHealthMax),
      'seam',
    );
    // The new sector takes the next index first: its `'sector'`,
    // `'nodemap'` and `'boss'` streams key on it, as the constructor's do on
    // index 0.
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
    // The new root's `startingEvents` stamp. The scatter dials passed here
    // leave out `firstNodeKind`, so the dial shapes only the first sector's
    // map, though its flag still sends a later root's event to the regular
    // pool (`enterEventNode`).
    this.stampStartingEventRoot();
    // The boss is the sector's, rolled again at each entry for its warning.
    const bossRoll = this.rollBossForSector(this.streamRng('boss', this.sectorIndex));
    this.bossEncounterId = bossRoll.bossEncounterId;
    this.bossEncounterMap = bossRoll.bossEncounterMap;
    // Back to the pre-root start, so the new root is picked like a first
    // encounter; the visited ids are the old map's, so they go.
    this.currentNodeId = PRE_ROOT_NODE_ID;
    this.visitedNodes.clear();
    this.phase = 'sectorCleared';
    this.clearedSector = { sectorId: clearedSectorId, poolBefore };
    this.bus.emit('sector:cleared', this.sectorClearedPayload());
  }

  /** The `sector:cleared` payload from the gate's saved facts. Nothing moves
   *  the pool while the gate holds (a packet fires only before a turn or at
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
   * Release the sector-cleared gate to the new sector's map. The state
   * swapped in `advanceSector`; this only sets the phase, as `leavePort`
   * does, and `Game` swaps the scene on `map`. A no-op outside the gate
   * (`Command.ts`).
   */
  private handleDismissSectorCleared(): void {
    if (this.phase !== 'sectorCleared') return;
    this.clearedSector = null;
    this.phase = 'map';
  }

  /**
   * Take one option at the rest gate. A rest has one, index 0, the rest
   * itself (`resolveRest`). Out of phase or any other index is a no-op
   * (`Command.ts`).
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
   * Take the rest: heal the pool (`restedPool`), then give every roster
   * slot a flat `LEVELING.restXp` award through `bankXpAwards`, the path a
   * battle's XP takes (it reads only `rosterIndex` and `xpGained`), so a
   * rest can level units with no leveling path of its own. A rest offers no
   * recruit: with a promotion it pauses on `promotion`, whose dismissal
   * returns to the map, and otherwise it goes straight to `map`.
   */
  private resolveRest(): void {
    // The heal comes first and always, so a rest that levels a unit heals
    // too.
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

  /** Dismiss the promotion screen (the `dismissPromotion` command): inside
   *  an encounter go on with the gate chain, after a rest return to the
   *  map. A no-op out of phase (`Command.ts`). */
  private handleDismissPromotion(): void {
    if (this.phase !== 'promotion') return;
    this.pendingPromotions = null;
    // A battle's promotion comes at a turn's boundary, with the encounter
    // still on: `encounterMap` is set, cleared only in `finishEncounter`,
    // and a rest never sets it, so it tells the two apart. `turnResult`
    // routes to the next turn or the encounter's end.
    if (this.encounterMap !== null) {
      this.continueAfterTurn(this.turnResult());
      return;
    }
    // Only a rest promotes outside an encounter.
    if (this.kindOf(this.currentNodeId) !== 'rest') {
      throw new Error('Run.handleDismissPromotion: a promotion outside an encounter, on a node that is not a rest');
    }
    this.phase = 'map';
  }

  /**
   * Bank a batch of XP awards into `this.team` and return the promotions
   * for the promotion screen. Each award's XP is added to its slot's
   * template, which levels while the XP reaches `xpToNext` below the cap,
   * each level's stats rolled (`simulateLevelUps`); at the cap the XP left
   * is dropped, so it never piles up. An award without a roster slot (only
   * a test's fake sends one) is skipped.
   *
   * One call is one occurrence of the `'levelup'` stream, keyed
   * (sectorIndex, nodeId, turnIndex), drawn in the awards' order (a
   * battle's is the World's spawn order, `computeXpAwards`). The batch runs
   * at once, so no save lands inside it.
   */
  private bankXpAwards(
    awards: GameEvents['battle:ended']['xpAwards'],
  ): PromotionInfo[] {
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
      // `xpToNext` is Infinity at the cap, so the loop stops there; the drop
      // below takes the XP left over.
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
    // Only a card of the offer joins; anything else is a no-op
    // (`Command.ts`). Compared by value: a journal's replay and a resumed
    // screen send copies of the offer's templates, not the objects.
    const chosen = JSON.stringify(unitTemplate);
    if (!(this.currentOffer ?? []).some((t) => JSON.stringify(t) === chosen)) return;
    this.appendRosterUnit(unitTemplate);
    this.currentOffer = null;
    this.phase = 'map';
  }

  /**
   * Every way a unit joins the roster (a recruit, a port buy, a reward, an
   * event's `grantUnit`, a construction grant) comes through here, which adds
   * its slot to each list kept parallel to `team`; `removeRosterUnit` is
   * the inverse (gotcha #118). A new unit has no deployments and no
   * effects.
   */
  private appendRosterUnit(unitTemplate: UnitTemplate): void {
    this.team.push(unitTemplate);
    this.deploymentCounts.push(0);
    this.encounterEffects.push([]);
    this.pendingEncounterEffects.push([]);
  }

  /** Decline the offer: drop it and return to the map, the roster
   *  untouched. */
  private handlePassRecruit(): void {
    if (this.phase !== 'recruit') return;
    this.currentOffer = null;
    this.phase = 'map';
  }

  /**
   * The only removal of a roster unit (the port's paid removal, an event's
   * `removeUnit`), `appendRosterUnit`'s inverse (gotcha #118). Six lists
   * hold roster indices, so a removal:
   *
   * - splices `deploymentCounts`, `encounterEffects` and
   *   `pendingEncounterEffects` with `team`;
   * - renumbers the three deck piles, which hold index values: the removed
   *   index goes, and every higher one drops by one. Always, though away
   *   from an encounter the piles are dead until `beginEncounter` builds
   *   them again, since the saved rule (every pile value below
   *   `team.length`) must not depend on the caller's phase.
   *
   * Only at the map, a port or an event: anywhere else roster indices live
   * where a splice cannot reach them (a battle's `playerRosterIds`, XP not
   * yet banked, `pendingPromotions`), and a throw beats a silent desync. An
   * event is as safe as the map: no encounter state exists during one, and
   * its effects run before a `start-encounter` routes. `pendingPromotions`
   * is null in all three, since a promotion is dismissed before any is
   * entered. The roster cannot be emptied, since a run with no units has no
   * deck to draw. Emits nothing itself.
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
    // Before the root the root alone is the frontier; after it, the current
    // node's outgoing edges (gotcha #110).
    if (this.currentNodeId === PRE_ROOT_NODE_ID) return nodeId === this.nodeMap.rootId;
    for (const e of this.nodeMap.edges) {
      if (e.from === this.currentNodeId && e.to === nodeId) return true;
    }
    return false;
  }

  /** Zero every deployment count, at an encounter's start
   *  (`beginEncounter`). Public for the tests. */
  resetDeploymentCounts(): void {
    this.deploymentCounts.fill(0);
  }

  /** Clear every slot's encounter effects, at an encounter's start beside
   *  `resetDeploymentCounts`, so none outlasts its encounter. A new `[]` a
   *  slot keeps the list as long as `team`. Public for the tests. */
  resetEncounterEffects(): void {
    for (let i = 0; i < this.encounterEffects.length; i++) this.encounterEffects[i] = [];
  }

  /**
   * Move the buffs packets put on units at the map into the encounter's
   * store, and empty the pending slots. `beginEncounter` calls it right
   * after `resetEncounterEffects`, so the buffs survive the reset. The
   * instances move, merging by key, so no copy is needed: the pending slot
   * is emptied in the same pass.
   */
  private drainPendingEncounterEffects(): void {
    for (let i = 0; i < this.pendingEncounterEffects.length; i++) {
      for (const effect of this.pendingEncounterEffects[i]!) {
        this.addEncounterEffect(i, effect);
      }
      this.pendingEncounterEffects[i] = [];
    }
  }

  /** Count a deployment for each slot fielded, once a turn with the hand
   *  (`beginTurn`). An index out of range is ignored, so a stale hand
   *  cannot write past the list. Public for the tests. */
  recordDeployment(rosterIndices: readonly number[]): void {
    for (const idx of rosterIndices) {
      if (idx >= 0 && idx < this.deploymentCounts.length) {
        this.deploymentCounts[idx]! += 1;
      }
    }
  }

  /**
   * Add a status effect to a roster slot's encounter store (the
   * `endOfEncounter` lifetime): it lasts the encounter, put on the fielded
   * unit at each turn's deploy, merged by key per its policy. Pass an
   * `endOfTurn` effect, since the store puts it on afresh each turn. A slot
   * out of range is ignored. An empower, a packet's buff and the pending
   * store's drain add here; `resetEncounterEffects` clears it at an
   * encounter's start.
   */
  addEncounterEffect(rosterIndex: number, effect: StatusEffect): void {
    const list = this.encounterEffects[rosterIndex];
    if (list === undefined) return;
    mergeEffectInto(list, effect);
  }

  /**
   * Draw the turn's hand, `effectiveDrawAmount` cards, from the end of
   * `drawPile`, the discard shuffled back in when it runs out. It stops
   * early only when both piles are empty, so a roster smaller than the draw
   * fields everyone. Returns the roster indices; the caller seats them in
   * `this.hand`.
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
   * Discard one card, `drawCard`'s mirror: onto the discard pile, with its
   * cue, so every discard (the last turn's hand, a redraw, a Cull) emits
   * from one site. The cue is presentation, not state (`events.ts`), and
   * draws nothing.
   */
  private discardCard(rosterIndex: number): void {
    this.discardPile.push(rosterIndex);
    this.bus.emit('deck:cardDiscarded', {
      drawPile: this.drawPile.length,
      discardPile: this.discardPile.length,
    });
  }

  /**
   * Draw one card: pop `drawPile`, shuffling the discard back in when it is
   * empty, the deck's one draw, on a `'deck'` occurrence keyed by its own
   * counter. `undefined` only when both piles are empty. The turn's deal, a
   * redraw's refill and a packet's draw share it.
   */
  private drawCard(): number | undefined {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length === 0) return undefined;
      this.drawPile = this.discardPile;
      this.discardPile = [];
      this.streamRng('deck', this.deckShuffleIndex++).shuffle(this.drawPile);
      // One cue for the whole shuffle, with the counts after it and before
      // the pop.
      this.bus.emit('deck:reshuffled', {
        drawPile: this.drawPile.length,
        discardPile: 0,
      });
    }
    // The pile is guaranteed non-empty here (the guard above returned or
    // reshuffled), so the pop always yields a card.
    const card = this.drawPile.pop()!;
    // The card's cue, with the counts after the pop.
    this.bus.emit('deck:cardDrawn', {
      drawPile: this.drawPile.length,
      discardPile: this.discardPile.length,
    });
    return card;
  }

  /**
   * Emit again the gate event of the phase the run is in, so a run loaded
   * from a save mounts the screen it was saved at: `Game` mounts the
   * screens from these events. The payload is the one the live run emitted
   * on reaching the gate, rebuilt from saved state. `map` has no event
   * (`Game` routes it by the phase). `battle` and `turn-outcome` throw:
   * `Game`'s autosave skips both, so no save is at either.
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
      // The stream root and the three occurrence counters, from which every
      // stream derives.
      streamRoot: this.streamRoot,
      sectorIndex: this.sectorIndex,
      deckShuffleIndex: this.deckShuffleIndex,
      eventStep: this.eventStep,
      // A copy of each slot, since a sale sets `sold` in place; the
      // templates go by reference, never changed after the roll.
      portStock:
        this.portStock === null
          ? null
          : {
              units: this.portStock.units.map((s) => ({ ...s })),
              packets: this.portStock.packets.map((s) => ({ ...s })),
              daemons: this.portStock.daemons.map((s) => ({ ...s })),
            },
      // Copies: the event cursor, the flags (written in place), and each
      // pinned reward ref, which can be the authored catalog's own object.
      activeEvent: this.activeEvent === null ? null : { ...this.activeEvent },
      eventFlags: { ...this.eventFlags },
      pendingRewardOverride:
        this.pendingRewardOverride === null
          ? null
          : this.pendingRewardOverride.map((ref) => ({
              table: ref.table,
              trigger: { chance: ref.trigger.chance },
            })),
      // The daemons and the character by id, resolved from the catalogs on
      // a load.
      daemonIds: this.daemons.map((d) => d.id),
      characterId: this.character.id,
      // The level; a load derives its multipliers.
      escalation: this.escalation,
      // A copy of each grant, since `used` and `passed` change in place; the
      // buffs go by reference, never changed (`empowerEffect` copies their
      // mods when it applies one).
      turnGrants: this.turnGrants.map((g) => ({ ...g })),
      currentSectorId: this.currentSectorId,
      currentSectorNodeId: this.currentSectorNodeId,
      nodeMap: this.nodeMap,
      // The boss pair is never changed after its roll, so it goes by
      // reference, as `encounterMap` does.
      bossEncounterId: this.bossEncounterId,
      bossEncounterMap: this.bossEncounterMap,
      team: this.team.slice(),
      deploymentCounts: this.deploymentCounts.slice(),
      // Deep copies: a merge changes an effect in place, so the save must
      // share nothing with the live store.
      encounterEffects: this.encounterEffects.map((slot) => slot.map(cloneEffect)),
      drawPile: this.drawPile.slice(),
      discardPile: this.discardPile.slice(),
      hand: this.hand.slice(),
      bits: this.bits,
      cache: this.cache.slice(),
      // The packets' stores: the pending effects deep-copied as the live
      // store is; the injected rules copied by entry, never changed but kept
      // apart from the live lists.
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
      // Row copies, so the save shares nothing with the live list, which
      // only grows.
      fallenLedger: this.fallenLedger.map((r) => ({ ...r })),
      currentOffer: this.currentOffer ? this.currentOffer.slice() : null,
      visitedNodes: Array.from(this.visitedNodes),
      pendingPromotions: this.pendingPromotions
        ? this.pendingPromotions.slice()
        : null,
      // A copy of each portion, so the save is apart from the live offer,
      // which a resolution splices.
      pendingRewards: this.pendingRewards
        ? this.pendingRewards.map((p) => ({ ...p }))
        : null,
      clearedSector: this.clearedSector === null ? null : { ...this.clearedSector },
      lastTurn: this.lastTurn === null ? null : { ...this.lastTurn },
    };
  }

  /**
   * Rebuild a Run from a snapshot. It bypasses the constructor (no
   * `run:started`, no new node map), assigns each field from the snapshot,
   * then subscribes to the bus for `battle:ended`. The caller gives the
   * bus: the run slot and a dev load pass the game's, a rollout's clone and
   * the journal's replay a fresh one.
   *
   * `config` is the RunConfig the run was made with, since the snapshot
   * does not carry a config's inputs; the run slot builds it from the
   * save's dials (`RunConfig`'s header says which a save keeps). Absent,
   * the inputs are the shipped defaults; a rollout's clone passes none.
   * Only the inputs read after construction apply (`resolveRunInputs`);
   * what shaped construction (the roster, the daemon, the bits, the
   * character, the Escalation level, the grants) is in the snapshot, which
   * wins.
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
      // The private occurrence counters; `streamRoot` is public.
      sectorIndex: number;
      deckShuffleIndex: number;
      eventStep: number;
    };
    const m = run as unknown as Mut;
    m.bus = bus;
    m.subscriptions = [];
    // Not in the save: a restore starts with the gates off, as a new run does.
    run.pauseAtTurnGates = false;
    // The config's inputs, resolved as the constructor resolves them.
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
    // The level is the snapshot's, whatever the config says (a rollout's
    // clone loads with none), and the multipliers derive from it over the
    // config's overrides. A level off the ladder rejects, as an unknown
    // daemon does: a silent fall to 0 would hand back an easier run than the
    // one saved.
    if (!isEscalationLevel(snap.escalation)) {
      throw new Error(
        `Run.fromJSON: escalation level ${String(snap.escalation)} is not on the ladder (0 to ${ESCALATION_MAX})`,
      );
    }
    m.escalation = snap.escalation;
    m.difficultyMultipliers = withEscalation(inputs.difficultyMultipliers, snap.escalation);
    // The root and the counters are all there is to restore: each stream
    // derives again at its occurrence, and no occurrence spans a save.
    m.streamRoot = snap.streamRoot;
    m.sectorIndex = snap.sectorIndex;
    m.deckShuffleIndex = snap.deckShuffleIndex;
    m.eventStep = snap.eventStep;
    // The daemons by id from the shipped catalog; an unknown id (a retired
    // entry, a bespoke daemon) rejects rather than drop silently. The turn's
    // resolved grants restore as they are, so a save at the pre-turn gate
    // keeps Mercury's flip.
    m.daemons = snap.daemonIds.map((id) => {
      const daemon = daemonById(id);
      if (daemon === undefined) {
        throw new Error(`Run.fromJSON: unknown daemon id '${id}' (not in the catalog)`);
      }
      return daemon;
    });
    // The character by id, rejecting an unknown one as the daemons do: a
    // silent fall to the Soldier would rewrite the run's draft pools.
    const character = characterById(snap.characterId);
    if (character === undefined) {
      throw new Error(
        `Run.fromJSON: unknown character id '${snap.characterId}' (not in the catalog)`,
      );
    }
    m.character = character;
    // A copy of each grant, which the live run changes in place.
    m.turnGrants = snap.turnGrants.map((g) => ({ ...g }));
    // Neither sector id is checked here, so a snapshot taken under a fixture
    // sector map and loaded without it stands on ids the shipped map does
    // not know; the game's own saves are all of `SECTOR_MAP`.
    m.currentSectorId = snap.currentSectorId;
    m.currentSectorNodeId = snap.currentSectorNodeId;
    m.nodeMap = snap.nodeMap;
    // The boss id is checked against the catalog and an unknown one
    // rejects: rolling again would contradict the warning the player has
    // seen. Its board restores as it is, its layout unchecked.
    if (getEncounter(snap.bossEncounterId) === undefined) {
      throw new Error(
        `Run.fromJSON: unknown boss encounter id '${snap.bossEncounterId}' (not in the catalog)`,
      );
    }
    m.bossEncounterId = snap.bossEncounterId;
    m.bossEncounterMap = snap.bossEncounterMap;
    m.team = snap.team.slice();
    m.deploymentCounts = snap.deploymentCounts.slice();
    m.encounterEffects = snap.encounterEffects.map((slot) => slot.map(cloneEffect));
    m.drawPile = snap.drawPile.slice();
    m.discardPile = snap.discardPile.slice();
    m.hand = snap.hand.slice();
    // Floored again: the floor at 0 is kept, not trusted to the save, so a
    // hand-edited one cannot restore a negative balance.
    m.bits = Math.max(0, snap.bits);
    // Each packet id checked against the catalog, an unknown one rejecting.
    // A cache over its size is legal; the overflow derives again.
    m.cache = snap.cache.map((id) => {
      if (packetById(id) === undefined) {
        throw new Error(`Run.fromJSON: unknown packet id '${id}' (not in the catalog)`);
      }
      return id;
    });
    // The packets' stores, copied as `toJSON` copies them. The injected
    // rules are plain data, their status ids checked at battle setup
    // (`World.installBattleRules`), never during a tick.
    m.pendingEncounterEffects = snap.pendingEncounterEffects.map((slot) => slot.map(cloneEffect));
    m.injectedEncounterRules = snap.injectedEncounterRules.map(cloneInjectedRule);
    m.injectedRunRules = snap.injectedRunRules.map(cloneInjectedRule);
    m.playerHealth = snap.playerHealth;
    m.enemyHealth = snap.enemyHealth;
    m.turnIndex = snap.turnIndex;
    // The encounter from its saved id; unlike the other ids, one the
    // catalog lacks loads as none rather than rejecting. The wave cursor
    // restores as it is, never changed in place.
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
    // The pending offer, its daemon and packet portions checked against the
    // catalogs, an unknown id rejecting rather than leave a reward that
    // cannot be taken. A unit portion's template passes through as `team`'s
    // do; a `poolHealth` portion carries only its amount.
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
    // The event's state. The cursor's ids are checked against the load's
    // catalog, so a bespoke `eventCatalog` loads only with the config that
    // names it (a bespoke daemon never loads); the pinned reward tables are
    // checked against the tables.
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
    // The docked port's stock: the packet and daemon ids checked against
    // the catalogs, the unit templates passed through as `team`'s are.
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
    // The two gates' facts; the cleared sector is checked against the
    // catalog, which gives its title at the gate.
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
 * Check a `RunConfig.forcedLayoutId` against the layout library when the
 * inputs resolve, at construction and on a load, so a mistyped id throws at
 * the run's start rather than at its first battle. Absent is null (the
 * normal roll); `FORCE_PROCEDURAL` passes through, a procedural map every
 * battle.
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
 * Check a `RunConfig.forcedEncounterId` against the encounter catalog when
 * the inputs resolve, so a mistyped id throws at the run's start rather
 * than inside a selection. Absent is null (the sector's pools). The fuzz
 * harness's `--encounter=<id>` and the URL dial set it, to fight one
 * encounter at every node of its kind.
 */
function resolveForcedEncounterId(id: string | undefined): string | null {
  if (id === undefined) return null;
  if (getEncounter(id) === undefined) {
    throw new Error(`Run: unknown forcedEncounterId="${id}" (not in the encounter catalog)`);
  }
  return id;
}

/**
 * Check a `RunConfig.forcedEventId` against the run's event catalog when
 * the inputs resolve. The run's catalog, not the shipped one, so a test
 * with a bespoke `eventCatalog` can force its own events.
 */
function resolveForcedEventId(id: string | undefined, catalog: readonly EventDef[]): string | null {
  if (id === undefined) return null;
  if (!catalog.some((e) => e.id === id)) {
    throw new Error(`Run: unknown forcedEventId="${id}" (not in the event catalog)`);
  }
  return id;
}

/** The config inputs a Run reads after construction. A snapshot does not
 *  carry them, so a load takes them from the config it is passed, which the
 *  run slot builds from the save's dials. */
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
 * Resolve a RunConfig into the inputs the constructor and `fromJSON` both
 * assign, so a run loaded with its config reads what the live run read. No
 * config gives the shipped defaults. Draws nothing. Throws on a forced id
 * the catalogs do not hold, and on `hopCount` with `sectorHops`: one is a
 * single sector's probe, the other the whole sector walk on shortened
 * sectors, so together they contradict.
 */
function resolveRunInputs(config: RunConfig | undefined): RunInputs {
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
 * The procedural arena's side, uniform over `[TERRAIN.proceduralMinSize,
 * TERRAIN.proceduralMaxSize]`. One draw on every branch, a layout's that
 * ignores it included, so the stream's draw count does not depend on the
 * branch (gotcha #49).
 */
function rollProceduralSide(rng: RNG): number {
  return rng.int(TERRAIN.proceduralMinSize, TERRAIN.proceduralMaxSize);
}

function layoutDimensions(layoutId: string): { gridW: number; gridH: number } {
  const layout = getLayout(layoutId);
  if (!layout) {
    throw new Error(`Run.buildEncounterMap: unknown layoutId="${layoutId}"`);
  }
  return { gridW: layout.gridW, gridH: layout.gridH };
}
