/**
 * The pre-battle countdown's timer, on real time, for the window that opens
 * every turn: the board shows, the sim is parked while the player reads it
 * and sets orders, then the fight starts. A pause with a timer that
 * unpauses: `BattleScene` pauses `playback` on mount and resumes it when
 * this ends, by expiry or the player's Fight now.
 *
 * It holds only the timer, so it is tested without a DOM or a renderer; the
 * skip's wiring and the visuals are `BattleScene`'s, and the readout the
 * HUD's. The caller passes the unscaled frame `dt`, so a speed-up cannot
 * shorten it.
 */
export class PreBattleCountdown {
  // The recorder holds the countdown by patching `advance` on the instance and
  // resets `remaining` from outside (shell/electron/probes/record-page.js), as
  // a parked board fixture does; PreBattleCountdown.test.ts pins that shape.
  private remaining: number;

  constructor(seconds: number) {
    this.remaining = Math.max(0, seconds);
  }

  /** True while the countdown is still holding the sim. A `0`-second countdown
   *  is inactive from the start (instant battle start). */
  get active(): boolean {
    return this.remaining > 0;
  }

  /** Seconds left (real time), for any caller that wants the raw value. */
  get remainingSeconds(): number {
    return this.remaining;
  }

  /** Whole seconds for the readout — `ceil` so a 5s countdown shows 5→1 (each
   *  integer for ~1s) and hits 0 exactly as the battle starts. */
  get displaySeconds(): number {
    return Math.ceil(this.remaining);
  }

  /** Count down by one frame of REAL dt. Clamped at 0 (never negative). */
  advance(dt: number): void {
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - dt);
  }

  /** End the countdown now — the Fight-now skip. */
  skip(): void {
    this.remaining = 0;
  }
}
