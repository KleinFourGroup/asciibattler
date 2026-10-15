/**
 * A fixed-timestep accumulator, the pattern of "Fix Your Timestep!": the
 * caller feeds the real frame time from `requestAnimationFrame`, and the
 * clock fires `onTick` zero or more times so the sim keeps a fixed rate in
 * step with real time while rendering runs at whatever rate the browser
 * gives.
 */
export class Clock {
  /**
   * The most time the accumulator keeps after a stall, in ticks. After a
   * long pause (a background tab, a debugger break, a GC hitch) the next
   * frame's `dt` would otherwise ask for hundreds of ticks at once, freezing
   * the page or spiralling as each catch-up takes longer than real time. The
   * excess is dropped.
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
   * Advances the clock by `dtSeconds` of real time, firing `onTick`
   * `floor((accumulator + dt) / tickSeconds)` times, after the catch-up cap,
   * before it returns.
   */
  advance(dtSeconds: number): void {
    this.accumulator += dtSeconds;

    const cap = Clock.MAX_CATCHUP_TICKS * this.tickSeconds;
    if (this.accumulator > cap) this.accumulator = cap;

    // One division, not a loop of `accumulator -= tickSeconds`: the loop
    // adds a rounding error per tick and loses a tick on a long catch-up.
    const ticks = Math.floor(this.accumulator / this.tickSeconds);
    if (ticks > 0) {
      this.accumulator -= ticks * this.tickSeconds;
      for (let i = 0; i < ticks; i++) this.onTick();
    }
  }
}
