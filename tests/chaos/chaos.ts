/**
 * 115c — THE CHAOS DRIVER (Round 8 spec D3; WORKLOG §115, call 6). It plays
 * a gated run as `tests/journalDrive.ts` does, but sends what a player who
 * presses everything would. At every gate it sends random commands of every
 * kind before the command that moves the run on: legal ones with random
 * in-range fields, and illegal ones (out of phase, or an index out of
 * range). In every battle it sends random orders and stray run commands.
 * It checks as it goes:
 * - an illegal command is a silent no-op (the contract `Command.ts` states):
 *   the run's text is unchanged;
 * - the round trip at every phase change: the run's text, loaded with its
 *   config on a fresh bus, turns back into the same text;
 * - occupancy after every tick: no cell holds two units on one plane;
 * and at the end, that its own journal replays to the same bytes. The
 * journal is also the repro: a failure throws with the seed and dials, and
 * writes the journal (abandoned where the run stopped) to `journalDir`.
 *
 * Plain TypeScript with no test framework, so `npm run chaos` (cli.ts) runs
 * it under tsx as `chaos.test.ts` runs it under vitest.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { secondsToTicks } from '../../src/config';
import { configHash } from '../../src/config/configHash';
import { HEALTH } from '../../src/config/health';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { RNG } from '../../src/core/RNG';
import { PHASE_ROWS, frontierOf, pickerFor } from '../../src/dev/probe/drive';
import { JournalRecorder } from '../../src/journal/JournalRecorder';
import type { JournalStart, JournaledCommand, RunJournal } from '../../src/journal/journal';
import { replayJournal } from '../../src/journal/replayJournal';
import { Run, type RunPhase, type RunSnapshot } from '../../src/run/Run';
import { parseRunConfig } from '../../src/run/RunConfig';
import type { WorldCommand } from '../../src/sim/Command';
import { World } from '../../src/sim/World';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { GROUND, findOverlappingCells, planeOf } from '../../src/sim/occupancy';

export const CHAOS_BUILD = '0.0.0+chaos';

type Kind = JournaledCommand['kind'];

/** Where each command kind is legal (Run.ts's phase guards); `any` for the
 *  one kind every phase takes. Typed over every journaled kind, so a new
 *  command fails typecheck until it has a row here. */
const LEGAL_IN: Record<Kind, readonly RunPhase[] | 'any'> = {
  enterNode: ['map'],
  chooseRecruit: ['recruit'],
  passRecruit: ['recruit'],
  dismissPromotion: ['promotion'],
  dismissSectorCleared: ['sectorCleared'],
  leavePort: ['port'],
  buyPortUnit: ['port'],
  buyPortPacket: ['port'],
  buyPortDaemon: ['port'],
  sellPacket: ['port'],
  payToRemoveUnit: ['port'],
  acceptReward: ['reward'],
  declineReward: ['reward'],
  advanceTurn: ['turn-intro', 'turn-outcome'],
  redrawCards: ['turn-intro'],
  empowerUnit: ['turn-intro'],
  passGrant: ['turn-intro'],
  discardPacket: 'any',
  usePacket: ['map', 'turn-intro'],
  chooseEventOption: ['event'],
};
export const KINDS = Object.keys(LEGAL_IN) as Kind[];

const legalIn = (kind: Kind, phase: RunPhase): boolean => {
  const where = LEGAL_IN[kind];
  return where === 'any' || where.includes(phase);
};

/** The chance, at a gate, of a random command before the one that moves on. */
const EXTRA_CHANCE = 0.6;
/** Of those, the share that are illegal. */
const ILLEGAL_SHARE = 0.4;
/** Per battle tick: an order, a stray run command. */
const ORDER_CHANCE = 0.03;
const BATTLE_COMMAND_CHANCE = 0.01;
/** In a battle the one legal command is a discard, which at the gates' share
 *  empties the cache before any gate can use a packet; so mostly illegal. */
