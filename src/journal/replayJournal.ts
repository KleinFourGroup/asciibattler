/**
 * Replay a run journal (./journal.ts) headless, and say whether the replay
 * reached what the journal recorded.
 *
 * Each segment is replayed on its own: the Run from the segment's start (a
 * seed or a snapshot, with its dials; for a `resume`, 115d, the Run the
 * segment before left, through its text, as the page loaded the save), the
 * turn gates on as the game plays,
 * and a World per battle, built the way both production sites and
 * `replayTrace` build it (`new World` on the encounter's seed →
 * `installBattleRules` → `spawnEncounter`) and ticked with the live clock's
 * body (a draw once the turn cap is reached).
 *
 * The entries are applied in order, each at its place:
 *  - a `run` command outside a battle is dispatched as it comes; one sent
 *    during a battle (`tick`) is dispatched once that many ticks have run;
 *  - an `order` is enqueued before its effective tick runs, the one rule
 *    `command:applied`'s stamp gives (`replayTrace` uses the same);
 *  - a `battle` checkpoint runs the battle to its end and compares the
 *    winner and the tick count.
 * At the segment's end the Run's `snapshotHash` is compared with the
 * journal's. A journal whose segment has no end yet (a run still being
 * played) replays as far as it goes, with nothing to compare at the end.
 *
 * TWO KINDS OF FAILURE. `JournalRefused`: this code can't replay the journal
 * at all (another format, another config hash), and a best-effort replay
 * would diverge without saying why. `JournalDivergence`: the replay stopped
 * matching, and the message names the segment, the battle and the entry
 * where it did. Which builds a journal is accepted from is the caller's rule,
 * since this module doesn't know the build it runs on.
 */

import { secondsToTicks } from '../config';
import { configHash } from '../config/configHash';
import { HEALTH } from '../config/health';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG } from '../core/RNG';
import { Run, type RunSnapshot } from '../run/Run';
import { parseRunConfig } from '../run/RunConfig';
import { World } from '../sim/World';
import { spawnEncounter } from '../sim/battleSetup';
import { JOURNAL_FORMAT, snapshotHash, type JournalSegment, type JournalStart, type RunJournal } from './journal';

export class JournalRefused extends Error {
  override readonly name = 'JournalRefused';
}

export class JournalDivergence extends Error {
  override readonly name = 'JournalDivergence';
}

export interface SegmentReplay {
  /** The Run as the replay left it. */
  readonly run: Run;
  /** `snapshotHash` of that Run. */
  readonly hash: string;
  /** Battles the replay ran to their end. */
  readonly battles: number;
  /** True when the segment had no end to compare against. */
  readonly open: boolean;
}

export interface JournalReplay {
  readonly segments: readonly SegmentReplay[];
}

/** The Run a segment's start describes, constructed as `Game` constructs
 *  it: the dials parsed as the URL's are, the turn gates on. A `resume`
 *  loads `before`, the Run the segment before it left. */
export function runFromStart(start: JournalStart, bus: EventBus<GameEvents>, before?: Run): Run {
  const config = parseRunConfig(new URLSearchParams(start.dials));
  let run: Run;
  if (start.kind === 'seed') {
    run = new Run(start.seed, bus, config);
  } else if (start.kind === 'snapshot') {
    run = Run.fromJSON(start.snapshot, bus, config);
  } else {
    if (before === undefined) throw new JournalRefused('runFromStart: a resume start with no run before it');
    run = Run.fromJSON(JSON.parse(JSON.stringify(before.toJSON())) as RunSnapshot, bus, config);
  }
  run.pauseAtTurnGates = true;
  return run;
}

/** 115d — why a `resume` segment can't follow the one before it, or null. A
 *  resume replays on from the segment before, so that one must have ended
 *  `saved` at the hash the resume starts from, on the same build and config. */
function resumeRefusal(segments: readonly JournalSegment[], i: number): string | null {
  const start = segments[i]!.start;
  if (start.kind !== 'resume') return null;
  const before = segments[i - 1];
  if (before === undefined) return 'it resumes, and no segment comes before it';
  if (before.end?.reason !== 'saved') return `it resumes, and segment ${i - 1} ended ${before.end?.reason ?? 'open'}, not saved`;
  if (before.end.hash !== start.hash) {
    return `it resumes from hash ${start.hash}, and segment ${i - 1} was saved at ${before.end.hash}`;
  }
  const here = segments[i]!;
  if (before.build !== here.build || before.configHash !== here.configHash) {
    return (
      `it resumes, and segment ${i - 1} was recorded on build ${before.build} under config ${before.configHash}, ` +
      `not ${here.build} under ${here.configHash}: a load on another build starts from the snapshot`
    );
  }
  return null;
}

/**
 * Replay every segment of `journal`. Throws `JournalRefused` before
 * replaying anything, or `JournalDivergence` from the segment that diverged.
 */
