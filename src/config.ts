/**
 * Tunable constants. Keep this file boring — values, not logic.
 * If a constant grows logic around it, lift it into its own module.
 */

/** Simulation tick rate in Hz. All cooldowns/timers are expressed in ticks. */
export const TICK_RATE = 10;

/** Convenience derivative: seconds per tick. */
export const TICK_SECONDS = 1 / TICK_RATE;

/** Battle grid dimensions (square). Used from Step 3.1 onward. */
export const GRID_SIZE = 12;
