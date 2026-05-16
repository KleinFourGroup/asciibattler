/**
 * Fixed-timestep accumulator. Decouples the simulation rate from the render
 * framerate: callers feed real `dt` from `requestAnimationFrame`, and Clock
 * fires `onTick` zero or more times to keep sim time aligned with real time.
 *
 * This is the canonical pattern from "Fix Your Timestep!" — render at whatever
 * the browser gives us, simulate at a fixed rate, never mix the two.
 */
export class Clock {
  /**
   * Cap on how much time the accumulator will retain after a stall. After a
   * long pause (tab backgrounded, debugger break, GC hitch) the next frame's
   * `dt` could otherwise demand hundreds of ticks at once, which would either
   * freeze the page or spiral as each catchup takes longer than real time.
   * We just drop the excess time.
   */
  private static readonly MAX_CATCHUP_TICKS = 250;

  private readonly tickSeconds: number;
  private readonly onTick: () => void;
  private accumulator = 0;

  constructor(tickRateHz: number, onTick: () => void) {
    this.tickSeconds = 1 / tickRateHz;
    this.onTick = onTick;
  }

  /**
   * Advance the clock by `dtSeconds` of real time. Fires `onTick` exactly
   * `floor((accumulator + dt) / tickSeconds)` times (subject to the catchup
   * cap), in order, before returning.
   */
  advance(dtSeconds: number): void {
    this.accumulator += dtSeconds;

    const cap = Clock.MAX_CATCHUP_TICKS * this.tickSeconds;
    if (this.accumulator > cap) this.accumulator = cap;

    // Compute the number of ticks in one division — iterative
    // `accumulator -= tickSeconds` accumulates one rounding error per tick,
    // which silently loses a tick on long catchups (e.g. 250 × 0.1 underflows).
    const ticks = Math.floor(this.accumulator / this.tickSeconds);
    if (ticks > 0) {
      this.accumulator -= ticks * this.tickSeconds;
      for (let i = 0; i < ticks; i++) this.onTick();
    }
  }
}
