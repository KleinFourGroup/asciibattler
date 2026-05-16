/**
 * Tunable constants. Keep this file boring — values, not logic.
 * If a constant grows logic around it, lift it into its own module.
 */

/** Simulation tick rate in Hz. The sim runs in ticks; gameplay is authored
 *  in seconds (see `secondsToTicks` below). Changing this re-discretizes the
 *  simulation but leaves authored balance intact — a "0.5 s cooldown" is
 *  always 0.5 s of wall time, regardless of TICK_RATE.
 */
export const TICK_RATE = 10;

/** Convenience derivative: seconds per tick. */
export const TICK_SECONDS = 1 / TICK_RATE;

/** Battle grid dimensions (square). Used from Step 3.1 onward. */
export const GRID_SIZE = 12;

/**
 * Convert authored-in-seconds durations to tick counts. **All cooldowns,
 * timers, and durations in gameplay code go through this helper.** Never
 * hardcode tick counts in archetypes, behaviors, or anywhere else — the
 * source of truth is seconds.
 *
 * Rounds to nearest. Returns 0 for inputs that round below half a tick;
 * callers that need a minimum guard for it themselves.
 */
export const secondsToTicks = (seconds: number): number =>
  Math.round(seconds * TICK_RATE);

/** Inverse of `secondsToTicks` — used by the renderer/animator when an
 *  event carries a tick count and we need a seconds-domain duration to lerp.
 */
export const ticksToSeconds = (ticks: number): number => ticks * TICK_SECONDS;