const BATTLE_ILLEGAL_SHARE = 0.9;
const MAX_STEPS = 20_000;

export interface ChaosOptions {
  readonly seed: number;
  /** The run's dials as URL query text, as a journal's start holds them. */
  readonly dials: string;
  /** Where a failing run's journal is written; absent writes none. */
  readonly journalDir?: string;
  /** Controls, one per check, for the driver's own tests: break the load
   *  in the first round trip; put one unit onto another's cell after a
   *  tick; send the first command that moves the run on as one that must be
   *  a no-op; edit the journal before its replay. */
  readonly plant?: {
    readonly roundTrip?: (snap: RunSnapshot) => void;
    readonly overlap?: { readonly battle: number; readonly tick: number };
    readonly strictProgress?: boolean;
    readonly journal?: (journal: RunJournal) => void;
  };
}

export interface ChaosResult {
  readonly end: RunPhase;
  readonly battles: number;
  readonly ticks: number;
  readonly roundTrips: number;
  /** Commands sent by kind, and how many of those changed the run. */
  readonly census: Record<string, { sent: number; applied: number }>;
  /** Battle orders sent, by what they ask. */
  readonly orders: Record<string, number>;
}

export class ChaosFailure extends Error {
  constructor(
    message: string,
    readonly seed: number,
    readonly dials: string,
    readonly journalPath: string | null,
  ) {
    super(message);
    this.name = 'ChaosFailure';
  }
}

const text = (run: Run): string => JSON.stringify(run.toJSON());

