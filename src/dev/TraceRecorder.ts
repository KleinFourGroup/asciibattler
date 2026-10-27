/**
 * The passive dev battle-trace recorder.
 *
 * A pure bus subscriber: it never touches the World, the Run, or the DOM, so
 * recording cannot perturb the deterministic sim (the same guarantee the
 * renderer leans on). One battle's trace is the `BattleEncounter` (the
 * self-contained fixture `battle:started` carries), the `command:applied`
 * stream (every player or bot order, stamped with the tick it took effect)
 * and the outcome, and determinism makes that replay byte-identically (the
 * world seed and the command stream give the same battle;
 * `objective.test.ts`). The `configHash` stamp is the invalidation key: a
 * trace recorded under different balance JSON must be refused by the replay
 * path (./replayTrace.ts), not silently mis-replayed.
 *
 * - A second `battle:started` while a trace is open discards the open one:
 *   an abandoned battle (`resetRun` mid-fight, say) has no outcome, and an
 *   outcome-less trace is worthless to the gauntlet (tests/gauntlet).
 * - `battle:ended` with no open trace is ignored (Run.test fixtures emit
 *   synthetic ends; the recorder must not fabricate a trace for them).
 * - Persistence and the export are not here: the localStorage ring is
 *   ./traceStore.ts, which the dev entry hands in as `onTrace`
 *   (./devEntry.ts), and the download is the dev keys' Ctrl+Alt+D. The
 *   class stays storage-agnostic so the replay tests and the gauntlet can
 *   drive it headless.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { BattleEncounter } from '../run/Run';
import { configHash } from '../config/configHash';
import type { StrikeArm } from '../config/stats';

/** One applied command, exactly as `command:applied` carried it. */
interface RecordedCommand {
  readonly tick: number;
  readonly command: GameEvents['command:applied']['command'];
}

/** The serializable trace of one battle. `version` gates the replay path. */
export interface BattleTrace {
  readonly version: 1;
  /** `configHash()` at record time, the replay-invalidation key. */
  readonly configHash: string;
  /** The self-contained battle fixture (deep-copied at `battle:started`). */
  readonly encounter: BattleEncounter;
  /** The run's strike arm, as `battle:started` carried it: absent at `hit`,
   *  so a trace from before the dial reads as one. */
  readonly strike?: StrikeArm;
  readonly commands: readonly RecordedCommand[];
  readonly outcome: {
    readonly winner: GameEvents['battle:ended']['winner'];
    /** The last tick the recorder saw: the battle's length. */
    readonly ticks: number;
  };
}

export class TraceRecorder {
  private open: {
    encounter: BattleEncounter;
    strike: StrikeArm | undefined;
    commands: RecordedCommand[];
    lastTick: number;
  } | null = null;

  constructor(
    bus: EventBus<GameEvents>,
    private readonly onTrace: (trace: BattleTrace) => void,
  ) {
    // Built once for the life of the page, so nothing unsubscribes.
    bus.on('battle:started', ({ encounter, strike }) => {
      // Deep-copied: the Run replaces its currentEncounter across turns,
      // and the trace must pin the encounter as it was at record time.
      this.open = { encounter: structuredClone(encounter), strike, commands: [], lastTick: 0 };
    });
    bus.on('command:applied', (applied) => {
      this.open?.commands.push(applied);
    });
    bus.on('tick', ({ tick }) => {
      if (this.open) this.open.lastTick = tick;
    });
    bus.on('battle:ended', ({ winner }) => {
      if (!this.open) return;
      const trace: BattleTrace = {
        version: 1,
        configHash: configHash(),
        encounter: this.open.encounter,
        ...(this.open.strike === undefined ? {} : { strike: this.open.strike }),
        commands: this.open.commands,
        outcome: { winner, ticks: this.open.lastTick },
      };
      this.open = null;
      this.onTrace(trace);
    });
  }
}
