/**
 * 53b — the passive DEV battle-trace recorder.
 *
 * A pure bus subscriber: it never touches the World, the Run, or the DOM, so
 * recording cannot perturb the deterministic sim (the same guarantee the
 * renderer leans on). One battle's trace is
 *
 *   `BattleEncounter` (the self-contained fixture `battle:started` now
 *   carries) + the `command:applied` stream (every player/bot order, stamped
 *   with the tick it took effect — 53a) + the outcome,
 *
 * and the determinism doctrine guarantees that tuple replays byte-identically
 * (worldSeed + command stream → the same battle; `objective.test.ts`). The
 * `configHash` stamp is the invalidation key: a trace recorded under
 * different balance JSON must be refused by the replay path (53c), not
 * silently mis-replayed.
 *
 * Lifecycle notes:
 * - A second `battle:started` while a trace is open DISCARDS the open one —
 *   an abandoned battle (e.g. `resetRun` mid-fight) has no outcome and an
 *   outcome-less trace is worthless to the gauntlet.
 * - `battle:ended` with no open trace is ignored (Run.test fixtures emit
 *   synthetic ends; the recorder must not fabricate a trace for them).
 * - DEFERRAL LANDING NOTE — persistence and the export surface are NOT here:
 *   the localStorage ring lives in `traceStore.ts` (wired in `main.ts`'s DEV
 *   block via the `onTrace` callback), and the export/download KEY lands
 *   with 53f's dev-key listener. This class must stay storage-agnostic so
 *   the 53c replay tests and the 53e gauntlet can drive it headless.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { BattleEncounter } from '../run/Run';
import { configHash } from './configHash';

/** One applied command, exactly as `command:applied` carried it (53a). */
export interface RecordedCommand {
  readonly tick: number;
  readonly command: GameEvents['command:applied']['command'];
}

/** The serializable trace of one battle. `version` gates the replay path. */
export interface BattleTrace {
  readonly version: 1;
  /** `configHash()` at record time — the replay-invalidation key. */
  readonly configHash: string;
  /** The self-contained battle fixture (deep-copied at `battle:started`). */
  readonly encounter: BattleEncounter;
  readonly commands: readonly RecordedCommand[];
  readonly outcome: {
    readonly winner: GameEvents['battle:ended']['winner'];
    /** The last tick the recorder saw — the battle's length. */
    readonly ticks: number;
  };
}

export class TraceRecorder {
  private open: {
    encounter: BattleEncounter;
    commands: RecordedCommand[];
    lastTick: number;
  } | null = null;

  private readonly unsubscribes: (() => void)[];

  constructor(
    bus: EventBus<GameEvents>,
    private readonly onTrace: (trace: BattleTrace) => void,
  ) {
    this.unsubscribes = [
      bus.on('battle:started', ({ encounter }) => {
        // Deep-copy: the Run re-reads/replaces its currentEncounter across
        // turns; the trace must pin the encounter as it was at record time.
        this.open = { encounter: structuredClone(encounter), commands: [], lastTick: 0 };
      }),
      bus.on('command:applied', (applied) => {
        this.open?.commands.push(applied);
      }),
      bus.on('tick', ({ tick }) => {
        if (this.open) this.open.lastTick = tick;
      }),
      bus.on('battle:ended', ({ winner }) => {
        if (!this.open) return;
        const trace: BattleTrace = {
          version: 1,
          configHash: configHash(),
          encounter: this.open.encounter,
          commands: this.open.commands,
          outcome: { winner, ticks: this.open.lastTick },
        };
        this.open = null;
        this.onTrace(trace);
      }),
    ];
  }

  /** Unsubscribe from the bus and drop any open (unfinished) trace. */
  dispose(): void {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes.length = 0;
    this.open = null;
  }
}
