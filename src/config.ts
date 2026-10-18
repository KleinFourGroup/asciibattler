/**
 * Tunable constants. Keep this file boring — values, not logic.
 * If a constant grows logic around it, lift it into its own module.
 */

/** The simulation's tick rate in Hz. The sim runs in ticks; gameplay is
 *  authored in seconds (`secondsToTicks` below). Changing this
 *  re-discretizes the simulation but leaves authored balance intact: a
 *  0.5 s cooldown is 0.5 s of wall time at any TICK_RATE.
 */
export const TICK_RATE = 20;

/** Seconds per tick. */
export const TICK_SECONDS = 1 / TICK_RATE;

/** The square board the renderer frames before the first battle fits it to
 *  its own (`Renderer`); a battle's grid is its encounter's. */
export const GRID_SIZE = 12;

/**
 * Convert a duration authored in seconds to ticks. Every cooldown, timer
 * and duration in gameplay code goes through this helper, and no tick count
 * is written by hand: the source of truth is seconds.
 *
 * Rounds to nearest, so an input under half a tick gives 0; a caller that
 * needs a minimum guards for it itself.
 */
export const secondsToTicks = (seconds: number): number =>
  Math.round(seconds * TICK_RATE);

/** The inverse of `secondsToTicks`, for the renderer and the UI, which
 *  animate or show in seconds what the sim counts in ticks.
 */
export const ticksToSeconds = (ticks: number): number => ticks * TICK_SECONDS;