export function chaosRun(options: ChaosOptions): ChaosResult {
  const { seed, dials, plant = {} } = options;
  const config = parseRunConfig(new URLSearchParams(dials));
  // The driver's own stream; the run's streams derive from its seed apart.
  const rng = new RNG(seed);
  const pick = pickerFor('seeded', seed);
  const bus = new EventBus<GameEvents>();

  let journal: RunJournal | null = null;
  let clock = 1_000_000;
  const recorder = new JournalRecorder(
    bus,
    { build: CHAOS_BUILD, configHash: configHash() },
    () => (clock += 250),
    (closed) => {
      journal = closed;
    },
  );
  let world: World | null = null;
  bus.on('battle:started', ({ worldSeed, encounter }) => {
    world = new World(bus, new RNG(worldSeed), encounter.gridW, encounter.gridH);
    world.installBattleRules(encounter.battleRules ?? []);
    spawnEncounter(world, encounter);
  });

  const start: JournalStart = { kind: 'seed', seed, dials };
  const run = new Run(seed, bus, config);
  run.pauseAtTurnGates = true;
  recorder.open(start, () => run.toJSON());

  const census: Record<string, { sent: number; applied: number }> = {};
  const orders: Record<string, number> = {};
  let battles = 0;
  let ticks = 0;
  let roundTrips = 0;
  let progressSent = 0;
  let lastPhase: RunPhase | null = null;

  const send = (command: JournaledCommand, mustBeNoop: boolean): void => {
    const phase = run.phase;
    const before = text(run);
    recorder.command(command);
    run.dispatch(command);
    recorder.settle();
    const after = text(run);
    const row = (census[command.kind] ??= { sent: 0, applied: 0 });
    row.sent++;
    if (after !== before) row.applied++;
    if (mustBeNoop && after !== before) {
      throw new Error(`an illegal ${JSON.stringify(command)} in the '${phase}' phase changed the run`);
    }
  };

  const roundTrip = (): void => {
    if (run.phase === lastPhase) return;
    lastPhase = run.phase;
    const saved = text(run);
    const snap = JSON.parse(saved) as RunSnapshot;
    if (roundTrips === 0) plant.roundTrip?.(snap);
    const loaded = Run.fromJSON(snap, new EventBus<GameEvents>(), config);
    const again = text(loaded);
    loaded.dispose();
    roundTrips++;
    if (again !== saved) throw new Error(`the round trip changed the run at the '${run.phase}' phase`);
  };

  const maxTurnTicks = secondsToTicks(HEALTH.maxTurnSeconds);
  const fight = (battle: number): void => {
    const w = world as World | null;
    if (w === null) throw new Error('a fight with no World');
    while (!w.ended) {
      if (rng.next() < ORDER_CHANCE) {
        const order = randomOrder(w, rng);
        orders[orderName(order)] = (orders[orderName(order)] ?? 0) + 1;
        w.enqueueCommand(order);
      }
      if (rng.next() < BATTLE_COMMAND_CHANCE) {
        const { command, illegal } = randomCommand(run, rng, BATTLE_ILLEGAL_SHARE);
        send(command, illegal);
      }
      w.tick();
      ticks++;
      if (!w.ended && w.currentTick >= maxTurnTicks) w.resolveAsDraw();
      if (plant.overlap?.battle === battle && plant.overlap.tick === w.currentTick) plantOverlap(w);
      const overlaps = findOverlappingCells(w);
      if (overlaps.length > 0) {
        throw new Error(`battle ${battle}, tick ${w.currentTick}: cell(s) ${overlaps.join(', ')} hold more than one unit`);
      }
    }
  };

  try {
    for (let step = 0; ; step++) {
      if (step > MAX_STEPS) throw new Error(`${MAX_STEPS} steps without the run ending`);
      roundTrip();
      const row = PHASE_ROWS[run.phase](run, pick);
      if (row === 'end') break;
      if (row === 'fight') {
        fight(battles++);
        continue;
      }
      if (rng.next() < EXTRA_CHANCE) {
        const { command, illegal } = randomCommand(run, rng);
        send(command, illegal);
        continue;
      }
      const first = progressSent++ === 0;
      send(row.command as JournaledCommand, plant.strictProgress === true && first);
    }
    const closed = journal as RunJournal | null;
    const recorded = closed?.segments[0];
    if (recorded?.end === undefined || recorded.end === null) throw new Error('the run ended with its journal open');
    const file = JSON.parse(JSON.stringify(closed)) as RunJournal;
    plant.journal?.(file);
    const replay = replayJournal(file).segments[0]!;
    if (replay.hash !== recorded.end.hash || text(replay.run) !== text(run)) {
      throw new Error(`its journal replayed to ${replay.hash}, not ${recorded.end.hash}`);
    }
  } catch (error) {
    recorder.abandon();
    const path = writeJournal(options, journal);
    const reason = error instanceof Error ? error.message : String(error);
    throw new ChaosFailure(
      `chaos seed ${seed} (${dials === '' ? 'no dials' : dials}): ${reason}${path === null ? '' : `\n  journal: ${path}`}`,
      seed,
      dials,
      path,
    );
  }
  return { end: run.phase, battles, ticks, roundTrips, census, orders };
}

function writeJournal(options: ChaosOptions, journal: RunJournal | null): string | null {
  if (options.journalDir === undefined || journal === null) return null;
  mkdirSync(options.journalDir, { recursive: true });
  const slug = options.dials.replace(/[^A-Za-z0-9]+/g, '-');
  const path = join(options.journalDir, `chaos-${options.seed}${slug === '' ? '' : `-${slug}`}.json`);
  writeFileSync(path, JSON.stringify(journal));
  return path;
}

/** A command for this phase: legal-shaped with in-range fields, or (at
 *  `illegalShare`) one that must be a no-op. */
function randomCommand(
  run: Run,
  rng: RNG,
  illegalShare = ILLEGAL_SHARE,
): { command: JournaledCommand; illegal: boolean } {
  const phase = run.phase;
  const here = KINDS.filter((k) => legalIn(k, phase));
  if (rng.next() >= illegalShare && here.length > 0) {
    return { command: shaped(here[rng.int(0, here.length - 1)]!, run, rng), illegal: false };
  }
  // Illegal: half out of range where the phase has a kind with a field to
  // break, else a kind this phase doesn't take.
  const ranged = here.filter((k) => !UNRANGED.has(k));
  if (ranged.length > 0 && rng.next() < 0.5) {
    return { command: outOfRange(ranged[rng.int(0, ranged.length - 1)]!, run, rng)!, illegal: true };
  }
  const elsewhere = KINDS.filter((k) => !legalIn(k, phase));
  return { command: shaped(elsewhere[rng.int(0, elsewhere.length - 1)]!, run, rng), illegal: true };
}

