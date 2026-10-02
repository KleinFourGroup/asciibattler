// Types for replay-page.js, which stays plain JS because main.mjs installs it
// in the recorder's page as text. tests/integration/journal-replay-page.test.ts
// drives it through these, over a stand-in for the live Game.
import type { JournalSegment } from '../../../src/journal/journal';

export interface ReplayOptions {
  /** The battles' playback speed, one of the game's steps (1). */
  readonly speed?: number;
  /** The longest wait between two commands outside a battle (none). */
  readonly maxGapMs?: number;
  /** `skip` ends every battle's countdown as it opens. */
  readonly countdown?: 'full' | 'skip';
}

export interface ReplayReport {
  /** True when the replay reached the journal's end with its final hash. */
  readonly ok: boolean;
  /** Where and how the replay parted from the journal, or null. */
  readonly failure: string | null;
  readonly finished: boolean;
  readonly entries: number;
  /** How many of the journal's entries were consumed. */
  readonly at: number;
  readonly sent: number;
  readonly gameSent: number;
  readonly orders: number;
  readonly battles: number;
  readonly cappedGaps: number;
  readonly battleSeconds: readonly number[];
  readonly reason: { readonly journal: string; readonly page: string | null };
  readonly hash: { readonly journal: string; readonly page: string | null };
  readonly build: { readonly journal: string; readonly page: string | null };
}

export interface ReplayDriver {
  begin(now: number): void;
  frame(now: number): void;
  readonly done: boolean;
  report(): ReplayReport;
}

/** `game` is the live Game, reached by its runtime names (each checked). */
export default function replayDriver(
  game: unknown,
  segment: JournalSegment,
  opts?: ReplayOptions,
): ReplayDriver | { readonly error: string };
