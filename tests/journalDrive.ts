/**
 * A headless stand-in for the game's side of a run, for the journal's tests:
 * it plays a whole run with the turn gates on, the way `Game` does, with a
 * `JournalRecorder` fed from the same two places (the dispatcher and the
 * bus), and returns the closed journal beside the Run it recorded.
 *
 * What a player would send in each phase comes from the pane kit's rows
 * (src/dev/probe/drive.ts), which are pure over the Run. The battles are
 * built and ticked as the fuzz harness and `replayTrace` build and tick them.
 * The `plants` put battle orders and mid-battle run commands at chosen ticks,
 * and can abandon the run, so a test decides what the journal should hold
 * without asking the recorder.
 */

import { secondsToTicks } from '../src/config';
import { configHash } from '../src/config/configHash';
import { HEALTH } from '../src/config/health';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/core/events';
import { RNG } from '../src/core/RNG';
import { PHASE_ROWS, pickerFor } from '../src/dev/probe/drive';
import { JournalRecorder } from '../src/journal/JournalRecorder';
import type { JournalStart, JournaledCommand, RunJournal } from '../src/journal/journal';
import { Run } from '../src/run/Run';
import { parseRunConfig } from '../src/run/RunConfig';
import type { WorldCommand } from '../src/sim/Command';
import { World } from '../src/sim/World';
import { spawnEncounter } from '../src/sim/battleSetup';

export const TEST_BUILD = '0.0.0+test';

export interface Plants {
  /** Battle orders to enqueue before `tick` of battle `battle` (0-based) runs. */
  readonly orders?: (battle: number, tick: number, world: World) => readonly WorldCommand[];
  /** True to apply that tick's orders while the battle is parked (the live
   *  scene's countdown and pause), not in the tick's own drain. */
  readonly parked?: (battle: number, tick: number) => boolean;
  /** Run commands to send once `tick` ticks of battle `battle` have run. */
  readonly commands?: (battle: number, tick: number, run: Run) => readonly JournaledCommand[];
  /** Abandon the run once `tick` ticks of battle `battle` have run. */
  readonly abandonAt?: { readonly battle: number; readonly tick: number };
}

export interface DriveOptions {
  readonly start: JournalStart;
  /** Seeds the choices a player makes (the node, the event option, the recruit). */
  readonly choiceSeed?: number;
  readonly plants?: Plants;
  /** False plays the same run with no recorder on the bus. */
  readonly record?: boolean;
  /** The recorder's clock; defaults to one that advances 250 ms per reading. */
  readonly now?: () => number;
}

export interface DriveResult {
  /** The closed journal; null when `record` was false. */
  readonly journal: RunJournal | null;
  /** How many times the recorder reported a closed journal. */
  readonly closes: number;
  readonly run: Run;
  readonly battles: number;
  readonly abandoned: boolean;
}

/** The Run a journal's start describes, constructed as `Game` constructs it. */
export function runFromStart(start: JournalStart, bus: EventBus<GameEvents>): Run {
  const run =
    start.kind === 'seed'
      ? new Run(start.seed, bus, parseRunConfig(new URLSearchParams(start.dials)))
      : Run.fromJSON(start.snapshot, bus);
  run.pauseAtTurnGates = true;
  return run;
}

const MAX_COMMANDS = 5000;

export function driveRun(options: DriveOptions): DriveResult {
  const { start, plants = {} } = options;
  const bus = new EventBus<GameEvents>();

  let journal: RunJournal | null = null;
  let closes = 0;
  let clock = 1_000_000;
  const now = options.now ?? (() => (clock += 250));
  // Before the Run, as the recorder's header asks.
  const recorder =
    options.record === false
      ? null
      : new JournalRecorder(bus, { build: TEST_BUILD, configHash: configHash() }, now, (closed) => {
          journal = closed;
          closes++;
        });

  let world: World | null = null;
  bus.on('battle:started', ({ worldSeed, encounter }) => {
    world = new World(bus, new RNG(worldSeed), encounter.gridW, encounter.gridH);
    world.installBattleRules(encounter.battleRules ?? []);
    spawnEncounter(world, encounter);
  });

  const run = runFromStart(start, bus);
  recorder?.open(start, () => run.toJSON());

  const send = (command: JournaledCommand): void => {
    recorder?.command(command);
    run.dispatch(command);
    recorder?.settle();
  };

  const maxTurnTicks = secondsToTicks(HEALTH.maxTurnSeconds);
  /** Fight the open battle to its end; false when the plants abandoned it. */
  const fight = (battle: number): boolean => {
    const w = world as World | null;
    if (w === null) throw new Error('driveRun: the battle phase with no World');
    while (!w.ended) {
      const ran = w.currentTick;
      if (plants.abandonAt?.battle === battle && plants.abandonAt.tick === ran) return false;
      for (const command of plants.commands?.(battle, ran, run) ?? []) send(command);
      const next = ran + 1;
      for (const order of plants.orders?.(battle, next, w) ?? []) w.enqueueCommand(order);
      if (plants.parked?.(battle, next)) w.drainCommands();
      w.tick();
      if (!w.ended && w.currentTick >= maxTurnTicks) w.resolveAsDraw();
    }
    return true;
  };

  const pick = pickerFor('seeded', options.choiceSeed ?? 1);
  let battles = 0;
  let abandoned = false;
  for (let sent = 0; ; sent++) {
    if (sent > MAX_COMMANDS) throw new Error(`driveRun: ${MAX_COMMANDS} steps without the run ending`);
    const step = PHASE_ROWS[run.phase](run, pick);
    if (step === 'end') break;
    if (step === 'fight') {
      if (!fight(battles++)) {
        abandoned = true;
        recorder?.abandon();
        break;
      }
    } else {
      send(step.command as JournaledCommand);
    }
  }
  return { journal, closes, run, battles, abandoned };
}
