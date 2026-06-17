/**
 * Q2 — the pre-battle countdown timer.
 *
 * A tiny real-dt timer for the reaction-time window that opens every turn: the
 * board is shown but the sim is parked while the player reads it and sets
 * orders, then the fight starts. Conceptually it's "a pause with an auto-unpause
 * timer" — `BattleScene` pauses `playback` on mount and resumes it when this
 * countdown ends (by expiry or a player Fight-now skip).
 *
 * This holds ONLY the timer so it's unit-testable without a DOM/renderer
 * (`BattleScene` itself isn't). The skip-via-unpause wiring + the visuals live
 * in `BattleScene`; the readout lives in `HUD`. Counted in REAL dt — a
 * fast-forward speed must not shorten it (and the sim is paused during it
 * anyway), so the caller passes the unscaled frame `dt`.
 */
export class PreBattleCountdown {
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