export function replayJournal(journal: RunJournal): JournalReplay {
  if (journal.format !== JOURNAL_FORMAT) {
    throw new JournalRefused(
      `replayJournal: the journal's format is ${String(journal.format)}; this build reads format ${JOURNAL_FORMAT}`,
    );
  }
  const liveHash = configHash();
  journal.segments.forEach((segment, i) => {
    if (segment.configHash !== liveHash) {
      throw new JournalRefused(
        `replayJournal: segment ${i} was recorded under config ${segment.configHash} (build ${segment.build}), ` +
          `and the loaded config is ${liveHash}: a replay against other balance numbers would diverge. ` +
          `Check out the build that recorded it.`,
      );
    }
    const refusal = resumeRefusal(journal.segments, i);
    if (refusal !== null) throw new JournalRefused(`replayJournal: segment ${i}: ${refusal}`);
  });
  const segments: SegmentReplay[] = [];
  journal.segments.forEach((segment, i) => segments.push(replaySegment(segment, i, segments[i - 1]?.run)));
  return { segments };
}

function replaySegment(segment: JournalSegment, index: number, before: Run | undefined): SegmentReplay {
  const bus = new EventBus<GameEvents>();
  let world: World | null = null;
  let winner: GameEvents['battle:ended']['winner'] | null = null;
  bus.on('battle:started', ({ worldSeed, encounter }) => {
    world = new World(bus, new RNG(worldSeed), encounter.gridW, encounter.gridH);
    world.installBattleRules(encounter.battleRules ?? []);
    spawnEncounter(world, encounter);
    winner = null;
  });
  bus.on('battle:ended', (ended) => {
    winner = ended.winner;
  });
  const run = runFromStart(segment.start, bus, before);

  let battles = 0;
  let at = 'the start';
  const diverged = (what: string): JournalDivergence =>
    new JournalDivergence(`replayJournal: segment ${index}, battle ${battles + 1}, ${at}: ${what}`);
  /** The battle in progress. `world` is assigned in a bus handler, which the
   *  type checker doesn't follow, so every read goes through here. */
  const battle = (): World | null => world as World | null;
  const openBattle = (wanted: string): World => {
    const w = battle();
    if (w === null) throw diverged(`the journal has ${wanted}, and the replay is not in a battle`);
    return w;
  };

  const maxTurnTicks = secondsToTicks(HEALTH.maxTurnSeconds);
  const step = (w: World): void => {
    w.tick();
    if (!w.ended && w.currentTick >= maxTurnTicks) w.resolveAsDraw();
  };
  /** Run the battle until `tick` ticks have run. It must still be going then. */
  const runTo = (w: World, tick: number, wanted: string): void => {
    while (!w.ended && w.currentTick < tick) step(w);
    if (w.ended) {
      throw diverged(
        `the journal has ${wanted}, and the replayed battle ended at tick ${w.currentTick} (${String(winner)})`,
      );
    }
  };

  segment.entries.forEach((entry, i) => {
    at = `entry ${i}`;
    if (entry.t === 'run') {
      if (entry.tick === undefined) {
        const w = battle();
        if (w !== null) {
          throw diverged(
            `the journal sends ${entry.command.kind} outside a battle, and the replay is in one at tick ${w.currentTick}`,
          );
        }
      } else {
        const wanted = `${entry.command.kind} after tick ${entry.tick}`;
        runTo(openBattle(wanted), entry.tick, wanted);
      }
      run.dispatch(entry.command);
    } else if (entry.t === 'order') {
      const wanted = `an order for tick ${entry.tick}`;
      const w = openBattle(wanted);
      runTo(w, entry.tick - 1, wanted);
      w.enqueueCommand(entry.command);
    } else {
      const w = openBattle(`a battle's end`);
      while (!w.ended) step(w);
      if (winner !== entry.winner || w.currentTick !== entry.ticks) {
        throw diverged(
          `the journal's battle ended ${entry.winner} after ${entry.ticks} ticks, ` +
            `and the replay's ended ${String(winner)} after ${w.currentTick}`,
        );
      }
      world = null;
      battles++;
    }
  });

  at = 'the end';
  const end = segment.end;
  if (end !== null) {
    if (end.tick !== undefined) {
      const wanted = `its end after tick ${end.tick}`;
      runTo(openBattle(wanted), end.tick, wanted);
    } else if (battle() !== null) {
      throw diverged('the journal ends outside a battle, and the replay is in one');
    }
  }
  const hash = snapshotHash(run.toJSON());
  run.dispose();
  if (end !== null) {
    const phase = end.reason === 'defeat' ? 'defeat' : end.reason === 'victory' ? 'complete' : null;
    if (phase !== null && run.phase !== phase) {
      throw diverged(`the journal ends in ${end.reason}, and the replayed run is in phase ${run.phase}`);
    }
    if (hash !== end.hash) {
      throw diverged(`the journal's final snapshot hash is ${end.hash}, and the replay's is ${hash}`);
    }
  }
  return { run, hash, battles, open: end === null };
}