/** The kinds with no field `outOfRange` can break. */
const UNRANGED: ReadonlySet<Kind> = new Set([
  'passRecruit',
  'dismissPromotion',
  'dismissSectorCleared',
  'leavePort',
  'advanceTurn',
  'passGrant',
]);

const indexIn = (n: number, rng: RNG): number => (n > 0 ? rng.int(0, n - 1) : 0);
/** An index no list of length `n` holds. */
const badIndex = (n: number, rng: RNG): number => [-1, n, n + 3, 0.5][rng.int(0, 3)]!;

/** `kind` with fields in range for the run as it is (it may still be
 *  refused: unaffordable, a disabled choice, a spent grant). */
function shaped(kind: Kind, run: Run, rng: RNG): JournaledCommand {
  const swap = (): { swapCacheIndex?: number } =>
    run.cache.length > 0 && rng.next() < 0.5 ? { swapCacheIndex: indexIn(run.cache.length, rng) } : {};
  switch (kind) {
    case 'enterNode': {
      const frontier = frontierOf(run);
      return { kind, nodeId: frontier[indexIn(frontier.length, rng)] ?? run.nodeMap.rootId };
    }
    case 'chooseRecruit': {
      const offer = run.currentOffer ?? [];
      return { kind, unitTemplate: offer[indexIn(offer.length, rng)] ?? run.team[0]! };
    }
    case 'passRecruit':
    case 'dismissPromotion':
    case 'dismissSectorCleared':
    case 'leavePort':
    case 'advanceTurn':
    case 'passGrant':
      return { kind };
    case 'buyPortUnit':
      return { kind, index: indexIn(run.portStock?.units.length ?? 0, rng) };
    case 'buyPortPacket':
      return { kind, index: indexIn(run.portStock?.packets.length ?? 0, rng), ...swap() };
    case 'buyPortDaemon':
      return { kind, index: indexIn(run.portStock?.daemons.length ?? 0, rng) };
    case 'sellPacket':
      return { kind, cacheIndex: indexIn(run.cache.length, rng) };
    case 'payToRemoveUnit':
      return { kind, rosterIndex: indexIn(run.team.length, rng) };
    case 'acceptReward':
      return { kind, index: indexIn(run.pendingRewards?.length ?? 0, rng), ...swap() };
    case 'declineReward':
      return { kind, index: indexIn(run.pendingRewards?.length ?? 0, rng) };
    case 'redrawCards': {
      const first = indexIn(run.hand.length, rng);
      const second = indexIn(run.hand.length, rng);
      return { kind, handIndices: second === first ? [first] : [first, second], grantIndex: rng.int(0, 2) };
    }
    case 'empowerUnit':
      return { kind, handIndex: indexIn(run.hand.length, rng), grantIndex: rng.int(0, 2) };
    case 'discardPacket':
      return { kind, cacheIndex: indexIn(run.cache.length, rng) };
    case 'usePacket':
      return run.phase === 'turn-intro'
        ? { kind, cacheIndex: indexIn(run.cache.length, rng), handIndex: indexIn(run.hand.length, rng) }
        : { kind, cacheIndex: indexIn(run.cache.length, rng), rosterIndex: indexIn(run.team.length, rng) };
    case 'chooseEventOption':
      return { kind, choiceIndex: rng.int(0, 3) };
  }
}

/** `kind` in its own phase with a field no handler may accept, or null
 *  for a kind in `UNRANGED`. */
