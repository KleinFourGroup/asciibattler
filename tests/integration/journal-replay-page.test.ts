import { describe, expect, it } from 'vitest';
import replayDriver, { type ReplayDriver, type ReplayReport } from '../../shell/electron/probes/replay-page.js';
import { secondsToTicks } from '../../src/config';
import { configHash } from '../../src/config/configHash';
import { HEALTH } from '../../src/config/health';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { RNG } from '../../src/core/RNG';
import { JournalRecorder } from '../../src/journal/JournalRecorder';
import type { JournalEntry, JournalSegment, JournalStart, RunJournal } from '../../src/journal/journal';
import type { RunCommand } from '../../src/run/Command';
import type { Run } from '../../src/run/Run';
import { World } from '../../src/sim/World';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { asFile, bytes, driveRun, replayPlants, runFromStart, TEST_BUILD } from '../journalDrive';

// The recorder's replay driver (shell/electron/probes/replay-page.js) feeds a
// journal to the live game in the page. Here it is driven over a stand-in for
// that Game made of the real Run, the real Worlds and the real recorder, so
// where it puts each entry is pinned without a page: a run recorded headless
// (tests/journalDrive.ts, with planted battle orders and mid-battle discards)
// must replay through the driver to the same bytes, and a changed journal
// must be refused or fail by name.

const MAX_TURN_TICKS = secondsToTicks(HEALTH.maxTurnSeconds);

/**
 * What the driver reaches on the live Game, behaving as Game and BattleScene
 * do: `dispatch` journals a command and applies it; `battle:started` mounts a
 * scene whose World is parked through a countdown (orders drain, nothing
 * ticks), then runs several ticks a frame; after a battle's outro the game
 * itself sends the `advanceTurn` out of the turn-outcome gate.
 */
class StandInGame {
  readonly bus = new EventBus<GameEvents>();
  readonly playback = {
    steps: [0.5, 1, 2, 3],
    selected: 1,
    setSpeed(value: number): boolean {
      this.selected = value;
      return true;
    },
  };
  activeScene: { world: World; countdown: { active: boolean }; playback: { resume(): void } } | null = null;
  readonly run: Run;
  private finished: RunJournal | null = null;
  private readonly recorder: JournalRecorder;
  private parkedFrames = 0;
  private outroFrames = 0;

  /** @param own what the game sends after a battle's outro (a control sends another command). */
  constructor(
    start: JournalStart,
    private readonly own: RunCommand = { kind: 'advanceTurn' },
  ) {
    let clock = 5_000_000;
    this.recorder = new JournalRecorder(
      this.bus,
      { build: TEST_BUILD, configHash: configHash() },
      () => (clock += 10),
      (journal) => (this.finished = journal),
    );
    this.bus.on('battle:started', ({ worldSeed, encounter }) => {
      const world = new World(this.bus, new RNG(worldSeed), encounter.gridW, encounter.gridH);
      world.installBattleRules(encounter.battleRules ?? []);
      spawnEncounter(world, encounter);
      const countdown = { active: true };
      this.parkedFrames = 2;
      this.activeScene = { world, countdown, playback: { resume: () => (countdown.active = false) } };
    });
    this.run = runFromStart(start, this.bus);
    this.recorder.open(start, () => this.run.toJSON());
  }

  dispatch(command: RunCommand): void {
    if (command.kind === 'resetRun' || command.kind === 'chooseCharacter') throw new Error('not a journaled command');
    this.recorder.command(command);
    this.run.dispatch(command);
    this.recorder.settle();
  }

  currentJournal(): RunJournal | null {
    return this.recorder.journal ?? this.finished;
  }

  /** One frame of the game's loop, `ticks` sim ticks long. */
  frame(ticks: number): void {
    const scene = this.activeScene;
    if (scene !== null && !scene.world.ended) {
      if (scene.countdown.active) {
        scene.world.drainCommands();
        if (--this.parkedFrames <= 0) scene.countdown.active = false;
        return;
      }
      for (let k = 0; k < ticks && !scene.world.ended; k++) {
        scene.world.tick();
        if (!scene.world.ended && scene.world.currentTick >= MAX_TURN_TICKS) scene.world.resolveAsDraw();
      }
      return;
    }
    if (this.run.phase === 'turn-outcome' && ++this.outroFrames >= 2) {
      this.outroFrames = 0;
      // Through the instance, as Game's own `this.dispatch` goes.
      this.dispatch(this.own);
    }
  }
}

/** Replay `segment` through the driver over a fresh stand-in, four ticks a
 *  frame, with no waiting between commands. */
function replayInPage(
  segment: JournalSegment,
  opts: { countdown?: 'full' | 'skip' } = {},
  game = new StandInGame(segment.start),
): { error: string } | { report: ReplayReport; game: StandInGame } {
  const made = replayDriver(game, segment, { maxGapMs: 0, ...opts });
  if ('error' in made) return { error: made.error };
  const driver: ReplayDriver = made;
  driver.begin(0);
  for (let frame = 1; !driver.done; frame++) {
    if (frame > 200_000) throw new Error('the replay never ended');
    driver.frame(frame);
    game.frame(4);
  }
  return { report: driver.report(), game };
}

const withEntries = (segment: JournalSegment, edit: (entries: JournalEntry[]) => JournalEntry[]): JournalSegment => ({
  ...segment,
  entries: edit([...segment.entries]),
});

/** The failure of a replay that was expected to run and fail. */
function failureOf(segment: JournalSegment): string {
  const replay = replayInPage(segment);
  if ('error' in replay) throw new Error(`refused: ${replay.error}`);
  expect(replay.report.ok).toBe(false);
  return replay.report.failure ?? '';
}