function outOfRange(kind: Kind, run: Run, rng: RNG): JournaledCommand | null {
  switch (kind) {
    case 'enterNode': {
      const frontier = frontierOf(run);
      const off = [-1, 9999, ...run.visitedNodes].filter((id) => !frontier.includes(id));
      return { kind, nodeId: off[rng.int(0, off.length - 1)]! };
    }
    case 'chooseRecruit': {
      // An offered card (or a team member) at a level no offer rolls.
      const base = run.currentOffer?.[0] ?? run.team[0]!;
      return { kind, unitTemplate: { ...base, level: 999 } };
    }
    case 'buyPortUnit':
      return { kind, index: badIndex(run.portStock?.units.length ?? 0, rng) };
    case 'buyPortPacket':
      return { kind, index: badIndex(run.portStock?.packets.length ?? 0, rng) };
    case 'buyPortDaemon':
      return { kind, index: badIndex(run.portStock?.daemons.length ?? 0, rng) };
    case 'sellPacket':
      return { kind, cacheIndex: badIndex(run.cache.length, rng) };
    case 'payToRemoveUnit':
      return { kind, rosterIndex: badIndex(run.team.length, rng) };
    case 'acceptReward':
      return { kind, index: badIndex(run.pendingRewards?.length ?? 0, rng) };
    case 'declineReward':
      return { kind, index: badIndex(run.pendingRewards?.length ?? 0, rng) };
    case 'redrawCards':
      return { kind, handIndices: [badIndex(run.hand.length, rng)], grantIndex: 0 };
    case 'empowerUnit':
      return { kind, handIndex: badIndex(run.hand.length, rng), grantIndex: 0 };
    case 'discardPacket':
      return { kind, cacheIndex: badIndex(run.cache.length, rng) };
    case 'usePacket':
      return { kind, cacheIndex: badIndex(run.cache.length, rng) };
    case 'chooseEventOption':
      return { kind, choiceIndex: [-1, 99, 0.5][rng.int(0, 2)]! };
    default:
      return null;
  }
}

/** A player order as the live game can send one: a mode, and a target that
 *  is a unit on the board or a cell inside it. */
function randomOrder(w: World, rng: RNG): WorldCommand {
  const roll = rng.next();
  if (roll < 0.15) return { kind: 'clearObjective', team: 'player' };
  if (roll < 0.4) return { kind: 'setObjective', team: 'player', objective: { mode: 'atWill' } };
  if (roll < 0.55) return { kind: 'setObjective', team: 'player', objective: { mode: 'hold' } };
  const mode = rng.next() < 0.5 ? 'engage' : 'focus';
  const enemies = w.units.filter((u) => u.team === 'enemy');
  const neutrals = w.units.filter((u) => u.team === 'neutral');
  const pickFrom = rng.next();
  if (pickFrom < 0.6 && enemies.length > 0) {
    return { kind: 'setObjective', team: 'player', objective: { mode, target: { kind: 'enemy', unitId: enemies[rng.int(0, enemies.length - 1)]!.id } } };
  }
  if (pickFrom < 0.75 && neutrals.length > 0) {
    return { kind: 'setObjective', team: 'player', objective: { mode, target: { kind: 'neutral', unitId: neutrals[rng.int(0, neutrals.length - 1)]!.id } } };
  }
  const cell = { x: rng.int(0, w.gridW - 1), y: rng.int(0, w.gridH - 1) };
  return { kind: 'setObjective', team: 'player', objective: { mode, target: { kind: 'tile', cell } } };
}

function orderName(order: WorldCommand): string {
  if (order.kind !== 'setObjective') return order.kind;
  const { objective } = order;
  return 'target' in objective ? `${objective.mode} ${objective.target.kind}` : objective.mode;
}

/** The overlap control: the second ground unit stands on the first's cell. */
function plantOverlap(w: World): void {
  const ground = w.units.filter((u) => planeOf(u) === GROUND);
  const [a, b] = ground;
  if (a === undefined || b === undefined) throw new Error('the overlap plant needs two ground units');
  b.position = { ...a.position };
}