describe('the recorder’s replay driver, over a stand-in for the page’s Game', () => {
  // Seed 11 holds a packet at some battle's start, so its journal has real
  // mid-battle discards beside the planted orders; it ends in defeat.
  const start = { kind: 'seed', seed: 11, dials: 'hops=4&character=priest' } as const;
  const discards: { battle: number }[] = [];
  const recorded = driveRun({ start, choiceSeed: 11, plants: replayPlants(discards) });
  const segment = asFile(recorded.journal).segments[0]!;
  const entries = segment.entries;

  it('the journal holds what the driver has to place', () => {
    expect(discards.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.t === 'run' && e.tick !== undefined)).toBe(true);
    expect(entries.some((e) => e.t === 'order' && e.tick === 1)).toBe(true);
    expect(entries.some((e) => e.t === 'order' && e.tick > 1)).toBe(true);
  });

  it('replays the run to the same bytes, the game sending its own advances', () => {
    const replay = replayInPage(segment);
    if ('error' in replay) throw new Error(replay.error);
    const { report, game } = replay;
    expect(report.failure).toBeNull();
    expect(report.ok).toBe(true);
    expect(report.at).toBe(entries.length);
    expect(report.battles).toBe(recorded.battles);
    expect(report.gameSent).toBe(recorded.battles);
    expect(report.orders).toBe(entries.filter((e) => e.t === 'order').length);
    expect(report.hash.page).toBe(segment.end!.hash);
    expect(bytes(game.run)).toBe(bytes(recorded.run));
  }, 30_000);

  it('replays it with every countdown skipped, too', () => {
    const replay = replayInPage(segment, { countdown: 'skip' });
    if ('error' in replay) throw new Error(replay.error);
    expect(replay.report.ok).toBe(true);
    expect(bytes(replay.game.run)).toBe(bytes(recorded.run));
  }, 30_000);

  describe('the controls: a changed journal fails by name', () => {
    it('the game’s own advance taken out: the entries behind it no longer fit', () => {
      const battle = entries.findIndex((e) => e.t === 'battle');
      expect(entries[battle + 1]).toMatchObject({ t: 'run', command: { kind: 'advanceTurn' } });
      const dropped = withEntries(segment, (list) => list.filter((_, i) => i !== battle + 1));
      expect(failureOf(dropped)).toMatch(/^entry \d+ of \d+: the journal has an order for tick 1, and the replay is not in a battle$/);
    });

    it('a game that sends another command than the journal’s next', () => {
      const game = new StandInGame(start, { kind: 'discardPacket', cacheIndex: 0 });
      const replay = replayInPage(segment, {}, game);
      if ('error' in replay) throw new Error(replay.error);
      expect(replay.report.ok).toBe(false);
      expect(replay.report.failure).toMatch(/: the game sent discardPacket itself, and the journal has advanceTurn$/);
    });

    it('the first Fight dropped', () => {
      const fight = entries.findIndex((e) => e.t === 'run' && e.command.kind === 'advanceTurn');
      const dropped = withEntries(segment, (list) => list.filter((_, i) => i !== fight));
      expect(failureOf(dropped)).toBe(
        `entry ${fight} of ${entries.length - 1}: the journal has an order for tick 1, and the replay is not in a battle`,
      );
    });

    it('a battle order’s tick moved', () => {
      const order = entries.findIndex((e) => e.t === 'order' && e.tick === 6);
      const moved = withEntries(segment, (list) =>
        list.map((e, i) => (i === order && e.t === 'order' ? { ...e, tick: 30 } : e)),
      );
      expect(failureOf(moved)).not.toBe('');
    });

    it('a checkpoint’s tick moved', () => {
      const third = entries.flatMap((e, i) => (e.t === 'battle' ? [i] : []))[2]!;
      const was = entries[third]!;
      const ticks = was.t === 'battle' ? was.ticks : -1;
      const moved = withEntries(segment, (list) =>
        list.map((e, i) => (i === third && e.t === 'battle' ? { ...e, ticks: e.ticks + 1 } : e)),
      );
      expect(failureOf(moved)).toMatch(
        new RegExp(`^entry ${third} of ${entries.length}, battle 3 at tick ${ticks}: the journal's battle ended \\w+ after ${ticks + 1} ticks, and the replay's ended \\w+ after ${ticks}$`),
      );
    });

    it('the final hash changed', () => {
      const changed = { ...segment, end: { ...segment.end!, hash: '00000000' } };
      expect(failureOf(changed)).toMatch(/the journal's final snapshot hash is 00000000, and the page's is [0-9a-f]{8}$/);
    }, 30_000);

    it('another config hash is refused before anything is sent', () => {
      expect(replayInPage({ ...segment, configHash: 'ffffffff' })).toMatchObject({
        error: expect.stringMatching(/recorded under config ffffffff/),
      });
    });

    it('a page opened on another seed is refused', () => {
      const game = new StandInGame({ ...start, seed: 12 });
      expect(replayDriver(game, segment)).toMatchObject({ error: expect.stringMatching(/started from seed 12 /) });
    });

    it('a run not played to its end is refused', () => {
      expect(replayInPage({ ...segment, end: null })).toMatchObject({ error: expect.stringMatching(/played to its end/) });
      const abandoned = { ...segment, end: { ...segment.end!, reason: 'abandoned' as const } };
      expect(replayInPage(abandoned)).toMatchObject({ error: expect.stringMatching(/this journal's end: abandoned/) });
    });
  });
});
